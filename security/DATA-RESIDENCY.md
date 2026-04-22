# Data Residency — Regional Deployment Silos

> The architecture and compliance narrative for how tenant data is kept in its home jurisdiction. Pairs with [ADR-0006](../references/adr/0006-regional-deployment-silos.md). The database-layer operational detail (`Tenant.dataRegion` enum, per-region Postgres, DR within same compliance tier) lives at [`database/DATA-RESIDENCY.md`](../database/DATA-RESIDENCY.md); this document covers the infrastructure-silo architecture and the compliance story.

---

## The architectural shape

AIMS v2 enforces data residency via **separate regional deployment silos**. Each region is an independent, operationally-complete deployment: its own EKS cluster, its own RDS PostgreSQL instance, its own ElastiCache Redis, its own S3 buckets, its own auth service, its own KMS keys, its own observability stack, its own SQS queues.

There is no global control plane. There is no shared database replicating tenant metadata across regions. There is no central auth service issuing region-claim JWTs. Tenants are provisioned into exactly one region at onboarding; once provisioned, the tenant's data never leaves that region.

Cross-region traffic is limited to:

- Disaster recovery within the same compliance tier (us-east-2 primary → us-west-2 DR; eu-central-1 primary → eu-west-1 DR; GovCloud primary → GovCloud secondary — **never across tiers**)
- Observability metadata (region-level health metrics; never tenant data) aggregated into a cross-region dashboard at the operator level
- The pre-tenant marketing / sign-up flow at the global DNS layer, which provisions the tenant into their chosen home region

---

## The rollout

Per ADR-0006:

| Phase | Region | Trigger | Compliance scope |
|---|---|---|---|
| **Phase 1** — launch (2026) | us-east-2 | Always active | SOC 2 Type I → Type II baseline |
| **Phase 2** — first EU tenant (est. 2027) | eu-central-1 | First signed EU tenant | Same as Phase 1 + GDPR residency |
| **Phase 3** — federal pipeline (est. 2028+) | govcloud-us-west | Federal customer pipeline justifies the FedRAMP investment | FedRAMP Moderate baseline |
| **Phase 4** — open-ended | APAC, LatAm, others | Tenant demand justifies | TBD per jurisdiction |

Each silo stands up as a weeks-of-work provisioning exercise — Terraform apply, observability wiring, deployment pipeline setup, SOC 2 scope extension. Existing tenants do not migrate between silos; a tenant's home region is immutable at onboarding.

---

## Tenant provisioning flow

1. Prospective tenant arrives at the global marketing site (CloudFront + S3, served from no specific silo)
2. Sign-up form collects the tenant's jurisdiction and preferred home region
3. Validation: the tenant's legal address must be compatible with the chosen region's jurisdiction (an EU tenant cannot pick us-east-2 without explicit DPA acknowledgement of cross-border transfer implications)
4. Tenant is provisioned into the home region's auth service, database, and infrastructure
5. DNS: Route 53 creates an A-record for the tenant's subdomain (e.g., `oakfield.aims.io`) pointing to the home region's load balancer
6. Subsequent traffic to that subdomain resolves to the home region only

The tenant's home region is stored in Route 53 and in the tenant's onboarding record; it is visible to the tenant in their account settings but not configurable post-provisioning.

---

## What does and does not cross regions

**Does cross regions**:

- Region-level operational metrics (p99 latency, request rate, error rate, DLQ depth) — aggregated into an operator dashboard. No tenant identifiers, no payload data.
- DNS routing decisions at the global layer (Route 53 resolves subdomain to region; the resolution itself is a global operation)
- Infrastructure-as-Code state (Terraform state buckets are per-region; infrastructure templates are in a single source repo that applies to all regions)
- Deployment artifacts (container images are built once and pushed to a global ECR registry, then pulled by each region's EKS cluster — the image bytes are generic and contain no tenant data)

**Does not cross regions**:

- Tenant data (any row in any tenant-scoped table)
- Work papers, reports, attachments (S3 objects)
- User data (auth service is per-region; SSO configurations are per-region)
- Session state (Redis is per-region)
- Audit logs (hash-chained log is per-region; tenant's full audit trail is in their home region)
- Encryption keys (CMKs are per-region; DEKs are per-tenant and live in the tenant's home region)
- Observability data below the metadata level (traces, structured logs, detailed request telemetry remain in the region they were generated)

---

## Compliance narrative per regulation

### GDPR (EU tenants in eu-central-1)

- **Article 44 (data transfers)**: no third-country transfers from eu-central-1. The data never leaves the EU under normal operation. DR is to eu-west-1 (Ireland, same Article 3 territorial scope).
- **Article 30 (records of processing)**: a tenant's full processing record — what was done, when, by whom — is in their home region's audit log, accessible to the tenant and to regulatory review without cross-border data requests.
- **Article 32 (security of processing)**: documented here + in [ROTATION.md](ROTATION.md) (encryption-key lifecycle) + in `INCIDENT-RESPONSE.md` (breach response) + in the [ADR series](../references/adr/) (architectural guarantees).
- **Chapter V (international transfers)**: we do not execute SCCs for customer data, because the data does not leave the EU. We do execute SCCs with our subprocessors where applicable (subprocessor list at the trust center).

### FedRAMP Moderate (federal tenants in govcloud-us-west)

- **SA-9 (external information system services)**: GovCloud silo is physically isolated; the silo's own subprocessors list is distinct from the commercial silos'.
- **SC-4 (information in shared resources)**: no shared resources with non-federal tenants; the silo is single-tenant from a "regulated workload" perspective at the infrastructure level.
- **AC-20 (use of external systems)**: the GovCloud silo does not reach into commercial AWS services; all dependencies are within GovCloud.
- **CM-2, CM-3, CM-6 (configuration management)**: same IaC source as commercial silos with GovCloud-specific overrides; deployments require JAB or Agency ATO per configuration-change policy.

### HIPAA (future healthcare tenants)

- HIPAA does not mandate specific geographic residency; it mandates the covered entity's BAA be in place and PHI be handled per §164.
- HIPAA-scope tenants can live in us-east-2 or eu-central-1 with the appropriate BAA signed.
- Dedicated HIPAA infrastructure tier (separate from commercial) is a future consideration if a large covered-entity customer requires physical isolation beyond what our silo model provides.

---

## What this does not cover

- **Customer self-service region migration**: a tenant wanting to move from us-east-2 to eu-central-1 must offboard and re-onboard, using our data-export tools to carry their data over. This is a deliberate constraint; supporting in-place migration between silos is not in scope.
- **Per-tenant dedicated infrastructure within a silo**: large enterprise customers demanding "our data has no shared infrastructure with any other customer" are served at a future dedicated-infrastructure tier (priced accordingly); not covered in the standard silo model.
- **Support staff cross-region access**: support agents are scoped per region; agents handling EU tenants have accounts only in eu-central-1. Cross-region support requires explicit access grant with audit trail (documented in `SECURITY-PROGRAM.md`).

---

## Monitoring

The data-residency invariant is monitored, not just asserted:

- **Automated cross-region egress scan** runs daily against every silo — queries CloudTrail for any data transfer leaving the silo, alerts on any unexpected egress
- **DNS resolution audit** confirms tenant subdomains resolve only to their home region's load balancer; any anomaly is a P1 incident
- **Backup and DR artifact inventory** confirms all backups live within the silo's compliance tier
- **Subprocessor inventory per silo** confirms the silo's data-handling subprocessors are tier-appropriate (EU silo does not use non-EU subprocessors for customer data)

Any unexpected cross-region flow is a P1 security incident requiring RCA and regulator notification where applicable.

---

## References

- [ADR-0006 — Regional deployment silos](../references/adr/0006-regional-deployment-silos.md)
- [database/DATA-RESIDENCY.md](../database/DATA-RESIDENCY.md) (DB-layer detail, `Tenant.dataRegion` enum, on-premises deployment)
- [docs/06-design-decisions.md §4.8 — Data residency](../docs/06-design-decisions.md#48-regional-deployment-silos-for-data-residency)
- [docs/04-architecture-tour.md §5.1](../docs/04-architecture-tour.md#51-infrastructure) (infrastructure narrative)
- GDPR Regulation (EU) 2016/679, Chapter V
- FedRAMP Moderate baseline — NIST SP 800-53 Rev. 5
- HIPAA Privacy and Security Rules — 45 CFR Parts 160 and 164

---

*Last reviewed: 2026-04-20.*
