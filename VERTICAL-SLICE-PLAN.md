# AIMS v2 — Vertical Slice Plan (Slice A: Engagement → Finding → PDF)

**Status**: Draft · 2026-04-22
**Purpose**: The first code-not-specs artifact. One narrow, end-to-end user journey implemented across every load-bearing architectural layer, proving the 48-file spec set composes into a working system.

This is not an MVP, not a product, not a demo suitable for prospects. It is a **risk-burn-down exercise**: if the spec tier is wrong anywhere load-bearing, this slice surfaces it before a team is hired and committed.

---

## 1. Slice definition

### 1.1 User journey (the single happy path)

A solo pair of users — Jenna (Senior Auditor) and David (Supervisor) — take one finding from blank to signed PDF in one session.

1. Jenna signs in at `localhost:3000`. Password + TOTP enrollment on first login.
2. Creates a new engagement: *FY26 Q1 Revenue Cycle Audit*, auditee *NorthStar Corp*, period *2026-04-01 → 2026-06-30*, lead *Jenna*, planned hours *400*.
3. Lands on engagement dashboard. Opens **Packs** tab → attaches **GAGAS-2024.1** (the only available pack in the seed).
4. Resolver preview shows effective requirements: four-element finding required (§6.39), classification tiers enumerated, supervisor signoff required.
5. Opens **Findings** tab → *New finding*. Types title *"Weak segregation of duties in AP approval"*, picks classification *Significant*.
6. Authors all four GAGAS §6.39 elements (Criteria / Condition / Cause / Effect) in the four-element editor. Progress bar fills 4/4. Each element ≥ 50 chars.
7. Submits for review → finding state `IN_REVIEW` → David notified (in-app only).
8. *(User switches to David.)* David signs in with MFA. Opens review queue → Jenna's finding.
9. David clicks **Approve**. MFA step-up challenge (TOTP fresh within 15 min). Finding state → `APPROVED`.
10. Jenna switches back → **Reports** tab → *Generate report* → picks *Engagement Report* template.
11. Report auto-populates data-bound sections (findings list, pack disclosure, scope). Jenna writes a 3-paragraph executive summary in the editorial section.
12. Submits for signoff → David's signoff queue.
13. David opens report in preview, clicks **Sign & publish**. MFA step-up + typed attestation ("I approve"). Report state → `PUBLISHED`.
14. Outbox event fires: NestJS worker picks up, renders PDF server-side (headless Chromium), writes content hash + audit-log anchor to PDF footer, archives to S3 (LocalStack).
15. Jenna opens report detail → clicks *Download PDF*. Gets signed PDF.
16. Jenna opens **Audit log** scoped to this engagement → sees the full chain of actions with hashes.

### 1.2 Acceptance criteria (Definition of Done)

A Playwright test script drives the above journey end-to-end and passes. Specifically:

- ✅ Fresh Docker compose starts → seed loads → `localhost:3000` serves login
- ✅ Both users complete journey in under 10 minutes of walltime
- ✅ `grep -rn pgcrypto` on the slice codebase returns 0 matches (except in comments referencing why it was rejected)
- ✅ Integration test `tenant-isolation.spec.ts` confirms two seeded tenants cannot query each other's findings via any path (Prisma direct, raw SQL with app role, or API)
- ✅ `audit-log verify` script reports hash chain intact after journey
- ✅ Exported PDF footer contains `sha256:...` content hash matching the corresponding `AuditLog.contentHash` row
- ✅ OpenTelemetry collector shows a single continuous trace from browser → Fastify → Prisma → Postgres → outbox → SQS → NestJS worker → PDF S3 write
- ✅ Finding's `elementValues` JSONB stored encrypted at rest (confirmed via direct DB inspection with app role returning ciphertext)
- ✅ Lighthouse score ≥ 85 on all 13 slice screens (modest but non-trivial)
- ✅ p95 `engagement.create` < 250ms, p95 `finding.submit` < 350ms, p95 PDF render end-to-end < 8s

### 1.3 What is explicitly OUT of this slice

Non-goals. Do not build, do not stub beyond minimal, do not worry about:

