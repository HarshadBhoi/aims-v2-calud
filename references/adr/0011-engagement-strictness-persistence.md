# 0011 — EngagementStrictness as a separate RLS-bound table, idempotently rewritten on resolve

- **Status**: Proposed
- **Date**: 2026-05-01
- **Deciders**: @HarshadBhoi
- **Consulted**: External slice-B plan review (Google Gemini, May 2026)
- **Informed**: engineering, product
- **Tags**: #data-model #multi-standard #database #rls

---

## Context

When two methodologies attach to one engagement, the strictness resolver computes the effective per-rule value via `max` / `min` / `union` / `override_required` (per [`docs/06-design-decisions.md`](../../docs/06-design-decisions.md) §1.8). For Slice A's single-pack case the question was moot — there's no resolution if there's only one input. Slice B exercises this for real: GAGAS requires retention of 7 years (via AICPA AU-C) while IIA has no explicit retention rule; GAGAS independence cooling-off is 24 months, IIA's is 12; CPE hours, documentation requirements, and the `findingElements` union all have similar fork shapes.

The output of resolution — the effective rule set with a `drivenBy` audit trail per rule — needs a home. Slice A doesn't have one. Three plausible shapes: a JSONB blob on `Engagement`, a cached read-model recomputed on demand, or a separate `EngagementStrictness` table. The choice is genuinely architectural because:

- It binds RLS surface (per ADR-0002) to a new per-tenant row class
- It determines whether tenant-level *overrides* are first-class or a future bolt-on
- It determines whether the "why is our retention 7 years?" auditor query is a stored fact or a recomputation

A decision is needed before Slice B W1 since the resolver's persistence shape drives the schema migration.

---

## Decision

`EngagementStrictness` is a **separate Prisma model**, one row per engagement, written by the resolver as an idempotent overwrite (no row history; the audit log captures the transition diff). The row carries one column per canonical rule (retention years, cooling-off months, CPE hours, doc-requirements JSONB, finding-element-required-codes array) plus a JSONB `drivenBy` trail keyed by rule (`{ rule, value, source: { packCode, packVersion, direction } }`). RLS policy mirrors `Engagement`'s pattern per ADR-0002: tenant-scoped, app-role enforced, admin-role bypass for the audit-log viewer.

The resolver re-runs (and overwrites) on `pack.attach`, `pack.detach`, and `pack.upgrade` (future). Each re-run emits a `strictness.resolved` audit-log event capturing the diff from prior values. The current row is the source of truth; history lives in the audit log, not in the table.

**Primary-methodology lifecycle.** The slice plan's invariant is "exactly one `primaryMethodology` per engagement at all times." Two transitions need explicit handling:

1. **Detaching the primary while at least one finding exists.** `pack.detach` of the engagement's current primary methodology is **rejected** unless the same transaction also attaches a replacement primary. The supported affordance is a single `pack.swapPrimary({ from, to })` operation that detaches the current primary and attaches a new one inside one transaction; the resolver re-runs once at the end against the new pack set. Alternative attempted-detach paths return `PRECONDITION_FAILED` with a message naming the swap operation.
2. **Detaching the primary on an engagement with no findings yet.** Treated identically — the invariant is structural, not data-driven. Promoting "the first additional methodology" silently was considered and rejected as too implicit; an audit trail with an explicit user intent is preferable.

Stored finding data is unaffected by these transitions because storage is canonical-keyed per ADR-0010 — what changes is the write-path translation table for *future* `finding.create` submissions and the editor's label-resolution source. A primary swap therefore touches the engagement's pack-attachment graph, the strictness row, and the editor's pack reference, but never decrypts an existing `elementValuesCipher`.

Tenant-level *overrides* (a future feature) extend this via a sibling `EngagementStrictnessOverride` model — out of scope for Slice B but the table shape doesn't preclude it.

---

## Alternatives considered

### Option A — Pure cached read-model, no persistence (rejected)

Compute strictness on demand from the engagement's attached packs; cache in Redis with a TTL.

**Pros**
- Zero schema cost
- Always current — no drift between attached packs and resolved strictness
- Clean for a stateless replay model

