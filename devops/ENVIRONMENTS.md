# Environments

> Four tiers (local, dev, staging, production) plus ephemeral preview. Strict promotion flow. Configuration parity. Data classification.

---

## 1. Environment Tiers

```
  local  ──►  preview  ──►  dev  ──►  staging  ──►  production
  laptop     per-PR       shared     pre-prod       live
```

### 1.1 `local` — Developer Laptop
- Purpose: day-to-day development, unit & component testing
- Runtime: Docker Compose (PG, Redis, Minio for S3-compat, otel-collector)
- Next.js + NestJS run via `pnpm dev` with hot reload
- Data: seeded via `pnpm db:seed` (fixtures in `packages/fixtures/`)
- Secrets: `.env.local` per developer (never committed)
- Authentication: dev bypass mode (pre-seeded test users) OR real SSO via `ngrok` tunnel for SSO testing
- Domain: `http://localhost:3000` (web), `http://localhost:4000` (api)

### 1.2 `preview/pr-<n>` — Per-PR Ephemeral
- Purpose: reviewer tests a PR's UX without pulling the branch
- Lifetime: auto-destroyed on PR close/merge; nightly sweep at 7 days
- Runtime: shared `dev` EKS cluster, isolated namespace
- Data: fresh schema per PR (migrated from main + PR migrations), seeded with minimal test tenant
- Secrets: shared with `dev` (no prod secrets)
- Authentication: dev users preseeded; SSO not configured
- Domain: `pr-<n>.preview.aims.io` (wildcard cert `*.preview.aims.io`)
- Observability: logs only (no Sentry project to avoid noise)

### 1.3 `dev` — Shared Development
- Purpose: integration testing, engineer-shared scratch space, demo to stakeholders
- Lifetime: permanent
- Runtime: dedicated AWS account `aims-dev`, single region `us-east-1`
- Data: fixtures + synthetic test data; **never** real customer data
- Secrets: dev-specific values (dev Stripe keys, dev email sandbox, etc.)
- Authentication: real SSO (dev tenant in IdP); dev-only email domain allowed
- Domain: `dev.aims.io`
- Observability: full stack but segregated from prod (separate Grafana org, separate Sentry project)
- Deploy on: every merge to `main` (after staging deploy succeeds) — or on-demand
- Availability: "best effort" — can be broken for hours during feature work

### 1.4 `staging` — Pre-Production
- Purpose: final integration, E2E testing, soak testing, QA validation, customer-facing demos
- Lifetime: permanent
- Runtime: dedicated AWS account `aims-staging`, single region `us-east-1` (multi-region tested in dev first)
- Data: synthetic prod-like data generated from schema + a sanitized subset of real prod data (weekly refresh with PII scrubbed)
- Secrets: staging-specific (Stripe test mode, SendGrid sandbox, etc.)
- Authentication: real SSO; production-like IdP configuration
- Domain: `staging.aims.io`
- Observability: full stack; mirrors prod configuration exactly
- Deploy on: every merge to `main` (automatic, after CI passes)
- Availability: 99% target (best-effort; not contractual)
- **Critical: staging config MUST mirror prod config** (feature flags same, scaling rules same, db parameter groups same). Drift = staging loses its prediction value.

### 1.5 `production` — Live
- Purpose: serve customers
- Lifetime: permanent (forever)
- Runtime: dedicated AWS accounts per region: `aims-production-us`, `aims-production-eu`, `aims-production-ap` (Phase 3)
- Data: real customer data — highest sensitivity
- Secrets: prod-only secrets (real Stripe, real SES, real SSO with customer IdPs)
- Authentication: real SSO per tenant + MFA enforced
- Domain: `aims.io`, `<tenant>.aims.io`, optional `app.<customer-domain>`
- Observability: full stack with strict SLO monitoring
- Deploy: manual trigger, gated by 2× approval, canary → staged
- Availability: 99.95% internal SLO (99.9% contractual)
- Access: Just-In-Time SSO role assumption only; no standing access

