# Architecture Tour

> A guided walk through the ten reference folders. We use the Oakfield Single Audit scenario from [02 — Worked example](02-worked-example-single-audit.md) as the spine — wherever possible, the architectural layer is explained in terms of what Oakfield's FY26 engagement actually does at that layer. Read this after the worked example, not before.

---

## 1. The system in one picture

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                         AIMS v2 — layer map                              │
  │                                                                          │
  │   docs/                         frontend/                                │
  │   (this folder —                (Next.js 15 + React 19 + tRPC client     │
  │    orientation)                  + Tailwind + design system + i18n)      │
  │                                         ▲                                │
  │                                         │ tRPC (typed)                   │
  │                                         ▼                                │
  │   auth/                         api/                                     │
  │   (identity,                    (Fastify + tRPC v11 on the request path; │
  │    MFA, SSO,                     NestJS workers for doc-gen, outbox,     │
  │    session,                      scheduled jobs; REST + webhooks via     │
  │    permissions)────────────────► outbox + HMAC)                          │
  │                                         ▲                                │
  │                                         │                                │
  │                                         ▼                                │
  │   data-model/                   database/                                │
  │   (standard packs +             (PostgreSQL 16 + Prisma + RLS +          │
  │    tenant data model +           hash-chained audit log + bitemporal)    │
  │    semantic dictionary)                                                  │
  │                                                                          │
  │   engineering/                  devops/                                  │
  │   (testing + code standards +   (AWS + Terraform/OpenTofu + EKS +        │
  │    review + docs + tech debt +   ArgoCD + Argo Rollouts + OpenTelemetry +│
  │    quality gates)                Sentry + PagerDuty)                     │
  │                                                                          │
  │   security/                     references/                              │
  │   (SOC 2 + ISO 27001 + HIPAA +  (standards research, design notes,       │
  │    GDPR + vulnerability         competitive analysis, crosswalks)        │
  │    management + incident                                                 │
  │    response + trust center)                                              │
  └──────────────────────────────────────────────────────────────────────────┘
