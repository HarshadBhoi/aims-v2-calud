# Disaster Recovery

> RPO 15 min, RTO 1 h. Warm standby in secondary region. Tested quarterly. Backups exist if we can restore them — so we do, every month.

---

## 1. Objectives

### RPO — Recovery Point Objective
**15 minutes.** At worst, we lose 15 minutes of data in a disaster.

Mechanism: PostgreSQL continuous WAL shipping to cross-region S3 via RDS automated backups + cross-region snapshot copy. S3 cross-region replication for object storage.

### RTO — Recovery Time Objective
**1 hour** (production). From "outage declared" to "customers see service restored".

Mechanism: Warm standby region with infrastructure always running; DNS failover + database promotion.

### Availability SLO (30d)
Per service: 99.95% (internal), 99.9% (contractual). See `OBSERVABILITY.md §8`.

---

## 2. Disaster Scenarios Addressed

| Scenario | Likelihood | Severity | RTO | Mechanism |
|----------|-----------|----------|-----|-----------|
| Bad deploy causes outage | High | Medium | 5 min | Argo Rollouts auto-rollback |
| Database corruption | Low | Critical | 1 h | PITR to pre-corruption time |
| Accidental data deletion (app-level) | Medium | Critical | 30 min | Audit log + soft-delete + PITR |
| Accidental data deletion (ops-level) | Low | Critical | 2 h | Multi-person approval + PITR |
| AZ failure (one of three) | Medium | Low | Zero (Multi-AZ auto) | RDS Multi-AZ, EKS spread, ALB health |
| Region failure | Low | High | 1 h | Cross-region warm standby + DNS failover |
| Ransomware on infra | Very low | Catastrophic | 4–8 h | Immutable backups + isolated DR account |
| KMS key deleted (accidentally) | Very low | Catastrophic | 30 d (pending) | 30-day pending deletion window |
| DDoS | Medium | High | Mitigated | Cloudflare + WAF + rate limits |
| Cloud provider account compromise | Very low | Catastrophic | 8+ h | Break-glass + account re-create + restore |
| Insider threat (destructive) | Low | High | 1–4 h | Audit log + multi-person controls + backups |
| Supply chain attack (dep compromise) | Low | High | 4–24 h | Signed images, SBOM, rollback, dep pinning |

---

## 3. Backup Strategy

### Database (PostgreSQL — RDS)

| Layer | Mechanism | Cadence | Retention |
|-------|-----------|---------|-----------|
| **PITR (Point-In-Time Recovery)** | RDS automated | Continuous (WAL every 5 min) | 35 days |
| **Daily snapshots** | RDS automated | Nightly 03:00 UTC | 35 days |
| **Monthly long-term** | RDS snapshot copied to Glacier | 1st of month | 7 years |
| **Cross-region copy** | RDS automated copy | Daily | 35 days (DR region) |
| **Logical `pg_dump`** | CronJob worker → S3 | Nightly | 90 days hot, 7 years Glacier |

Why both physical + logical:
- **Physical** (RDS snapshots / PITR) — fastest restore, but tied to RDS version
- **Logical** (pg_dump) — portable (restore to any PG 16+), useful for forensic/audit

### Object Storage (S3)
- Versioning enabled on all buckets
- Object Lock (compliance mode) on `attachments`, `reports`, `backups` — 7-year retention
- Cross-region replication (CRR) on production data buckets: US ↔ EU
- Lifecycle: Glacier Deep Archive after 365 days for cold data

### Kubernetes / EKS
- Stateless workloads — no backup needed (re-deploy from Git)
- ConfigMaps + Secrets — sourced from Git + AWS Secrets Manager (those are backed up)
- PersistentVolumes (rare) — **Velero** daily snapshot → S3

### Terraform State
- S3 bucket with versioning (90-day version retention)
- Cross-region replication to DR region
- MFA Delete required

### Audit Log (hash-chained — see `database/`)
- Primary: in DB, immutable triggers
- Mirror: daily export to `aims-{env}-audit-log-{region}` S3 (Object Lock, 7-year)
- Secondary mirror: cross-account log-archive (independent of workload accounts)

---

## 4. Backup Testing — The Only Valid Verification

"We have backups" is not a recovery strategy. **"We restored backups last month in < X hours" is.**

### Monthly Restore Test (automated)
First Saturday of each month:
1. Automated job spins up a sandbox RDS instance in DR region
2. Restores from latest snapshot
3. Runs validation scripts:
   - Row counts per major table match expected (+/- tolerance)
   - Schema matches production schema
   - Checksums on critical rows
