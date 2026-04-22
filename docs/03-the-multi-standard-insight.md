# The Multi-Standard Insight

> The central architectural bet. Why a single engagement needs to attach to multiple standards at once, why the three-tier pack taxonomy is not a pedantic distinction, and why the implications ripple through every layer of the system. If you only read one doc in this folder after the worked example, read this one.

---

## 1. The naïve question

The project started, roughly, with one question from a non-engineer stakeholder:

> *"A user will choose the type of engagement at creation — but is it possible that one engagement must be compliant with more than one standard?"*

The right answer is: yes, frequently, and sometimes statutorily. But the honest first answer should have been: *we assumed not, and if we had stayed with that assumption we would have built the wrong product.*

The AIMS v1 codebase treats an engagement as implicitly GAGAS-shaped. The data model has a single `standard` relationship. The workflow rules are GAGAS rules. The finding schema is GAGAS's four elements. The report template is GAGAS's ten sections. Everything compiles down to *one standard per engagement*.

That was correct for v1 because v1 only supported GAGAS. It stopped being correct the moment we decided to support multiple audit methodologies. At that point the schema had two plausible shapes:

- **Shape A** — an engagement has one "standard" field. If you want to apply multiple standards, create multiple engagements, copy the findings between them, and manage the duplication.
- **Shape B** — an engagement can attach to multiple standards. One engagement, multiple compliance claims, one set of findings rendered differently per standard.

Shape A is simpler to implement and wrong. Shape B is harder to implement and right. This document is about why.

---

## 2. When multi-standard engagements actually happen

A multi-standard engagement is not a theoretical concern. Four patterns appear constantly in real audit practice. Each is backed by a specific authority.

### 2.1 Required by statute — Single Audit

The Single Audit Act (31 U.S.C. §§ 7501–7507) and its implementing regulations at 2 CFR 200 Subpart F require audits of non-federal entities that expend $1M or more in federal awards per fiscal year. §200.514(a) states:

> *"The audit must be conducted in accordance with GAGAS."*