```

Ten folders. Every line of design detail in the project lives in one of them. Most engineers will spend 80% of their time in three or four of these folders. This tour walks all ten, grouped by plane of concern.

---

## 2. The ten folders at 50,000 feet

One paragraph each. You don't need to remember these — you need to know what's where so you can find things when you need them.

### `docs/` — the folder you're in

Educational documentation. Narrative, audience-scoped, designed to be *read*. The README explains reading paths by role; the introduction (01) tells the story; the worked example (02) grounds all terminology in a concrete scenario; the multi-standard insight (03) is the architectural deep-dive; this file (04) is the tour; the glossary (05) is the lookup; design decisions (06) and the engineer handbook (07) complete the set.

### `data-model/` — what the system knows about

Versioned standard packs (GAGAS, IIA GIAS, ISO 19011, Single Audit overlay, SOC 2) plus the tenant-data model (Engagement, Finding, Recommendation, Report). The schema for the methodology-as-first-class-object concept lives here. The three-tier taxonomy (methodology / control_framework / regulatory_overlay) is implemented via a `packType` discriminator. Every architectural decision documented in [03](03-the-multi-standard-insight.md) shows up here as schema.

### `database/` — the PostgreSQL layer

Prisma schema, Row-Level Security policies for multi-tenancy, migrations, hash-chained audit log triggers, immutability enforcement for issued artifacts, bitemporal history where findings or recommendations need one. 39 models, 3 schemas (public + audit + platform), 79 indexes. The physical manifestation of the data-model concepts.

### `api/` — the service boundary

Two-tier API layer, deliberately split by role. **Request path**: Fastify + tRPC v11 for the frontend (end-to-end type safety on the structural shape), plus REST (OpenAPI 3.1) for external integrators and HMAC-signed webhooks for event delivery. Lean, no heavyweight DI on the hot request path. **Worker path**: NestJS for background work — document generation, transactional-outbox dispatch, scheduled jobs, SCIM sync — where DI, lifecycle management, and `@Cron` decorators genuinely pay off. Zod schemas are the single source of truth for input validation, shared between request-path API and frontend. Routers per domain — engagement, finding, approval, standard-pack.

### `auth/` — identity and access

Better Auth as the core library with custom extensions. JWT (EdDSA) signing for access tokens, opaque refresh tokens with family tracking, Argon2id hashing, TOTP (RFC 6238) + WebAuthn/Passkeys (W3C Level 3) for MFA, SAML 2.0 + OIDC + SCIM 2.0 for SSO. RBAC + ABAC permissions with nine roles. STRIDE threat model documented explicitly.

### `frontend/` — the UI

Next.js 15 with React 19 Server Components as the default. tRPC React Query for data fetching. Tailwind CSS v4 with a three-tier design token system (reference → semantic → component). Dynamic tenant theming via CSS variables. WCAG 2.1 AA baseline. next-intl for internationalization (English only at launch, but architecture GDPR-grade for all locales). TipTap v2 for rich text. Recharts or Tremor for charts. Core Web Vitals budgets per route.

### `devops/` — how it runs

AWS (primary) with OpenTofu-compatible Terraform for infrastructure-as-code. EKS for container orchestration with Bottlerocket nodes (minimal attack surface). ArgoCD for GitOps. Argo Rollouts for canary deployments with SLO-gated promotion. OpenTelemetry for observability (logs, metrics, traces with vendor-neutral SDK). GitHub Actions with OIDC to AWS (no long-lived cloud credentials anywhere). 15-minute RPO / 1-hour RTO disaster recovery via warm-standby secondary region.

### `engineering/` — how we work

Vitest + Testcontainers + Playwright for the testing pyramid. ESLint flat config with strict TypeScript. Conventional Commits with commitlint. Diátaxis framework for documentation. 20% of engineering capacity budgeted for tech debt. 12-minute CI budget as a hard ceiling. SLO-gated canary deploys. Quality gates for Definition of Done including code + tests + docs + observability + security + a11y + i18n + review + rollback plan.

### `security/` — the compliance and trust program

Beyond the `auth/` technical security, this folder covers the program-level concerns: SOC 2 Type I then Type II roadmap, ISO 27001 mapping, HIPAA readiness, GDPR-grade privacy applied to all customers, vulnerability management with three-tier SLAs (Critical 24h / High 7d / Medium 30d), incident response distinct from operational incidents, trust center for public-facing transparency, Drata/Vanta for continuous evidence collection.

### `references/` — what we researched, decided, and considered

Primary-source deep dives into each audit standard (GAGAS 2024, IIA GIAS 2024, PCAOB AS 2201, ISO 19011:2018, COBIT 2019, ISSAI), competitive analysis (live-doc validated), the multi-standard design note, cross-standard crosswalks, and the abstraction-layer business requirements. This is the provenance for every decision documented elsewhere.

---

## 3. Data plane — following an Oakfield finding through the stack

The most useful way to understand how the layers fit together is to follow a single request from UI down to database and back. Let's use Priya authoring finding 2026-001 (the expense-miscoding finding from Oakfield §6).

### 3.1 At the `data-model/` layer

The pack schema declares what a finding *can* contain. GAGAS:2024's pack defines four required finding elements (CRITERIA, CONDITION, CAUSE, EFFECT) in its `findingElements` array, each with `semanticElementMappings` entries that map them onto canonical semantic codes. The Single Audit overlay (SINGLE_AUDIT:2024) defines five `additionalFindingElements` — questioned costs (known and likely), federal program (ALN), repeat-finding indicator, compliance requirement, finding reference number. The IIA GIAS pack (IIA_GIAS:2024) defines its finding classification scheme (IIA_SEVERITY: Critical/Major/Minor/Advisory).

The `tenant-data-model.ts` file declares the shape a finding *actually takes at runtime*:

```ts
interface Finding {
  coreElements: Record<SemanticElementCode, RichText>;
  standardExtensions: Record<StandardPackKey, Record<string, unknown>>;
  classifications: FindingClassification[];
  applicableMethodologies: StandardPackRef[];
  soxSuppressRecommendation?: boolean;
  // + bookkeeping fields
}
```

This is the structural representation of "a finding has a semantic core plus per-pack extensions plus multiple classifications." The schema is enforced at compile time (TypeScript) and at runtime (Zod validation in the API layer).

### 3.2 At the `database/` layer

The Finding table in Prisma maps this structure onto PostgreSQL:

```prisma
model Finding {
  id                        String   @id
  tenantId                  String
  engagementId              String
  title                     String
  coreElements              Json     // JSONB — typed-shape enforced at app layer
  standardExtensions        Json     // JSONB — keyed by StandardPackKey
  classifications           Json     // JSONB — array of classification objects
  applicableMethodologies   Json
  soxSuppressRecommendation Boolean  @default(false)
  status                    FindingStatus
  lockedAt                  DateTime?
  version                   Int      @default(1)
  // ... createdAt, updatedAt, createdBy, etc.

  @@index([tenantId, engagementId])
}
```

JSONB for the flexible fields; scalar columns for the fields we query on (status, lockedAt, engagementId).

**Tenant isolation — two layers, deliberately.** Primary isolation happens in the application service: a Prisma Client Extension reads `tenantId` from the authenticated tRPC context and injects it into every WHERE clause. That is the mechanism we test in unit tests and on which the security guarantee rests. Row-Level Security policies run as defence-in-depth on top: each transaction issues `SET LOCAL app.current_tenant = $1`, and the policies on every tenant-scoped table double-check the setting. If the app-layer filter ever fails (developer mistake, ORM regression, a raw-SQL query that skipped the extension), RLS catches it and blocks the read. Why two layers? Prisma's connection pool multiplexes connections; naïvely setting session-scoped GUCs on pooled connections has well-documented leakage risk if the transaction boundary is not carefully wrapped. RLS-as-sole-isolation is more a marketing line than a production pattern; Shopify, Linear, and Stripe all run app-layer filters with RLS as a belt on top of the suspenders. We do the same. The pooling configuration (connection lifecycle, GUC reset on checkout, transaction-scoped settings only) is documented in `database/POOLING.md`.

**Bitemporal findings, with honesty about query cost.** Every update to a finding appends a new row with `validFrom/validTo` (business time) and `transactionFrom/transactionTo` (system time) so "what did this finding look like on 2027-12-01?" is answerable after the fact. Bitemporal-on-JSONB is notoriously hard to query fast — Prisma does not natively generate bounding-box WHERE clauses, and ad-hoc `$queryRaw` scans over bitemporal JSONB get slow past a few million rows. We maintain a hand-written materialised view `finding_as_of` keyed by `(id, as_of_timestamp)` for the hot read paths and reach for raw SQL when the window is explicit. Expect the bitemporal query path to need dedicated performance attention once any single engagement passes ~50k findings; it is a known scaling cliff, not a free feature.

When Priya saves the finding, a trigger appends an entry to the `audit_event` table — hash-chained so that any tampering is detectable. When she eventually signs the engagement for issuance, an `immutability_check` trigger sets `lockedAt` and prevents subsequent UPDATE or DELETE operations on that finding.

### 3.3 At the `api/` layer

The tRPC router `finding.router.ts` has a `create` procedure with a Zod input schema that validates the incoming payload against the engagement's attached packs:

```ts
finding.create = authenticatedProcedure
  .input(findingCreateSchema)
  .mutation(async ({ input, ctx }) => {
    // Runtime validation — tenant scoping, RLS context, optimistic concurrency
    // Pack-driven validation — verify coreElements keys against active methodology's required codes
    // Verify standardExtensions keys against active regulatory overlays' additional elements
    // Invoke FindingService.create
    // Emit audit event
    // Return typed result to client
  });
