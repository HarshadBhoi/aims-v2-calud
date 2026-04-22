# Glossary

> Every term used in AIMS v2, defined. Read section-by-section for orientation; bookmark and jump to any single entry as needed. Cross-links point to the **[Worked Example](02-worked-example-single-audit.md)** where the term appears in context.

---

## How to use this glossary

Terms are grouped by domain. Within each group, terms are alphabetized. For terms that mean different things in different standards or contexts, separate definitions are flagged. **False-friend warnings** at the end highlight terms that look alike but aren't.

Format:

> **Term** *(aliases, abbreviations)*
> Plain-English definition. Regulatory citation if applicable. Cross-link to Worked Example §N where the term appears in context.

---

## 1. Audit domain — core concepts

> **Audit Charter** — A document, typically approved by the board or audit committee, that establishes the audit function's purpose, authority, and responsibility. Required by IIA GIAS Principle 6. Typically includes independence-of-the-function declaration, reporting line, access rights, and conformance-standard commitments. [Worked Example §1]

> **Audit Finding** *(Finding)* — A documented conclusion about a condition the auditor has determined to be problematic or noteworthy. A finding has a structured form — the "four elements" (GAGAS) or "five Cs" (IIA) — and must be supported by sufficient appropriate audit evidence. Different audit standards have different expectations for finding form; AIMS v2 models findings with a semantic core plus per-pack extensions. [Worked Example §6]

> **Audit Planning Memorandum** *(APM, Audit Plan, Engagement Plan)* — The structured document that captures objectives, scope, risk assessment, materiality, team composition, budget, and deliverables for an engagement before fieldwork begins. Under GAGAS §7.05-7.10, the APM has fourteen required sections for performance and financial audits. [Worked Example §4]

> **Audit Report** — The final, publicly issued document communicating the auditor's opinion, conclusions, findings, and recommendations. Report structure is dictated by the attesting standard (GAGAS §6.02 ten-section template; PCAOB AS 3101 opinion format; ISO 19011 §6.6 integrated management report). One engagement may produce multiple reports. [Worked Example §9]

> **Audit Universe** — The complete inventory of auditable entities within an organization. An internal audit function typically maintains an audit universe of processes, systems, and business units, and selects specific engagements from it based on risk assessment. Per IIA GIAS Principle 9. Not covered deeply in the Worked Example; maintained as a separate tenant-level record.

> **Auditee** *(Engagement Client)* — The entity being audited. The terminology varies: GAGAS uses "auditee"; IIA uses "engagement client"; ISO uses "audited organization." AIMS v2 uses "auditee" as the canonical term but respects pack-specific terminology overrides in rendered UI text. [Worked Example §1]

> **Auditor-in-Charge** *(AIC, Engagement Supervisor, Lead Auditor)* — The auditor responsible for the day-to-day conduct of a specific engagement, reporting to a Senior Auditor or directly to the CAE. Signs off on the engagement's work papers and reports. Different standards use different terms; AIMS v2 defaults to AIC but renders the standard-appropriate term per pack. [Worked Example §1]

> **Chief Audit Executive** *(CAE, Director of Internal Audit, Auditor General, Inspector General)* — The senior-most person responsible for the internal audit function. Has direct access to the board or audit committee. Per IIA GIAS Principle 7. [Worked Example §1]

> **Compliance Requirement** — Under Uniform Guidance (2 CFR 200), a specific requirement from the OMB Compliance Supplement Part 3 that a federal award recipient must comply with. Categories include Activities Allowed or Unallowed, Allowable Costs / Cost Principles, Cash Management, Eligibility, Equipment and Real Property Management, Matching/Level of Effort/Earmarking, Period of Performance, Procurement and Suspension and Debarment, Program Income, Reporting, Subrecipient Monitoring, and Special Tests and Provisions. [Worked Example §6]

> **Condition** — The state or situation the auditor observed — what actually is happening. One of the four elements of a finding per GAGAS §6.39b. Semantically identical to IIA's "Condition" (GIAS Standard 15.1) and close to ISO 19011's "Objective Evidence" (Clause 6.4.7). [Worked Example §6]

> **Corrective Action Plan** *(CAP, Follow-up, Management Action Plan)* — The auditee's documented plan to address a finding, including responsible party, planned actions, and target completion dates. Under 2 CFR 200.511(c), required for every Single Audit finding. AIMS v2 models CAP as a separate entity linked back to findings and recommendations. [Worked Example §7, §11]

> **CPE** *(Continuing Professional Education)* — Required ongoing education for licensed auditors. GAGAS §4.16-4.26 requires 80 hours every two years with 24 in governmental topics. IIA CIA requires 40 hours per year. PCAOB/AICPA CPA rules vary by jurisdiction but typically 40 hours per year. AIMS v2 tracks CPE per user and enforces engagement-entry requirements per the engagement's active packs. [Worked Example §1]

> **Cause** — The underlying reason the condition occurred — why the gap between the criteria and the condition exists. One of the four elements per GAGAS §6.39c. Equivalent to IIA's "Root Cause" (Standard 14.2 requires root-cause analysis more explicitly than GAGAS) and to ISO 19011's "Root Cause" (Clause 6.4.8, required for Major Nonconformities). [Worked Example §6]

