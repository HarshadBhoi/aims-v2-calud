# Runbooks & Incident Response

> On-call structure, incident response process, and the ~25 runbooks every engineer should be able to execute at 3am. Every paging alert links to a runbook; every runbook ends in a fix.

---

## 1. On-Call Structure

### Rotation
- **Primary on-call**: 1 engineer, 7 days (Mon 10:00 UTC → Mon 10:00 UTC)
- **Secondary on-call**: 1 engineer, same rotation — takes over if primary unreachable
- **Manager on-call**: rotates monthly — for incident escalation / decisions
- **Compensation**: flat weekly stipend + "carry pay" per incident response + TOIL (time-off-in-lieu) for after-hours incidents

### Who's On Call
- Engineering backend team: weekly rotation among ~6 engineers
- Platform/SRE: separate rotation for infra issues
- Product/data: not on-call (handoff to engineering for tenant issues)

### Tooling
- **PagerDuty** — schedule, escalation, overrides, vacation
- **Slack integration** — page via `@pagerduty` or `/page P1 reason`
- **Status page app** — quick Statuspage updates from phone
- **Runbook access** — GitHub + mirrored to Notion + printable PDFs at home

### Acknowledgement SLA
| Severity | Ack SLA | Page via |
|----------|---------|----------|
| P1 | 5 min | Push + SMS + Phone call |
| P2 | 15 min | Push + SMS |
| P3 | 1 h business hours | Slack @channel |
| P4 | Next business day | Slack mention |

Unack after SLA → escalate to secondary → manager → VP Eng.

---

## 2. RACI — Who Does What

| Activity | Responsible | Accountable | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Primary incident response | On-call | IC | Eng teams | Leadership |
| Incident command | IC (first responder becomes IC) | IC | SRE, VP Eng | All |
| Customer communication | Comms Lead | CS Head | Legal | Customers |
| Technical decisions (rollback, failover) | On-call + SRE | IC | VP Eng | All |
| Regulatory notification | DPO | CEO | Legal, Compliance | Regulators |
| Postmortem | IC | VP Eng | Engaged teams | All engineering |
| Runbook updates | Service owners | Head of SRE | SRE | — |
| Runbook accuracy audit | SRE | Head of SRE | Service owners | Engineering |

---

## 3. Incident Severity Definitions

### P1 — Critical
Customer impact: **major functionality unavailable for >5% of tenants or any enterprise tenant; data loss; security breach**.
- Page IC, primary, VP Eng
- Statuspage updated within 15 min
- All-hands-available if needed
- Postmortem within 5 business days (public summary if contractually required)

### P2 — High
Customer impact: **degraded functionality for meaningful segment; SLO burn critical**.
- Page primary on-call
- Statuspage updated if > 15 min
- Postmortem within 10 business days

### P3 — Medium
Customer impact: **minor degradation or issue affecting small segment; workarounds exist**.
- Slack alert; no page outside business hours
- Investigate in next business window
- Postmortem optional (if pattern repeats)

### P4 — Low
Engineering concern: **internal issue, cost anomaly, deprecation**.
- Slack notification
- Handled in normal sprint work

---

## 4. Incident Response Process

### 4.1 Alert → Acknowledge (T+0 to T+5)
- Alert fires (PagerDuty / Sentry / manual)
- On-call acks (stops further escalation)
- Joins `#incidents` Slack + incident-specific channel auto-created

### 4.2 Triage (T+5 to T+15)
- Determine severity (see §3)
- Open incident channel: `/incident declare P1 "Production API 5xx spike"`
- Incident bot (or manual):
  - Creates Slack channel `#incident-2026-04-19-api-5xx`
  - Opens Zoom bridge (link in channel)
  - Posts initial status to Statuspage
  - Pages additional responders based on severity

### 4.3 Roles (T+15, by P1)
Assign explicitly even if same person initially:
- **Incident Commander (IC)** — drives response, decides, delegates
- **Technical Lead** — makes technical changes (rollback, etc.)
- **Comms Lead** — updates Statuspage, emails, internal Slack
- **Scribe** — timestamps decisions and actions in the channel

### 4.4 Mitigate FIRST (T+5 to T+60)
**Restore the customer experience before you understand the root cause.** Mitigation toolkit:
- Argo rollback
- Feature flag off
- Regional failover
- Scale up
- Traffic shed (rate limit aggressively)

### 4.5 Investigate
After mitigation, keep channel open; investigate root cause with logs, traces, metrics. Don't let the pressure of "the site is back up" prevent root-cause discovery.