| Deferred | Which slice it belongs to |
|---|---|
| Multi-region, EU/GovCloud silos | Infra slice (separate) |
| SSO (Okta/Azure/Google) | Slice 2 (or admin polish slice) |
| Billing + Stripe | Late slice |
| Multi-standard (IIA/COSO/ISO/SOX) | Slice B |
| Pack annotations (authoring, override, resolver conflicts) | Slice B |
| PRCM matrix | Slice — probably part of B or C |
| APM 14-section authoring | Later slice |
| CAP tracking + milestones + SLA clock | Slice D |
| Recommendations (structured, separate from finding body) | Slice D |
| PBC + auditee portal + magic link | Slice C |
| Fieldwork grid, work papers, observations, evidence uploads | Later |
| QA checklist, peer review prep | Later |
| CPE dashboard, independence declarations | Later |
| Staff directory, time tracking | Later |
| Notifications (email/SMS/webhook — in-app only in slice) | Later |
| Integrations + public API surface | Later |
| Real-time collab (Yjs / pessimistic section locking) | Later |
| Mobile / tablet layouts | Later |
| Admin console (user invite, role mgmt, SSO config) | Later |
| Tenant onboarding wizard | Later |

---

## 2. Architectural layers touched

Every load-bearing ADR is exercised. This is the table to point at when asked "why A and not B or C."

| Layer | Spec / ADR | Exercised by |
|---|---|---|
| Fastify hot path / NestJS worker split | ADR-0003, ADR-0004 | All API calls (Fastify), PDF render + audit hash append (worker) |
| Two-layer tenant isolation | ADR-0002 | Prisma Client Extension + RLS active on every query |
| Application-Layer Encryption | ADR-0001 | Finding `elementValues` JSONB encrypted with tenant DEK |
| Regional silo pattern | ADR-0006 | *Single silo for slice* — pattern observed but not multi-region |
| Session revocation blocklist | ADR-0005 | Revoke session mid-journey → kicked within 15s |
| Transactional outbox + SQS | ADR-0004 | `report.published` event → SQS → worker |
| Bitemporal finding | Data-model docs | `validFrom/validTo` + transaction time columns populated correctly |
| Hash-chained audit log | `audit-trail-and-compliance.md` | Every mutation appends; verify script passes |
| Pack resolver | `pack-attachment.md` | One pack, zero annotations, resolver still runs |
| Hybrid API versioning | API conventions | Requests hit `/v1/...` with `Api-Version: 2026-04-22` header |
| MFA step-up for destructive actions | `identity-auth-sso.md` | Finding approve + report sign both gated |
| OpenTelemetry vendor-neutral | devops/OBSERVABILITY.md | Continuous trace browser → DB → worker |

Layers intentionally **not** exercised in slice: SSO/SAML, SCIM, Yjs CRDT, magic link auth, webhooks, S3 flat-file exports, regional failover, Drata/Vanta evidence collection hooks.

---

## 3. Minimum spec subset

### 3.1 Database tables (13 of 30+)

Pull from `database/schema.prisma`, omit the rest. The slice needs:

- `tenant` — 2 rows seeded
- `user` — 4 rows (Jenna + David per tenant)
- `session` — rolling
- `session_blocklist` — empty until revocation test
- `mfa_secret` — one per user after enrollment
- `engagement` — created during journey
- `pack` + `pack_version` — GAGAS-2024.1 seeded from `data-model/examples/gagas-2024.ts`
- `pack_attachment` — engagement × pack join
- `finding` — with bitemporal columns + encrypted `element_values` JSONB
- `approval_request` — powers finding approval + report signoff
- `report` + `report_version` + `report_section`
- `outbox_event`
- `audit_log` — hash-chained

Omit for slice: `recommendation`, `cap`, `cap_milestone`, `pbc_list`, `pbc_item`, `evidence`, `work_paper`, `work_program`, `observation`, `apm`, `apm_section`, `prcm_process`, `prcm_risk`, `prcm_control`, `prcm_test`, `annotation`, `cpe_entry`, `independence_declaration`, `qa_review`, `peer_review`, `notification`, `integration`, `api_key`, `webhook_endpoint`, `platform_admin_session`.

### 3.2 API procedures (~20 of ~45 tRPC namespaces)

Minimum slice surface:

```
auth.*            → signIn, mfaEnrollBegin, mfaEnrollVerify, mfaChallenge, signOut, refresh
session.*         → list, revoke
me.*              → get (current user + tenant context)
engagement.*      → create, get, list
pack.*            → list, attach, resolve
finding.*         → create, get, list, updateElement, submitForReview, approve
report.*          → create, get, regenerateDataSections, updateEditorial, submitForSignoff, sign, downloadPdf
auditLog.*        → list (scoped)
```

All other namespaces (`annotation.*`, `cap.*`, `pbc.*`, `apm.*`, `prcm.*`, `cpe.*`, `independence.*`, `qa.*`, `notification.*`, `integration.*`, `platformAdmin.*`, `boardDashboard.*`, `webhook.*`, etc.) — not implemented.

### 3.3 UI screens (13 screens from the 100+ speced)

Pull from `product/ux/` specs; implement only these:

1. `/signin` — [`identity-auth-sso.md §3`](product/ux/identity-auth-sso.md)
2. `/mfa` — enrollment + challenge — [`identity-auth-sso.md §4,§5`](product/ux/identity-auth-sso.md)
3. `/` — auditor dashboard (minimal, just "action required" list) — [`dashboards-and-search.md §3.1`](product/ux/dashboards-and-search.md)
4. `/engagements` — list — [`engagement-management.md`](product/ux/engagement-management.md)
5. `/engagements/new` — creation form — [`engagement-management.md §4.2`](product/ux/engagement-management.md)
6. `/engagements/:id` — dashboard with tabs — [`engagement-management.md §4.3`](product/ux/engagement-management.md)
7. `/engagements/:id/packs` — pack picker + resolver output (single-pack case) — [`pack-attachment.md §3,§4`](product/ux/pack-attachment.md)
8. `/engagements/:id/findings` — list
9. `/engagements/:id/findings/new` — quick capture — [`finding-authoring.md §3`](product/ux/finding-authoring.md)
10. `/engagements/:id/findings/:id` — four-element editor — [`finding-authoring.md §4`](product/ux/finding-authoring.md)
11. `/approvals` — review queue (for David) — [`finding-authoring.md §5`](product/ux/finding-authoring.md)
12. `/engagements/:id/reports/:id` — composer — [`report-generation.md §3`](product/ux/report-generation.md)
13. `/audit-log` — viewer (tenant-scoped) — [`audit-trail-and-compliance.md §3`](product/ux/audit-trail-and-compliance.md)

Implementation: full WCAG 2.1 AA baseline (per `frontend/ACCESSIBILITY.md`). Mobile layouts deferred. Keyboard shortcuts optional (implement only `/` for focus search and `⌘+S` for save in editor).

### 3.4 Workflows (2 state machines)

Finding:
```
DRAFT → IN_REVIEW → APPROVED (→ PUBLISHED when cited report publishes)
       ↘ returns to DRAFT on "request revision"
```

Report:
```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
```

All transitions append to audit log. Signoff transitions gated by MFA step-up.

---

## 4. Implementation plan (4-6 weeks, one engineer)

Honest estimate: 4 weeks for an engineer who already knows Next.js 15 / Fastify / Prisma / tRPC / NestJS; 6 weeks if learning the stack. Below is ordered by dependency, not by parallelism — some work can overlap with a pair.

### Week 1 — Substrate

Goal: the database, encryption, and tenant isolation primitives work in isolation. No UI yet.

- **1.1 Monorepo bootstrap.** Turborepo + pnpm workspaces. `apps/web` (Next.js 15), `apps/api` (Fastify), `apps/worker` (NestJS), `packages/prisma-client`, `packages/encryption`, `packages/validation`. Strict TypeScript everywhere. ESLint flat config from `engineering/implementation/eslint.config.js`.
- **1.2 Docker compose.** Postgres 16, LocalStack (SQS + KMS), mailpit (SMTP for future). Health-check script.
- **1.3 Prisma schema.** The 13 tables from §3.1, with bitemporal + hash-chain triggers. Adapt from `database/schema.prisma` — slim down by commenting out non-slice models.
- **1.4 Prisma Client Extension.** `packages/prisma-client` — inject tenant scope on every query. Per ADR-0002 `database/POOLING.md`. Unit test: query without tenant context throws.
- **1.5 RLS policies.** `database/policies/rls-policies.sql` applied. Defence-in-depth only — smoke test with app role directly.
- **1.6 ALE module.** `packages/encryption` — KMS-wrapped per-tenant DEKs (LocalStack KMS). `encrypt(tenantId, plaintext)` / `decrypt(tenantId, ciphertext)`. Deterministic variant for searchable equality.
- **1.7 Audit log trigger + hash chain function.** Pure SQL, Postgres PL/pgSQL. Verify script in `scripts/verify-audit-chain.ts`.
- **1.8 Seed script.** 2 tenants, 4 users, GAGAS-2024.1 pack imported from the example TS file.