> **Criteria** — The benchmark against which the auditor compares the condition — what should be. Typically a law, regulation, contract term, professional standard, best practice, or internal policy. One of the four elements per GAGAS §6.39a. Semantically equivalent across GAGAS and IIA; narrower under ISO 19011, where "Audit Criteria" (Clause 6.4) typically refers to a specific clause of the audited management system standard. [Worked Example §6]

> **Deficiency** — A control weakness. GAGAS §6.41-6.44 and PCAOB AS 2201 recognize three tiers in ascending severity: Deficiency, Significant Deficiency, Material Weakness. The specific definitions vary by standard (PCAOB is most formally defined via AS 2201 ¶A3-A7). [Worked Example §6]

> **Effect** — The actual or potential impact of the condition — the outcome or consequence. One of the four elements per GAGAS §6.39d. IIA uses "Consequence" (more business-natural phrasing); semantically the same slot. ISO 19011 has no explicit "Effect" element — impact is implied but not a required element. [Worked Example §6]

> **Engagement** *(Audit, Assessment, Review)* — A single unit of audit work with defined objectives, scope, team, and timeline. The central workflow entity in AIMS v2. [Worked Example §2]

> **Engagement Mode** — AIMS v2 concept. A five-valued enum describing how an engagement's attached standards relate: `single`, `integrated`, `statutory_stacked`, `combined`, `in_conjunction`. See the individual mode entries below. [Worked Example §2]

> **Evidence** — Information supporting the auditor's conclusions. Must be sufficient (quantity) and appropriate (quality and relevance). GAGAS §8.48-8.56 defines evidence sufficiency and reliability requirements. ISO 19011 uses "Objective Evidence" (Clause 6.4.7). [Worked Example §5]

> **Fieldwork** *(Testing, Examination)* — The phase of an engagement where the auditor tests controls, samples transactions, conducts interviews, and gathers evidence. Typically the longest phase. [Worked Example §5]

> **Final Engagement Review** *(Engagement Quality Review, EQR)* — CAE- or concurring-partner-level review of an engagement before report issuance. Required by GAGAS §5.01 and IIA GIAS Std 12.3. PCAOB AS 1220 requires a similar Engagement Quality Review for public-company audits. [Worked Example §10]

> **Follow-up** — The post-issuance process of tracking whether auditee corrective actions are implemented. Per GAGAS §6.76, required for significant findings. Per IIA GIAS Standard 15.4, required for all recommendations. [Worked Example §11]

> **Independence** — The auditor's freedom from conditions or relationships that would compromise objective judgment. GAGAS §3.26-3.107 is generally the strictest framework; IIA GIAS Principle 2 is comparable in principle but less prescriptive on specific scenarios. AICPA, PCAOB, and IAASB each have their own independence regimes. [Worked Example §1, §4]

> **Independence Declaration** — A formal, signed statement from an auditor attesting that they have considered and resolved threats to independence for a specific engagement. GAGAS §3.26 requires per-engagement declarations; IIA typically relies on annual attestations. AIMS v2 tracks both. [Worked Example §4]

> **Management Letter** *(Management Comments Letter)* — A communication to the auditee containing observations that don't rise to the level of a reportable finding but are worth noting. Distinct from the formal audit report. Not modeled as a separate entity in AIMS v2; handled as a minor finding classification or as a CAP comment.

> **Materiality** — The threshold below which misstatements or control deficiencies are considered unimportant. Overall financial statement materiality typically computed as a percentage of total assets or revenue (often 0.5-2%); Single Audit materiality computed per-program under Uniform Guidance. [Worked Example §4]

> **Nonconformity** *(NC, Conformity Gap)* — ISO terminology for a finding. Three tiers: Major NC, Minor NC, Observation. Semantically equivalent to GAGAS "Finding" or IIA "Observation" but with ISO-specific classification and corrective-action requirements. [See false-friend warning §8]

> **Observation** — Three different meanings. See false-friend warning §8.

> **OFI** *(Opportunity for Improvement)* — ISO 19011 terminology for a suggestion that isn't a nonconformity but represents potential improvement. Not an NC; does not require corrective action but the auditee may choose to respond. Distinct from IIA "Advisory" findings despite some overlap in practice. [See false-friend warning §8]

> **Peer Review** — External review of an audit function's conformance with its applicable professional standards. GAGAS §5.73 requires external peer review every three years for government auditors; IIA GIAS Std 8.3 requires external QAIP assessment every five years; PCAOB conducts registered-firm inspections on similar cycles. Each is attached to the function, not the engagement — but individual engagements may be sampled during review. [Worked Example §10]

> **Phase Gate** — A workflow checkpoint where an engagement transitions from one phase (e.g., Planning) to the next (e.g., Fieldwork Authorized). AIMS v2 models phase gates as validation checkpoints — required criteria must be met before the transition is allowed. [Worked Example §4]

