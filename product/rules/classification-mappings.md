# Classification Mappings

> How finding severity translates across multiple attached standards packs. When one finding appears on a GAGAS + IIA + Single Audit engagement, it carries three classifications — one per applicable scheme — with each scheme measuring something different. This document catalogues the per-pack schemes, explains what each scheme actually measures, and describes how the UI surfaces them. Pairs with [`strictness-resolver-rules.md §3.8`](strictness-resolver-rules.md) which establishes classifications as a `union` dimension (every pack's scheme applies).

---

## 1. Why classifications don't "resolve" to one

The strictness resolver handles most cross-pack rule conflicts by picking the stricter rule. Classifications are the exception. When GAGAS classifies a finding as Significant Deficiency and IIA classifies the same finding as Major, neither classification is "more right" — they're measuring different things against different yardsticks.

- **GAGAS** measures *likelihood of material misstatement of financial statements or material noncompliance with laws/regulations*. A GAGAS Significant Deficiency is a control weakness whose impact could be material but is less severe than a Material Weakness.
- **IIA** measures *business impact or risk magnitude for the audited organisation*. An IIA Major finding is one requiring senior management attention due to business risk.
- **ISO 19011** measures *severity of clause noncompliance*. An ISO Major Nonconformity is a complete failure to meet a clause requirement.
- **PCAOB** measures *likelihood + magnitude specifically for ICFR*. PCAOB's scheme maps to GAGAS's tiers via AS 2201 ¶A3–A7 but with stricter threshold definitions.

Because each scheme measures a different thing, a finding authored once carries multiple classifications — one per attached pack whose scheme applies. The UI shows the auditor a classification picker for each scheme; the auditor assigns each classification independently. The finding's data shape (per [`data-model/tenant-data-model.ts`](../../data-model/tenant-data-model.ts) `Finding.classifications: FindingClassification[]`) stores the array.

This is the correct architecture. Forcing a single classification would either:
- Discard information each scheme provides — a single rating cannot capture both GAGAS's financial-statement-impact view and IIA's business-risk view simultaneously
- Impose one pack's vocabulary on reports that attest to a different pack — the Yellow Book report shouldn't render IIA's classification; the Audit Committee report shouldn't render GAGAS's

---

## 2. Per-pack classification schemes

The following sections document each pack's classification scheme: what it measures, its category definitions, authoritative source, and worked examples.

### 2.1 GAGAS:2024 — deficiency tier scheme

**Measures**: likelihood and magnitude of financial statement misstatement or noncompliance with laws / regulations that could be material.

**Categories** (ordinal scale, less-severe to more-severe):

| Category | Code | Definition |
|---|---|---|
| Deficiency | `GAGAS_DEFICIENCY` | Control does not allow management or employees, in the normal course of performing their assigned functions, to prevent or detect and correct, misstatements on a timely basis |
| Significant Deficiency | `GAGAS_SIGNIFICANT_DEFICIENCY` | A deficiency, or a combination of deficiencies, that is less severe than a material weakness but important enough to merit attention by those charged with governance |
| Material Weakness | `GAGAS_MATERIAL_WEAKNESS` | A deficiency, or a combination of deficiencies, such that there is a reasonable possibility that a material misstatement will not be prevented, or detected and corrected, on a timely basis |

**Authoritative source**: GAGAS §6.40–6.45, which incorporates AICPA AU-C 265 definitions for financial audits and extends them for performance and attestation work.

**Display vocabulary in Yellow Book report**: "Material Weakness" / "Significant Deficiency" / "Deficiency" with the specific GAGAS phrasing of "a deficiency, or combination of deficiencies, such that..."

**Oakfield FY27 example**: finding 2026-001 (expense miscoding on federal programs) is classified `GAGAS_SIGNIFICANT_DEFICIENCY` — control weakness that produced material misstatement on specific program accounts but not material to the overall financial statements.

### 2.2 IIA GIAS 2024 — severity scheme

**Measures**: business impact or organisational risk magnitude.

**Categories** (ordinal, less-severe to more-severe):

| Category | Code | Definition |
|---|---|---|
| Advisory / Observation | `IIA_ADVISORY` | An opportunity for improvement or an observation that does not rise to finding level under the organisation's internal audit function's risk framework |
| Minor | `IIA_MINOR` | A finding with low business impact; remediable within normal business cycles |
| Major | `IIA_MAJOR` | A finding requiring senior management attention due to material business risk or reputational impact |
| Critical | `IIA_CRITICAL` | A finding representing immediate significant risk to operations, compliance, or reporting |

**Authoritative source**: IIA GIAS 2024 Standard 11.1 defines finding elements; the specific four-tier severity scheme is common practice and often codified per-organisation in the internal audit charter. GIAS does not prescribe the four-tier labels specifically — it requires severity classification consistent with the organisation's risk framework.

**Display vocabulary in Audit Committee report**: "Critical" / "Major" / "Minor" / "Advisory" with business-impact framing, typically including remediation timeline expectations (Critical = immediate action; Major = 90 days; Minor = 6 months; Advisory = no mandated action).

**Oakfield FY27 example**: finding 2026-001 is classified `IIA_MAJOR` — the expense miscoding represents material business risk (federal reporting accuracy, grant compliance implications).

### 2.3 ISO 19011:2018 — nonconformity category scheme

**Measures**: degree of noncompliance with the audited management system clause requirements.

**Categories**:

| Category | Code | Definition |
|---|---|---|
| Opportunity for Improvement | `ISO_OFI` | Not a nonconformity — a separate category representing observed potential for improvement without rising to nonconformity status |
| Minor Nonconformity | `ISO_MINOR_NC` | A nonfulfilment of a requirement that does not fundamentally affect the effectiveness of the management system; localised failure of a part of a procedure |
| Major Nonconformity | `ISO_MAJOR_NC` | A nonfulfilment of a requirement that affects the effectiveness of the management system as a whole; complete failure to implement a clause, or systemic failure across multiple clauses |

**Authoritative source**: ISO 19011:2018 §6.4. ISO's categorical scheme is distinct from GAGAS / IIA's ordinal deficiency scheme — nonconformities are discrete categories with clause-citation evidence requirements, not severity-tier judgements.

**Display vocabulary in ISO Audit Report**: "Major Nonconformity — clause [X.Y]" / "Minor Nonconformity — clause [X.Y]" with explicit clause citation; OFIs are usually a separate section rather than ranked alongside NCs.

**Finding shape difference**: ISO nonconformities require `AUDIT_CRITERIA`, `OBJECTIVE_EVIDENCE`, and (for Major) `ROOT_CAUSE` fields — these are captured in the pack's semantic element mappings. The ISO classification itself is a categorical field, not an ordinal rating.

### 2.4 PCAOB ICFR tier scheme (AS 2201)

**Measures**: likelihood + magnitude of misstatement specifically in internal control over financial reporting.

**Categories**:

| Category | Code | Definition |
|---|---|---|
| Control Deficiency | `PCAOB_CONTROL_DEFICIENCY` | Control design or operation does not allow management or employees to prevent, detect, or correct misstatements on a timely basis |
| Significant Deficiency | `PCAOB_SIGNIFICANT_DEFICIENCY` | A deficiency, or combination, that is less severe than a material weakness but important enough to merit attention by those responsible for oversight of the company's financial reporting |
| Material Weakness | `PCAOB_MATERIAL_WEAKNESS` | A deficiency, or combination, such that there is a reasonable possibility that a material misstatement of the annual or interim financial statements will not be prevented or detected on a timely basis |

**Authoritative source**: PCAOB AS 2201 ¶A3–A7. The definitions are structurally similar to GAGAS's (both derive from AICPA) but PCAOB's thresholds are interpreted more strictly in the public-company ICFR context.

**Display vocabulary in PCAOB report (AS 3101 + AS 6115)**: "Material Weakness" / "Significant Deficiency" / "Control Deficiency" with specific PCAOB-prescribed language around the reasonable-possibility threshold and the magnitude-of-potential-misstatement assessment.

**Note on GAGAS ↔ PCAOB mapping**: the two schemes share vocabulary (Material Weakness, Significant Deficiency) but are not interchangeable. GAGAS's Material Weakness applies to any audit (financial, performance, attestation); PCAOB's applies specifically to ICFR for public companies. A multi-pack engagement attaching both GAGAS and PCAOB produces both classifications independently — see §3.

### 2.5 AICPA attestation classification (AT-C §205)

**Measures**: whether the examining auditor's opinion is unqualified, qualified, adverse, or a disclaimer.

**Categories**: this is technically an opinion classification, not a finding classification, but it appears on SOC 2 and similar attestation engagements. The resolver doesn't treat this as a finding classification; it's a report-level opinion that is rendered per-report based on the auditor's aggregate conclusions.

### 2.6 Single Audit classification addendum

**Measures**: Single Audit Act adds specific categorical flags that appear alongside a pack's severity classification — they are not alternative classifications but additional required metadata per finding.

**Additional flags** (from SINGLE_AUDIT:2024 overlay):

| Flag | Definition |
|---|---|
| `QUESTIONED_COSTS_KNOWN` | Specific dollar amount of federal funds charged inappropriately or supported by inadequate evidence |
| `QUESTIONED_COSTS_LIKELY` | Estimated total of questioned costs projected from sampled findings |
| `REPEAT_FINDING` | Whether this finding repeats a finding from a prior audit period |
| `IS_MATERIAL_WEAKNESS` | GAGAS-aligned MW determination, per 2 CFR 200.516(a)(1) |
| `IS_SIGNIFICANT_DEFICIENCY` | GAGAS-aligned SD determination, per 2 CFR 200.516(a)(2) |
| `IS_NONCOMPLIANCE_MATERIAL` | Whether noncompliance was material to a major program |

These flags extend the GAGAS classification rather than replace it. Single Audit findings always carry a GAGAS classification plus this extension.

### 2.7 ISSAI scheme (post-MVP, reserved)

International Standards of Supreme Audit Institutions define their own classification scheme (often aligned with GAGAS for financial audits and with IIA/OECD patterns for performance audits). Reserved for future pack support. Not in MVP 1.0 or 1.5.

---

## 3. Cross-pack translation rules

When a finding carries multiple classifications, reports render the classification appropriate to the report's `attestsTo` pack. This is the UX implication of the `union` resolution: every pack's classification lives on the finding; per-report rendering selects the relevant one.

### 3.1 The per-report rendering rule

Each Report entity declares `attestsTo: StandardPackRef`. When rendering the finding inside that report, the renderer:

1. Looks up the finding's `classifications[]` array
2. Filters to classifications whose `fromPack` matches the report's `attestsTo`
3. Displays that one classification using the pack-declared display vocabulary
4. Displays no other pack's classification (to avoid audience confusion)

**Worked example (Oakfield FY27)**: finding 2026-001 carries:
- `GAGAS_SIGNIFICANT_DEFICIENCY` (from GAGAS:2024)
- `IIA_MAJOR` (from IIA_GIAS:2024)

The Yellow Book report (`attestsTo: GAGAS:2024`) renders: "Significant Deficiency. The City's grant administration controls did not…"

The Audit Committee report (`attestsTo: IIA_GIAS:2024`) renders: "Major. The grant administration process presents material business risk due to…"

The Schedule of Findings and Questioned Costs (`attestsTo: SINGLE_AUDIT:2024`) — the Single Audit overlay declares it inherits the GAGAS classification for this rendering context, so it renders: "Significant Deficiency, questioned costs: $127,400 known / $340,000 likely…"

### 3.2 When a pack's classification is missing

If a finding is missing a classification for a pack whose report is being generated (edge case — usually caught by validation at engagement attachment time), the renderer displays a placeholder "Classification required per [PACK]" with a link to the finding's classification editor.

This should not happen in correctly-configured engagements because the finding editor's classification picker requires a value per attached pack with a classification scheme. Validation at save-time enforces this.

### 3.3 Cross-pack equivalence hints (informational only)

Although the schemes are not directly interchangeable, there are common equivalences that audit practitioners informally use. These are surfaced in the UI as informational hints during classification picking, not as automatic mappings:

| GAGAS | Approximately equivalent IIA | Approximately equivalent ISO | Notes |
|---|---|---|---|
| Material Weakness | Critical / Major | Major Nonconformity | ISO's Major NC is structurally different (clause-level); the equivalence is loose |
| Significant Deficiency | Major / Minor | Major NC (for significant single-clause failure) or Minor NC (for contained failure) | Not a direct map |
| Deficiency | Minor / Advisory | Minor NC or OFI | — |

These are hints to help auditors think about whether they've classified consistently across schemes. The system does not enforce equivalence; the auditor's judgement is authoritative on each classification independently.

### 3.4 Significant Deficiency — GAGAS vs. PCAOB divergence

A finding that's a Significant Deficiency under GAGAS is not always a Significant Deficiency under PCAOB, even though the vocabulary overlaps. PCAOB's AS 2201 ¶A3 requires both a reasonable-possibility likelihood assessment and a magnitude assessment specifically for the company's ICFR, while GAGAS's definition is broader.

For an engagement attaching both GAGAS and PCAOB, the auditor classifies independently under each scheme. The UI shows both classification pickers; a tooltip flags the potential-for-mismatch and links to the AS 2201 ¶A3 definition.

---

## 4. UI specification for classification picking

### 4.1 The classification picker component

Appears in the finding-authoring form when the engagement has ≥1 attached pack with a classification scheme. Renders as a stacked card:

```
┌─────────────────────────────────────────────────────────┐
│ Classifications                                          │
├─────────────────────────────────────────────────────────┤
│ GAGAS:2024 deficiency tier          (required)          │
│ ○ Deficiency                                            │
│ ● Significant Deficiency                                │
│ ○ Material Weakness                                     │
│ [ℹ Definitions]                                         │
├─────────────────────────────────────────────────────────┤
│ IIA GIAS:2024 severity              (required)          │
│ ○ Advisory                                              │
│ ○ Minor                                                 │
│ ● Major                                                 │
│ ○ Critical                                              │
│ [ℹ Business-impact tooltip] [ℹ Cross-scheme hint]       │
├─────────────────────────────────────────────────────────┤
│ SINGLE_AUDIT:2024 addendum          (required)          │
│ Questioned costs (known): $[127,400]                    │
│ Questioned costs (likely): $[340,000]                   │
│ Repeat finding? ( ● Yes  ○ No )                         │
│ Federal programs affected: [47.049, 93.310, 81.049]     │
└─────────────────────────────────────────────────────────┘
```

Each scheme is required (validation prevents save if any active scheme is unanswered).

### 4.2 Classification field definitions per pack

Packs declare their classification schemes in their `findingClassifications` field (per [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts)). The picker renders whatever the pack declares; no hardcoded classification vocabulary in the frontend.

### 4.3 Pack annotation/override affects classification

Per [`../03-feature-inventory.md`](../03-feature-inventory.md) Module 14 and [`strictness-resolver-rules.md §2.3`](strictness-resolver-rules.md), tenant-level pack annotations can extend a classification scheme. Example: a state audit bureau annotates GAGAS to add a state-specific "Critical" category above Material Weakness. The classification picker renders the extended scheme including the state-added category.

Annotation-added categories must be ordinally stricter than the pack's existing max (i.e., can only extend upward), not inserted mid-scale or replacing existing categories. Attempting to insert or replace is rejected at annotation-save time per strictness-resolver-rules §3.1 edge case.

---

## 5. Cross-report consistency validation

The finding carries classifications per attached pack. Reports render per their `attestsTo`. A gap in this system — classifications not surfacing in expected reports — can arise from misconfiguration.

### 5.1 Validation at save-time

When the auditor saves a finding, the system checks:
1. Every attached pack with a classification scheme has a classification on the finding (prevents saves with missing classifications)
2. Every classification references a pack that is currently attached to the engagement (prevents stale classifications after a pack detach)
3. Each classification's code is in the pack's declared `findingClassifications[]` (prevents classifications with invalid codes)

### 5.2 Validation at report-generation time

When a report is generated, the system checks:
1. The report's `attestsTo` pack is still attached to the engagement
2. Every finding included in the report has a classification for that pack
3. If any finding is missing the required classification, the report cannot be generated until the missing classification is supplied

These validations are per [`data-model/VALIDATION.md`](../../data-model/VALIDATION.md) Layer 4 and Layer 5 rules.

### 5.3 What happens when a pack is detached mid-engagement

Unusual but possible: an engagement starts with GAGAS + IIA; the team decides to remove IIA mid-fieldwork. Classifications under IIA remain on the findings (they're historical data) but the IIA report is no longer generated, and new findings don't require IIA classifications.

Pack detach from an in-progress engagement requires CAE approval and logs an override event. Findings don't lose their historical IIA classifications; they're just no longer required going forward.

---

## 6. Classification history and amendment

Findings (per [`docs/06 §2.5`](../../docs/06-design-decisions.md)) are bitemporal. Classification changes create new bitemporal rows; the audit log records the change.

### 6.1 When a classification changes during draft phase

Free. The auditor edits the classification; a new bitemporal row appends; the audit log records the change but doesn't flag it as "material amendment." No downstream impact until issuance.

### 6.2 When a classification changes after issuance

Major. Post-issuance changes to a classification require:
- CAE approval for the change
- Documentation of the reason (new evidence discovered; prior classification was wrong; external review identified an issue)
- Formal amendment record that carries forward to any distribution list
- Re-issuance of affected reports if the change materially alters the finding's presentation

This is covered in [`workflow-state-machines.md §4`](workflow-state-machines.md) (finding amendment workflow).

### 6.3 Reclassification for cross-pack migration

If a finding was classified under GAGAS:2018 and the engagement upgrades to GAGAS:2024 mid-fieldwork, the classification migrates per the pack-version-upgrade rules. For classification schemes, GAGAS:2018 → GAGAS:2024 is a straight migration (same three tiers; same definitions). A hypothetical GAGAS version that added a new tier would require explicit classification-review for each existing finding, with an override per finding.

---

## 7. Reporting implications

Each pack's classification appears in its dedicated reports. Cross-references across reports for the same finding are allowed but must be explicit.

### 7.1 Schedule of Findings and Questioned Costs (Single Audit)

Appears in the Single Audit overlay's required report. Lists every finding with:
- Finding reference number
- Federal program(s) affected with ALN
- GAGAS classification (`Material Weakness` / `Significant Deficiency`)
- Single Audit addendum fields (questioned costs, repeat indicator, compliance requirement)
- Full criteria / condition / cause / effect narrative
- Auditor recommendation
- Management response (or reference to separate management-response section)

### 7.2 Summary Schedule of Prior Audit Findings (Single Audit)

Lists findings from the prior audit period with current status:
- Fully resolved
- Partially resolved with status description
- Not yet resolved with reason
- Further action in progress with timeline

Classification on these findings is their current classification (not the original classification, if amended since). The summary distinguishes "original classification" from "current classification" if they differ.

### 7.3 Yellow Book report (GAGAS)

The Yellow Book report structures findings per GAGAS's four-element schema (CRITERIA / CONDITION / CAUSE / EFFECT) with the GAGAS classification tier in the finding header. The report explicitly cites the IAGAS §6.02 required elements for each finding.

### 7.4 Audit Committee report (IIA)

Structures findings per IIA's 5-element schema including inline recommendations. Uses IIA's business-impact severity framing. Avoids GAGAS's deficiency-tier vocabulary to prevent audience confusion.

### 7.5 ISO Audit Report (ISO 19011)

Lists nonconformities by clause number with category (Major / Minor) and evidence. OFIs appear in a separate section. Classifications are clause-referenced per ISO 19011 §6.5.

### 7.6 Aggregate classification distribution — dashboard

The Finding Aging Dashboard (Module 16, per [`../03-feature-inventory.md`](../03-feature-inventory.md)) shows finding counts by classification. For multi-pack engagements, the dashboard provides a pack-selector letting the user view the distribution under each scheme. This is a per-pack analytics view, not a cross-pack aggregation — GAGAS Material Weakness count and IIA Critical count are displayed separately, not combined.

---

## 8. Edge cases and clarifications

### 8.1 A finding might only apply to some attached packs

Not every finding is relevant under every attached pack. Example: an engagement attached GAGAS + PCAOB might have a finding about internal documentation procedures that is a GAGAS-audit finding but not an ICFR-specific finding. PCAOB would not require a classification for it.

The Finding entity has an `applicableMethodologies: StandardPackRef[]` field. If a pack is in the engagement's attached-packs list but not in a specific finding's `applicableMethodologies`, the finding does not require a classification for that pack. The classification picker renders that pack's field as "Not Applicable" with an explanation.

### 8.2 Classification-based filtering on dashboards

Dashboard filters (per Module 16) allow "show findings with classification X in pack Y." The filter queries the `classifications[]` array for matches.

### 8.3 Export of classification data

CSV exports and star-schema warehouse exports (per Module 15) flatten classifications per row. One finding with 3 classifications produces 3 rows in a long-format export, or a single row with JSON-encoded classifications column in a wide-format export. The choice is customer-configurable in the export settings.

### 8.4 Post-issuance amendment with classification change

Rare but real: a finding was issued as GAGAS Significant Deficiency; subsequent events (new evidence, external peer-review feedback, regulatory clarification) indicate it was actually a Material Weakness. Amendment flow:

1. CAE initiates amendment
2. Documents the reason
3. Classification is updated; bitemporal row appends; audit log records the change
4. If the Yellow Book report was already issued, a formal amendment is issued to the report's distribution list
5. The original issuance remains immutable in the historical record

Fully covered in [`workflow-state-machines.md §4.5`](workflow-state-machines.md).

### 8.5 Multiple applicable classification schemes in a single pack

Some packs may declare multiple classification schemes that all apply. For example, a hypothetical comprehensive PCAOB pack might declare separate schemes for ICFR deficiencies, compliance findings, and fraud-risk findings. The finding picker shows all applicable schemes; the finding carries classifications for each.

This is a pack-authoring discipline question (should the pack decompose into multiple subpacks?) that is addressed per pack in the pack's `findingClassifications[]` definition.

### 8.6 Classifications for findings on performance audits

Performance audits (under GAGAS Chapter 8, or IIA's operational audits) can have classifications less directly tied to financial-statement materiality. GAGAS 8.30 describes severity tiers for performance audit findings in terms of "significance to program effectiveness" rather than "material misstatement." The GAGAS pack's `findingClassifications[]` has context-conditional variations: the same finding schema supports financial-audit deficiency tiers and performance-audit significance tiers, selected by the engagement's type.

---

## 9. Classification-picker usability notes

From [`../02-personas.md`](../02-personas.md): Priya (AIC) spends real time on classification judgments. The UI's rendering of the picker affects whether she finds it useful or frustrating.

### 9.1 Tooltips with authoritative definitions

Every category label has a hover tooltip with the pack-declared definition (often verbatim from the source standard). Priya doesn't need to flip to a PDF to remind herself what "Significant Deficiency" means per GAGAS.

### 9.2 Cross-scheme hints

When she picks GAGAS Significant Deficiency, a subtle hint appears next to the IIA picker: "Common equivalent: Major." She can override, but the hint nudges consistency.

### 9.3 Keyboard shortcuts

Up/Down arrows move between categories within a scheme; Tab moves between schemes. Reduces the mouse time for experienced auditors classifying many findings in a session.

### 9.4 Bulk-classification flow

For engagements with many findings (uncommon but real for full-scope GAGAS performance audits), a bulk-classification modal lets the auditor classify 10 findings at once — pre-populated with a default classification based on similar prior findings, reviewable before save.

### 9.5 Classification confidence

An optional field per classification lets the auditor note confidence level ("confident," "uncertain — discussed with AIC," "provisional pending review"). This is metadata; it doesn't affect report rendering but it surfaces in the reviewer's inbox as a flag for supervisory attention.

---

## 10. References

- [`rules/strictness-resolver-rules.md §3.8`](strictness-resolver-rules.md) — classifications as a `union` dimension
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — `findingClassifications` field in `StandardPack`
- [`data-model/tenant-data-model.ts`](../../data-model/tenant-data-model.ts) — `Finding.classifications: FindingClassification[]`
- [`docs/03-the-multi-standard-insight.md` §6.2](../../docs/03-the-multi-standard-insight.md) — classifications as a per-pack severity scheme
- [`docs/02-worked-example-single-audit.md`](../../docs/02-worked-example-single-audit.md) — Oakfield FY27 with two classifications on one finding
- [`rules/workflow-state-machines.md §4`](workflow-state-machines.md) — classification change workflows
- GAGAS 2024 §6.40–6.45 — GAGAS deficiency tier definitions
- IIA GIAS 2024 Standard 11.1 — IIA finding elements (classification scheme is organisation-defined)
- PCAOB AS 2201 ¶A3–A7 — PCAOB deficiency tier definitions
- ISO 19011:2018 §6.4 — ISO nonconformity category definitions
- AICPA AU-C 265 — source for GAGAS's deficiency-tier incorporation

---

## 11. Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini) as part of the Phase 3 rule-files review cycle. **Verdict: Approved — no specific refinements requested for this file.** The per-pack classification schemes, union-resolution semantics, cross-pack rendering rules, and UI specifications were all endorsed as accurate and operationally sound.

Reviewer's overall Phase 3 verdict: *"Approved. These rules files are a masterclass in domain-driven design."* Other Phase 3 files received specific refinements; this file did not.

See the strictness-resolver-rules.md §9 R1 closure appendix for the overall Phase 3 review verdict and cross-file refinement summary.

---

*Last reviewed: 2026-04-21. Phase 3 deliverable; R1 review closed.*
