# Multi-Standard Engagement Design

> **Status**: **Accepted** — all 8 decisions locked; Q1, Q2, Q3, Q6 resolved; Q4, Q5 deferred (non-architectural).
> **Date**: 2026-04-20
> **Deciders**: Product + Architecture
> **Supersedes**: Implicit single-standard-per-engagement assumption in `data-model/standard-pack-schema.ts` (current `StandardPack` schema treats engagements as single-pack; this design formalizes multi-pack support with a refined taxonomy)

---

## 1. Context + Problem Statement

### 1.1 The question
Can a single audit engagement legitimately claim compliance with more than one professional standard simultaneously? If yes — how is that modeled?

Our current data model (`data-model/standard-pack-schema.ts`) implicitly assumes single-standard-per-engagement. An engagement is created against one `StandardPack`, which drives its workflow, finding schema, report structure, and compliance claims. This assumption needs re-examination.

### 1.2 Why it matters
Three scenarios we must serve exist in the real market:

1. **GAGAS + IIA GIAS** — common in US public-sector internal audit (state auditor offices, federal OIGs, university audit shops). IIA's own "Orange Book" tool exists specifically to align the two standards.
2. **Single Audit** — statutorily mandated for federal-fund recipients > $1M. 2 CFR 200 requires *GAAS + GAGAS + Uniform Guidance* simultaneously. ~40,000 Single Audits/year in the US alone.
3. **Integrated Audit (PCAOB)** — every US public company. AS 2201 mandates FS + ICFR integration in one engagement producing dual opinions.
4. **ISO Integrated Management System audits** — IAF MD 11:2023 formally supports one engagement covering ISO 9001 + 14001 + 27001 + 45001 etc.

Single-standard-per-engagement forces users into fictions (creating parallel engagements for one actual audit), breaks finding uniqueness, and makes Single Audit impossible to model.

### 1.3 What needs deciding
- Engagement-to-standards cardinality + shape
- Finding schema when multiple standards have different element structures (GAGAS 4 vs IIA 5 vs ISO 3 vs SOX variable)
- Recommendation entity placement (GAGAS separates; IIA integrates; SOX forbids auditor-issued)
- Report structure reconciliation (one report vs parallel reports per standard)
- Conflict resolution when standards differ on independence/retention/CPE rules
- Taxonomy for what a "standard" actually is — is GAGAS the same kind of object as SOC 2?

---

## 2. Research Summary

### 2.1 Three primary-source research streams
All web-verified against primary sources:

**Stream 1 — Real-world practice + regulatory stance**: multi-standard engagements are common and in several cases *statutorily required*. GAGAS explicitly permits combination ("in conjunction with other professional standards"). IIA GIAS Standard 15.1 allows it with function-level QAIP support. PCAOB AS 2201 *mandates* integration. Uniform Guidance (2 CFR 200.515) *mandates* stacking.

**Stream 2 — Finding element reconciliation**: Semantic cores converge more than labels suggest. Criteria ≈ Criteria. Condition ≈ Condition/Evidence. Cause ≈ Root Cause. Effect ≈ Consequence/Risk. The *Recommendation* is the real divergence — GAGAS treats it as a separate report section, IIA integrates into the finding, ISO treats OFIs as a distinct finding type, SOX prohibits it (auditor independence).

**Stream 3 — Commercial audit platforms** (validated against live docs): no current product solves engagement-level multi-standard methodology as a first-class capability.

### 2.2 Three competitive validations (live docs)

| Product | Multi-standard engagement? | Methodology as object? | GAGAS 4-element finding? | Government audit? |
|---|---|---|---|---|
| **AuditBoard / Optro** (post-rebrand Mar 2026) | No (control-library mapping only) | No | No | No — Fortune 500 only |
| **ServiceNow IRM** | No (transitive via Control → Citation → Authority Document) | No (flat Authority Document type) | No (generic Issue) | Federal CAM only, not IRM |
| **TeamMate+ / Wolters Kluwer** | No (project templates) | No (TeamStore library content) | No (customer-configured) | Yes (800+ agencies) but via alignment language, not enforcement |

