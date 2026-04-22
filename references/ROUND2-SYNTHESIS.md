# Round 2 Research Synthesis — Key Corrections, Insights & Implications

> After two rounds of deep research across all major audit standards, this document synthesizes the key corrections, new discoveries, and architectural implications for AIMS v2.

---

## 1. Critical Corrections from Round 2

### Correction #1: IIA IPPF Structure Completely Changed
**Round 1 assumption**: 2017 IPPF with Attribute Standards 1000-1322 + Performance Standards 2000-2600

**Round 2 reality**: IIA released **Global Internal Audit Standards (GIAS)** on January 9, 2024, **effective January 9, 2025**. Completely different structure:
- **5 Domains**
- **15 Principles**
- **52 Standards**
- Standard numbering: `Domain.Principle.Sequence` (e.g., Standard 9.1, 13.3)
- Each standard has 4 required elements: Requirements, Considerations for Implementation, Examples of Evidence of Conformance, Topical Requirements

**Implication**: Any "IIA IPPF" branding in our platform must reference **GIAS 2024**, not the old 2017 IPPF.

### Correction #2: Major IIA Certifications Discontinued
**Round 1 listed**: CIA, CRMA, CGAP, CFSA, CCSA, QIAL

**Round 2 reality**: As of December 31, 2023:
- **CGAP (Certified Government Auditing Professional)** — DISCONTINUED
- **CFSA (Certified Financial Services Auditor)** — DISCONTINUED
- **CCSA (Certification in Control Self-Assessment)** — DISCONTINUED
- **QIAL (Qualification in Internal Audit Leadership)** — DISCONTINUED (2021)
- Active: CIA, CRMA, Internal Audit Practitioner, CIA Challenge Exam

### Correction #3: Implementation Standards Numbering
**Round 1 assumption**: Implementation Standards numbered 3000-3999

**Round 2 reality**: The 2017 IPPF used **`.A1/.A2` suffixes for Assurance** and **`.C1/.C2` suffixes for Consulting** appended to 2000-series (e.g., 2130.A1, 2201.A1). No separate 3000-series existed. Under GIAS 2024, this is restructured into each standard's Requirements subsection.

### Correction #4: ISO 27001 Structure Fundamentally Changed (2022)
**Round 1 assumption**: ISO 27001 with 114 controls in 14 Annex A domains

**Round 2 reality**: ISO/IEC 27001:**2022** released October 25, 2022 (transition deadline October 31, 2025):
- **93 controls** (consolidated from 114)
- **4 themes** instead of 14 domains:
  - A.5 Organizational controls (37)
  - A.6 People controls (8)
  - A.7 Physical controls (14)
  - A.8 Technological controls (34)
- **11 entirely NEW controls** including: Threat intelligence, Cloud services, ICT readiness for BC, Physical security monitoring, Configuration management, Information deletion, Data masking, DLP, Monitoring activities, Web filtering, Secure coding

### Correction #5: NIST CSF Added "GOVERN" Function (2.0, February 2024)
**Round 1 assumption**: NIST CSF has 5 Functions (Identify/Protect/Detect/Respond/Recover)

**Round 2 reality**: NIST CSF 2.0 (February 2024) has **6 Functions** — added **GOVERN (GV)** as first function. Now 22 Categories, 106 Subcategories.

### Correction #6: Single Audit Threshold Raised
**Round 1 assumption**: Single Audit threshold $750,000

**Round 2 reality**: **Raised to $1,000,000** effective for fiscal years beginning on/after October 1, 2024, per OMB April 2024 revision.

### Correction #7: 2024 Yellow Book Revision — Quality Management (not Quality Control)
**Round 1 assumption**: GAGAS Quality Control (QC)

**Round 2 reality**: 2024 Yellow Book (effective December 15, 2025) restructures Chapter 5 from Quality Control to **Quality Management** aligned with AICPA SQMS 1 and 2. **8 components of QMS** (governance, ethics, acceptance, engagement performance, resources, information/communication, monitoring, risk assessment).

### Correction #8: New PCAOB Standards
**Round 1 didn't mention**:
- **QC 1000** adopted May 2024, SEC approved September 2024, effective December 15, 2025
- **AS 1000** adopted May 2024, effective December 15, 2024 (consolidated AS 1001/1005/1010/1015)
- **AS 1105** amended 2024 for technology-assisted analysis (ADAs)
- **AS 2405** amended 2023 for electronic confirmations (effective June 15, 2025)

