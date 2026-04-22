# AIMS v2 — DevOps, Infrastructure & Operations

> Production-grade DevOps baseline for a multi-tenant audit SaaS. Reliability, security, observability, and reproducibility from day one.

---

## Why This Document Matters

Audit customers — especially government and regulated industries — will ask:

- "What's your RPO / RTO?"
- "Where is our data stored, and can we control it?"
- "How do you rotate secrets? How often?"
- "Show us your incident response runbook."
- "Can you prove your SOC 2 controls?"
- "What's your patching cadence for CVEs?"

Every answer here comes from something we built **before** we wrote a single piece of business logic. Retrofitting operational maturity is 10× more expensive than building it in.

---

## Tech Stack (Decided)

| Layer | Choice | Why |
|-------|--------|-----|
| **Cloud** | **AWS** (primary), **GCP** capable | AWS has deepest compliance surface (FedRAMP, GovCloud, IL4/5); GCP for EU-sensitive customers who require it |
| **IaC** | **Terraform** (OpenTofu compatible) | Industry standard, multi-cloud, extensive module ecosystem, strong state management |
| **CI/CD** | **GitHub Actions** | Native to our source host, reusable workflows, OIDC to cloud (no long-lived keys) |
| **Container orchestration** | **Kubernetes (EKS)** | Portable (multi-cloud), mature, standard for regulated workloads |
| **Ingress** | **AWS ALB + Istio** (Phase 2) | ALB for basic, Istio for mTLS/service mesh when scale demands |
| **Containers** | **Docker** (distroless base images) | Minimal attack surface, reproducible |
| **Registry** | **Amazon ECR** + **GitHub Container Registry** (mirror) | ECR for prod pulls; GHCR for dev convenience |
| **Package mgr** | **pnpm** (frontend + backend monorepo) | Fast, disk-efficient, deterministic |
| **Build orchestrator** | **Turborepo** | Incremental builds, remote cache |
| **Secrets** | **AWS Secrets Manager** + **Parameter Store** + **sealed-secrets** (k8s) | Managed rotation, KMS-encrypted, no secrets in repo ever |
| **Config (non-secret)** | **AWS AppConfig** or env vars | Runtime config with feature flags |
| **Observability — logs** | **Pino** → **OpenTelemetry Collector** → **CloudWatch Logs** / **Loki** | Structured JSON, traceable, cheap at scale |
| **Observability — metrics** | **OpenTelemetry SDK** → **Prometheus** → **Grafana** | Open standard, portable |
| **Observability — traces** | **OpenTelemetry SDK** → **Tempo** (or **Honeycomb**) | Distributed tracing across tRPC boundaries |
| **Error tracking** | **Sentry** | Source-mapped errors, release tracking, performance |
| **Synthetic monitoring** | **Checkly** or **Datadog Synthetics** | End-to-end uptime from multiple regions |
| **Status page** | **Statuspage.io** or **Better Stack** | Public transparency for incidents |
| **Incident response** | **PagerDuty** | On-call rotation, escalation, postmortems |
| **Feature flags** | **OpenFeature + LaunchDarkly** (or Flagsmith OSS) | Runtime toggles, tenant targeting, kill switches |
| **CDN** | **CloudFront** + **Cloudflare** (optional WAF) | Geographic edge, DDoS protection |
| **Database** | **Amazon RDS for PostgreSQL 16** (Multi-AZ) + **Aurora** option | Managed backups, PITR, read replicas |
| **Queue (worker tier)** | **Amazon SQS** (standard + FIFO) + **EventBridge Scheduler** for cron | Durable, AWS-native, scales (ADR-0004) |
| **Cache / ephemeral** | **Amazon ElastiCache (Redis)** | Session blocklist (ADR-0005), tRPC cache, rate-limit counters; *not* used for worker queues |
| **Object storage** | **Amazon S3** (SSE-KMS) + **Glacier** archival | Durable, compliance-friendly |
| **Email** | **Amazon SES** (transactional) + **Postmark** (fallback) | Deliverability, SPF/DKIM/DMARC enforced |
| **Schedule / cron** | **Amazon EventBridge** → workers | No standalone cron daemon |
| **Backup** | **AWS Backup** + custom logical PG dumps | Both infrastructure + logical layer |
| **SAST** | **Semgrep** + **GitHub CodeQL** | Static analysis on every PR |
| **SCA** | **Snyk** + **Dependabot** + **pnpm audit** | Dependency vulns |
| **DAST** | **OWASP ZAP** (scheduled) | Runtime security scans |
| **Secrets scanning** | **gitleaks** (pre-commit + CI) | Stop secrets at the door |
| **Container scanning** | **Trivy** (build-time) + **ECR scan** (registry) | CVEs in images |
| **IaC scanning** | **tfsec** + **checkov** | Misconfigs before deploy |