And §200.515 requires the auditor deliver opinions on the financial statements (under GAAS, via GAGAS's incorporation of AICPA AU-C), a report on internal control and compliance under GAGAS §6.02, and Single-Audit-specific reports under Uniform Guidance.

Three standards, one engagement, required by law. Not optional.

Volume: the Federal Audit Clearinghouse receives approximately 40,000 Single Audits per year. Every single one is a three-standard engagement.

### 2.2 Required by regulation — Integrated Audit (PCAOB AS 2201)

Section 404(b) of Sarbanes-Oxley requires an auditor's attestation on the effectiveness of the entity's internal control over financial reporting — but only for **accelerated filers and large accelerated filers**. Smaller Reporting Companies (SRCs) and Emerging Growth Companies (EGCs) are exempt from the §404(b) auditor attestation, though management must still perform §404(a) self-assessment. In practice, this captures approximately the Fortune 1000 — the overwhelming majority of public-company audit fees, but not every public registrant.

PCAOB Auditing Standard 2201 ¶.06 requires, for the audits it does cover:

> *"The auditor should plan and perform the audit of internal control over financial reporting to provide sufficient appropriate audit evidence to support the auditor's opinion on internal control over financial reporting as of the date specified in management's assessment. The auditor also may use the same tests to gather evidence to support the auditor's opinion on the financial statements."*

The operative word is *integrated*. One engagement, two opinions (FS + ICFR), using shared evidence. ¶.86 permits combined or separate reports; ¶.89 requires the same report date when separate.

For every accelerated-filer public company, the annual audit is a two-opinion engagement. Not optional.

### 2.3 Professionally common — GAGAS "in conjunction with" IIA

GAGAS 2024 Chapter 2 explicitly anticipates combination with other professional standards:

> *"GAGAS does not incorporate other standards by reference, but recognizes that auditors may use or may be required to use other professional standards in conjunction with GAGAS."*

For performance audits specifically, GAGAS permits elective use of PCAOB standards, ISA (IAASB), or IIA standards alongside GAGAS.

This pattern is the backbone of public-sector internal audit. A state auditor's office or federal OIG that runs an IIA-GIAS-conforming internal audit function *and* performs GAGAS-required Single Audits attaches both standards to those engagements. The IIA itself publishes an "Orange Book" — a standards-alignment tool — specifically to help functions manage the GAGAS + IIA overlap.

Volume: IIA cites 230,000+ members globally. A meaningful fraction — tens of thousands — work in public-sector or government-adjacent settings where GAGAS is also in play.

### 2.4 Structurally integrated — ISO management system audits

For ISO management system certifications (ISO 9001 quality, ISO 14001 environmental, ISO 27001 information security, ISO 45001 occupational health), the audit methodology is ISO 19011:2018. The *object* being audited — the management system — is often multiple ISO standards at once. An organization certified to ISO 9001 + ISO 14001 + ISO 27001 + ISO 45001 wants one combined audit covering all four, not four separate audits.

The International Accreditation Forum codified this in IAF MD 11:2023, which permits integrated management system audits with audit-time discounts (longest single-standard time + 50% of each additional standard, with a 20% overall reduction cap). Single engagement, multiple attached standards, formally blessed.

Volume: ISO certification bodies perform hundreds of thousands of management system audits per year globally; most large manufacturers and regulated-industry organizations hold multiple simultaneous ISO certifications.

### 2.5 A fifth case — supply-chain and reciprocity frameworks

Beyond the four statutory/regulatory/professional/structural patterns above, modern compliance increasingly asks one engagement to cover *multiple mutually-recognized frameworks*. Examples:

- **HITRUST CSF** serves as an overarching framework that maps to HIPAA, NIST 800-53, ISO 27001, and PCI DSS — one HITRUST audit theoretically satisfies four downstream compliance obligations
- **StateRAMP** incorporates FedRAMP controls for state-level usage — one assessment satisfies both
- **SOC 2 + ISO 27001 reciprocity** — increasingly, service organizations certify to one and reference the other's shared controls

These are not a *different kind* of multi-standard engagement; they're handled natively by our control-framework multi-attachment model (attach HITRUST + NIST 800-53 + ISO 27001 to an engagement; our cross-framework crosswalks in each control definition handle the reciprocity). But they're worth naming as a fifth practical pattern so reviewers don't assume the taxonomy of four we described is exhaustive.

### 2.6 The pattern

Multi-standard engagements are not edge cases. They are:

- A 40,000-per-year statutory mandate in the US alone (Single Audit)
- Every accelerated-filer public company's annual audit (Integrated Audit)
- The dominant pattern in public-sector internal audit (GAGAS + IIA)
- The dominant pattern in ISO certification (integrated MS audits)
- An increasing pattern in compliance reciprocity (HITRUST, StateRAMP, SOC 2 ↔ ISO 27001)

A product that does not model them as a first-class concept is not a serious audit platform. It is a tool for one of the above segments and an approximation for the others.

---

## 3. What multi-standard actually requires structurally

A product can pay lip service to multi-standard — attach a tag that says "IIA GIAS" to an engagement and call it done. That works until someone tries to do real work.

Real multi-standard support requires the platform to reconcile, for a single engagement, differences that span *four* architectural dimensions:

**Workflow differences.** GAGAS has specific phase-gate requirements (§7.05-7.10 for planning; §6.33 for fieldwork supervision). IIA GIAS requires QAIP concurrent review per Standard 15.1. PCAOB requires an independent Engagement Quality Review per AS 1220. ISO 19011 requires documented audit team competence per §5.4. When you attach multiple methodologies, you must satisfy all of their workflow requirements — usually by layering additional steps on top of the primary's workflow, not by inventing a new merged workflow.

**Finding shape differences.** GAGAS §6.39 defines four required elements (Criteria, Condition, Cause, Effect). IIA GIAS Standard 15.1 defines five ("5 Cs" — adds Recommendation inline). ISO 19011 Cl. 6.4 uses three categories (Nonconformity / Observation / OFI) with different structural fields — audit criteria, objective evidence, and (for Major NCs) root cause. PCAOB ICFR findings use deficiency severity tiers (Deficiency / Significant Deficiency / Material Weakness) with formal definitions in AS 2201 ¶A3-A7. When you attach multiple standards to an engagement, your finding has to render correctly under each methodology's expectations.

**Report shape differences.** GAGAS §6.02 specifies a ten-section report template. PCAOB AS 3101 specifies an opinion letter format. ISO 19011 §6.6 specifies an integrated management system report structure. Single Audit (per 2 CFR 200.515(d)) requires multiple separate reports including the Schedule of Findings and Questioned Costs, SEFA, Summary Schedule of Prior Audit Findings, and Corrective Action Plan. Each standard's report has specific required content, specific format expectations, and specific distribution rules.

**Rule differences.** CPE hours, documentation retention, peer review cycles, independence cooling-off periods — every standard has its own. GAGAS requires 80 CPE hours per 2 years with 24 governmental; IIA CIA requires 40 hours per year. GAGAS documentation retention is 5 years (via AU-C); PCAOB is 7 years (via SOX §802); 2 CFR 200.517 is 3 years. GAGAS peer review is every 3 years; IIA external QAIP is every 5. When multiple standards are attached, the auditor must satisfy the stricter of each.

Three observations from this.

**First** — this is not a "map one thing to many tags" problem. It is a "reconcile genuinely different operating models" problem. Control-library tools that let you map SOC 2 CC6.1 to NIST 800-53 AC-2 to ISO 27001 A.5.17 are solving a valuable but adjacent problem — compliance mapping. Methodology reconciliation is harder because the differences are in *how the audit runs*, not just in *what it tests against*.

**Second** — the reconciliation is not about picking one standard and calling the others "nice to have." The auditor's report will claim compliance with each; if any claim is invalid, the report itself is defective. The platform must satisfy all attached standards simultaneously.

**Third** — the reconciliation produces real conflicts. GAGAS's independence cooling-off is 24 months; IIA's equivalent is 12 months. PCAOB's documentation retention is 7 years; AICPA's is 5. These aren't "roughly the same thing" — they are *different rules* and you have to pick one to apply. The platform has to make that choice and document why.

---

## 4. The three-tier taxonomy

Most commercial audit and GRC platforms that claim multi-standard support treat "standard" as a single flat concept — a framework, a regulation, a policy, an authority document. All equal; all attached to controls; all contributing to compliance mapping.

That flattening is an error. It's not a cosmetic error; it produces a wrong mental model that propagates into the product. The three-tier taxonomy we adopted is the corrective.

### A mnemonic before the specifics

The word "standard" is doing three different grammatical jobs in different contexts:

- **Standard as a verb** — *how* you audit. The process. GAGAS, IIA GIAS, ISO 19011 are verbs: they name methodologies, actions, approaches. They *audit*.
- **Standard as a noun** — *what* you audit against. The thing being tested. SOC 2, ISO 27001, NIST 800-53 are nouns: they name bodies of testable criteria. They *are audited*.
- **Standard as an adjective** — a *modifier* layered on top. Single Audit is adjectival in structure: it's not a methodology on its own and not a control framework — it qualifies how GAGAS applies when federal funds cross a threshold.

Legacy GRC tools treat all three as nouns because that's the easiest schema choice. Our three-tier taxonomy — methodology (verb), control_framework (noun), regulatory_overlay (adjective) — is the schema that matches the actual grammar of the domain.

When you're stuck on whether a new item we want to model is a methodology or a framework or an overlay, ask: *does it audit, is it audited, or does it modify how something audits?* Usually obvious once you frame it that way.

### 4.1 Three types of thing that look alike

A user onboarding an audit engagement in a GRC platform sees a menu something like: *"Select applicable frameworks: SOC 2, ISO 27001, NIST 800-53, HIPAA, PCI DSS, GAGAS, IIA GIAS, ISO 19011, Single Audit, SOX §404, CSRD..."*

These are not the same kind of thing. Mixing them in one menu is category confusion. We can separate them cleanly into three distinct types:

| Type | Plain-English description | Examples |
|---|---|---|
| **Methodology** | How you audit. The process, workflow, finding shape, independence rules, reporting structure that govern *the act of auditing itself*. | GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, ISSAI, AICPA AT-C |
| **Control Framework** | What you audit against. The library of testable control objectives or criteria the audit evaluates. | SOC 2 Trust Services Criteria, ISO 27001, NIST 800-53, NIST CSF, COBIT 2019, HIPAA Security Rule, PCI DSS, COSO 2013 |
| **Regulatory Overlay** | Additional requirements layered on top of a host methodology when specific regulation applies. Neither a methodology on its own nor a control library. | Single Audit (Uniform Guidance), SOX §404 requirements, CSRD/ESRS reporting obligations |

**Methodology** and **Control Framework** are orthogonal. An ISO 19011 audit (methodology) of an ISO 27001 ISMS (control framework) is one engagement. A GAGAS performance audit (methodology) of a program's compliance with agency policy (no formal control framework in the library sense) is another. An AT-C attestation (methodology) of a service organization's controls against SOC 2 (control framework) is a third.

**Regulatory Overlay** is a third axis that modifies a methodology. Single Audit is not a methodology — it's a statutory set of additional requirements that apply *on top of* GAGAS. SOX §404 is not a methodology — it's a regulatory requirement that shapes how AICPA/PCAOB methodology runs for public companies.

### 4.2 Why the distinction matters

Two tests tell you whether the distinction is pedantic or architectural.

**Test 1 — does the answer to "what's the engagement's workflow?" depend on the item in question?** If yes, it's a methodology. If no, it's not.

- GAGAS? Yes — GAGAS defines specific phase gates, independence declarations, work paper supervision rules. **Methodology.**
- SOC 2? No — SOC 2 doesn't define workflow. The workflow comes from the attestation methodology (typically AT-C §105/§205). SOC 2 defines *what* you test. **Control Framework.**
- Single Audit? No — Single Audit doesn't define workflow. The workflow comes from GAGAS. Single Audit adds specific deliverables (SEFA, Schedule of Findings and Questioned Costs) and specific content rules (questioned costs, repeat-finding indicators). **Regulatory Overlay.**

**Test 2 — does the item define a finding schema?** If yes, it's either a methodology (owns its schema) or a regulatory overlay (adds extensions to the methodology's schema).

