# 0003 — NestJS scoped to worker tier; Fastify + tRPC on request path

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering
- **Tags**: #api #runtime #workers #architecture

---

## Context

The initial `api/` plan used **NestJS as the single API framework** for AIMS v2. tRPC v11 would run inside NestJS via community adapters to serve the Next.js frontend with end-to-end type safety; REST controllers (OpenAPI 3.1) would serve external integrators; NestJS modules would organize the code; NestJS's DI container, lifecycle hooks, Swagger/OpenAPI generation, and `@Cron` decorators would cover scheduling and background work.

External domain review in April 2026 flagged the NestJS + tRPC combination as an architectural smell:

> "You claim NestJS as the API layer but also tRPC v11. While you can run tRPC inside NestJS using community adapters, it fights Nest's native DI, routing, and generated OpenAPI (Swagger) ecosystem. If you are using tRPC as the primary data layer, pure Express/Fastify/Hono is standard; if you are using NestJS, people generally rely on its native controllers or its GraphQL implementation. An architect will raise an eyebrow at this marriage."

The reviewer's stronger recommendation was to drop NestJS entirely. That recommendation has merit for the request path — Fastify + tRPC is a standard, well-documented combination, and NestJS's DI container adds cost without a matching benefit when tRPC is the primary data layer.

However, AIMS v2 has substantive background-worker responsibilities where NestJS's primitives do pay off:

- **Document generation** — rendering seven reports per Single Audit engagement (per-pack vocabulary, per-report presentation rules, multi-format output — PDF, DOCX, HTML) via a worker-queue pattern. Heavy, long-running, resource-bound.
- **Transactional outbox dispatch** — reading the outbox table, HMAC-signing webhooks, retrying with exponential backoff, managing dead-letter queues (per ADR-0002's decision tree on side effects).
- **Scheduled jobs** — SCIM provisioning sync (daily), tenant lifecycle tasks (nightly), audit-log hash-chain verification (weekly), tenant billing aggregation (monthly), standards-change feed monitoring.
- **Data integrity checks** — periodic cross-tenant leakage canary, bitemporal consistency checks, pack-version integrity checks.

For a worker tier with ~10 distinct background responsibilities of varying shapes, NestJS's DI container, `@Module` organization, `@Cron` decorator, lifecycle hooks, and queue-worker integration (`@nestjs/bull`) provide primitives that would cost real engineering time to reinvent in raw TypeScript.

The decision is therefore not "NestJS or not" but "where does NestJS belong."

---

## Decision

The API layer is split by role into two tiers.

**Request path — Fastify + tRPC v11 + REST + HMAC-signed webhooks** (lives in `api/requests/`). Lean runtime, no heavy DI on the hot path, direct control over middleware order. tRPC for the frontend with end-to-end type safety on the structural shape; REST (OpenAPI 3.1) via `@fastify/swagger` for external integrators; webhook signing and delivery endpoint for inbound webhooks from third parties.

**Worker tier — NestJS** (lives in `api/workers/`). Document generation, transactional-outbox dispatch, scheduled jobs (SCIM sync, lifecycle tasks, audit-log verification), data integrity checks. NestJS's DI, `@Module`, `@Cron`, `@Injectable`, and `@nestjs/bull` primitives are load-bearing here.

Both tiers share code via `packages/`:
- `packages/validation/` — Zod schemas, used by request-path tRPC input validation and by worker-tier job-payload validation
- `packages/prisma-client/` — the shared Prisma Client with the tenant-isolation extension (per ADR-0002)
- `packages/encryption/` — the ALE helper module (per ADR-0001)
- `packages/logging/` — structured logging with tenant/user/trace correlation, used by both tiers

Each tier deploys as its own container image and scales independently.

---

## Alternatives considered

### Option A — NestJS everywhere (including request path)  (rejected)

The original plan. Single framework for everything.

**Pros**
- Single framework; single mental model
- DI and module organization available everywhere
- Swagger/OpenAPI generation built in

**Cons**
- NestJS's native controllers fight tRPC's natural integration
- Heavy DI container on the hot request path without corresponding payoff
- Swagger generation competes with tRPC's type inference
- Architects reviewing the stack consistently flag the NestJS + tRPC combination as architectural friction
- NestJS's request-scoping model adds per-request overhead that Fastify does not

### Option B — Drop NestJS entirely; Fastify + tRPC + raw TypeScript workers  (rejected)

Hand-roll worker scheduling, DI, lifecycle, and queue-worker patterns in plain TypeScript.

**Pros**
- Lightest possible runtime
- Single framework
- No NestJS learning curve

**Cons**
- Reinventing NestJS's DI, module lifecycle, and `@Cron` in raw TypeScript is real engineering cost
- For a worker tier with ~10 distinct responsibilities of varying shapes, the boilerplate accumulates quickly
- `@nestjs/bull` (or equivalent) integration with Redis-backed queues is nontrivial to replicate
- Makes onboarding harder — new engineers need to learn our in-house patterns for things NestJS already provides

### Option C — Split: Fastify + tRPC for request path, NestJS for worker tier  (chosen)

Each tier uses the framework whose primitives match its workload.

**Pros**
- Request path stays lean; Fastify + tRPC is a well-documented combination
- Worker tier benefits from NestJS DI, `@Module`, `@Cron`, lifecycle, and queue integration
- Each tier scales independently (request path often spiky, worker tier often steady; no coupling)
- Deployment, observability, and capacity planning can be optimized per tier
- Passes external architecture review cleanly

**Cons**
- Two frameworks to maintain
- Shared code must be framework-agnostic (lives in `packages/`)
- Engineers must know which tier a given concern lives in
- CI builds two container images
- Observability must correlate across tiers (a request that writes an outbox row ends up in a worker — the trace has to span both)

### Option D — Fastify + tRPC for request path, BullMQ with plain TypeScript workers  (rejected)

BullMQ for the queue layer; worker-side code is plain TypeScript without a framework wrapper.

**Pros**
- Lightest worker runtime
- Single queue technology

**Cons**
- Scheduling (`@Cron`-equivalent), module boundaries, lifecycle hooks, and DI all become our problem
- For ~10 distinct workers, NestJS's `@Module` + `@Injectable` + `@Cron` + `@Processor` primitives save real engineering time
- BullMQ is excellent as a queue but does not provide the workflow / scheduling / DI layer on top

### Option E — Split: Fastify + tRPC request path, Hono for workers  (rejected)

Use an even lighter framework (Hono) for workers instead of NestJS.

**Pros**
- Very light runtime on workers
- Single stylistic family (both tiers look similar)

**Cons**
- Hono is a web framework, not a background-job framework
- Does not solve the scheduling, DI, or queue-integration problem
- Would end up needing a separate scheduler and DI library on top

---

## Consequences

### Positive
- Request path is fast and observably lean — Fastify + tRPC + Zod is a well-documented, high-performance combination
- Worker tier benefits from NestJS primitives where they genuinely pay off
- The two tiers can scale independently — request path is typically spiky (user-driven), worker tier is typically steady (scheduled and queued) and can be auto-scaled on different metrics
- Observability correlates cleanly across tiers via the OpenTelemetry trace context propagated through the outbox row
- Architecture passes external review and matches common production patterns at comparable platforms

### Negative
- Two frameworks to maintain — engineers touching both tiers need to know both idioms
- Shared code must be framework-agnostic (no NestJS decorators in `packages/`, no Fastify plugin types in `packages/`)
- CI pipeline produces two container images and two deployment artifacts
- Documentation splits — `api/requests/README.md` and `api/workers/README.md` are both authoritative for their tiers
- Observability must propagate trace context through the outbox table (not just HTTP) so a request-originated trace includes the worker-side span

### Neutral
- `packages/` folder becomes the shared-code home — validation schemas, Prisma client wiring, ALE helpers, logging
- The CI pipeline's 12-minute budget applies separately to each tier
- Worker tier has its own runbooks (`devops/RUNBOOKS.md`) separate from request-path runbooks

---

## Validation

- **Worker-tier engineering velocity** — If time-to-ship a new background job does not improve within two quarters (relative to what we would have had under Option B's raw-TypeScript workers), the NestJS overhead is not paying off and we revisit
- **Request-path latency** — If p99 request latency at baseline load exceeds target (250ms for tRPC queries, 500ms for mutations), the framework split is not load-bearing and we revisit
- **Shared-code friction** — If engineers consistently report that framework-agnostic `packages/` code is awkward to write or consume, we revisit either the package boundaries or the framework split
- **Operational** — If operating two tiers with separate images, separate deployment pipelines, and separate scaling policies turns out to be more cognitive overhead than the framework benefits justify, we consolidate

---

## Rollout plan

- **Phase 1 — Scaffold** (pre-launch): Create `api/requests/` scaffold (Fastify + tRPC + Zod + OpenAPI via `@fastify/swagger`). Create `api/workers/` scaffold (NestJS + `@nestjs/bull` + `@nestjs/schedule`). Create `packages/validation/`, `packages/prisma-client/`, `packages/encryption/`, `packages/logging/`. Set up CI to build both images.
- **Phase 2 — First features** (launch readiness): First tRPC router (engagement) and first worker (outbox dispatch) built against the new split. OpenTelemetry trace context propagation verified end-to-end (request → outbox row → worker → downstream effect).
- **Phase 3 — Reconcile** (folder reconciliation workstream): Update any `api/` folder content that implied single-framework NestJS; split into request-path and worker-tier narratives. Document deployment topology in `devops/INFRASTRUCTURE.md`.

---

## Threats considered

- **Shared code drift between tiers** — Mitigated by putting all cross-tier code in `packages/`, with CI enforcing both tiers build against the same package versions. `packages/` forbids framework-specific imports via ESLint rule.
- **Worker tier becoming an unbounded "other stuff" dumping ground** — Mitigated by explicit criteria for what belongs there: scheduled, long-running, asynchronous, or side-effect-producing work. Synchronous request handling does not belong in workers, enforced in code review.
- **Trace correlation breaks across the tier boundary** — Mitigated by storing the OpenTelemetry trace context in the outbox row (`trace_context` column) and injecting it into the worker's span on job pickup. Covered by an end-to-end observability test in CI.
- **Observability tooling misconfigured across tiers** — Mitigated by making logging, metrics, and tracing configuration live in `packages/logging/` — shared across tiers — rather than per-framework configuration that drifts.
- **Security-sensitive code (authentication, tenant isolation, encryption) drifts between tiers** — Mitigated by the Prisma Client Extension for tenant isolation (ADR-0002) and the ALE module (ADR-0001) living in `packages/` and used identically in both tiers. CODEOWNERS routes changes to `packages/prisma-client/` and `packages/encryption/` to a security reviewer.

---

## References

- [`docs/04-architecture-tour.md` §1 — system diagram (two-tier API)](../../docs/04-architecture-tour.md#1-the-system-in-one-picture)
- [`docs/04-architecture-tour.md` §2.4 — api/ folder description](../../docs/04-architecture-tour.md#api--the-service-boundary)
- [`docs/04-architecture-tour.md` §3.3 — api layer walkthrough (with outbox pattern)](../../docs/04-architecture-tour.md#33-at-the-api-layer)
- [`docs/04-architecture-tour.md` §8.7 — transactional outbox cross-cutting pattern](../../docs/04-architecture-tour.md#87-event-outbox--the-only-durable-happens-before-edge-we-trust)
- [`docs/04-architecture-tour.md` §12 — Domain review notes (should-fix item)](../../docs/04-architecture-tour.md#12-domain-review-notes)
- Gemini domain review, April 2026 (R1 on 04-architecture-tour.md)
- Fastify documentation — plugin architecture, performance characteristics
- NestJS documentation — modules, DI, `@nestjs/schedule`, `@nestjs/bull`
- tRPC v11 documentation — adapter patterns
- Related ADRs: [ADR-0001](0001-ale-replaces-pgcrypto.md) (ALE helper lives in `packages/encryption/` shared across tiers); [ADR-0002](0002-tenant-isolation-two-layer.md) (Prisma Client Extension lives in `packages/prisma-client/` shared across tiers)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