### Correction #9: CMMC 2.0 Final Rule
**Round 1 didn't mention**: CMMC 2.0 final rule published December 2024, effective 2025. 3 levels (down from 5): Foundational (17 practices), Advanced (110 = NIST 800-171), Expert (110 + 800-172 subset).

### Correction #10: GAGAS Finding Structure vs Single Audit Finding Structure
**Round 1 assumption**: GAGAS has 4 elements; Single Audit same

**Round 2 reality**: Single Audit findings (2 CFR 200.516(b)) require additional elements beyond GAGAS 4:
- Federal program and ALN/CFDA
- 4 elements (Criteria/Condition/Cause/Effect)
- **Identification of questioned costs (known + likely)**
- Statistical sample info if applicable
- **Repeat finding indicator**
- Recommendations
- Views of responsible officials (when disagree)

---

## 2. Major Round 2 Discoveries Not Covered in Round 1

### Discovery #1: Critical Audit Matters (CAMs)
PCAOB AS 3101 requires CAMs in auditor reports. 3-part test: (1) communicated to audit committee, (2) material, (3) involved especially challenging judgment. **Exempt**: EGCs, brokers/dealers, investment companies, employee benefit plans. Effective for large accelerated filers 2019, others 2020.

### Discovery #2: Three Lines Model Update (IIA 2020)
IIA replaced "Three Lines of Defense" (2013) with **Three Lines Model** (July 2020). Philosophical shift from defense to value creation. Six principles. New articulation of Board, Management (1st/2nd line), Internal Audit (3rd line), and external assurance providers.

### Discovery #3: COBIT 2019 Design Factors
Not previously covered — the 11 design factors used to tailor COBIT for an organization. Each factor produces inputs to governance system design. Includes Enterprise Strategy, Enterprise Goals, Risk Profile, IT Issues, Threat Landscape, Compliance Requirements, Role of IT, Sourcing Model, Implementation Methods, Tech Adoption Strategy, Enterprise Size.

### Discovery #4: Annex SL / Harmonized Structure
All modern ISO management system standards (9001/14001/27001/45001/22301/37001/37301/50001) share common 10-clause Harmonized Structure. Only Clause 8 differs substantively between standards. **Enables integrated audits** with up to 20% time reduction per IAF MD 11.

### Discovery #5: COSO ERM 2017 vs COSO 2013 IC
Two different COSO frameworks:
- **COSO 2013 IC**: 5 components, 17 principles — for ICFR (SOX 404)
- **COSO ERM 2017**: 5 components, **20 principles** — for enterprise risk management
- Both used simultaneously in mature organizations

### Discovery #6: IAF MD 4 Remote Auditing
Post-COVID formalization of Information and Communication Technology use in audits. Risk assessment required before ICT use. Restrictions on initial certification Stage 2, safety-critical activities, Annex SL Clause 8 operations.

### Discovery #7: HIPAA 2024 Proposed Security Rule Update
HHS NPRM December 2024 removes "addressable" distinction, adds mandatory encryption, MFA, vulnerability scans every 6 months, annual penetration testing, compliance audits of BAs, asset inventory requirement.

### Discovery #8: ESRS — 12 Sustainability Reporting Standards
CSRD implements via 12 ESRS standards (ESRS 1 General Requirements, ESRS 2 General Disclosures, E1-E5 Environmental, S1-S4 Social, G1 Governance). **Double materiality** concept. EU Omnibus Proposal (Feb 2025) may reduce scope.

### Discovery #9: CIS Controls v8 Implementation Groups
- IG1 (56 safeguards): SME basic
- IG2 (130 safeguards): moderate IT
- IG3 (153 safeguards): mature organizations
18 controls mapped to NIST CSF, ISO 27001, PCI DSS, HIPAA.

### Discovery #10: NIST SP 800-171 Rev. 3 (May 2024)
97 security requirements (reduced from 110), aligned with 800-53 Rev 5. Required for CMMC Level 2.

---

## 3. Architectural Implications for AIMS v2

### Implication #1: Standard Pack Versioning is Critical
Standards evolve rapidly — GAGAS 2024, GIAS 2024, NIST CSF 2.0, ISO 27001:2022, COSO ERM 2017, CMMC 2.0, CSRD/ESRS 2024, HIPAA 2024 update pending.