### 1.6 `dr` — Disaster Recovery
- Purpose: failover target for production in a different region
- Runtime: warm standby (small footprint, auto-scales on promote)
- Data: cross-region-replicated from production
- Activated: during regional outage or DR drills (quarterly)
- Domain: `dr.aims.io` normally; DNS fails over to this during incident

### 1.7 `govcloud` (Phase 4)
- Purpose: US Federal / DoD workloads
- Partition: `aws-us-gov`, region `us-gov-west-1`
- Isolation: separate pipeline, separate code branch, separate container registry
- Access: US persons only (IAM restrictions)
- Authentication: PIV / CAC cards via IdP
- Compliance: FedRAMP Moderate ATO

---

## 2. Environment Parity

### The Principle
Staging must predict production. Any difference that affects correctness or performance is a risk.

### What Must Match Exactly
| Dimension | Reason |
|-----------|--------|
| Application code | Same artifact — literally same image hash |
| Container runtime | Same base image, same k8s version |
| Database major version + extensions | Migration / query behavior |
| Connection pool size | Load behavior |
| Feature flags (default state) | Feature surface |
| Parameter groups (RDS, Redis) | Performance behavior |
| Network policies | Security model |
| WAF ruleset | Security model |
| IdP integration | Auth flows |

### What Can Differ (Legitimately)
| Dimension | Justification |
|-----------|---------------|
| Instance sizes | Prod at higher scale; staging smaller is fine as long as ratios are correct |
| Replica counts | Same |
| Data volume | Prod has more data; use synthetic data to approximate in staging |
| DNS / domain | Obviously different names |
| Certificate source | Self-service ACM vs. customer-provided custom |
| API keys for 3rd parties | Sandbox vs. live modes |
| Rate limits | Staging can be more permissive to run load tests |

### Enforcement
- `scripts/env-parity-check.sh` diff-compares helm values between staging and prod — fails CI if unexpected drift
- Quarterly parity review meeting; any new divergence requires decision record

---

## 3. Configuration Management

### The Three-Category Rule
Every config value falls into one of:

| Category | Storage | Example |
|----------|---------|---------|
| **Code constants** | Source code | Max finding title length (240) |
| **Config — non-secret** | Kubernetes ConfigMap / AWS AppConfig | Feature flag defaults, log level, rate limits |
| **Config — secret** | AWS Secrets Manager / Parameter Store SecureString | DB password, API keys |

### Loading Order (at pod startup)
1. Baked defaults (in code)
2. ConfigMap (via env vars)
3. Secrets Manager (fetched at startup via IRSA; refreshed every 30 min)
4. Runtime feature flags (via OpenFeature client)

### Typed Config Validation
At startup, app parses `process.env` through a Zod schema. Missing/malformed → **fail fast with clear error**. Never ship with silent defaults.

```ts
// apps/api/src/config/env.ts
export const env = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["trace","debug","info","warn","error"]).default("info"),
  // ...
}).parse(process.env);
```

---

## 4. Promotion Flow

```
  PR opened  ──►  preview env  (smoke tests auto-run)
      │
      │ approved, merged
      ▼
  staging      (auto-deploy, ~5 min)
      │
      │ E2E suite passes + 24h soak minimum
      ▼
  production   (manual trigger, 2× approval, canary)
```

### Skip-the-Line Rules (hotfix)
- Only for P1 bugs or security fixes
- `hotfix/*` branch → PR targeting `main` with `hotfix` label
- CI runs full checks (no shortcut on quality)
- Minimum 2h in staging (not 24h)
- Requires VP Eng approval in addition to normal 2×
- Postmortem required within 48h

### Pinned Versions Between Environments
Each environment has a Helm chart values file pinning the image tag:

```
infrastructure/
├── helm/
│   └── aims-v2/
│       ├── values.yaml              # defaults
│       ├── values-dev.yaml          # image.tag: main-<sha>
│       ├── values-staging.yaml      # image.tag: main-<sha>
│       └── values-production.yaml   # image.tag: v1.2.3
```

