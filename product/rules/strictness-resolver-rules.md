# Strictness Resolver Rules

> The canonical rulebook for how AIMS v2 reconciles conflicting rules across multiple attached standards packs. When an engagement has GAGAS + IIA GIAS + Single Audit Overlay attached and each declares a different retention period, what wins — and how does the system explain why? This document answers those questions exhaustively. Every other rule file in this folder (`classification-mappings.md`, `workflow-state-machines.md`, `approval-chain-rules.md`, `independence-rules.md`, `cpe-rules.md`) applies the resolver defined here to specific dimensions.

---

## 1. The resolver's job

When a user creates an engagement and attaches multiple methodology packs + control frameworks + regulatory overlays, the engagement inherits rules from all of them. Many of those rules conflict: GAGAS says one thing about documentation retention, PCAOB says another, Single Audit adds a third. The resolver's job is to compute, **at attachment time**, the single effective rule per dimension, and to make the decision auditable — queryable, explainable, and re-computable.

The resolver is not a black box. Every resolved rule carries a `drivenBy` audit trail recording which pack contributed the winning value and why. Two years later, when an external peer reviewer asks "why is this engagement's retention 7 years?", the answer is one query away: "PCAOB AS 1215 drove it via the longest-wins rule applied to retention".

### 1.1 Core principle — pick the stricter rule, record the provenance

For numeric dimensions (retention in years, cooling-off in months, CPE hours per cycle), "stricter" usually means "larger" — longer retention, longer cooling-off, more CPE. For some dimensions it means "shorter" (peer review cadence: stricter = shorter cycle). For categorical dimensions (documentation completeness bands, audit-team independence levels), strictness follows a per-dimension ordinal scale defined by each dimension's rule.

The resolver does not average, interpolate, or compromise. It picks one pack's rule and applies that pack's rule unchanged — this preserves the ability to audit the decision back to the specific standard that drove it. The resolver explicitly rejects "pick the middle" or "reconcile to a plausible average" as policies, because those can't be traced to any actual standard.

### 1.2 When the resolver can't decide

Not every conflict resolves mechanically. Philosophical conflicts — where two standards prescribe different *processes* rather than different *numeric thresholds* — require explicit human override. Examples include PCAOB's prohibition on auditor-issued ICFR recommendations versus IIA's requirement that recommendations appear inline with findings; GAGAS's specific engagement-letter content versus IIA's specific engagement-charter language.

For these cases, the resolver flags the dimension as requiring override, the user (typically a CAE or audit function director) documents the chosen rule with written rationale, and the audit trail records both the conflict and the override. The system never silently picks one side.

---

## 2. Resolver algorithm

The resolver runs at three trigger points:

1. **Engagement creation** — when the user selects the initial pack attachments
2. **Pack attach / detach** — when the user adds a new pack or removes an existing one mid-engagement
3. **Pack version upgrade** — when an attached pack upgrades to a new version (e.g., GAGAS 2018 → GAGAS 2024), re-resolving rules against the new pack's declarations

On each trigger, the resolver iterates over every known dimension (currently ~30 dimensions documented across the rule files in this folder) and computes the effective value per dimension.

### 2.1 Inputs

- `EngagementPackAttachments` — the set of attached pack refs: `{ primaryMethodology, additionalMethodologies[], controlFrameworks[], regulatoryOverlays[] }` with each pack's version
- `StandardPack` content for each attached pack — the structured pack records from [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) including their `rules`, `cpeRules`, `independenceRules`, `ruleOverrides` fields
- `ResolverDimensionRegistry` — the list of ~30 dimensions with their per-dimension strictness-direction metadata (`max | min | union | override-required`)
- Tenant-level annotations per [`product/03-feature-inventory.md`](../03-feature-inventory.md) Module 14 — overrides applied by Kalpana-style pack annotation/override

### 2.2 Per-dimension algorithm

```ts
function resolveRule(dimension: DimensionKey, packs: StandardPack[]): ResolvedRule {
  const contributions = packs
    .map(p => p.getRuleContribution(dimension))
    .filter(c => c !== null);

  if (contributions.length === 0) {
    return { value: null, drivenBy: [], applicability: 'not-applicable' };
  }

  const dimensionMeta = ResolverDimensionRegistry[dimension];

  switch (dimensionMeta.strictnessDirection) {
    case 'max':
      return pickMax(contributions);
    case 'min':
      return pickMin(contributions);
    case 'union':
      return union(contributions);
    case 'override-required':
      return {
        value: null,
        drivenBy: contributions,
        applicability: 'conflict-requires-override',
        conflictNarrative: buildConflictExplanation(contributions),
      };
  }
}
```

Every resolved rule result carries:
- `value` — the applied rule content (a number, a duration, a category code, an object)
- `drivenBy: PackRuleContribution[]` — which packs contributed, with their specific rule content
- `applicability` — one of `resolved`, `conflict-requires-override`, `override-applied`, `not-applicable`
- `overrideRationale?` — if `applicability === 'override-applied'`, the human's written justification

### 2.3 Tenant-level override layer

After the per-dimension algorithm runs, tenant-level pack annotations (per ADR / `product/03` Module 14 pack annotation/override) apply as a final override layer. A tenant that has extended GAGAS with bureau-specific rules will see their overrides applied after the cross-pack resolution, unless the bureau's override contradicts a stricter rule from another attached pack (in which case the stricter pack's rule wins and the annotation is logged as "not applied, overridden by [pack]").

### 2.4 Re-resolution triggers