### 4.6 Resolve (customer impact cleared)
- Statuspage "monitoring" → "resolved" after 30 min stable
- Incident declared resolved in channel
- Channel remains open for follow-up

### 4.7 Postmortem (T+1 day to T+5 days)
- Blameless; focus on systems, not people
- Template: `runbooks/postmortem-template.md`
- Include: timeline, impact, contributing factors, actions to prevent recurrence
- Review meeting within 5 business days
- Action items tracked in backlog; follow-up to completion

### Blameless Culture
- No "who made the mistake"; ask "what in the system let the mistake happen"
- Humans are not the root cause; systems that allow humans to cause outages are
- Missed something? Not a failure — data for improvement

---

## 5. Runbook Template

Every runbook follows the same structure — consistent = scannable at 3 am:

```markdown
# Runbook: <Title>

## Severity
P1 / P2 / P3 / P4

## Symptoms
- Specific metric or alert name
- Customer-visible behavior

## Impact
Who is affected, how badly.

## Related alerts
- AlertName (from PrometheusRule)

## Investigation
Step-by-step to confirm this is the issue:
1. Check Grafana dashboard X
2. Query Loki for ...
3. Tail trace in Tempo

## Resolution
Commands to run, in order. Include expected output.

```bash
kubectl -n aims rollout restart deployment/api
```

Expected: rollout completes in ~2 min, pods Ready, error rate back to baseline.

## Escalation
If resolution fails after 15 min, escalate to: <team / person>.

## Verification
How to confirm resolved:
- Error rate back below threshold for 10 min
- Canary metrics green

## Postmortem
Required / optional (per severity).

## Owner
Team or engineer who owns this runbook.
```

---

## 6. Runbook Catalog

Every paging alert has a runbook. Summary of key runbooks (full text in `runbooks/` directory):

### 6.1 Application Runbooks

#### `api-high-error-rate.md`
**Symptom**: API 5xx rate > 1% sustained 2+ min.
**Investigation**:
1. Check recent deploys (`argocd app history`) — likely suspect if within last 30 min
2. Loki query: `{service="aims-api"} |= "error" | json | level="error"` — what's failing?
3. Check RDS Performance Insights — slow queries?
4. Check dep status (Stripe, SendGrid, IdP)
**Resolution (by cause)**:
- Recent deploy: `kubectl argo rollouts undo api -n aims`
- DB issue: see `db-slow-query.md`
- External dep: see `third-party-outage.md`
- Unknown: scale up 2×, open bridge with backend team

#### `api-high-latency.md`
**Symptom**: p99 > 800 ms for 5+ min.
**Investigation**: similar to above; latency rarely appears alone (usually correlates with errors or DB saturation).
**Resolution**:
- Scale out API pods (HPA may be too slow)
- Check DB connection pool exhaustion
- Check Redis hit rate (cold cache adds latency)

#### `web-high-error-rate.md`
**Symptom**: Next.js errors spiking in Sentry.
**Investigation**: Sentry release page; which route / component?
**Resolution**: rollback if deploy-correlated; hotfix if obvious issue.

#### `worker-queue-backup.md`
**Symptom**: BullMQ queue depth > 1000 sustained.
**Investigation**:
1. Grafana queue dashboard — which queue?
2. Are workers healthy? Pod count, errors in Loki
3. Is job processor stuck on a bad job?
**Resolution**:
- Scale workers (manual kubectl or wait for KEDA)
- Kill + restart wedged worker pod
- Move poisoning job to DLQ (dead-letter queue) and continue

#### `pdf-generation-timeout.md`
**Symptom**: PDF jobs timing out > 30 s.
**Investigation**: PDF worker pod resources; Puppeteer memory leak indicators; specific finding / tenant?
**Resolution**: restart pdf-worker; scale up memory; isolate bad input.

### 6.2 Data Runbooks

#### `db-primary-failover.md`
**Symptom**: RDS primary unreachable; Multi-AZ should auto-failover.
**Investigation**: RDS event log; connectivity; SG changes?
**Resolution**: usually automatic within 60–120 s. If manual needed: `aws rds reboot-db-instance --force-failover`.

#### `db-restore-pitr.md`
**Symptom**: Need to roll back DB to specific point in time.
**Investigation**: confirm the time; confirm DR is necessary (not a hotfix).
**Resolution**:
1. `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier aims-prod-db --target ... --restore-time ...`
2. Validate: connect, check key tables
3. Switch app: update Secrets Manager DB endpoint → restart pods
4. Retain old instance 7 days for forensic review.