---

## Environments (Overview)

Four tiers plus ephemeral preview:

| Env | Purpose | Data | Access | Lifetime |
|-----|---------|------|--------|----------|
| `local` | Developer laptop | Seeded fake | Developer | Per-session |
| `preview/pr-<n>` | Per-PR preview | Cloned staging subset | PR authors + reviewers | Until PR merged/closed |
| `dev` | Integration / shared dev | Seeded test fixtures | Engineering team | Persistent |
| `staging` | Pre-prod; mirror of prod config | Prod-like synthetic + sanitized prod subset | Engineering, QA, product | Persistent |
| `production` | Live customer traffic | Real customer data | SRE + release manager only (Just-In-Time) | Persistent |

Full details: [`ENVIRONMENTS.md`](ENVIRONMENTS.md).

---

## Architectural Pillars

### 1. Everything Is Code
Infra (Terraform), pipelines (GH Actions YAML), config (versioned), dashboards (Grafana-as-code), alerts (PrometheusRule YAML). **No click-ops in production.** A hand-edited security group is an audit finding waiting to happen.

### 2. Reproducibility
Any engineer can recreate any environment from scratch in < 2 hours given cloud credentials. Terraform state is the truth; drift detection runs nightly.

### 3. Least Privilege, Everywhere
- No long-lived cloud credentials in CI — GitHub OIDC to AWS IAM
- Engineers get Just-In-Time prod access via SSO + time-bound role assumption (max 1 hour)
- Every IAM policy is scoped to specific resources; no `*:*`
- Service-to-service auth via IRSA (IAM Roles for Service Accounts on EKS)

### 4. Immutable Infrastructure
Servers are never patched in place. New AMI → new node pool → drain → decommission. Container images are built, signed, scanned, and promoted through environments without rebuild.

### 5. Observable By Default
Every request has a `traceId`. Every log line has `tenantId`, `userId`, `route`, `traceId`. SLOs defined per service. Golden signals (latency, traffic, errors, saturation) dashboarded per service.

### 6. Recovery Is A Feature
Backups are tested monthly (actual restore, not just "we have backups"). DR drills quarterly. RPO 15 min, RTO 1 hour for production. Runbooks exist for every paging alert.

### 7. Security Scanning At Every Layer
Code (SAST), dependencies (SCA), containers (Trivy), IaC (tfsec), secrets (gitleaks), runtime (DAST, EDR on nodes). Issues above medium severity block merges.

### 8. Progressive Delivery
New code ships through: canary (1%) → staged rollout (5% → 25% → 100%) → full. Feature flags decouple deploy from release. Rollback is one-command.

### 9. Cost Awareness
Cost dashboards per-service, per-tenant tag. Budget alerts at 80% / 100% / 120%. Right-sizing reviews monthly. FinOps baked into engineering culture, not a separate team.

### 10. Compliance-Ready
Built with SOC 2 Type II, ISO 27001, FedRAMP Moderate in mind. Audit trails everywhere. Evidence collection automated via tools like Drata or Vanta (Phase 6).

---

## High-Level Architecture

```
                        ┌──────────────┐
                        │   Users      │
                        │ (browser)    │
                        └──────┬───────┘
                               │ HTTPS
                               ▼
              ┌────────────────────────────────┐
              │  Cloudflare (WAF, DDoS, DNS)   │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  CloudFront (CDN, static)      │
              └────────────────┬───────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  AWS Application Load Balancer │
              │  (TLS 1.3, cert from ACM)      │
              └────────────────┬───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │  Next.js │          │  Fastify │          │  NestJS  │
  │   (web)  │          │  + tRPC  │          │  workers │
  │  on EKS  │          │  on EKS  │          │  on EKS  │
  │          │          │  (req    │          │  (queue  │
  │          │          │   path)  │          │   consum.)│
  └────┬─────┘          └────┬─────┘          └────┬─────┘
       │                     │                     │
       │                     │         ┌───────────┤
       │                     │         │           │
       │                     │         ▼           ▼
       │                     │   ┌──────────┐  ┌──────────┐
       │                     │   │  AWS SQS │  │EventBridge│
       │                     │   │  queues  │  │ Scheduler │
       │                     │   │  + DLQs  │  │  (cron)  │
       │                     │   └──────────┘  └──────────┘
       │                     │
       └─────────┬───────────┴─────────┬───────────┐
                 │                     │           │
                 ▼                     ▼           ▼
      ┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
      │  RDS Postgres 16 │   │  ElastiCache     │  │  S3 (object store)│
      │  Multi-AZ        │   │  Redis 7         │  │  + Glacier (cold) │
      │  + Read replica  │   │  (session        │  │  + heavy job      │
      │                  │   │   blocklist,     │  │    payload storage│
      │                  │   │   tRPC cache,    │  │                   │
      │                  │   │   rate limits)   │  │                   │
      └──────────────────┘   └──────────────────┘  └──────────────────┘

Observability plane (alongside):
   otel-collector (DaemonSet) → Prometheus (metrics)
                             → Loki / CloudWatch (logs)
                             → Tempo / Honeycomb (traces)
                             → Sentry (errors)
                          All → Grafana dashboards
                             → Alertmanager → PagerDuty
```