Re-resolution fires on:
- **Pack attach or detach** — re-run the full resolver; record the diff; log change events for any dimension whose resolved value changed
- **Pack version upgrade** — same as attach/detach, with additional migration warning if any dimension's rule shape changed in the pack version bump
- **Tenant override change** — Kalpana edits a bureau annotation; re-resolve only the affected dimensions
- **Manual re-resolve** — administrative action to re-run the resolver (for example, after adding a new dimension to the registry as part of a product update)

---

## 3. Dimension registry

Every resolved dimension is registered in `ResolverDimensionRegistry` with strictness-direction metadata. The sections below document each dimension: what it is, which packs contribute, how the resolver direction applies, worked examples, and edge cases.

### 3.1 Documentation retention period

**Dimension key**: `DOCUMENTATION_RETENTION_YEARS`
**Strictness direction**: `max` (longer retention is stricter)
**Unit**: integer years

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | 5 years (via AICPA AU-C 230) | GAGAS §6.80 + AICPA AU-C 230.A29 |
| IIA_GIAS:2024 | 7 years | IIA GIAS Standard 15.2 |
| PCAOB | 7 years | SOX §802 + AS 1215 |
| ISO_19011:2018 | Tenant policy dependent (typically 5 years) | ISO 19011 §5.5.4 (records retention per organisation's policy) |
| SINGLE_AUDIT:2024 | 3 years after FAC submission | 2 CFR 200.517 |
| SOC2:2017 | 3 years (SOC 2 attestation engagements) | AICPA AT-C 215.73 |
| HIPAA | 6 years | 45 CFR 164.316(b)(2)(i) |
| NIST 800-53 | 3 years minimum (varies by control) | NIST 800-53 r5 AU-11 |
| COBIT:2019 | Not prescribed (tenant policy) | — |

**Worked example (Oakfield FY27 Single Audit)**:
Attached: GAGAS:2024 + IIA_GIAS:2024 + SINGLE_AUDIT:2024 + SOC2:2017.
Contributions: 5, 7, 3, 3.
`max(5, 7, 3, 3) = 7`.
Resolved value: 7 years. `drivenBy: IIA_GIAS:2024 (Standard 15.2)`.

**Edge case — HIPAA adds a longer contribution**: if the same engagement adds a HIPAA overlay, HIPAA's 6 years is below IIA's 7, so the resolved value remains 7 driven by IIA. Engineers sometimes assume the newer overlay wins; the resolver explicitly does not work that way. The stricter rule wins regardless of pack type.

**Edge case — tenant override pushes longer**: a bureau annotation that extends retention to 10 years for state-security engagements would supersede the 7-year cross-pack resolution, producing a resolved value of 10 years with `drivenBy` recording the tenant annotation. Annotations can only make rules stricter; an annotation that *shortens* retention below the cross-pack resolution is rejected at annotation-save time.

### 3.2 Independence cooling-off period

**Dimension key**: `INDEPENDENCE_COOLING_OFF_MONTHS`
**Strictness direction**: `max` (longer cooling-off is stricter)
**Unit**: integer months

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | 24 months | GAGAS §3.95 |
| IIA_GIAS:2024 | 12 months | IIA GIAS Domain 2, Principle 1 |
| PCAOB | 12 months (some circumstances 24) | PCAOB AS 3526 |
| ISO_19011:2018 | No specific number (conflict-of-interest declaration each engagement) | — |
| SINGLE_AUDIT:2024 | Defers to GAGAS | — |
| AICPA AT-C | 12 months | AICPA ET 1.100 |

**Worked example**: Oakfield FY27 (GAGAS + IIA). `max(24, 12) = 24`. Resolved: 24 months driven by GAGAS §3.95.

**Edge case**: PCAOB 24-month scenario only applies to certain engagement types (key audit partner rotation on large public company audits); tagged in the pack as a conditional rule with predicate. Resolver evaluates the predicate against engagement attributes; if it matches, PCAOB contributes 24; else 12.

### 3.3 Peer review cadence

**Dimension key**: `PEER_REVIEW_CYCLE_YEARS`
**Strictness direction**: `min` (shorter cycle = stricter = more frequent review)
**Unit**: integer years

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | 3 years | GAGAS §5.60 |
| IIA_GIAS:2024 | 5 years (external QAIP) | IIA GIAS Domain 4, Principle 13 |
| PCAOB | Annual inspection for registered firms; 3-year cycle for non-inspected | PCAOB Rule 4000 series |
| ISO_19011:2018 | Not prescribed | — |

**Worked example**: Oakfield FY27 (GAGAS + IIA). `min(3, 5) = 3`. Resolved: 3 years driven by GAGAS §5.60. IIA's 5-year external QAIP requirement still applies additively (both reviews happen; GAGAS's is more frequent).

**Note — `min` here means stricter**: "more frequent review" is the strictness interpretation, not "less review." The resolver's direction metadata encodes this correctly.

### 3.4 CPE hours per cycle