**Net**: no competitor treats methodology as a first-class versioned object. AuditBoard's "30+ frameworks" is control-library mapping. ServiceNow's Authority Document conflates methodology with control framework. TeamMate+ has the government footprint but encodes methodology as implementation-services-built project templates.

### 2.3 Key strategic signals from validation
- **Wolters Kluwer acquired StandardFusion (Jan 9 2026, ~€32M)** — 150+ compliance frameworks, cross-framework control mapping. This is control-framework mapping, not audit-methodology-as-object. Does *not* close the government audit gap for methodology.
- **OSCAL exists in production** via ServiceNow CAM + Pathways' OSCAL NOW app. Covers NIST 800-53 style control catalogs. Does *not* cover audit methodology standards (GAGAS/IIA/ISO 19011) — those remain unformatted.
- **ServiceNow IRM's schema evidence is decisive**: `sn_audit_engagement` has M2M to Controls/Risks/Profiles but no direct M2M to Authority Documents. Standards attach transitively through controls. Schema-level proof the incumbent does not model methodology at the engagement level.

---

## 3. Key Decisions

### Decision 1 — Three-tier standard taxonomy (new)

Split `StandardPack` into three semantic types via a `packType` discriminator. Previously all packs were conflated; this distinguishes *how you audit* from *what you audit against* from *what regulations add on top*.

| `packType` | Meaning | Examples | Drives |
|---|---|---|---|
| `methodology` | *How* to audit — professional audit standards | GAGAS 2024, IIA GIAS 2024, ISO 19011:2018, PCAOB AS 2201, ISSAI | Workflow, finding schema, report format, conformance statements |
| `control_framework` | *What* to audit against — control catalogs | SOC 2, ISO 27001:2022, NIST 800-53, COBIT 2019, HIPAA, PCI DSS, CIS | Control library, test procedures, compliance mapping |
| `regulatory_overlay` | Additional requirements layered on top | Single Audit (2 CFR 200), SOX ICFR (SEC rule 13a-15), CSRD/ESRS, SOX §404 | Extra fields, additional reports, specific retention, overlay schedules |

**Why this matters**: This is the distinction ServiceNow IRM's flat `Authority Document` conflates. It's also where Wolters Kluwer may try to blur lines after the StandardFusion acquisition. Keeping them separate is a defensible market position *and* a clearer mental model for auditors.

**Citations**:
- GAGAS 2024 Chapter 2 ("incorporates … AICPA AU-C … and recognizes that auditors may use other professional standards in conjunction with GAGAS")
- IIA GIAS 2024 Standard 15.1 (Final Engagement Communication — conformance phrase mechanics)
- 2 CFR 200.514(a), 200.515 (Single Audit as regulatory overlay over GAGAS methodology)

### Decision 2 — Engagement carries primary + additional standards (not flat multi-select)

```ts
// Reference to any pack — methodology, control framework, or regulatory overlay
interface StandardPackRef {
  packCode: string;                    // e.g., "GAGAS", "IIA_GIAS", "SOC2"
  packVersion: string;                 // e.g., "2024"
  scope?: 'global' | `tenant:${string}`; // Q6 — reserved for future tenant overrides; default 'global'
  // Only meaningful when attached to an Engagement:
  conformanceClaimed?: boolean;        // Q3 — will this pack be cited in the report's "conducted in accordance with" sentence? (default true for primary)
}

interface Engagement {
  // Methodology — drives workflow, finding schema, default reports (exactly ONE primary)
  primaryMethodology: StandardPackRef;                 // must resolve to a pack with packType === 'methodology'
  additionalMethodologies: StandardPackRef[];          // ordered by applicability; all methodology packs

  // Control frameworks — what the engagement tests against (zero or more)
  controlFrameworks: StandardPackRef[];                // all packType === 'control_framework'

  // Regulatory overlays — layered requirements (zero or more)
  regulatoryOverlays: StandardPackRef[];               // all packType === 'regulatory_overlay'

  // How the multi-standard structure should be interpreted
  engagementMode: EngagementMode;
}

type EngagementMode =
  | 'single'              // one methodology, no additionals
  | 'integrated'          // PCAOB AS 2201 style (FS + ICFR in one engagement)
  | 'statutory_stacked'   // Single Audit (GAGAS + Uniform Guidance required by law)
  | 'combined'            // ISO IMS (multiple ISO standards per IAF MD 11)
  | 'in_conjunction';     // GAGAS "in conjunction with" IIA — elective combination
```