Production never pulls `main` — only versioned tags.

---

## 5. Data Classification & Handling

| Class | Definition | Where allowed | Storage |
|-------|-----------|---------------|---------|
| **Public** | Marketing content, docs | Any env | Any |
| **Internal** | Engineering docs, fixtures | dev/staging/prod | Encrypted at rest |
| **Confidential** | Customer engagement data, findings | production only (+ staging w/ scrub) | Encrypted, RLS, audit-logged |
| **Restricted** | Auth secrets, keys, PII | production only | KMS, secrets manager, never in logs |
| **Regulated** | HIPAA PHI, PCI (if applicable) | Production isolated | Additional: BAA, tokenized, per-tenant encryption |

### PII / Production Data in Lower Environments
- Never copy raw production data to dev or preview
- Staging subset is sanitized:
  - Names replaced with deterministic pseudonyms (`Auditor {hash}`)
  - Emails rewritten to `user-{hash}@sanitized.test`
  - Phone numbers replaced with fixed test number
  - Free-text fields (findings descriptions) scrubbed via named-entity recognition or fully regenerated
  - File attachments replaced with placeholder PDF
  - Customer-specific identifiers (SSN, tax IDs) replaced with fakes matching format
- Scrubbing script runs in a locked-down job in `aims-prod` account → outputs to staging bucket → staging ingests
- Process audited; scrubbing SQL reviewed quarterly

### Logs
- Logs must not contain Restricted data (validated at ingestion by otel-collector processor)
- Confidential data redacted via pino redact rules (`[REDACTED]` for email, phone, IDs by regex)
- PII field-level encryption (tenant-scoped keys) in database — logs only carry the encrypted form

---

## 6. Domain & URL Strategy

### Apex Domain Layout
```
aims.io                       → marketing site (static, CloudFront+S3)
app.aims.io                   → SaaS app (default tenant path routing)
<tenant>.aims.io              → tenant-subdomain routing (default for new tenants)
app.<customer-domain>.com     → optional CNAME to <tenant>.aims.io (white-label)
api.aims.io                   → API (if external API consumers need stable URL)
docs.aims.io                  → customer-facing docs
status.aims.io                → Statuspage
eu.aims.io                    → EU region apex (DNS geo-routing)
```

### Env-Prefixed URLs
```
dev.aims.io         → dev
staging.aims.io     → staging
pr-<n>.preview.aims.io → preview
```