- GAGAS defines four elements. **Methodology.**
- ISO 27001 does not define a finding schema — it's a list of controls. The auditor testing against ISO 27001 structures findings per ISO 19011's methodology schema. **Control Framework.**
- Single Audit extends GAGAS findings with questioned-costs and ALN fields. It doesn't define the core schema; it adds. **Regulatory Overlay.**

Both tests point to the same three-way split. The tests are consistent because the split reflects a real underlying structure: some things are about *how you audit*, others are about *what you audit against*, and a third category is about *regulatory layers that modify the how*.

### 4.3 What competitors do wrong

The three largest competing platforms each handle this differently. None cleanly.

**ServiceNow IRM** models all three types as a single `sn_grc_authority_document` entity. GAGAS and SOC 2 and Single Audit are all Authority Documents, differentiated only by free-text attributes. The data model does not know the difference between "how to audit" and "what to audit against." Workflow and finding schema are generic to the engagement (via `sn_audit_engagement`); they don't vary with the attached authority document. The Authoritative Source → Citation → Control Objective → Control chain is brilliant for control-framework mapping and silent on methodology.

**AuditBoard (now Optro)** scopes their product by *module* rather than by standard type. SOXHUB is the SOX module. CrossComply is the control-library-and-framework-mapping module. OpsAudit is the internal-audit workflow module. A customer who needs GAGAS methodology plus SOC 2 control testing plus Single Audit overlay would need OpsAudit + CrossComply + RegComply — three separate product modules purchased separately. The methodology-vs-framework distinction is invisible in their data model; it is *implicit* in their product packaging.

**TeamMate+ (Wolters Kluwer)** handles this via *project templates*. A GAGAS template configures the workflow, finding fields, and report structures for GAGAS. An IIA template does the same for IIA. A customer who needs both builds a third template that tries to satisfy both. The templates are tenant-configured, often by implementation services; the standard-vs-standard distinction is implicit in which template you pick. Methodology is not a data-model object; it's a configuration bundle.

Each of these approaches works well for the segment it was designed for. None generalizes to "this engagement simultaneously claims conformance with GAGAS and IIA GIAS and must satisfy Single Audit requirements" in a way that scales.

### 4.4 How AIMS v2 models it

Our `StandardPack` entity has an explicit `packType` discriminator taking one of three values:

```ts
type PackType =
  | "methodology"
  | "control_framework"
  | "regulatory_overlay";
```

Each value unlocks a different content shape. Methodology packs carry workflow, finding elements, classification schemes, checklists, independence rules, CPE rules, report definitions. Control framework packs carry control libraries with cross-framework mappings. Regulatory overlay packs carry additional finding elements, additional reports, and rule overrides to apply to their host methodology.

An engagement attaches to packs at pack-type-appropriate slots:

```ts
interface Engagement {
  primaryMethodology: StandardPackRef;         // exactly one, must be packType: methodology
  additionalMethodologies: StandardPackRef[];  // zero-to-many additional methodologies
  controlFrameworks: StandardPackRef[];        // zero-to-many control frameworks
  regulatoryOverlays: StandardPackRef[];       // zero-to-many regulatory overlays
}
```

This shape is not the same as "tag the engagement with a list of strings." It is an explicit declaration that methodology, framework, and overlay are different kinds of relationship, serving different purposes, with different validation rules, different UI placements, and different downstream consequences.

The worked example in the Oakfield engagement attached:

- **Primary methodology**: GAGAS:2024
- **Additional methodology**: IIA_GIAS:2024
- **Regulatory overlay**: SINGLE_AUDIT:2024
- **Control framework**: SOC2:2017 (added later for vendor testing)

Four attachments, three types, one engagement. The system doesn't flatten them.

---

## 5. The competitive picture — fresh evidence

In April 2026 we validated the competitive assumptions against live vendor documentation. The findings:

### 5.1 AuditBoard / Optro (rebranded March 9, 2026)

Their portfolio has nine modules. The methodology/framework distinction is not visible in their data model or their marketing. An engagement in OpsAudit does not carry a "methodology standard" field — methodology is emergent from a combination of tenant configuration and the module you're working in.

When IIA released GIAS 2024 to replace IPPF 2017, AuditBoard's product response was a static gap-assessment checklist shipped in July 2024. This is revealing: if methodology had been an engagement-level object, shipping a new methodology version would have been the obvious response. Instead, they shipped compliance guidance — the kind of content update you ship when methodology lives in unstructured tenant configuration.

Their "30+ frameworks" list reads (in order, roughly): SOC 2, ISO 27001, SOX, NIST CSF, NIST 800-53, HIPAA, GDPR, CCPA, PCI DSS, COBIT, COSO, CMMC, FedRAMP, HITRUST, DORA, CSRD, ESRS, SASB, TCFD, GRI, ISO 42001, NIST AI RMF, EU AI Act. These are all control frameworks or regulatory obligations. GAGAS, IIA GIAS (as a methodology, not a gap-assessment checklist), ISO 19011, Single Audit, and ISSAI do not appear.

Their customer roster is Fortune 500 commercial — Estée Lauder, BNY Mellon, Cisco, Amgen, and so on. No public state/local government, no federal OIG, no college/university audit shop named.

**Reading**: they own commercial internal audit + compliance-framework mapping. They are absent from methodology-driven audit and from government audit. That absence is structural, not a gap they're imminently filling.

### 5.2 ServiceNow IRM

We pulled the data model from their Yokohama release documentation. The key entities:

- `sn_grc_authority_document` — flat type for regulations, frameworks, standards. No packType discriminator.
- `sn_compliance_citation` — children of authority documents.
- `sn_compliance_control_objective` — M:N with citations.
- `sn_compliance_control` — instantiated per profile, linked to control objectives.
- `sn_audit_engagement` — the engagement entity.

The relationship between Engagement and Authority Document is *indirect*. There is no `sn_audit_m2m_authority_document_engagement` table. Engagements link to Controls (via `sn_audit_m2m_control_engagement`), Risks, and Profiles. Authority document coverage is computed transitively through controls.

This schema is elegant for "one control satisfies citations from multiple authority documents" — ServiceNow's strength. It is structurally silent on methodology. GAGAS, ISO 19011, IIA GIAS, and SOC 2 would all be modeled as Authority Documents with equal footing — which erases exactly the distinction our three-tier taxonomy preserves.

**Reading**: the best-in-class compliance-mapping tool in the market has no concept of methodology-as-object. It is a different product, solving a different problem. It is not a direct competitor to a methodology-first tool.

### 5.3 TeamMate+ / Wolters Kluwer

800+ government agency customers. Explicitly marketed as "Yellow Book and Red Book aligned" and scoped for Uniform Guidance / Single Audit work. The incumbent in US government audit.

Their methodology model is *templates in TeamStore* — a content library that ships with GAGAS-aligned project templates. Customers configure additional templates per tenant, typically through implementation services. A shop doing both GAGAS and IIA builds separate templates and picks one at engagement creation; multi-standard means template sprawl managed by the audit function's administrators.

When Wolters Kluwer acquired StandardFusion in January 2026, they added control-framework mapping (150+ compliance frameworks) to the platform. This closes the control-framework gap that was their weakness. It does not change the methodology model — StandardFusion's library is control frameworks, not audit methodologies. GAGAS and IIA GIAS remain template-driven; Single Audit remains implicit in the template.

Reviewer feedback on TeamMate+ (via third-party review sites): *template sprawl*, *admin-gated customization*, *schema rigidity*, *reporting formatting complaints*, *long implementations (6-12 months)*. All consistent with a template-driven model for something that would be better served by a structured object model.

**Reading**: the dominant government audit platform uses templates where we use versioned first-class methodology packs. That is a real architectural difference. Our model solves the template-sprawl + schema-rigidity + methodology-versioning-is-manual pain points directly.

### 5.4 What this means

No commercial audit platform in April 2026 supports engagement-level multi-standard methodology as a first-class capability.

This is not a temporary gap. The three platforms above represent the three dominant approaches (control-library-centric, workflow-module-centric, template-centric). Each has been iterating for years. Each has made design decisions that make adding methodology-as-object expensive for them — it would require reshaping their core data model.

For AIMS v2, this is the moat. We are not competing with a better widget; we are competing with a better mental model of the problem. The mental model is directly visible in the schema.

---

## 6. The implications cascade

The decision to model engagement-level multi-standard as first-class does not stay contained. It ripples through every other major architectural choice. Six specific cascades.

### 6.1 Findings — semantic core with pack-specific extensions

If a finding must render under multiple methodologies simultaneously, the finding's data shape cannot be a single methodology's schema. It also cannot be a flat bag of unrelated fields — a reader of the report needs to see the finding's *semantic content* rendered in the target methodology's vocabulary.

