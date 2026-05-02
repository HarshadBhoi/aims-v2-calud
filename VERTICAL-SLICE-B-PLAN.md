# AIMS v2 — Vertical Slice Plan (Slice B: Multi-Standard Rendering)

**Status**: Draft (rev 3, post-Gemini delta-review) · 2026-05-01
**Purpose**: Retire the central architectural risk Slice A deliberately deferred — that *the same finding renders correctly under two methodologies' vocabularies, driven by data, not branched code*. If this fails, "multi-standard" is marketing, not architecture.

This is a narrower slice than A. Substrate, auth, finding loop, report+PDF, OTel, audit log, e2e harness — all already proven in [`VERTICAL-SLICE-PLAN.md`](VERTICAL-SLICE-PLAN.md). Slice B reuses every layer; the new code is concentrated in the pack resolver, the cross-pack renderer, and the multi-report path.

---

## 1. Slice definition

### 1.1 User journey (the single happy path)

1. Sign in (existing).
2. Create engagement; attach **two methodologies**: `GAGAS:2024.1` (primary) and `IIA-GIAS:2024.1` (additional). UI surfaces both slots.
3. Strictness resolver runs at attach-time; produces an `EngagementStrictness` artifact with per-rule `drivenBy` trail (e.g. retention=7y driven-by `GAGAS` via AICPA AU-C; cooling-off=24mo driven-by `GAGAS` over IIA's 12mo).
4. Open the finding editor. The editor renders **canonical-code element slots** (CRITERIA, CONDITION, CAUSE, EFFECT) once — not per-pack. Element values store keyed by canonical code.
5. Author the finding once; submit-for-review; MFA-step-up approve (existing W3 flow, unchanged).
6. Compose **two reports** off the same finding:
   - Report 1 attests to GAGAS — renders the four-element structure under GAGAS labels.
   - Report 2 attests to IIA — renders the same finding under IIA's "5 Cs" vocabulary, sourcing CONSEQUENCE and CORRECTION via `semanticElementMappings` from the canonical EFFECT and (an inline derivation of) RECOMMENDATION.
7. Each report's compliance statement is auto-assembled from the engagement's attached packs, filtered to those with `conformanceClaimed: true`.
8. Sign each report. Worker renders **two distinct PDFs** to S3, each with the correct vocabulary, header, and "conducted in accordance with…" sentence.
9. Audit log shows the strictness resolution event, the cross-pack render events, and both signoffs.

The journey ends with two PDFs in S3 that a GAGAS reader and an IIA reader would each find well-formed.

### 1.2 Acceptance criteria (Definition of Done)

- Engagement attaches ≥2 methodology packs without falling through the `NOT_IMPLEMENTED` branch in the resolver.
- Strictness resolver computes effective rules across both packs with a queryable `drivenBy` trail; re-runs idempotently on attach/detach.
- Finding editor surface drives off **canonical codes**, not per-pack element keys; values persist keyed canonically.
- Cross-pack render produces a structurally-valid IIA report from a GAGAS-shaped finding (and vice versa) with no per-pack branching in the renderer.
- Each report's compliance statement is wired from `attestsTo` + `conformanceClaimed` packs, not hand-edited.
- Two PDFs land in S3 with distinct content hashes, distinct presigned-download flows, and distinct audit-log entries.
- Pack annotation overlays — `tighten` / `override_required` / `loosen` — exercised in **at least one** integration test (does not need a UI surface).
- Equivalence-strength rendering is pinned: `exact` renders verbatim with the target pack's label; `close` renders verbatim with a "(rendered under {sourcePack} mapping)" footer note; `partial` renders the target pack's `fallbackPrompt` and surfaces a warning event in the audit log. The IIA pack's `RECOMMENDATION` mapping is `close` ([iia-gias-2024.ts:715-720](data-model/examples/iia-gias-2024.ts#L715-L720)) so this path is exercised naturally; one synthetic `partial`-equivalence test covers the fallback path.
- **Resolver determinism is testable**: `resolve([A,B])` and `resolve([B,A])` produce equal `EngagementStrictness` rows (resolution is order-independent across secondary packs); when ties exist, the engagement's `primaryMethodology` dominates. Property test in W1.
- **Required-element completion is the union** of all attached packs' required canonical codes (per the strictness resolver's `union` direction in `docs/06 §1.8`). A finding is `complete` only when every code required by *any* attached pack has a non-empty value. UI labels resolve from `primaryMethodology.findingElements`; storage keys are canonical (per ADR-0010).
- 105 → ~140 integration tests passing. Slice-A e2e + a new "slice-B journey" e2e green.

