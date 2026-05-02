# 0010 — Findings store element values keyed by canonical semantic codes, normalized at write time

- **Status**: Proposed
- **Date**: 2026-05-01
- **Deciders**: @HarshadBhoi
- **Consulted**: External slice-B plan review (Google Gemini, May 2026)
- **Informed**: engineering, product
- **Tags**: #data-model #multi-standard #api #encryption

---

## Context

Slice A stores finding element values keyed by **pack-specific element codes**. For an engagement attached to GAGAS, `Finding.elementValuesCipher` (ALE-encrypted per ADR-0001) decrypts to roughly `{ "CRITERIA": "...", "CONDITION": "...", "CAUSE": "...", "EFFECT": "..." }` — the keys are exactly the codes declared in [`gagas-2024.ts`](../../data-model/examples/gagas-2024.ts) `findingElements` (and verified server-side in [`finding.ts:160`](../../apps/api/src/routers/finding.ts#L160)). The same finding under IIA would key on `ROOT_CAUSE` (not `CAUSE`), `CONSEQUENCE` (not `EFFECT`), and add a fifth slot `RECOMMENDATION` per [`iia-gias-2024.ts:690-721`](../../data-model/examples/iia-gias-2024.ts#L690-L721).

For Slice B's central thesis — *the same finding renders correctly under two methodologies, no per-pack branches in the renderer* — the storage shape becomes load-bearing. If keys stay pack-specific, the renderer must call `semanticElementMappings` lookups on every read to translate `ROOT_CAUSE → CAUSE`, and an engagement attached to >1 pack has no canonical answer to "which pack's keys do we store?" The decision can be made once at the API boundary instead of leaking through every consumer.

A decision is needed before Slice B's W1 because the choice drives the migration shape for existing Slice A findings (~50 in seed data, encrypted with per-tenant DEKs).

---

## Decision

`Finding.elementValuesCipher`, after decryption, is keyed exclusively by **canonical semantic codes** from [`SemanticElementCode`](../../data-model/standard-pack-schema.ts) — `CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, `RECOMMENDATION`, etc. Translation from the pack-specific element code (whatever the user's primary methodology calls it) into the canonical code happens **at write time**, in the API procedure, using the resolved primary pack's `semanticElementMappings`. Renderers, the editor's progress bar, and downstream queries operate against canonical keys without any per-pack branching.

The pack-specific code never enters the encrypted payload. The mapping itself is in pack JSON, version-pinned per attachment.

---

## Alternatives considered

### Option A — Read-time normalization (rejected)

Store pack-specific codes; let each consumer translate to canonical on read.

**Pros**
- Zero migration cost for Slice A's existing findings; the read path layers on top
- Storage stays "what the user typed in," which has narrow audit-evidence appeal
- Trivially reversible if a future pack version changes the mapping

**Cons**
- Every consumer (PDF renderer, UI label resolver, finding API, audit-log viewer) must own the same translation logic; drift is inevitable
- An engagement attached to >1 pack has no obvious answer to "which pack's keys?" — read-time would have to pick one, undoing the symmetry
- Translation cost on every read; cache invalidation becomes a thing
- The encryption boundary is the hottest place to do work; ALE + KMS calls + JSON.parse + per-key translation per read is the worst layer to add cycles to

### Option B — Write-time normalization, store canonical keys (chosen)

Translate on submit using the primary pack's `semanticElementMappings`. Store canonical. Read paths consume canonical directly.

**Pros**
- One translator, one place to test, no consumer drift
- Multi-pack engagements have an unambiguous storage shape — the canonical code set is pack-agnostic
- Renderer is genuinely pack-agnostic (the architectural-risk smoke alarm in Slice B §9 stays silent)
- Pack version changes don't restate stored values; the mapping changes only the *next* write

**Cons**
- Slice A's existing findings need migration: decrypt → translate → re-encrypt, per finding, per tenant (per ADR-0001 the DEK is per-tenant, so the migration script is tenant-aware and KMS-call-bounded)
- A pack with no mapping for a slot the user filled in (e.g., GAGAS doesn't map `RECOMMENDATION`; the user typed one anyway) has to either reject the submit, drop the value, or store it under a fallback code — needs an explicit policy
- The write-path is implicitly coupled to "which pack is currently primary": a `finding.create` against engagement E uses E's *current* primary methodology's mappings to canonicalize. Stored data is unaffected by primary changes (canonical keys are pack-agnostic), but the lifecycle of *which pack is primary* needs explicit transition semantics — see ADR-0011's primary-methodology detach policy

### Option C — Dual store (rejected)

Store both pack-specific and canonical, kept in sync on every write.

**Pros**
- "Best of both"; either consumer pattern works

**Cons**
- Twice the encrypted payload size; encryption is the most expensive step and we double it
- Synchronization bugs become a class of finding-data-integrity bugs
- Audit story splinters: which version is canonical for chain hashing?
- No real consumer needs both shapes; the second write exists only to hedge

### Option D — Pack-keyed storage with mappings as a sidecar table (rejected)

Store pack-specific values; maintain a `FindingElementMapping` table that derives canonical at read time.

**Pros**
- Mapping changes can be replayed retroactively against historical findings without rewriting the cipher

**Cons**
- A new table for an in-memory derivation is over-engineering; the mappings already live in pack JSON and pack JSON is already version-pinned
- Mapping replay against historical findings is a feature nobody asked for
- Doesn't solve the multi-pack ambiguity (still pack-keyed, still needs a primary)

---

## Consequences

### Positive
- Slice B's renderer is pack-agnostic by construction, not by discipline
- Multi-pack attachment has a clean storage answer
- API contract for `finding.updateElement` becomes "pass pack-element-code, server normalizes" — symmetrical with how the editor labels work (labels resolved per pack; storage canonical)
- Cross-tenant analytics (future) over canonical codes is a single query, not per-tenant pack-aware translation

### Negative
- Slice A migration: write the decrypt-translate-re-encrypt script with per-tenant DEK awareness; budget ~2-3 days in Slice B W1 (per the revised plan)
- Lost-information edge case: if a future pack version drops a canonical code from its mappings, findings with values under that code render as "unmapped" in that pack's reports — needs a fallback rendering policy (covered by `equivalenceStrength: 'partial'` + `fallbackPrompt` in the pack schema, exercised in Slice B W2)
- Adds a "primary methodology" implicit dependency to `finding.create` — the procedure must read the engagement's primary pack to pick the right mapping table

### Neutral
- The pack JSON contract (`semanticElementMappings`, `equivalenceStrength`) is already specified in [`standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts); this ADR exercises it but does not extend it
- Pack authoring discipline tightens slightly: a pack must declare a mapping for every slot its `findingElements` exposes, or the user-typed value is rejected on submit (clean failure mode)

---

## Validation

- If, after Slice B W1, the migration script corrupts a single finding's cipher in a recoverable-from-backup way, the script's atomicity discipline is wrong — pause, fix, re-run on a fresh seed
- If the renderer later requires *any* `if (pack.code === ...)` branch in `packages/pack-renderer/`, the canonical-key promise has leaked — re-open this ADR
- If a future pack's `semanticElementMappings` proves insufficient for a real-world finding shape (e.g., GAGAS-2026 introduces a sixth element with no canonical analogue), the canonical dictionary itself needs to grow — that's a pack-schema change, not a reversal of this decision
- If multi-pack attach-after-author becomes a frequent pattern (vs. the assumed pattern of attach-before-author), the implicit "primary methodology dictates write-time mapping" breaks down and we revisit

---

## Rollout plan

- **Phase 1 — ADR + migration script** (Slice B W1, day 1-3): formalize this ADR; write `packages/prisma-client/scripts/migrate-finding-elements-to-canonical.ts` with per-tenant DEK loop, per-finding atomic version bump, dry-run mode, and a rollback inverse (the inverse mapping is also `exact` for slice A's GAGAS-2024 seed, so rollback is lossless)
- **Phase 2 — API contract update** (W1 day 4-5): `finding.create` and `finding.updateElement` accept either pack-element-codes or canonical codes during a transition window; server normalizes; deprecation warning logged on pack-code submission
- **Phase 3 — Editor + worker** (W1 end): editor submits canonical codes directly (one client; no transition needed); worker rendering reads canonical
- **Phase 4 — Tighten** (Slice B W4): drop the pack-element-code accept-path; canonical-only submission

Pre-cloud — only the Slice A seed needs migration in dev. Production rollout (when there is one) follows the same pattern with a soak window.

---

## References

- [`apps/api/src/routers/finding.ts`](../../apps/api/src/routers/finding.ts) — current single-pack-bound storage and validation (lines 60-90, 160-185, 350-360)
- [`apps/api/src/packs/resolver.ts`](../../apps/api/src/packs/resolver.ts) — single-pack resolver to extend for the primary-pack lookup
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — `SemanticElementCode`, `SemanticElementMapping`, `EquivalenceStrength`
- [`data-model/examples/gagas-2024.ts`](../../data-model/examples/gagas-2024.ts) and [`iia-gias-2024.ts`](../../data-model/examples/iia-gias-2024.ts) — the two packs Slice B exercises; mappings at lines 1201 and 690 respectively
- [`docs/06-design-decisions.md`](../../docs/06-design-decisions.md) §1.7 — Semantic Element Dictionary narrative
- [`VERTICAL-SLICE-B-PLAN.md`](../../VERTICAL-SLICE-B-PLAN.md) — Slice B plan; this ADR is named in §10 decision-pinning
- Related ADRs:
  - [ADR-0001](0001-ale-replaces-pgcrypto.md) — ALE per-tenant DEK; binds the migration's encryption shape
  - [ADR-0011](0011-engagement-strictness-persistence.md) — companion: where the resolved-pack metadata lives

---

<!--
CHANGELOG:
- 2026-05-01: Proposed by @HarshadBhoi following Gemini's external review of the Slice B plan
-->