The solution: a semantic core keyed by canonical element codes (`CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, and others) plus per-pack extensions for pack-specific fields (Single Audit's questioned-costs, ISO's NC clause reference).

Each methodology pack declares a `semanticElementMappings` array that maps its own element codes onto canonical codes. GAGAS's `criteria` maps to `CRITERIA` with `exact` equivalence. ISO 19011's `audit_criteria` maps to `CRITERIA` with `close` equivalence (ISO narrows to a specific clause). The platform uses these mappings to render the canonical semantic content in each pack's vocabulary.

The implication for Oakfield: Priya fills in the four semantic-core fields once. The Yellow Book report (under GAGAS) renders them under GAGAS's labels. The IIA Audit Committee report renders the same data under IIA's labels — the Recommendation appearing inline as the "5th C" because IIA declares that rendering. Same data; two correct renderings.

### 6.2 Classifications — per-pack severity schemes, legitimately divergent

Different standards measure severity against different yardsticks. GAGAS classifies control deficiencies by likelihood of material misstatement (Material Weakness / Significant Deficiency / Deficiency, per AS 2201-aligned definitions in §6.41-6.44). IIA classifies findings by business impact (internal functions typically use Critical / Major / Minor / Advisory or similar). ISO 19011 classifies nonconformities by severity of clause violation (Major NC / Minor NC). PCAOB uses the strict AS 2201 tier with formal magnitude-and-likelihood tests.

These schemes are not the same scheme with different labels. A finding that's a Significant Deficiency under GAGAS might be Major under IIA *or* it might be Minor under IIA — because the two classifications are measuring different things.

We store classifications as an array, one per attached pack. A single finding carries a GAGAS classification and an IIA classification (and, for engagements where it applies, an ISO classification, a PCAOB classification, and so on). Reports render the classification appropriate to the report's attested pack. Schemas can legitimately disagree; we don't try to reconcile them into a single number.

### 6.3 Recommendations — separate entity, many-to-many with findings

The question *"how do recommendations attach to findings?"* has four different answers across the four major methodologies:

- **GAGAS §6.47** — separate report section; one recommendation may address multiple findings; a finding may have zero or many recommendations. (A finding about questioned costs on a program the auditee has already closed has no remediation to recommend — the finding stands alone.)
- **IIA GIAS Standard 15.1** — integrated with the finding as the "5th C"; required on every finding.
- **ISO 19011 Cl. 6.4** — auditor does not issue recommendations in the GAGAS/IIA sense. Nonconformities trigger auditee-prepared Corrective Action Requests. OFIs are a separate finding *type*, not a field.
- **PCAOB AS 2201 / AS 1305** — auditor-issued recommendations on ICFR are prohibited. Recommending remediation and then testing the remediation creates a self-review threat to independence. Private audit-committee communication is permitted; public-report recommendations are not.

No unified recommendation model satisfies all four. The solution: recommendations are a *separate entity* from findings, with a many-to-many relationship (`findingIds: string[]`). Each recommendation can address multiple findings (GAGAS-style). Rendering is controlled by the target report's `recommendationPresentation` setting:

- `inline` — render with each finding (IIA style)
- `separate` — render in a consolidated schedule (GAGAS style)
- `suppressed` — do not render (PCAOB ICFR)
- `both` — render inline *and* in a consolidated schedule

A finding can additionally carry a `soxSuppressRecommendation: true` flag (set by PCAOB methodology packs) that forces suppression regardless of report template choice.

This is substantially more complex than "recommendation is a field on finding." It's also the only shape that models the actual regulatory diversity correctly.

### 6.4 Reports — multi-report per engagement, each attesting to a pack

The Single Audit produces seven reports from one engagement, per 2 CFR 200.515(d). Each report attests to a different authority; each has a different content structure; each has a different distribution list. Modeling this as "one engagement has one report with multiple sections" flattens the legal structure and conflates attestation claims.

Every report has an `attestsTo: StandardPackRef` field declaring the pack the report conforms to. The Yellow Book report attests to GAGAS:2024. The Schedule of Findings and Questioned Costs attests to SINGLE_AUDIT:2024. The Report to Audit Committee attests to IIA_GIAS:2024. Findings are cross-listed into each report via the report's `includedFindingIds` array — the same finding appears in multiple reports, rendered differently each time.

The compliance-statement builder reads the engagement's attached packs (filtering to those with `conformanceClaimed: true`) and assembles each report's "conducted in accordance with..." sentence correctly. The Yellow Book report says:

> *"We have audited, in accordance with the auditing standards generally accepted in the United States of America and the standards applicable to financial audits contained in Government Auditing Standards issued by the Comptroller General of the United States..."*

The Audit Committee report says:

> *"This engagement was conducted in conformance with the Global Internal Audit Standards, and in conjunction with the Government Auditing Standards (GAGAS 2024 revision) as required by the Single Audit Act and Uniform Guidance..."*

Each report sees only the packs relevant to its audience, in language appropriate to that audience.

This is Gemini's and Oakfield practitioners' favorite feature for a reason: it mirrors how Single Audit actually works. Most commercial GRC tools flatten it into "one engagement, one report template," which forces auditors to generate the multi-report package in Word outside the system. Moving this *inside* the system is a real practitioner win.

### 6.5 Strictness resolver — union or max of rules across attached packs

With multiple methodologies attached, you have multiple opinions on the same operating rule. Our strictness resolver computes, at engagement creation, the effective rule per category:

- **Max**: documentation retention (pick the longest), independence cooling-off (pick the longest)
- **Union**: CPE hours by topic (auditor must satisfy both 80/2yr GAGAS *and* 40/yr CIA where both apply)
- **Min**: peer review cycle length (shorter = stricter)

Each computed value carries a `drivenBy` audit trail recording which pack contributed the winning value. Two years later, when someone asks *"why is retention five years?"* the answer is queryable: GAGAS drove it via AICPA AU-C incorporation.

The resolver re-runs on any pack attach or detach. Change events are logged. This is not a minor convenience feature — it's the mechanism that lets the platform enforce multi-standard compliance without the auditor having to maintain a spreadsheet of "which rule from which standard wins when they differ."

### 6.6 Pack versioning — methodologies have versions that engagements pin

GAGAS 2018 and GAGAS 2024 are different standards, with some of the same mechanics and some different ones. An engagement started under GAGAS 2018 and completed before the 2024 effective date applies 2018 rules. An engagement started after the 2024 effective date applies 2024 rules. A hypothetical engagement straddling the transition complies with whichever version the auditor elected under the transition guidance.

Our schema versions packs explicitly: `GAGAS:2024` and `GAGAS:2018` are different `StandardPack` records with the same `code` and different `version`. Engagement's attached packs carry both fields. When GAGAS 2025 eventually ships (or 2028, or whenever), existing engagements do not auto-migrate; new engagements default to the newest effective version but can pin older versions when the transition rules require.

The versioning story cascades into the pack-authoring model (packs must be authored per-version, not as living documents), the dependency graph (Single Audit requires a specific GAGAS version), and the reporting output (compliance statements must cite the correct version — "in accordance with GAGAS, 2024 revision").

Competitor platforms that treat methodology as tenant-configured templates handle version transitions as content updates applied *globally* — every new engagement picks up the new template; in-flight engagements have to decide whether to adopt the updated template mid-stream. Our versioned-pack model makes that decision an explicit per-engagement choice rather than an inherited tenant-wide decision.

### 6.7 Data export, BI, and the 2D flattening problem

A cascade we glossed over in the first draft: customers will want to pipe finding data into BI tools (Power BI, Tableau, Looker), into data lakes (Snowflake, Databricks), and through APIs into downstream risk dashboards. That is a normal enterprise expectation for any system of record.

Our finding shape makes this hard in ways competitors' shapes do not. A flattened "one finding per row" export has to collapse:

- The semantic core keyed by canonical element codes (variable number of elements depending on what the auditor filled in — some engagements use only the four GAGAS-canonical elements, others add `OBJECTIVE_EVIDENCE`, `ROOT_CAUSE`, etc.)
- The `standardExtensions` map, keyed by pack, where each pack contributes its own field set (Single Audit contributes six fields; ISO contributes three; GAGAS contributes none because its fields are all in the semantic core)
- The `classifications` array — variable length, one per attached pack, where the classification schemes themselves are different (GAGAS severity tier vs. IIA severity tier vs. ISO NC category)
- The recommendation M:N (a finding can have zero, one, or many recommendations; each recommendation can address one or many findings)

Flattening this to a 2D relational shape loses information. Keeping it in nested JSON columns works for some BI tools (Power BI via DirectQuery + JSON parsing) and not others. Excel consumers simply cannot work with nested data.

The consequence: we owe the product at least three export shapes out of the box — a fully-flattened "widest row" CSV that repeats engagement-level fields and pivots a chosen pack's extensions into columns, a denormalized JSON-lines export that preserves the structure, and a normalized star-schema export (engagement / finding / finding_extension / classification / recommendation tables) suitable for loading into a warehouse. Each shape is opinionated and none of them is the shape the customer's existing BI dashboards expect, because customer dashboards were built against flat competitor schemas.

This is a real cost that the richer data model imposes on BI integration. Mitigations: we prioritize the star-schema warehouse export as the primary shape (most serious analytics customers have a warehouse), we ship Power BI and Tableau template files as part of the analytics SDK, and we document the flattening choices explicitly so customers who build custom pipelines make the same choices we would have made. The cost does not go away; it gets better tooling.

---

## 7. What this gives us strategically

The three-tier taxonomy and its cascade are genuinely defensible competitive positioning. Seven specific advantages:

**1. Government audit vertical.** TeamMate+'s incumbency in US state/local government and federal OIG is real, but the pain points reviewers consistently cite — template sprawl, admin-gated customization, schema rigidity — are symptoms of the template model. A versioned-methodology-pack model directly addresses each. Entry into this vertical is not "build a better widget" but "reshape the mental model." That's harder to replicate than a feature.

**2. Single Audit specifically.** The 40,000-per-year Single Audit market is large, underserved by modern SaaS, and structurally multi-standard by statute. Any audit platform claiming to serve it needs to handle GAGAS + GAAS + Uniform Guidance as a stacked requirement, produce seven reports from one engagement, and cross-list findings per 2 CFR 200.515(d). We model that natively; competitors approximate with templates and Word.

**3. IIA GIAS 2024 transition.** The January 9, 2025 effective date replaced the 2017 IPPF with an entirely new structure (5 Domains / 15 Principles / 52 Standards). Commercial audit platforms had to scramble content updates to handle it; our versioned-pack model makes it a first-class transition (old engagements pinned to legacy; new engagements default to GIAS; transition scheduling is per-engagement, not global).

**4. ISO integrated management system audits.** IAF MD 11:2023 permits combined 9001 + 14001 + 27001 + 45001 audits — the dominant pattern in large regulated-industry organizations. Our engagement mode `combined`, the ability to attach multiple control framework packs, and the cross-framework crosswalks in each control definition model this pattern natively. The ISO certification body market is fragmented, serving it with a unified tool is real blue water.

**5. Methodology pack format as a standard.** Publishing our `StandardPack` JSON Schema as an open format invites industry contributions — regional audit standards, specialized industry methodologies, custom in-house frameworks. The format becomes a de facto methodology-exchange layer. Competitors' proprietary methodology models create lock-in; our open format inverts the lock-in.

**6. Compliance-statement automation.** Hand-typing "conducted in accordance with..." sentences is a persistent source of auditor errors (wrong version cited, wrong standards listed, forgot one). Our compliance-statement builder reads the engagement's attached packs and generates the correct sentence for each report automatically. This is a small feature that, at scale, eliminates a real source of audit defects.

**7. OSCAL-compatibility for control frameworks.** NIST's OSCAL format handles control catalogs well — and we adopt OSCAL for control_framework packs specifically. It does not handle audit methodology. By adopting OSCAL for control frameworks and maintaining our richer methodology-pack format for methodologies, we interoperate with the standards ecosystem exactly where it makes sense and innovate where the ecosystem hasn't yet reached.

---

## 8. What this costs us

Honest trade-offs. The three-tier taxonomy is not free.

**Complexity for the user at engagement creation.** Users have to pick a primary methodology, optionally add additional methodologies, optionally add control frameworks, optionally add regulatory overlays. That's four questions where competitor products ask one. We mitigate with smart defaults (picking "Single Audit" as engagement type auto-selects GAGAS + Single Audit overlay), but the cognitive surface is larger than competitors'.

**Pack authoring burden.** A pack is not a tenant configuration — it's a structured, versioned artifact with semantic mappings, classification schemes, workflow definitions, report definitions, and more. Our three currently-authored methodology packs (GAGAS, IIA GIAS, ISO 19011) each run to hundreds or thousands of lines. A regional audit association that wants to encode its standard as an AIMS pack cannot do so casually — they need domain experts, they need schema understanding, they need validation tooling. We're building a pack-authoring SDK, but the activation energy is real.

**Cross-standard reconciliation is hard.** The strictness resolver handles the easy cases (max retention, union CPE). It does not handle the hard cases — where two standards have contradictory *process* requirements rather than contradictory *numeric thresholds*. GAGAS requires per-engagement independence declaration; IIA requires annual. These don't conflict (we collect both). But GAGAS requires specific audit-procedure documentation detail that IIA does not require, and IIA requires specific engagement-charter language that GAGAS does not require. We handle these as additive, but that means our system enforces the union — potentially more bureaucracy than either standard alone would require.

**The "multi-standard engagement" concept is unfamiliar.** Commercial GRC tools have trained their users to think in terms of "control frameworks" or "methodology templates" — each flattened into a single selection. Teaching users to think in terms of "primary methodology + additional methodologies + control frameworks + regulatory overlays" is a mental model shift. The worked example exists specifically to ease that shift; but it's still an asymmetric onboarding cost.

**Standards bodies change faster than we can keep up.** GAGAS 2024 came out; we updated. IIA GIAS 2024 came out; we updated. ISO 27001:2022 came out; we'll update. NIST CSF 2.0 came out. CMMC 2.0 shifted effective dates. The velocity of standards updates is a real maintenance burden — the more standards we support, the more we have to track. Some of this can be automated (change-feed watching from ISO, AICPA, GAO, IIA); most requires human review.

**Document generation is a first-class engineering problem, not a feature.** §6.4 promises seven reports from one Single Audit engagement, each rendering the same findings in a different pack's vocabulary, each applying a different recommendation-presentation rule (inline vs. separate vs. suppressed), each citing a different "conducted in accordance with..." statement. That is not solvable with an off-the-shelf templating library and a few Handlebars partials.

What we actually need is a programmable document-generation engine that can: branch on `attestsTo` pack to select vocabulary; read `semanticElementMappings` to rename canonical element codes into pack-specific labels; conditionally include or suppress recommendations per report-template rule and per-finding `soxSuppressRecommendation` flag; render classifications using the pack's classification scheme; and produce output in Word (for regulator-mandated filings), PDF (for distribution), and HTML (for in-app preview) with identical content.

Think Adobe InDesign engine complexity, not a Word mail-merge. Commercial alternatives exist — Thomson Reuters HighQ, iText, Syncfusion, Aspose — but they're templating tools, not methodology-aware document engines. The cross-product of methodology × report-type × output-format is large enough that we will almost certainly have to build and maintain a significant in-house document layer. This is a real R&D sink that does not show up in a schema review but shows up in the engineering roadmap immediately.

None of these costs is a reason to give up the architecture. All of them are reasons to make the architecture *easier to work with* over time — better onboarding, better pack-authoring tools, better standards-change monitoring, better document-engine tooling, better user education.

---

## 9. When we might be wrong

The multi-standard thesis is a bet. Like any thesis, it might turn out to be wrong. Specific falsifying conditions we should watch for:

**If a major competitor ships a methodology-as-object model.** Optro acquires TeamMate+; ServiceNow adds a `sn_audit_methodology` entity distinct from Authority Document; AuditBoard ships GAGAS as a native methodology. Any of these would compress the moat significantly. The response would be to double down on open pack format + community contributions + vertical-specific features (Single Audit, ISO IMS).

**If the 40,000 Single Audit/year market turns out to be less willing to pay for SaaS than we've assumed.** Small-firm auditors of nonprofit grantees are price-sensitive. If the serviceable addressable market at a meaningful price point is smaller than projected, the vertical story weakens. We've budgeted AIMS-tier pricing at $29-49/user/month precisely to test this assumption early.

**If regulatory changes collapse the methodology differences we're modeling.** If (say) the AICPA's Quality Management Standards absorb significant portions of IIA GIAS and PCAOB QC 1000 — and PCAOB inspection convergence happens further — the per-methodology customization surface could shrink. The three-tier taxonomy would still be structurally right but the practical multi-standard engagements would become less onerous to handle with a flatter model.

**If AI-assisted audit work fundamentally changes the form factor.** If methodology conformance becomes something auditors ask an AI to verify rather than something they structurally enforce through the platform, the value of explicit methodology modeling decreases. We watch; if AI displaces methodology enforcement, we adapt. (It's more likely, for now, that AI *amplifies* methodology enforcement by surfacing rule conflicts earlier — but we're alert.)

**If we're wrong about the competitive picture.** Training-data-based competitor assessments, even live-doc-validated ones, can miss things. If we discover a competitor has quietly shipped engagement-level multi-standard methodology — particularly in the government audit vertical — we reposition. The research is documented in `references/multi-standard-design.md` and `references/competitor-analysis.md`; updates there are annually at minimum.

**If the standards bodies commoditize machine-readable methodology formats.** Our methodology-pack format is proprietary. It is the structural expression of our moat: competitors would have to reshape their data models to adopt an equivalent, and reshaping is expensive. But that moat depends on the absence of a common format.

If GAO, IIA, PCAOB, IAASB, or ISO were to publish their methodologies in a unified machine-readable format — an OSCAL-equivalent for audit methodology, rather than OSCAL's current scope of control catalogs — the entire industry would converge on ingesting that format. Competitors who were previously blocked by data-model assumptions would only need to write an importer. Our advantage in having authored GAGAS, IIA GIAS, and ISO 19011 as structured packs becomes a sunk cost, not a moat; new packs arrive for free from the standard-setters themselves.

This is not imminent. OSCAL took NIST nearly a decade to develop for controls and the audit-methodology domain has more regulatory fragmentation, more jurisdictional variance, and less government funding than the control-catalog domain. But it is possible, and it is specifically a state-driven change we cannot control. If it happens, our strategic position shifts from "we built the only structured methodology model" to "we were early to a format that is now commoditized" — which still has some value (domain expertise, vertical relationships, compliance-statement-builder IP) but is materially less defensible.

Mitigation is to contribute to, rather than resist, any emerging standard. If an OSCAL-for-methodology effort emerges, AIMS should be at the authoring table — our pack format is already the most mature in the field, and contributing it as the starting point locks in our vocabulary as the de facto structure. We win by shifting moat from *proprietary format* to *best implementation of an open format*.

These falsifying conditions are specific and testable. The thesis is not unfalsifiable.

---

## 10. Related reading

- **[02 — Worked example](02-worked-example-single-audit.md)** — the Oakfield Single Audit scenario where every concept in this doc is grounded in real user actions.
- **[05 — Glossary](05-glossary.md)** — every term used above, defined.
- **[06 — Design decisions](06-design-decisions.md)** — the ADR-style decision log for each of the eight architectural decisions the multi-standard insight cascaded into.
- **`references/multi-standard-design.md`** — the formal design note that drove the schema work, including the research process, the competitive validation round, and the resolution of six open questions.
- **`references/competitor-analysis.md`** — full competitive evidence from April 2026 live-doc validation.
- **`data-model/standard-pack-schema.ts`** — the actual schema this doc describes.
- **`data-model/examples/`** — five example packs demonstrating all three pack types (GAGAS, IIA GIAS, ISO 19011 as methodologies; Single Audit as regulatory overlay; SOC 2 as control framework).

---

## 11. Domain review notes

This doc has been through two external domain-expert review rounds (Google Gemini, April 2026). The reviews were adversarial in the useful sense — asked to find what was wrong, overstated, or missing. Both rounds produced specific corrections rather than vibes. Recording them here both to credit the reviewer and to document what changed so future editors understand why the current draft reads the way it does.

### Round 1 — first-draft review

- **GAGAS 2024 effective date** — original draft placed Oakfield's fiscal year as Sep 1, 2025 – Aug 31, 2026, which would technically fall under GAGAS 2018 (the 2024 revision is effective for financial audits for periods beginning on or after Dec 15, 2025). Fix: shifted the scenario to FY July 1, 2026 – June 30, 2027 (also more realistic for state universities); cascaded every downstream date (fieldwork, report issuance, FAC filing, CAP follow-up) accordingly. Changes landed in `02-worked-example-single-audit.md`, not this doc.
- **"CFDA" vs "ALN"** — original draft used "CFDA" (Catalog of Federal Domestic Assistance) in a few places. The current term is Assistance Listing Number (ALN) — the SAM.gov rebrand is formally in effect. Fix: updated terminology in the worked example and codified the rule in `engineering/CODE-STANDARDS.md` with a current-vs-legacy terminology table enforceable in code review.

### Round 2 — post-revision review

- **§2.2 public-company audit scope overstatement** — original draft said "every US public company's annual audit is a two-opinion engagement." Technically, §404(b) of Sarbanes-Oxley only requires the auditor's ICFR attestation for accelerated filers and large accelerated filers; Smaller Reporting Companies and Emerging Growth Companies are exempt from §404(b) though management still performs §404(a) self-assessment. Fix: rewrote §2.2 to scope correctly — in practice roughly Fortune 1000, the overwhelming majority of public-company audit fees, but not every registrant.
- **IIA member count** — original draft cited ~200,000. IIA's current public positioning is 230,000+ members globally. Fix: updated §2.3.
- **Missing fifth multi-standard pattern** — original draft named four patterns (statutory / regulatory / professional / structural). Gemini pointed out that modern supply-chain and reciprocity frameworks (HITRUST CSF mapping to HIPAA/NIST 800-53/ISO 27001/PCI DSS; StateRAMP incorporating FedRAMP; SOC 2 ↔ ISO 27001 reciprocity) are a distinct practical pattern increasingly driving multi-standard engagements. Fix: added §2.5 naming the reciprocity pattern; renumbered old §2.5 → §2.6.
- **Grammar mnemonic for the three-tier taxonomy** — Gemini endorsed the idea of a "standard-as-verb / standard-as-noun / standard-as-adjective" mnemonic to help readers classify items quickly. Fix: added the mnemonic at the top of §4 along with the diagnostic question ("does it audit, is it audited, or does it modify how something audits?").
- **Missing data-export cascade** — original §6 cascade missed BI/data-lake/API-export implications. Flattening nested semantic-core + classifications + extensions + M:N recommendations to 2D relational shapes loses information; customers' existing BI dashboards were built against flat competitor schemas. Fix: added §6.7 explicitly acknowledging the cost and naming the three export shapes we owe the product (flattened CSV, JSON-lines, star-schema warehouse export).
- **Missing document-generation-engine trade-off** — §6.4 promises seven reports per Single Audit engagement, each methodology-aware. Original §8 did not acknowledge this is a first-class R&D problem — not solvable with off-the-shelf templating. Fix: added a new paragraph to §8 naming the document-generation engine explicitly as a real cost that does not appear in schema reviews but shows up in engineering roadmap immediately.
- **Missing falsifying condition — machine-readable methodology standards** — original §9 listed five falsifying conditions. Gemini pointed out we missed the structural one: if GAO/IIA/PCAOB published their methodologies in a unified machine-readable format (an OSCAL-for-methodology equivalent), our proprietary StandardPack moat would collapse. Fix: added the falsifying condition to §9 along with the mitigation (contribute to, rather than resist, any emerging standard).

The current draft is the state of thinking as of 2026-04-20. Further reviews are invited; track changes here rather than silently editing.

---

*Last reviewed: 2026-04-20.*
