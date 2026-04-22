# 0006 — Regional deployment silos for data residency

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering, devops, security
- **Tags**: #infrastructure #compliance #multi-tenancy #data-residency

---

## Context

AIMS v2 serves customers in multiple jurisdictions. EU customers are subject to GDPR, which enforces data-location and cross-border-transfer rules via supervisory-authority oversight. US federal customers (future) would be subject to FedRAMP, which requires data to remain in AWS GovCloud. State-level regulations (California CCPA/CPRA, others) add further constraints. Our Phase-5 HIPAA roadmap anticipates healthcare customers with their own location-sensitivity requirements.

Multi-region AWS infrastructure was mentioned in early documentation (`devops/INFRASTRUCTURE.md`) but the *mechanism* of data residency — how tenant data is kept in its home region, how requests route, how compliance is demonstrable to a regulator — was not specified.

External domain review in April 2026 correctly flagged that this is a load-bearing architectural decision that must be made up-front. Retrofitting data-residency enforcement after customers exist in multiple regions means migrating customer data between regions, which is operationally painful and compliance-questionable during the migration window.

---

## Decision

Data residency is enforced via **separate regional deployment silos**. Each region (us-east-2 at launch, eu-central-1 on first EU tenant, govcloud-us-west on federal pipeline) is an **independent deployment** — its own EKS cluster, its own RDS PostgreSQL instance, its own ElastiCache Redis, its own S3 buckets, its own auth service, its own KMS keys, its own observability stack.

Tenants are provisioned into exactly one region at onboarding. Once provisioned, the tenant's data never leaves that region. DNS routing directs tenant-specific traffic (subdomain like `oakfield.aims.io`) to the correct region's load balancer via Route 53 geo-routing + explicit per-tenant A-records. A thin global layer (CloudFront + S3 for the marketing site and sign-up flow) handles the pre-tenant experience; tenant onboarding provisions the tenant into a region and redirects subsequent traffic there.

There is no global control plane sharing data with regional data planes. There is no central auth service issuing region-claim JWTs. There is no shared database replicating tenant metadata across regions. Each silo is operationally complete in itself.

Deployment pipelines run per-region. A code change merged to `main` triggers builds targeting all active regions; promotion through dev → staging → production happens per region with independent SLO analysis.

---

## Alternatives considered

### Option A — Shared global cluster with VPC-level tenant isolation  (rejected)

A single EKS cluster (probably in us-east-2) with VPC isolation per tenant; data residency enforced via database row-level encryption and deterministic routing rules.

**Pros**
- Simplest operational model — one cluster, one deploy pipeline, one observability stack
- Lowest steady-state infrastructure cost — no per-region duplication
- Easy cross-tenant operations (platform admin can see everything from one place)

**Cons**
- Compliance story is hand-wavy — "our EU tenant's data is in a VPC-isolated partition of our us-east-2 cluster" is hard to defend to a GDPR supervisory authority
- Does not satisfy FedRAMP (GovCloud requirement)
- Does not satisfy some EU customers' contractual requirements for physical data location
- A regulator doing a real audit can demand proof of physical location; VPC isolation doesn't provide it

### Option B — Global control plane + regional data planes  (rejected)

Central control plane (auth, tenant metadata, billing, user management) in a primary region; regional data planes for tenant-specific data (findings, engagements, reports).

**Pros**
- Easier SSO and cross-region user management (one identity service)
- Simpler billing and subscription management (one control plane owns the commercial relationship)
- Lower operational complexity than full silos (regional planes are data-only)

**Cons**
- Control plane reads claims about every tenant, including EU tenants — compliance answer to "does our EU tenant's data ever leave the EU?" is "at the authentication envelope, yes" and the conversation gets harder
- Single-point-of-failure on the control plane — an outage in the primary region affects all tenants globally
- Auth service in the primary region is a cross-border data-transfer endpoint subject to SCCs / transfer impact assessments for every EU tenant
- Compliance story is cleaner than Option A but still not as clean as full silos

### Option C — Separate regional deployment silos  (chosen)

Each region is an independent deployment. No shared control plane. Tenants live entirely in one silo.

**Pros**
- Compliance story is clean: "the EU tenant's data never touches anything outside eu-central-1"
- Satisfies GDPR, FedRAMP (via GovCloud silo), and stricter customer DPAs with no hand-waving
- Failure isolation — an us-east-2 outage doesn't affect eu-central-1 tenants
- Regulatory audits are straightforward — the physical infrastructure boundary maps to the compliance boundary
- Future-proofs for additional regions (ap-southeast-1 for APAC, sa-east-1 for Brazil) without architectural change

**Cons**
- Highest steady-state infrastructure cost — roughly 3× the cost when all three current regions are live (us-east-2 + eu-central-1 + govcloud-us-west)
- Operational complexity scales with N-regions — N deploy pipelines, N observability stacks to correlate across, N on-call rotations potentially
- Cross-tenant platform-level operations (support, billing analytics, platform-wide health dashboards) require cross-region federation at the observability layer
- Onboarding friction — users must know or be routed to their home region
- At launch with one region (us-east-2), the benefits are theoretical; they materialise as regions come online

### Option D — Per-tenant dedicated infrastructure  (rejected, deferred)

Each large customer gets their own dedicated EKS cluster + database.

**Pros**
- Strongest isolation; customers can be told "your data has no shared infrastructure with any other customer"
- Customer-specific compliance requirements met trivially