The `scope` field (Q6) is reserved now so future customer-managed pack overrides can be added without refactoring every entity that carries a `StandardPackRef`. The `conformanceClaimed` field (Q3) allows applying a methodology without publishing the conformance attestation — useful when a shop uses IIA methodology but doesn't meet GIAS's function-level QAIP requirements.

**Why primary + additional rather than flat multi-select**:

1. **Workflow defaulting** — primary picks the approval chain, planning template, default finding schema, report skeleton. Secondaries add fields; they don't compete for the default.
2. **UI clarity** — auditors anchor on one standard mentally. "This is a GAGAS performance audit that also addresses IIA conformance" is how practitioners actually talk.
3. **Reporting** — primary drives section order; secondaries inject compliance statements + additional schedules.
4. **Conflict resolution** — a strictness resolver (Decision 6) has a clear precedence rule.

**Why not single-methodology-only**: Single Audit + Integrated Audit + ISO IMS + GAGAS+IIA shops *structurally require* multiple standards. Single-only forces fictions.

**Why not flat methodology list**: practitioners think in primary + additional; flat multi-select is harder to teach, harder to default, harder to resolve conflicts in.

### Decision 3 — Findings use semantic core + per-standard extensions

```ts
// Canonical semantic element codes — extensible via pack authoring (Q2)
// Packs can declare new codes; the enum below is the shipped baseline.
type SemanticElementCode =
  | 'CRITERIA' | 'CONDITION' | 'CAUSE' | 'EFFECT'
  | 'RECOMMENDATION' | 'EVIDENCE' | 'NC_CLAUSE'
  | 'QUESTIONED_COST' | 'ASSERTION_AFFECTED'
  // COBIT-ready (not shipped at MVP; here to illustrate extensibility):
  | 'CAPABILITY_TARGET' | 'CAPABILITY_CURRENT' | 'CAPABILITY_GAP'
  | string;  // open-ended via pack declaration

interface Finding {
  id: string;
  engagementId: string;

  // SEMANTIC CORE — populated regardless of which methodology applies
  // Extensible: packs declare which semantic codes they require (Q2 fix)
  // Classical packs (GAGAS/IIA/ISO) will populate CRITERIA/CONDITION/CAUSE/EFFECT.
  // Capability-assessment packs (COBIT) will populate CAPABILITY_TARGET/CURRENT/GAP.
  coreElements: Record<SemanticElementCode, RichText>;

  // PER-STANDARD EXTENSIONS — pack-specific extra fields
  // e.g., Single Audit adds questioned costs; ISO 19011 adds clause reference
  // Key = packRef; value = structured extension object validated by the pack
  standardExtensions: Record<StandardPackRefKey, Record<string, unknown>>;
  // (StandardPackRefKey is a string form like "GAGAS:2024" for JSON-map keys)

  // CLASSIFICATIONS — per-pack severity (can legitimately disagree)
  // e.g., GAGAS says "Significant Deficiency"; IIA says "Major"
  classifications: Array<{
    packRef: StandardPackRef;
    schemeCode: string;    // "GAGAS_DEFICIENCY_TIER"
    levelCode: string;     // "SIGNIFICANT_DEFICIENCY"
  }>;

  // Which methodologies this finding is reported under
  applicableMethodologies: StandardPackRef[];

  // SOX-specific behavior flag (Q1 resolution — Option A)
  // When true, recommendations are suppressed from published reports
  // (auditor independence on ICFR audits per PCAOB AS 2201 + AS 1305).
  // Set by the SOX methodology pack when creating findings.
  soxSuppressRecommendation?: boolean;
}
```

**Why semantic core + extensions rather than (a) superset-blob or (b) parallel-records**:

- **(a) superset-blob fails on classifications** — MW/SD/D (GAGAS) vs Critical/Major/Minor (IIA) are measured against *different yardsticks* (material misstatement probability vs business objective impact). Can legitimately disagree for the same condition. Need `classifications: Array<...>`.
- **(b) parallel records drift** — every internal audit shop that tried it in Excel moved away within one audit cycle.

