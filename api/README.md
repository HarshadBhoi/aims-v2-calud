# AIMS v2 — API Layer

> Type-safe, secure, observable API contracts for the multi-standard audit platform.

---

## API Strategy

AIMS v2 exposes **three interfaces**, each optimized for its use case:

| Interface | Consumer | Protocol | Docs |
|-----------|----------|----------|------|
| **tRPC** | First-party frontend (Next.js), mobile app | HTTP/JSON with TypeScript types | Auto-generated from code |
| **REST** | Third-party integrations, Zapier, custom scripts | HTTP/JSON per OpenAPI 3.1 | `openapi.yaml` |
| **SSE / Webhooks** | Real-time UI updates, customer integrations | Server-Sent Events (in), Webhooks (out) | `webhooks/events.md` |

### Why Both tRPC and REST?

- **tRPC** gives end-to-end type safety for our own frontend — no API contract drift, no manual DTOs, no OpenAPI sync issues
- **REST** is the universal integration language — customers use Zapier, Power BI, custom scripts, etc. A documented REST API is table stakes for enterprise SaaS
- Both hit the **same service layer** — no duplicate business logic

```
┌────────────────┐      ┌──────────────┐      ┌──────────────┐
│ Next.js        │──────│ tRPC router  │──┐   │ Service layer│
│ (type-safe)    │      │              │  │──▶│  (business   │
└────────────────┘      └──────────────┘  │   │   logic)     │
                                          │   │              │
┌────────────────┐      ┌──────────────┐  │   │  Prisma +    │
│ External       │──────│ REST router  │──┘   │  domain      │
│ (OpenAPI)      │      │ (OpenAPI 3.1)│      │  services    │
└────────────────┘      └──────────────┘      └──────────────┘

┌────────────────┐      ┌──────────────┐
│ Frontend tabs  │◀─────│ SSE stream   │◀─── Event bus (BullMQ)
│ Webhook users  │◀─────│ Outbound     │◀───
└────────────────┘      └──────────────┘
```

---

## File Structure

The API layer is **split by role** into two tiers (per [ADR-0003](../references/adr/0003-nestjs-scoped-to-workers.md)):

- **Request path** (Fastify + tRPC v11 + REST + HMAC-signed webhooks) — the hot path. Lean runtime; no heavy DI. Physically lives in `api/requests/`. Serves the Next.js frontend via tRPC and external integrators via REST (OpenAPI 3.1).
- **Worker tier** (NestJS + `@nestjs/schedule`) — document generation, transactional outbox dispatch, scheduled jobs (SCIM sync, tenant-lifecycle tasks), data integrity checks. NestJS's DI, module lifecycle, and `@Cron` decorators pay off here. Physically lives in `api/workers/`. Consumes from AWS SQS queues (per [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md)).

Shared code (Zod schemas, Prisma client, encryption helpers, logging) lives in `packages/` and is framework-agnostic — importable by both tiers.

```
api/
├── README.md                            ← You are here
├── ARCHITECTURE.md                      ← Design decisions
├── CONVENTIONS.md                       ← Patterns (pagination, filters, idempotency)
├── AUTH-FLOW.md                         ← Authentication details
├── ERRORS.md                            ← Error model and HTTP status mapping
│
├── requests/                            ← ⬅️ Request path (Fastify + tRPC + REST)
│   ├── trpc/
│   │   ├── context.ts                   ← Request context (tenant, user)
│   │   ├── middleware.ts                ← Auth, RBAC, idempotency, logging
│   │   ├── root-router.ts               ← Router composition
│   │   └── routers/
│   │       ├── engagement.router.ts     ← Full example (CRUD + lifecycle)
│   │       ├── finding.router.ts        ← Polymorphic, immutability-aware
│   │       ├── approval.router.ts       ← Workflow engine
│   │       └── standard-pack.router.ts  ← Platform-level
│   ├── rest/
│   │   ├── README.md                    ← Public REST API (URL-versioned)
│   │   ├── openapi.yaml                 ← OpenAPI 3.1 spec (per dated version)
│   │   └── versioning/                  ← Per-date response-shape shim (ADR-0007)
│   └── webhooks/
│       ├── events.md                    ← Outbound event catalog
│       └── receivers/                   ← HMAC-verified inbound webhooks
│
├── workers/                             ← ⬅️ Worker tier (NestJS)
│   ├── outbox-dispatcher/               ← Transactional outbox → SQS (ADR-0003 §3.4)
│   ├── document-generator/              ← Engagement reports (S3-pointer payloads)
│   ├── scim-sync/                       ← Scheduled tenant user-directory pulls
│   ├── audit-integrity-check/           ← Weekly hash-chain verification
│   └── revocation-worker/               ← Populates session blocklist (ADR-0005)
│
└── (shared schemas live in packages/validation/)
```

---

## Key Principles

### 1. Type Safety End-to-End
- TypeScript strict mode everywhere
- Zod schemas shared between client and server (single source of truth for validation)
- Types flow from Prisma → Service layer → API → Frontend
- `superjson` handles `Date` / `Decimal` / `BigInt` serialization