---

## Regions & Data Residency — independent silos per region

Per [ADR-0006](../references/adr/0006-regional-deployment-silos.md), each region is a **separate, operationally-complete deployment silo** — its own EKS cluster, its own RDS instance, its own Redis, its own S3, its own auth service, its own KMS keys, its own SQS queues, its own observability stack. No shared control plane. Tenant data never crosses silo boundaries.

### Rollout (per ADR-0006)

| Phase | Silo | Trigger |
|---|---|---|
| **Phase 1** — launch (2026) | `us-east-2` (Ohio) | Always active at launch |
| **Phase 2** — first EU tenant | `eu-central-1` (Frankfurt) | Stand up when first EU tenant signs |
| **Phase 3** — federal pipeline | `us-gov-west-1` (GovCloud) | Stand up when federal pipeline justifies FedRAMP Moderate |
| **Phase 4** — open-ended | APAC, LatAm, others | Per tenant demand |

The database folder's [`DATA-RESIDENCY.md`](../database/DATA-RESIDENCY.md) lists more aspirational regions (APAC, UK, India, Canada, Australia) — those come online as silos when specific tenant demand justifies the weeks-of-work silo-provisioning exercise.

### Per-Tenant Region Binding
Tenant chooses home region at sign-up. A tenant's home region is **immutable** — to change, they offboard and re-onboard into the target region with our data-export tools. Data never leaves the home region under normal operation. Cross-region DR is to a same-compliance-tier region only (us-east-2 → us-west-2; eu-central-1 → eu-west-1; GovCloud → GovCloud secondary).

Tenant subdomain routing (`oakfield.aims.io` → us-east-2; `tuberlin.aims.io` → eu-central-1) is handled by Route 53 A-records created at tenant provisioning. The marketing / sign-up flow lives in a thin global layer (CloudFront + S3) that provisions the tenant into their home region at onboarding.

See [`security/DATA-RESIDENCY.md`](../security/DATA-RESIDENCY.md) for the full architecture + compliance narrative.

---

## Folder Structure

```
devops/
├── README.md                          ← You are here
├── CI-CD.md                           ← GitHub Actions pipelines
├── INFRASTRUCTURE.md                  ← Terraform, AWS resources, multi-region
├── ENVIRONMENTS.md                    ← Dev/staging/prod, config, promotion
├── CONTAINERS.md                      ← Docker, Kubernetes, EKS, helm charts
├── OBSERVABILITY.md                   ← Logs, metrics, traces, dashboards, alerts
├── SECRETS.md                         ← Secret lifecycle, KMS, rotation
├── RELEASE.md                         ← Versioning, changelogs, feature flags, rollback
├── DISASTER-RECOVERY.md               ← Backups, RPO/RTO, DR drills
├── RUNBOOKS.md                        ← On-call, incident response, common ops
└── implementation/
    ├── github-actions/
    │   ├── ci.yml                     ← PR checks
    │   ├── cd-staging.yml             ← Deploy to staging on merge
    │   ├── cd-production.yml          ← Manual-gated production deploy
    │   └── reusable/                  ← Reusable workflows
    ├── terraform/
    │   ├── environments/{dev,staging,prod}/
    │   ├── modules/{network,eks,rds,redis,s3,iam,...}/
    │   └── bootstrap/                 ← State backend, OIDC, baseline
    ├── kubernetes/
    │   ├── helm/                      ← Helm charts per service
    │   └── manifests/                 ← Plain YAML for bootstrap
    ├── docker/
    │   ├── web.Dockerfile
    │   ├── api.Dockerfile
    │   └── worker.Dockerfile
    ├── observability/
    │   ├── otel-collector.yaml
    │   ├── prometheus-rules.yaml
    │   ├── grafana-dashboards/
    │   └── alerts/
    └── scripts/
        ├── db-migrate.sh
        ├── rotate-secret.sh
        └── dr-drill.sh
```