**Semantic equivalence**: GAGAS "Criteria" ≈ IIA "Criteria" ≈ ISO "Audit Criteria". GAGAS "Condition" ≈ IIA "Condition" ≈ ISO "Objective Evidence". Same semantic slot, different labels. The semantic dictionary (§4) maps these.

### Decision 4 — Recommendations as separate entity (many-to-many with Findings)

```ts
interface Recommendation {
  id: string;
  engagementId: string;
  findingIds: string[];           // ONE recommendation can address MANY findings (GAGAS §6.47)
  // ... fields (priority, assignee, due date, management response)
}
```

**Why separate and many-to-many**:

- **GAGAS §6.47** treats recommendations as a distinct report section with *many-to-many* linkage to findings (one recommendation may address multiple findings; one finding may have zero or many recommendations — a finding with no remediation option is still valid under GAGAS, e.g., questioned-costs findings).
- **IIA GIAS Standard 15.1** integrates them but still permits M:N in practice.
- **ISO 19011** uses "Corrective Action Request" (auditee-owned) for NCs and "Opportunity for Improvement" (auditor suggestion) as separate constructs.
- **PCAOB AS 1305 / AS 2201** prohibits auditor-issued recommendations on ICFR audits (auditor independence — recommending + testing = self-review threat).

**Rendering varies by methodology**:
- GAGAS mode: consolidated Recommendations section at report end + inline summary per finding
- IIA mode: inline with each finding (the "5th C" pattern)
- ISO mode: separate OFI section; NCs get only CAR linkages
- SOX mode: **suppress from auditor's report entirely** (keep internally for audit committee private communication)

Rendering controlled by `ReportTemplate.recommendationPresentation: 'inline' | 'separate' | 'both' | 'suppressed'`.

### Decision 5 — Multi-report from one engagement (first-class)

```ts
interface Report {
  id: string;
  engagementId: string;
  attestsTo: StandardPackRef;       // WHICH pack this report conforms to
  reportType: string;               // 'fs_opinion', 'yellow_book', 'single_audit', 'iso_nc_report'
  // ... content, status, etc.
}
```

One engagement → many reports, each declaring the pack it attests to.

**Why**: Single Audit is the canonical case. One engagement legally produces:
1. FS opinion (AU-C / GAAS)
2. Yellow Book report (GAGAS §6.02)
3. Schedule of findings + questioned costs (2 CFR 200.515(d))
4. Summary schedule of prior audit findings (2 CFR 200.511)
5. Corrective action plan (2 CFR 200.511)

Modeling this as one "multi-standard report" would mis-represent it; modeling as five independent engagements would break audit trail. **One engagement → five reports with distinct pack bindings** is how the regulation actually works.

### Decision 6 — Strictness resolver for cross-standard rule conflicts

When multiple active packs specify the same operational rule (independence, CPE hours, documentation retention, peer review cycle), the system computes the **strictest** and enforces it.

```ts
// On Engagement — derived at engagement creation, recomputed on pack changes
interface EngagementStrictness {
  documentationRetentionYears: number;     // max across active packs
  independenceCoolingOffYears: number;     // max
  cpeHoursPer2Years: number;               // max
  peerReviewCycleYears: number;            // min (stricter = shorter)
  governmentalCpeHours: number;            // GAGAS-specific; only if GAGAS active
  // Which pack drove each value (for audit trail)
  drivenBy: Record<keyof EngagementStrictness, StandardPackRef>;
}
```

Known conflicts handled this way:
- **Retention**: PCAOB 7y > AICPA 5y > IIA silent → PCAOB wins when SOX engagement
- **Independence**: GAGAS §3.26–3.107 stricter than IIA Standard 1100 on non-audit services → GAGAS wins
- **CPE**: GAGAS 80 hrs / 2 yrs (24 governmental) > CIA 40/yr → computed as union (auditor must satisfy both)
- **Peer review**: GAGAS 3 yrs < IIA 5 yrs → GAGAS wins (shorter cycle)

### Decision 7 — Semantic Element Dictionary (seed data)

New lookup table mapping canonical semantic codes to per-pack element codes with equivalence strength:

```ts
interface SemanticElementMapping {
  semanticCode: SemanticElementCode;  // enum: CRITERIA | CONDITION | CAUSE | EFFECT | RECOMMENDATION | EVIDENCE | NC_CLAUSE | ...
  packRef: StandardPackRef;
  packElementCode: string;             // code used in that pack's findingElements
  equivalenceStrength: 'exact' | 'close' | 'overlapping' | 'divergent';
  notes?: string;                       // human-readable explanation
}
```

Example entries:
- `{ semanticCode: CRITERIA, packRef: "GAGAS:2024", packElementCode: "criteria", equivalenceStrength: "exact" }`
- `{ semanticCode: CRITERIA, packRef: "ISO_19011:2018", packElementCode: "audit_criteria", equivalenceStrength: "close", notes: "ISO narrows to specific clause references" }`
- `{ semanticCode: CONDITION, packRef: "ISO_19011:2018", packElementCode: "objective_evidence", equivalenceStrength: "close" }`

**Why**: enables the finding `coreElements` to populate consistently regardless of which methodology is primary. Pack authors declare their mappings; engine renders the right labels to auditors based on active methodology.

### Decision 8 — OSCAL interop for control frameworks only

For `packType: control_framework` packs (NIST 800-53, NIST CSF, ISO 27001 control catalog, etc.), support NIST OSCAL import/export. Methodology packs stay in our schema (OSCAL has no equivalent for audit methodology standards).

**Why**:
- OSCAL is production (ServiceNow CAM, Pathways OSCAL NOW) and likely required for US federal customers
- Covers catalog/profile/component/SSP/SAP/SAR/POA&M — exactly the control-framework shape
- Does NOT cover audit methodology (GAGAS/IIA/ISO 19011) — methodology-pack-as-first-class-versioned-object remains our differentiator

**Non-goal**: forcing methodology into OSCAL's model. The framework doesn't fit and squeezing it in would degrade both OSCAL fidelity and our methodology semantics.

---

## 4. Semantic Element Dictionary — Initial Seed

Canonical codes we'll support at launch (extensible via pack authoring):

| Semantic code | Meaning | GAGAS 2024 | IIA GIAS 2024 | ISO 19011:2018 | PCAOB AS 2201 |
|---|---|---|---|---|---|
| `CRITERIA` | What should be | `criteria` (§6.39a) | `criteria` (Std 15.1) | `audit_criteria` (Cl. 6.4) | `control_objective` |
| `CONDITION` | What is | `condition` (§6.39b) | `condition` | `objective_evidence` (Cl. 6.4.7) | `control_condition` |
| `CAUSE` | Why the gap | `cause` (§6.39c) | `root_cause` (Std 14.2) | `root_cause` (Cl. 6.4.8, required for Major NC) | `deficiency_source` |
| `EFFECT` | Impact | `effect` (§6.39d) | `consequence` | `risk_impact` (implied) | `severity_classification` |
| `RECOMMENDATION` | How to fix | *separate entity* (§6.47) | *5th C inline* (Std 15.1) | *separate type: OFI* | *not applicable — independence* |
| `EVIDENCE` | Proof of condition | `sufficient_appropriate_evidence` (§8.48-8.56) | `workpaper_evidence` | `objective_evidence` | `evidence_of_operating_effectiveness` |
| `QUESTIONED_COST` | Dollar amount questioned | *Single Audit overlay only* | — | — | — |
| `ASSERTION_AFFECTED` | Financial statement assertion | — | — | — | *E/C/V/R/P/D* (AS 2201 ¶A3) |
| `NC_CLAUSE` | Specific standard clause violated | — | — | *required, Cl. 6.4* | — |

Equivalence strength per pair documented in `SemanticElementMapping` seed data.

### False-friend warnings
Three terms with dangerously overlapping labels that mean different things:

- **"Observation"**: GAGAS = minor issue *below* finding threshold (management-letter material). IIA = *the default term for a finding*. ISO = *a specific classification type* (not an NC; could become one). **Always resolve via `terminology.finding` override per pack** (already supported in current schema).
- **"Opportunity for Improvement (OFI)"**: ISO 19011 = distinct finding *type* with corrective-action implications under certification. IIA = *advisory/non-binding suggestion*. **Do not treat as the same.**
- **"Deficiency"**: SOX/PCAOB = specific tier (D/SD/MW) with precise AS 2201 definitions. GAGAS = used broadly. **Track severity scheme per classification** (already in Decision 3).