#### `db-slow-query.md`
**Symptom**: query latency alerts; RDS CPU > 80%.
**Investigation**: `pg_stat_statements`; which query? Missing index?
**Resolution**:
- Add index (via migration) if safe
- Kill rogue query: `SELECT pg_terminate_backend(pid)`
- Scale up DB instance temporarily
- Rate-limit offending endpoint at WAF

#### `db-replication-lag.md`
**Symptom**: Read replica / DR replica lag > 60 s.
**Investigation**: network; replica CPU; long-running transaction on primary?
**Resolution**: usually resolves itself; if persistent, increase replica size or kill offending long-TXN.

### 6.3 Infrastructure Runbooks

#### `eks-node-unhealthy.md`
**Symptom**: NodeNotReady alerts; pods Pending.
**Investigation**: `kubectl describe node`; AWS EC2 events; capacity?
**Resolution**:
- Cordon + drain node; terminate instance; ASG replaces
- If widespread: check VPC, region events, SGs

#### `oom-kill-loop.md`
**Symptom**: Pod CrashLoopBackOff; events show OOMKilled.
**Investigation**: pod memory usage; recent changes to limits?
**Resolution**:
- Bump memory limit (PR to values.yaml)
- Check for memory leak in app code
- Consider scale-out vs scale-up tradeoff

#### `cluster-autoscaler-stuck.md`
**Symptom**: pending pods; nodes not scaling.
**Investigation**: CA logs; ASG limits; pod requests vs node instance type fit?
**Resolution**:
- Check ASG max capacity; raise if hit
- Check node affinity/taints mismatch
- Manually scale desired capacity while debugging

#### `ingress-5xx.md`
**Symptom**: ALB 5xx but pods seem healthy.
**Investigation**: target group health; SG; NetworkPolicy blocking?
**Resolution**: fix SG; inspect target group health check endpoint.

### 6.4 Security Runbooks

