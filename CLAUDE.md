# CLAUDE.md — AIMS v2 Platform

Onboarding doc for any Claude Code session (or new engineer) opening this repo. Read top-to-bottom once; bookmark §4 for day-to-day.

---

## 1. What this repo is

**AIMS v2** — a multi-standard, enterprise SaaS audit information management platform. Greenfield spec work extending AIMS v1 (a GAGAS-only SharePoint SPFx app, lives in a separate repo at `aaryapaar.sharepoint.com/sites/smb`) into an independent, multi-tenant, multi-standard SaaS.

**What's in the repo today (2026-05-01)**: the 48-file spec tier plus a working Slice A monorepo through end of Week 5 — substrate, auth, tRPC API, Next.js shell, full finding-and-report loop with MFA-gated approval, NestJS worker rendering signed PDFs to S3, presigned download, audit log viewer + chain verification, end-to-end OTel trace propagation, Playwright e2e (slice-A journey + session revocation), cross-tenant isolation sweep, ADR-0002 `DATABASE_URL` split landed, and a perf pass that trimmed redundant round-trips on the report router. Phases reconciliation is the remaining slice-A deliverable.

---

## 2. Project status at a glance

- ✅ **Tier 1 — Foundations**: 10 design tracks complete (product, API, auth, database, devops, engineering, frontend, security, data-model, docs)
- ✅ **Phase 1-6 product specification**: all closed with external Gemini R1 reviews. 48 files, ~39,000 lines.
- ✅ **5-phase analytical audit by Gemini**: all PASSED (see `audits/`). "The repository is fully validated and ready for Tier 2: Technical Construction."
- 🚧 **Tier 2 — Vertical Slice A** (closing out): full vertical slice plus W5 polish/soak shipped — engagement → finding → submit → MFA-gated approve → report → sign → outbox → worker → PDF → S3 → presigned download, audit-log viewer, end-to-end OTel propagation, Playwright e2e for the journey + session revocation, cross-tenant isolation sweep across W3+W4 procedures, ADR-0002 two-URL Postgres split, and a perf pass on the hottest report-router path. **105 integration tests passing** (85 api, 20 worker) + 2 e2e specs green.
  - W1 substrate ✅, W2 auth + API skeleton ✅, W3 finding loop ✅, W4 reports + PDF + OTel ✅, W5 polish/soak ✅ (e2e, isolation sweep, DB-URL split, perf, ADR-0008/0009 acceptance)
  - W6 remaining: phases reconciliation (annotate stale `phases/` files per CLAUDE.md §3)
  - Spec drift catalogued + closed-out in [`SPEC-DELTA-LOG.md`](SPEC-DELTA-LOG.md) (six entries, all carry into Slice B)

---

## 3. The single most important thing to understand

This repo has **two overlapping planning structures** that mean different things. Do not confuse them.

| Structure | What it is | Status |
|---|---|---|
| `product/` (Phases 1-6) | Product & UX specifications — what the system does | ✅ Canonical |
| `phases/` (phase-1 to phase-7) | An older horizontal build roadmap — how to build it in 36 weeks | ⚠️ Partially stale |

**`phases/` predates the Tier 1 design work and the 7 ADRs.** Specific task files conflict with later decisions (e.g., `phase-1-foundation/1.1-project-setup.md` still says "all NestJS" but ADR-0003 moved the hot path to Fastify). A reconciliation pass is owed — see `VERTICAL-SLICE-PLAN.md §5` for the file-by-file status.

**If you are Claude about to execute a task**: when in doubt, trust `product/` + `auth/` + `frontend/` + `database/` + `engineering/` + the ADRs over `phases/`. The ADRs are the canonical record of any architectural decision.

---

## 4. Where everything lives

