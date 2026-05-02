# 0012 — Compliance statement snapshotted at sign-off; live for drafts

- **Status**: Proposed
- **Date**: 2026-05-02
- **Deciders**: @HarshadBhoi
- **Consulted**: External W2-milestone review (Google Gemini, May 2026)
- **Informed**: engineering, product, legal
- **Tags**: #data-model #multi-standard #legal #api

---

## Context

`report.compliance` returns the "conducted in accordance with…" sentence that names the standards a report attests to. Slice B's first cut computed this sentence live on every read, sourcing the engagement's currently-attached packs filtered to `conformanceClaimed=true` and ordering them with `attestsTo` first.

For a DRAFT report this is correct — the auditor wants live feedback as they iterate on pack attachments and engagement scope. But once the report is **signed**, it is a legal artifact: an attestation claim by named auditors that the work conformed to specific standards as of a specific date. If the engagement's pack attachments change after sign-off (a new methodology attached for a follow-up engagement, a methodology detached as scope contracts), live recomputation would silently mutate the published report's attestation claims — a serious integrity problem for an audit document. Gemini's W2-milestone review surfaced this gap explicitly.

A decision is needed before Slice B closes — the W2 implementation already lands `report.compliance` and any consumer expecting it to be stable across signed-report reads needs the snapshot semantics from day one.

---

## Decision

The compliance sentence's lifecycle mirrors the report's: live while DRAFT, snapshot at sign-off, frozen forever after.

Concretely:

1. **DRAFT path** (`isDraft = true`, no `signedAt`): `report.compliance` computes the sentence on each call from the engagement's currently-attached `conformanceClaimed=true` packs. Returns `frozen: false` so callers can render a "preview — will be locked at sign-off" affordance.

2. **Sign-off** (`report.sign` mutation): inside the same transaction that flips the version to `isDraft = false`, computes the live sentence one final time and writes it to a new column `ReportVersion.complianceStatement` (nullable string). The structured `claims` array is *not* preserved — only the human-readable sentence is the legal artifact; structured metadata can be recovered from the audit log if needed.

3. **SIGNED path** (`signedAt != null`, `complianceStatement != null`): `report.compliance` returns the persisted sentence with `frozen: true` and `claims: []`. Subsequent pack-attachment changes never affect a signed report's compliance text.

---

## Alternatives considered

### Option A — Always live-compute (rejected)

The W2 first-cut behavior. Every call recomputes from current attachments.

**Pros**
- One code path; no schema change.
- A pack-attachment fix made after sign-off automatically propagates to every report.

**Cons**
- Catastrophic legal-integrity bug. A signed audit report cannot silently change its conformance claims. If a litigation challenges "did this report claim GAGAS conformance?", the answer must come from the report as it was signed, not as it was recomputed last Tuesday.
- "A pack-attachment fix automatically propagates" is exactly the wrong outcome for a published artifact — corrections to a signed report should require a new version with explicit auditor sign-off, not silent mutation.
- A subsequent slice that adds tenant-level overrides or pack-version transitions makes this strictly worse.

### Option B — Snapshot at sign-off into `ReportVersion.complianceStatement` (chosen)

Live for drafts; persisted snapshot at sign-off; SIGNED reads return the snapshot.

**Pros**
- Legal-integrity preserved: a signed report's compliance claim is what was claimed *at sign time*.
- Schema cost minimal: one nullable text column.
- Implementation simple: the `report.sign` transaction extends with one more write; the `report.compliance` read forks on `version.complianceStatement !== null`.
- Future-proof: when slice C (or later) introduces published-report amendments, the new ReportVersion gets its own snapshot at the new sign-off.