> **Planning** — The phase of an engagement before fieldwork, covering risk assessment, scoping, team assembly, independence confirmation, and budget approval. Culminates in the APM. [Worked Example §4]

> **Questioned Costs** — Single Audit terminology (2 CFR 200.516(b)) for federal-award expenditures that the auditor has identified as potentially unallowable. Two types: **Known** (specific costs identified as questionable) and **Likely** (projected from statistical sampling). [Worked Example §6]

> **QAIP** *(Quality Assurance and Improvement Program)* — IIA's term for the internal audit function's ongoing quality program, including internal assessments (continuous and periodic) and external assessments (every five years). Per IIA GIAS Principle 8. [Worked Example §1, §10]

> **Recommendation** — The auditor's suggested corrective action for a finding. Structure varies dramatically by standard: GAGAS treats recommendations as a separate report section (§6.47); IIA treats them as the 5th element of a finding (inline, "5 Cs"); ISO doesn't issue auditor recommendations (uses Corrective Action Requests instead); PCAOB prohibits auditor-issued recommendations on ICFR audits (independence — self-review threat). AIMS v2 models Recommendation as a separate entity with M:N to findings. [Worked Example §7]

> **Repeat Finding** — Under 2 CFR 200.516(b)(7), a Single Audit finding that recurs from a prior year. Required to be flagged. May trigger increased risk assessment by awarding agencies. [Worked Example §6, §11]

> **Risk Assessment** — The process of identifying and evaluating risks that could affect the achievement of objectives. Per GAGAS §7.09 (engagement-level) and IIA GIAS Principle 9 (function-level). [Worked Example §4]

> **Sampling** — The practice of examining a subset of transactions or controls and projecting conclusions to the population. Types: statistical (random, with formal projection) and non-statistical (judgmental, no formal projection). GAGAS §8.48-8.56 and AICPA AU-C 530 govern evidence sufficiency. [Worked Example §5]

> **Scope** — What an engagement covers. Typically includes affected programs or processes, time period, locations, and testing methodology. Documented in the APM's Objectives and Scope section. [Worked Example §4]

> **SEFA** *(Schedule of Expenditures of Federal Awards)* — Required for every Single Audit under 2 CFR 200.510(b). Lists all federal award expenditures by program, pass-through identifier, and amount. Audited for completeness and accuracy. [Worked Example §9]

> **Single Audit** — The US federal audit required for non-federal entities that expend $1M or more in federal awards per fiscal year (threshold as of FY ending Sep 30, 2025 and after; previously $750k). Statutorily requires GAGAS + GAAS + Uniform Guidance. Produces multiple report artifacts. [Worked Example §1-11]

> **Sufficient Appropriate Evidence** — The two-part evidence standard: *sufficient* refers to quantity (enough to support the conclusion); *appropriate* refers to quality (relevant and reliable). Per GAGAS §8.48-8.56, the auditor must have both. [Worked Example §5]

> **Work Paper** *(Working Paper, Audit Documentation)* — The documented record of audit procedures performed and evidence gathered. Under GAGAS §6.33 and AICPA AU-C 230, work papers must enable an experienced reviewer to understand the nature, timing, and extent of procedures, results, and conclusions. Retention typically 5-7 years (varies by standard — see **Retention** entry in §4). [Worked Example §5, §12]

---

## 2. Standards and bodies

> **AICPA** *(American Institute of Certified Public Accountants)* — The US CPA profession's body. Issues GAAS (via Auditing Standards Board), attestation standards (AT-C), quality management standards, and ethics rules. CPAs perform non-issuer audits under AICPA standards.

> **Auditing Standards Board** *(ASB)* — The AICPA committee that issues GAAS via Statements on Auditing Standards (SAS). Statements are codified into the AU-C (Audits of Non-Issuer Entities Codification) section numbering used throughout.

> **COBIT** *(Control Objectives for Information and Related Technologies, 2019)* — ISACA's IT governance and management framework. 40 governance and management objectives across 5 domains (EDM, APO, BAI, DSS, MEA). Used as a control framework in IT audits, often layered under SOX ICFR audits for ITGC scope. In AIMS v2, COBIT is a `control_framework` pack.

> **COSO 2013** *(COSO Internal Control — Integrated Framework)* — The Committee of Sponsoring Organizations of the Treadway Commission's internal control framework. 17 principles across 5 components (Control Environment, Risk Assessment, Control Activities, Information and Communication, Monitoring Activities). De facto required framework for SOX ICFR audits. In AIMS v2, COSO 2013 is a `control_framework` pack.

> **GAAS** *(Generally Accepted Auditing Standards)* — The US AICPA auditing standards applicable to non-issuer audits. Codified in AU-C (Audits of Non-Issuer Entities Codification). Organized by section numbers (e.g., AU-C 230 Audit Documentation; AU-C 530 Audit Sampling).

> **GAGAS** *(Generally Accepted Government Auditing Standards, "Yellow Book")* — Issued by the US Government Accountability Office (GAO). Applies to audits of federal, state, and local government entities and programs, and to non-federal entity audits required to be in accordance with GAGAS (e.g., Single Audits). 2024 revision effective December 15, 2025. Eight chapters covering general standards, quality management, financial audits, attestation engagements, and performance audits. In AIMS v2, GAGAS:2024 is the flagship `methodology` pack.