4. If all green, report success; destroy sandbox
5. If any red, page SRE — backups are not healthy

Quarterly Playwright E2E: spin up full stack against DR-restored DB, run login + create engagement + view finding. Measure effective RTO.

### Annual Live Failover Drill
- Scheduled, announced (customer + internal)
- Flip traffic to DR region for a controlled window (say, 2 hours)
- Observe: what breaks? What takes longer than target?
- Revert, update runbooks with lessons learned

---

## 5. Region Architecture

### Primary vs Secondary (Production US)

```
  PRIMARY: us-east-1                          SECONDARY: us-west-2 (DR)
  ┌───────────────────────────┐               ┌───────────────────────────┐
  │  EKS cluster (24 nodes)   │               │  EKS cluster (6 nodes)    │
  │  ├ web, api, worker       │               │  ├ web, api, worker       │
  │  └ receiving traffic      │               │  └ scaled down; idle      │
  │                            │               │                            │
  │  RDS PostgreSQL           │  async         │  RDS PostgreSQL            │
  │  (primary writer)         │  replication   │  (cross-region read       │
  │                            │ ────────────►  │   replica, promotable)     │
  │                            │                │                            │
  │  ElastiCache Redis        │               │  ElastiCache Redis         │
  │  (live)                   │               │  (warm, empty)             │
  │                            │                │                            │
  │  S3 attachments bucket    │ ─── CRR ────► │  S3 attachments bucket     │
  │                            │                │  (replicated)              │
  └───────────────────────────┘                └───────────────────────────┘
              ▲                                             ▲
              │                                             │
              └─────── Route 53 (weighted) ────────────────┘
                    Primary 100% / DR 0% normally
                    On failover: Primary 0% / DR 100%
```

### Warm Standby Model
- DR region has smaller footprint (~20% of primary capacity)
- DB runs as cross-region read replica — costs ~full RDS price
- Node groups min=2 per AZ (not 0) — avoid cold start latency
- HPA kicks in on promotion; scales to match primary within minutes
- Cheaper than active-active; faster than cold standby

### Hot Standby / Active-Active (Phase 3+)
If we need RTO < 15 min or serve EU traffic from EU primary:
- Multi-region active-active with tenant-home-region routing
- Data sharded by tenant home region (no cross-region writes)
- Significantly more complex; revisit when we have > 100 EU tenants

---

## 6. Failover Procedure — Regional

Runbook: `runbooks/regional-failover.md`. High level:

### Pre-Failover Checklist (5 min)
- [ ] Confirm primary region truly unreachable (not a false alarm)
- [ ] Declare incident (page VP Eng + Security + CEO)
- [ ] Update Statuspage ("investigating regional issue")
- [ ] Incident Commander assigned; bridge opened

### Failover Steps (30 min target)

1. **Promote RDS read replica** in DR region (`aws rds promote-read-replica`)
   - Validates lag (should be < 5 min for healthy async replica)
   - Takes 1–3 min for promotion
2. **Update DNS** — Route 53 health check fails primary, weighted failover flips
   - Manual override: `aws route53 change-resource-record-sets` to force 100% DR
   - TTL 60s; full propagation ~2–5 min
3. **Scale up DR EKS nodes** — HPA kicks in on real traffic; pre-warm if expected
4. **Point app to DR DB** — app reads `DATABASE_URL` from env; secret in DR region already points at its own RDS endpoint
5. **S3** — cross-region replication means objects exist; app uses regional bucket by env
6. **Redis** — cold cache; expect brief latency spike while cache rehydrates
7. **Sentry / observability** — still global SaaS; keeps working

### Post-Failover
- Monitor SLOs in DR region for 30 min before declaring "monitoring"
- Statuspage → "identified / monitoring"
- Customer comms (email to tenant admins) if downtime > 15 min
- Investigate primary region root cause in parallel
- When primary restored: coordinated failback (reverse of above; plan for off-peak)

### Failback
- Never automatic
- Requires primary region fully healthy + RDS replication caught up in reverse direction (DR → primary)
- May take days after major incident; no rush if DR is serving fine

---

## 7. Failover Procedure — Database Only (within same region)

### Automatic (Multi-AZ)
RDS Multi-AZ fails over automatically on primary instance failure. ~60–120 s downtime typically. No human action required.

