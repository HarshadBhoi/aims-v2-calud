# Connection Pool Discipline

> The connection-pool rulebook. Load-bearing for tenant isolation. Breaking these rules produces silent cross-tenant data leakage. See [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md) for the architectural context.

---

## Why this document exists

Tenant isolation is enforced in two layers (per ADR-0002): a Prisma Client Extension at the application layer is the primary enforcement; Postgres Row-Level Security is defence-in-depth. The RLS layer depends on a session GUC — `app.current_tenant` — being set to the correct tenant before any query runs.

When database connections are pooled (via PgBouncer, Prisma's built-in pool, or any connection reuse), session-scoped state persists across clients unless deliberately reset. A naïve `SET app.current_tenant = $1` on a pooled connection survives into the next request handler's use of that connection. The next handler runs with the *previous* tenant's GUC — and its RLS policies silently evaluate against the wrong tenant. No error. No log entry. Just cross-tenant data visible where it shouldn't be.

This is the failure mode ADR-0002 explicitly designs against. The rules below prevent it.

---

## The rules

### Rule 1 — `SET LOCAL` only, never `SET`

```sql
-- ❌ NEVER
SET app.current_tenant = 'abc123';

-- ✅ ALWAYS
BEGIN;
  SET LOCAL app.current_tenant = 'abc123';
  -- ... queries ...
COMMIT;
```

`SET` is session-scoped — it persists across transactions on the same connection. When a pooled connection returns to the pool, the GUC stays set. The next client to check out that connection inherits a tenant context they didn't ask for.

`SET LOCAL` is transaction-scoped — it's cleared on `COMMIT` or `ROLLBACK`. When the connection returns to the pool, the GUC is already unset.

**There is no legitimate use of `SET` (session-scoped) for `app.current_tenant` in this codebase.** A `SET` (not `SET LOCAL`) in a PR is a block-worthy review comment.

### Rule 2 — every query runs inside a transaction that sets the GUC

The application layer never issues a bare query against tenant-scoped tables. Every query is wrapped by the transaction helper that:

1. Begins a transaction
2. Issues `SET LOCAL app.current_tenant = $1` with the authenticated tenant from the tRPC context
3. Verifies the GUC matches the authenticated tenant claim
4. Runs the query
5. Commits

This is implemented in `packages/prisma-client/src/extensions/tenant-transaction.ts` (naming and exact path may evolve; find by grepping for `setCurrentTenant` and `app.current_tenant`).

Bypassing the transaction wrapper — for example, by calling `prisma.finding.findMany` directly outside it — is a CODEOWNERS-blocked change. The wrapper is load-bearing; every path must go through it.

### Rule 3 — GUC reset on connection checkout

The connection pool is configured to issue `RESET ALL` (or `DISCARD ALL`) on connection *checkout*, not just on return. This is belt on top of the suspenders for Rule 1: even if a broken client path somehow issued a `SET` instead of `SET LOCAL`, the next checkout of that connection would clear it.

PgBouncer does this natively via `server_reset_query = DISCARD ALL`. The transaction-mode pool automatically resets state between transactions.

For the Prisma built-in pool (used in dev and for short-lived workers), the reset happens via the Prisma Client Extension's connection lifecycle hooks.

### Rule 4 — transaction mode only on PgBouncer, never session mode

```ini
# pgbouncer.ini
pool_mode = transaction     # ✅ required
# pool_mode = session       # ❌ allows session-scoped state to persist across clients
```

Session mode lets a client acquire a pooled connection and hold it across multiple transactions. That means session-scoped GUCs set by one client persist to any further transactions on that connection. For tenant-safety, session mode is disabled; every transaction gets its own checkout.

Prisma is compatible with transaction mode because it doesn't rely on session-level features (`LISTEN/NOTIFY`, session-scoped advisory locks, prepared statements are disabled via `?pgbouncer=true` in the connection string).

### Rule 5 — pool sizing is deliberate, not scaled-to-peak

- **Request path (Fastify + tRPC)**: 10 connections per pod, ~40 pods at peak = ~400 connections total
- **Worker tier (NestJS)**: 5 connections per pod, ~10 pods at peak = ~50 connections total
- **Admin role**: 2 connections per pod, ~2 pods = ~4 connections total
- **Aggregate Postgres `max_connections`**: 500 (with ~50 headroom for superuser access and migrations)

Exceeding these bounds suggests a connection leak, not a scaling need. Prisma 5 holds connections for the duration of a transaction; long-running connections without commits are the usual culprit.

PgBouncer sits in front with a default pool size of 20 server connections per `(user, database)` — many client connections multiplexed onto a smaller pool of server connections.

### Rule 6 — `app.current_tenant` is verified, not trusted

Inside the transaction wrapper, after `SET LOCAL app.current_tenant = $1`, the wrapper runs:

```sql
SELECT current_setting('app.current_tenant', TRUE);
```

— and verifies the returned value matches the authenticated tenant claim. Mismatch aborts the transaction with a fatal error *and* discards the connection (does not return it to the pool, in case of any residual state). This is a belt-on-belt-on-suspenders check; it almost never fires; it prevents an entire class of "how did this connection have the wrong tenant?" bugs from ever reaching production.

---

## What this prevents

Concretely, the rules above prevent the following failure chain:

1. Tenant A's request issues `SET app.current_tenant = 'A'` (violates Rule 1)
2. Request completes, connection returns to pool with GUC still set
3. Tenant B's request checks out that connection
4. Tenant B's query runs; RLS policy reads `current_setting('app.current_tenant')` → returns `'A'`
5. RLS allows only tenant A's rows to be visible
6. Tenant B's query returns tenant A's data

Silent. No error. No log entry. Cross-tenant leakage.

Rules 1–3 prevent step 1 from happening. Rule 4 prevents a deeper class of session-state leakage. Rule 5 prevents exhaustion scenarios where desperate code paths might try to bypass the wrapper. Rule 6 catches any residual breach.

---

## Monitoring

CloudWatch metrics we track and alert on:

- `Database.PoolUtilization` — sustained > 80% is a capacity signal
- `Database.WrapperGucMismatch` — any non-zero value is a P1 bug (Rule 6 fired)
- `Database.RawSqlExecution` — count of `$queryRaw` calls per day; trending up means we're bypassing the wrapper more than intended
- `Database.ConnectionLeaks` — count of connections held > 60s without commit

A P1 page fires on any `Database.WrapperGucMismatch > 0`. This is not a routine alert; the check is supposed to never fire.

---

## Local development

The rules apply in local dev too. `docker compose up -d` brings up PgBouncer in the same transaction-mode configuration as production. `psql` direct access to the local Postgres is available for debugging, but normal application flow goes through PgBouncer to ensure the dev environment matches production behaviour.

If you're seeing test flakiness that could be tenant-context-related, check whether the test harness is wrapping queries correctly. The `tests/testcontainers/setup.ts` helper handles this for integration tests.

---

## Review discipline

CODEOWNERS routes any PR that touches `packages/prisma-client/`, `database/policies/rls-policies.sql`, or the PgBouncer configuration to @database-owners and @security. These files are the locus of the isolation guarantee; review discipline is strict.

PRs that introduce raw SQL (`prisma.$queryRaw`) additionally route to @security for review of the tenant-injection pattern. The RLS layer catches mistakes here, but the reviewer wants to see an explicit `WHERE tenantId = $1` in the raw query text or a comment naming the specific RLS policy providing the backstop.

---

## References

- [ADR-0002 — Tenant isolation two-layer](../references/adr/0002-tenant-isolation-two-layer.md)
- [database/README.md §1 — Multi-Tenancy via Two-Layer Tenant Isolation](README.md#1-multi-tenancy-via-two-layer-tenant-isolation)
- [docs/04-architecture-tour.md §3.2 — At the database layer](../docs/04-architecture-tour.md#32-at-the-database-layer)
- [docs/07-handbook-for-engineers.md — Common gotchas (connection-pool discipline)](../docs/07-handbook-for-engineers.md)
- PgBouncer documentation — Transaction vs. session mode
- Prisma documentation — Connection pooling and PgBouncer
- PostgreSQL documentation — `SET` vs. `SET LOCAL`

---

*Last reviewed: 2026-04-20.*
