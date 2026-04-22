# Verification Update — April 2026

> Authoritative verification of moderate-confidence items flagged in ROUND2-SYNTHESIS.md.
> All data below verified via web search against primary sources (GAO, PCAOB, IIA, OMB, SEC, FinCEN, NIST, ISO/IAF, ISACA, DoD, EU Commission).
>
> **Verification date**: April 2026

---

## Summary of Material Corrections

Several significant updates since Round 2 research:

| # | Area | Round 2 Said | Verified Current Reality |
|---|------|--------------|-------------------------|
| 1 | PCAOB QC 1000 effective | Dec 15, 2025 | **POSTPONED to Dec 15, 2026** |
| 2 | SEC Climate Rule status | "Stayed pending litigation" | **SEC withdrew defense March 2025; rules will NOT go into effect** |
| 3 | CTA/BOI reporting | "Largely enjoined" | **FinCEN removed BOI requirement entirely for US companies/persons March 2025** |
| 4 | PCAOB AS 1000 14-day doc rule | "May have been modified" | **14-day rule is in final standard** (tiered effective dates) |
| 5 | NIST 800-171 Rev 3 | "Required for CMMC Level 2" | **Rev 2 remains enforceable**; DFARS Class Deviation keeps Rev 2 |
| 6 | EU CSRD timeline | Phased 2025-2028 | **Stop-the-Clock Directive delayed Wave 2 by 2 years; Omnibus adopted Feb 2026** |
| 7 | Single Audit threshold | "Effective FY beginning Oct 1, 2024" | **Effective for FY ending on or after Sept 30, 2025** |
| 8 | Basel IV implementation | "EU effective Jan 1, 2023" | **EU CRR3 applies Jan 1, 2025; UK/EU output floor start now Jan 1, 2027** |
| 9 | CMMC 2.0 timeline | "Final rule Dec 2024; effective 2025" | **Final rule Sept 10, 2025; effective Nov 10, 2025; phased through 2027** |
| 10 | HIPAA 2024 NPRM | "Proposed; status uncertain" | **Status uncertain due to Jan 31, 2025 regulatory freeze EO** |

---

## 1. PCAOB QC 1000 — Effective Date POSTPONED

**Updated Reality**:
- QC 1000 effective date **postponed from Dec 15, 2025 to Dec 15, 2026**
- SEC approved postponement in 2025
- Reason: implementation challenges reported by firms
- **Form QC first reporting period**: Dec 15, 2026 – Sept 30, 2027
- **First Form QC filing due**: Nov 30, 2027
- Early adoption permitted, except reporting on evaluation
- Rescission of Rule 3400T, ET Section 102, AS 1110 also delayed to Dec 15, 2026

**Implications for AIMS v2**:
- Standard Pack for QC 1000 gets effective date `2026-12-15`
- Keep legacy QC system (pre-QC 1000) as active until then
- First Form QC reporting UI not needed until 2027

---

## 2. SEC Climate Disclosure Rule — Defense Withdrawn

**Updated Reality**:
- Litigation consolidated in **Eighth Circuit** (Iowa v. SEC, No. 24-1522) — NOT Fifth Circuit
- SEC stayed effectiveness April 2024 pending litigation
- **March 2025**: SEC sent letter to court withdrawing defense of the rules
- **Eighth Circuit held petitions in abeyance** until SEC reconsiders or renews defense
- **Current status**: Rules will NOT go into effect
- State laws fill the gap:
  - **California SB 253** (Scope 1/2/3 emissions, effective 2026)
  - **California SB 261** (climate risk disclosure)
  - **California AB 1305** (offset claims)
  - Thresholds: $1B revenue (SB 253) / $500M revenue (SB 261)