> **GAO** *(US Government Accountability Office)* — Issues GAGAS. Also conducts audits of federal programs on behalf of Congress. Led by the Comptroller General.

> **IAASB** *(International Auditing and Assurance Standards Board)* — Issues International Standards on Auditing (ISA) — used internationally as the counterpart to US GAAS. Housed at IFAC (International Federation of Accountants).

> **IAF** *(International Accreditation Forum)* — Global body for accreditation of conformity assessment. Publishes IAF Mandatory Documents (MDs), including MD 11:2023 for integrated management system audits. Not an audit standard itself; governs accreditation bodies that in turn accredit certification bodies.

> **IIA** *(Institute of Internal Auditors)* — Global professional body for internal auditors. Issues the Global Internal Audit Standards (GIAS 2024, effective January 9, 2025), which replaced the 2017 International Professional Practices Framework (IPPF). Offers the CIA (Certified Internal Auditor) certification. In AIMS v2, IIA_GIAS:2024 is a `methodology` pack.

> **IIA GIAS 2024** *(Global Internal Audit Standards, 2024)* — The IIA's professional standards framework, effective January 9, 2025. Replaced the 2017 IPPF. Organized into 5 Domains, 15 Principles, 52 Standards.

> **INTOSAI** *(International Organization of Supreme Audit Institutions)* — Global body for national-level audit offices. Publishes ISSAI (International Standards of Supreme Audit Institutions). Not typically applicable to private-sector or subnational audit.

> **ISACA** *(Information Systems Audit and Control Association)* — Global IT governance, risk, audit body. Issues COBIT. Offers the CISA certification.

> **ISO** *(International Organization for Standardization)* — Global standards-issuing body. Publishes thousands of standards; relevant here are ISO 19011:2018 (auditing management systems), ISO 27001:2022 (ISMS), ISO 9001:2015 (quality), ISO 14001:2015 (environment), ISO 45001:2018 (OHS).

> **ISO 19011:2018** *(Guidelines for Auditing Management Systems)* — The audit methodology used for ISO management system audits. Distinct from the management system standards being audited against (27001, 9001, etc.). In AIMS v2, ISO_19011:2018 is a `methodology` pack.

> **ISO 27001:2022** *(Information Security Management Systems — Requirements)* — The ISMS standard. 2022 revision restructured Annex A controls from 114 (in 14 domains) to 93 (in 4 themes). Transition from :2013 deadline October 31, 2025. In AIMS v2, ISO 27001 would be a `control_framework` pack (not a methodology).

> **ISSAI** *(International Standards of Supreme Audit Institutions)* — INTOSAI's standards framework. Organized into four levels: Principles (1000s), Professional Standards (100s for Fundamental Principles; 200s for Auditing Principles), Guidelines (3000s, 4000s, 5000s). Used by national SAIs and often referenced in donor-funded-program audits internationally.

> **PCAOB** *(Public Company Accounting Oversight Board)* — Issues US auditing standards for public-company (issuer) audits. Created by Sarbanes-Oxley. Standards begin "AS" (e.g., AS 2201 for ICFR, AS 3101 for opinion format, AS 1220 for Engagement Quality Review). Inspects registered firms on a 1- or 3-year cycle.

> **SEC** *(Securities and Exchange Commission)* — US public-company regulator. Doesn't issue auditing standards directly but defers to PCAOB for issuer audits. Enforces SOX. Rules reporting requirements for public filers.

> **SOX** *(Sarbanes-Oxley Act of 2002)* — US law governing public-company accountability. Relevant here: §302 (CEO/CFO certifications), §404 (management's and auditor's reports on ICFR), §802 (record retention). AS 2201 is the PCAOB standard implementing the §404(b) auditor reporting requirement.

---

## 3. Regulatory overlays — specific regulatory frameworks

> **Assistance Listing Number** *(ALN, formerly CFDA)* — The numeric identifier for a federal program in the US federal Assistance Listings catalog. Format: NN.NNN (e.g., 47.049 for NSF Mathematical and Physical Sciences, 93.310 for NIH Trans-NIH Research Support). Required on Single Audit findings per 2 CFR 200.516(b)(2). [Worked Example §6]

> **CSRD / ESRS** *(Corporate Sustainability Reporting Directive / European Sustainability Reporting Standards)* — EU mandatory ESG disclosure requirements. Phased effective dates starting FY2024 for large listed companies. Would be a `regulatory_overlay` pack in AIMS v2. Not covered in the Worked Example.

> **EU AI Act** — European Union regulation on artificial intelligence, entered force August 2024 with phased application through 2026-2027. High-risk AI systems require conformity assessments. Could be a `regulatory_overlay` in future.