### 2. Security by Default
- Every tRPC procedure requires authentication (opt-out via `publicProcedure`)
- Every procedure checks tenant context (middleware)
- Every mutation requires RBAC check (declarative via middleware)
- Every external-facing endpoint rate-limited
- All inputs validated with Zod (reject early)

### 3. Idempotency for Safe Retries
- All **mutations** accept `Idempotency-Key` header (RFC 9456 pattern)
- Duplicate requests return original response (24-hour TTL)
- Safe for retries after network errors

### 4. Optimistic Concurrency Control
- Every `update` mutation requires `version` field matching current record
- Mismatched version → `409 Conflict` with current version number
- Frontend re-reads and prompts user to merge or overwrite

### 5. Cursor-Based Pagination
- All `list` queries use **cursor-based pagination** (not offset-based)
- Scales to millions of rows
- Returns `{ items: [...], nextCursor: string | null }`

### 6. Typed Errors
- `TRPCError` subclasses with documented error codes
- REST endpoints map errors to HTTP status per `ERRORS.md`
- Errors include `code`, `message`, `details`, optional `retry_after`

### 7. Observability Baked In
- Every request gets a `request_id` (UUIDv7 for time-sortability)
- Structured logging via Pino (JSON)
- OpenTelemetry spans (distributed tracing across services)
- Prometheus metrics (request count, latency, error rate per procedure)

### 8. Real-Time via Server-Sent Events (SSE)
- Simpler than WebSockets for one-way server→client updates
- Works through proxies, CDNs, firewalls
- Auto-reconnect built into the spec
- Used for: approval notifications, collaborative editing, live dashboard data

### 9. Service Layer Separation
- tRPC/REST routers are **thin adapters** — they validate input, call service layer, return result
- All business logic in `service/` modules (importable by CLI tools, background jobs)
- Easy to unit-test without HTTP

### 10. Background Work via AWS SQS + EventBridge Scheduler

Deferred mutations (PDF generation, bulk export, email sending) enqueue to AWS SQS. NestJS workers in `api/workers/` consume and execute. Return `{ jobId }` immediately; client polls or subscribes via SSE.

- **Queue technology**: AWS SQS (standard + FIFO where ordering matters) per [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md). Durable, effectively-infinite queue depth, AWS-native (IRSA, KMS, CloudWatch, DLQ primitives).
- **Scheduling**: Amazon EventBridge Scheduler dispatches scheduled jobs to SQS, not NestJS's in-worker `@nestjs/schedule`. Schedules live in Terraform, observable and configurable without code deploys.
- **Heavy payloads**: document generation carries S3 URI pointers in the SQS message, not inline PDF bytes. Keeps SQS messages under the 256 KB limit and S3 as the payload substrate.
- **Outbox integration**: every side effect (webhook delivery, event emission, notification fan-out) flows through the transactional outbox → SQS → worker pattern. No dual-write failure modes. See [docs/04-architecture-tour.md §8.7](../docs/04-architecture-tour.md#87-event-outbox--the-only-durable-happens-before-edge-we-trust).

**Not used**: BullMQ / Redis-backed queues for worker jobs. Redis is still in the stack for session blocklists ([ADR-0005](../references/adr/0005-session-revocation-hybrid.md)), tRPC response caching, and rate-limit counters — but not for queue infrastructure. See [ADR-0004 §Alternatives](../references/adr/0004-sqs-for-worker-queuing.md) for the rejection rationale.

### 11. API Versioning — URL Majors + Dated Header Minors

Per [ADR-0007](../references/adr/0007-api-versioning-hybrid.md):

- **URL-based major versions** (`/v1/`, `/v2/`) for hard breaking changes. Rare — ideally every 2-3 years at most.
- **Dated header-based minor versions** (`Api-Version: 2026-04-20` request header, Stripe pattern) for additive evolution within a major. Each dated version is a frozen snapshot.
- **tRPC is not versioned** — we own both sides; Zod snapshot tests catch breaking changes at build time.
- **Compatibility shim** per dated version lives in `api/requests/rest/versioning/`.
- **Deprecation**: RFC 8594 `Deprecation` / `Sunset` headers signal to integrators; 18-month minimum window between deprecation announcement and sunset.

---

## Status

- [x] API strategy defined
- [x] Architecture document
- [x] Conventions document
- [x] tRPC context + middleware
- [x] Root router composition
- [x] Example routers (engagement, finding, approval, standard-pack)
- [x] Zod schemas for core entities
- [x] REST API + OpenAPI 3.1 skeleton
- [x] Webhooks catalog
- [x] Error model
- [ ] Additional routers (recommendations, CAPs, workpapers, reports, time entries, CPE, users, auth — follow same patterns)
- [ ] Implementation in Phase 1-2 (see phase plans)

---

## Tech Stack

| Component | Choice | Version |
|-----------|--------|---------|
| tRPC | @trpc/server | v11+ |
| Validation | Zod | 3.x |
| ORM | Prisma | 5.x |
| Serialization | superjson | latest |
| Logging | Pino | 9.x |
| Observability | OpenTelemetry | latest |
| Metrics | prom-client | latest |
| Background jobs | BullMQ | 5.x |
| Cache | Redis (ioredis) | 5.x |
| OpenAPI gen | @asteasolutions/zod-to-openapi OR trpc-openapi | latest |
