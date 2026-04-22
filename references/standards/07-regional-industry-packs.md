# Regional & Industry Audit Standards — Deep Dive Study

---

## 1. CAG — Comptroller and Auditor General of India

| Attribute | Detail |
|-----------|--------|
| **Authority** | Constitutional body — Articles 148-151 of Indian Constitution |
| **Mandate** | Audit ALL central and state government accounts |
| **Head** | CAG appointed by President; 6-year term or age 65 |
| **Reporting** | Direct to Parliament/State Legislatures (not executive) |
| **History** | Established 1860; oldest SAI in Commonwealth |
| **Relationship** | Based on ISSAI framework, tailored to Indian governance |

### Types of CAG Audits
1. **Financial Audit**: Regularity audits (transaction verification), propriety audits (value-for-money)
2. **Compliance Audit**: Adherence to constitutional provisions, laws, rules, procedures
3. **Performance Audit**: Economy, efficiency, effectiveness (growing focus area)
4. **Environmental Audit**: Environmental compliance and sustainability

### Key Differences from GAGAS
- Broader constitutional mandate (all public sector, not just federal fund recipients)
- Dual audit model: Parliamentary oversight + accountability framework
- Greater flexibility based on regional variations
- Direct constitutional authority over ALL public entities
- CAG reports directly to Parliament (similar to GAO structure)

### Software Implications
- Same core engine as GAGAS/ISSAI
- Indian-specific terminology and legal references
- State-level audit variations support
- Hindi and regional language support needed
- Constitutional provision mapping (Articles 148-151)

---

## 2. Basel Framework (Banking)

### Basel Committee on Banking Supervision (BCBS)

| Attribute | Detail |
|-----------|--------|
| **Established** | 1974 by G10 central bank governors |
| **Membership** | 45 member institutions from 28 jurisdictions |
| **Purpose** | Banking regulation standards and guidelines |
| **Secretariat** | Bank for International Settlements (BIS), Basel, Switzerland |

### Basel III Key Requirements
| Requirement | Detail |
|-------------|--------|
| **CET1 Capital** | 4.5% minimum |
| **Tier 1 Capital** | 6% minimum |
| **Total Capital** | 8% minimum |
| **Capital Conservation Buffer** | Additional 2.5% |
| **Countercyclical Buffer** | 0-2.5% |
| **Leverage Ratio** | 3% non-risk weighted |
| **LCR** | 100% (liquid assets cover 30-day stress) |
| **NSFR** | 100% (stable funding over 1-year) |

### Internal Audit Requirements for Banks (Principle 26)
- Independence from business lines
- Board/Audit Committee oversight
- Comprehensive audit coverage (operational, financial, compliance, IT)
- Risk-based audit planning
- Direct reporting to Audit Committee
- Right to access all records, staff, systems
- Periodic assessment of audit effectiveness

### FFIEC (US Banking)
- **Federal Financial Institutions Examination Council**
- Members: Federal Reserve, OCC, FDIC, NCUA, CFPB
- Develops uniform examination policies for US banks
- Implements Basel III and other regulatory standards
- Key examinations: internal controls, IT security, capital adequacy, liquidity

### Key Terminology
| Term | Definition |
|------|-----------|
| **Capital Adequacy** | Bank's ability to cover losses through capital cushions |
| **Risk-Weighted Assets (RWA)** | Assets weighted by risk category (sovereign 0%, corporate 100%) |
| **Stress Testing** | Scenario analysis of solvency under adverse conditions (CCAR, DFAST) |
| **Operational Risk** | Risk of loss from inadequate processes, people, systems, external events |
| **Liquidity Risk** | Risk that bank cannot meet obligations as they come due |
| **ICAAP** | Internal Capital Adequacy Assessment Process |

### Software Implications
- Capital adequacy calculation and reporting
- Stress testing documentation and audit
- Operational risk assessment framework
- Regulatory examination tracking
- Basel compliance dashboard
- FFIEC examination preparation tools

---

## 3. HIPAA (Healthcare)

### Overview

| Attribute | Detail |
|-----------|--------|
| **Full Name** | Health Insurance Portability and Accountability Act (1996) |
| **Regulatory Body** | Office for Civil Rights (OCR) at HHS |
| **Applies To** | Covered Entities (providers, health plans, clearinghouses) + Business Associates |
| **Key Objective** | Protect patient health information (PHI) |

### Three Rules

#### Security Rule (45 CFR Part 164)
**Administrative Safeguards**:
- Access management, security awareness training, audit controls
- Authorization, accountability, incident procedures
- Ongoing monitoring, periodic risk assessments (annually minimum)

**Physical Safeguards**:
- Facility access controls, workstation security
- Device logging, media controls

**Technical Safeguards**:
- Encryption, access controls, audit logging
- Transmission security, integrity controls

#### Privacy Rule (45 CFR Part 164)
- Notice of Privacy Practices
- Patient rights: access, amendment, accounting of disclosures
- Organizational requirements: Privacy Officer designation
- Documentation retention: 6 years

#### Breach Notification Rule
- Notify individuals within 60 days of discovery
- Notify media if >500 residents affected
- Notify HHS OCR