```

The same Zod schema is imported by the frontend, so the UI's form validation and the server's input validation are the same code. If a pack adds a new finding element, both sides update simultaneously via the shared schema.

For external integrators, the REST layer at `api/rest/openapi.yaml` exposes a compatible endpoint — `POST /v1/engagements/{id}/findings` — with the same semantic.

**Webhooks do not fire from the tRPC handler or from a Prisma middleware.** That would be a dual-write: the database transaction commits, the HTTP call to the customer's receiver might not, and the customer ends up with a state diverged from ours. Instead, the tRPC handler writes an `outbox_event` row in the *same transaction* as the finding write. A NestJS worker reads the outbox, dispatches the webhook HMAC-signed (Stripe-style), retries with exponential backoff for up to 24 hours, and parks exhausted deliveries in a dead-letter queue. Consumers receive each event at-least-once with an idempotency key; we never have a committed state change without its event, and we never emit an event for a rolled-back transaction. The outbox is described as a cross-cutting pattern in §8.7.

**Document generation is a NestJS worker, not a request-path concern.** When a Single Audit engagement needs its seven reports, the request returns a job ID; a NestJS worker reads the job, queries the engagement + findings + attached packs, runs the document-generation engine (per-pack vocabulary + per-report presentation rules + §6.4 of [03](03-the-multi-standard-insight.md)), renders to PDF and DOCX, stores artifacts in S3, and emits a `report.ready` outbox event. Expect this worker tier to be heavy and to need its own capacity planning — see §5.

### 3.4 At the `frontend/` layer

The finding-authoring page (in `apps/web/app/engagements/[id]/findings/[findingId]/page.tsx` in the hypothetical runtime) is a Server Component that fetches the finding + the engagement's attached packs via the tRPC server caller. The interactive form is a Client Component using React Hook Form + the shared Zod schema.

The form renders pack-driven. GAGAS's four elements appear as rich-text fields (TipTap-based). Single Audit's five additional elements appear as a separate "Single Audit details" section because the overlay is attached. The classification picker shows GAGAS's deficiency tier scheme *and* IIA's severity scheme because both methodologies are attached — Priya picks one value from each scheme. The recommendation attachment UI shows the finding's related recommendations (via `rec.findingIds[]` lookup) and lets her link new ones.

The dynamic form engine that handles "different packs contribute different fields" lives in `frontend/implementation/example-dynamic-form.tsx` as a reference implementation. It's the frontend mirror of the pack schema — the pack declares what fields exist; the engine renders them.

**Type safety has a compile-time boundary and a runtime boundary, and the boundary matters.** The *structural* shape of a finding is typed end-to-end via tRPC — `coreElements: Record<SemanticElementCode, RichText>`, `standardExtensions: Record<StandardPackKey, Record<string, unknown>>`, `classifications: FindingClassification[]`, metadata. That propagates cleanly from Prisma model to tRPC to React Hook Form. What goes *inside* `coreElements` and `standardExtensions`, however, depends on which packs the engagement has attached at runtime, which the compiler cannot know without either a massive union of every possible pack schema (which would explode the type graph) or a generic `Record<string, unknown>` (which would erase safety). We pick neither: the pack's own JSON Schema is the runtime source of truth. The frontend's dynamic form engine reads it and renders the required fields; the server's Zod validator reads it and validates the payload; both paths use the same pack JSON Schema, not a tRPC-generated type. If a pack adds a new finding element, the *pack* is the change; both sides re-validate against it at runtime; no code generation or tRPC router rebuild is needed. This is the right trade-off for a methodology-pluralist platform — claiming strict compile-time propagation of pack-specific fields would be false.

### 3.5 Summary of the data plane

A finding is a row in PostgreSQL (enforced isolation via RLS), a service-layer object in NestJS (validated against pack-driven Zod schemas), a tRPC-typed entity on the wire, and a dynamically-rendered form in the browser. The schema for the object is declared once (in `data-model/tenant-data-model.ts`) and flows everywhere. Pack-driven variability (different attached standards → different required fields) is handled at every layer consistently.

If you make it through understanding this one flow, you understand 80% of the data-plane mental model.

---

## 4. Identity plane — authentication and authorization across layers

Auth is the other cross-cutting concern that touches every layer. Oakfield's `auth/` story:

### 4.1 User authentication

Priya logs in via Oakfield's SSO (Okta, provisioned via SCIM 2.0). The SAML 2.0 assertion is validated by our auth service; a short-lived access token (JWT signed EdDSA, 15-minute expiry) and an opaque refresh token (rotated per use, family-tracked for theft detection) are issued. Tokens stored in HttpOnly Secure cookies.

For administrator roles (Marcus, as CAE), MFA is enforced. TOTP is the baseline; WebAuthn is preferred (Priya uses a YubiKey). MFA policy is controlled by the audit function's settings, with a tenant-wide override for compliance requirements (some tenants require WebAuthn universally).

### 4.2 Authorization

Priya's permissions are determined by:

- **Role** (RBAC) — Auditor-in-Charge role for this engagement, plus CIA-certified staff for Governmental-audit work. Role grants come from the audit function's user-role assignments.
- **Attribute** (ABAC) — permission to edit finding 2026-001 requires (a) being assigned to the engagement it belongs to, (b) the finding not being locked, (c) the current phase being within the edit window. These attribute checks happen at each request.

The authorization matrix (in `auth/PERMISSIONS.md`) is an explicit table of which roles can perform which actions on which entity types under which conditions. Every tRPC procedure declares its permission requirements; the auth middleware enforces them before the handler runs.

### 4.3 Session boundary

The access token carries tenant + user + role claims. The tRPC context on every request includes the authenticated user's identity. Tenant-scoped queries are enforced in two layers (see §3.2 for the reasoning): a Prisma Client Extension injects `tenantId` into every WHERE clause from the authenticated context (primary enforcement, unit-testable), and each transaction additionally sets `app.current_tenant` so Row-Level Security policies double-check at the database. Both layers must pass; a failure in either is a bug; both existing is the belt-and-suspenders that lets us sleep. Connection pools are deliberately sized and configured so pool-multiplexing cannot leak session state across transactions — every connection resets GUCs on checkout, and the transaction wrapper verifies `app.current_tenant` matches the authenticated tenant before any query runs.

### 4.4 Audit trail of identity events

Every authentication event (login, logout, MFA enrollment, MFA verification, session refresh, session revocation), every authorization event (permission granted, permission denied), every role change, every SSO group sync — logged to the hash-chained audit log in the `audit` schema. Compliance frameworks (SOC 2 CC6, ISO 27001 A.5/A.8, HIPAA §164.308) require this; more importantly, it's the forensic trail when something goes wrong.

### 4.5 Where this shows up in Oakfield

At engagement creation (Oakfield §2), Priya had to have the `Auditor-in-Charge` role and be within Oakfield's tenant. At finding approval (§8), Marcus had to have the `CAE` role and be within the approval chain for that specific engagement. Each SSO-provisioned role was tracked back to Oakfield's Okta assignment.

---

## 5. Operations plane — how Oakfield's engagement is deployed, observed, and recovered

Priya is not running AIMS v2 locally on her laptop. She's using a SaaS tenant hosted on our infrastructure. The `devops/` layer is everything between her browser and our application code running.

### 5.1 Infrastructure

Oakfield's tenant lives in an AWS EKS cluster in `us-east-2` (regional placement chosen at tenant onboarding, respecting data residency requirements). Terraform modules define the VPC, EKS, RDS (PostgreSQL), ElastiCache (Redis for sessions + caching), S3 (work paper storage), CloudFront (CDN), Route 53 (DNS), ACM (TLS certs), IAM (least-privilege roles), Secrets Manager (DB credentials), and KMS (encryption at rest).

**Encryption pattern — application-layer, not `pgcrypto`.** AWS KMS encrypts volumes, RDS storage, and S3 at rest (platform-level). *Field-level* encryption of sensitive PII and tenant-confidential payloads happens in the application service before Prisma ever sees the plaintext: AWS KMS wraps a per-tenant Data Encryption Key (envelope encryption, rotated per `security/ROTATION.md`); the API worker uses that DEK in-process to encrypt on write and decrypt on read; Postgres only ever sees ciphertext for those fields. We deliberately do *not* use Postgres `pgcrypto` for queryable or PII encryption. `pgcrypto` requires the symmetric key inside Postgres memory space, which risks key leakage via query logs, `pg_stat_statements`, memory dumps, and replication streams. Application-Layer Encryption (ALE) keeps keys out of the database entirely. For fields that must be queryable by equality, we use deterministic encryption with per-tenant keys; for fields that need search without reversibility, we use blind indexes (HMAC-with-per-tenant-secret over the plaintext, stored alongside the ciphertext). This supersedes the `pgcrypto` plan in early `database/` iterations — the earlier plan is being reconciled.

All infrastructure is declared-then-applied. No console-clicks. Drift detection runs daily and alerts on any manual AWS changes that bypass Terraform.

### 5.2 Deployment

Code merges to `main` trigger GitHub Actions. The pipeline runs (in this order): lint, typecheck, unit tests, integration tests (against real PostgreSQL + Redis in Docker), E2E tests (Playwright against a preview environment), build, container scan (Trivy), SAST (Semgrep + CodeQL), SCA (Snyk), secrets scan (gitleaks). All must pass before deployment begins.

Deployment uses Argo Rollouts for canary with SLO-gated promotion:

- Canary starts at 5% of traffic
- Observed for 5 minutes against latency and error rate SLOs
- If within SLO, promote to 25%, observed, 50%, observed, 100%
- If any SLO breaches, automatic rollback

A broken deploy that affects 5% of Oakfield users for 5 minutes is a 15-minute worst case of partial impact (canary window + rollback). Real deploys typically promote cleanly and Oakfield sees nothing.

### 5.3 Observability

Every service emits structured logs (JSON, via Pino), metrics (via Prometheus-compatible counters and histograms), and traces (via OpenTelemetry). All three pipelines feed into our observability stack (Grafana Loki for logs, Prometheus for metrics, Tempo for traces, Sentry for errors with frontend + backend source map integration).

Every request from Priya carries a `traceparent` header. Every database query, every external API call, every tRPC procedure call becomes a span in the trace. When something's slow, we can pull up Priya's request-trace and see exactly which span took the time.

Alerts (PagerDuty) fire on SLO violations, not on every transient blip. Engineers go to bed at night.

### 5.4 Disaster recovery

Oakfield's data is continuously replicated to a secondary AWS region. Point-in-time recovery on the database supports restore to any second within the last 35 days. S3 work paper storage is cross-region replicated with versioning.

Target **RPO** (Recovery Point Objective, the maximum tolerable data loss) is 15 minutes. Target **RTO** (Recovery Time Objective, the maximum tolerable downtime) is 1 hour.

Quarterly DR drills (chaos engineering on the secondary region). When the primary region had a real outage — hypothetically — Oakfield's engagement would be back up within the hour, with no more than 15 minutes of data loss for the very latest edits.

### 5.5 Summary

Oakfield's audit team never thinks about any of this. That's the point. The `devops/` layer exists so that Priya can focus on auditing, not on infrastructure.

---

## 6. Engineering culture — how we keep the code honest

The `engineering/` folder is not about running the system. It's about *how we work*. It's the social architecture that complements the technical architecture.

### 6.1 Testing pyramid

- **Unit tests** (Vitest) — pure logic. Each pack validation function, each schema rule, each semantic-element mapping, each strictness-resolver computation. Fast, run on every PR.
- **Integration tests** (Vitest + Testcontainers) — service against a real PostgreSQL and real Redis in Docker. Catches ORM-level bugs and RLS policy issues that unit tests miss.
- **Contract tests** — the tRPC schemas are tested for backward compatibility across versions. A schema change that would break an existing client is caught before deployment.
- **E2E tests** (Playwright) — full browser, full stack, Oakfield-like seed data. Test the actual user flow: create engagement, author finding, generate report.
- **Performance tests** (k6) — load tests with SLOs. We simulate Oakfield-scale load (thousands of findings in an engagement, multiple concurrent editors) and verify the system holds.

### 6.2 Code standards

TypeScript strict everywhere. No `any` without explicit justification. Feature-first folder layout (`src/features/engagement/`, not `src/models/Engagement.ts` scattered across `models/`, `services/`, `controllers/`). Named exports only (no default exports — they hurt tree-shaking and refactors).

Zod schemas as single source of truth for runtime validation. Domain vocabulary enforced in code review (see `engineering/CODE-STANDARDS.md §2` — we reject "ALN" not "CFDA", "IIA GIAS 2024" not "IPPF", etc.).

### 6.3 Review discipline

Every PR reviewed by at least one person who's not the author. CODEOWNERS enforces that security-sensitive areas (`auth/`, `database/`, the strictness resolver) require review from specific maintainers. PR bot comments on drift (e.g., a PR that adds a new standard without updating `data-model/VALIDATION.md` gets a reminder).

Conventional Commits enforced via commitlint. The commit history is itself documentation — running `git log --oneline -- auth/` tells the story of how authentication evolved.

### 6.4 Documentation cadence

Every significant design decision lands in `references/` as an ADR or design note. Every non-trivial feature lands with a README change in the relevant folder. Quarterly docs review — stale docs are flagged and either updated or archived. This very `docs/` folder has a review cadence.

### 6.5 Tech debt budget

20% of engineering capacity is budgeted for tech debt. Not "when we have time" — as a reserved line item per sprint. Debt items tracked in a dedicated list with severity, business impact, and accumulated interest. Debt items graduate to features when the cost of not fixing them exceeds the cost of fixing them.

### 6.6 Definition of Done

A feature is not done when the code works. It's done when:

- Code merged + deployed
- Tests written (unit + integration + E2E where applicable)
- Docs updated (relevant folder README + ADR if architectural)
- Observability added (logs + metrics + traces on new endpoints)
- Security reviewed (SAST clean + permissions checked)
- Accessibility checked (WCAG 2.1 AA for UI features)
- i18n applied (all user-facing strings externalized)
- Code reviewed and approved
- Rollback plan documented

That's a long list. The alternative is features that land and then leak operational burden forever. We've picked the list over the leak.

---

## 7. Compliance plane — the security program beyond technical security

`auth/` and `database/` cover technical security (cryptography, RLS, access control). `security/` covers the programmatic, compliance-framework, customer-facing side.

### 7.1 Phased compliance roadmap

- **Phase 1** (launch): Privacy baseline — GDPR-grade data handling applied to all customers (US + EU + elsewhere). CCPA/CPRA compliance for California users. Data subject access rights supported. No Type I audit yet; operating compliantly but not formally attested.
- **Phase 2** (6 months in): SOC 2 Type I attestation. Audit over a point-in-time snapshot of controls.
- **Phase 3** (12 months in): SOC 2 Type II attestation. Audit over a 6- or 12-month window of control operation.
- **Phase 4** (18-24 months in): ISO 27001 certification. Broader than SOC 2; more international traction.
- **Phase 5** (as demanded): HIPAA BAA for healthcare customers. PHI data handling attestation.
- **Phase 6** (government market): FedRAMP Moderate. Only pursued if federal customer pipeline justifies — a 12-24 month program.

Drata (or Vanta) powers continuous evidence collection. Every control has automated evidence gathered daily. The annual audit becomes a walk-through of pre-collected evidence rather than a scramble.

### 7.2 Vulnerability management

Three-tier SLAs: Critical vulns remediated within 24 hours; High within 7 days; Medium within 30 days. All tracked via Dependabot + manual review + annual pen test.

### 7.3 Incident response — distinct from operational

Operational incidents (the API is down; Oakfield can't log in) are handled by the on-call engineer with runbook support. *Security* incidents (a suspected breach, a suspicious admin login, a malware alert from the EDR) are a different beast — formal IR team, forensic preservation, legal/PR involvement, regulatory notification (GDPR 72-hour breach window, state-specific rules, customer-contract notification clauses).

The `security/INCIDENT-RESPONSE.md` runbook governs this second kind. Few engineers will ever participate in one; all engineers should know it exists and know the escalation path.

### 7.4 Trust center

Public-facing transparency page. Current SOC 2 status, list of subprocessors (auto-updated from an internal register), security questionnaire library (SIG Lite preloaded), data processing agreement (DPA) template. Customers doing security reviews can self-serve most of what they'd otherwise email and wait for.

### 7.5 Where this shows up in Oakfield

Oakfield's IT Security team did a security review before the university onboarded. The trust center answered most of their questions. The DPA was signed. The SOC 2 Type I report (once available) satisfies their annual vendor review. If an incident occurred — our incident, not Oakfield's audit findings — they would receive notification per the terms of the DPA and the severity of the incident.

---

## 8. Cross-cutting patterns — how concerns thread across folders

A few patterns that show up everywhere, worth calling out so you know to expect them.

### 8.1 Multi-tenancy

Every tenant-scoped row in PostgreSQL carries a `tenantId`. RLS policies auto-filter. The API middleware sets the tenant context. The frontend inherits it from the session. Tenant boundaries are enforced at the database layer so even a bug in application code cannot leak across tenants.

Tenant onboarding provisions the tenant record + default settings + admin user + SSO integration (if enterprise tier). Teardown (tenant offboarding) is a complex operation — data export, retention-period hold, cryptographic erasure at end of hold — governed by the DPA + applicable privacy law.

### 8.2 Internationalization

next-intl handles UI text. Currency, dates, and numbers format per locale. Time zones are user-scoped (Priya sees `2027-08-17 15:32 EDT`; a London-based auditor would see `2027-08-17 20:32 BST`).

English is the only shipped locale at launch. The architecture is locale-agnostic — adding a second locale is a content activity, not an architecture activity.

### 8.3 Accessibility

WCAG 2.1 AA baseline enforced at the design-system level. Color contrast, keyboard navigation, screen reader labels all validated by automated testing (axe-core in E2E tests). Every new UI component passes the checks before merge.

### 8.4 Observability

Every HTTP request, every tRPC call, every database query, every external API call produces a trace span. Every log line carries structured fields (tenantId, userId, traceId, engagementId where applicable). When an issue arises, you can filter logs and traces by any of those — a specific tenant's activity, a specific user's session, a specific engagement's lifecycle.

### 8.5 Pack versioning and semantic element dictionary

Every pack is versioned. Every reference to a pack carries the version. When a new version of a pack is published, existing engagements do not auto-migrate — they remain pinned to the version they were created against. The semantic element dictionary (canonical CRITERIA / CONDITION / CAUSE / EFFECT / plus others) is the translation layer that lets different pack versions and different packs render findings consistently.

### 8.6 Audit trail

Every state change on a meaningful entity (engagement, finding, recommendation, report) is logged to the `audit_event` table. Hash-chained, tenant-scoped, retention per strictness resolver (5 years in Oakfield's case). Reconstruction of "who did what when" is always possible. This is a core differentiator vs tools that rely on last-modified timestamps.

### 8.7 Event outbox — the only durable happens-before edge we trust

Any state change that needs to produce a side effect outside the database — webhook delivery, search-index update, analytics event, downstream queue message, notification email — is written to the `outbox_event` table *within the same transaction as the state change* and dispatched by a separate NestJS worker. This is the Transactional Outbox pattern, and it is not optional in this architecture.

The reason: the database transaction commit is the only durable happens-before edge we have. If a tRPC handler committed a finding and then made an HTTP call to a webhook receiver, three failure modes exist: the DB commits and the HTTP succeeds (good); the DB commits and the HTTP fails (consumer diverges from us); the DB rolls back but the HTTP already succeeded (we emitted an event for a state change that never happened). The last two are not rare on a long enough time horizon. The outbox collapses all three to one: either the state change and the outbox row commit together, or neither does.

The worker dispatches at-least-once with idempotency keys; consumers must be idempotent (we document this as a contract). Retries use exponential backoff up to 24 hours; exhausted deliveries go to a DLQ with an on-call alert. Per-aggregate ordering is preserved via a partition key on `aggregate_id`. Delivery state is visible in the outbox table — operators can query "what webhooks are pending / failed / delivered for engagement X?" without reading NestJS logs.

Everything in §3.3 (webhooks), §5.2 (deployment events), §8.6 (audit trail side-feeds), and the document-generation job queue flows through this pattern.

---

## 9. Where things intentionally do NOT live

Negative architecture — what the system deliberately doesn't do, and why.

### 9.1 We do not run the audit procedures for the auditor

An auditor tests controls, evaluates evidence, reaches conclusions. We host the structure, the evidence, the findings, and the reports. We do not — and will not — replace auditor judgment. Some GRC tools market "AI auditor" capabilities that promise to evaluate controls automatically. We don't. Professional standards require sufficient appropriate evidence gathered and evaluated by a qualified auditor; software automating that step is creating compliance risk, not reducing it.

### 9.2 We do not store auditee's underlying data

Oakfield's university-wide financial records live in the university's Workday instance. We host Priya's audit work — the findings, the work papers she uploaded, her samples, her analysis. We don't replicate Workday's general ledger. This keeps us out of being a financial system of record, which is a regulated territory we don't want to enter.

### 9.3 We do not manage the auditee's corrective actions beyond recording them

A Corrective Action Plan is recorded in AIMS. The auditee's implementation happens elsewhere (the university's own PM tools, IT ticketing, compliance platform). We track the plan and verify completion but we don't *run* the corrective action. The line is clear: we're the auditor's tool, not the auditee's project management system.

### 9.4 We do not implement specific regulators' transmission protocols

Filing a Single Audit with the Federal Audit Clearinghouse (FAC) is a transmission step that happens outside AIMS. The auditee's CFO uses FAC's website to submit the audit package (which AIMS generates). Same for SEC filings, state agency submissions, ISO certification body transmissions. We produce the correct artifacts; the filing is an out-of-system activity.

This could be automated (an integration layer that submits directly to FAC, for instance). It isn't in MVP; it's a potential future feature. But the current decision is to produce perfect artifacts and let the customer handle transmission — because transmission is where regulatory liability sharpens and we'd rather not be in the middle.

### 9.5 We do not replicate OSCAL's scope

OSCAL (NIST's Open Security Controls Assessment Language) is a production format for control catalogs, profiles, SSPs, assessment plans, assessment results, and POA&Ms. We adopt OSCAL for `control_framework` packs and interoperate where it makes sense. We don't extend OSCAL to methodology (it doesn't fit) and we don't rebuild control-catalog tooling from scratch (there's no reason to).

### 9.6 We do not build a visual workflow / BPMN designer

Audit workflows exist: finding goes Draft → Review → Approved → Issued → Followed-Up. Engagement goes Planning → Fieldwork → Reporting → Follow-up. Tempting adjacent product: build a drag-and-drop state-machine designer tenants can customize. We don't.

State transitions are declared per methodology pack (in the pack's `workflows` array). Tenants attach packs rather than draw boxes-and-arrows. Reasons: bespoke workflow-engine design is an implementation tar pit (Jira's workflow designer has been an ongoing product burden for Atlassian for over a decade; Salesforce's is comparable; ServiceNow's Flow Designer is a whole sub-product); most workflow customization customers actually want is already satisfied by pack variation; and the audit standards themselves are the source of truth for workflow, not tenant preference. If a tenant wants a genuinely custom workflow, the answer is "author a custom methodology pack" — structured, versioned, reviewable — not "drag boxes in a visual editor."

### 9.7 We do not build a bespoke BI / dashboard authoring tool

Customers will ask for drag-and-drop pivot tables and custom dashboards on their findings data. We don't build that.

BI tooling is its own decades-old product category — Power BI, Tableau, Looker, Metabase, Mode — and competing with them on drag-and-drop UX would burn engineering years for a second-rate result. Our exit from that race is the star-schema warehouse export described in [03 §6.7](03-the-multi-standard-insight.md#67-data-export-bi-and-the-2d-flattening-problem): customers pipe AIMS data to their existing BI stack and build whatever dashboards they want there. We ship five or six opinionated canned dashboards in-app (engagement progress, finding aging, recommendation tracker, CAP compliance, CPE compliance, annual plan vs. actual) — the dashboards every audit function needs — and explicitly disavow custom-dashboard-authoring. Customers who push hard for it get redirected to the BI export + Power BI template files we ship in `references/analytics/`.

---

## 10. Where to go next

Per folder, the most important next read after this tour:

| Folder | Start here |
|---|---|
| `data-model/` | `README.md`, then `standard-pack-schema.ts`, then one example pack (`gagas-2024.ts`) |
| `database/` | `database/ERD.md`, then `database/policies/rls-policies.sql` |
| `api/` | `api/README.md`, then `api/CONVENTIONS.md`, then `api/trpc/routers/engagement.router.ts` |
| `auth/` | `auth/README.md`, then `auth/ARCHITECTURE.md`, then `auth/SECURITY.md` |
| `frontend/` | `frontend/README.md`, then `frontend/ARCHITECTURE.md`, then whichever of STATE-AND-DATA / UI-PATTERNS / DESIGN-SYSTEM matches your work |
| `devops/` | `devops/README.md`, then `devops/INFRASTRUCTURE.md`, then the `implementation/` examples matching your focus area |
| `engineering/` | `engineering/README.md`, then `engineering/TESTING-STRATEGY.md`, then `engineering/CODE-STANDARDS.md` |
| `security/` | `security/README.md`, then `security/SECURITY-PROGRAM.md`, then the framework-specific doc (SOC2.md / ISO27001.md / etc.) that matches your phase |
| `references/` | `references/multi-standard-design.md` and `references/competitor-analysis.md` for context; `references/standards/` for primary-source research |
| `docs/` (this folder) | After the tour: `05-glossary.md` when you encounter unfamiliar terms; `06-design-decisions.md` when you need to know why a specific decision was made; `07-handbook-for-engineers.md` for first-30-days guidance |

You do not need to read every folder. You need to know what's in each folder so you can find things when you need them. This tour has tried to give you that.

---

## 11. A note for different audiences

**If you're an engineer** starting today: the data plane (§3) is the 80/20. Everything else matters but you can catch up later. Read Oakfield's worked example and re-read §3 of this tour until the layer-by-layer flow is internalized. Then read `data-model/standard-pack-schema.ts` and one example pack. That's your foundation.

**Week-1 practical question — where do I actually write the code?** Most tasks in this codebase map to one primary edit point and a small cascade of secondary touch points. The map below covers the common cases:

| Task | Primary edit | Cascade — also update |
|---|---|---|
| Add a new field to an existing methodology pack (e.g., GAGAS adds a new element) | `data-model/examples/gagas-2024.ts` — add to `findingElements` with `semanticElementMappings` entry | Bump pack `version`; add validation rule in `data-model/VALIDATION.md`; seed-data regen; no Prisma migration (JSONB absorbs it) |
| Author a new methodology pack | Copy `data-model/examples/iso-19011-2018.ts` as template; edit for the new methodology | Register in pack loader; add VALIDATION entry; write one example engagement; cross-standard crosswalk in `references/` |
| Add a new tRPC procedure | `api/trpc/routers/<domain>.router.ts` | Input Zod schema in `packages/validation/<domain>.ts`; permission check in `auth/middleware/`; integration test in `api/tests/<domain>/` |
| Add a new page (server-rendered) | `frontend/apps/web/app/<route>/page.tsx` as a Server Component | Any interactive part goes in a child `"use client"` component; i18n strings in `frontend/messages/<locale>/<route>.json`; navigation entry where applicable |
| Add a new background job | `api/workers/<job-name>/` (NestJS) | Register with the outbox dispatcher or `@Cron` schedule; add runbook in `devops/RUNBOOKS.md`; observability hooks |
| Add a new database column | `database/schema.prisma` + `prisma migrate dev` | Update the Prisma Client Extension if new table (tenant-scope injection); new RLS policy if new tenant-scoped table; backfill script if data exists |
| Add a new webhook event type | Declare in `api/webhooks/events.md`; emit from outbox worker | Register event shape in OpenAPI spec; update webhook-receiver test fixtures |
| Add a new permission | `auth/PERMISSIONS.md` (the RBAC + ABAC matrix) | Role-to-permission mapping in `auth/roles.ts`; middleware check in the relevant tRPC procedure |
| Change an encrypted field | Do NOT use `pgcrypto`. Use the ALE helper in `api/lib/encryption/` | Per-tenant DEK rotation plan in `security/ROTATION.md`; decrypt paths in any reporting/export queries |

When in doubt: each folder has a `README.md`; the README is the contract for what lives there. If what you need isn't in any README, you're either in new territory (propose an ADR) or looking in the wrong folder.

**If you're in product or design**: §3 (data plane) + §8 (cross-cutting patterns) are the most useful. The specifics of `devops/` and `security/` matter less for your work; the shape of the data and the UX patterns in `frontend/` matter more.

**If you're doing a security review as a customer**: skip to §4 (identity plane) + §7 (compliance plane). That's where the answers to your security questionnaire mostly live. The trust center (`security/TRUST-CENTER.md`) links to self-service answers for the rest.

**If you're an auditor evaluating whether the platform respects your domain**: §3 (data plane) demonstrates how a finding flows; §4 (identity) shows how multi-user engagement access works; §6 (engineering culture) shows how we keep the product honest. The worked example ([02](02-worked-example-single-audit.md)) is where you verify the domain; this tour is where you verify the architecture respects it.

**If you're an investor or board member**: §1 (the picture) and §7 (compliance plane) are the most relevant. The strategic positioning lives more in [03 — multi-standard insight](03-the-multi-standard-insight.md) and `references/competitor-analysis.md`.

---

## 12. Domain review notes

This doc went through an external domain-expert review (Google Gemini, April 2026) in the same program that reviewed 02 and 03. Round 1 on 04 produced substantive revisions — several were architectural re-decisions, not just wording edits — and are recorded here for transparency about what changed, why, and what other folders still need to be reconciled.

### Round 1 — blocking-severity items (architectural re-decisions)

- **`pgcrypto` replaced by application-layer encryption (ALE).** The initial architecture leaned on Postgres `pgcrypto` for field-level encryption of sensitive tenant data. Gemini correctly flagged that `pgcrypto` requires keys in DB memory space and risks leakage via query logs, `pg_stat_statements`, memory dumps, and replication streams. Fix: all queryable and PII encryption moves to the application service, with AWS KMS-wrapped per-tenant DEKs and envelope encryption in-process; Postgres only ever sees ciphertext for those fields. Deterministic encryption for equality-queryable fields; blind indexes for search-without-reversibility. §5.1 rewritten to state this explicitly. Material architectural change that supersedes the `database/` folder's earlier `pgcrypto` plan — reconciliation to that folder is a follow-up.

- **Tenant isolation — RLS repositioned from primary to defence-in-depth.** The initial §4.3 claimed RLS was the sole tenant-isolation mechanism — "A developer writing a new endpoint cannot forget to tenant-scope: the policy does it unconditionally." Gemini correctly pointed out that Prisma's connection pool multiplexes, and naïve `SET LOCAL app.current_tenant` patterns on pooled connections have well-documented leakage risk. Fix: tenant isolation is now two-layer — app-layer `tenantId` injection via a Prisma Client Extension is the primary enforcement (testable in unit tests), and RLS runs as a belt on top of the suspenders. This matches how Shopify, Linear, and Stripe operate. Rewritten in §3.2, §4.3, §8.1; pooling configuration documented in `database/POOLING.md`.

### Round 1 — should-fix items

- **NestJS + tRPC marriage split.** Gemini noted running NestJS and tRPC together fights NestJS's native DI + Swagger + controller ecosystem. Fix: API layer split by role. Request path is Fastify + tRPC v11 (lean, no heavy DI on the hot path). Worker path is NestJS (document generation, outbox dispatch, scheduled jobs, SCIM sync) — where DI, lifecycle management, and `@Cron` decorators genuinely pay off. Updates in §1 diagram, §2.4, §3.3, §5.

- **End-to-end type-safety overclaim softened.** Initial §3.4 claimed pack-driven finding fields flowed through tRPC type inference end-to-end. Gemini correctly pointed out that runtime-pack-driven shapes cannot be statically inferred — it would require either a massive union of every pack's schema (exploding the type graph) or `Record<string, unknown>` (erasing safety). Fix: §3.4 now distinguishes compile-time structural types (`coreElements`, `standardExtensions` as containers) from runtime-pack-driven field content (validated against the pack's own JSON Schema on both frontend and server). The claim is now accurate.

- **Bitemporal-on-JSONB scaling cliff acknowledged.** Fix: §3.2 now names the cliff explicitly, describes the materialised view approach (`finding_as_of`) we use to keep hot reads fast, and flags that bitemporal queries need dedicated performance attention past ~50k findings per engagement. No pretending it's free.

### Round 1 — missed cascades

- **Transactional Outbox Pattern.** Initial doc implied webhooks fired from tRPC handlers or Prisma middleware — the classic dual-write trap. Fix: §3.3 now specifies outbox-row-in-same-transaction + separate NestJS dispatcher; §8.7 added as a first-class cross-cutting pattern; ties into the NestJS-for-workers decision. Any side effect outside the database flows through this pattern.
- **Document generation as a backend worker-queue.** §6.4 of [03](03-the-multi-standard-insight.md) flagged document generation as a first-class R&D problem. Fix: document generation is now explicit in §2.4, §3.3, §5.1 as a NestJS worker tier, not a UI concern.

### Round 1 — negative-architecture additions

- §9.6 added: no visual workflow / BPMN designer (state machines declared in pack, not drawn in an editor).
- §9.7 added: no bespoke BI / dashboard-authoring tool (five canned dashboards in-app; everything custom goes out via the star-schema warehouse export to Power BI / Tableau / Looker).

### Round 1 — audience-fit improvements

- §11 now has a practical "where do I actually write the code?" map for the Week-1 engineer — primary edit point and cascade for the nine most common task types.

### Reconciliation with older folder content — completed 2026-04-20

The architectural re-decisions above superseded earlier content in the `database/`, `auth/`, `api/`, `security/`, and `devops/` folders. That content has been reconciled:

- **database/README.md, DATA-RESIDENCY.md, schema.prisma** — pgcrypto references replaced with ALE via KMS-wrapped DEKs; tenant-isolation narrative now describes the two-layer model; schema.prisma excludes pgcrypto from extensions
- **database/POOLING.md** (new) — six-rule connection-pool discipline per ADR-0002
- **auth/SESSION-MANAGEMENT.md §6** — revocation rewritten to the `blocklist_checkable` claim model per ADR-0005
- **auth/REVOCATION-POLICY.md** (new) — matrix of roles/scenarios that trigger `blocklist_checkable: true`
- **api/README.md, ARCHITECTURE.md** — two-tier split (Fastify request + NestJS worker); SQS everywhere (no BullMQ/Redis for queues); URL-major + dated-header-minor API versioning
- **security/README.md** — cross-references updated for ADRs 0001/0002/0005/0006
- **security/ROTATION.md** (new) — per-tenant DEK rotation runbook, 90-day schedule
- **security/DATA-RESIDENCY.md** (new) — regional-silo architecture with GDPR/FedRAMP compliance narrative
- **devops/README.md** — tech stack + architecture diagram updated (SQS + EventBridge Scheduler; NestJS workers replacing BullMQ); regional silos per ADR-0006
- **devops/QUEUE-CONVENTIONS.md** (new) — SQS naming, FIFO-vs-standard guidance, retry/DLQ/visibility-timeout rules, EventBridge Scheduler patterns

Five new docs created (POOLING.md, REVOCATION-POLICY.md, ROTATION.md, security/DATA-RESIDENCY.md, QUEUE-CONVENTIONS.md); seven existing docs updated. This doc is no longer ahead of the folder content; if a future reader finds older content that still contradicts the ADRs, file a PR.

### Round 2 — review loop closed

The R1 revisions above went back to the same reviewer for a second pass in April 2026. R2 returned no new action items and explicitly endorsed the four substantive pivots: the Fastify / NestJS split ("highly pragmatic"), the encryption + isolation adjustments ("pivot…resolves the most critical blocking flaw"; "mature understanding of connection pool realities"), the Outbox pattern as a first-class cross-cutting concern ("crystal clear and will save your Week-1 engineers from reinventing dual-write bugs"), and the negative-architecture disavowals ("prevents endless feature creep"). The §11 code map was called out as the change that "transforms the document from purely theoretical to immediately actionable." No further fixes requested; the review loop on 04 is considered closed at 2026-04-20.

---

*Last reviewed: 2026-04-20.*
