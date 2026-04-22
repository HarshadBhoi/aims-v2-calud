# AIMS v2 — SaaS Readiness Framework

> The master checklist covering every industry-standard concern for a production-grade, enterprise-scale SaaS. Use this to track what's done, what's in progress, and what's missing.

**Last updated**: 2026-04-19

---

## Framework Structure

A comprehensive SaaS has **12 domains** that must all be addressed:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUSINESS & PRODUCT                          │
│  1. Product Strategy   2. Go-to-Market   3. Pricing & Billing       │
├─────────────────────────────────────────────────────────────────────┤
│                        ARCHITECTURE & PLATFORM                      │
│  4. Domain Model    5. Database    6. API    7. Frontend           │
│  8. Identity & Auth    9. Real-time    10. Search                  │
├─────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE & OPS                          │
│  11. Infrastructure   12. CI/CD   13. Observability   14. DR/BCP   │
├─────────────────────────────────────────────────────────────────────┤
│                        SECURITY & COMPLIANCE                        │
│  15. AppSec   16. InfraSec   17. Compliance   18. Privacy          │
├─────────────────────────────────────────────────────────────────────┤
│                        QUALITY & PROCESS                            │
│  19. Testing   20. Code Quality   21. Documentation   22. Support  │
└─────────────────────────────────────────────────────────────────────┘
```

Status legend: ✅ Done | 🟡 Partial | ⏳ Planned | ❌ Missing | N/A Not applicable

---

## 1. PRODUCT STRATEGY ✅ Done (for MVP scope)

| Item | Status | Notes / Artifacts |
|------|--------|-------------------|
| Market research (competitors) | ✅ | `references/competitor-analysis.md` |
| Target personas defined | ✅ | Master plan — government, IIA auditors, SOX, etc. |
| Standards scope defined | ✅ | GAGAS, IIA GIAS, SOX, ISO, COBIT, ISSAI, regional |
| Value proposition | ✅ | Multi-standard platform, crosswalks, sector packs |
| MVP definition | ✅ | Phase 1-3 (Foundation, Engine, GAGAS pack) |
| Feature roadmap | ✅ | 7 phases documented |
| Success metrics (KPIs) | 🟡 | Master plan has DoD; need product KPIs |
| User journey maps | ❌ | **Not yet documented** |
| Pricing model | ❌ | Tiers mentioned but no pricing sheet |

---

## 2. GO-TO-MARKET ⏳ Planned

| Item | Status | Notes |
|------|--------|-------|
| Positioning statement | 🟡 | Implicit in competitor analysis |
| Website / marketing site | ❌ | Separate project |
| Sales collateral | ❌ | Data sheets, ROI calculators, case studies |
| Demo environment strategy | ❌ | Sandbox tenant with sample data |
| Customer onboarding plan | ❌ | Self-serve vs white-glove for enterprise |
| Trial / free tier design | ❌ | Phase 7.2 billing |
| Customer success playbook | ❌ | Quarterly business reviews, renewal motions |
| Partner program | ❌ | Implementation partners, resellers |
| Integration marketplace | ❌ | Zapier, Slack, Teams, etc. |

---

## 3. PRICING & BILLING ⏳ Planned (Phase 7)

| Item | Status | Notes |
|------|--------|-------|
| Pricing tiers defined | 🟡 | Free/Pro/Enterprise mentioned |
| Per-user vs per-engagement pricing | ❌ | Decision needed |
| Usage metering | ❌ | Phase 7.2 |
| Billing provider | ❌ | Stripe recommended but not set up |
| Invoice generation | ❌ | Phase 7.2 |
| Tax handling | ❌ | Stripe Tax / TaxJar integration |
| Dunning / payment retry | ❌ | Stripe handles but workflows needed |
| Subscription lifecycle (upgrade, downgrade, cancel) | ❌ | Phase 7.2 |
| Usage-based add-ons (storage, API calls) | ❌ | Metered billing |
| Enterprise contracts (custom terms) | ❌ | Contract management |
| Revenue recognition | ❌ | ASC 606 compliance |

---

## 4. DOMAIN MODEL ✅ Done

| Item | Status | Notes / Artifacts |
|------|--------|-------------------|
| Standards research (deep) | ✅ | `references/standards/` (Round 1 + 2 + verification) |
| Abstraction layer design | ✅ | `references/abstraction-layer/business-requirements.md` |
| Crosswalks | ✅ | `references/crosswalks/` |
| Standard Pack data model | ✅ | `data-model/standard-pack-schema.ts` (51 interfaces) |
| Example packs | ✅ | GAGAS 2024, IIA GIAS 2024, ISO 19011:2018 fully populated |
| Validation framework | ✅ | `data-model/VALIDATION.md` |
| Domain events catalog | ✅ | `api/webhooks/events.md` |

---

## 5. DATABASE ✅ Done

| Item | Status | Notes / Artifacts |
|------|--------|-------------------|
| Schema design | ✅ | `database/schema.prisma` (39 models, 13 enums) |
| Multi-tenancy (RLS) | ✅ | `database/policies/rls-policies.sql` |
| Database roles / least privilege | ✅ | `database/policies/roles.sql` |
| Audit trail (hash-chained) | ✅ | `database/functions/audit-log-triggers.sql` |
| Immutability enforcement | ✅ | `database/functions/immutability-checks.sql` |
| Bitemporal data (findings) | ✅ | Prisma model + docs |
| Performance strategy | ✅ | `database/PERFORMANCE.md` |
| Partitioning strategy | ✅ | Monthly partitions for audit_log |
| Data residency | ✅ | `database/DATA-RESIDENCY.md` |
| Migration strategy | 🟡 | Prisma migrate mentioned; runbook needed |
| Seed data / fixtures | ❌ | **Not yet written** |
| Data masking for non-prod | ❌ | Needed for dev/staging clones |

---

## 6. API ✅ Done

| Item | Status | Notes / Artifacts |
|------|--------|-------------------|
| Architecture decisions | ✅ | `api/ARCHITECTURE.md` (15 decisions) |
| API conventions | ✅ | `api/CONVENTIONS.md` (16 patterns) |
| Error taxonomy | ✅ | `api/ERRORS.md` |
| tRPC context + middleware | ✅ | `api/trpc/context.ts` + `middleware.ts` |
| tRPC routers (4 examples) | ✅ | engagement, finding, approval, standard-pack |
| Zod validation schemas | ✅ | common, engagement, finding |
| REST API + OpenAPI 3.1 | ✅ | `api/rest/openapi.yaml` |
| Webhooks catalog | ✅ | `api/webhooks/events.md` |
| Remaining routers (~20) | ❌ | Follow patterns; scaffold later |
| API key management system | 🟡 | Mentioned but not designed |
| GraphQL federation (if needed) | N/A | Not needed |

---

## 7. FRONTEND ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Frontend architecture | ❌ | Next.js 15 chosen but no design doc |
| Routing / app structure | ❌ | App Router patterns |
| State management | ❌ | React Query + Zustand vs Redux |
| Component library choice | ❌ | Shadcn/ui chosen, not integrated |
| Design system / tokens | ❌ | Colors, spacing, typography |
| Dark mode | ❌ | Tenant-theming + user preference |
| Form patterns | ❌ | React Hook Form + Zod conventions |
| Table/data grid patterns | ❌ | TanStack Table conventions |
| Error boundaries | ❌ | |
| Loading / skeleton states | ❌ | |
| Optimistic UI updates | ❌ | |
| Accessibility (WCAG 2.1 AA) | ❌ | |
| Internationalization (i18n) | ❌ | en-US initially; framework chosen? |
| Mobile responsive design | ❌ | |
| Offline support (PWA) | ⏳ | Phase 7.8 |

---

## 8. IDENTITY & AUTH ❌ Missing (Critical)

| Item | Status | Notes |
|------|--------|-------|
| Auth architecture | ❌ | **Needed before first vertical slice** |
| Login flow | ❌ | Email+password, magic link, OAuth |
| Registration / tenant provisioning | ❌ | Self-serve signup flow |
| MFA (TOTP, WebAuthn passkeys) | ❌ | Phase 1.3 mentions; needs design |
| SSO (SAML 2.0, OIDC) | ❌ | Enterprise feature; Phase 7.3 |
| Session management | ❌ | JWT + refresh token strategy |
| Password policy | ❌ | Complexity, history, rotation |
| Account lockout / brute force | ❌ | |
| Password reset flow | ❌ | Secure token flow |
| Email verification | ❌ | |
| SCIM provisioning (enterprise) | ❌ | Phase 7.3 |
| User invitation flow | ❌ | |
| Impersonation (support) | ❌ | Audited carefully |
| Social logins (Google, Microsoft) | ❌ | Optional |
| Permissions / ABAC | 🟡 | RBAC in API middleware; ABAC for row-level |

---

## 9. REAL-TIME & COLLABORATION ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| SSE infrastructure | 🟡 | Documented in API arch; not implemented |
| Presence indicators | ❌ | Who's viewing this engagement |
| Collaborative editing (TipTap + Yjs) | ❌ | For findings, reports |
| Activity feeds | ❌ | Per-engagement timeline |
| @mentions / notifications | ❌ | |
| Comment threads | ❌ | Inline on findings, workpapers |
| Change indicators | ❌ | What changed since last view |
| Event bus architecture | ❌ | Redis pub/sub vs NATS |

---

## 10. SEARCH ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Search strategy decision | ❌ | PostgreSQL FTS vs Meilisearch vs Elastic |
| Full-text search across entities | 🟡 | Generated tsvector columns in DB |
| Faceted search / filters | ❌ | |
| Search indexing pipeline | ❌ | Event-driven re-index |
| Search relevance tuning | ❌ | |
| Search analytics | ❌ | Track what users search |
| Command palette (Cmd+K) | ❌ | |
| Document full-text (PDF extraction) | ❌ | Nice to have |

---

## 11. INFRASTRUCTURE ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Cloud provider strategy | 🟡 | AWS/Azure/GCP mentioned; need decision |
| Infrastructure as Code | ❌ | Terraform / Pulumi |
| Container orchestration | ❌ | Kubernetes vs ECS vs Cloud Run |
| Service mesh (if needed) | ❌ | Istio / Linkerd |
| Networking / VPC design | ❌ | Public/private subnets, NAT, VPN |
| Load balancing | ❌ | ALB / Cloud Load Balancer |
| Auto-scaling | ❌ | HPA, KEDA |
| CDN | ❌ | CloudFront / Cloudflare |
| DNS strategy | ❌ | Route 53 / Cloudflare DNS |
| SSL/TLS management | ❌ | Let's Encrypt / ACM |
| Secret management | ❌ | AWS Secrets Manager / Vault |
| Multi-region deployment | 🟡 | Architecture designed; infra missing |
| On-premises packaging | ⏳ | Phase 7; Docker Compose + Helm |
| Database hosting (managed) | ❌ | RDS / Azure Postgres / Neon |
| Object storage (S3) | ❌ | AWS S3 / Azure Blob / R2 |
| Cache (Redis) | ❌ | ElastiCache / Azure Cache |
| Message broker | ❌ | Redis for BullMQ; future NATS? |
| Static hosting | ❌ | Vercel / Cloudflare Pages for marketing site |

---

## 12. CI/CD ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Git workflow | ❌ | Trunk-based vs GitFlow |
| Branch protection rules | ❌ | |
| CI pipeline (PR checks) | ❌ | Lint, type-check, test, build |
| Deployment pipeline | ❌ | Staging → prod with approvals |
| Canary / blue-green strategy | ❌ | |
| Feature flags | ❌ | LaunchDarkly / Unleash / homegrown |
| Database migration automation | ❌ | Prisma migrate in CI |
| Rollback procedures | ❌ | |
| Environment parity | ❌ | Dev = staging = prod configs |
| Build optimization (caching) | ❌ | |
| Monorepo tooling (Turborepo) | ❌ | Mentioned in tech stack |
| Preview environments (PR) | ❌ | Per-PR ephemeral envs |
| Release notes automation | ❌ | From commit messages |

---

## 13. OBSERVABILITY ❌ Missing (Critical for production)

| Item | Status | Notes |
|------|--------|-------|
| Logging strategy | 🟡 | Pino mentioned in API arch |
| Log aggregation | ❌ | Loki / CloudWatch / Datadog |
| Log retention policy | ❌ | Per compliance requirement |
| Structured logging | 🟡 | Pattern defined; not implemented |
| Distributed tracing | ❌ | OpenTelemetry + Jaeger/Tempo |
| Metrics collection | ❌ | Prometheus + Grafana |
| Application metrics (RED/USE) | ❌ | Rate, Errors, Duration |
| Business metrics | ❌ | Engagements created, findings issued |
| Error tracking | ❌ | Sentry |
| Uptime monitoring | ❌ | Pingdom / UptimeRobot |
| Status page | ❌ | statuspage.io / Atlassian |
| Real User Monitoring (RUM) | ❌ | Datadog RUM / Sentry |
| Dashboards | ❌ | Per-team Grafana dashboards |
| SLO / SLI definitions | ❌ | Error budgets |
| Alerting strategy | ❌ | PagerDuty + escalation policies |
| Runbooks | ❌ | For each alert type |
| Synthetic monitoring | ❌ | Probe critical flows periodically |
| Log-trace-metric correlation | ❌ | Exemplars |

---

## 14. DISASTER RECOVERY / BCP ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| RPO / RTO defined | 🟡 | Mentioned in data residency doc |
| Backup strategy | 🟡 | WAL archiving mentioned |
| Backup testing | ❌ | Regular restore drills |
| Cross-region replication | 🟡 | Architecture designed |
| Failover procedures | ❌ | Runbook needed |
| DR testing schedule | ❌ | Quarterly game days |
| Business continuity plan | ❌ | People + process |
| Incident response plan | ❌ | Severity levels, paging, comms |
| Chaos engineering | ❌ | Litmus / Gremlin — advanced |

---

## 15. APPLICATION SECURITY ❌ Missing (Critical)

| Item | Status | Notes |
|------|--------|-------|
| Threat model | ❌ | STRIDE analysis |
| Security headers | 🟡 | Documented in API arch |
| Input validation (all endpoints) | 🟡 | Zod in API layer |
| Output encoding | ❌ | XSS prevention |
| SQL injection prevention | ✅ | Prisma parameterized queries |
| CSRF protection | 🟡 | Mentioned; not implemented |
| Authentication hardening | ❌ | Account lockout, CAPTCHA |
| Session security | ❌ | Secure cookie flags, rotation |
| File upload security | 🟡 | Mentioned; virus scanning TBD |
| Secrets in code scanning | ❌ | gitleaks, trufflehog |
| Dependency scanning (SCA) | ❌ | Snyk / Dependabot |
| SAST | ❌ | Semgrep / CodeQL |
| DAST | ❌ | OWASP ZAP / Burp |
| Container image scanning | ❌ | Trivy / Grype |
| IaC scanning | ❌ | Checkov / tfsec |
| Security training for devs | ❌ | OWASP Top 10 awareness |
| Bug bounty program | ❌ | HackerOne / Bugcrowd |
| Penetration testing | ❌ | Annual or pre-launch |
| Code review security checklist | ❌ | |
| Zero trust networking | ❌ | BeyondCorp-style |

---

## 16. INFRASTRUCTURE SECURITY ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Network segmentation | ❌ | Public/private subnets |
| Firewall rules / security groups | ❌ | Least privilege |
| WAF (Web Application Firewall) | ❌ | Cloudflare / AWS WAF |
| DDoS protection | ❌ | CloudFlare / AWS Shield |
| VPN / bastion for admin access | ❌ | Zero-trust or Tailscale |
| Secret rotation | ❌ | Automated via KMS |
| Key management (KMS) | 🟡 | Mentioned in DB docs |
| Encryption at rest | 🟡 | Mentioned but not set up |
| Encryption in transit | 🟡 | TLS 1.3 mentioned |
| Access logging (cloud provider) | ❌ | CloudTrail / Azure Activity Log |
| Cloud security posture (CSPM) | ❌ | Wiz / Prisma Cloud |
| Container runtime security | ❌ | Falco |
| Privileged access management | ❌ | JIT access, approval flows |

---

## 17. COMPLIANCE ❌ Missing (Will be needed for enterprise sales)

| Item | Status | Notes |
|------|--------|-------|
| SOC 2 Type I readiness | ❌ | ~6 months effort |
| SOC 2 Type II | ❌ | ~12 months after Type I |
| ISO 27001 | ❌ | Often bundled with SOC 2 |
| GDPR compliance | 🟡 | Data residency documented |
| HIPAA BAA capability | ❌ | For healthcare tenants |
| PCI DSS | N/A | Via Stripe (they handle card data) |
| FedRAMP (government) | ❌ | Long roadmap (18-24 months) |
| CCPA / CPRA | 🟡 | Partially via GDPR approach |
| India DPDP Act | 🟡 | Data residency designed |
| Audit logging for compliance | ✅ | Hash-chained immutable |
| Data subject rights automation | ❌ | Export, delete, rectify flows |
| Compliance documentation (policies) | ❌ | Information security policy, etc. |
| Vendor risk management | ❌ | Sub-processor reviews |
| Data Processing Agreements | ❌ | Template needed |
| Evidence collection system | ❌ | For auditors (ironic) |

---

## 18. PRIVACY ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Privacy policy | ❌ | Published on website |
| Terms of service | ❌ | Legal review |
| Cookie consent | ❌ | Banner + preferences |
| Privacy Impact Assessment (DPIA) | ❌ | Per GDPR Article 35 |
| Data minimization review | ❌ | Collect only what's needed |
| Consent management | ❌ | Per-purpose consent tracking |
| Right to access (GDPR Art. 15) | ❌ | Automated export |
| Right to erasure (Art. 17) | 🟡 | Anonymization fn designed |
| Right to portability (Art. 20) | ❌ | |
| Breach notification process | ❌ | 72-hour GDPR requirement |
| Data Protection Officer (DPO) | ❌ | Needed for >250 employees / high-risk |
| Records of Processing Activities | ❌ | GDPR Article 30 |
| Sub-processor transparency | ❌ | Public list on trust page |

---

## 19. TESTING ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Unit test framework | ❌ | Vitest chosen |
| Integration tests | ❌ | API + DB tests |
| E2E tests | ❌ | Playwright |
| Contract tests | ❌ | API contracts between services |
| Visual regression | ❌ | Chromatic / Percy |
| Performance tests (load) | ❌ | k6 |
| Security tests | ❌ | Part of SAST/DAST |
| Accessibility tests | ❌ | axe-core in CI |
| Mutation testing | ❌ | Stryker — advanced |
| Test coverage targets | ❌ | Per-layer minimums |
| Fixture/factory strategy | ❌ | Prisma seed + factories |
| Test data management | ❌ | Isolated per test |
| CI test parallelization | ❌ | |
| Flaky test detection | ❌ | |
| Chaos / fault injection | ❌ | Toxiproxy / Gremlin |

---

## 20. CODE QUALITY ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| TypeScript strict mode | 🟡 | Intended |
| ESLint configuration | ❌ | Shared config |
| Prettier configuration | ❌ | |
| Git hooks (Husky + lint-staged) | ❌ | |
| Commit message linting | ❌ | Conventional commits |
| Code review guidelines | ❌ | PR template |
| CODEOWNERS | ❌ | Per-directory ownership |
| Code style guide | ❌ | Beyond linting |
| Naming conventions | 🟡 | Some documented in database |
| Coding standards doc | ❌ | |
| Architecture Decision Records (ADRs) | ❌ | Key decisions documented |
| Dead code detection | ❌ | Knip / ts-prune |
| Bundle size budgets | ❌ | |
| Dependency update strategy | ❌ | Renovate config |

---

## 21. DOCUMENTATION ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Internal engineering handbook | ❌ | Onboarding new engineers |
| Architecture overview | 🟡 | Scattered; need unified C4 diagram |
| API documentation (public) | 🟡 | OpenAPI exists; needs rendered docs site |
| SDK documentation | ❌ | Per language |
| User-facing product docs | ❌ | docs.aims.com site |
| Admin documentation | ❌ | For tenant admins |
| Video tutorials | ❌ | |
| Standard Pack authoring guide | ❌ | For future packs |
| Runbooks (operations) | ❌ | One per alert / failure mode |
| Disaster recovery runbook | ❌ | |
| Security incident runbook | ❌ | |
| ADR index | ❌ | |
| API changelog | ❌ | |
| Release notes | ❌ | Customer-facing |
| Status page / incident history | ❌ | |

---

## 22. CUSTOMER SUPPORT ❌ Missing

| Item | Status | Notes |
|------|--------|-------|
| Support ticket system | ❌ | Zendesk / Intercom / Linear |
| In-app help / tour | ❌ | Product tours (e.g., Intro.js) |
| Help center / knowledge base | ❌ | |
| Customer success tooling | ❌ | Gainsight / Vitally — enterprise |
| Product analytics | ❌ | PostHog / Mixpanel / Amplitude |
| User feedback collection | ❌ | NPS, CSAT, in-app surveys |
| Feature request tracking | ❌ | Public roadmap (Canny) |
| Support impersonation | ❌ | Audited carefully |
| Diagnostic/debug tools | ❌ | Admin UI to inspect tenant state |
| SLA commitments | ❌ | Enterprise contracts |
| On-call rotation | ❌ | PagerDuty schedules |
| Escalation procedures | ❌ | |

---

## Current State Summary

| Domain | Done | Partial | Planned | Missing | Completion |
|--------|------|---------|---------|---------|------------|
| 1. Product Strategy | 7 | 1 | 0 | 3 | 70% |
| 2. Go-to-Market | 0 | 1 | 0 | 9 | 5% |
| 3. Pricing & Billing | 0 | 1 | 9 | 0 | 10% |
| 4. Domain Model | 7 | 0 | 0 | 0 | **100%** |
| 5. Database | 10 | 1 | 0 | 2 | 85% |
| 6. API | 8 | 1 | 0 | 2 | 80% |
| 7. Frontend | 0 | 0 | 1 | 14 | 3% |
| 8. Identity & Auth | 0 | 1 | 0 | 14 | 3% |
| 9. Real-time | 0 | 1 | 0 | 7 | 5% |
| 10. Search | 0 | 1 | 0 | 7 | 5% |
| 11. Infrastructure | 0 | 2 | 1 | 16 | 5% |
| 12. CI/CD | 0 | 0 | 0 | 13 | 0% |
| 13. Observability | 0 | 2 | 0 | 16 | 5% |
| 14. DR/BCP | 0 | 2 | 0 | 7 | 10% |
| 15. AppSec | 1 | 4 | 0 | 15 | 10% |
| 16. InfraSec | 0 | 3 | 0 | 10 | 10% |
| 17. Compliance | 1 | 3 | 0 | 11 | 10% |
| 18. Privacy | 0 | 1 | 0 | 12 | 3% |
| 19. Testing | 0 | 0 | 0 | 15 | 0% |
| 20. Code Quality | 0 | 2 | 0 | 12 | 5% |
| 21. Documentation | 0 | 2 | 0 | 13 | 5% |
| 22. Customer Support | 0 | 0 | 0 | 12 | 0% |

**Overall completion**: ~18% of what's needed for enterprise-ready SaaS.

**Architecture/foundation**: ~75% (what we've focused on — the hard design stuff)
**Operational/business**: ~5% (what's ahead)

---

## Strategic Sequencing (Recommended)

Given what's done, here's the recommended order for remaining work:

### TIER 1: Complete the Technical Foundation (Do Next)
Needed before any code can be written confidently.
1. **Identity & Auth** (Domain 8) — auth flow, session mgmt, MFA
2. **Frontend Architecture** (Domain 7) — Next.js structure, design system
3. **Code Quality** (Domain 20) — lint, format, strict TS, ADRs
4. **Testing Strategy** (Domain 19) — test layers, fixtures, coverage

### TIER 2: Make it Buildable & Deployable (Once we start coding)
5. **CI/CD** (Domain 12) — pipelines, branch protection, release flow
6. **Infrastructure** (Domain 11) — Terraform, container strategy, managed services
7. **Observability** (Domain 13) — logs/traces/metrics from day one
8. **AppSec basics** (Domain 15) — security headers, scanning tools

### TIER 3: Production-Ready Concerns
9. **InfraSec** (Domain 16) — WAF, secrets rotation, access controls
10. **DR/BCP** (Domain 14) — backup testing, failover runbooks
11. **Real-time & Search** (Domains 9, 10) — SSE infrastructure, search strategy
12. **Documentation** (Domain 21) — runbooks, ADRs, public docs site

### TIER 4: Go-to-Market Readiness
13. **Privacy** (Domain 18) — DPIA, consent, data subject rights
14. **Compliance** (Domain 17) — SOC 2 readiness, policies
15. **Pricing & Billing** (Domain 3) — Stripe, metering, tiers
16. **Customer Support** (Domain 22) — ticketing, docs, tours

### TIER 5: Growth & Scale
17. **Go-to-Market** (Domain 2) — marketing site, collateral, onboarding
18. **Product Strategy polish** (Domain 1) — KPIs, journey maps

---

## Recommended Next Deliverable

**Option A (Recommended)**: **Identity & Auth subsystem** (Domain 8)
- Blocks implementation of ANY other feature
- API middleware references `ctx.auth` but we haven't designed auth flow
- Session, MFA, SSO, permissions all need design before coding begins
- ~1-2 deliverable sessions

**Option B**: **Frontend Architecture + Design System** (Domain 7)
- Also blocks UI implementation
- Next.js 15 app router patterns, Shadcn integration, state management
- Design tokens, dark mode, accessibility patterns

**Option C**: **DevOps/Infrastructure** (Domain 11-13)
- IaC, CI/CD, observability stack design
- Enables deployment from day one
- Important but Auth + Frontend are more urgent (you can't run the app without them)

**Option D**: Tackle multiple in parallel — covered by different "phase" documents that are lightweight scaffolds each

---

## My Recommendation

Go in this order:
1. **Identity & Auth** — unblocks the API middleware and frontend
2. **Frontend Architecture** — unblocks UI work
3. **DevOps baseline** — CI/CD + infrastructure + observability
4. **Testing & code quality** — establish standards
5. **Security & compliance foundations** — threat model, SOC 2 gap analysis

Each of these is a meaty deliverable (similar in scope to the data-model or database work we've done). Total: ~5 more focused sessions to get to a truly production-ready plan.

After planning is complete, we move to implementation. Current state gets us to ~80% architecturally ready; 20% more design work gets us to "ready to build with confidence."

---

## Optional: Comprehensive vs. Pragmatic

You could also choose **pragmatic MVP path**:
- Skip formal compliance (SOC 2) until customer demands it
- Use managed services to skip DevOps complexity (Vercel, Supabase, Auth0)
- Skip i18n, advanced search, real-time until core features work
- Target building **1 working vertical slice** (GAGAS engagement end-to-end) first

This gets a working product 3-6 months faster. Risk: refactoring later.

**Recommendation**: Plan comprehensively (what we're doing now), then build pragmatically with the plan as a north star.

---

## Next Decision

Pick one of:
- **A.** Go thorough — design all Tier 1 items (Auth, Frontend, CI/CD, Observability) now
- **B.** Go focused — design Auth + Frontend only, then start implementation
- **C.** Custom — pick specific domains from above
