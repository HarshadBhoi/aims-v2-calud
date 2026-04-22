# 0002 — Tenant isolation — application-layer filter primary, RLS defence-in-depth

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering, security
- **Tags**: #security #multi-tenancy #database #architecture

---

## Context

AIMS v2 is a multi-tenant SaaS. Every tenant-scoped row in Postgres carries a `tenantId`. Cross-tenant data leakage — Oakfield State University auditors reading another university's findings — would be an existential security incident. The tenant-isolation mechanism is therefore load-bearing for the entire product.

The initial plan (in early `database/` and `auth/` documentation) proposed Postgres Row-Level Security (RLS) as the **sole** tenant-isolation mechanism. The pitch: every query runs inside a transaction that sets `app.current_tenant = $1`; every RLS policy on every tenant-scoped table enforces `tenantId = current_setting('app.current_tenant')`; a developer writing a new endpoint cannot forget to tenant-scope because the policy does it unconditionally.

External domain review in April 2026 flagged this as a known production hazard for systems using an ORM connection pool (Prisma, TypeORM, Sequelize, etc.):

- Prisma's connection pool aggressively reuses connections across requests
- Naïve `SET LOCAL app.current_tenant` patterns can leak session state across transactions if the transaction boundary fails to commit or rollback cleanly, or if the connection returns to the pool with an unexpected state
- The GUC (Grand Unified Configuration setting) leakage failure mode is silent — there is no error thrown, just a policy that evaluates against the wrong tenant on a reused connection
- RLS-as-sole-isolation is described in the review as "more a marketing pattern than a production pattern"

The production multi-tenant pattern at Shopify, Linear, Stripe, and similar serious multi-tenant SaaS platforms is **application-layer filtering as the primary enforcement**, with RLS (or an equivalent DB-layer check) as a **secondary defence-in-depth**. Both layers must pass for a query to succeed; a failure in either is a bug; both existing is the belt-and-suspenders that provides resilience.

This decision is needed before the first Prisma query is written, because the tenant-isolation layer must be baked into the shared Prisma Client wiring from the outset.

---

## Decision

Tenant isolation is enforced in **two layers**.

**Primary enforcement — application layer**: A Prisma Client Extension reads `tenantId` from the authenticated tRPC context (or worker context, for background jobs) and automatically injects `WHERE tenantId = $authenticatedTenant` into every query against a tenant-scoped table. This is the layer we trust, unit-test, and make load-bearing for security.

**Defence-in-depth — database layer**: Row-Level Security policies on every tenant-scoped table verify `tenantId = current_setting('app.current_tenant')`. The tRPC middleware sets `app.current_tenant` at the start of every request's transaction via `SET LOCAL` (transaction-scoped, never session-scoped `SET`). If the app-layer Prisma extension ever fails to inject the filter (developer mistake, raw-SQL path, ORM regression), RLS catches the query and blocks it.

Both layers must pass for a read or write to succeed. A failure in either layer is a bug. Both existing simultaneously is the design intent.

Connection pool configuration is deliberate: GUCs reset on connection checkout, transactions wrap every query, `SET LOCAL` is the only form used, and the transaction wrapper verifies `app.current_tenant` matches the authenticated context before the first query runs. The pooling rules are documented in `database/POOLING.md`.

---

## Alternatives considered

### Option A — RLS as sole isolation  (rejected)

The original plan. Every tenant-scoped query runs inside `SET LOCAL app.current_tenant = $1`; RLS policies on every table enforce the filter.

**Pros**
- Single enforcement point at the DB layer
- "Developer cannot forget to tenant-scope" — conceptually elegant
- Simpler mental model (one layer, not two)

**Cons**
- Depends on connection-pool discipline being perfect
- Session-scoped GUC leakage has well-documented failure modes under connection reuse (see Prisma issue tracker, PgBouncer documentation on session mode vs. transaction mode)
- Failure mode is silent — no error, just a query running against the wrong tenant context
- Hard to unit-test — requires a real Postgres with RLS policies loaded
- ORM abstractions (Prisma, TypeORM) do not natively understand RLS, so some query paths may bypass it
- RLS-as-sole-isolation is not the production pattern at any of the major multi-tenant SaaS platforms we studied