**Exit criteria W1**: `pnpm dev` brings Postgres up, seed runs, a smoke-test script can create an engagement and query it via Prisma with tenant isolation working.

### Week 2 — Auth + API skeleton

Goal: a human can log in; auth middleware protects tRPC; CRUD works for engagement + pack attach.

- **2.1 Auth foundation.** Better Auth (per `auth/ARCHITECTURE.md`). Password + TOTP. EdDSA JWT (15 min) + opaque refresh. Session table.
- **2.2 MFA flows.** Enrollment (QR code for TOTP), challenge, step-up (`MFA fresh within 15 min` check). Backup codes.
- **2.3 Session blocklist.** `blocklist_checkable=true` on sessions; Redis cache of blocklist IDs. Per ADR-0005.
- **2.4 tRPC on Fastify.** Router skeleton. Context carries `tenantId + userId + sessionId`. Middleware enforces auth on all non-public routes; step-up middleware on sensitive routes.
- **2.5 Engagement procedures.** `engagement.create / get / list`. Zod schemas in `packages/validation`.
- **2.6 Pack procedures.** `pack.list` (reads seeded pack), `pack.attach` (writes `pack_attachment` row), `pack.resolve` (runs resolver — single pack case trivial but code shape set up for N packs).
- **2.7 Next.js shell.** App Router layout, Tailwind v4, Shadcn/ui. Providers for tRPC + Auth. Sign-in screen.
- **2.8 Auth flow wired end-to-end.** Sign in → get session cookie → protected route works → sign out → redirect.

**Exit criteria W2**: Jenna can log in, enroll MFA, create an engagement, and attach GAGAS-2024.1. The engagement is visible only to her tenant.

### Week 3 — Core workflow (findings)

Goal: the finding editor + review queue works; MFA step-up gates approvals.

- **3.1 Pack resolver.** `packages/pack-resolver`. For single pack + zero annotations, it's a straightforward "read pack JSON → return effective values." Code shape (strictness direction, equivalence strength, annotation overlay) is stubbed but not exercised. Unit tests for the load-bearing paths.
- **3.2 Finding procedures.** `finding.create / get / list / updateElement / submitForReview / approve`. `element_values` JSONB encrypted via ALE helper. Bitemporal columns populated on every mutation. Finding state machine enforced server-side.
- **3.3 Finding editor UI.** Four TipTap instances (one per element). Four-element progress bar. Autosave every 10s. Submit-for-review disabled until 4/4 complete.
- **3.4 Review queue UI.** `/approvals` page. David's pending items. Open finding in review mode (read-only + approve/return buttons).
- **3.5 MFA step-up middleware.** Server-side check on `finding.approve`: if session's `mfa_fresh_until` < now, return `STEP_UP_REQUIRED` error. Client intercepts, shows TOTP prompt, retries.
- **3.6 Approval workflow.** Minimal: `approval_request` row on submit, state transitions, audit log entries. No routing config — hard-coded single-approver for slice.

**Exit criteria W3**: Jenna drafts finding, submits. David logs in, reviews, approves with MFA. Audit log shows 6+ entries with correct hashes.

### Week 4 — Report + signoff + PDF + verification

Goal: report composer works, signoff renders PDF, audit log viewer shows the journey.