**Required feature**: Standard Packs must be **versioned** (e.g., `GAGAS:2024`, `IIA_GIAS:2024`, `NIST_CSF:2.0`, `ISO_27001:2022`). Old versions must remain available for engagements still applying them. Transition periods (e.g., ISO 27001:2022 effective until Oct 2025) must be supported.

### Implication #2: Sub-Framework Relationships Matter
Many standards incorporate other standards by reference:
- GAGAS incorporates AICPA AU-C
- SOX builds on COSO 2013 IC (and sometimes COSO ERM 2017)
- ISO 27001 audits use ISO 19011 methodology
- CMMC 2.0 uses NIST 800-171
- COBIT maps to NIST CSF, ITIL 4, ISO 27001, SOX ITGC
- ISSAI 2XXX series mirrors IAASB ISAs

**Required feature**: **Framework relationship graph** — when an engagement selects GAGAS, the engine knows AU-C applies too. When ISO 27001 is selected, ISO 19011 methodology applies.

### Implication #3: Finding Elements Vary More Than Thought

| Standard | Finding Elements |
|----------|------------------|
| GAGAS (4) | Criteria, Condition, Cause, Effect |
| Single Audit (7+) | All of GAGAS 4 + Questioned Costs + Sample Info + Repeat Indicator + Federal Program/ALN |
| IIA GIAS 2024 (5) | Criteria, Condition, Cause, Consequence/Effect, Recommendation |
| IIA (prior) | Same as GIAS 2024 |
| SOX/PCAOB (3-6) | Control Description, Deficiency, Severity (MW/SD/D), Impact, Compensating, Remediation |
| ISO 19011 (3) | Audit Criteria, Nonconformity Evidence, Root Cause |
| COBIT (4) | Process, Control Gap, Root Cause, Impact |

**Required feature**: Dynamic finding form with superset of all possible elements; configured per engagement's primary standard.

### Implication #4: Multiple Assurance Types
Different standards use different assurance frameworks:
- **Financial audit**: Reasonable assurance (GAGAS/ISA)
- **Attestation**: Examination (reasonable), Review (limited), AUP (no assurance) — GAGAS/AICPA
- **ICFR audit**: Opinion on effectiveness — SOX
- **Performance audit**: Reasonable assurance tied to objectives (not materiality)
- **ISO 19011**: Conformity assessment (not assurance in same sense)
- **ESG/Sustainability**: Limited OR reasonable (ISAE 3000/3410)

**Required feature**: Assurance level configuration per engagement type; report format adapts.

### Implication #5: Multi-Tier Engagement Hierarchy
For Single Audit and similar:
- One engagement → multiple reports (FS opinion, Yellow Book report, Single Audit report)
- Group audits with multiple component auditors
- Integrated management system audits (9001 + 14001 + 27001 in single engagement)

**Required feature**: Engagement can have multiple sub-reports; component auditor tracking; integrated audit support.

### Implication #6: Workflow Complexity Scales with Standard
- ISO 19011 surveillance: relatively simple
- SOX integrated audit: complex with 5-stage approval + concurring partner
- Single Audit: multiple report types, repeat findings, CAP tracking, 30-day FAC submission
- GIAS 2024 QAIP: internal + external assessment (every 5 years)

**Required feature**: Workflow engine flexible enough to support 2-step to 8-step workflows per engagement type.

### Implication #7: Sector-Specific Add-Ons Are Critical
Beyond GAGAS/IIA/SOX/ISO/COBIT, vertical-specific packs needed:
- **Healthcare**: HIPAA + HITECH + HITRUST + CMS audits (RAC/MAC/CERT)
- **Banking**: Basel III/IV + FFIEC IT Examination Handbook (11 booklets) + BSA/AML
- **Gov India**: CAG framework + DPC Act + PAC/COPU reporting
- **ESG**: CSRD + ESRS (12 standards) + ISSB (S1/S2) + GRI + TCFD + SASB
- **Defense contractors**: CMMC 2.0 + NIST 800-171 + DFARS

**Required feature**: Sector packs as extensions to base standards. Healthcare AIMS can use GAGAS/IIA + HIPAA overlay.