### Option B — App-layer filter as sole isolation  (rejected)

Every query gets `tenantId` injected by a Prisma Client Extension; no RLS policies.

**Pros**
- Unit-testable without spinning up Postgres
- Single layer, explicit, visible in application code
- No connection-pool edge cases to worry about

**Cons**
- Single point of failure — a raw-SQL path (`prisma.$queryRaw`), a new ORM added later, a developer mistake, or an extension regression can bypass the filter with no DB-layer backstop
- No defence against a compromised or misconfigured admin role
- Does not satisfy the threat model where we want the DB layer to reject cross-tenant reads even if the app layer is compromised

### Option C — Two-layer: app-layer primary + RLS defence-in-depth  (chosen)

Prisma Client Extension injects `tenantId` into every query (primary); RLS policies double-check at the DB layer (defence-in-depth).

**Pros**
- Cross-tenant leakage requires *both* layers to fail simultaneously — an order of magnitude more resilient than either alone
- Primary enforcement is unit-testable without Postgres
- DB layer provides backstop against raw-SQL paths, ORM regressions, and developer mistakes
- Matches the production pattern at Shopify, Linear, Stripe, and similar serious multi-tenant SaaS
- Passes external security review cleanly

**Cons**
- Two layers to maintain; RLS policy logic must be kept in sync with the Prisma extension's semantics
- Small RLS overhead on every query (measurable; not load-bearing at expected scale)
- Developers must understand both layers to diagnose isolation bugs
- Documentation and mental-model cost — engineers new to the codebase need to learn both

### Option D — One database per tenant  (rejected for now, revisitable)

True physical isolation — each tenant gets its own Postgres database (same cluster, separate logical DB) or its own cluster.

**Pros**
- True isolation; no cross-tenant leakage possible even theoretically
- Tenant data residency is trivial (separate DB instance per region)
- Tenant-scoped backups, migrations, and restores are clean
- Compliance story is strongest

**Cons**
- Operationally expensive at scale — thousands of tenants means thousands of DBs to monitor, back up, migrate, and scale
- Cross-tenant analytics (platform-level health dashboards, usage aggregation) require a separate warehouse layer
- Schema migrations must be applied per-tenant, with coordination for compatibility windows
- Not justified at our scale unless tenants require it contractually (future FedRAMP / HIPAA-high-volume tenants may)
- Does not preclude the two-layer approach; we might move to per-tenant DBs later for high-compliance tenants while keeping the two-layer pattern for others

---

## Consequences

### Positive
- Cross-tenant leakage requires both the Prisma Client Extension and the RLS policy to fail simultaneously
- Unit tests on the Prisma Client Extension catch isolation bugs without needing a DB
- RLS backstop catches raw-SQL paths and future ORM changes without requiring every developer to remember the invariant
- Pattern matches Shopify, Linear, and Stripe's production approach — passes external security review cleanly
- Scales cleanly to thousands of tenants without per-tenant infrastructure overhead

### Negative
- Two layers to maintain — Prisma Client Extension and RLS policy must stay in semantic sync
- Every tenant-scoped table needs an RLS policy explicitly (enforced via a schema lint rule)
- Small RLS per-query overhead (measured in microseconds; acceptable)
- Connection-pool configuration must be carefully maintained — `SET LOCAL` only, GUC reset on checkout, transaction wrapper verification
- Engineers new to the codebase need to learn both layers and know when each applies

### Neutral
- Connection-pool configuration documented in `database/POOLING.md` (to be added as part of reconciliation)
- Prisma Client Extension lives in `packages/prisma-client/` so it is shared between the Fastify request-path service and the NestJS worker tier (see ADR-0003)
- Admin-role access (for cross-tenant reporting, billing, support) uses a separate Postgres role with explicit audit logging of every cross-tenant query — does not bypass RLS silently
- Weekly synthetic cross-tenant-read canary test in staging — an attempted cross-tenant read through the standard API surface must fail at both layers

---

## Validation