### 1.3 What is explicitly OUT of this slice

Carrying forward Slice A's deferral list, plus:

- **Regulatory overlays** (Single Audit, SOX 404). Stretch only — see §10. Methodology + methodology is enough to retire the architectural risk.
- **Control frameworks** (SOC 2, ISO 27001 as the "what is audited" axis). Slice C territory.
- **Recommendations as a separate entity, many-to-many with findings.** Slice B treats recommendations as inline finding text under the canonical RECOMMENDATION code; the separate-entity shape (per `docs/06 §1.4`) lands when a real second consumer needs it.
- **TipTap rich-text editor.** Carries the `<textarea>` Slice A delta forward.
- **Browser OTel SDK, Collector container, Grafana backend.** Same deferral as Slice A.
- **Pack authoring UI.** Slice B reads pack JSON authored by hand in `data-model/examples/`. A pack admin surface is a separate slice.
- **Pack version transitions mid-engagement.** Engagements pin pack versions at attach-time; mid-stream upgrades are a separate flow.
- **Auditee portal, fieldwork, CAPs, APM, PRCM, multi-finding bulk operations.** All deferred.

---

## 2. Architectural layers touched

| Layer | Status going in | Slice B work |
|---|---|---|
| Pack resolver ([apps/api/src/packs/resolver.ts](apps/api/src/packs/resolver.ts)) | Single-pack, throws `NOT_IMPLEMENTED` for >1 | Multi-pack union; strictness direction; `drivenBy` trail |
| Semantic element dictionary | Defined in pack JSON; unused at runtime | Becomes the runtime source of truth for finding storage keys |
| Finding editor ([apps/web/.../findings/[findingId]/page.tsx](apps/web/app/dashboard/engagements/[id]/findings/[findingId]/page.tsx)) | Element keys = pack-defined codes | Element keys = canonical codes; UI labels resolved per primary pack |
| Finding storage shape | `Record<pack-element-code, string>` | `Record<canonical-code, string>` — schema migration required |
| Report router ([apps/api/src/routers/report.ts](apps/api/src/routers/report.ts)) | One report, one `attestsTo` pack | Many reports per engagement; each `attestsTo` a different attached pack |
| PDF render worker ([apps/worker/src/render/](apps/worker/src/render/)) | Renders directly from finding values | Translates canonical → target-pack vocabulary via mappings before rendering |
| Compliance statement | Hand-entered in editorial sections | Auto-assembled from `attestsTo` + `conformanceClaimed` packs |
| Strictness — `EngagementStrictness` table | Not in schema | New table; reverse relation on `Engagement`; RLS |
| Audit log | Captures every mutation | Captures strictness re-resolves and cross-pack renders explicitly |
| Tenant isolation, ALE, JWT, MFA, outbox, OTel propagation, audit chain, e2e harness | All ✅ | No changes |

Two ADRs are quietly load-bearing here: ADR-0002 (the `EngagementStrictness` table follows the same RLS pattern) and the existing pack-versioning invariant (immutable once published — Slice B does not contradict).

---

## 3. Minimum spec subset

### 3.1 Database tables

Reuse 13/13 from Slice A. New + changed:

- **New: `EngagementStrictness`** — separate model per [ADR-0011](references/adr/0011-engagement-strictness-persistence.md). Keyed by `engagementId`; columns for each canonical rule (retention, cooling-off, CPE hours, doc-requirements, finding-element-required-codes) plus a JSONB `drivenBy` trail (`{ rule, value, source: { packCode, packVersion, direction } }[]`). Idempotent overwrite on resolver re-run; current state is the table, history lives in the audit log via `strictness.resolved` events. RLS policy mirrors `Engagement` per ADR-0002.
- **Changed: `Finding.elementValuesCipher`** — storage shape changes from pack-element-code keys to canonical semantic codes per [ADR-0010](references/adr/0010-canonical-finding-storage-shape.md). Note that this is **ALE-encrypted (per ADR-0001)**, not raw JSONB — so the migration is *not* a Prisma migration. It is an application-layer script that, per tenant, decrypts each finding's payload with the tenant's wrapped DEK, translates keys via the resolved primary pack's `semanticElementMappings`, re-encrypts, and writes back atomically inside a per-finding transaction (with `version` bump for optimistic-concurrency safety against concurrent edits during migration). Rollback path = the inverse mapping (lossless for slice-A's GAGAS-2024 seed since all four mappings are `exact`). Dry-run mode required; KMS-call rate-limit awareness required even at slice scale (~50 findings × N tenants).
- **Changed: `Report.attestsTo`** — already exists; re-validate that it accepts any *attached* pack on the engagement (not just primary).
- **Changed: `Report` unique constraint** — relax to `(engagementId, attestsToPackCode, attestsToPackVersion)` so two reports against the same engagement can coexist if they attest to different packs.

### 3.2 API procedures (new + changed)