---

## Release Cadence

| Artifact | Cadence | Window |
|----------|---------|--------|
| Code to staging | Every merge to `main` | Continuous |
| Code to production | Tuesday + Thursday, 10:00–14:00 UTC | Business-hours change windows |
| Emergency hotfix | As needed with `hotfix/` branch | Any time, extra approval required |
| Infrastructure change | Weekly batched | Wednesday 14:00 UTC |
| Database migration | Off-peak window coordinated with customers | Weekend preferred |
| Security patch | Within SLA by severity | Critical: 24h, High: 7d, Medium: 30d |

No production deploys on Fridays or the week before major US holidays (freeze window from audit-sensitive customers' fiscal year-ends).

---

## SLAs & SLOs

### Customer-Facing SLAs (from contract)
- **Availability**: 99.9% monthly (< 43 min downtime / month)
- **Enterprise tier**: 99.95% monthly (< 22 min downtime / month)
- **Support response**: P1: 1h, P2: 4h, P3: 1 business day

### Internal SLOs (stricter than SLAs — gives headroom)
| Service | SLO | Error budget (30d) |
|---------|-----|---------------------|
| Web (Next.js) availability | 99.95% | 22 min |
| API (NestJS) availability | 99.95% | 22 min |
| API p95 latency | < 300 ms | — |
| API p99 latency | < 800 ms | — |
| DB availability | 99.99% | 4.3 min |
| Background jobs SLA (high-prio) | 95% completed in < 5 min | — |
| PDF generation | 95% completed in < 30 s | — |

Full SLO catalog → [`OBSERVABILITY.md`](OBSERVABILITY.md).

---

## Cost Baselines (Phase 1 — ballpark)

For planning, not billing. Updated quarterly.

| Component | Monthly (one region, 50 tenants) |
|-----------|-----------------------------------|
| EKS control plane + 6 nodes (m6i.large) | $900 |
| RDS Postgres (db.r6g.xlarge Multi-AZ) + backups | $700 |
| ElastiCache Redis (cache.m6g.large cluster) | $250 |
| S3 + Glacier (2 TB hot + 8 TB archival) | $180 |
| ALB + CloudFront + data transfer | $300 |
| Observability (managed Grafana, Sentry, logs) | $450 |
| Backups (AWS Backup) | $120 |
| Misc (Route53, ACM, Secrets Mgr, KMS) | $100 |
| **Total (per region)** | **~$3,000 / month** |

Per-tenant marginal cost: ~$60/month at this scale. Drops to ~$20 at 500+ tenants per region (amortization).

GovCloud costs ~1.4× higher (separate ATO, smaller instance catalog, specialty support).

---

## Reading Order

If new to this system, read in this order:
1. **README.md** (this file) — overview
2. **[ENVIRONMENTS.md](ENVIRONMENTS.md)** — how dev flows to prod
3. **[CI-CD.md](CI-CD.md)** — the pipelines themselves
4. **[INFRASTRUCTURE.md](INFRASTRUCTURE.md)** — what's running where
5. **[CONTAINERS.md](CONTAINERS.md)** — workload layout
6. **[OBSERVABILITY.md](OBSERVABILITY.md)** — how we see it all
7. **[SECRETS.md](SECRETS.md)** — identity & secret plumbing
8. **[RELEASE.md](RELEASE.md)** — shipping safely
9. **[DISASTER-RECOVERY.md](DISASTER-RECOVERY.md)** — surviving failures
10. **[RUNBOOKS.md](RUNBOOKS.md)** — what to do at 3am

---

## Ownership

| Area | Owner |
|------|-------|
| CI/CD pipelines | Platform team |
| AWS infra (Terraform) | Platform / SRE |
| Kubernetes / workloads | Platform / SRE |
| Observability stack | SRE |
| Security scanning & response | Security team |
| On-call rotation | Engineering (rotating) |
| Cost management | Platform + Finance |
| Compliance evidence | Security + Legal |

RACI in `RUNBOOKS.md §2`.

---

## Status

- [x] DevOps stack decided
- [x] Environment tiers defined
- [x] Architecture sketched
- [ ] Terraform modules scaffolded (Phase 1 kickoff)
- [ ] Pipelines green on day-1 commit
- [ ] First EKS cluster up in `dev`
- [ ] Observability plane running
- [ ] Runbooks validated via game-day