**Cons**
- Tenant-level overrides have nowhere to live; deferring them to a future migration is feasible but signals architectural commitment we're not ready to make
- The audit log's "drivenBy" event captures a transition, but the audit-log viewer's query "show me retention=7y for engagement X" can't easily resolve `drivenBy` without recomputing — which means the resolver becomes a hot path for the viewer
- RLS policy doesn't apply (Redis is outside the Postgres trust boundary), so tenant-isolation guarantees move from "ADR-0002 belt + suspenders" to "Redis namespace discipline" — strictly weaker
- Cache invalidation across pack attach/detach/upgrade is real complexity for ephemeral value

### Option B — JSONB column on `Engagement` (rejected)

Store the resolved rule set + `drivenBy` trail as a JSONB column.

**Pros**
- One fewer table; no migration on most engagements (those with no strictness yet have NULL)
- Fast read along with the engagement's other attributes

**Cons**
- Engagement row gets bigger and noisier on every read; cache locality erodes
- `Engagement` is bitemporal (per slice plan §6); strictness lifecycle is *not* (idempotent overwrite) — coupling them forces strictness through the bitemporal write path or requires a "this column doesn't participate in bitemporality" carve-out
- The future `EngagementStrictnessOverride` table would need to JOIN against an `Engagement` JSONB column — clumsy
- RLS via the parent `Engagement` row works but doesn't carve cleanly when a future query wants strictness-only reads (e.g., "show me all engagements where retention is driven by SOX") — the indexes would have to be JSONB GINs, not B-trees

### Option C — Separate table, idempotent overwrite (chosen)

One row per engagement; resolver re-runs replace the row; audit log captures the transition diff.

**Pros**
- Clean RLS surface per ADR-0002 (tenant-scoped, app-role-bound, admin-role bypass for audit viewer)
- Rule columns are first-class — index `retention_years`, query "engagements where cooling-off > 24mo", etc.
- Future tenant-override table joins cleanly via `engagementId` FK
- Strictness lifecycle (idempotent rewrite) is decoupled from `Engagement`'s bitemporality
- The audit log's `strictness.resolved` event is the canonical history; the table is the canonical *current state*; both serve their purpose without confusion