**Cons**
- Two code paths in `report.compliance` (live vs. frozen). Mitigated by a single `computeLiveCompliance` helper that both procedures share.
- The persisted sentence is not currently included in `contentHash` (the report's tamper-evident anchor). Adding it would make slice B's content-hash computation depend on this column's content. Deferred — see Validation below.
- The structured `claims` array is dropped on freeze. If a future consumer needs structured access to the at-sign-time pack list, the audit-log entry from `pack.attach`/`detach` events can reconstruct it. Acceptable for slice B.

### Option C — Embed compliance into `contentCipher` as a section (rejected)

Store the sentence as a `compliance_statement` section in `ReportSectionsInput`.

**Pros**
- Naturally covered by `contentHash` — tampering with the sentence post-sign would break the hash.
- Single source of truth: the contentCipher is THE legal artifact, and its sections are naturally signed.

**Cons**
- Section-text shape is `{ kind: "data" | "editorial", content: string }`; compliance is neither — it's auto-derived. Adding a third `kind` (or treating it as a data section) couples it with the data-section regeneration path in `regenerateDataSections`, which would require the regenerator to know about live-vs-snapshot semantics.
- The DRAFT path becomes either "regenerate compliance every time data sections regenerate" (which fires on every save) or "don't regenerate, just stamp at sign" (which means draft and signed paths diverge inside the section model). Either is messier than Option B's column.
- More invasive: requires changes to `ReportSectionsInput` validation, `computeReportContentHash`, and the worker's PDF renderer. Slice B is closing; option B's footprint is smaller.

### Option D — Snapshot into `Report.complianceStatement` (rejected)

Same idea as B but on the parent `Report` row, not the version.

**Pros**
- Simpler model — every report has one compliance statement.

**Cons**
- Reports can have multiple versions (slice B's report.regenerateDataSections produces an updated version). If a draft is signed, then a later draft amends and is re-signed, the `Report.complianceStatement` column would need to be rewritten — losing the historical record. Per-version snapshots preserve the "what was claimed at THIS sign-off" record.

---

## Consequences

### Positive
- Signed reports are immune to silent compliance mutation when packs change.
- DRAFT live computation preserves the iterative authoring UX.
- One nullable column; minimal schema cost.
- Future amendment slices fit the model — each amended version captures its own snapshot.

### Negative
- The persisted sentence isn't yet part of `contentHash`. A motivated tampering attempt could edit `complianceStatement` directly in the DB without breaking the hash. Mitigated by RLS + admin-only write access; further mitigated when (future) we extend `contentHash` to cover the sentence.
- The structured `claims` array is dropped on freeze. Consumers that want at-sign-time pack metadata reconstruct from the audit log.
- Two code paths in `report.compliance` (live vs. frozen). One helper (`computeLiveCompliance`) shared between sign and the read path.

### Neutral
- DRAFT consumers see `frozen: false`; SIGNED consumers see `frozen: true`. UI clients can render different affordances if useful (preview banner vs. published lock).
- The W2 first-cut tests for `report.compliance` continue to exercise the DRAFT path; new tests cover the freeze + post-pack-change-immutability behavior.

---

## Validation

- If a tenant edits a pack attachment via raw SQL (bypassing the API) on a signed report's engagement, the signed `complianceStatement` should be unchanged on a subsequent `report.compliance` read. Slice-B integration test covers this.
- If a future slice extends `contentHash` to cover `complianceStatement`, the existing snapshot rows backfill cleanly: hash recomputation happens lazily or on next sign.
- If the persisted sentence ever proves insufficient (e.g., a UI badge list needs the structured `claims`), promote a `complianceClaimsSnapshot Json` column alongside. Until that need is real, JSON sprawl is over-engineering.
- If audit teams want to amend a published report's compliance text without a full re-sign, reconsider this ADR — the architectural answer is "amendment = new version = new snapshot," not "edit in place."

---

## Rollout plan

- **Phase 1 — Schema + sign path** (W2 closeout, this commit): `ReportVersion.complianceStatement` column added; `report.sign` snapshots inside the existing transaction; `report.compliance` forks on the column being non-null.
- **Phase 2 — Tests** (W2 closeout, same commit): integration test where a signed report's compliance text stays unchanged after a `pack.attach` mutates the engagement's attachment graph.
- **Phase 3 — `contentHash` extension** (future slice): include `complianceStatement` in the canonical input to `computeReportContentHash`. Existing signed rows are exempted (their hash was computed without it; including it now would break verification).

Pre-launch — slice scope only. No data migration needed (the column is nullable; existing reports were never signed in this codebase outside tests, and tests re-seed).

---

## Threats considered

A signed report's compliance claim is a legal artifact. The threats:

- **Direct DB tampering of `complianceStatement`** — an actor with admin DB access could rewrite the column without breaking `contentHash`. Mitigated by ADR-0002 RLS (admin-role access is restricted to migration tooling and the audit-log viewer) plus future content-hash extension. Slice B's threat model accepts this gap; W2 closeout flags it for slice C.
- **Replay of old `report.compliance` reads on a since-mutated engagement** — the legal claim is preserved by the snapshot, but a stale UI cache could *display* old text. Acceptable; the underlying truth is in the DB.
- **A draft report's live compliance "preview" leaks future-state claims** — a user attaches a pack, then detaches it before signing. The live computation showed both states. This is correct behavior — drafts are by definition iterative.

---

## References

- [`packages/prisma-client/prisma/schema.prisma`](../../packages/prisma-client/prisma/schema.prisma) — `ReportVersion.complianceStatement`
- [`apps/api/src/routers/report.ts`](../../apps/api/src/routers/report.ts) — the `compliance` query + `sign` mutation that snapshots
- [`packages/validation/src/report.ts`](../../packages/validation/src/report.ts) — `ReportComplianceStatement` type with `frozen` discriminator
- [`VERTICAL-SLICE-B-PLAN.md`](../../VERTICAL-SLICE-B-PLAN.md) §1.1 + §3.2 — compliance statement requirement
- Gemini W2-milestone review (chat record, 2026-05-02; question 3b)
- Related ADRs:
  - [ADR-0002](0002-tenant-isolation-two-layer.md) — RLS pattern that gates direct-DB tampering
  - [ADR-0010](0010-canonical-finding-storage-shape.md) — companion: the canonical-data thesis that makes cross-pack rendering deterministic enough to snapshot

---

<!--
CHANGELOG:
- 2026-05-02: Proposed by @HarshadBhoi following Gemini's W2-milestone review
-->