**Cons**
- Operationally infeasible at any meaningful tenant count
- Economically only viable for large-contract customers willing to pay the dedicated-infrastructure premium
- Not excluded by the regional-silo model — we can offer dedicated infrastructure *within* a silo for premium customers as a future product tier

---

## Consequences

### Positive
- Data residency is a property of the deployment, not of application logic — impossible to violate by code bug
- Compliance story for GDPR, FedRAMP, HIPAA (Phase-5), and strict customer DPAs is straightforward and defensible
- Regional outages are contained — an us-east-2 incident affects only us-east-2 tenants
- Future regional expansion (APAC, LatAm) is a known-quantity operation: stand up another silo
- Pricing and capacity planning can be region-specific (EU pricing can reflect EU infrastructure cost)

### Negative
- Steady-state infrastructure cost scales linearly with active regions — at full 3-region scale, ~3× single-region baseline
- Deployment pipelines run N times; any region-specific config drift is a bug
- Observability must federate across regions for platform-level views (via OTel collector federation or a separate global monitoring layer)
- Cross-region SSO and user management are non-trivial — we accept that a user account in us-east-2 is separate from a user account in eu-central-1; SSO providers handle this naturally via per-region OIDC configurations
- Support workflows must know which region a tenant is in before they can help
- The pre-tenant experience (marketing, sign-up) requires a thin global layer we don't otherwise need

### Neutral
- Regions come online incrementally driven by tenant demand — at launch we run us-east-2 only; eu-central-1 stands up when we sign the first EU tenant; govcloud-us-west stands up when federal pipeline justifies
- Provisioning a new region is a weeks-of-work exercise (Terraform, observability wiring, deployment-pipeline setup, SOC 2 scope extension), not a code change
- Each silo has its own Route 53 zone for tenant subdomains; global DNS layer does geo-resolution for the sign-up flow only

---

## Validation

- **Compliance audit** — the first GDPR-sensitive customer review exercises whether our residency story holds up. If a customer's legal team flags weaknesses, those are the signal to revisit.
- **Cross-region data-flow monitoring** — automated daily check confirms no data leaves a tenant's home region via backup, replication, logging, observability, or support-tool access. Any detected egress is a P1 incident.
- **Operational cost per region** — if per-region operational cost exceeds projections materially (>30%), revisit whether some components can safely share across regions (e.g., would a shared observability backend with region-tagged data be acceptable from a compliance perspective?).
- **Regulator/auditor feedback** — if a SOC 2, ISO 27001, or FedRAMP auditor questions the silo architecture, document the feedback and adjust.

---

## Rollout plan

- **Phase 1 — Launch (us-east-2 only)** (2026): single silo; global DNS and sign-up flow point everything to us-east-2; infrastructure and deployment pipeline established as the reference for future silos.
- **Phase 2 — First EU tenant (eu-central-1 stands up)** (estimated 2027): provision the EU silo as a full duplicate of us-east-2; run both silos in parallel; first EU tenant is onboarded directly into eu-central-1; no migration needed because they're the first.
- **Phase 3 — Federal pipeline (govcloud-us-west stands up)** (estimated 2028+, gated on federal customer pipeline): provision the GovCloud silo with FedRAMP Moderate baseline; distinct operational procedures; SOC 2 scope extended.
- **Phase 4 — Additional regions as demanded** (open-ended): same playbook for APAC, LatAm, other jurisdictions as signed demand justifies.

Existing tenants do **not** migrate between regions. A tenant's home region is immutable; if a customer wants to relocate, they offboard + onboard into the target region, using our data-export tools to carry data over.

---

## Threats considered

- **Data egress via logs, backups, or observability** — mitigated by keeping each silo's observability backend within the silo (region-local CloudWatch, region-local Grafana/Tempo), with federation only at the metadata layer (region-level health; no tenant data crosses regions).
- **Cross-region user session leakage** — mitigated by per-region auth services; a user's session in us-east-2 does not authenticate into eu-central-1.
- **Support team accessing data across regions** — support agents are scoped per region; agents handling EU tenants have accounts only in eu-central-1. Cross-region support requires explicit access grant with audit trail.
- **Disaster recovery crossing regions** — within a silo, DR uses a secondary AZ and a cross-region read replica *within the same sovereignty boundary* (us-east-2 primary + us-west-2 DR; eu-central-1 primary + eu-west-1 DR). GovCloud DR stays in GovCloud.
- **DNS-layer compromise routing tenants to the wrong region** — mitigated by DNSSEC on Route 53 zones; traffic verification via TLS to the intended region's ACM cert, not a spoofed one.

---

## References

- [`docs/06-design-decisions.md` §4.8 — Data residency narrative](../../docs/06-design-decisions.md#48-regional-deployment-silos-for-data-residency)
- `devops/INFRASTRUCTURE.md` (to be updated as regions come online)
- `security/DATA-RESIDENCY.md` (to be authored)
- Gemini domain review, April 2026 (R1 on 06-design-decisions.md)
- GDPR Chapter V — transfers of personal data to third countries
- FedRAMP High / Moderate baselines — data-location requirements
- AWS GovCloud documentation — compliance and isolation model
- Related ADRs: [ADR-0002](0002-tenant-isolation-two-layer.md) (tenant isolation is *within* a silo; cross-silo isolation is the silo boundary itself)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