> **FedRAMP** *(Federal Risk and Authorization Management Program)* — US federal program standardizing security authorization for cloud services used by federal agencies. FedRAMP Moderate and FedRAMP High are the tiers relevant to most cloud vendors. Not an audit methodology; rather a compliance framework. Relevant to AIMS v2 as a Phase 6 certification target.

> **HIPAA** *(Health Insurance Portability and Accountability Act)* — US healthcare privacy + security law. The Security Rule (45 CFR §164.308-316) defines administrative, physical, and technical safeguards. Relevant when customers are "covered entities" or "business associates." Would be a `control_framework` pack in AIMS v2.

> **NIS2** *(Network and Information Security Directive 2)* — EU directive on cybersecurity, in effect October 2024. Expands on NIS (2016). Sector-specific requirements; some overlap with ISO 27001 controls.

> **OMB Compliance Supplement** — Annual publication from the US Office of Management and Budget that identifies the specific compliance requirements auditors must test in a Single Audit. Organized by compliance requirement type (Part 3) and by federal program (Parts 4 and 5). [Worked Example §5, §6]

> **PCI DSS** *(Payment Card Industry Data Security Standard)* — Cardholder-data security requirements. Version 4.0 effective March 2024. Administered by the PCI Security Standards Council. Would be a `control_framework` pack.

> **Single Audit Act** — US federal law (31 U.S.C. §§ 7501-7507) requiring audits of non-federal entities expending federal awards. Implementing regulations at 2 CFR 200 Subpart F (Uniform Guidance). In AIMS v2, represented as the `SINGLE_AUDIT:2024` `regulatory_overlay` pack. [Worked Example §1, §6]

> **Uniform Guidance** *(2 CFR 200)* — Unified regulations for federal grants management, including Subpart F audit requirements. Revised periodically; relevant changes for 2024 include the Single Audit threshold raised from $750k to $1M. [Worked Example §1]

---

## 4. AIMS v2 internal terms

> **Additional Methodologies** — Optional methodology packs attached to an engagement beyond the primary. Contribute additional workflow requirements (e.g., IIA QAIP concurrent review), additional compliance statements, and possibly additional report artifacts. [Worked Example §2]

> **Applicable Methodologies** — On a Finding, the list of methodology packs under which the finding is reported. Subset of the engagement's attached methodologies. [Worked Example §6]

> **attestsTo** — On a Report, the specific pack whose compliance criteria the report conforms to. A Single Audit engagement produces reports attesting to GAAS (via AICPA_AUC), GAGAS, and Single Audit — different reports for different attestation authorities. [Worked Example §9]

> **Classifications** — On a Finding, an array of severity labels from different packs' schemes. Same finding can carry multiple legitimately-disagreeing classifications (e.g., GAGAS "Significant Deficiency" alongside IIA "Major"). [Worked Example §6]

> **Compliance Statement Builder** — AIMS v2 report generation component that assembles the "Conducted in accordance with..." sentence from the attached packs with `conformanceClaimed: true`. Per-report, not per-engagement — reports attesting to different packs include different statements. [Worked Example §9]