---

## 5. Migration Path from Current Schema

### Current state (`data-model/standard-pack-schema.ts`)
- `StandardPack` is the single top-level pack type (no discriminator)
- Engagement has `primaryStandard: string` (single reference, implicit)
- `Finding.elementValues: Record<string, unknown>` (flat, per-pack keyed)
- Single Audit is nested inside `gagas-2024.ts` as `sectorOverlays[0]`

### Target state (this design)
- `StandardPack` gets `packType: 'methodology' | 'control_framework' | 'regulatory_overlay'`
- Engagement: `primaryMethodology` + `additionalMethodologies[]` + `controlFrameworks[]` + `regulatoryOverlays[]` + `engagementMode`
- `Finding`: `coreElements` (semantic) + `standardExtensions` (per-pack) + `classifications[]` (per-pack severity)
- `Report`: `attestsTo: StandardPackRef`
- `Recommendation`: separate entity with `findingIds[]` (M:N)
- New: `SemanticElementMapping` seed table
- New: Split Single Audit out of `gagas-2024.ts` into its own `single-audit-overlay-2024.ts` (`packType: regulatory_overlay`)

### Migration steps (schema update, after this design note is approved)

1. Add `packType` field to `StandardPack`; mark all three existing example packs as `packType: 'methodology'`
2. Add Engagement shape (new types; Engagement entity lives in `tenant data model`, not pack schema — referenced via `StandardPackRef`)
3. Refactor `Finding` type to `coreElements` + `standardExtensions` + `classifications`
4. Extract Single Audit overlay → `examples/single-audit-overlay-2024.ts` with `packType: 'regulatory_overlay'`, `dependsOn: ["GAGAS:2024"]`
5. Add `SemanticElementMapping` table + seed entries for GAGAS/IIA/ISO from §4
6. Add `Report.attestsTo` + `Recommendation.findingIds[]`
7. Update existing `gagas-2024.ts`, `iia-gias-2024.ts`, `iso-19011-2018.ts` to declare `semanticElementMappings` per their `findingElements`
8. Update `VALIDATION.md` 4-layer validation rules for new types

No tenant-data migration concerns — we haven't implemented runtime yet.

---

## 6. Open Questions — Resolved + Deferred

### Q1 — SOX-style deficiency: Finding subtype or separate entity? ✅ RESOLVED
**Decision: Option A — `Finding` subtype with suppression flag.**

SOX ICFR deficiencies modeled as ordinary `Finding` records with:
- `soxSuppressRecommendation: true` — recommendations are suppressed from published reports (auditor independence per PCAOB AS 2201 + AS 1305 — recommending + testing = self-review threat)
- SOX-specific classification scheme (`SOX_DEFICIENCY_TIER` with levels `DEFICIENCY` / `SIGNIFICANT_DEFICIENCY` / `MATERIAL_WEAKNESS`) attached via the existing `classifications[]` array
- Recommendation rendering controlled by `ReportTemplate.recommendationPresentation: 'suppressed'` (already in the design)

**Rationale**: one Finding type across all standards keeps schema simpler and keeps pack rendering rules centralized. Recommendations entity already supports M:N and per-methodology presentation — no need for a parallel SOX-specific entity.

### Q2 — COBIT capability-gap findings don't fit the 4-element shape ✅ RESOLVED (deferred with schema refinement)
**Decision: `Finding.coreElements: Record<SemanticElementCode, RichText>` (extensible shape).**

COBIT pack implementation deferred to Phase 3+ (after base implementation). Schema is now ready: classical packs (GAGAS/IIA/ISO) populate `CRITERIA/CONDITION/CAUSE/EFFECT`; COBIT will populate `CAPABILITY_TARGET/CAPABILITY_CURRENT/CAPABILITY_GAP` (new semantic codes declared by the COBIT pack when authored).

**Rationale**: avoids a future migration by making `coreElements` extensible now; pack authors declare their semantic codes via `SemanticElementMapping` entries.