### OCR Audit Coverage
| Area | What's Audited |
|------|---------------|
| Administrative | Workforce security, access management, training records, incident response |
| Physical | Badge systems, visitor logs, workstation policies, media destruction |
| Technical | Access controls, audit features, encryption, VPN usage |

### Penalties
- Civil: $100-$50,000 per violation
- Criminal liability for knowingly obtaining PHI
- Common findings: inadequate encryption, weak access controls, missing audit logs

### Key Terminology
| Term | Definition |
|------|-----------|
| **PHI** | Protected Health Information — any health info linked to individual |
| **Covered Entity** | Provider, health plan, or clearinghouse handling PHI |
| **Business Associate** | Third party processing PHI on behalf of CE |
| **Breach** | Unauthorized access/acquisition of unsecured PHI |
| **De-identification** | Removal of 18 identifiers (Safe Harbor method) |
| **Minimum Necessary** | Only access/use PHI needed for the purpose |

### Software Implications
- PHI risk assessment module
- Security Rule compliance checklist (admin, physical, technical)
- Breach notification workflow and tracking
- Business Associate agreement management
- De-identification verification tools
- 18-identifier tracking for data handling audits

---

## 4. ESG / Sustainability Assurance

### CSRD — Corporate Sustainability Reporting Directive (EU)

| Attribute | Detail |
|-----------|--------|
| **Enacted** | EU Directive 2022/2464 (December 2022) |
| **Applicability** | Large companies (250+ employees, EUR 50M revenue, EUR 25M assets) from 2025 |
| **Assurance** | External assurance required (limited initially → reasonable by 2028) |
| **Key Concept** | Double Materiality |

**Double Materiality Framework**:
- **Financial Materiality**: ESG factors impacting company's financial performance (outside-in)
- **Impact Materiality**: Company's impacts on people, society, environment (inside-out)
- Must assess BOTH directions

### ISSB — International Sustainability Standards Board

| Attribute | Detail |
|-----------|--------|
| **Established** | 2021 by IFRS Foundation |
| **Standards** | IFRS S1 (General Requirements), IFRS S2 (Climate-Related Disclosures) |
| **Structure** | Governance, Strategy, Risk Management, Metrics & Targets |

**IFRS S2 Climate Requirements**:
- Scope 1 emissions: Direct GHG from owned/controlled sources
- Scope 2 emissions: Indirect GHG from purchased electricity/steam
- Scope 3 emissions: All other indirect GHG (supply chain, product use, waste)
- Science-based targets alignment
- Climate scenario analysis (1.5°C Paris Agreement)

### GRI — Global Reporting Initiative

| Attribute | Detail |
|-----------|--------|
| **Established** | 1997, Netherlands |
| **Adoption** | Most widely used sustainability framework (80%+ of Fortune 500) |
| **Structure** | GRI 1 (Foundation), GRI 2 (General Disclosures), GRI 3 (Material Topics), GRI 201-419 (Specific topics) |

### ESG Assurance Types

| Type | Confidence | Procedures | Required By |
|------|-----------|------------|-------------|
| **Limited Assurance** | Moderate ("nothing came to our attention") | Analytical procedures, inquiries, sample testing | CSRD initially |
| **Reasonable Assurance** | High ("fairly stated in all material respects") | Detailed testing, controls, populations | CSRD by 2028 |

### Key Terminology
| Term | Definition |
|------|-----------|
| **Double Materiality** | Both financial impact ON company AND company impact ON world |
| **Scope 1/2/3 Emissions** | Direct / Purchased energy / Value chain GHG emissions |
| **SBTi** | Science-Based Targets initiative — validates climate targets |
| **TCFD** | Task Force on Climate-related Financial Disclosures |
| **Transition Plan** | Company roadmap to net-zero with interim milestones |
| **Just Transition** | Equitable outcomes for workers/communities during sustainability transition |
| **Assurance Provider** | Independent party providing ESG assurance (may be audit firm or specialist) |

### Software Implications
- Double materiality assessment module
- Scope 1/2/3 emissions tracking and calculation
- ESG metrics dashboard with targets
- Climate scenario analysis documentation
- GRI standards compliance checklist
- Limited vs reasonable assurance workflows
- ESG report generation (CSRD/ISSB/GRI formats)
- Stakeholder engagement tracking
- Supply chain ESG data collection

---

## 5. Standards Priority for AIMS v2

| Priority | Standard | Market | Complexity | Revenue Potential |
|----------|----------|--------|-----------|-------------------|
| 1 | GAGAS | US Government | Known (v1 built) | Medium |
| 2 | IIA GIAS 2024 | Global Internal Audit | Medium | High (largest user base) |
| 3 | SOX/PCAOB | US Public Companies | High | Very High (premium) |
| 4 | ISO 19011 | Global Quality/Safety | Medium | High (broad applicability) |
| 5 | COBIT | IT Audit | High | High (growing market) |
| 6 | ISSAI | International Government | Low (like GAGAS) | Medium |
| 7 | ESG/CSRD | EU/Global Listed Companies | Medium | Very High (emerging) |
| 8 | HIPAA | US Healthcare | Medium | Medium |
| 9 | Basel/FFIEC | Financial Services | High | High |
| 10 | CAG (India) | Indian Government | Low (like ISSAI) | Medium |