**Dimension key**: `CPE_HOURS_PER_CYCLE`
**Strictness direction**: `union` (auditor must satisfy every attached pack's requirement independently)
**Unit**: structured `{ hoursPerCycle, cycleDurationYears, governmentalHoursMinimum, otherCategoriesMinimum }`

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | 80 hours per 2 years with ≥24 governmental | GAGAS §4.26–4.34 |
| IIA_GIAS (CIA-certified) | 40 hours per year | IIA CPE requirements |
| IIA_GIAS (non-certified staff) | 20 hours per year (recommended, not mandated) | IIA Competency Framework |
| PCAOB | 20 hours per year, 40 per 2 years, with topic-specific mins | PCAOB Rule 3500T |
| ISO_19011:2018 | Tenant-defined competency maintenance | — |
| AICPA | State-Board-dependent (typically 40/year or 80/2yr with ethics min) | — |

**Resolution via union**: an auditor assigned to a multi-pack engagement must satisfy every attached pack's CPE requirement independently. A CIA-certified auditor on a GAGAS + IIA engagement must complete 80 hours/2 years *with* 24 governmental (GAGAS) *and* 40 hours/year (IIA CIA). These usually overlap — a qualifying course often satisfies both — but the auditor must document compliance with each requirement separately.

**Worked example — Oakfield FY27 auditor (Priya, CIA-certified)**:
- GAGAS: 80/2yr, ≥24 governmental
- IIA CIA: 40/year (80/2yr)
- Union requirement: 80 hours per 2 years + 24 governmental + 40/year each year

The resolver produces a CPE requirement object containing all three constraints; the CPE tracking UI validates against all of them independently; the CPE compliance dashboard shows per-constraint status.

**Detail in [`cpe-rules.md`](cpe-rules.md)**: the full per-pack CPE structure, category requirements, cycle semantics, and worked examples for various auditor certification combinations.

### 3.5 Working paper supervisory review requirements

**Dimension key**: `WORKING_PAPER_REVIEW_REQUIREMENT`
**Strictness direction**: per-component ordinal (documented below)
**Unit**: structured `{ reviewerLevel, reviewTimingRequirement, reviewEvidenceRequirement, subsequentReviewRequirement }`

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | Supervisor review before engagement completion; evidence in workpapers; AIC sign-off on every substantive WP | GAGAS §6.33 |
| IIA_GIAS:2024 | Supervisor or qualified peer review before reporting; evidence via review log | IIA GIAS Domain 3, Standard 11.1 |
| PCAOB | Engagement Partner + separately Engagement Quality Reviewer; pre-report release; evidence signed | PCAOB AS 1220 |
| ISO_19011:2018 | Team leader review; evidence per audit programme | ISO 19011 §6.5.4 |

**Strictness by component**:
- `reviewerLevel` — ordinal from "any qualified peer" to "engagement partner + EQR". PCAOB's AS 1220 tops the scale.
- `reviewTimingRequirement` — ordinal from "before report completion" to "concurrent with fieldwork". PCAOB's concurrent review is strictest.
- `reviewEvidenceRequirement` — ordinal from "log entry" to "reviewer signature on every substantive work paper". GAGAS and PCAOB tie here.
- `subsequentReviewRequirement` — whether the review must be re-performed if evidence changes post-review. PCAOB requires it; others do not.

**Worked example**: A combined GAGAS + PCAOB engagement resolves to PCAOB's component values (partner + EQR; concurrent; signed; re-review on changes) on every component — PCAOB is strictest across the board. IIA + GAGAS resolves to GAGAS on most components; IIA on one (review timing can be pre-report under IIA where GAGAS silent).

### 3.6 Evidence sufficiency standards

**Dimension key**: `EVIDENCE_SUFFICIENCY_LEVEL`
**Strictness direction**: ordinal (per-category scale documented below)
**Unit**: structured `{ populationCoverageMin, sampleSizeFormula, corroborationRequirement }`

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | Sufficient + appropriate evidence; statistical or judgmental sampling; corroboration from independent sources when feasible | GAGAS §6.39–6.43 |
| IIA_GIAS:2024 | Similar wording; judgement-driven | IIA GIAS Domain 3, Principle 10 |
| PCAOB | Specific sample size minimums for ICFR; 100% inspection for material control tests when statistically impractical | PCAOB AS 1105 + AS 2315 |
| ISO_19011:2018 | Verification of each audit criterion via objective evidence | ISO 19011 §6.5 |
| SINGLE_AUDIT:2024 | Same as GAGAS (defers) | — |

**Resolution**: PCAOB's specific numeric sample size minimums (when applicable) override the more judgement-driven standards of GAGAS / IIA / ISO. The resolver picks PCAOB's numeric floor as the sufficiency level for attached-PCAOB engagements; other engagements fall to GAGAS / IIA floor (no specific number; auditor judgement).

### 3.7 Report cover content requirements

**Dimension key**: `REPORT_COVER_CONTENT_REQUIREMENTS`
**Strictness direction**: `union` (every pack's required elements must appear)
**Unit**: structured list `{ requiredSection, requiredContent, prescribedLanguage }[]`

Each pack declares specific sections / language its reports must contain. The resolver unions them — the Yellow Book report for a GAGAS + Single Audit engagement must contain both GAGAS §6.02 sections and Single Audit per 2 CFR 200.515(d) required content.

**Detail in [`workflow-state-machines.md`](workflow-state-machines.md)** and in the report-template specification for each pack.

### 3.8 Finding classification scheme

**Dimension key**: `FINDING_CLASSIFICATION_SCHEMES`
**Strictness direction**: `union` (every attached pack's classification applies to every finding)
**Unit**: structured list `ClassificationSchemeReference[]`

Unlike the numeric dimensions above, classification schemes don't "resolve" to one — they all apply. A finding on a GAGAS + IIA engagement must carry a GAGAS classification (e.g., `SIGNIFICANT_DEFICIENCY`) *and* an IIA classification (e.g., `MAJOR`). The finding schema's `classifications: FindingClassification[]` stores both.

**Detail in [`classification-mappings.md`](classification-mappings.md)** — includes the per-pack classification scheme definitions, cross-pack rendering, and UI implications.

### 3.9 Approval chain length

**Dimension key**: `APPROVAL_CHAIN_LENGTH`
**Strictness direction**: `max` (more approval stages = stricter)
**Unit**: integer (number of approval stages on the report / finding / engagement path)

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | 2 stages for findings (Supervisor → CAE); 3 stages for reports (Supervisor → CAE → Issuance Authority) | GAGAS §6.33 + §6.02 |
| IIA_GIAS:2024 | 2 stages for findings; 3 for reports | IIA GIAS Domain 3 + Domain 5 |
| PCAOB | 3 stages for reports (AIC → Partner → EQR) | PCAOB AS 1220 |
| SINGLE_AUDIT:2024 | Adds CAE sign-off on Data Collection Form as additional stage | 2 CFR 200.512 |

**Worked example**: Oakfield (GAGAS + Single Audit) engagement's report chain: AIC → CAE → Issuance Authority (from GAGAS) + Single Audit adds CAE DCF sign-off. `max(3, 3+1) = 4` stages. See [`approval-chain-rules.md`](approval-chain-rules.md) for the per-entity approval chains in detail.

### 3.10 Independence declaration frequency

**Dimension key**: `INDEPENDENCE_DECLARATION_FREQUENCY`
**Strictness direction**: `min` (more frequent declaration = stricter)
**Unit**: enum `{ PER_ENGAGEMENT, ANNUAL, BIENNIAL }`

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | Per engagement (documented pre-fieldwork) | GAGAS §3.26 |
| IIA_GIAS:2024 | Annual + per engagement when threat identified | IIA GIAS Domain 2, Principle 5 |
| PCAOB | Per engagement | PCAOB AS 1005 |
| ISO_19011:2018 | Per engagement | ISO 19011 §5.4 |
| AICPA | Annual + engagement-specific if conflict identified | AICPA ET 1.200 |

**Resolution**: `min(PER_ENGAGEMENT, ANNUAL, PER_ENGAGEMENT, PER_ENGAGEMENT, ANNUAL)` on the ordinal scale `PER_ENGAGEMENT < ANNUAL < BIENNIAL` (more frequent = stricter). Resolved: `PER_ENGAGEMENT` for any engagement with any attached pack requiring it (which is every realistic multi-pack case).

**Detail in [`independence-rules.md`](independence-rules.md)**.

### 3.11 Reporting independence impairment threshold

**Dimension key**: `IMPAIRMENT_REPORTING_THRESHOLD`
**Strictness direction**: `min` (lower threshold = stricter = more reporting)
**Unit**: enum `{ ANY_IDENTIFIED, SIGNIFICANT, MATERIAL }`

| Pack | Contribution | Source |
|---|---|---|
| GAGAS:2024 | Any identified impairment | GAGAS §3.98 |
| IIA_GIAS:2024 | Significant impairment | IIA GIAS Domain 2, Principle 1 |
| PCAOB | Any identified (broader list of impairments) | PCAOB AS 1005 |

**Resolution**: `min(ANY_IDENTIFIED, SIGNIFICANT, ANY_IDENTIFIED)` = `ANY_IDENTIFIED`. Attached-GAGAS or attached-PCAOB engagements require disclosure of any identified impairment.

### 3.12 Engagement letter content

**Dimension key**: `ENGAGEMENT_LETTER_CONTENT`
**Strictness direction**: `union` (every required clause must appear)
**Unit**: structured list `{ clauseId, clauseContent, prescribedByPack }[]`

Each methodology pack declares specific engagement-letter content its engagements must include. Union resolution produces a composite engagement letter with clauses from every attached pack, with prescribed-language sections preserved verbatim.

**Edge case — prescribed language conflict**: when two packs prescribe language for semantically-similar clauses, the resolver flags a conflict. Example: GAGAS and IIA both prescribe specific language for the "basis of presentation" clause but with differently-worded legal protections. The resolver flags this as `override-required`; the CAE chooses which prescribed language to use with documented rationale.

### 3.13 Findings elements required

**Dimension key**: `FINDING_ELEMENTS_REQUIRED`
**Strictness direction**: `union` (every pack's required elements must be present)
**Unit**: structured list `SemanticElementCode[]`

| Pack | Contribution |
|---|---|
| GAGAS:2024 | `CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT` (4 elements) |
| IIA_GIAS:2024 | `CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, `RECOMMENDATION` (5 elements — inline recommendation) |
| PCAOB | `CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT` (4 elements; recommendations excluded per AS 1305 — reported in engagement letter, not in finding) |
| ISO_19011:2018 | `AUDIT_CRITERIA`, `OBJECTIVE_EVIDENCE`, `ROOT_CAUSE` (3 elements per nonconformity structure) |
| SINGLE_AUDIT:2024 | Adds `QUESTIONED_COSTS_KNOWN`, `QUESTIONED_COSTS_LIKELY`, `FEDERAL_PROGRAM`, `REPEAT_FINDING`, `COMPLIANCE_REQUIREMENT`, `FINDING_REFERENCE_NUMBER` |

**Resolution via union**: Oakfield FY27 (GAGAS + IIA + Single Audit) requires every finding to include all of: CRITERIA + CONDITION + CAUSE + EFFECT + RECOMMENDATION + 6 Single Audit fields. The dynamic form engine renders all of these as required fields for each new finding on that engagement.

### 3.14 Recommendation presentation rule

**Dimension key**: `RECOMMENDATION_PRESENTATION`
**Strictness direction**: `override-required` — this is a philosophical conflict, not a numeric one
**Unit**: enum per-report `{ INLINE, SEPARATE, SUPPRESSED, BOTH }`

| Pack | Contribution |
|---|---|
| GAGAS:2024 | Separate report section (SEPARATE) |
| IIA_GIAS:2024 | Inline with finding (INLINE) |
| PCAOB ICFR | Suppressed (SUPPRESSED — AS 1305) |
| ISO_19011:2018 | Auditor does not issue; nonconformities trigger auditee CARs |

**Conflict pattern**: when GAGAS + IIA + PCAOB ICFR are all attached (rare but real), the three produce three incompatible renderings. The resolver flags this as requiring override at the **report-template level**, not the engagement level — each report declares its own `recommendationPresentation` based on its `attestsTo` pack. This is why the Report entity has a `recommendationPresentation` field per ADR-tagged data model: it's a per-report decision, not a per-engagement one.

**Not actually a conflict in practice** because the decision is per-report, not per-engagement. The resolver flags it as `not-applicable-at-engagement-level` and defers to the report template's own declaration. See [`workflow-state-machines.md`](workflow-state-machines.md) for the report workflow implications.

### 3.15 Risk-based approach requirement

**Dimension key**: `RISK_BASED_APPROACH_DEPTH`
**Strictness direction**: ordinal (ordinal scale defined below)
**Unit**: enum `{ NONE, GENERAL, DOCUMENTED_MATRIX, FORMAL_RCM }`

| Pack | Contribution |
|---|---|
| GAGAS:2024 | DOCUMENTED_MATRIX |
| IIA_GIAS:2024 | DOCUMENTED_MATRIX |
| PCAOB | FORMAL_RCM (Risk + Control Matrix) |
| ISO_19011:2018 | GENERAL |
| COBIT:2019 | FORMAL_RCM |
| SOC2:2017 | DOCUMENTED_MATRIX |

**Ordinal strictness**: `NONE < GENERAL < DOCUMENTED_MATRIX < FORMAL_RCM`.

**Resolution**: max on the ordinal scale. PCAOB or COBIT attachment forces FORMAL_RCM. All-GAGAS/IIA/SOC2 attachment settles at DOCUMENTED_MATRIX.

### 3.16 Quality control partner requirement

**Dimension key**: `QC_PARTNER_REQUIRED`
**Strictness direction**: max (required = stricter)
**Unit**: boolean

| Pack | Contribution |
|---|---|
| GAGAS:2024 | No specific QC partner requirement (QA Reviewer role per §5.40) |
| IIA_GIAS:2024 | No (QAIP-driven, not per-engagement QC partner) |
| PCAOB | Yes (Engagement Quality Reviewer per AS 1220) |
| AICPA | Depends on firm's QC system (may require) |

**Resolution**: true if any attached pack requires it; false otherwise.

### 3.17 Quality control partner rotation

**Dimension key**: `QC_PARTNER_ROTATION_YEARS`
**Strictness direction**: min (shorter rotation = stricter)
**Unit**: integer years (null if not applicable)

| Pack | Contribution |
|---|---|
| PCAOB (public-company audits, large accelerated filers) | 5 years rotation + 5-year cooling-off | PCAOB AS 2401 + EU/PCAOB partner-rotation rules |
| PCAOB (other) | Not required |
| GAGAS | Not required |
| IIA_GIAS | Not required |

**Edge case**: conditional on engagement attributes (is the auditee a large accelerated filer?). Resolver evaluates the predicate before picking a value.

### 3.18 Engagement letter required

**Dimension key**: `ENGAGEMENT_LETTER_REQUIRED`
**Strictness direction**: max (required = stricter)
**Unit**: boolean

All major methodology packs require an engagement letter. Always resolves to true in realistic engagement types.

### 3.19 Report issuance authority

**Dimension key**: `REPORT_ISSUANCE_AUTHORITY`
**Strictness direction**: ordinal (defined by pack; encodes authority seniority)
**Unit**: role identifier

Identifies who can sign the final report. GAGAS says Engagement Partner or CAE; IIA says CAE; PCAOB says Engagement Partner. Resolver picks the role that's "senior-most" per the role hierarchy, which is typically Engagement Partner or CAE depending on engagement type.

**Not a straightforward pick-the-max** — the resolver uses the attached packs' primaryMethodology to drive the default role, overridden only if a regulatory overlay (like Single Audit) requires a specific additional sign-off.

### 3.20 Period of report coverage

**Dimension key**: `REPORT_COVERAGE_PERIOD_DESCRIPTION`
**Strictness direction**: `union` (every attached pack's coverage requirements must be documented)
**Unit**: structured list `{ periodType, description, requiredByPack }[]`

### 3.21 Additional required reports

**Dimension key**: `ADDITIONAL_REQUIRED_REPORTS`
**Strictness direction**: `union` (every pack's required reports are produced)
**Unit**: structured list `{ reportType, attestingPack, contentRequirements }[]`

| Pack | Contribution |
|---|---|
| GAGAS:2024 | Yellow Book report (always) |
| IIA_GIAS:2024 | Audit committee report (always) |
| SINGLE_AUDIT:2024 | Adds: SEFA, Schedule of Findings and Questioned Costs, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP, Engagement Letter (formalised) |
| PCAOB | Opinion on FS + Opinion on ICFR (combined or separate per AS 2201 ¶86) |
| SOC2:2017 | SOC 2 attestation report |
| ISO_19011:2018 | ISO audit report |

Union resolution: every engagement produces one report per attached pack's requirements, plus any regulatory-overlay-specific additional reports. Multi-pack engagements can produce 7+ reports from one fieldwork effort (the Oakfield FY27 example).

**MVP 1.0 scope note** per [`../04-mvp-scope.md`](../04-mvp-scope.md): MVP 1.0 ships only the Yellow Book + Schedule of Findings and Questioned Costs. Other pack-required reports are produced via professional services during MVP 1.0 era and ship natively in MVP 1.5.

### 3.22 Materiality framework

**Dimension key**: `MATERIALITY_FRAMEWORK`
**Strictness direction**: `override-required` (packs diverge philosophically on what "material" means for non-financial audits)
**Unit**: framework descriptor

Financial-audit packs (PCAOB, AICPA) have quantitative materiality concepts. Performance-audit packs (GAGAS §8, IIA GIAS) have qualitative materiality concepts ("significance to the users of the report"). ISO 19011 doesn't use materiality in the same sense. Resolver flags any engagement combining financial and performance audit packs as requiring CAE-level documentation of which materiality framework applies to which finding.

### 3.23 Fieldwork independence — non-audit services restriction

**Dimension key**: `NON_AUDIT_SERVICES_RESTRICTION_DAYS`
**Strictness direction**: max (longer cooling-off period = stricter)
**Unit**: integer days prior to engagement start

| Pack | Contribution |
|---|---|
| GAGAS:2024 | 1 year for management-functional non-audit services | GAGAS §3.87 |
| PCAOB / AICPA | 1 year for specified prohibited services | SOX §201 |
| IIA_GIAS:2024 | Conflict-of-interest declaration; no strict day count | — |

**Resolution**: max. Longer cooling-off wins.

### 3.24 Auditee rights / responses — with statutory-deadline guard

**Dimension key**: `AUDITEE_RESPONSE_WINDOW_DAYS`
**Strictness direction**: max (longer window = stricter protection of auditee) **with statutory-deadline override**
**Unit**: integer days

| Pack | Contribution |
|---|---|
| GAGAS:2024 | 30 days (suggested in §6.54) |
| IIA_GIAS:2024 | Reasonable opportunity (no specific days) |
| SINGLE_AUDIT:2024 | 30 days |
| PCAOB | Not prescribed in response-window terms |

**Naïve resolution** (what the resolver would compute mechanically): max over numeric contributors. Usually 30 days for attached-GAGAS or attached-Single-Audit engagements.

**Real-world resolution — statutory deadline guard**:

A generous auditee-response window is usually good — more time for thoughtful management response means better-quality findings. But there is a hard boundary: when a statutory deadline exists (Single Audit filing 9 months post-fiscal-year-end per 2 CFR 200.512; SOX §302 quarterly deadlines; certain state government audit filing deadlines), a generous response window can jeopardise the auditee's ability to meet their federal or regulatory filing obligation.

For example: Oakfield FY27 ends June 30, 2027. Single Audit must be filed at FAC by March 31, 2028 (9 months). If the engagement is attached to a hypothetical pack that contributes a 60-day response window (more "generous" than GAGAS's 30), the max resolver would pick 60 days. But if the auditor's final draft lands with Oakfield on February 15, 2028, a 60-day response window wouldn't conclude until April 15 — **past the FAC deadline**. This would force Oakfield to miss federal filing, jeopardising their federal funding.

**The resolver applies a statutory-deadline guard**:

1. The resolver checks whether any attached regulatory overlay (Single Audit, SOX, state government audit acts) declares a hard filing deadline
2. If a hard deadline exists, the resolver flags the engagement with `RESPONSE_WINDOW_STATUTORY_DEADLINE_CONFLICT_POSSIBLE`
3. The engagement's planning phase must then:
   - Back-calculate the latest-possible response-window close date that still allows timely filing
   - If the resolver's computed max window would exceed this, the effective window is **capped at the statutory-deadline-safe value**
   - If even the shorter window wouldn't make the filing deadline, the engagement triggers a timeline-risk alert at planning time
4. The capped value is recorded with `drivenBy: [original resolver contributors, + STATUTORY_DEADLINE_OVERRIDE]`
5. Audit log entry explicitly captures the statutory-deadline override

**Worked example** (Oakfield FY27):
- Attached: GAGAS + IIA + Single Audit + SOC 2
- Naïve `max(30, reasonable, 30, -)` = 30 days (since IIA and SOC 2 don't contribute numeric values, max defaults to the explicit contributors)
- FAC deadline: March 31, 2028
- Engagement draft report expected date: February 10, 2028
- Latest possible response close to meet FAC: March 15, 2028 (allowing 2 weeks for final report assembly, sign-off, and FAC upload)
- Available response window: March 15 - February 10 = ~33 days
- Since 30 days (resolver max) is within 33 days (statutory-deadline-safe), **no conflict; apply 30 days**
- If the draft landed later (say, March 1), the available window would be 14 days; resolver would cap at 14 with explicit STATUTORY_DEADLINE_OVERRIDE tag

**Edge case — tight statutory deadline forcing short window**:

If an engagement is running late and the available response window would be under 10 days, the system flags the engagement for CAE intervention. The CAE has three options:

1. Request a statutory deadline extension from the federal agency (rare but possible for Single Audit; 2 CFR 200.512(a)(1) allows extensions with regulator approval)
2. Accept the short response window with documented acknowledgement that this is operationally constrained
3. If the auditee explicitly needs more time, the engagement may need to work with the agency to extend filing with agency concurrence

The statutory-deadline guard thus makes a real operational trade-off visible rather than letting the resolver silently choose a rule that breaks federal compliance.

**Summary**: for `AUDITEE_RESPONSE_WINDOW_DAYS`, the resolver is `max, capped by statutory deadlines where applicable`. See also [`workflow-state-machines.md §5.1.1`](workflow-state-machines.md) for the auditee non-response / BYPASSED path, which is a different scenario where the auditor proceeds regardless.

### 3.25 Continuous quality monitoring frequency

**Dimension key**: `CONTINUOUS_QUALITY_MONITORING_FREQUENCY`
**Strictness direction**: min (more frequent = stricter)
**Unit**: enum `{ ENGAGEMENT_LEVEL, QUARTERLY, ANNUAL, NONE }`

| Pack | Contribution |
|---|---|
| GAGAS:2024 | Engagement-level + annual QA review | §5.01–5.15 |
| IIA_GIAS:2024 | Continuous per QAIP | Domain 4 Principle 13 |
| PCAOB | Annual inspection + continuous registered-firm reporting | — |

**Resolution**: min on ordinal `NONE < ANNUAL < QUARTERLY < ENGAGEMENT_LEVEL`. Attached IIA drives ENGAGEMENT_LEVEL; attached GAGAS drives ENGAGEMENT_LEVEL + ANNUAL combined (implied — both fire).

### 3.26 Objective evidence corroboration

**Dimension key**: `OBJECTIVE_EVIDENCE_CORROBORATION_REQUIRED`
**Strictness direction**: max (required = stricter)
**Unit**: boolean

ISO 19011 §6.4.3 explicitly requires corroboration from independent sources for material findings. GAGAS §6.41 encourages it without mandating. PCAOB AS 1105 requires it for certain procedures. Resolver: true if any pack requires.

### 3.27 Audit risk assessment methodology

**Dimension key**: `AUDIT_RISK_ASSESSMENT_METHODOLOGY`
**Strictness direction**: ordinal (granular methodology = stricter)
**Unit**: enum `{ QUALITATIVE, SEMI_QUANTITATIVE, QUANTITATIVE }`

PCAOB requires quantitative (inherent risk × control risk = detection risk); GAGAS allows semi-quantitative; IIA / ISO allow qualitative. Resolver: max on ordinal `QUALITATIVE < SEMI_QUANTITATIVE < QUANTITATIVE`.

### 3.28 Communication with those charged with governance

**Dimension key**: `TCWG_COMMUNICATION_REQUIRED`
**Strictness direction**: per-category (multiple binary flags union'd)
**Unit**: structured list `{ communicationType, required }[]`

Each pack declares specific communications required (pre-engagement, planning, during, final, post-issuance). Union of required flags.

### 3.29 Engagement management software documentation

**Dimension key**: `ENGAGEMENT_MANAGEMENT_DOCS_REQUIRED`
**Strictness direction**: max (more explicit documentation = stricter)
**Unit**: structured list of required documentation types

Covers engagement letter, APM, work program, PRCM, supervisory review evidence, etc. See section 3.5 detail.

### 3.30 Archived documentation tamper-evidence

**Dimension key**: `TAMPER_EVIDENT_ARCHIVE_REQUIRED`
**Strictness direction**: max (required = stricter)
**Unit**: boolean + required-format descriptor

AIMS v2's hash-chained audit log (per [`docs/04 §8.6`](../../docs/04-architecture-tour.md) and ADR-0002) satisfies this for every engagement, regardless of pack attachment. The resolver evaluates this dimension but it's essentially always `true` — our architecture provides it universally.

---

## 4. Override workflow

When a dimension resolves to `conflict-requires-override` (rare but real cases — primarily recommendation-presentation conflicts, materiality-framework conflicts, prescribed-language conflicts), the user must explicitly resolve the conflict with documented rationale.

### 4.1 Override UI flow

1. Engagement creation page displays a warning banner: "3 dimensions require override decisions before this engagement can proceed to fieldwork"
2. Resolver Override page lists each unresolved dimension with:
   - The dimension name and semantic description
   - The conflicting contributions (e.g., GAGAS says X; IIA says Y)
   - A description of the conflict
   - A text area for the user's chosen rule + rationale
   - A radio-selector or free-text field for the chosen value
3. On save, the engagement transitions from "pending override" to "ready for fieldwork"; the override is logged to the audit trail with `overrideBy`, `overrideAt`, `overrideRationale`

### 4.2 Who can override

- Engagement-level overrides: CAE, AIC (with CAE counter-sign within 5 business days for the override to stick)
- Tenant-level default overrides: Audit Function Director (Kalpana) or CAE; apply to all future engagements unless overridden at engagement level

### 4.3 Override audit trail

Every override event logs:
- Timestamp (transactionFrom)
- Acting user (overrideBy)
- Dimension and contributing packs
- Chosen rule value
- Rationale text (minimum 50 characters required)
- Cross-reference to the engagement and any related findings

External peer reviewers and regulators querying the engagement can export all overrides with rationales; this is a compliance evidence requirement under GAGAS §5.15 and IIA Standard 15.2.

---

## 5. Validation rules for the resolver

The resolver itself has validation rules that catch misconfiguration.

### 5.1 Every dimension must have defined strictness direction

The dimension registry enforces this at system startup; an unregistered or under-specified dimension causes the system to refuse to start, not to resolve ambiguously.

### 5.2 Numeric dimensions must have consistent units

When two packs contribute to the same dimension, they must use the same unit. A pack declaring "retention: 60 months" and another declaring "retention: 5 years" fails pack-validation (per [`data-model/VALIDATION.md`](../../data-model/VALIDATION.md) Layer 4) until normalised to the same unit.

### 5.3 Ordinal scales must be pack-declared

For ordinal strictness, the scale must be declared in one authoritative place (either a methodology pack or a shared dimension registry entry). Two packs cannot independently declare different ordinal scales for the same dimension.

### 5.4 Override rationale minimum length

At least 50 characters of rationale text is required to save an override. Enforced at the application layer and the data-model validator.

### 5.5 Every resolved rule carries complete `drivenBy`

`drivenBy` cannot be empty when `applicability === 'resolved'`. If it would be empty (all packs contributed nothing), `applicability` must be `not-applicable`, not `resolved`.

### 5.6 No silent-skip behaviour

The resolver never silently skips a dimension. If a dimension cannot be resolved, the engagement stays in `pending override` status until all unresolved dimensions are decided — either via mechanical resolution or explicit override.

---

## 6. Rule maintenance over pack-version upgrades

Pack versions update periodically (GAGAS 2018 → 2024, IIA IPPF 2017 → GIAS 2024, etc.). When this happens, the resolver must handle:

### 6.1 Rule content changes

If a pack version upgrade changes a rule's numeric value (e.g., GAGAS 2024 extends retention from 5 years to 7 for certain engagement types), re-resolution picks up the new value. The `drivenBy` audit trail records the version that drove the value, so "why did this engagement's retention change on 2027-12-01?" is answerable.

### 6.2 Rule shape changes

If a pack version upgrade changes a rule's structure (e.g., GAGAS 2024 adds a new field to the independence-rule structure that didn't exist in GAGAS 2018), the resolver handles via schema evolution: the new field is optional for engagements still on the old version; the new field is required for engagements on the new version.

### 6.3 New dimensions

If a pack version adds an entirely new dimension (e.g., a hypothetical GAGAS 2027 adds a new CPE subcategory), the dimension registry is updated at pack-import time, and the resolver applies the new dimension to engagements only if their attached packs declare a contribution to the new dimension.

### 6.4 Dimension removal

Rare. If a pack version removes a dimension it previously declared, the resolver no longer applies that pack's contribution to the dimension. If the dimension is no longer contributed to by any attached pack, the resolved value becomes `null` / `not-applicable`.

---

## 7. Performance characteristics

The resolver runs per engagement per trigger event. Typical engagement has 4-8 attached packs; resolver evaluates ~30 dimensions. Per-engagement resolver runtime: ~50-200ms at p99.

At tenant onboarding or large migrations, the resolver may run against hundreds of historical engagements in bulk. Bulk-resolution is processed as a background job (NestJS worker per ADR-0003), not inline.

**Performance gates from [`../04-mvp-scope.md §5.2`](../04-mvp-scope.md)**:
- Engagement-creation resolver time < 500ms p99 at MVP 1.0 load
- Bulk re-resolution across 1000 engagements < 5 minutes p99

---

## 8. References

- [ADR data-model / VALIDATION.md](../../data-model/VALIDATION.md) — Layer 4 rules for per-pack rule validity
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — where `rules`, `cpeRules`, `independenceRules`, `ruleOverrides` are declared
- [`docs/03-the-multi-standard-insight.md`](../../docs/03-the-multi-standard-insight.md) §6.5 — strictness resolver overview
- [`docs/06-design-decisions.md`](../../docs/06-design-decisions.md) §1.8 — the strictness resolver decision in the design narrative
- [`rules/classification-mappings.md`](classification-mappings.md) — classification-scheme dimension detail
- [`rules/workflow-state-machines.md`](workflow-state-machines.md) — workflow-stage dimension detail
- [`rules/approval-chain-rules.md`](approval-chain-rules.md) — approval-chain-length dimension detail
- [`rules/independence-rules.md`](independence-rules.md) — independence dimension detail
- [`rules/cpe-rules.md`](cpe-rules.md) — CPE dimension detail
- GAGAS 2024 — authoritative for GAGAS dimensions
- IIA GIAS 2024 — authoritative for IIA dimensions
- PCAOB auditing standards — authoritative for PCAOB dimensions
- ISO 19011:2018 — authoritative for ISO dimensions

---

## 9. Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini, framed as VP of Product in GRC/Audit SaaS) in the same cycle that reviewed all Phase 3 rule files. **Verdict: Approved with five substantive refinements across the Phase 3 set.** This file received one specific refinement; the others are noted in their respective file appendices.

### Round 1 — statutory deadline guard on §3.24

Reviewer correctly identified that a generous `AUDITEE_RESPONSE_WINDOW_DAYS` resolved via `max` could jeopardise the auditee's ability to meet federal statutory filing deadlines (Single Audit FAC filing at 9 months post-fiscal-year-end per 2 CFR 200.512). If a hypothetical pack contributed a 60-day window and the draft report landed close to the FAC deadline, the response window would push filing past the federal deadline.

Fix applied to §3.24: added statutory-deadline guard behaviour. The resolver now back-calculates the latest-possible response-window close date that still allows timely filing; caps the effective window if the resolver's mechanical max would exceed. `drivenBy` explicitly records `STATUTORY_DEADLINE_OVERRIDE` when the cap applies. CAE intervention triggered if available window drops below 10 days. This makes the real operational trade-off visible rather than letting the resolver silently break federal compliance.

### Reviewer's overall verdict

> "Approved. These rules files are a masterclass in domain-driven design. You have taken the messy, human, political world of audit compliance and turned it into deterministic software rules without losing the nuance. The distinction between max, min, union, and override-required in the strictness resolver is a stroke of architectural brilliance — it turns a subjective argument into a deterministic function."

The design is sound. The five refinements (across the six rule files) improve specific operational edge cases without altering the architecture.

---

*Last reviewed: 2026-04-21. Phase 3 deliverable; R1 review closed.*
