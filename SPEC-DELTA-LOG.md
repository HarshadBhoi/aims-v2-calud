# Spec Delta Log — Slice A

> Per CLAUDE.md §7 and [VERTICAL-SLICE-PLAN.md §9](VERTICAL-SLICE-PLAN.md): every time the slice spec doesn't match reality, log it here. This is the highest-value output of Slice A for future slices — it tells us where the spec is right, where it's drifted, and where reality forced a better answer.
>
> Format per entry:
> - Spec section + claim
> - What we actually did
> - Why
> - Implication for future slices / spec updates

---

## Conventions

Entries are append-only and dated. Don't rewrite history; if a delta is later resolved, add a follow-up entry referencing it.

Status values:
- **🔄 In effect** — reality differs from spec; spec should be updated when the slice closes
- **✅ Resolved** — reality and spec reconciled (either spec updated or code changed back)
- **📝 Informational** — spec was right; logged for posterity (e.g., reality matched but a tradeoff was non-obvious)

---

## Slice A closeout summary (2026-05-01)

Six entries across W3-W4-W5; all 🔄 In effect at slice close. None forced a re-architecture; each is "spec was over-prescriptive in a place that didn't matter for proving the substrate, reality is simpler and convertible later when load-bearing."

| Entry | Date | Carries into Slice B as… |
|---|---|---|
| OTel — per-service ConsoleSpanExporter, no Collector | 2026-04-28 | Add Collector + OTLP exporter when first cloud backend (Tempo / Grafana Cloud) is wired up |
| OTel — browser instrumentation deferred | 2026-04-28 | Add `@opentelemetry/sdk-trace-web` + `instrumentation-fetch` when RUM or browser perf budgets become a real ask |
| Worker — admin Prisma + DB trigger for audit log | 2026-04-28 | Either set per-tx GUCs for richer trigger context, or move to app-level audit writes when service-identity flow exists |
| Finding editor — textarea, not TipTap | 2026-04-28 | Drop in TipTap when rich-text becomes a real auditor request — UI-only change, wire contract is `Record<string, string>` |
| Pack resolver — in `apps/api/`, not separate package | 2026-04-28 | Extract to `packages/pack-resolver` when a second consumer (NestJS worker pre-resolution, CLI) needs it |
| Database — `DATABASE_URL` split into tenant + admin URLs | 2026-05-01 | Both URLs are now load-bearing; deployment templates must provision two roles + two secrets per environment |

**Specs to update at slice handoff** (also tracked via the entries below):
- `VERTICAL-SLICE-PLAN.md §4 W4 task 4.8` — soften "OTel Collector → console exporter" wording; flag browser instrumentation as deferred.
- `VERTICAL-SLICE-PLAN.md §4 W4 task 4.5` — drop "running under same tenant context via session token"; trigger model is correct + simpler.
- `VERTICAL-SLICE-PLAN.md §4 W3 task 3.3` — TipTap is aspirational, not slice-A scope.
- `VERTICAL-SLICE-PLAN.md §4 W3 task 3.1` — pack resolver lives in `apps/api/`; extraction-when-needed.
- `VERTICAL-SLICE-PLAN.md §4 W2 task 2.1` (or wherever DB config is named) — call out the two-URL pattern explicitly.

The spec updates themselves are deliberately **deferred** — touching the slice plan during slice A would be revisionist; the log is the canonical record until slice B's planning incorporates the deltas.

---

## Entries

### 2026-05-01 — 2.x `DATABASE_URL` split into tenant + admin connections

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W2](VERTICAL-SLICE-PLAN.md)):**
> The slice-plan W2 setup implicitly assumes a single `DATABASE_URL` is enough for the api + worker. Both ADR-0002 (two-layer tenant isolation) and the seed/admin client patterns presuppose RLS-bypassing access exists, but the env contract for *how* that's exposed wasn't pinned down.