### Certificate Strategy
- Wildcard ACM cert `*.aims.io` + `*.preview.aims.io` + `*.staging.aims.io` (one per region)
- Custom domains managed by cert-manager on EKS (Let's Encrypt) with DNS-01 challenge
- Tenant-uploaded certs: stored in AWS Certificate Manager, associated with ALB listener rule

### Session Cookies
- Domain `.aims.io` (shared across subdomains) for internal
- For custom-domain tenants: cookies scoped to their domain (separate session)
- `Secure`, `HttpOnly`, `SameSite=Lax`

---

## 7. Feature Flags Across Environments

### Default Flag State by Env
| Flag type | local | dev | staging | production |
|-----------|-------|-----|---------|------------|
| Under development (`dev-preview`) | ON | ON | OFF | OFF |
| Beta | ON | ON | ON | per tenant |
| GA candidate (`release-candidate`) | ON | ON | ON | 10% rollout |
| GA | ON | ON | ON | ON |
| Kill switch | OFF | OFF | OFF | OFF |

### Tenant-Scoped Flags
- Beta customers get explicit flag enablement in prod
- Opt-in via admin panel or sales-triggered
- Flag service (OpenFeature) stores targeting rules; pods evaluate locally

### Flag Cleanup Policy
- Flag lifetime max 90 days after GA
- Older flags generate CI warning; 180+ days → PR bot auto-deletes

See `RELEASE.md §5` for full flag policy.

---

## 8. Access Control Per Environment

| Environment | Standing access | JIT access | Deploy approval |
|-------------|------------------|------------|-----------------|
| local | Developer | — | — |
| preview | PR author + reviewers (read UI) | — | CI auto |
| dev | Engineering (all) | — | CI auto |
| staging | Engineering (read) + QA (write) | — | CI auto |
| production | **None** (all JIT) | SRE: 1h; Eng: 30min read | 2× approval + change window |
| production (data access) | None | DPO + SRE only, break-glass | Extra approval + audit |

### JIT Mechanism (production)
1. Engineer runs `aims-cli prod-access --role SRE-Prod --duration 1h --reason "Debug finding X"`
2. CLI triggers Slack approval in `#sre-approvals`
3. Approver clicks button → temporary IAM role materialized
4. Token expires; cleanup automatic
5. All actions CloudTrail-logged with approver + requester

### Emergency Break-Glass
- "Red button" in Okta → instant role with MFA re-challenge
- Logs fire to Security team; postmortem required
- Two-person rule: requires `BreakGlass-Initiate` + `BreakGlass-Approve` from different people

---

## 9. Cost by Environment (Monthly, Ballpark)

| Env | Approx cost | Notes |
|-----|------------|-------|
| Previews (combined) | $800 | Small pods, shared infra |
| Dev | $1,500 | Single region, smaller instances |
| Staging | $2,500 | Prod-like but scaled-down |
| Production (US) | $3,000+ | See README §Cost Baselines |
| Production (EU) | $2,500 | Smaller footprint initially |
| DR (warm standby) | $1,200 | Smaller + scales on promote |
| Observability & shared | $900 | Grafana, Sentry, etc. |

Idle preview environments auto-scaled to zero pods when inactive for 4 hours (saves ~60%).

---

## 10. Environment-Specific Constraints

### What MUST run in every env
- Health check endpoints (`/healthz`, `/readyz`, `/livez`) — same code path everywhere
- Metrics & trace emission — observable everywhere
- Same auth system (dev uses dev IdP, but flow is identical)

### What MAY be mocked in local
- External payment (Stripe) — use local stub
- Email (SES) — Mailhog or log-only
- SSO — dev IdP or skip with test users

### What MUST NOT be different in production vs staging
- Database schema (migrations identical)
- API contracts (tRPC router identical)
- RBAC / permission matrix
- Feature default flags (use runtime, not compile-time, for any env-divergent behavior)

---

## 11. Environment Lifecycle Events

### New Environment Creation
1. File Terraform PR adding `terraform/environments/<env>/` directory
2. Bootstrap state backend for new env
3. Apply in order: network → platform → data → apps → dns → observability
4. Run smoke tests
5. Add to `env-parity-check` allowlist
6. Update `ENVIRONMENTS.md` (this file)

### Environment Decommissioning
1. Confirm no tenants (production only)
2. Export data to archive (retain per compliance)
3. Disable CI deploy targets
4. Destroy resources (`terraform destroy`)
5. Delete state files (after 90-day cool-off)
6. Revoke IAM roles
7. Update this doc

---

## 12. Common Pitfalls We Avoid

- **Staging out-of-sync with prod** — enforced parity check in CI
- **"Works on my machine" from missing env var** — Zod-validated env at startup
- **Secrets committed accidentally** — gitleaks pre-commit + CI + revocation runbook
- **Prod data in dev for "a quick test"** — forbidden; procedural + SCP prevent bucket copy
- **Long-running preview envs** — 7-day sweep
- **Flags left on in staging, off in prod** — CI diff shows flag state; review required
- **Unversioned config changes** — all config in Git

---

## 13. Related Documents

- [`CI-CD.md`](CI-CD.md) — how code moves between envs
- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — what Terraform provisions per env
- [`SECRETS.md`](SECRETS.md) — per-env secret management
- [`RELEASE.md`](RELEASE.md) — release flow across envs
- [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) — DR env details