- **4.1 Report procedures.** `report.create / get / regenerateDataSections / updateEditorial / submitForSignoff / sign`. Data-bound sections populated from current findings state; editorial sections preserved verbatim.
- **4.2 Report composer UI.** Outline + preview. Editorial sections editable inline. Data-bound sections read-only with "Regenerate" action.
- **4.3 Report signoff ceremony.** MFA step-up + typed attestation ("I approve"). Per `report-generation.md §6.2`. On success, state → `PUBLISHED`.
- **4.4 Outbox + worker.** `report.published` event written atomically with state transition. NestJS worker polls SQS, processes event.
- **4.5 Worker: PDF render.** Worker uses Puppeteer or pdfmake to render. Content hash computed. Audit log entry appended (from worker, running under same tenant context via session token). PDF archived to LocalStack S3.
- **4.6 Download endpoint.** `report.downloadPdf` returns presigned URL (5-min TTL) pointing at S3 object.
- **4.7 Audit log viewer UI.** `/audit-log` scoped to tenant + optional engagement filter. Entries render with "Verify" action hitting the verify script's logic.
- **4.8 OTel wiring.** Traces crossing browser → Fastify → Prisma → Postgres (via OTel Postgres plugin) → outbox row → SQS message (propagate `traceparent` in attributes) → NestJS worker → S3 write. OTel Collector → console exporter for slice (Grafana deferred).

**Exit criteria W4**: Full journey passes in Playwright. PDF downloads, has correct hash footer. Audit log viewer shows chain intact.

### Week 5-6 — Buffer / polish

Reality: any realistic estimate should carry 25-50% buffer for the things that always turn out harder than they look. Historically in AIMS v1: RLS + connection pooling interactions, bitemporal query edge cases, TOTP clock drift, PDF rendering reproducibility.

Use weeks 5-6 for:
- Filling gaps from the DoD checklist
- Performance tuning to hit p95 targets
- Integration tests (tenant isolation cross-checks, revocation kick)
- Documentation of what was learned vs. what the spec said (the spec delta log)

If the slice was cleaner than expected, use the time to pull in one deferred item — my recommendation would be **session revocation tested end-to-end** (ADR-0005) since it's a common first-production bite.

---

## 5. Reconciliation with existing `phases/` files

The `phases/` directory predates the Tier 1 design work and the 7 ADRs. Treating it as implementation guidance as-is is a trap — several task files conflict with later decisions.

| `phases/` file | Slice A status |
|---|---|
| `1.1-project-setup.md` | **Reuse with edits** — still 80% right for monorepo bootstrap. Needs update: split API into Fastify (hot path) + NestJS (worker) per ADR-0003. Currently says all-NestJS. |
| `1.2-database-schema.md` | **Verify** — check it reflects ADR-0001 (no pgcrypto) and ADR-0002 (two-layer isolation). Likely predates both. |
| `1.3-auth-system.md` | **Superseded** — `auth/` folder now has 10 files of comprehensive auth design. Treat that as canonical. |
| `1.4-ui-shell.md` | **Superseded** — `frontend/` folder is canonical; `product/ux/` UX specs drive screen-level work. |
| `1.5-multi-tenancy.md` | **Superseded** — ADR-0002 + `database/POOLING.md` are canonical. |
| `1.6-file-storage.md` | **Defer** — not in slice (no WPs, no evidence uploads). |
| `2.1-standards-abstraction.md` | **Relevant but over-scoped** — slice only needs single-pack resolver. |
| `2.2-engagements.md` | **Subset** — only `create / get / list`. Skip team assignment, phase transitions, budget. |
| `2.3-planning.md` | **Defer** — no APM, no PRCM in slice. |
| `2.4-fieldwork.md` | **Defer** — no fieldwork in slice. |
| `2.5-findings.md` | **Subset** — core finding CRUD + approval only. Skip recommendations, observations. |
| `2.6-workflows.md` | **Subset** — finding approve + report sign only. Skip configurable routing. |
| `2.7-workpapers.md` | **Defer** — no WPs in slice. |
| All Phase 3+ files | **Defer entirely** |

**Action for the slice**: spend half a day doing a reconciliation pass — mark each phase-file header with "SUPERSEDED BY <x>" or "SLICE A USES §<y> ONLY" so a future engineer opening them gets correct guidance. Cheap, prevents confusion.

---

## 6. Environment & infra (dev-laptop assumption)

### 6.1 Local stack

```yaml
# infra/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]
  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: sqs,kms,s3
    ports: ["4566:4566"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
  mailpit:
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]
```

### 6.2 What's NOT in scope for slice infra

- No EKS / Kubernetes
- No Terraform apply to real AWS
- No real ArgoCD pipeline (GitHub Actions CI OK; no CD)
- No real observability backend (OTel console exporter only; Grafana/Tempo deferred)
- No CloudFront / domain / TLS certs
- No multi-region / silos