### Implication #8: Competence & CPE Tracking is Multi-Framework
| Certification | Hours | Cycle | Scheme |
|---------------|-------|-------|--------|
| GAGAS auditor | 80 hrs / 2 yrs (24 govt + 20/yr min) | Rolling 2-year | GAO |
| CIA | 40 hrs / yr | Annual | IIA |
| CISA | 40 hrs / yr (120/3yr) | 3-year | ISACA |
| CPA | Varies by state (typically 40/yr) | Annual | State boards |
| ISO 19011 Lead Auditor | 40-80 hrs / 3 yrs | 3-year | IRCA/Exemplar |

A single auditor may hold multiple certifications simultaneously. **Required feature**: Multi-certification CPE tracker that validates against ALL applicable requirements simultaneously.

### Implication #9: Quality Assurance Approaches Differ Fundamentally
| Standard | QA Type | Cycle |
|----------|---------|-------|
| GAGAS | Peer review (external) | Every 3 years |
| IIA GIAS 2024 | QAIP (internal + external) | External every 5 years |
| SOX/PCAOB | PCAOB Inspections | Annual (>100 issuers) / Triennial |
| ISO 19011 | Surveillance audits | Annual |
| Management systems | Transition audits | When standard updates |

**Required feature**: QA module supporting all four approaches; single tenant may need multiple simultaneously.

### Implication #10: Regulatory Recency Matters
Several major changes in 2024:
- GAGAS 2024 (Feb 2024)
- GIAS 2024 (Jan 2024)
- PCAOB QC 1000 (May 2024)
- PCAOB AS 1000 (May 2024)
- NIST CSF 2.0 (Feb 2024)
- CMMC 2.0 final rule (Dec 2024)
- Single Audit threshold raise (Oct 2024)
- CSRD reporting begins (Jan 2025)
- ISO 27001:2022 transition deadline (Oct 2025)

**Required feature**: Regulatory update feed; version transition management for each standard pack.

---

## 4. Enhanced Business Requirements for Abstraction Layer

Based on round 2, the Standards Abstraction Layer must support:

### New Requirement: Framework Dependencies
```typescript
interface StandardPack {
  // ... existing fields
  dependencies?: StandardDependency[];  // "When this standard applies, these others apply too"
}

interface StandardDependency {
  standardCode: string;           // "AICPA_AU_C"
  scope: 'all' | 'financial_audits' | 'attestation';
  relationship: 'incorporates' | 'overlaid_by' | 'references';
}
```

Example: GAGAS has dependency on AICPA AU-C for financial audits.

### New Requirement: Standard Transition Support
```typescript
interface StandardPack {
  // ... existing
  effectiveDate: Date;
  supersededDate?: Date;
  previousVersion?: string;       // "IIA_IPPF:2017"
  transitionDeadline?: Date;      // When old version must no longer be used
  earlyAdoptionAllowed?: boolean;
}
```

### New Requirement: Multi-Report Engagements
```typescript
interface Engagement {
  // ... existing
  reports: Report[];              // One engagement can produce multiple reports
  primaryStandard: string;
  additionalStandards: string[];  // For multi-standard engagements
}

interface Report {
  type: 'opinion' | 'yellow_book' | 'single_audit' | 'iso_certification' | 'iso_surveillance';
  standardCode: string;
  content: ReportContent;
}
```

### New Requirement: Component/Group Audit Tracking
```typescript
interface GroupAudit {
  groupEngagementId: string;
  components: ComponentAudit[];
  significantComponents: string[];
  groupAuditorFirm: string;
}

interface ComponentAudit {
  componentName: string;
  componentAuditorFirm: string;
  relianceType: 'assume_responsibility' | 'refer_to_other_auditor';
  significance: 'significant' | 'non_significant';
  materialityCoverage: number;
  peerReviewStatus: string;
}
```

### New Requirement: Multi-Certification CPE Tracking
```typescript
interface User {
  // ... existing
  certifications: Certification[];
}

interface Certification {
  type: 'CIA' | 'CPA' | 'CISA' | 'GAGAS_AUDITOR' | 'ISO_LEAD_AUDITOR' | ...;
  issueDate: Date;
  expiryDate?: Date;
  cpeRequirement: CPERequirement;
}

interface CPERequirement {
  hoursRequired: number;
  cycleType: 'annual' | 'biennial' | 'triennial';
  specificTopics?: CPETopicRequirement[]; // e.g., "24 govt hours for GAGAS"
}
```

---

## 5. Recommended Standard Pack Priority — Revised

Based on round 2 analysis of market size, complexity, and momentum:

| Priority | Standard Pack | Rationale |
|----------|---------------|-----------|
| **1** | GAGAS 2024 + Single Audit | Current AIMS foundation; Single Audit layer huge value-add |
| **2** | IIA GIAS 2024 | Largest global internal audit user base; fresh 2024 release means market seeking tools |
| **3** | ISO 19011 + ISO 9001:2015 | Broadest applicability (any management system); entry point for ISO 27001/14001/45001 |
| **4** | SOX/PCAOB + COSO 2013 + CAMs | Highest revenue SaaS tier; well-defined requirements |
| **5** | ISO 27001:2022 + ISO 19011 | Massive demand (cybersecurity); new 93-control structure not yet supported by many tools |
| **6** | NIST CSF 2.0 + NIST 800-53 Rev 5 | US federal contractors; complements CMMC for defense |
| **7** | COBIT 2019 + ITIL 4 | IT audit specialists; CISA alignment |
| **8** | CMMC 2.0 + NIST 800-171 Rev 3 | DoD contractors; new rule creates immediate demand |
| **9** | CSRD + ESRS + ISSB S1/S2 | Emerging EU/global ESG assurance market |
| **10** | BSA/AML + OFAC + FFIEC | Banking vertical |
| **11** | HIPAA + HITECH + HITRUST | Healthcare vertical |
| **12** | ISSAI + INTOSAI-P + CAG (regional) | International government audit |
| **13** | COSO ERM 2017 | ERM overlay for mature organizations |

---

## 6. Updated Research Files

Complete reference library now includes:

```
aims-v2-platform/references/
├── ROUND2-SYNTHESIS.md                        ← THIS FILE (key corrections & implications)
├── standards-matrix.md
├── competitor-analysis.md
├── data-model.md
├── standards/
│   ├── 01-gagas-deep-dive.md                  ← Round 1 (basics)
│   ├── 01-gagas-supplement.md                 ← Round 2 (Single Audit, fraud, 2024 revision, etc.)
│   ├── 02-iia-ippf-deep-dive.md               ← REWRITTEN with GIAS 2024 structure
│   ├── 03-sox-pcaob-deep-dive.md              ← Round 1
│   ├── 03-sox-pcaob-supplement.md             ← Round 2 (QC 1000, AS 1000, CAMs, COSO ERM)
│   ├── 04-iso-19011-deep-dive.md              ← Round 1
│   ├── 04-iso-19011-supplement.md             ← Round 2 (Annex SL, ISO 27001:2022, IAF MDs)
│   ├── 05-cobit-deep-dive.md                  ← Round 1
│   ├── 05-cobit-supplement.md                 ← Round 2 (11 Design Factors, NIST CSF 2.0, CMMC 2.0)
│   ├── 06-issai-deep-dive.md                  ← Round 1
│   └── 07-regional-industry-packs.md          ← Round 1
│   └── 07-regional-supplement.md              ← Round 2 (IFPP, Basel IV, HIPAA detail, ESRS, AML)
├── crosswalks/
│   ├── terminology-crosswalk.md
│   └── requirements-crosswalk.md
└── abstraction-layer/
    └── business-requirements.md
```

---

## 7. Confidence & Limitations

### High Confidence (well-documented in training data)
- GIAS 2024 structure (5 Domains, 15 Principles, 52 Standards)
- NIST CSF 2.0 (GOVERN function, 6 functions, 22 categories)
- ISO 27001:2022 structure (93 controls, 4 themes, 11 new controls)
- COSO ERM 2017 (5 components, 20 principles)
- Single Audit mechanics (major program determination, 12 compliance areas)
- Three Lines Model update (2020)

### Moderate Confidence (knowledge cutoff caveat)
- Exact paragraph numbering in 2024 revisions may have shifted
- PCAOB QC 1000 some specifics (EQCF for 100+ issuers survived SEC approval)
- PCAOB AS 1000 14-day documentation completion deadline (may have been modified)
- EU Omnibus proposal status for CSRD scope reduction
- SEC Climate Rule final disposition (stayed, may not return in current form)
- CTA/BOI reporting enforcement status (court challenges ongoing)

### Lower Confidence (rapidly evolving)
- Exact dollar thresholds (SEC filer categories, SRC, EGC)
- NIST 800-171 Rev 3 adoption timing for federal civilian contracts
- CMMC 2.0 phase-in schedule for specific contract types
- ESRS sector-specific standards (still in development)
- HIPAA 2024 Security Rule final provisions

