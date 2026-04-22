# Standards Comparison Matrix

This matrix compares key features across all planned audit standards to inform the abstraction layer design.

**See also**: `multi-standard-design.md` for the decision that an engagement can attach multiple standards (primary methodology + additionals + control frameworks + regulatory overlays) and the three-tier pack taxonomy (methodology / control_framework / regulatory_overlay).

---

## Pack Taxonomy

Each standard slots into one of three pack types. The taxonomy drives which methodology-content fields (engagementTypes, workflows, findingElements, etc.) a pack must provide. See `data-model/standard-pack-schema.ts` + `VALIDATION.md` §5.

| Pack type | What it is | Examples |
|---|---|---|
| **methodology** | How to audit | GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, ISSAI |
| **control_framework** | What to audit against | SOC 2, ISO 27001, NIST 800-53, COBIT 2019, HIPAA, PCI DSS, CIS |
| **regulatory_overlay** | Requirements layered on top | Single Audit (2 CFR 200), SOX §404, CSRD/ESRS |

---

## Feature Comparison

| Feature | GAGAS | IIA GIAS 2024 | SOX/PCAOB | ISO 19011 | COBIT | ISSAI |
|---------|-------|----------|-----------|-----------|-------|-------|
| **Pack type** | methodology | methodology | methodology | methodology | control_framework | methodology |
| **Issuing Body** | GAO (US) | IIA (Global) | SEC/PCAOB (US) | ISO (Global) | ISACA (Global) | INTOSAI (Global) |
| **Primary Users** | Govt auditors | Internal auditors | External/Internal | Quality auditors | IT auditors | Supreme audit institutions |
| **Engagement Types** | Financial, Performance, Attestation | Assurance, Consulting | ICFR, SOC | Management system audit | IT process audit | Financial, Compliance, Performance |
| **Finding Elements** | 4 (Criteria, Condition, Cause, Effect) | 5 (+ Root Cause, Recommendation) | 3 (Deficiency, Impact, Severity) | 3 (Nonconformity, Evidence, Clause) | Capability gap model (not classical finding) | 4 (Same as GAGAS) |
| **Risk Ratings** | Critical→Informational | Critical→Advisory | MW/SD/Deficiency | Major/Minor NC | Capability L0-L5 | High/Medium/Low |
| **Independence** | §3.02-3.59 | Standard 1100 | Rule 3520 | §4 | — | ISSAI 10-30 |
| **QA/QC** | §5.01-5.46 | Standard 1300 (QAIP) | QC 1000 | §7 | — | ISSAI 40 |
| **Planning** | §7.05-7.10 (14 sections) | Standard 2200 | AS 2101 | §5.4 | — | ISSAI 2300 |
| **Fieldwork** | §6.33 (evidence) | Standard 2300 | AS 2201 (testing) | §6.4 | — | ISSAI 2500 |
| **Reporting** | §6.02 (10 sections) | Standard 2400 | AS 3101 | §6.6 | — | ISSAI 2700 |
| **CPE Requirements** | 80hrs/2yr, 24hrs govt | 40hrs/yr (CIA) | Firm-level | Auditor competence | CPE required | Varies by SAI |
| **Peer Review** | Required (external) | Required (QAIP) | PCAOB inspections | Surveillance audits | — | Peer review per ISSAI 5600 |

---

## Stacks With (Common Multi-Standard Combinations)

Which packs commonly attach to an engagement together as primary + additionals / overlays. Primary sources: GAO Yellow Book 2024 Ch. 2 ("in conjunction with"), IIA GIAS 2024 Std 15.1, PCAOB AS 2201 ¶.06, 2 CFR 200.514, IAF MD 11:2023.

| Pack | Commonly stacks with | Combination type | Notes |
|---|---|---|---|
| GAGAS | GAAS (AICPA AU-C) | incorporated | GAGAS incorporates AU-C by reference for financial audits |
| GAGAS | **Single Audit overlay** | statutory_stacked | Required by 2 CFR 200.514 for federal-fund recipients ≥ $1M |
| GAGAS | IIA GIAS | in_conjunction | Common in public-sector internal audit shops |
| GAGAS | PCAOB AS (elective) | in_conjunction | Allowed by GAGAS; rare in practice |
| IIA GIAS | GAGAS | in_conjunction | Reverse of above — IIA-primary with GAGAS applied |
| IIA GIAS | ISO 19011 (for MS audits) | combined | Some industrial internal-audit departments |
| PCAOB AS 2201 | GAAS | integrated | Integrated Audit — FS opinion + ICFR opinion in one engagement |
| PCAOB AS 2201 | COSO 2013 (control framework) | incorporated | Implicitly required framework for ICFR |
| PCAOB AS 2201 | COBIT 2019 (control framework) | elective | Common for ITGCs layer on top of COSO |
| ISO 19011 | ISO 27001 (control framework) | combined | Every ISMS cert audit |
| ISO 19011 | ISO 9001 / 14001 / 45001 (control frameworks) | combined | IAF MD 11 integrated management system audit |
| Single Audit | GAGAS + GAAS | statutory_stacked | Three-layer stack by statute |

---

## Abstraction Layer Requirements

Based on this matrix, the abstraction layer must support:

1. **Variable finding elements** (3-5 per standard, different labels)
2. **Different risk classification schemes** (5-level, 3-level, text-based)
3. **Standard-specific planning templates** (14 sections for GAGAS, fewer for others)
4. **Different QA/QC processes** (checklist-based, QAIP-based, inspection-based)
5. **Different report structures** (10-section GAGAS, opinion-based SOX, etc.)
6. **Optional modules** (CPE tracking needed for GAGAS/IIA, not ISO)
7. **Different terminology** (Finding vs Observation vs Nonconformity vs Deficiency)
8. **Different approval workflows** (5-step for GAGAS reports, 3-step for IIA)

---

## Standards Planned for Implementation

| Priority | Standard | Phase | Rationale |
|----------|----------|-------|-----------|
| 1 | GAGAS | Phase 3 | Already built in v1, proven domain knowledge |
| 2 | IIA GIAS 2024 | Phase 4 | Largest global user base for internal audit |
| 3 | SOX/PCAOB | Phase 4 | Highest revenue market segment |
| 4 | ISO 19011 | Future | Quality management audit — broad applicability |
| 5 | COBIT | Future | IT audit — growing market |
| 6 | ISSAI | Future | International government audit |
| 7 | ISO 27001 | Future | Information security audit |
| 8 | HIPAA | Future | Healthcare compliance |
| 9 | Basel/FFIEC | Future | Financial services |
| 10 | CSRD/ISSB | Future | ESG/Sustainability assurance |