> **Conformance Claimed** — Field on an engagement's pack attachment indicating whether the pack's compliance will be asserted in the final report. Allows applying a methodology without claiming conformance (e.g., using IIA methodology when the function's QAIP is not up to date). [Worked Example §2]

> **Control Definition** — A testable control within a control framework pack. Includes code, title, description, points of focus, testing guidance, and cross-framework crosswalks. SOC 2:2017 ships with 33+ Common Criteria controls. [Worked Example §12]

> **Control Framework** *(control_framework pack)* — One of the three pack types. Represents *what* the engagement audits against — e.g., SOC 2, ISO 27001, NIST 800-53, COBIT. Contains a control library. Does NOT define workflow, finding schema, or report format (those come from the attached methodology pack). [Worked Example §12]

> **Core Elements** — On a Finding, the semantic-core element values keyed by canonical semantic codes (CRITERIA, CONDITION, CAUSE, EFFECT, etc.). Extensible — packs can declare new semantic codes without schema changes. [Worked Example §6]

> **Cross-framework Crosswalk** — On a Control Definition, a mapping to controls in other frameworks. Example: SOC 2 CC6.1 cross-linked to ISO 27001 A.5.17, NIST 800-53 IA-2, HIPAA §164.312(a). Enables the "test once, satisfy many" compliance pattern. [Worked Example §12]

> **drivenBy** — On an EngagementStrictness, the audit-trail field recording which pack contributed the winning value for each rule. Answers "why is our retention 5 years rather than 3?" after the fact. [Worked Example §3]

> **Engagement Strictness** — The computed operating rules for an engagement — the union-or-max of independence cooling-off, CPE hours, documentation retention, peer review cycle, etc., across all attached packs. [Worked Example §3]

> **Equivalence Strength** — On a Semantic Element Mapping, how closely a pack's element matches the canonical semantic code. Values: `exact`, `close`, `overlapping`, `divergent`. Example: GAGAS Criteria is `exact` to canonical CRITERIA; ISO 19011 Audit Criteria is `close` (narrower). [Worked Example §6]

> **Methodology** *(methodology pack)* — One of the three pack types. Represents *how* the engagement is conducted — e.g., GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, ISSAI. Contains workflow, finding schema, classification scheme, independence rules, CPE rules, report structure. Required as primary on every engagement. [Worked Example §2]

> **Pack Dependency** — A declared relationship between packs. Example: SINGLE_AUDIT:2024 `requires` GAGAS:2024 (the overlay cannot be used without the host methodology). Types: `incorporates`, `overlays`, `extends`, `requires`, `references`. [Worked Example §1]

> **Pack Scope** — On a StandardPackRef, a discriminator indicating whether the reference is to a shipped global pack (`global`) or a tenant-customized pack (`tenant:<id>`). Field reserved for future tenant-pack-override feature. [Worked Example §2]

> **Pack Type** — The three-tier taxonomy discriminator: `methodology`, `control_framework`, `regulatory_overlay`. Required on every StandardPack. Drives per-packType validation rules. [Worked Example §2]

> **Pack Version** — A pack's version identifier (e.g., "2024"). Combined with Pack Code (e.g., "GAGAS") produces the unique pack identifier "GAGAS:2024". [Worked Example §2]

> **Points of Focus** — On a Control Definition, the sub-criteria or considerations an auditor should address when testing the control. SOC 2 CC1.1 has four Points of Focus; CC6.1 has five. [Worked Example §12]

> **Primary Methodology** — The single methodology pack that drives an engagement's default workflow, finding schema, and report structure. Exactly one per engagement. [Worked Example §2]

> **Recommendation Presentation** — On a Report Definition, how recommendations render in the report: `inline` (IIA 5-C style), `separate` (GAGAS consolidated schedule), `both`, or `suppressed` (PCAOB/SOX). [Worked Example §9]

> **Regulatory Overlay** *(regulatory_overlay pack)* — One of the three pack types. Adds deltas on top of a host methodology — additional finding elements, additional reports, additional rule overrides. Examples: Single Audit overlay, SOX §404 overlay, CSRD/ESRS overlay. [Worked Example §1, §9]

> **Semantic Element Code** — A canonical code representing a semantic concept in a finding. Shipped baseline: CRITERIA, CONDITION, CAUSE, EFFECT, RECOMMENDATION, EVIDENCE, NC_CLAUSE, QUESTIONED_COST, ASSERTION_AFFECTED, CAPABILITY_TARGET, CAPABILITY_CURRENT, CAPABILITY_GAP. Extensible — packs may declare new codes. [Worked Example §6]

> **Semantic Element Mapping** — Within a pack, the association between a pack's own element code and a canonical Semantic Element Code. Includes equivalence strength. [Worked Example §6]

> **Single** *(engagement mode)* — One methodology pack attached, no additional methodologies, no regulatory overlays. Simplest case. Example: state auditor's pure GAGAS performance audit. [Worked Example §14 — Sidebar C]

> **Integrated** *(engagement mode)* — PCAOB AS 2201 pattern — FS opinion + ICFR opinion in one engagement with dual opinions. [Worked Example §14 — Sidebar A]

> **Statutory Stacked** *(engagement mode)* — Standards stacked by statute. Single Audit is the canonical example: GAGAS + GAAS + Uniform Guidance all required. [Worked Example §2]

> **Combined** *(engagement mode)* — Multiple control frameworks audited in one engagement per IAF MD 11 integrated management system pattern. [Worked Example §14 — Sidebar B]

> **In Conjunction** *(engagement mode)* — GAGAS "in conjunction with" another methodology (typically IIA). Elective rather than required. GAGAS §2.14-2.15 permits.

> **soxSuppressRecommendation** — On a Finding, a boolean flag indicating recommendations should be suppressed from published reports. Set by PCAOB methodology packs for ICFR findings to preserve auditor independence (recommending + testing = self-review threat). Default `false`. [Worked Example §6, §14 — Sidebar A]

> **Standard Extensions** — On a Finding, a map of pack-specific additional fields keyed by StandardPackKey. Example: `standardExtensions["SINGLE_AUDIT:2024"] = { QUESTIONED_COSTS_KNOWN: 127400, ... }`. [Worked Example §6]

> **StandardPackKey** — The string form of a pack identifier, format `${packCode}:${packVersion}` (e.g., "GAGAS:2024"). Used internally in pack-to-pack references (crosswalks, dependencies) and as JSON-map keys in tenant data. [Worked Example §6]

> **StandardPackRef** — The object form of a pack reference. Carries packCode, packVersion, scope, and — when attached to an engagement — a conformanceClaimed flag. Used on tenant-data entities (Engagement, Finding, Report, Recommendation). [Worked Example §2]

> **Strictness Resolver** — AIMS v2 component that computes an EngagementStrictness from the set of attached packs. For each rule (retention, CPE, etc.), picks the stricter of the active packs' requirements. Recomputes on pack attach/detach. [Worked Example §3]

> **Trust Service Criteria** *(TSC)* — AICPA's five categories for SOC 2 engagements: Security (always required), Availability, Processing Integrity, Confidentiality, Privacy. Customers elect which TSCs their SOC 2 covers. Relevant to AIMS v2's SOC 2 pack. [Worked Example §12]

---

## 5. SaaS and operational terms

> **ArgoCD** — GitOps continuous delivery tool for Kubernetes. Watches a Git repo; syncs changes to the cluster. Used in AIMS v2 DevOps.

> **BAA** *(Business Associate Agreement)* — HIPAA-specific contract between a covered entity and a business associate (including AIMS v2 if storing PHI). Required before PHI transfers. Specific clauses per 45 CFR §164.504(e).

> **CUEC** *(Complementary User Entity Controls)* — On a SOC 2 report, controls the service organization expects the user organization (the customer) to maintain. Reliance on the SOC 2 requires the user to confirm they meet the CUECs. [Worked Example §12]

> **DPA** *(Data Processing Agreement)* — GDPR-specific contract (Article 28) governing data processor terms. AIMS v2 provides a template; customers typically execute.

> **GDPR** *(General Data Protection Regulation)* — EU data protection regulation. Governs processing of EU residents' personal data. AIMS v2 applies GDPR-grade handling to all customer data regardless of region.

> **JIT Access** *(Just-In-Time Access)* — Access-control pattern where elevated privileges are granted for a short, time-bounded window rather than held standing. AIMS v2 requires JIT for all production access.

> **KMS** *(Key Management Service)* — AWS service for managing encryption keys. Used for encryption-at-rest on all AIMS v2 customer data.

> **MFA** *(Multi-Factor Authentication)* — Authentication requiring two or more factors (something you know, have, or are). Required on all AIMS v2 production access. Preferred factor: WebAuthn hardware keys.

> **OIDC** *(OpenID Connect)* — Modern SSO protocol built on OAuth 2.0. Supported for customer SSO in AIMS v2.

> **RLS** *(Row-Level Security)* — PostgreSQL feature enforcing per-row access control. AIMS v2's primary tenant isolation mechanism — tenants cannot see each other's rows even if application code tried to query them.

> **RPO** *(Recovery Point Objective)* — The maximum tolerable data loss in a disaster. AIMS v2 target: 15 minutes (continuous PITR on the database plus cross-region replication on object storage).

> **RTO** *(Recovery Time Objective)* — The maximum tolerable service downtime in a disaster. AIMS v2 target: 1 hour (warm-standby secondary region, DNS failover).

> **SAML** *(Security Assertion Markup Language)* — Older SSO protocol, still widely used. Supported alongside OIDC.

> **SCIM** *(System for Cross-domain Identity Management)* — Protocol for automating user provisioning and de-provisioning across identity systems. Supported in AIMS v2 for customer identity-provider integration.

> **SLO** *(Service Level Objective)* — Internal reliability target. Example: 99.95% monthly availability for the API. Drives canary-deploy analysis templates — if the canary breaches the SLO, the rollout aborts.

> **SSO** *(Single Sign-On)* — Customer's identity system (Okta, Azure AD, Google Workspace, etc.) authenticates users into AIMS v2 without maintaining separate credentials. Required for enterprise tiers.

---

## 6. Research + Market Context

> **Optro** *(formerly AuditBoard)* — US commercial GRC/audit platform; rebranded from AuditBoard on March 9, 2026. Dominant in Fortune 500 SOX and commercial internal audit. Absent from government audit market. [Worked Example §1; Introduction §3]

> **OSCAL** *(Open Security Controls Assessment Language)* — NIST-published open format for control catalogs, control profiles, system security plans, assessment plans, and assessment results. Production adoption in ServiceNow CAM. AIMS v2 supports OSCAL interop for control_framework packs (not methodology packs — no OSCAL analog for methodology).

> **ServiceNow IRM** *(Integrated Risk Management)* — ServiceNow's GRC/audit platform. Strong on many-to-many control-to-authority mapping. Engagement entity doesn't carry a methodology-standard concept; authoritative sources attach transitively through controls.

> **StandardFusion** — Canadian GRC vendor acquired by Wolters Kluwer in January 2026 (~€32M). Brings 150+ compliance frameworks + cross-framework control mapping to WK's TeamMate+ platform. Control-framework focused; does not close the audit-methodology gap.

> **TeamMate+** — Wolters Kluwer's internal audit platform. 800+ government agency customers; dominant in US state/local audit, federal OIG, and ACUA. Template-driven methodology model rather than methodology-as-first-class-object. [Introduction §3]

---

## 7. Certifications and roles

> **CAE** — Chief Audit Executive. See §1.

> **CIA** *(Certified Internal Auditor)* — IIA's core professional certification. Requires bachelor's degree + 24 months internal audit experience + passing a three-part exam. Holders must maintain 40 CPE per year. The IIA discontinued CGAP, CFSA, CCSA, and QIAL by end of 2023; CIA and CRMA are the surviving IIA certifications.

> **CPA** *(Certified Public Accountant)* — US state-licensed accounting professional. Required for most US audit work. Licensed by individual state boards; CPE requirements vary by state (typically 40 hours/year).

> **CRMA** *(Certification in Risk Management Assurance)* — IIA certification focused on risk management; requires CIA as prerequisite.

> **CGFM** *(Certified Government Financial Manager)* — AGA (Association of Government Accountants) certification for government financial professionals. Not a CPA substitute but recognized in government audit contexts.

> **CISA** *(Certified Information Systems Auditor)* — ISACA certification for IT auditors.

> **EQR** *(Engagement Quality Reviewer)* — Per PCAOB AS 1220, the person who performs an independent review of an issuer audit engagement before report issuance. Similar roles exist under AICPA QM 1 and IIA GIAS (QAIP concurrent reviewer).

---

## 8. False-friend warnings

Terms that look the same but mean meaningfully different things across standards. Getting these wrong causes real confusion.

### "Observation" — three distinct meanings

- **GAGAS "Observation"** — a minor issue below finding threshold; typically reserved for management letter / management communication rather than the formal audit report. Not a formal finding.
- **IIA "Observation"** — the default term for an internal-audit finding. A formal recorded conclusion. Interchangeable with "Finding" in IIA parlance.
- **ISO 19011 "Observation"** — a specific finding classification (not a Nonconformity, not an OFI); represents a factual documented observation that doesn't rise to the level of an NC but is worth recording. Could evolve into an NC in a future surveillance audit if unaddressed.

**In AIMS v2** — the pack's `terminology.finding` field controls the rendered label. All three are stored structurally as `Finding` records; what changes is classification and display.

### "OFI" vs "Advisory" vs "Observation"

- **ISO 19011 OFI (Opportunity for Improvement)** — a distinct finding *type*, not a classification sub-level. ISO auditors may issue OFIs alongside or instead of NCs. OFIs are not corrective-action-required but auditees often respond to them for continuous-improvement reasons.
- **IIA "Advisory"** — a finding severity level in many internal audit functions' custom severity schemes. Non-binding suggestion. Structurally a Finding with Advisory severity.
- **ISO 19011 "Observation"** — see above.

Do not conflate. ISO OFIs carry more weight than IIA Advisories in certification contexts.

### "Deficiency" — tier-specific under SOX/PCAOB

Under PCAOB AS 2201, "Deficiency" is a specific tier — the lowest of three (Deficiency / Significant Deficiency / Material Weakness). Saying "it's a deficiency" without a qualifier implies the lowest tier.

Under GAGAS, "deficiency" is used more broadly; a "significant deficiency" is a formal GAGAS classification (§6.41-6.44).

Under IIA and ISO, "deficiency" is not a classification term at all; they use "finding," "nonconformity," or custom severity labels.

Worth being explicit: "SOX deficiency," "GAGAS significant deficiency," "ISO Major NC" — don't say "deficiency" without a standard-qualifier when multiple standards are in play.

### "Recommendation" vs "Corrective Action Request" vs "Management Observation"

- **GAGAS / IIA "Recommendation"** — auditor-issued suggested action to fix a finding.
- **ISO 19011 "Corrective Action Request"** — auditee-owned plan to fix a nonconformity. The auditor doesn't issue it; they request that one be prepared.
- **SOC 2 "Management Observation"** — a management-level note communicated separately from the formal SOC 2 report. Auditor-issued recommendations on SOC 2 attestation work are restricted by AICPA AT-C independence rules.

### "Audit" — at least four distinct uses

- **Financial audit** — opinion on financial statements (GAAS, AICPA AU-C).
- **Performance audit** — evaluation of program efficiency/effectiveness (GAGAS).
- **Attestation engagement** — opinion on subject matter other than FS (AICPA AT-C).
- **Compliance audit / Single Audit** — opinion on compliance with specific requirements (Uniform Guidance).

Plus ISO certification audits, internal audits, peer reviews, and SOX integrated audits. When someone says "audit" without qualifier, always ask which kind.

### "Independence" — different regimes

GAGAS §3.26-3.107, PCAOB Rule 3520, AICPA Independence Rules (ET §1.200), IIA Standard 1100, ISO 19011 §4 — all carry the word "independence" but with different specifics on cooling-off periods, non-audit services, affiliations, and documentation. Any multi-standard engagement needs the strictness resolver to compute the union.

---

## 9. Reserved / future terms

Terms we use or reserve for features that don't yet exist in the MVP.

- **Tenant Pack Override** — customer-authored override of a global pack. Schema-reserved via `scope: "tenant:<id>"`; implementation deferred.
- **Open Pack Registry** — future community-contributed pack marketplace. Schema is public-ready; infrastructure doesn't exist yet.
- **AIMS Academy / Certification** — training and certification program on AIMS v2 usage. Forward-looking; see the note in `06-design-decisions.md`.
- **CapabilityAssessment** — a COBIT-style maturity/capability assessment, modeled possibly as a separate entity distinct from Finding. Deferred until COBIT pack is written (Phase 3+).
- **SoxDeficiency** *(rejected)* — was considered as a separate entity from Finding; rejected in favor of `Finding.soxSuppressRecommendation` flag. See Decision log Q1 in `06-design-decisions.md`.

---

*Last reviewed: 2026-04-20.*