```
aims-v2-platform/
├── MASTER-PLAN.md          # 36-week product roadmap (partially superseded by ADRs)
├── VERTICAL-SLICE-PLAN.md  # Tier 2 kickoff — Slice A (active work)
├── TECH-STACK.md           # Canonical tech choices
├── SAAS-READINESS.md
├── VERIFICATION-REPORT.md
│
├── product/                # Product & UX specs (Phases 1-6, all closed)
│   ├── 01-product-vision.md ... 05-roadmap.md
│   ├── api-catalog.md      # ~1,800 lines — every tRPC + REST endpoint
│   ├── features/           # 18 feature specs (Phase 4 Parts 1+2)
│   ├── ux/                 # 18 UX flow specs (Phase 6)
│   └── rules/              # 6 cross-cutting rule packs (Phase 3)
│
├── data-model/             # Standard pack schema + example packs
│   ├── standard-pack-schema.ts  # 20 interfaces, canonical
│   ├── examples/           # GAGAS-2024, IIA-GIAS-2024, ISO-19011-2018, SOC2-2017, single-audit-overlay-2024
│   └── tenant-data-model.ts
│
├── database/               # PostgreSQL + Prisma design
│   ├── schema.prisma       # 30+ tables, 3 schemas
│   ├── policies/           # RLS + role SQL
│   ├── functions/          # Audit log triggers, immutability checks
│   └── POOLING.md          # Critical: PgBouncer + SET LOCAL caveats
│
├── auth/                   # Identity & auth design (10 files)
│   ├── ARCHITECTURE.md     # Better Auth + EdDSA JWT + TOTP + WebAuthn + SAML + OIDC + SCIM
│   ├── REVOCATION-POLICY.md  # Per ADR-0005 hybrid blocklist
│   └── flows/              # 21 sequence diagrams
│
├── api/                    # tRPC + REST + webhooks design
├── frontend/               # Next.js 15 + Shadcn + design system
├── devops/                 # AWS + EKS + OpenTelemetry + DR
├── engineering/            # TS strict, testing, quality gates, DoD
├── security/               # SOC 2 + ISO 27001 + privacy + Drata/Vanta integration
├── docs/                   # Narrative onboarding (8 docs + worked example)
│
├── audits/                 # Gemini 5-phase analytical audit reports (all PASSED)
├── references/
│   ├── adr/                # Architecture Decision Records — canonical for any decision
│   │   ├── 0001-ale-replaces-pgcrypto.md
│   │   ├── 0002-tenant-isolation-two-layer.md
│   │   ├── 0003-nestjs-scoped-to-workers.md
│   │   ├── 0004-sqs-for-worker-queuing.md
│   │   ├── 0005-session-revocation-hybrid.md
│   │   ├── 0006-regional-silos.md
│   │   └── 0007-hybrid-api-versioning.md
│   └── (standards research — GAGAS, IIA GIAS, SOC 2, ISO 27001, Single Audit, PCAOB, NIST, etc.)
│
└── phases/                 # ⚠️ PARTIALLY STALE — horizontal build roadmap, superseded in parts
```

---

## 5. Active work: Vertical Slice A

**Target**: prove the substrate works by shipping one end-to-end user journey (Engagement → Finding → PDF signoff) with every load-bearing ADR exercised.

**Read first**: [`VERTICAL-SLICE-PLAN.md`](VERTICAL-SLICE-PLAN.md) — ~700 lines, §1 defines the journey, §3 lists the minimum spec subset, §4 is the week-by-week build plan. Drift between spec and reality is captured in [`SPEC-DELTA-LOG.md`](SPEC-DELTA-LOG.md).

**Scope**: solo engineer, 4-6 weeks, Docker compose on dev laptop (NOT real AWS).

**Progress** (as of 2026-05-01):
- ✅ **W1 substrate** — monorepo, docker compose, Prisma schema, tenant extension, RLS, ALE, audit-log hash chain, seeds
- ✅ **W2 auth + API** — Better-Auth-style password + TOTP + EdDSA JWT + Redis blocklist; Fastify + tRPC; engagement + pack procedures; Next.js shell with sign-in
- ✅ **W3 finding loop** — finding CRUD with ALE-encrypted elements, autosave editor, four-element progress bar, submit-for-review, MFA-gated decide flow with auto-replay step-up; review queue UI
- ✅ **W4 reports + PDF + OTel** — report compose/sign with typed attestation, transactional outbox, NestJS worker, pdfkit render, S3 archive, presigned download, audit-log viewer + verify-chain, end-to-end W3C trace propagation across the SQS boundary
- ✅ **W5 polish/soak** — Playwright e2e (slice-A journey + session revocation), cross-tenant isolation sweep, ADR-0002 `DATABASE_URL` split into tenant + admin, perf pass on report router, ADR-0008/0009 acceptance + docs/06 narrative, spec-delta closeout
- 🚧 **W6 remaining** — phases reconciliation pass (annotate stale `phases/*` files per CLAUDE.md §3 / VERTICAL-SLICE-PLAN.md §5)

**Explicit deferrals** (§1.3 of slice plan): PBC, CAP, PRCM, APM, QA, multi-standard, auditee portal, SSO, billing, fieldwork, real-time collab. All future slices.

---

## 6. Critical conventions a fresh session will otherwise get wrong

- **Fastify is the hot path. NestJS is workers only.** Per ADR-0003. Many older docs (esp. `phases/`) say all-NestJS. Ignore those.
- **No pgcrypto for field encryption.** Per ADR-0001 — key leakage via query logs / memory / `pg_stat_statements`. Use Application-Layer Encryption (ALE) via `packages/encryption/` with AWS KMS-wrapped per-tenant DEKs. References to pgcrypto in `database/`, `docs/06-design-decisions.md`, `references/adr/0001-*`, etc. exist as *negative architecture* — explanations of why it was rejected. Do not reintroduce it.
- **Tenant isolation is two-layer.** Prisma Client Extension (primary, unit-testable) + Postgres RLS (defence-in-depth fallback). Per ADR-0002. Pool multiplexing edge cases covered in `database/POOLING.md`.
- **Sessions are `blocklist_checkable`.** Per ADR-0005. JWT with ~15 min expiry + opaque refresh, with a hybrid blocklist for fast revocation.
- **Regional silos, no global control plane.** Per ADR-0006. us-east-2, eu-central-1, govcloud-us-west are independent deployments.
- **API versioning is hybrid.** URL major (`/v1/`) + dated header minor (`Api-Version: YYYY-MM-DD`). Per ADR-0007.
- **Bitemporal findings.** `validFrom/validTo` (business time) + `transactionFrom/transactionTo` (system time). Materialized view `finding_as_of (id, as_of_timestamp)` for hot reads past ~50k findings/engagement.
- **Hash-chained audit log.** SHA-256 chain. Verify script in `database/` (to be built per Slice A). Every mutation appends.
- **`semanticElementMappings` with `equivalenceStrength`.** The lynchpin of multi-standard. GAGAS 4-element / IIA 5-Cs / ISO 3-category all map onto canonical codes. Read `docs/03-the-multi-standard-insight.md`.
- **Pack annotation directions**: `tighten` / `override_required` / `loosen`. Strictness resolver uses `max` / `min` / `union` / `override_required`. See `product/ux/pack-attachment.md`.
- **TypeScript strict, everywhere.** No `any`, no `as` without justification. See `engineering/CODE-STANDARDS.md`.
- **Definition of Done applies proportionally.** Starter PR = items 1+8. Feature PR = all 9. See `docs/07-handbook-for-engineers.md §5`.
- **Diátaxis-aware docs.** Tutorial / how-to / reference / explanation. See `engineering/DOCUMENTATION.md`.