### Manual Point-In-Time Restore
For corruption / bad deploy:
1. Identify recovery time (before corruption)
2. Initiate PITR: `aws rds restore-db-instance-to-point-in-time`
3. New instance created (takes 10–30 min depending on size)
4. Validate data integrity in new instance
5. Switch app to new instance:
   - Update Secrets Manager DB endpoint
   - Trigger pod restart (secrets refresh)
   - App connects to new DB
6. Stage old instance for forensic review; delete once confirmed restored

**Lost writes**: anything after recovery point gone. Customers notified if material.

---

## 8. Application-Level Recovery

Not every disaster is infra. Some common:

### Accidental Finding / Engagement Deletion (user action)
- Soft delete at app level (`deletedAt` column); restore via admin action within 30 days
- After 30 days: purged. Restorable only from PITR → extraction → re-insert (involves SRE + legal approval)

### Corrupt Import / Bulk Operation
- Audit log has every change; can reconstruct timeline
- `_version` (optimistic concurrency) lets us replay changes up to a point
- Worst case: PITR + re-apply specific changes manually

### Customer Asks for Data Restoration
- If self-service (soft-deleted within window): customer-action in UI
- If beyond soft-delete window: support ticket → SRE reviews → partial PITR to isolate object
- Procedure logged; audited; fee applied to customer (per contract) if cause is customer error

---

## 9. Ransomware & Destructive Attack

### Defense-in-Depth
- **Immutable backups**: Object Lock on backup bucket — can't delete even with root creds
- **Separate log-archive account**: attacker would need to compromise TWO accounts
- **MFA enforced everywhere** (including root via U2F)
- **Short-lived access** (JIT, no standing admin)
- **EDR on nodes** (Falco, AWS GuardDuty) — anomaly detection
- **Signed images required** — attacker can't silently replace image

### If It Happens
1. **Contain** — rotate all secrets; revoke all sessions; isolate compromised accounts
2. **Assess** — what was modified? Audit log is our friend if not touched
3. **Restore** — destroy workload accounts; recreate from Terraform; restore DB from immutable backup
4. **Notify** — law enforcement; regulators (GDPR 72h notification); customers
5. **Postmortem** — public write-up of what happened and what changed

Total downtime if executed: 4–8 hours with practiced drill, more without.

---

## 10. Cloud Account Compromise