### Requires Verification for Production Use
Any production implementation must verify:
- Current standard versions and effective dates
- Exact paragraph/clause numbers
- Regulatory status (enforced, stayed, proposed)
- Transition deadlines

---

## 8. Next Steps

1. **Update abstraction layer business requirements** with round 2 findings
2. **Update IIA-related phase plans** (Phase 4.1) to reference GIAS 2024 structure
3. **Add new phase items** for: Single Audit module, CAM support, ISO 27001:2022 migration tools, Three Lines Model, CSRD/ESRS module
4. **Update standards priority matrix** based on revised analysis
5. **Plan for standard versioning** in data model from Phase 1.2
6. **Consider sector packs as Phase 4.6 or Phase 5+ items** rather than deferring to Phase 7

---

## 9. Multi-Standard Engagement Refinement (added 2026-04-20)

Post-Tier-1, a separate research round investigated whether one engagement can claim compliance with multiple standards simultaneously, triggered by the architectural question: "does the current schema's implicit single-standard-per-engagement assumption hold?"

**Finding**: multi-standard engagements are common and, in several cases (Single Audit, Integrated Audit, ISO IMS), statutorily required or mandated by the standards themselves. The implicit single-standard assumption is wrong and must be replaced.

**Decision**: engagement attaches to `primaryMethodology + additionalMethodologies[] + controlFrameworks[] + regulatoryOverlays[]`. Three-tier pack taxonomy added (`methodology` / `control_framework` / `regulatory_overlay`). Finding uses semantic core + per-pack extensions + per-pack classifications. Recommendations are a separate entity with M:N to findings. Reports attest to specific packs (multi-report per engagement).

**Schema updates shipped** (2026-04-20):
- `data-model/standard-pack-schema.ts` — schemaVersion 1.0.0 → 1.1.0; added `packType`, `semanticElementMappings`, `SemanticElementCode`, `SemanticElementMapping`, `ControlDefinition`, `ControlCategory`, `OverlayRuleOverrides`; split `StandardPackRef` (object form) from `StandardPackKey` (string form); methodology-specific fields made optional with per-packType validation
- `data-model/tenant-data-model.ts` — new file defining runtime `Engagement`, `Finding`, `Recommendation`, `Report`, `EngagementStrictness` types
- `data-model/examples/gagas-2024.ts` — added `packType: 'methodology'` + 4 semantic mappings; Single Audit content extracted out
- `data-model/examples/iia-gias-2024.ts` — added `packType: 'methodology'` + 5 semantic mappings including Recommendation
- `data-model/examples/iso-19011-2018.ts` — added `packType: 'methodology'` + 4 semantic mappings (no EFFECT equivalent; NC_CLAUSE as ISO-specific slot)
- `data-model/examples/single-audit-overlay-2024.ts` — **new** overlay pack with `packType: 'regulatory_overlay'`, depends on GAGAS:2024; contains questioned-costs / ALN / compliance-requirement / repeat-finding elements + SEFA / Schedule of Findings and Questioned Costs / Summary Schedule of Prior Audit Findings / Corrective Action Plan reports
- `data-model/VALIDATION.md` — new Layer 4.5 (semantic mapping integrity) + Layer 5 (multi-standard engagement validation, 7 rules)

**Key design insights validated via competitor research** (AuditBoard/Optro, ServiceNow IRM, TeamMate+):
- No competitor treats audit methodology as a first-class versioned object
- All three conflate "methodology" with "control framework" or omit methodology entirely
- TeamMate+ (government audit dominant) uses template-per-engagement; Wolters Kluwer StandardFusion acquisition (Jan 2026) added control-framework mapping but not methodology-as-object
- Genuine competitive whitespace: engagement-level multi-standard + GAGAS/Single Audit/ISSAI first-class

**Primary-source citations**:
- GAO Yellow Book 2024 Ch. 2 ("in conjunction with other professional standards")
- IIA GIAS 2024 Standard 15.1 (conformance claim mechanics)
- 2 CFR 200.514-.516 (Single Audit statutorily multi-standard)
- PCAOB AS 2201 ¶.06 (Integrated Audit mandate)
- IAF MD 11:2023 (integrated management system audit)

**Full design**: `references/multi-standard-design.md` (Accepted 2026-04-20)