---

## 7. What NOT to do

- ❌ Don't edit Phase 1-6 product specs without an explicit R1-cycle prompt from user. They're closed.
- ❌ Don't "fix" `phases/` files by rewriting them to match Tier 1 — the reconciliation pass (annotating which sections are superseded) is its own deliverable, captured in `VERTICAL-SLICE-PLAN.md §5`.
- ❌ Don't reference SharePoint, PnPjs, SPFx, or anything in the v1 repo for v2 implementation. Substrate is fundamentally different.
- ❌ Don't mock data-at-rest encryption in dev. Use LocalStack KMS. Mocking defeats the integration test for ALE.
- ❌ Don't assume "audit passed → it works." The Gemini audits validated *spec artifacts*, not running code. Slice A is what validates buildability.
- ❌ Don't scope-creep Slice A. Every deferral in §1.3 of the slice plan is deliberate. Push back on "while we're here, let's also..." requests.
- ❌ Don't skip the `SPEC-DELTA-LOG.md` during slice build. Every time the spec doesn't match reality, log it — that's the highest-value output of Slice A for future slices.

---

## 8. User context

- **Working timezone**: US Eastern (ET/EDT). File timestamps on the machine are ET.
- **Role**: Owner/architect driving this greenfield program. Also maintains the v1 SPFx app at Aarya Paar.
- **Working style**: methodical, rigorous, demands honest tradeoff framing. Prefers terse, specific responses. Has a strong instinct for when something smells like over-engineering — trust that instinct.

---

## 9. Onboarding paths by role

### Fresh Claude session picking up where 2026-04-28 left off
1. Read this file (you are)
2. Read [`VERTICAL-SLICE-PLAN.md`](VERTICAL-SLICE-PLAN.md) — the active work item
3. Scan [`audits/`](audits/) — validates the spec tier is grounded
4. Check `.claude/projects/.../memory/MEMORY.md` if auto-memory migrated; if not, the legacy project path is `/Users/harshadbhaibhoi/Documents/SPFx Projects/AIMS Claude/` and the long transcript from the session that drafted Phase 6 + Slice A is at `~/.claude/projects/-Users-harshadbhaibhoi-Documents-SPFx-Projects-AIMS-Claude/3ac48d44-886c-4d56-94a4-f3fefba880df.jsonl`.

### New engineer joining the team (if/when)
Do not read this file. Read `docs/07-handbook-for-engineers.md` — it's the proper 5-week onboarding plan.

### Architect reviewing design decisions
1. [`docs/06-design-decisions.md`](docs/06-design-decisions.md) — the "why" for every major call
2. [`references/adr/`](references/adr/) — seven ADRs, immutable once accepted
3. [`docs/04-architecture-tour.md`](docs/04-architecture-tour.md) — trace a request through the system

### Product/UX reviewer
1. [`product/01-product-vision.md`](product/01-product-vision.md)
2. [`product/02-personas.md`](product/02-personas.md)
3. [`product/ux/`](product/ux/) — 18 surface-by-surface UX specs

---

## 10. Memory / session continuity note

This repo was extracted from a larger working folder (`/Users/harshadbhaibhoi/Documents/SPFx Projects/AIMS Claude/`) where it lived alongside v1 SPFx code. Claude Code's auto-memory is keyed to filesystem path, so sessions opened in the new location won't see the old conversation history automatically.

**What to expect**:
- Auto-memory files in this repo's project slug (created fresh on first session here).
- The prior session's full JSONL transcript is preserved at the old path (see §9).
- **This file is the intentional bridge.** If you're a fresh Claude session and something feels like missing context, check `audits/`, `references/adr/`, and the `VERTICAL-SLICE-PLAN.md` — between them, every load-bearing decision is documented.

---

*Last updated: 2026-05-01. Maintain this file as project state changes — especially §2 (status), §5 (active work), §7 (anti-patterns learned), and §10 (memory status after any re-location).*