### Prevention
- Root account MFA hardware key, stored in safe
- SCPs prevent disabling CloudTrail, removing MFA
- CloudTrail to separate log-archive account (can't be disabled by compromised workload account)
- IAM Identity Center centrally managed

### Response
- Revoke all active sessions (`aws iam delete-session`)
- Deactivate all access keys in compromised account
- Rotate root MFA (break-glass if needed)
- Audit CloudTrail for suspicious activity since first suspected compromise
- Freeze billing to prevent resource creation spree
- If necessary: isolate compromised account at org SCP level

---

## 11. Data Residency & DR

### Problem: EU customer data must stay in EU
If primary EU region (eu-west-1) fails, where do we fail over?
- **Option A**: DR to another EU region (eu-central-1) — respects residency
- **Option B**: Serve from US region — **violates residency commitment**
- We choose A. Extra cost; correctness matters.

### Tenant-Level Residency Flag
If a tenant contractually requires EU-only, they're flagged. Failover honors the flag; US region cannot serve their traffic even briefly.

For tenants without residency constraint: we can serve from nearest healthy region (follows cost and latency).

---

## 12. DR for Secrets & KMS

### Secrets Manager
- Multi-region replication for critical secrets (DB creds, JWT keys)
- `aws secretsmanager replicate-secret-to-regions`
- Replicas are read-only; rotation happens in primary + replicated

### KMS CMKs
- Multi-region keys for data that crosses regions (S3 CRR requires replica CMK)
- Automatic cross-region replication of key material (managed by AWS)
- Same key ARN in both regions; data encrypted in one decrypts in other

### TLS Certificates
- ACM is regional — certs provisioned separately in each region
- Same domains validated via DNS; certs auto-renewed independently
- No single-point dependency

---

## 13. DR for Observability

During incident, we absolutely depend on telemetry. What if observability itself is down?

- **Logs / metrics / traces**: multiple regions + SaaS (Sentry, Grafana managed) → survive one region loss
- **Status page** — hosted externally (Statuspage.io); always reachable even if our infra is down
- **Runbooks** — stored in GitHub + mirrored to Notion + printable PDFs in the break-glass safe
- **Communication channels** — Slack primary; Discord backup for incidents if Slack down; conference bridge standby

---

## 14. Communication Plan

### Internal (all incidents)
- Slack `#incident-XX-YYYY` channel auto-created by incident bot
- Bridge via Zoom / Google Meet — link in channel
- Status updates every 15 min minimum
- Escalation tree in `RUNBOOKS.md`

### Customer-Facing
Threshold for proactive communication:
- Impact > 5 min → Statuspage update
- Impact > 15 min → email to tenant admins (automated)
- Impact > 1 h OR data implication → personal email from CS + VP Eng
- Incident involving data → legal + DPO involved; regulatory notifications within 72h (GDPR) / faster (US state laws)

### Templates
Pre-written templates in `runbooks/comms-templates/`:
- Degraded performance (customer-facing)
- Partial outage
- Full outage
- Restored with monitoring
- Post-incident summary

---

## 15. Game Days

### What
Practice disasters in a safe environment (staging or DR region).

### Cadence
- Tabletop exercise monthly (1 hour, whiteboard)
- Technical drill quarterly (2 hours, actual chaos in staging)
- Full regional failover annually (planned, announced)

### Chaos Engineering
- Chaos Monkey / Chaos Mesh for k8s — random pod kills, network delays, resource limits
- Inject faults in staging on schedule (not prod until Phase 3+)
- Validate: does the system self-heal? Do alerts fire? Are runbooks accurate?

---

## 16. RACI (Who Does What)

| Activity | Responsible | Accountable | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Backup config | Platform | Head of SRE | DBA | — |
| Monthly restore test | SRE | SRE | — | Eng Leadership |
| DR drill | SRE | Head of SRE | Eng teams | All |
| Incident declaration | On-call | IC | Eng Leadership | All |
| Failover execution | On-call + IC | IC | VP Eng | Customers |
| Customer comms | Incident Comms Lead | CS Lead | Legal | All |
| Postmortem | IC | VP Eng | Engaged teams | All |
| Runbook maintenance | Service owners | Head of SRE | SRE | — |

---

## 17. Compliance Mapping

Backup/DR satisfies:

| Framework | Control |
|-----------|---------|
| **SOC 2** | A1.2 (availability), A1.3 (recovery) |
| **ISO 27001** | A.17.1 (continuity), A.17.2 (redundancy) |
| **HIPAA** | 164.308(a)(7) (contingency plan), 164.310(d)(2)(iv) (data backup) |
| **FedRAMP** | CP-1..CP-10 (contingency planning) |
| **GDPR** | Article 32(1)(c) (restore availability) |
| **FINRA 17a-4** (financial) | Records retention + availability |

Quarterly evidence collection (backup logs, restore test reports, drill notes) feeds into audits.

---

## 18. Tested vs Untested

We explicitly distinguish:

| Scenario | Tested? | Last tested | Confidence |
|----------|---------|-------------|------------|
| Bad deploy rollback | Yes | Every deploy | High |
| DB PITR restore | Yes (monthly) | YYYY-MM | High |
| AZ failure | Partially (RDS tested, EKS implicit) | Quarterly | High |
| Regional failover | Annual drill | YYYY | Medium |
| Full account recreation | Tabletop only | YYYY | Low |
| Ransomware | Tabletop only | YYYY | Low |
| Cloud provider outage (multi-region AWS) | Not tested | — | Low |

Untested scenarios are tracked; tabletop reviews schedule them toward tested status.

---

## 19. Cost of DR

Roughly 30–40% of primary region cost for warm standby. For our Phase 1 sizing (~$3k/month primary), DR adds ~$1k/month.

When RTO requirements tighten (large enterprise customers), costs rise. Budget accordingly.

---

## 20. What We Don't Do (Yet)

- **Cold backups as only defense** — all backups are verified restorable
- **Single-region prod** — warm DR minimum from day 1
- **Untested runbooks** — runbooks without recent successful execution are marked `[UNTESTED]`
- **Vendor-specific DR (e.g., AWS Elastic Disaster Recovery)** — we use native primitives (cheaper, more transparent)
- **Backup-to-same-region-only** — always cross-region for production data
- **Delete-on-offboard immediately** — 90-day retention after tenant departure (contractual)

---

## 21. Related Documents

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — multi-region infra that enables DR
- [`SECRETS.md`](SECRETS.md) — multi-region KMS + Secrets Manager
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — what we monitor during recovery
- [`RUNBOOKS.md`](RUNBOOKS.md) — step-by-step procedures
- [`../database/`](../database/) — PITR config, audit log replication