**Reality:**
- Two env vars now: `DATABASE_URL` (tenant client, `aims_app` role, RLS-bound — the request path 99% of queries take) and `DATABASE_ADMIN_URL` (admin client, `aims_migration` role, BYPASSRLS — auth's tenant lookup, audit-log chain verify, the worker's outbox drain). Surfaced and pinned in commit `e3599e2`.
- `apps/api/src/config.ts`, `apps/api/src/services.ts`, `apps/worker/src/config.ts`, `apps/worker/src/db/db.module.ts` thread the admin URL into `createAdminPrismaClient({ datasourceUrl })` everywhere the admin client is built.
- Same plumbing landed in `apps/web/e2e/global-setup.ts` and `apps/web/e2e/session-revocation.spec.ts` in commit `c6e870e` after they regressed on first e2e run with a fresh role split.
- `.env.example` documents both URLs with the ADR-0002 rationale.

**Why:**
- Workaround discovered during e2e bring-up: bumping the entire `DATABASE_URL` to the migration role made the tenant client *also* bypass RLS — defeating ADR-0002's defense-in-depth promise. Splitting is the only correct shape.
- Auth's `tenant.findUnique` on a slug *must* cross-tenant before the request has a known tenant context (chicken-and-egg). The tenant client can't satisfy that under RLS, so a second connection is structurally required.

**Implication:**
- Cloud deployment templates (Helm / OpenTofu) must provision **two** Postgres roles per environment (`aims_app` with no `BYPASSRLS`, `aims_migration` with `BYPASSRLS`) and **two** Secrets Manager entries. `DATABASE_MIGRATION_URL` (the third URL in `.env.example`, used only by `prisma migrate`) can collapse onto `DATABASE_ADMIN_URL` if the migration role is the same — currently they are, kept separate for clarity of intent.
- Spec to update: VERTICAL-SLICE-PLAN.md §4 W2 (or a new §6 "Environment contract" section) — call out the three-URL env pattern with rationale.
- Future slice that introduces support-mode / break-glass cross-tenant tooling reuses `DATABASE_ADMIN_URL` rather than introducing a fourth role.

---

### 2026-04-28 — 4.8 OTel uses per-service ConsoleSpanExporter; no Collector container yet

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W4 task 4.8](VERTICAL-SLICE-PLAN.md)):**
> Traces crossing browser → Fastify → Prisma → Postgres (via OTel Postgres plugin) → outbox row → SQS message (propagate `traceparent` in attributes) → NestJS worker → S3 write. **OTel Collector → console exporter for slice (Grafana deferred).**

**Reality:**
- Each service ([apps/api/src/otel.ts](apps/api/src/otel.ts), [apps/worker/src/otel.ts](apps/worker/src/otel.ts)) attaches its **own `ConsoleSpanExporter`** directly. No OTel Collector container in `infra/docker-compose.yml`.
- Trace context flows through the outbox payload via `__traceparent` / `__tracestate` keys (W3C-formatted) injected at sign-time by [`captureTraceCarrier`](apps/api/src/lib/otel-propagation.ts) and extracted in the worker by [`carrierFromPayload` + `runInExtractedContext`](apps/worker/src/lib/otel-propagation.ts) — propagation across the SQS boundary works as specified, just landing on a different per-service sink.
- Auto-instrumentations cover HTTP / Fastify / Prisma / pg / AWS-SDK / NestJS via `@opentelemetry/auto-instrumentations-node`. `instrumentation-fs` and `instrumentation-dns` are explicitly disabled to keep the slice's stdout legible.

**Why:**
- Functionally equivalent for "spans visible somewhere we can read them" — the slice plan's stated bar.
- Saves a docker-compose service and an OTLP exporter dependency that would need to be reconfigured the moment we point at real Tempo/Grafana anyway.
- The Collector's value (sampling, batching, multi-backend export) is irrelevant at console-only fidelity.

**Implication:**
- The OTLP exporter + Collector arrive together with the first real backend (Grafana Cloud / Tempo / Jaeger). Until then, two stdout streams is fine.
- Spec to update: VERTICAL-SLICE-PLAN.md §4 W4 task 4.8 — soften "OTel Collector → console exporter" to "per-service console exporters; OTel Collector arrives with the OTLP exporter in the first cloud deployment."