- `pack.attach` — accept ≥1 pack; enforce one-and-only-one `primaryMethodology`; allow multiple `additionalMethodologies`; trigger strictness re-resolve.
- `pack.detach` — re-resolve strictness; reject if any report is mid-flight against the detaching pack.
- `engagement.strictness` (new) — return computed effective rules + `drivenBy` trail. Read-only.
- `finding.create` / `finding.updateElement` — element keys validated against the **canonical** dictionary, not against the resolved pack's `findingElements` (per ADR-0010). The **union** of every attached pack's required canonical codes determines completion (per ADR-0011's `EngagementStrictness.findingElementRequiredCodes`). API contract during the W1 transition window accepts either pack-element-codes or canonical codes; canonical-only after W4 (per ADR-0010 rollout phase 4).
- `report.create` — `attestsTo` must be one of the engagement's attached packs (and have `conformanceClaimed: true` for compliance-statement assembly).
- `report.compliance` (new) — return the assembled "conducted in accordance with…" sentence for a report.
- `report.signoff` (existing) — unchanged signature, but the rendered PDF (in the worker) now goes through the cross-pack translator.

### 3.3 UI screens

- **Engagement create / detail** — pack picker now multi-select for `additionalMethodologies`; strictness summary panel shows effective rules and which pack drove each one.
- **Finding editor** — labels driven by `primaryMethodology.findingElements` for ergonomics, but the edit *contract* is canonical-code-keyed values; required-element badge shows progress against the union of canonical codes any attached pack needs.
- **Report composer** — `attestsTo` dropdown lists every attached pack; "compose another report" button creates a sibling report; auto-rendered compliance-statement preview.
- **Audit log viewer** — filter chip for `strictness.resolved` and `report.rendered_cross_pack` event types.

### 3.4 Workflows

Same two state machines as Slice A (finding approve, report sign), unchanged. New: a non-state-machine **resolver-pipeline** with idempotency + observability (one OTel span per resolve), but it isn't user-facing.

---

## 4. Implementation plan (4 weeks, one engineer)

### Week 1 — Resolver + storage migration

W1 is the heaviest week; all of Slice B's foundational data-shape work lands here. The encrypted-migration in particular is *not* a one-shot script — it threads through ALE per ADR-0001 and needs careful atomicity, including a resumable execution model for partial-tenant failures and KMS timeouts (cryptographic data migrations almost always surface these edge cases late, so the budget below treats it as a 4-day deliverable rather than a 3-day one).

- **Day 1** — Schema + RLS for `EngagementStrictness` (per ADR-0011 rollout phases 1-2): Prisma model, tenant-extension scoping, Prisma migration, RLS policy mirroring `Engagement`'s pattern, integration test for cross-tenant denial. Also: implement `pack.swapPrimary({ from, to })` per ADR-0011's primary-methodology lifecycle policy (rejects `pack.detach` of a primary without a same-transaction replacement).
- **Day 2-3** — Resolver write path: extend `resolvePackRequirements` to handle ≥1 pack with strictness direction (`max` / `min` / `union` / `override_required`); drop the `NOT_IMPLEMENTED` branch; rename to `resolveAndPersist`; wrap `pack.attach`/`pack.detach`/`pack.swapPrimary` in a transaction with the strictness write. Property test that `resolve([A,B])` and `resolve([B,A])` produce equal rows (order-independence) and that `primaryMethodology` dominates ties.
- **Day 4-7** — `Finding.elementValuesCipher` migration script (per ADR-0010 rollout phase 1). Treat this as the riskiest deliverable in Slice B; the budget reflects that.
  - Day 4: per-tenant DEK loop, per-finding atomic transaction (decrypt → translate → re-encrypt → version-bump), dry-run mode.
  - Day 5: resumable execution model — checkpoint per (tenant, finding-id-cursor), resume from checkpoint on KMS timeout or partial failure, idempotent rerun, observable progress (OTel span per tenant).
  - Day 6: KMS-call rate-limit awareness (batch DEK unwrap once per tenant rather than per finding), backoff + retry on KMS throttling, surfacing of unrecoverable errors with tenant + finding-id for human triage.
  - Day 7: inverse-mapping rollback path tested against slice-A seed (lossless for the `exact`-only seed mappings); integration test running on slice-A seed end-to-end, all 50 seed findings round-trip through `finding.update` cleanly; staged-rollout dry-run against the dev DB before any "real" run.

**Exit W1**: Multi-pack attach + primary swap work; strictness rows persist with correct drivenBy across order permutations; all slice-A findings have been atomically migrated to canonical-code storage with checkpointed resume verified; the slice-A e2e still passes against the migrated data.

**Pushed to W2 day 1 (was W1 day 7)**: API contract update for `finding.create` / `finding.updateElement` accepting either pack-element-codes or canonical codes; the `engagement.strictness` tRPC procedure. The migration earned the breathing room.

**W1 explicit non-goals**: cross-pack rendering (W2), multi-report UI (W3), annotation overlays (W3). Don't drift.

### Week 2 — Cross-pack rendering

W2 absorbs the API contract update bumped from W1 day 7, so the calendar runs tight. If W2 starts to slip, the cascade target is `report.compliance` auto-assembly (push to W3) before any of the rendering work — the renderer is the architectural-risk surface; compliance-statement assembly is mechanical.

- **Day 1** — API contract update bumped from W1: `finding.create` and `finding.updateElement` accept either pack-element-codes or canonical codes; server normalizes to canonical; deprecation warning logged on pack-code submission. `engagement.strictness` tRPC procedure (read-only, returns the persisted row + drivenBy trail).
- **Day 2-4** — Build `packages/pack-renderer/` (this *is* a second consumer, so per slice-A delta `3.1` it earns extraction): given a finding (canonical-code-keyed) and a target pack, produce an `Array<{ label, value, source }>` for the renderer to lay out.
- **Day 3-4** (overlapping) — `equivalenceStrength` honored: `exact` renders verbatim; `close` renders with a `(rendered under {sourcePack} mapping)` footer note; `partial` renders the fallback text from the target pack's `findingElements[i].fallbackPrompt` (new pack-schema field) and surfaces a warning event.
- **Day 5** — Wire the worker's pdfkit renderer through `pack-renderer` instead of reading finding values directly.
- **Day 6-7** — `report.compliance` procedure + the auto-assembly logic. Integration tests: GAGAS finding → IIA render, IIA finding → GAGAS render, finding with one missing canonical code → fallback path.

**Exit W2**: Single finding renders into two distinct PDFs in S3; both download via presigned URLs; content hashes diverge.

### Week 3 — Multi-report + UI

- Relax the report unique constraint; allow N reports per engagement keyed by `attestsTo`.
- Report composer UI: `attestsTo` dropdown filtered to engagement's attached packs; "compose another report against a different pack" affordance.
- Finding editor UI: switch labels source to `primaryMethodology.findingElements`; storage contract switches to canonical-code keys (server-enforced).
- Strictness summary panel on engagement detail.
- Audit log viewer event-type filters for the two new event types.
- Pack annotation overlay: implement `tighten` and `override_required` directions in resolver; one integration test (no UI surface).

**Exit W3**: A user can author one finding and produce two well-formed reports through the UI.

### Week 4 — E2E, soak, polish, spec-delta

- Slice-B Playwright e2e — full journey: sign-in → engagement → attach two packs → author finding → compose two reports → sign each → wait for both PDFs → download both → verify distinct content.
- Soak: 50 findings × 2 packs each, render 100 PDFs sequentially through the worker; capture render-time distribution and outbox lag.
- Performance pass — same shape as Slice A's W5 pass; targets are still informational (no SLO).
- Cross-tenant isolation sweep — extend the W5 sweep to the new procedures (`engagement.strictness`, multi-report `report.create` shapes).
- Spec-delta entries for any drift surfaced.
- Status updates to `CLAUDE.md` + this doc.

**Exit W4**: Slice B closed. Multi-standard claim retired from "unproven" to "demonstrated end-to-end on dev laptop."

---

## 5. Reconciliation with existing `phases/` files

Slice A's phases reconciliation banners cover the relevant Phase 1+2 files. Slice B touches none of those banners; it does add ADR-backed banners to two more leaves where it surfaces new constraints:

| `phases/` file | Slice B adds |
|---|---|
| `phase-2-core-engine/2.1-standards-abstraction.md` | Refresh banner — strictness resolver and cross-pack renderer are now load-bearing, not aspirational. |
| `phase-4-multi-standard/4.3-crosswalk-engine.md` | New banner — Slice B's `pack-renderer` package is the seed of this; future work extracts more crosswalk logic out of it. |
| `phase-4-multi-standard/4.6-standard-pack-sdk.md` | New banner — pack JSON contract finalized for what Slice B exercises (`semanticElementMappings`, `equivalenceStrength`, `fallbackPrompt`). |

Hold the line on the other 33 phase-3+ leaves — same reasoning as Slice A's W5 closeout (their phase OVERVIEW banners already redirect).

---

## 6. Environment & infra

No changes from Slice A. Same docker-compose, same LocalStack KMS+S3+SQS, same Postgres roles (`aims_app` + `aims_migration`), same `.env.local` shape with both `DATABASE_URL` and `DATABASE_ADMIN_URL`. The only new thing is two seeded packs instead of one, and `IIA-GIAS:2024.1` is already in [`data-model/examples/iia-gias-2024.ts`](data-model/examples/iia-gias-2024.ts) — port the same way GAGAS-2024 was.

---

## 7. Test plan

### 7.1 Unit tests (Vitest)

- Resolver — all four directions, multi-pack input, annotation overlays, idempotency.
- Pack renderer — `exact` / `close` / `partial` paths, missing-code fallback.
- Compliance-statement builder — single-pack, multi-pack, conformance-claimed filtering.

### 7.2 Integration tests (Vitest + Testcontainers, via slice-A pattern)

- Engagement attach two packs → strictness row populates → drivenBy trail correct.
- Finding authored once → two reports → cross-pack render produces structurally distinct PDFs in S3.
- Detach pack while a report is in `IN_REVIEW` against it → reject.
- One annotation overlay scenario per direction.
- Cross-tenant isolation across `engagement.strictness`, multi-report `report.create`.
- Migration script — runs on seed data without dropping any element values.

### 7.3 E2E (Playwright)

- Slice-A journey — still green after storage migration.
- Slice-B journey — full happy path described in §1.1.

### 7.4 Soak (informal)

50 findings × 2 packs, 100 PDF renders, capture worker queue depth and render-time p95. No gates; just a reality check before declaring slice closed.

---

## 8. Risks & known unknowns

| Risk | Likelihood | Mitigation |
|---|---|---|
| The example pack `semanticElementMappings` aren't faithful to real GAGAS / IIA semantics; cross-render produces nonsense to a domain reader | Medium | Have the slice-B PDFs reviewed by someone with internal-audit domain context (the user) before declaring W2 exit. The mappings are pack content, not code — fixes are pack edits, not migrations. |
| `Finding.elements` storage migration breaks slice-A seed data | Low | One-shot migration tested on seed before applying; rollback is the inverse mapping (also `exact` for GAGAS-2024). |
| Strictness `drivenBy` trail growth (proportional to packs × rules) explodes for engagements with many packs | Low at this scale | Slice B caps at 2 packs by acceptance criteria; the trail is JSONB, not a fanout table. Revisit when a real engagement attaches 5+ packs. |
| Pack annotation overlays land underspecified — slice-A's resolver stub becomes "real enough to lie" | Medium | Acceptance criteria require **at least one** annotation integration test in W3. If it's not implementable end-to-end in one day, defer the annotation surface to slice C and document as a delta. |
| Worker render-time regresses under multi-pack PDFs (more lookups per element) | Low | OTel spans on resolver + renderer; if p95 doubles, batch the canonical→target translation per report rather than per-element. |
| Single Audit overlay (the regulatory-overlay axis) tempts as a "while we're here" addition | High (this is exactly the scope-creep CLAUDE.md §6 warns about) | Hold the line. §1.3 makes this an explicit deferral; the architectural risk is methodology+methodology, not three-pack-axis. |

---

## 9. What success looks like

The substrate question Slice B retires: *can the same finding render correctly under two methodologies, driven by data, with no per-methodology code branches in the renderer?*

End-of-slice deliverables:

- Two PDFs in S3 from one finding — distinct hashes, both well-formed, each carrying the right pack's vocabulary and compliance statement.
- A `drivenBy` audit trail a future auditor could query to answer "why is our retention 7 years on this engagement?".
- A `pack-renderer` package whose source of truth is pack JSON, not TypeScript.
- ~140 integration tests passing; both Slice A and Slice B Playwright journeys green.
- A spec-delta log addendum cataloguing W1-W4 drift.

The slice **fails** if cross-pack rendering requires an `if (pack.code === 'GAGAS')` branch anywhere in the rendering path. That's the architectural smoke alarm.

---

## 10. Decision points before starting

The plan went through one round of external review (Gemini, 2026-05-01) before this revision; what came back is reflected in §1.2 (pinned acceptance criteria), §3.1 (corrected migration shape), §4 W1 (re-budgeted day-by-day), and the two new ADRs in §11. The remaining gates are below — pinned where the review either agreed or where the trade-off is now explicit.

1. **Pack pair confirmed**: GAGAS-2024.1 + IIA-GIAS-2024.1. **Pinned.** The IIA pack has 5 mappings, one `close` ([iia-gias-2024.ts:715-720](data-model/examples/iia-gias-2024.ts#L715-L720)), which exercises the cross-pack render path naturally. Alternates carry no extra signal.
2. **Strictness resolver scope**: retention, cooling-off, CPE-hours, doc-requirements, and the union of required canonical codes (the fifth driven by the `findingElements` rule in `docs/06 §1.8`). **Pinned.** Anything else punts to Slice C.
3. **Finding storage shape & migration**: canonical-code-keyed at the encrypted-payload layer, normalized at write time. **Pinned via [ADR-0010](references/adr/0010-canonical-finding-storage-shape.md).** Migration is the per-tenant decrypt-translate-re-encrypt script in §4 W1 day 4-6 (not a Prisma migration); rollback is the inverse mapping (lossless for slice-A's `exact`-only seed).
4. **`EngagementStrictness` persistence**: separate Prisma model with RLS per ADR-0002; idempotent overwrite on resolver re-run; history lives in the audit log via `strictness.resolved` events. **Pinned via [ADR-0011](references/adr/0011-engagement-strictness-persistence.md).** Tenant overrides (`EngagementStrictnessOverride`) are a future bolt-on the table shape doesn't preclude.
5. **`pack-renderer` package extraction**: extract immediately to `packages/pack-renderer/` per slice-A delta `3.1` (the "extract when there's a second consumer" criterion is met by `apps/api` + `apps/worker`). **Reviewed and held as a build-time choice — no ADR.** The slice-A delta's framing is the explicit justification; promoting to ADR ceremony would add no signal a future engineer couldn't recover from `git log --grep`.
6. **Stretch — Single-Audit overlay as a third pack in W4 buffer**: **no.** Three-pack rendering retires no architectural risk that two-pack rendering doesn't already retire; the regulatory-overlay axis is a Slice C question. Holding the line on this is exactly the scope-creep CLAUDE.md §6 warns about.

---

## 11. Open items / future slices (not in scope for Slice B)

Carries forward Slice A's deferral list. New items surfaced by Slice B's scoping:

- **Pack authoring UI** — pack JSON edited by hand in `data-model/examples/` is fine for two slices; a pack admin surface is its own slice.
- **Pack version transition flows** — engagement pinned to `GAGAS:2024.1`; what happens when `GAGAS:2025.1` ships? Out of scope; covered in `docs/06 §1.6` narratively.
- **Recommendations as a separate entity** — Slice B's inline-text-under-RECOMMENDATION shape is a deliberate scope choice. The separate-entity model (per ADR-pending and `docs/06 §1.4`) lands when a real consumer (CAP follow-up, audit-committee report rendering) needs it.
- **Strictness resolver → policy enforcement** — Slice B *computes* effective rules; it doesn't *enforce* them (e.g., reject a finding that doesn't meet retention semantics). Enforcement is a follow-up; the data is in place.

---

## 12. References

- [`VERTICAL-SLICE-PLAN.md`](VERTICAL-SLICE-PLAN.md) — Slice A plan + the substrate Slice B builds on.
- [`SPEC-DELTA-LOG.md`](SPEC-DELTA-LOG.md) — Slice A drift, including the resolver + textarea + worker-session deltas Slice B inherits.
- [`docs/06-design-decisions.md`](docs/06-design-decisions.md) §1.6, §1.7, §1.8 — pack versioning, semantic element dictionary, strictness resolver narrative.
- [`docs/03-the-multi-standard-insight.md`](docs/03-the-multi-standard-insight.md) — the thesis Slice B operationalizes.
- [`data-model/standard-pack-schema.ts`](data-model/standard-pack-schema.ts) — `semanticElementMappings`, `equivalenceStrength`, `findingElements` definitions.
- [`data-model/examples/gagas-2024.ts`](data-model/examples/gagas-2024.ts) and [`iia-gias-2024.ts`](data-model/examples/iia-gias-2024.ts) — the two packs Slice B exercises.
- [`apps/api/src/packs/resolver.ts`](apps/api/src/packs/resolver.ts) — the existing single-pack resolver, structured for Slice B extension.
- [`apps/api/src/routers/finding.ts`](apps/api/src/routers/finding.ts) — current pack-element-code-bound storage and validation; the encryption boundary at lines 60-90, 160-185, 350-360 is the migration's load-bearing surface.
- ADR-0001 (ALE per-tenant DEK; binds Slice B's migration shape), ADR-0002 (RLS pattern for the new strictness table), [ADR-0010](references/adr/0010-canonical-finding-storage-shape.md) (canonical finding storage shape; load-bearing for W1), [ADR-0011](references/adr/0011-engagement-strictness-persistence.md) (`EngagementStrictness` table shape; load-bearing for W1), ADR-0008/0009 (Accepted but not exercised in slice B; Slice C territory).

---

*Draft revised 2026-05-01 (rev 3) against Gemini's delta-review of the rev-2 revision. ADR-0010 amended to drop the misleading re-translation bullet; ADR-0011 amended with explicit primary-methodology detach lifecycle (`pack.swapPrimary` is the supported affordance). W1 migration re-budgeted as 4 days with a resumable execution model; API contract update pushed to W2 day 1 with the cascade-risk surface named. The §10 gates are pinned; W1 starts when you're ready.*