**Cons**
- One more model to migrate, one more RLS policy to write, one more place a bug could leak data across tenants if RLS is wrong (mitigated by the same pattern Slice A's other engagement-scoped tables use)
- A tenant's engagement might briefly have no strictness row between create and first pack attach — handled by treating `null` as "no packs attached, defaults apply" (matches the resolver's existing precondition-failed behavior in [`apps/api/src/packs/resolver.ts:40-44`](../../apps/api/src/packs/resolver.ts#L40-L44))

### Option D — Separate table with row history (append-only) (rejected)

Each resolver run inserts a new row; the latest is current.

**Pros**
- Strictness history is queryable as data
- Rollback is trivial (point at prior row)

**Cons**
- The audit log already captures transitions; duplicating into a table is two sources of truth
- Tenant-override semantics get harder ("override applies as of which row's resolved-at?")
- Most resolver re-runs produce no diff (e.g., re-attaching the same primary pack) — append-only generates churn for no benefit
- Out of scope: nobody has asked for queryable strictness history; Option C with audit-log-as-history is sufficient until they do

---

## Consequences

### Positive
- Slice B W1's resolver work has a clear write target
- ADR-0002's two-layer isolation pattern extends cleanly to the new model — no novel RLS surface
- Future overrides (tenant-level, engagement-level) bolt on without re-architecting
- Audit-log viewer can answer "what changed when?" via existing event-replay; current state is one query
- The `drivenBy` JSONB structure inside the row is ergonomic for the auditor query "why is this rule what it is?"

### Negative
- One more Prisma model + migration + RLS policy + tenant-extension scoping
- Resolver becomes a write-path concern; previously it was read-only. Pack attach/detach now have a transactional dependency on a successful strictness write
- `pack.attach` becomes a multi-statement transaction (attach + resolve + write); failure modes need integration tests for partial writes (pack attached but strictness write failed → reject the whole transaction)

### Neutral
- The `drivenBy` JSONB shape is informally specified here; pack JSON's existing `strictnessDirection` per rule plus pack version supplies all the source data
- Slice A's existing engagements get a NULL strictness row by default; the resolver populates on first pack attach (which slice A engagements already had — re-running the resolver as part of Slice B W1's migration backfills them)

---

## Validation

- If, after Slice B W2, the audit log captures strictness diffs that don't match the table's current state, the resolver's transactional discipline is wrong — fix the write atomicity, not the model
- If a tenant requests override capability before Slice B closes, this ADR's Option D justification weakens (appending overrides to a table is straightforward; re-architecting from cache to table is not)
- If the `drivenBy` JSONB consistently ends up storing the same handful of rule keys, promote those keys to first-class indexed columns — performance-driven, not architectural
- If Postgres LISTEN/NOTIFY ends up on the resolver's write path (so other services can react to strictness changes), revisit the table's idempotent-overwrite shape — append-only might suit a streaming consumer better

---

## Rollout plan

- **Phase 1 — Schema** (Slice B W1, day 1): `EngagementStrictness` model added to [`packages/prisma-client/prisma/schema.prisma`](../../packages/prisma-client/prisma/schema.prisma); reverse relation on `Engagement`; tenant extension scoping in [`packages/prisma-client/src/prisma-extension.ts`](../../packages/prisma-client/src/prisma-extension.ts); Prisma migration generated
- **Phase 2 — RLS policy** (W1 day 1): policy SQL added to [`database/policies/`](../../database/policies/) following the pattern of `engagements`, `findings`, `reports`; integration test for cross-tenant denial
- **Phase 3 — Resolver write path** (W1 day 2-3): `resolvePackRequirements` in [`apps/api/src/packs/resolver.ts`](../../apps/api/src/packs/resolver.ts) becomes `resolveAndPersist`; `pack.attach`/`pack.detach` invoke it inside a transaction with the pack-attachment write
- **Phase 4 — Backfill** (W1 day 3): seed migration runs the resolver against Slice A's existing engagements; populates strictness rows
- **Phase 5 — Audit-log emission** (W1 day 4): `strictness.resolved` event type added; resolver emits on every run with prior + next values

Pre-cloud — slice scope only.

---

## Threats considered

The new table is per-tenant data with an RLS policy. Threat surface is the same as `Engagement` and follows the same mitigations: app-role enforcement plus Prisma extension primary, with admin-role bypass restricted to the audit-log viewer (which already has admin-role discipline per slice A). No new trust boundary.

A misuse risk worth naming: if a future code path queries `EngagementStrictness` directly via the admin client (bypassing RLS) for purposes other than the audit-log viewer or break-glass, it leaks resolved-rule fingerprints across tenants — the worker doesn't need this access; the API never does. Slice B W1 RLS-policy tests must include "admin client cross-tenant read" as an explicit positive case (admin can read across) *and* "app client cross-tenant read" as a negative (app can't), so the boundary is exercised both ways.

---

## References

- [`docs/06-design-decisions.md`](../../docs/06-design-decisions.md) §1.8 — Strictness Resolver narrative (the source of `max` / `min` / `union` / `override_required` semantics)
- [`apps/api/src/packs/resolver.ts`](../../apps/api/src/packs/resolver.ts) — single-pack resolver to extend
- [`packages/prisma-client/prisma/schema.prisma`](../../packages/prisma-client/prisma/schema.prisma) — schema location for the new model
- [`database/policies/`](../../database/policies/) — RLS policy pattern
- [`VERTICAL-SLICE-B-PLAN.md`](../../VERTICAL-SLICE-B-PLAN.md) §3.1 — table referenced in plan; this ADR pins the shape
- Related ADRs:
  - [ADR-0002](0002-tenant-isolation-two-layer.md) — the RLS pattern this table follows
  - [ADR-0010](0010-canonical-finding-storage-shape.md) — companion: the storage shape the resolver's required-element-codes array writes against

---

<!--
CHANGELOG:
- 2026-05-01: Proposed by @HarshadBhoi following Gemini's external review of the Slice B plan
-->