---

### 2026-04-28 — 4.8 Browser instrumentation deferred from Slice A

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W4 task 4.8](VERTICAL-SLICE-PLAN.md)):**
> Traces crossing **browser** → Fastify → Prisma → Postgres → outbox row → SQS message → NestJS worker → S3 write.

**Reality:**
- Browser-side OTel SDK was **not** installed in [apps/web](apps/web/). Trace propagation begins at the Fastify edge where the `http` auto-instrumentation creates the root span for each tRPC request.
- The two services (`api`, `worker`) trace and propagate fully; the browser slice of the trace tree is missing.

**Why:**
- The realistic browser-OTel install is heavyweight: `@opentelemetry/sdk-trace-web` + `@opentelemetry/instrumentation-fetch` (or xhr) + a CORS-enabled OTLP exporter + service-worker config so background tabs don't drop spans. Without a backend to point at, none of that has value.
- Slice A's user journey is dev-laptop only and verified via integration tests + console exporter; no human is reading browser traces.
- Mirrors the OTel Collector deferral above — both arrive with the first real backend.

**Implication:**
- A future slice that needs RUM (real-user monitoring) or browser-side performance budgets adds the web SDK. The wire contract (`traceparent` in tRPC requests) doesn't need to change — the Fastify side already accepts inbound traceparent via the standard HTTP propagator.
- Spec to update: VERTICAL-SLICE-PLAN.md §4 W4 task 4.8 — flag browser as "Slice A: not instrumented; arrives with real backend."

---

### 2026-04-28 — 4.5 Worker writes back via admin Prisma, not via API session callback

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W4 task 4.5](VERTICAL-SLICE-PLAN.md)):**
> Worker uses Puppeteer or pdfmake to render. Content hash computed. Audit log entry appended (from worker, running under same tenant context via session token). PDF archived to LocalStack S3.

**Reality:**
- Renderer uses **pdfkit** (the lower-level library that pdfmake builds on). Lighter footprint, simpler API for the slice's "stack of section blocks" use case.
- Content-hash check is **doubled**: handler verifies recomputed hash matches **both** the DB column **and** the inbound event payload. Catches DB tampering and event-replay-with-stale-hash.
- The "audit-log entry from worker, running under same tenant context via session token" framing was simplified: the worker uses [`AdminPrismaClient`](packages/prisma-client/src/index.ts) which has `BYPASSRLS` via the `aims_superadmin` role. The DB-level audit-log trigger on `report_versions` fires on every UPDATE regardless of role, so the audit-log row is captured "for free" — no need for the worker to hold a session token or call back into the API. The trigger function does not capture `userId`/`sessionId`/`ipAddress`/`userAgent` columns (they're nullable; trigger only writes `tenantId`, `action`, `entityType`, `entityId`, `before/afterData`).

**Why:**
- Sessions are short-lived (15-min JWTs); minting/refreshing one in the worker per-event would require a service-account flow that doesn't yet exist. Slice A doesn't have service identities.
- Bypass-RLS is the right tool for a cross-tenant background process (the worker handles every tenant's events). The trigger guarantees integrity regardless of caller identity.
- The trigger's `userId/sessionId/ipAddress/userAgent` nulls are an honest gap in the audit story: trigger-driven entries from worker mutations show "system did this" rather than "user X did this via session Y from IP Z". Fine for slice A where the worker is the only system writer.

**Implication:**
- A future slice that needs richer worker-side audit (who triggered the upload? from where?) will either:
  - Set per-transaction GUCs (`SET LOCAL app.current_user_id = …`) before the worker's UPDATE so the trigger picks them up, or
  - Switch to app-level audit-log writes (give up the trigger model) for tighter control, or
  - Rework the trigger to pull from event payload.
- For service identity in real AWS, use IAM-role-issued tokens via IRSA; the worker presents a service-account JWT to the API for any callbacks. Out of scope for slice A (dev-laptop only).
- Spec to update: VERTICAL-SLICE-PLAN.md §4 W4 task 4.5 — "audit log entry appended" is correct; "running under same tenant context via session token" is over-prescriptive given the trigger model.

---

### 2026-04-28 — 3.3 Finding editor uses `<textarea>` instead of TipTap for slice A

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W3 task 3.3](VERTICAL-SLICE-PLAN.md)):**
> Finding editor UI. Four TipTap instances (one per element). Four-element progress bar. Autosave every 10s. Submit-for-review disabled until 4/4 complete.