All of the above is the subject of a potential *Slice 0: Infra Stand-Up* that could run in parallel, but shouldn't block this slice from validating that the code works.

### 6.3 What IS in scope

- `pnpm dev` brings everything up
- Fresh checkout → first `pnpm dev` → working app in under 10 minutes
- Seed data repeatable (`pnpm seed` recreates from scratch)
- Playwright headless test runs in CI on PRs

---

## 7. Test plan

### 7.1 Unit tests (Vitest)
- Pack resolver — single pack case, and a fabricated two-pack case to prove shape works
- ALE encrypt/decrypt round-trip per tenant
- Finding state machine transitions (valid + invalid)
- Bitemporal query — "finding as of 2026-04-20" returns prior value after re-submit

### 7.2 Integration tests (Vitest + Testcontainers)
- Tenant isolation cross-check (the single most important integration test in this slice)
- Hash chain verification — mutate a row directly in DB, verify script detects tampering
- Outbox → SQS → worker → S3 flow (end-to-end with LocalStack)
- Session revocation — issue token, revoke, confirm API rejects within 15s

### 7.3 E2E tests (Playwright)
- `slice-a-happy-path.spec.ts` — the full §1.1 journey
- `mfa-step-up.spec.ts` — attempt finding approve without fresh MFA → prompted
- `tenant-isolation-ui.spec.ts` — Jenna-tenant-1 cannot see findings created by Jenna-tenant-2 via URL guessing

### 7.4 Performance smoke (k6, not gate)
- 10 req/s baseline load; p95 targets from §1.2

---

## 8. Risks & known unknowns

| Risk | Likelihood | Mitigation |
|---|---|---|
| RLS + Prisma Client Extension interaction subtleties (pool multiplexing, `SET LOCAL` timing) | High | `database/POOLING.md` already flags this. Add integration test early in W1. |
| Bitemporal indexing — wrong index set kills query performance | Medium | Hand-build the `(id, as_of_timestamp)` materialized view as speced in `docs/04-architecture-tour.md` at W3. |
| PDF render reproducibility — headless Chromium output varies across versions | Medium | Pin Chromium version; embed fonts; hash is of logical content not binary PDF. |
| TOTP clock drift breaking tests | Low | Allow ±30s skew in TOTP validator. Known footgun in CI. |
| Outbox + SQS complexity underestimated | Medium | Defer to end of W4; if blocks, fall back to synchronous PDF render + hash (slice still passes DoD minus OTel-across-boundaries check). |
| Spec describes something that doesn't cleanly build | Medium-High | **Expected**. Maintain a `SPEC-DELTA-LOG.md` through the slice recording every place the spec needed adjustment. This is the highest-value output of the slice for future slices. |
| Scope creep — "we should also do CAPs since we're here" | High | This document is the hedge. Re-read §1.3 "Out" list before every scope decision. |

---

## 9. What success looks like

After 4-6 weeks:

1. One working, demoable, Playwright-tested vertical slice running on any developer's laptop.
2. A `SPEC-DELTA-LOG.md` listing every spec-vs-reality gap discovered, with resolutions. This is more valuable than the code.
3. A concrete labor estimate for the remaining 10+ slices to reach MVP 1.0 — now based on real build data, not on estimation theater.
4. Confident answer to "are the specs actually buildable?" Either "yes, here's proof" or "mostly, but X needs re-thinking before scaling."
5. A foundation the next 2-3 slices (B, C, D) can build on without re-doing substrate work.

**What the slice does NOT give you**: a demo for prospects, a product in any commercially meaningful sense, evidence of market fit, a scalable team velocity. Those come from MVP 1.0, which is ~10-12 slices past this one.

---

## 10. Decision points before starting

Please confirm or redirect on each:

1. **Environment**: Docker compose on dev laptop, not real AWS. ✅ / ❌
2. **Scope**: exactly the §1.1 journey, everything in §1.3 deferred. ✅ / ❌
3. **Timeline**: 4-6 weeks of focused build, solo engineer. ✅ / ❌
4. **Team**: you hire one engineer, or engage a contractor, or both. — open
5. **Repo**: aims-v2-platform extracted to its own git repo first, then slice work starts in that repo. ✅ / ❌
6. **Infra follow-on**: after slice A passes, the next work item is either *Slice A → EKS promotion* (validates infra specs) or *Slice B (pack differentiator)* (validates multi-standard). Pick order. — open