### Q3 — GIAS conformance-claimed vs methodology-applied ✅ RESOLVED
**Decision: `StandardPackRef.conformanceClaimed?: boolean` (default `true` for primary methodology).**

An engagement can attach IIA GIAS 2024 with `conformanceClaimed: false` — applying the methodology (5 Cs finding structure, GIAS-aligned workflow stages) without publishing the Standard 15.1 attestation phrase. Appropriate when a shop uses IIA methodology but doesn't meet the function-level QAIP requirement (annual internal assessment + 5-year external assessment).

When `conformanceClaimed: true`, the compliance-statement builder includes the pack in the report's "conducted in accordance with…" list.

### Q4 — Open pack format for community contributions ⏳ DEFERRED
**Status**: non-architectural; pure product/marketing/governance decision.

Publishing the `StandardPack` JSON schema externally doesn't change the schema shape. The schema is authored as if it were public (clean, documented). Decision to publish openly can be made later without refactor.

### Q5 — TeamMate+ StandardFusion integration response ⏳ DEFERRED
**Status**: non-architectural; marketing decision.

Our three-tier taxonomy (methodology / control_framework / regulatory_overlay) already draws the distinction Wolters Kluwer may try to blur. Whether we preempt with explicit trust-center messaging or respond reactively is a marketing call, not an architecture call. The architecture handles the distinction correctly either way.

### Q6 — Customer-managed pack overrides ✅ RESOLVED (deferred with schema readiness)
**Decision: `StandardPackRef.scope?: 'global' | `tenant:${string}`` reserved now; implementation deferred.**

Implementation of tenant-managed overrides defers to post-base-implementation. Schema now supports tenant-scoped pack references without requiring a future migration of every entity that carries a `StandardPackRef` (Engagement, Finding, Report, Recommendation, etc.).

**Rationale**: reserving the namespace costs nothing now and prevents a painful cross-entity refactor later.

---

## 7. Implementation Plan

### Phase 1 — Design note review (this document)
Product + advisory review of decisions 1–8. Resolve Q1 (SOX) and Q3 (GIAS conformance claimed). Other open questions can proceed in parallel.

### Phase 2 — Schema updates (`data-model/`)
1. Add `packType` discriminator to `StandardPack`
2. Add Engagement shape with primary/additional/controlFrameworks/overlays
3. Add `SemanticElementMapping` table + seed
4. Refactor `Finding` type (coreElements + extensions + classifications)
5. Add `Report.attestsTo` + `Recommendation.findingIds[]`
6. Update `VALIDATION.md`

### Phase 3 — Example packs
1. Mark `gagas-2024.ts`, `iia-gias-2024.ts`, `iso-19011-2018.ts` with `packType: 'methodology'`
2. Add `semanticElementMappings` to each
3. Extract Single Audit into `single-audit-overlay-2024.ts` (`packType: 'regulatory_overlay'`)
4. Create one reference `control_framework` pack (e.g., `soc2-2017.ts`) to prove the three-tier split works

### Phase 4 — Cross-doc reconciliation
1. Update `references/ROUND2-SYNTHESIS.md` to reflect three-tier taxonomy
2. Update `references/standards-matrix.md` with "stacks with" column
3. Update `api/`, `frontend/STATE-AND-DATA.md` where multi-standard affects contracts/UI
4. Document strictness resolver in `engineering/` (which module owns it?)

### Phase 5 — Update aims_v2_progress memory
Record this as a Tier-1 refinement between Tier 1 Foundation completion and Tier 2 vertical slice.

---

## 8. Sources

Primary sources (confirmed via live web research):