**Reality:**
- Editor uses plain HTML `<textarea>` per element ([apps/web/app/dashboard/engagements/[id]/findings/[findingId]/page.tsx](apps/web/app/dashboard/engagements/[id]/findings/[findingId]/page.tsx)).
- All other behaviors land per spec: per-element editors driven by the resolved pack's `findingElements`, four-element progress bar, 10s autosave with sequential save loop respecting optimistic concurrency, save-on-unmount, submit disabled until all required elements complete + no dirty fields.

**Why:**
- TipTap pulls ~5 packages, ~200KB to the bundle, and ProseMirror complexity. None of that is load-bearing for proving the substrate (encryption round-trip, autosave, state machine, MFA step-up, audit trail).
- The element-value contract on the wire is `Record<string, string>` — the backend cannot tell whether the string is plaintext, HTML, or TipTap JSON. Switching to TipTap later is a UI-only change with no schema or migration impact.
- Aligns with CLAUDE.md §6 ("Don't add features beyond what the task requires").

**Implication:**
- Slice B (or whenever rich-text formatting becomes a real auditor request) introduces TipTap. The replacement is local to the editor component; no API or schema changes required.
- The current `<textarea>` does not enforce minLength on the client beyond a counter readout — server enforces via `elementsComplete` recomputed in `updateElement`. That's the right enforcement boundary either way.

---

### 2026-04-28 — 3.1 Pack resolver lives in `apps/api/`, not `packages/pack-resolver`

**Status:** 🔄 In effect

**Spec ([VERTICAL-SLICE-PLAN.md §4 W3 task 3.1](VERTICAL-SLICE-PLAN.md)):**
> Pack resolver. `packages/pack-resolver`. For single pack + zero annotations, it's a straightforward "read pack JSON → return effective values." Code shape (strictness direction, equivalence strength, annotation overlay) is stubbed but not exercised. Unit tests for the load-bearing paths.

**Reality:**
- Resolver implemented at [apps/api/src/packs/resolver.ts](apps/api/src/packs/resolver.ts) (~80 LOC).
- Wired into [apps/api/src/routers/pack.ts](apps/api/src/routers/pack.ts) (`list / attach / resolve` tRPC procedures).
- Tested via integration in [apps/api/src/routers/business.test.ts](apps/api/src/routers/business.test.ts) (happy path + multi-pack `NOT_IMPLEMENTED` rejection).
- Single-pack-only with explicit `TRPCError({ code: "NOT_IMPLEMENTED" })` for multi-pack — annotation overlay and strictness-direction code shapes are referenced in comments but not stubbed as functions.

**Why:**
- Slice A has one consumer (apps/api). A `packages/pack-resolver` workspace would add publish/import overhead with no second consumer to justify it.
- Extraction is cheap when needed (the resolver is a pure function over Prisma + pack JSON; moving it to a package is a copy-paste-and-import change).
- Aligns with CLAUDE.md §6 ("Don't add features, refactor, or introduce abstractions beyond what the task requires").

**Implication:**
- When a second consumer appears (NestJS worker rendering reports, or a CLI tool that pre-resolves packs offline), extract to `packages/pack-resolver`. Until then, the apps/api home is correct.
- Spec to update: VERTICAL-SLICE-PLAN.md §4 W3 task 3.1 — soften the package-extraction claim to "module under apps/api/src/packs/, extract to package when a second consumer arises."
- Spec to update: when annotation overlays land (slice B), the code-shape stub will become a real function — the slice plan's "stubbed but not exercised" framing was aspirational; reality is "structure ready, no dead code."

---

<!-- Add new entries above this comment, newest at top under "## Entries". -->