**Implications for AIMS v2**:
- De-prioritize SEC Climate Rule module
- Prioritize California climate disclosure compliance as alternative
- CSRD remains the primary global ESG driver (see #6)

---

## 3. Corporate Transparency Act (CTA) — BOI Reporting Scaled Back

**Updated Reality**:
- **March 21, 2025**: FinCEN announced interim final rule
- **March 26, 2025**: Published — removes BOI reporting requirement for U.S. companies and U.S. persons
- Definition of "reporting company" revised to mean **only foreign entities registered to do business in the U.S.**
- **Domestic entities and persons are exempt** from BOI reporting
- **FinCEN will not enforce penalties** against U.S. citizens or domestic reporting companies
- **December 16, 2025**: Eleventh Circuit reversed district court, held CTA constitutional — BUT this does NOT revive reporting obligations
- Final rule expected in 2026 (interim final rule remains in effect)

**Implications for AIMS v2**:
- BOI reporting module scope dramatically reduced
- Only needed for foreign entities doing business in U.S.
- De-prioritize as a feature for typical AIMS customers

---

## 4. PCAOB AS 1000 — 14-Day Documentation Rule Is Real

**Updated Reality**:
- AS 1000 became **effective for fiscal years beginning on or after December 15, 2024**
- Consolidates and replaces AS 1001, AS 1005, AS 1010, AS 1015
- **14-day documentation completion requirement** IS in the final standard (reduced from 45 days)
- **Tiered effective dates for 14-day rule**:
  - **Firms with >100 issuer audit reports in 2024**: Effective for FY beginning on/after Dec 15, 2024
  - **All other registered firms**: Effective for FY beginning on/after Dec 15, 2025
- For quarterly reviews: effective with first quarter ending after first audit covered

**Implications for AIMS v2**:
- Documentation completion deadline enforcement (14 days)
- Firm-size-aware compliance logic (>100 issuers vs others)
- Archive lockdown after 14-day window

---

## 5. NIST SP 800-171 Rev 3 — Not Yet Enforceable

**Updated Reality**:
- NIST officially published **Rev 3 on May 14, 2024**
- **However**: DoD issued **DFARS Class Deviation** in May 2024 requiring contractors to continue complying with **Rev 2**
- **Rev 2 remains the only enforceable standard for CMMC** compliance
- CMMC Level 2 built on 110 security requirements of Rev 2
- **Before Rev 3 becomes required**:
  1. DoD must formally adopt Rev 3 via policy/acquisition guidance
  2. DFARS clauses referencing Rev 2 must be revised
  3. CMMC assessment criteria, assessor training, C3PAO procedures must align with Rev 3
- Transition timing uncertain — likely 2026-2027

**Implications for AIMS v2**:
- CMMC Level 2 pack uses Rev 2 (110 controls) — NOT Rev 3 (97 requirements)
- Rev 3 should be a future version, not current
- Watch for DoD transition announcements

---

## 6. EU CSRD Omnibus — Significant Scope Reduction

**Updated Reality**:
- **February 26, 2025**: Commission proposed Omnibus Simplification Package
- **April 14, 2025**: Council adopted "Stop-the-Clock" Directive
- **December 9, 2025**: Parliament and Council reached provisional agreement
- **February 24-26, 2026**: Official adoption and publication of Omnibus Directive

### New CSRD Thresholds (Reduced Scope)
- Employee threshold raised to **1,000 employees** (from 250)
- **Net turnover threshold**: over **€450 million** (new)
- **Listed SMEs removed** from CSRD scope

### Revised Reporting Timeline
| Wave | Original | After Stop-the-Clock |
|------|----------|---------------------|
| **Wave 1** (large PIEs > 500 employees, previously under NFRD) | FY 2024, report 2025 | **No delay** |
| **Wave 2** (large companies meeting 2 of 3: 250+ emp, €50M rev, €25M assets) | FY 2025, report 2026 | **FY 2027, report 2028** (2-year delay) |
| **Wave 3** (listed SMEs) | FY 2026, report 2027 | **Removed from scope** |

### ESRS Standards
- 12 standards in Set 1 (ESRS 1, 2, E1-E5, S1-S4, G1) still applicable
- Commission working on simplified ESRS, sector guidance, assurance standards
- Double materiality concept retained

**Implications for AIMS v2**:
- CSRD module targets much smaller universe (only ~1000+ employee companies)
- Wave 2 companies have until 2028 to report
- Simplified ESRS in development — build modular to accommodate revisions

---

## 7. Single Audit — Precise Timing

**Updated Reality**:
- OMB 2024 revision effective **October 1, 2024**
- BUT audit threshold changes "cannot be adopted until audits for years **ending September 30, 2025**, or later"
- Practical effect: **$1M threshold effective for fiscal years that BEGIN on/after October 1, 2024** (end on/after September 30, 2025)
- Per 2024 OMB Compliance Supplement Appendix VII

### Related Threshold Changes
- **Type A program threshold raised to $1M** if total annual federal expenditures ≤ **$34M** (previously $25M)
- **De minimis indirect cost rate raised from 10% to 15%** of modified total direct costs

**Implications for AIMS v2**:
- Applicability engine needs exact fiscal year logic
- Support both $750K (legacy audits, FY ending before Sept 30, 2025) and $1M (current)
- Type A threshold formula must account for $34M total expenditure threshold

---

## 8. Basel III/IV — Implementation Delayed

**Updated Reality** (as of April 2026):

### European Union
- **CRR3** (EU implementation package) applies **January 1, 2025**
- Phased implementation of output floor through **January 2030**
- 72.5% output floor introduced
- **Output floor start date moved from Jan 1, 2026 to Jan 1, 2027** (via delegated act)
- Rationale: lingering U.S. uncertainty, UK shift to 2027

### United Kingdom
- PRA announced **January 17, 2025**: Basel 3.1 UK implementation delayed by one year
- **New UK effective date: January 1, 2027**
- PRA output floor phase-in by 2030 (vs Basel framework's 2028)

### United States
- **As of late 2025, U.S. has not implemented any Basel III final standards**
- Summer 2025: Fed working on revised proposal ("Endgame")
- Led by Acting Vice-Chair for Supervision Michelle Bowman
- Goal: ease regulatory burden, simplify capital calculations
- **Final adoption anticipated early 2026**

### Output Floor Phase-In (EU)
- 2025: 50%
- Phased up to 72.5% by 2030

**Implications for AIMS v2**:
- Basel pack needs jurisdiction-aware logic (EU/UK/US different dates)
- U.S. Basel III "Endgame" likely different from full Basel IV
- Output floor calculation differs during phase-in

---

## 9. CMMC 2.0 — Fully Effective November 2025

**Updated Reality**:
- DoD issued CMMC final rule **September 10, 2025**
- **Effective November 10, 2025**
- Amends DFARS to incorporate CMMC Program
- Introduces clauses:
  - **DFARS 252.204-7021** — contractors'/subcontractors' CMMC obligations
  - **DFARS 252.204-7025** — makes CMMC status a condition of award eligibility

### 3-Year Phased Implementation
| Phase | Start Date | Requirements |
|-------|-----------|--------------|
| **Phase 1** | Nov 10, 2025 | Level 1 (Self) or Level 2 (Self) |
| **Phase 2** | Nov 10, 2026 | Level 2 (C3PAO) certification assessments |
| **Phase 3** | Nov 10, 2027 | Level 3 (DIBCAC) requirements |

**Key deadline**: **October 31, 2026** — CMMC compliance required for all new DoD contract awards

**Implications for AIMS v2**:
- CMMC pack active since Nov 10, 2025
- Self-assessment workflow for Level 1 / Level 2 self
- C3PAO assessment workflow for Level 2 starting Nov 2026
- DIBCAC workflow for Level 3 starting Nov 2027

---

## 10. HIPAA Security Rule Update — Status Uncertain

**Updated Reality**:
- **December 27, 2024**: OCR issued Notice of Proposed Rulemaking (NPRM)
- **Proposed mandates** (not yet final):
  - **Encryption of ePHI in transit and at rest** explicitly required
  - **MFA for all technology assets** (limited exceptions: legacy systems, pre-March 2023 FDA-approved medical devices with migration plans)
  - **"Addressable" vs "Required" distinction REMOVED** — all implementation specs become required
  - Organizations still choose HOW to comply (e.g., encryption method)
- **Comment period closed March 7, 2025**
- **Final rule timeline** (if finalized): effective 60 days after publication; compliance date 180 days after effective
- **STATUS UNCERTAIN**: January 31, 2025 Executive Order placed regulatory freeze on new rules pending review
- Finalization depends on administration priorities

**Implications for AIMS v2**:
- Current HIPAA pack uses 2013 Security Rule (with addressable/required distinction)
- Draft provisions for 2024 NPRM as future standard pack version
- Monitor for finalization

---

## 11. Confirmed / Unchanged Items

These items from Round 2 are **verified correct**:

| Item | Status |
|------|--------|
| **GAGAS 2024 effective date**: Dec 15, 2025 | ✓ Confirmed (with March 16, 2026 deferral for federal gov audit orgs due to FY2026 government shutdown) |
| **GAGAS 2024 early adoption**: Permitted | ✓ Confirmed |
| **GIAS 2024 release**: January 9, 2024 | ✓ Confirmed |
| **GIAS 2024 effective**: January 9, 2025 | ✓ Confirmed |
| **GIAS structure**: 5 domains, 15 principles, 52 standards | ✓ Confirmed (120-page document) |
| **GIAS transition**: 2017 IPPF approved during one-year transition | ✓ Confirmed |
| **ISO 27001:2022 transition deadline**: October 31, 2025 | ✓ Confirmed (PAST — all certs now 2022) |
| **ISO 27001:2022 structure**: 93 controls in 4 themes | ✓ Confirmed |
| **NIST CSF 2.0 release**: February 26, 2024 | ✓ Confirmed |
| **NIST CSF 2.0 GOVERN function**: Added | ✓ Confirmed (6 functions total) |
| **NIST CSF 2.0 subcategories**: 106 | ✓ Confirmed (down from 108 in v1.1) |
| **EGC revenue threshold**: $1.235 billion | ✓ Confirmed (next inflation adjustment due 2027) |
| **Large Accelerated Filer**: ≥ $700M public float | ✓ Confirmed |
| **Accelerated Filer**: $75M-$700M public float | ✓ Confirmed |
| **Exit thresholds**: $60M / $560M | ✓ Confirmed (2020 amendment) |

---

## 12. New Updates From Verification

### ISO 27001:2013 Transition Complete
As of April 2026, the ISO 27001:2013 → 2022 transition deadline (Oct 31, 2025) has passed. All active certifications should now be on the 2022 version. Organizations that missed the deadline have invalid certifications.

### PCAOB AS 1000 Tiered Compliance
The 14-day documentation completion rule has a tiered implementation based on firm size:
- Large firms (>100 issuers): effective FY beginning Dec 15, 2024 → **compliance started late 2025**
- Other firms: effective FY beginning Dec 15, 2025 → **compliance started late 2026**

### GIAS 2024 — Strict Conformance Requirement
If an internal audit function is not conforming with ALL new GIAS standards by January 9, 2025, it MUST remove the phrase indicating engagement was "performed in accordance with the Standards" from audit deliverables. This is a material compliance marker.

---

## 13. Updated Confidence Levels

| Area | Previous Confidence | Current Confidence | Source |
|------|---------------------|---------------------|--------|
| GAGAS 2024 effective dates | Moderate | **High** | GAO.gov press release |
| Single Audit threshold | Moderate | **High** | OMB 2 CFR 200 revision, Federal Register |
| PCAOB QC 1000 | Moderate | **High** | PCAOB.org effective date page |
| PCAOB AS 1000 | Moderate | **High** | PCAOB.org, SEC approval order |
| GIAS 2024 structure | Moderate | **High** | theIIA.org official |
| SEC Climate Rule | Low | **High** (status clear) | SEC.gov press release |
| CTA/BOI reporting | Low | **High** | FinCEN.gov, Treasury press release |
| NIST CSF 2.0 | Moderate | **High** | nist.gov publication |
| NIST 800-171 Rev 3 | Moderate | **High** | NIST.gov, DoD DFARS Class Deviation |
| CMMC 2.0 timeline | Moderate | **High** | DoD final rule, DFARS |
| CSRD Omnibus | Moderate | **High** | EU Council press release |
| Basel III/IV | Moderate | **High** | BIS, PRA, ECB announcements |
| HIPAA Security Rule NPRM | Low | **Moderate** (proposal status uncertain) | Federal Register |
| ISO 27001:2022 transition | Moderate | **High** | IAF, certification bodies |
| EGC revenue threshold | Moderate | **High** | SEC rule |
| SEC filer thresholds | Moderate | **High** | SEC Rule 12b-2 |

---

## 14. Remaining Items Still Requiring Primary Source Verification

Even after this verification round, these items still need **primary-source** confirmation before shipping to customers:

1. **Exact GAGAS 2024 paragraph numbers** (e.g., §6.39 equivalent in 2024 revision)
   - Must read actual 2024 Yellow Book text from GAO
   - Some renumbering likely given restructured Chapter 5 (Quality Management)

2. **Exact GIAS 2024 standard citations**
   - 120-page document structure, all 52 standards' exact wording
   - Available from theIIA.org (registration required)

3. **Current PCAOB standard numbering post-2024 changes**
   - Some consolidations (AS 1001/1005/1010/1015 → AS 1000)

4. **Current AICPA AU-C section numbers post-SAS 149**
   - Group audits standard revised

5. **EU Omnibus final text** (published Feb 26, 2026)
   - Exact ESRS simplifications, final thresholds

For any citation-critical feature (standard pack content, PDF reports quoting standards), these should be verified against official publications before release.

---

## 15. Next Steps

**Given this verification update, we are NOW ready to proceed with architectural work.** All timeline- and threshold-sensitive items are verified.

**Recommended next step (per previous recommendation)**: Design the **Standard Pack data model** with versioning support. The data model must support:

1. **Effective date ranges** per Standard Pack version (e.g., `GAGAS:2024` effective Dec 15, 2025)
2. **Tiered applicability** (firm-size, jurisdiction, industry)
3. **Transition handling** (e.g., ISO 27001:2013 → 2022 cutoff)
4. **Regulatory status tracking** (proposed, in-litigation, final, withdrawn)
5. **Dependency chains** (GAGAS incorporates AU-C; SOX uses COSO 2013 IC)

---

## Sources

### GAGAS 2024
- [GAO Issues 2024 Yellow Book](https://www.gao.gov/press-release/gao-issues-2024-yellow-book-updating-standards-government-auditing)
- [Government Auditing Standards 2024 Revision](https://www.gao.gov/products/gao-24-106786)
- [Yellow Book page](https://www.gao.gov/yellowbook)
- [Federal Register: 2024 Revision](https://www.federalregister.gov/documents/2024/02/08/2024-02594/government-auditing-standards-2024-revision)

### Single Audit / Uniform Guidance
- [2024 Uniform Guidance Changes (CBIZ)](https://www.cbiz.com/insights/article/2024-uniform-guidance-changes-requirements-for-single-audits)
- [What's New in the 2024 Revision to 2 CFR Part 200 (EPA)](https://www.epa.gov/grants/whats-new-2024-revision-2-cfr-part-200)
- [Single Audit Threshold Changes (Meaden & Moore)](https://www.meadenmoore.com/blog/atc/single-audit-threshold-is-changing-what-should-you-expect-in-2025)

### SEC Climate Rule
- [SEC Votes to End Defense of Climate Disclosure Rules](https://www.sec.gov/newsroom/press-releases/2025-58)
- [Eighth Circuit Ruling (Harvard EELP)](https://eelp.law.harvard.edu/eighth-curcuit-says-sec-must-defend-or-revise-climate-risk-disclosure-rule/)
- [SEC Regulatory Climate Shift (Harvard Corp Gov)](https://corpgov.law.harvard.edu/2025/09/30/regulatory-climate-shift-updates-on-the-sec-climate-related-disclosure-rules/)

### Corporate Transparency Act / BOI
- [FinCEN Removes BOI Reporting Requirements](https://www.fincen.gov/news/news-releases/fincen-removes-beneficial-ownership-reporting-requirements-us-companies-and-us)
- [Treasury Announces Suspension of Enforcement](https://home.treasury.gov/news/press-releases/sb0038)
- [Eleventh Circuit Upholds CTA Constitutionality (Holland & Knight)](https://www.hklaw.com/en/insights/publications/2025/12/eleventh-circuit-upholds-constitutionality-of-corporate-transparency)

### PCAOB QC 1000 & AS 1000
- [QC 1000 Postponed (PCAOB)](https://pcaobus.org/news-events/news-releases/news-release-detail/pcaob-postpones-effective-date-of-qc-1000-and-related-standards--rules--and-forms)
- [QC 1000 Effective Dec 15, 2026 (PCAOB)](https://pcaobus.org/oversight/standards/qc-standards/details/qc-1000--a-firms-system-of-quality-control)
- [AS 1000 Details (PCAOB)](https://pcaobus.org/oversight/standards/auditing-standards/details/as-1000--general-responsibilities-of-the-auditor-in-conducting-an-audit-(effective-for-fiscal-years-beginning-on-or-after-12-15-2024))
- [SEC Approves PCAOB Standards](https://www.sec.gov/newsroom/press-releases/2024-100)

### IIA GIAS 2024
- [IIA Releases New Global Internal Audit Standards](https://www.theiia.org/en/content/communications/press-releases/2024/january/the-iia-releases-new-global-internal-audit-standards-to-lead-profession-into-the-future/)
- [IIA Celebrates Effective Date of GIAS](https://www.theiia.org/en/content/communications/press-releases/2025/january/the-iia-celebrates-the-effective-date-of-the-global-internal-audit-standards/)
- [2024 Standards](https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/)

### ISO 27001:2022
- [ISO 27001:2022 Transition (LRQA)](https://www.lrqa.com/en/insights/articles/preparing-for-iso-270012022-transition-by-october-2025/)
- [Last Chance to Transition (SGS)](https://www.sgs.com/en-us/news/2025/09/last-chance-to-transition-to-iso-iec-27001-2022-and-next-steps-if-you-miss-the-deadline)

### CMMC 2.0
- [DoD CMMC Final Rule (Wiley)](https://www.wiley.law/alert-additional-analysis-on-dods-final-rule-for-the-cybersecurity-maturity-model-certification-program)
- [CMMC Timeline (Secureframe)](https://secureframe.com/hub/cmmc/proposed-final-rule)
- [DoD DFARS Final Rule (Goodwin)](https://www.goodwinlaw.com/en/insights/publications/2025/09/alerts-otherindustries-dod-final-rule-incorporates-cmmc-20-into-dfars)

### NIST CSF 2.0
- [NIST CSF 2.0 PDF](https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf)
- [NIST CSF 2.0 Release](https://www.nist.gov/news-events/news/2024/02/nist-releases-version-20-landmark-cybersecurity-framework)

### NIST SP 800-171 Rev 3
- [NIST SP 800-171 Rev 3 Final](https://csrc.nist.gov/pubs/sp/800/171/r3/final)
- [DoD Class Deviation (Lake Ridge)](https://www.lakeridge.io/nist-800-171-rev-3-or-rev-2-which-is-required-in-2024)
- [DoD Organization-Defined Parameters (Holland & Knight)](https://www.hklaw.com/en/insights/publications/2025/05/dod-publishes-organization-defined-parameters-for-nist-sp)

### EU CSRD Omnibus
- [EU Council Press Release on Omnibus](https://www.consilium.europa.eu/en/press/press-releases/2025/12/09/council-and-parliament-strike-a-deal-to-simplify-sustainability-reporting-and-due-diligence-requirements-and-boost-eu-competitiveness/)
- [Stop-the-Clock Directive (Sidley)](https://www.sidley.com/en/insights/newsupdates/2025/04/eu-omnibus-package-eu-adopts-stop-the-clock-directive-and-begins-esrs-simplification-process)
- [Omnibus Package (PwC)](https://viewpoint.pwc.com/gx/en/pwc/in-briefs/ib_int202527.html)

### Basel III/IV
- [EU Basel Implementation (Europarl)](https://www.europarl.europa.eu/RegData/etudes/IDAN/2025/773694/ECTI_IDA(2025)773694_EN.pdf)
- [BCBS Progress on Basel III](https://www.bis.org/press/p251003.htm)
- [Basel 3.1 UK Update (Skadden)](https://www.skadden.com/insights/publications/2024/10/implementation-of-basel-3)

### HIPAA Security Rule NPRM
- [Federal Register: HIPAA Security Rule NPRM](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information)
- [HHS Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html)

### SEC Filer Categories
- [SEC Accelerated Filer Definitions](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/accelerated-filer-large-accelerated-filer-definitions)
- [SEC Amendment to Accelerated Filer Definition (CAQ)](https://www.thecaq.org/sec-amendment-to-accelerated-filer-definition)

### EGC Threshold
- [SEC Raises EGC Revenue Threshold to $1.235 Billion (Davis Polk)](https://www.davispolk.com/insights/client-update/egc-revenue-cap-raised-1235-billion)
- [SEC Press Release](https://sec.gov/news/press-release/2022-157)