- **Synthetic canary** — Weekly test in staging attempts to read another tenant's data through the standard API surface. Must fail at both the app layer (Prisma extension rejects) and the DB layer (RLS policy rejects). A single-layer pass is a P1 bug.
- **Raw-SQL audit** — CI lints for any `prisma.$queryRaw` usage and routes the PR to a security reviewer via CODEOWNERS. Raw SQL is allowed but reviewed.
- **RLS overhead** — If RLS checks exceed 5% of query time at baseline load, revisit the policy set (e.g., simplify policies, use partial indexes on `tenantId`).
- **Incident signal** — If any cross-tenant leakage incident occurs (at any severity), we revisit both the threat model and the two-layer design.

---

## Rollout plan

- **Phase 1 — Scaffold** (pre-launch): Implement the Prisma Client Extension in `packages/prisma-client/`. Add RLS policies to every tenant-scoped table in the initial migration. Write the transaction wrapper that sets `app.current_tenant` via `SET LOCAL`. Add unit tests for the extension (asserts every query carries `tenantId`), integration tests (asserts RLS blocks cross-tenant reads), and the weekly synthetic canary.
- **Phase 2 — Enforce** (immediate for all new work): Every new table with tenant-scoped data must carry a `tenantId` column (enforced via Prisma schema lint) and an RLS policy (enforced via migration lint). Every new tRPC procedure automatically inherits tenant scoping via the middleware.
- **Phase 3 — Reconcile** (folder reconciliation workstream): Update `database/` and `auth/` folder content to describe the two-layer pattern accurately. Replace any "RLS is the sole mechanism" language with the defence-in-depth framing. Add `database/POOLING.md` documenting GUC discipline.

---

## Threats considered

- **Prisma Client Extension bug lets a WHERE-less query through** — mitigated by integration tests that assert every query carries a `tenantId` filter; also mitigated by the RLS backstop.
- **Connection-pool session-state leakage** — mitigated by transaction-scoped `SET LOCAL` (never session-scoped `SET`); GUC reset on pool checkout; transaction wrapper verifies `app.current_tenant` matches the authenticated tenant claim before the first query.
- **Raw SQL bypass** — mitigated by CODEOWNERS routing every `$queryRaw` PR to a security reviewer; by lint rule requiring a security justification comment on every raw-SQL site; and by the RLS layer catching queries that skip the extension.
- **Admin / service account cross-tenant access** — the admin role is deliberately separate, explicitly bypasses RLS for cross-tenant reporting and billing, but every query under the admin role is logged to the audit trail with full query text and justification.
- **New ORM introduced later** — if we ever add a second ORM or switch ORMs, the RLS layer catches any period of incompleteness while the new ORM's tenant-injection is being built.
- **Forgotten GUC on long-running worker connection** — mitigated by the transaction wrapper that sets `app.current_tenant` per-transaction and verifies it before the first query; long-running workers use per-task transactions, not per-worker-lifetime connections.

---

## References

- [`docs/04-architecture-tour.md` §3.2 — database layer (two-layer tenant isolation)](../../docs/04-architecture-tour.md#32-at-the-database-layer)
- [`docs/04-architecture-tour.md` §4.3 — session boundary](../../docs/04-architecture-tour.md#43-session-boundary)
- [`docs/04-architecture-tour.md` §8.1 — multi-tenancy cross-cutting pattern](../../docs/04-architecture-tour.md#81-multi-tenancy)
- [`docs/04-architecture-tour.md` §12 — Domain review notes (blocking item 2)](../../docs/04-architecture-tour.md#12-domain-review-notes)
- Gemini domain review, April 2026 (R1 on 04-architecture-tour.md)
- Prisma documentation on connection pooling and session state
- PgBouncer documentation on transaction vs. session mode
- Shopify engineering blog — tenant isolation patterns (referenced in the Gemini review)
- Related ADRs: [ADR-0001](0001-ale-replaces-pgcrypto.md) (ALE per-tenant DEKs are part of the same defence-in-depth posture); [ADR-0003](0003-nestjs-scoped-to-workers.md) (Prisma Client Extension lives in `packages/prisma-client/` shared across the two API tiers)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