---

## 11. Open items / future slices (not in scope for Slice A)

For memory, so they're captured somewhere:

- **Slice B — Pack differentiator** (2-3 weeks): multi-pack attach, resolver conflicts, annotation authoring + approval, "Why?" popover. Rides on Slice A's substrate.
- **Slice C — Auditee portal** (2-3 weeks): PBC list authoring, magic link auth, auditee-scoped UI, evidence upload with ALE, review queue. Rides on Slice A's substrate.
- **Slice D — CAP tracking** (2 weeks): recommendations as structured objects, CAP lifecycle, milestones, SLA clock with EVIDENCE_UNDER_REVIEW pause.
- **Slice 0 — Infra** (2-3 weeks, parallelizable): Terraform apply to dev AWS account, EKS up, OpenTofu modules reviewed, first Argo Rollout canary. Can run alongside Slice A.
- **Slice — SSO + admin console** (2 weeks): Okta SAML, SCIM, tenant onboarding checklist, user/role admin.
- **Slice — Fieldwork + WPs** (3 weeks): the fieldwork grid, work paper editor, evidence management.
- **Slice — QA / CPE / Independence** (2 weeks): the compliance-hygiene surfaces.
- **Slice — APM 14-section** (3 weeks): the big authoring artifact.
- **Slice — PRCM matrix** (2-3 weeks): process-risk-control grid with coverage sidebar.
- **Slice — Reports polish** (2 weeks): all 12 report templates, regen workflows, version chains.

Rough total: MVP 1.0 is somewhere in the 30-40 focused-build-weeks range *after* Slice A. That's the real labor estimate the slice exists to validate.

---

## 12. References

**Specs drawn on for this slice**:
- [`product/ux/engagement-management.md`](product/ux/engagement-management.md)
- [`product/ux/pack-attachment.md`](product/ux/pack-attachment.md) §3 single-pack picker, §4 resolver output
- [`product/ux/finding-authoring.md`](product/ux/finding-authoring.md) §3-5
- [`product/ux/report-generation.md`](product/ux/report-generation.md) §3-6
- [`product/ux/identity-auth-sso.md`](product/ux/identity-auth-sso.md) §3-5
- [`product/ux/audit-trail-and-compliance.md`](product/ux/audit-trail-and-compliance.md) §3-5
- [`product/api-catalog.md`](product/api-catalog.md) — procedure signatures

**ADRs exercised**:
- [`references/adr/0001-ale-replaces-pgcrypto.md`](references/adr/0001-ale-replaces-pgcrypto.md)
- [`references/adr/0002-tenant-isolation-two-layer.md`](references/adr/0002-tenant-isolation-two-layer.md)
- [`references/adr/0003-nestjs-scoped-to-workers.md`](references/adr/0003-nestjs-scoped-to-workers.md)
- [`references/adr/0004-sqs-for-worker-queuing.md`](references/adr/0004-sqs-for-worker-queuing.md)
- [`references/adr/0005-session-revocation-hybrid.md`](references/adr/0005-session-revocation-hybrid.md)

**Engineering standards**:
- [`engineering/QUALITY-GATES.md`](engineering/QUALITY-GATES.md) — DoD (apply proportionally per §5 of handbook)
- [`engineering/TESTING-STRATEGY.md`](engineering/TESTING-STRATEGY.md)
- [`engineering/implementation/eslint.config.js`](engineering/implementation/eslint.config.js)

**Audit validation** (the basis for confidence that this slice's spec subset is coherent):
- [`audits/01-domain-and-regulatory-integrity.md`](audits/01-domain-and-regulatory-integrity.md)
- [`audits/02-architectural-consistency.md`](audits/02-architectural-consistency.md)
- [`audits/03-data-plane-and-schema-viability.md`](audits/03-data-plane-and-schema-viability.md)
- [`audits/04-operational-reality.md`](audits/04-operational-reality.md)
- [`audits/05-code-standards-and-dev-experience.md`](audits/05-code-standards-and-dev-experience.md)

---

*Last updated: 2026-04-22. Draft pending user confirmation of §10 decision points.*