**Audit standards**:
- [GAO Yellow Book 2024 Revision (GAO-24-106786)](https://www.gao.gov/assets/d24106786.pdf)
- [IIA Global Internal Audit Standards 2024](https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/)
- [IIA Complete GIAS 2024 PDF](https://www.theiia.org/globalassets/site/standards/globalinternalauditstandards_2024january9.pdf)
- [The IIA Orange Book — Alignment between Red Book (IPPF) and Yellow Book (GAGAS)](https://www.theiia.org/en/content/guidance/mandatory/standards/the-alignment-between-the-iias-red-book-ippf-and-the-gaos-yellow-book-gagas/)
- [PCAOB AS 2201 — Integrated Audit of ICFR](https://pcaobus.org/oversight/standards/auditing-standards/details/AS2201)
- [2 CFR 200.514 (Single Audit scope)](https://www.law.cornell.edu/cfr/text/2/200.514)
- [2 CFR 200.515 (Single Audit reporting)](https://www.law.cornell.edu/cfr/text/2/200.515)
- [2 CFR 200.516 (Single Audit findings)](https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-F/subject-group-ECFRea73e47c9a286e6/section-200.516)
- [ISO 19011:2018](https://www.iso.org/standard/70017.html)
- [IAF MD 11:2023 — Application of 17021-1 for IMS audits](https://iaf.nu/iaf_system/uploads/documents/IAF_MD_11_Issue_3_12092023.pdf)
- [AICPA GAQC Practice Aid — Government Auditing Standards Primer](https://assets.ctfassets.net/rb9cdnjh59cm/7IgSJYjseWsGgFsDP2pb82/b101da999ebf14b7f8d2a88c48485a67/gaqc-practice-aid-government-auditing-standards-primer.pdf)
- [Multiple Auditing Standards and Standard Setting — Current Issues in Auditing (AAA)](https://publications.aaahq.org/cia/article/7/1/C1/7158/Multiple-Auditing-Standards-and-Standard-Setting)

**Open formats**:
- [NIST OSCAL](https://pages.nist.gov/OSCAL/)
- [Adoption of OSCAL in ServiceNow CAM (NIST CSRC, May 2024)](https://csrc.nist.gov/csrc/media/projects/open-security-controls-assessment-language/images-media/Adoption%20of%20OSCAL%20-%20ServiceNow%20CAM.pdf)

**Competitive evidence**:
- [AuditBoard → Optro rebrand announcement (Mar 9 2026)](https://www.prnewswire.com/news-releases/meet-optro-auditboard-unveils-new-identity-as-ai-transforms-grc-302707325.html)
- [AuditBoard IIA GIAS conformance capabilities announcement (Jul 2024)](https://www.businesswire.com/news/home/20240715652711/en/AuditBoard-Launches-New-Capabilities-to-Streamline-Conformance-With-New-IIA-Global-Standards)
- [ServiceNow Audit Management (Yokohama docs)](https://www.servicenow.com/docs/bundle/yokohama-governance-risk-compliance/page/product/grc-audit/concept/c_Engagements.html)
- [ServiceNow Audit Management architecture (Community)](https://www.servicenow.com/community/grc-articles/audit-management-in-servicenow/ta-p/2306382)
- [Wolters Kluwer TeamMate US Public Sector](https://www.wolterskluwer.com/en/solutions/teammate/teammate-us-public-sector)
- [Wolters Kluwer TeamMate IIA GIAS alignment](https://www.wolterskluwer.com/en/solutions/teammate/iia-global-internal-audit-standards)
- [Wolters Kluwer acquires StandardFusion (Jan 9 2026)](https://www.wolterskluwer.com/en/news/wolters-kluwer-acquires-standardfusion-grc)

**Related research** in this repo:
- `references/ROUND2-SYNTHESIS.md` — prior standards research synthesis
- `references/standards/01-gagas-deep-dive.md` — GAGAS 2024 deep dive
- `references/standards/02-iia-ippf-deep-dive.md` — IIA GIAS 2024 deep dive
- `references/standards/04-iso-19011-deep-dive.md` — ISO 19011:2018 deep dive
- `references/standards/03-sox-pcaob-deep-dive.md` — SOX/PCAOB deep dive
- `references/competitor-analysis.md` — prior competitor overview (to be updated post this design)

---

## 9. Changelog

| Date | Change | By |
|---|---|---|
| 2026-04-20 | Initial design note. Proposed status pending review. | Architecture |
| 2026-04-20 | Status → Accepted. Q1 resolved (Option A, Finding + soxSuppressRecommendation flag). Q3 resolved (conformanceClaimed field). Q2 resolved with schema refinement (Finding.coreElements extensible via SemanticElementCode). Q6 resolved with schema readiness (StandardPackRef.scope reserved). Q4, Q5 deferred (non-architectural). | Product + Architecture |