#### `secret-leaked.md`
**Symptom**: secret detected in public channel or commit.
**Investigation**: how was it leaked? What scope of access?
**Resolution**:
1. **Rotate the secret immediately** (don't wait to understand)
2. Revoke all active sessions/tokens tied to it
3. Audit CloudTrail for unauthorized use since suspected leak
4. Notify Security team; file incident
5. Postmortem in 48 h

#### `unauthorized-access-attempt.md`
**Symptom**: suspicious login patterns; GuardDuty finding; anomalous API calls.
**Investigation**: CloudTrail review; IP geolocation; user session history.
**Resolution**:
- Force password reset on affected accounts
- Revoke sessions
- Block IP / ASN at WAF
- Escalate to Security if insider threat suspected

#### `waf-false-positive.md`
**Symptom**: customers reporting legit requests blocked.
**Investigation**: WAF logs; rule triggered; request pattern.
**Resolution**: add exception / IP allowlist; bug-file managed rule if systemic.

#### `ddos.md`
**Symptom**: traffic spike; latency degradation; error rate up.
**Investigation**: Cloudflare + WAF; source IPs; pattern (HTTP flood, amplification, bot)?
**Resolution**:
- Enable Cloudflare "Under Attack" mode
- Tighten WAF rate limits
- Scale up infra to absorb
- Contact AWS Shield support if volumetric

### 6.5 Dependency & External Runbooks

#### `third-party-outage.md`
**Symptom**: Stripe / SendGrid / IdP / OpenAI down; feature degraded.
**Investigation**: vendor status page; our error patterns.
**Resolution**:
- Flip ops kill switch for affected feature
- Queue requests for later retry
- Notify customers if user-visible
- Monitor vendor; resume when healthy

#### `sso-idp-outage.md`
**Symptom**: tenant can't log in; SAML/OIDC failures.
**Investigation**: tenant's IdP or ours? Cert expired? Metadata changed?
**Resolution**:
- Work with tenant admin
- Temporary local admin login grant (emergency runbook — requires approval)
- Update metadata when IdP restored

### 6.6 Deploy-Related Runbooks

#### `failed-deploy-rollback.md`
Covered in `RELEASE.md §7`.

#### `migration-failed.md`
**Symptom**: migration job errored or timed out.
**Investigation**: migration log; what was changed? Lock held too long?
**Resolution**:
- If DDL: manual rollback via SQL (hand-written `ALTER TABLE ... DROP COLUMN` etc.)
- If data migration: replay after fix
- Prevent by classifying + testing migrations better (see `CI-CD.md §6`)

#### `canary-failed.md`
**Symptom**: Argo Rollouts analysis failed; canary aborted.
**Investigation**: canary pod logs; SLO metrics; what differs from stable?
**Resolution**: fix bug; retry deploy; or accept if analysis was too tight.

### 6.7 Tenant-Specific Runbooks

#### `tenant-data-export.md`
**Symptom**: tenant GDPR export request.
**Procedure**:
1. Verify request authenticity (signed by tenant admin)
2. Run export job: `node scripts/tenant-export.js --tenant tnt_...`
3. Monitor job; output to `s3://aims-{env}-exports/tnt_.../{date}.tar.gz.enc`
4. Send download link (presigned, 7-day TTL)
5. Log in audit trail

#### `tenant-data-deletion.md`
**Procedure**:
1. Verify deletion request (signed)
2. Initiate 30-day soft-delete period
3. After 30 days (configurable, contract-dependent): run hard-delete job
4. Destroy per-tenant KMS CMK (cryptographic erasure for encrypted data)
5. Confirm in audit trail + contract records
6. Report completion

#### `tenant-impersonation.md` (Support)
**Rarely used — requires approval**.
**Procedure**: explicit approval from tenant admin → admin dashboard "Support Access" flag → time-bound session → full audit trail. Never without tenant consent.

### 6.8 Cost / Platform Runbooks

#### `runaway-cost.md`
**Symptom**: AWS Budget alert fired (120%); unexpected spend.
**Investigation**: Cost Explorer by service + by tag; recent changes?
**Resolution**:
- Identify culprit (often: forgotten preview env, misbehaving job in loop, DDoS-generated CloudFront requests)
- Shut down or scale down as appropriate
- Budget review; tighten alerts if surprise

#### `terraform-drift.md`
**Symptom**: Nightly drift detection reports out-of-band changes.
**Investigation**: what resource; what changed; who changed it?
**Resolution**:
- If unauthorized: investigate as security incident
- If legit manual fix: create Terraform PR to match reality
- Re-apply Terraform to reconcile

### 6.9 Compliance / Legal Runbooks

#### `data-breach-notification.md`
**Procedure** (driven by DPO + Legal):
1. Contain breach; preserve evidence
2. Assess scope: what data? How many tenants? Exfiltration confirmed?
3. Notify Legal within 1 h of suspected breach
4. Regulatory notification deadlines:
   - GDPR: 72 h from awareness
   - CCPA: "without unreasonable delay"
   - State-specific (varies; some require 30d)
5. Customer notification per contract
6. File with insurance carrier
7. Post-incident: detailed report, public if applicable

#### `law-enforcement-request.md`
**Procedure**: route to Legal; no data disclosure without warrant/subpoena; notify affected tenant unless gag order.

---

## 7. Runbook Quality Standards

### Every runbook MUST have:
- [x] Title stating the symptom, not the cause
- [x] Severity specified
- [x] Copy-pasteable commands (not pseudo-code)
- [x] Expected output or validation step
- [x] Escalation path if resolution fails
- [x] Postmortem requirement
- [x] Owner (team + last reviewer)
- [x] Last tested date (for "playable" runbooks)

### Runbook SHOULDN'T:
- ❌ Require deep familiarity with the codebase
- ❌ Assume access that on-call might not have
- ❌ Say "ask X" as the only step (X might not be awake)
- ❌ Include steps without a way to validate they worked
- ❌ Contain secrets (link to where they can be fetched)

### Runbook Review Cadence
- New runbook → PR review + at least one unrelated engineer to confirm understandable
- Monthly: on-call team reviews any runbook used recently — accuracy, missing steps
- Quarterly: runbook audit — test a random sample in staging (actually run them)

---

## 8. Common Operations Cheatsheet

For on-call who hasn't looked at the system in a while:

```bash
# Current pod status
kubectl get pods -n aims
stern -n aims api        # tail logs across all api pods

# Recent deploys
argocd app history aims-v2-prod-us | head

# Database diagnostics
psql -h aims-prod-db -U aims_readonly aims -c "\l"
psql -h aims-prod-db -U aims_readonly aims -c "SELECT * FROM pg_stat_activity"

# Rollback last deploy
kubectl argo rollouts undo api -n aims

# Check SLO
curl -s https://grafana.internal/api/...   # or view in UI

# Page someone
# Slack: /page P1 <reason>

# Status page update
statuspage component update "API" degraded   # via CLI wrapper

# Break-glass prod access request
aims-cli prod-access --role SRE-Prod --duration 1h --reason "..."
```

---

## 9. Training & Onboarding

### New Engineer Onboarding (Week 1)
- Read all runbooks
- Shadow on-call for one rotation
- Pair on one incident (observer)
- Tabletop exercise with IC

### Before Going On-Call Solo
- Pass runbook quiz (automated — Random runbook, "what's step 3?")
- Demonstrate: rollback a staging deploy end-to-end
- Demonstrate: identify a simulated SLO burn via dashboards
- Sign off from current on-call lead

### On-call Game Day (Quarterly)
- Inject faults in staging; on-call team responds live
- Timed; scored on MTTR + adherence to runbook
- Debrief afterward

---

## 10. Tools & Access Required for On-Call

| Tool | Access | MFA |
|------|--------|-----|
| PagerDuty | Phone number in schedule | — |
| Slack | `#incidents`, `#deploys`, `#sre` | Yes |
| GitHub | Repo access, Actions runs | Yes |
| AWS Console (prod JIT) | SSO login; JIT role assumption | Yes (MFA re-challenge) |
| kubectl (prod) | Via SSO → assume-role → update-kubeconfig | Yes |
| Grafana | SSO; Viewer+ role | Yes |
| Sentry | SSO; project access | Yes |
| Statuspage | Admin role | Yes |
| ArgoCD | SSO; sync permissions | Yes |

---

## 11. Postmortem Template

```markdown
# Postmortem: <Incident Title>
- **Date**: YYYY-MM-DD
- **Duration**: HH:MM to HH:MM UTC (X min)
- **Severity**: P1 / P2 / P3
- **IC**: @name
- **Authors**: @names

## Summary
2-3 sentences describing what happened and impact.

## Impact
- Users affected: estimate + segments
- SLO impact: error budget burn
- Data loss? Revenue impact?

## Timeline (UTC)
- 14:20 — deployment of X
- 14:23 — alert: high error rate
- 14:24 — on-call acked
- 14:28 — incident declared P1; Slack channel opened
- 14:30 — IC identified suspect deploy
- 14:32 — rollback initiated
- 14:35 — rollback complete; errors dropping
- 14:45 — monitoring; metrics normal
- 14:50 — resolved

## Contributing Factors
- System factor 1
- System factor 2
(Not: "X forgot to test" — "The system didn't require X to test this path")

## What Went Well
- Alert fired quickly
- On-call acked within 4 min
- Rollback completed cleanly

## What Didn't
- Tests didn't catch the regression
- Migration classification was ambiguous; reviewer didn't flag

## Action Items
| Action | Owner | Due | Tracked |
|--------|-------|-----|---------|
| Add test for X | @name | YYYY-MM-DD | LIN-1234 |
| Tighten migration classifier | @name | YYYY-MM-DD | LIN-1235 |

## Detection
How did we find out? Could we have found out sooner?

## Lessons
Generalizable takeaways for other teams.
```

---

## 12. Non-Production Runbooks

Some things aren't incidents but are still operational:

- `db-migration-schedule.md` — how to plan and execute a planned migration
- `certificate-rotation.md` — the non-ACM/non-LE cases
- `employee-offboarding.md` — revoke access, transfer ownership
- `new-service-onboarding.md` — checklist for adding a new service to the platform (logs, metrics, dashboards, alerts, runbook, SLO)
- `new-tenant-onboarding.md` — provisioning, billing, domain setup
- `pentest-prep.md` — supporting annual pen test by external firm

---

## 13. What We Don't Tolerate

- **Pages without runbooks** — if it pages, it has a runbook. No exceptions.
- **Runbooks that are wrong or stale** — tested runbooks only; untested flagged `[UNTESTED]`.
- **Blame in postmortems** — focus on systems.
- **Heroes** — "Jane stayed up all night and fixed it" is a process failure, not a success. The process should not require a hero.
- **Silent pages** — every page results in Slack visibility, even if resolved by on-call alone.

---

## 14. Related Documents

- [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) — DR procedures
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — what alerts, what's normal
- [`RELEASE.md`](RELEASE.md) — rollback & hotfix
- [`SECRETS.md`](SECRETS.md) — rotation runbooks
- [`CI-CD.md`](CI-CD.md) — pipeline behavior (pipelines sometimes fail in ways that page)
