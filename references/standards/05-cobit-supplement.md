# COBIT 2019 & IT Audit Frameworks — Round 2 Supplement

> Supplements `05-cobit-deep-dive.md` with Design Factors, NIST CSF 2.0, NIST 800-53 Rev 5, CMMC 2.0, ITIL 4, CIS Controls v8, and emerging areas.

---

## 1. COBIT 2019 Design Factors (11 Factors)

The 11 design factors are documented in **ISACA's COBIT 2019 Design Guide**. Each factor produces an input to the tailored governance system.

| # | Design Factor | Description |
|---|---------------|-------------|
| 1 | **Enterprise Strategy** | Growth/Acquisition, Innovation/Differentiation, Cost Leadership, Client Service/Stability (1-5 importance each) |
| 2 | **Enterprise Goals** | 13 goals across BSC dimensions (Financial, Customer, Internal, Learning & Growth) — EG01-EG13, rated 1-5 |
| 3 | **Risk Profile** | 20 generic IT risk categories — impact × likelihood scoring (IT investment decisions, program/project lifecycle, IT cost/oversight, infrastructure/operations, unauthorized actions, software adoption, logical attacks, third-party/supplier, regulatory compliance, geopolitical, industrial action, acts of nature, tech-based innovation, environmental, data/information management, data privacy) |
| 4 | **I&T-Related Issues** | 20 common IT issues (frustration between IT/business, significant IT incidents, shadow IT, duplicate initiatives, IT resource shortage, skills gap, IT changes causing business problems, projects over budget, etc.) — Rated 1-3 |
| 5 | **Threat Landscape** | Normal vs High — % distribution |
| 6 | **Compliance Requirements** | Low, Normal, High regulatory burden — % distribution |
| 7 | **Role of IT** | Support, Factory, Turnaround, Strategic (McFarlan strategic grid) |
| 8 | **Sourcing Model for IT** | Outsourcing, Cloud, Insourced, Hybrid — % distribution |
| 9 | **IT Implementation Methods** | Agile, DevOps, Traditional (Waterfall), Hybrid — % distribution |
| 10 | **Technology Adoption Strategy** | First Mover, Follower, Slow Adopter — % distribution |
| 11 | **Enterprise Size** | Large (>250 FTE) or SME (50-250 FTE) |

### Design Factor Workflow (Design Guide Chapter 3)
1. **Step 1**: Understand enterprise context & strategy → factors 1, 2, 11
2. **Step 2**: Determine initial scope of governance system → factors 3, 4
3. **Step 3**: Refine scope → factors 5, 6, 7, 8, 9, 10
4. **Step 4**: Conclude governance system design → output is prioritized list of objectives + capability target levels + component variants

**Output**: Heatmap-style importance rating (0-100) for each of the 40 governance/management objectives, with target capability levels.

---

## 2. COBIT Focus Areas (Pre-Built Applications)

Focus areas are pre-built applications of COBIT 2019 tailored to specific topics:

- **COBIT Focus Area: Information Security** (2020) — aligns to ISO 27001/27002
- **COBIT Focus Area: DevOps** (2021) — CI/CD pipelines, IaC governance
- **COBIT Focus Area: Small and Medium Enterprises** (2022) — ~20 of 40 objectives scaled for SME
- **COBIT Focus Area: Cybersecurity** — maps to NIST CSF
- **COBIT Focus Area: Risk** (2023) — extends APO12 with enterprise risk management
- **COBIT Focus Area: Digital Transformation**
- **COBIT Focus Area: Cloud Computing**

---

## 3. Process Capability Model (Detail)

COBIT 2019 replaced COBIT 5's Process Assessment Model (PAM) with the **COBIT Performance Management (CPM)** model from CMMI.

### Capability Levels (0-5) — Applied to Processes
- **Level 0**: Incomplete — process not implemented or fails to achieve purpose
- **Level 1**: Initial/Performed — achieves purpose, activities are ad hoc
- **Level 2**: Managed — planned, documented, measured
- **Level 3**: Defined — uses standard process based on corporate standards
- **Level 4**: Quantitative — operates within defined limits, predictable, statistical
- **Level 5**: Optimizing — continuous improvement

### Maturity Levels (0-5) — Applied to Focus Areas
A focus area reaches maturity level X ONLY when ALL processes in scope achieve capability level X. Maturity is conservative aggregate of capability.

### Assessment Approaches
- **Self-assessment** — quick, indicative
- **Formal assessment by certified COBIT Assessor** — rigorous
- **Continuous assessment** — part of GRC tooling

### Capability Indicators per Level
Generic practices, work products, and resources — management practices + activities rated N/P/L/F:
- **N** (Not achieved): 0-15%
- **P** (Partially): >15-50%
- **L** (Largely): >50-85%
- **F** (Fully): >85-100%

---

## 4. NIST Cybersecurity Framework (CSF) 2.0 — Released February 2024

**Major update**: 6 Functions (added GOVERN as first)

### 6 Functions

| Function | Purpose | Example Categories |
|----------|---------|-------------------|
| **GV — Govern** (NEW in 2.0) | Establish, communicate, monitor cyber risk management strategy | GV.OC (Organizational Context), GV.RM (Risk Management Strategy), GV.RR (Roles & Responsibilities), GV.PO (Policy), GV.OV (Oversight), GV.SC (Cybersecurity Supply Chain Risk Management) |
| **ID — Identify** | Understand cybersecurity risk | ID.AM (Asset Management), ID.RA (Risk Assessment), ID.IM (Improvement) |
| **PR — Protect** | Safeguards to ensure delivery | PR.AA (Identity/Auth), PR.AT (Awareness/Training), PR.DS (Data Security), PR.PS (Platform Security), PR.IR (Tech Infrastructure Resilience) |
| **DE — Detect** | Find cybersecurity events | DE.CM (Continuous Monitoring), DE.AE (Adverse Event Analysis) |
| **RS — Respond** | Take action on detected event | RS.MA (Management), RS.AN (Analysis), RS.CO (Communication), RS.MI (Mitigation) |
| **RC — Recover** | Restore capabilities | RC.RP (Recovery Plan Execution), RC.CO (Communication) |

### Structure
- **Function → Category → Subcategory → Implementation Example**
- Total: 6 Functions, 22 Categories, 106 Subcategories (in CSF 2.0)

### Implementation Tiers (4 levels)
1. **Tier 1 — Partial**: Ad hoc, reactive, limited awareness
2. **Tier 2 — Risk Informed**: Risk management approved by mgmt, not org-wide policy
3. **Tier 3 — Repeatable**: Formal policy, regularly updated, org-wide
4. **Tier 4 — Adaptive**: Continuous improvement, lessons learned, advanced

### Profiles
- **Community Profile** — shared across similar orgs (published in CSF 2.0)
- **Organizational Profile** — current state vs target state
- **Gap analysis** drives action plan

---

## 5. NIST SP 800-53 Rev. 5 (September 2020, update 5.1.1 in 2022)

### 20 Control Families

| Code | Family | Example Controls |
|------|--------|------------------|
| AC | Access Control | AC-2 Account Mgmt, AC-3 Access Enforcement, AC-6 Least Privilege, AC-17 Remote Access |
| AT | Awareness & Training | AT-2 Literacy Training |
| AU | Audit & Accountability | AU-2 Event Logging, AU-6 Review, AU-12 Audit Record Generation |
| CA | Assessment, Authorization & Monitoring | CA-2 Control Assessments, CA-7 Continuous Monitoring |
| CM | Configuration Management | CM-2 Baseline Config, CM-6 Config Settings, CM-7 Least Functionality |
| CP | Contingency Planning | CP-2 CP Plan, CP-9 System Backup, CP-10 Recovery |
| IA | Identification & Authentication | IA-2 User ID/Auth, IA-5 Authenticator Mgmt |
| IR | Incident Response | IR-4 Incident Handling, IR-8 Incident Response Plan |
| MA | Maintenance | MA-2 Controlled Maintenance |
| MP | Media Protection | MP-6 Media Sanitization |
| PE | Physical & Environmental | PE-3 Physical Access Control |
| PL | Planning | PL-2 System Security Plan |
| PM | Program Management | PM-9 Risk Mgmt Strategy |
| PS | Personnel Security | PS-3 Personnel Screening |
| **PT** | PII Processing & Transparency (**NEW Rev.5**) | PT-2 Authority to Process PII, PT-3 PII Processing Purposes |
| RA | Risk Assessment | RA-3 Risk Assessment, RA-5 Vulnerability Monitoring |
| SA | System & Services Acquisition | SA-11 Developer Testing, SA-15 Dev Process |
| SC | System & Communications Protection | SC-7 Boundary Protection, SC-8 Transmission Confidentiality, SC-13 Cryptographic Protection |
| SI | System & Information Integrity | SI-2 Flaw Remediation, SI-4 System Monitoring, SI-7 Software/Firmware/Information Integrity |
| **SR** | Supply Chain Risk Management (**NEW Rev.5**) | SR-3 SCRM, SR-5 Acquisition Strategies |

### Baselines (NIST SP 800-53B)
- **Low impact**: ~150 controls
- **Moderate impact**: ~280 controls
- **High impact**: ~370 controls
- **Privacy baseline**: separate overlay

### Tailoring
Scoping → parameterization → compensating controls → supplementation.

---

## 6. NIST SP 800-171 Rev. 3 (May 2024)

Protecting **Controlled Unclassified Information (CUI)** in nonfederal systems.

**14 Families** (subset of 800-53 relevant to CUI):
AC, AT, AU, CM, IA, IR, MA, MP, PE, PS, RA, CA, SC, SI

**Rev. 3** — 97 security requirements (reduced from 110 in Rev. 2), restructured to align with 800-53 Rev. 5.

**Mandatory for**:
- **DFARS 252.204-7012** (DoD contracts handling CUI)
- Required for **CMMC 2.0 Level 2**
- Federal civilian contracts handling CUI (FAR clause anticipated)

## 7. NIST Risk Management Framework (RMF) — SP 800-37 Rev. 2

### 7-Step Process
1. **Prepare** — org-level & system-level activities, common control identification
2. **Categorize** — FIPS 199 impact analysis (Low/Mod/High for CIA)
3. **Select** — 800-53 baseline + tailoring + overlays
4. **Implement** — deploy controls, document in System Security Plan (SSP)
5. **Assess** — Security Assessment Report (SAR) by independent assessor
6. **Authorize** — Authorizing Official issues ATO based on Plan of Action and Milestones (POA&M)
7. **Monitor** — continuous monitoring, ongoing authorization

---

## 8. CMMC 2.0 — Final Rule December 2024, Effective 2025

### 3 Levels (down from 5 in CMMC 1.0)

| Level | Name | Basis | Assessment | Scope |
|-------|------|-------|------------|-------|
| 1 | **Foundational** | 17 practices — basic FAR 52.204-21 | Annual self-assessment + affirmation | FCI (Federal Contract Info) |
| 2 | **Advanced** | 110 controls = NIST SP 800-171 | Triennial C3PAO assessment (select contracts) OR self-assessment | CUI |
| 3 | **Expert** | 110 from 800-171 + subset of SP 800-172 (~24 enhanced) | DIBCAC (DoD) assessment, triennial | Highest-value CUI |

**C3PAO** = CMMC Third Party Assessor Organization (accredited by Cyber AB).

Timeline: 3-year phased rollout in DoD contracts.

---

## 9. ITIL 4 (released 2019, ongoing updates)

### 7 Guiding Principles
1. **Focus on value**
2. **Start where you are**
3. **Progress iteratively with feedback**
4. **Collaborate and promote visibility**
5. **Think and work holistically**
6. **Keep it simple and practical**
7. **Optimize and automate**

### 4 Dimensions
1. Organizations & People
2. Information & Technology
3. Partners & Suppliers
4. Value Streams & Processes

### Service Value System (SVS) Components
- Guiding Principles
- Governance
- Service Value Chain (SVC)
- Practices
- Continual Improvement

### Service Value Chain (6 activities)
1. Plan
2. Improve
3. Engage
4. Design & Transition
5. Obtain/Build
6. Deliver & Support

### 34 ITIL 4 Practices (3 categories)

**14 General Management Practices**:
Strategy Mgmt, Portfolio Mgmt, Architecture Mgmt, Service Financial Mgmt, Workforce & Talent Mgmt, Continual Improvement, Measurement & Reporting, Risk Mgmt, Information Security Mgmt, Knowledge Mgmt, Organizational Change Mgmt, Project Mgmt, Relationship Mgmt, Supplier Mgmt.

**17 Service Management Practices**:
Business Analysis, Service Catalog Mgmt, Service Design, Service Level Mgmt, Availability Mgmt, Capacity & Performance Mgmt, Service Continuity Mgmt, Monitoring & Event Mgmt, Service Desk, **Incident Management**, Service Request Mgmt, **Problem Management**, Release Mgmt, **Change Enablement** (renamed from Change Management), Service Validation & Testing, Service Configuration Mgmt, IT Asset Mgmt.

**3 Technical Management Practices**:
Deployment Mgmt, Infrastructure & Platform Mgmt, Software Development & Mgmt.

---

## 10. COBIT 2019 → ITIL 4 Mappings

| COBIT Objective | ITIL 4 Practice(s) |
|----------------|-------------------|
| **DSS01** Managed Operations | Infrastructure & Platform Mgmt, Monitoring & Event Mgmt, Deployment Mgmt |
| **DSS02** Managed Service Requests & Incidents | Incident Mgmt, Service Request Mgmt, Service Desk |
| **DSS03** Managed Problems | Problem Management |
| **DSS04** Managed Continuity | Service Continuity Mgmt |
| **DSS05** Managed Security Services | Information Security Mgmt |
| **DSS06** Managed Business Process Controls | Business Analysis |
| **BAI03** Managed Solutions Identification & Build | Service Design, Service Validation & Testing |
| **BAI06** Managed IT Changes | Change Enablement |
| **BAI07** Managed IT Change Acceptance & Transitioning | Release Mgmt, Deployment Mgmt |
| **BAI09** Managed Assets | IT Asset Mgmt |
| **BAI10** Managed Configuration | Service Configuration Mgmt |
| **APO09** Managed Service Agreements | Service Level Mgmt, Service Catalog Mgmt |
| **APO10** Managed Vendors | Supplier Management |
| **APO11** Managed Quality | Continual Improvement, Measurement & Reporting |
| **APO12** Managed Risk | Risk Management |
| **APO13** Managed Security | Information Security Mgmt |
| **APO14** Managed Data | (data governance in several practices) |
| **EDM01-05** Governance objectives | Governance (SVS component) |

---

## 11. CIS Controls v8 (May 2021, updated v8.1 June 2024)

### Implementation Groups
- **IG1 (Essential cyber hygiene)**: 56 safeguards — for SME with limited IT/security expertise
- **IG2**: +74 safeguards (130 total) — orgs with some IT resources
- **IG3**: +23 safeguards (153 total) — mature organizations, sophisticated threats

### 18 Controls

| # | Control | Focus |
|---|---------|-------|
| 1 | Inventory and Control of Enterprise Assets | Asset inventory |
| 2 | Inventory and Control of Software Assets | Software inventory |
| 3 | Data Protection | Data classification, handling |
| 4 | Secure Configuration of Enterprise Assets and Software | Hardening |
| 5 | Account Management | Account lifecycle |
| 6 | Access Control Management | Privilege mgmt, MFA |
| 7 | Continuous Vulnerability Management | Scanning, patching |
| 8 | Audit Log Management | Logging, review |
| 9 | Email and Web Browser Protections | Filtering |
| 10 | Malware Defenses | AV/EDR |
| 11 | Data Recovery | Backup/restore |
| 12 | Network Infrastructure Management | Segmentation, secure config |
| 13 | Network Monitoring and Defense | IDS/IPS, NDR |
| 14 | Security Awareness and Skills Training | Training program |
| 15 | Service Provider Management | Third-party |
| 16 | Application Software Security | SDLC, SCA, DAST/SAST |
| 17 | Incident Response Management | IR plan, tabletops |
| 18 | Penetration Testing | Red team |

**Note**: v8 removed "Physical Security" as standalone (now in 12/13), added "Service Provider Management" (#15).

### Mappings
Official CIS-to-NIST CSF mapping exists (subcategory-to-safeguard); also maps to NIST 800-53, ISO 27001, PCI DSS v4.0, HIPAA.

---

## 12. ISACA Certifications

### COBIT-Specific
- **COBIT 2019 Foundation** — 75 MCQs, 120 min, 65% pass. Framework, components, DF overview.
- **COBIT 2019 Design and Implementation** — 3.5 days training + exam. Tailoring using Design Guide.
- **COBIT 2019 Assessor** — uses COBIT Performance Management. Prerequisite: Foundation.

### Other ISACA Certs for IT Audit
- **CISA** (Certified Information Systems Auditor) — 150 MCQs, 4hrs. 5 domains: IS Auditing Process (18%), Governance & Mgmt of IT (18%), IS Acquisition/Dev/Implementation (12%), IS Operations & Business Resilience (26%), Protection of Info Assets (26%). Requires 5 years experience.
- **CISM** (Information Security Manager)
- **CRISC** (Risk and Information Systems Control)
- **CGEIT** (Governance of Enterprise IT)
- **CDPSE** (Data Privacy Solutions Engineer)
- **CET** (Emerging Tech)

---

## 13. IT Audit Techniques — Detail

### CAATs (Computer-Assisted Audit Techniques)

**Data extraction/analysis tools**:
- **ACL Analytics** (now Galvanize/Diligent HighBond) — scripting, continuous monitoring
- **IDEA** (CaseWare) — data analytics, Benford's, duplicate detection, gap/sequence
- **Arbutus Analyzer** — ACL alternative
- **TeamMate Analytics** (Wolters Kluwer)
- **Python/R/SQL** — increasingly common
- **Power BI/Tableau** for visualization

**Test Types**:
- **Test data method** — run fictitious data through live system
- **Integrated test facility (ITF)** — embedded dummy entity
- **Parallel simulation** — auditor reruns production logic
- **Embedded audit modules** — logging hooks
- **SCARF (Systems Control Audit Review File)**
- **Snapshot technique**
- **Continuous and Intermittent Simulation (CIS)**

### Continuous Auditing / Continuous Monitoring (CA/CM)
- CA = auditor-driven, real-time control testing
- CM = management-driven, embedded controls monitoring
- GTAG 3 (IIA) — Continuous Auditing guidance

### Data Analytics Techniques
- **Benford's Law** — first-digit frequency analysis for fraud/anomaly detection in natural data
- **Stratification** — layered population analysis
- **Gap and duplicate testing**
- **Joining/matching** across datasets (employee-vendor match for fictitious vendor)
- **Aging analysis**
- **Outlier detection** — z-score, IQR, ML-based
- **Trend analysis / regression**
- **Cluster analysis**

### Automated Control Testing via RPA
- UiPath, Automation Anywhere, Blue Prism bots execute repetitive SOX control tests
- Example: automated SoD conflict check across SAP roles
- Journal entry testing automation

### Pen Testing / VA in Audit
- **Black box / Gray box / White box**
- **OWASP Testing Guide** — web app focus
- **PTES** (Penetration Testing Execution Standard)
- **NIST SP 800-115** — Technical Guide to Information Security Testing
- **Vulnerability scanning**: Nessus, Qualys, Rapid7, OpenVAS — CVSS-scored findings
- **Red team vs pen test** distinction: red team is adversary emulation (MITRE ATT&CK-based)

---

## 14. Cloud Audit

### Shared Responsibility Model

| Layer | IaaS | PaaS | SaaS |
|-------|------|------|------|
| Data | Customer | Customer | Customer |
| Endpoints/Access | Customer | Customer | Customer |
| Identity/Directory | Customer | Customer | Shared |
| Application | Customer | Shared | Provider |
| Runtime | Customer | Provider | Provider |
| OS | Customer | Provider | Provider |
| Virtualization | Provider | Provider | Provider |
| Hardware/Network/Facility | Provider | Provider | Provider |

### CSA Framework
- **CCM v4.0.12** (2024) — 17 domains, 197 control objectives
- **CAIQ** — standardized provider questionnaire mapped to CCM
- **STAR Program**:
  - **Level 1**: Self-assessment (free)
  - **Level 2**: Third-party audit (CCM + ISO 27001 or SOC 2)
  - **Level 3**: Continuous monitoring (emerging)

### FedRAMP
- **FedRAMP Low**: ~125 controls
- **FedRAMP Moderate**: ~325 controls — most common
- **FedRAMP High**: ~425 controls
- **FedRAMP Li-SaaS**: streamlined for low-impact SaaS
- 3PAO (Third-Party Assessment Organization) conducts assessment
- JAB or Agency ATO
- Based on NIST 800-53 Rev. 5

### SOC 2 (AICPA SSAE 18, TSP section 100)
- **Trust Services Criteria (TSC)**: Security (mandatory), Availability, Processing Integrity, Confidentiality, Privacy
- **Type I**: point-in-time design
- **Type II**: operating effectiveness over 6-12 months (preferred by customers)
- Common Criteria (CC1-CC9) based on COSO + additional

---

## 15. Privacy Frameworks

### NIST Privacy Framework v1.0 (2020)
Same structure as CSF but privacy-focused. 5 Functions: IDENTIFY-P, GOVERN-P, CONTROL-P, COMMUNICATE-P, PROTECT-P.

### GDPR Audit Angles (EU Regulation 2016/679, effective May 2018)
- **Art. 5** — Principles (lawfulness, purpose limitation, data minimization, accuracy, storage limitation, integrity/confidentiality, accountability)
- **Art. 6** — Lawful basis for processing (6 bases)
- **Art. 25** — Privacy by Design/Default
- **Art. 30** — Records of Processing Activities (RoPA)
- **Art. 32** — Security of processing
- **Art. 33-34** — Breach notification (72hrs to DPA)
- **Art. 35** — DPIA
- **Art. 37-39** — DPO requirements
- Fines: up to €20M or 4% global turnover

### CCPA/CPRA (California)
- CCPA effective 2020, CPRA amendments effective 2023
- CPPA (California Privacy Protection Agency) enforcement
- Consumer rights: Know, Delete, Correct, Opt-Out of Sale/Sharing, Limit Sensitive PI, Non-discrimination

### ISO/IEC 27701:2019
- Extension to ISO 27001/27002 for Privacy Information Management Systems (PIMS)
- Maps to GDPR articles directly
- PII Controller and PII Processor specific controls

### Other Privacy Laws
- HIPAA (healthcare, US)
- PIPEDA (Canada), Quebec Law 25
- LGPD (Brazil)
- PDPA (Singapore, Thailand)
- POPIA (South Africa)
- DPDP Act (India, 2023)
- State laws: VA CDPA, CO CPA, CT CTDPA, UT UCPA, TX TDPSA (~20 US states by 2025)

---

## 16. Emerging Area Frameworks

### AI/ML Audit
- **NIST AI Risk Management Framework (AI RMF 1.0)** — January 2023. Functions: GOVERN, MAP, MEASURE, MANAGE. AI RMF Generative AI Profile (July 2024).
- **ISO/IEC 42001:2023** — AI Management System (first certifiable AI standard)
- **ISO/IEC 23894:2023** — AI Risk Management
- **ISO/IEC 22989** — AI Concepts and Terminology
- **EU AI Act** (Regulation 2024/1689, phased enforcement 2024-2027) — 4 risk tiers: Unacceptable, High, Limited, Minimal
- **COSO ERM for AI** guidance
- Audit considerations: model bias, explainability (XAI), data lineage, model drift, training data quality, prompt injection, hallucinations, adversarial robustness

### Blockchain Audit
- AICPA Blockchain Universal Glossary
- AICPA guidance on digital asset accounting
- Smart contract audit specialized firms (Trail of Bits, ConsenSys Diligence, OpenZeppelin)
- Consensus mechanism review, key management, transaction validation, oracle risk

### IoT Audit
- **NIST SP 800-213** — IoT Device Cybersecurity Guidance
- **NIST IR 8259** — Foundational Cybersecurity Activities for IoT Manufacturers
- **ETSI EN 303 645** — Consumer IoT cybersecurity
- Lifecycle, firmware update, device identity, data minimization, decommissioning

### DevSecOps Audit
- **NIST SP 800-204C** — Implementing DevSecOps for Microservices with Service Mesh
- **NIST SSDF (SP 800-218)** — Secure Software Development Framework (required by EO 14028 for federal software)
- **SLSA (Supply-chain Levels for Software Artifacts)** — levels 1-4 for build integrity
- **OWASP SAMM** and **BSIMM** — Software Assurance Maturity Models
- CI/CD pipeline controls: signed commits, SBOM generation (CycloneDX, SPDX), SAST/DAST/SCA, IaC scanning (Checkov, tfsec), secrets scanning, container image scanning, artifact signing (Sigstore/cosign)

---

## 17. Practical Design Guide Example — Mid-Size Fintech

**Example: 400 FTE, US-based, heavy regulatory burden**

### Step 1 — Understand Context
- **DF1 Strategy**: Innovation/Differentiation = 5, Growth = 4, Cost Leadership = 2, Client Service = 5
- **DF2 Enterprise Goals**: EG01 Portfolio = 5; EG03 Compliance = 5; EG07 Quality of mgmt info = 5; EG09 Optimization = 4
- **DF11 Size**: Large enterprise (>250 FTE)

### Step 2 — Initial Scope
- **DF3 Risk Profile**: High for IT compliance, data/info mgmt, data privacy, third-party; Moderate for IT investment decisions, logical attacks
- **DF4 IT-Related Issues**: High frustration on regulatory audit findings; shadow IT; skills gap in cloud security

### Step 3 — Refine Scope
- **DF5 Threat Landscape**: High (70%)
- **DF6 Compliance**: High (SOX, GLBA, NY DFS Part 500, PCI DSS, state privacy laws)
- **DF7 Role of IT**: Strategic (core to value proposition)
- **DF8 Sourcing**: 50% cloud, 30% insourced, 20% outsourced
- **DF9 Implementation Methods**: 60% Agile, 30% DevOps, 10% Traditional
- **DF10 Tech Adoption**: Follower (regulated industry)

### Step 4 — Governance System

**Highest Priority (capability target 4)**:
- **APO12** Managed Risk
- **APO13** Managed Security
- **APO14** Managed Data (new in COBIT 2019)
- **MEA03** Managed Compliance with External Requirements
- **DSS05** Managed Security Services
- **BAI06** Managed IT Changes
- **APO10** Managed Vendors (cloud providers)

**High Priority (capability target 3)**:
- **EDM03** Ensured Risk Optimization
- **APO09** Managed Service Agreements
- **BAI03** Managed Solutions Identification
- **DSS04** Managed Continuity
- **MEA01** Managed Performance and Conformance Monitoring

**Component Variations**:
- For DF9 (Agile/DevOps heavy), use **COBIT Focus Area: DevOps** variants
- For DF8 (cloud), use **Focus Area: Cloud Computing** variants
- For DF6 (high compliance), additional specific practices in MEA03

**Implementation Roadmap** — 7-phase continual improvement lifecycle:
1. What are the drivers?
2. Where are we now?
3. Where do we want to be?
4. What needs to be done?
5. How do we get there?
6. Did we get there?
7. How do we keep the momentum?

---

## 18. Enhanced Software Feature Requirements

Adding to original COBIT feature requirements:

| COBIT/IT Audit Requirement | Enhanced Software Feature |
|----------------------------|--------------------------|
| 11 Design Factors | Design factor questionnaire + scoring, governance system tailoring engine |
| Focus Areas | Pre-built templates for Security, DevOps, SME, Cybersecurity, Cloud |
| Capability Model (0-5) | Capability scoring per objective, N/P/L/F indicators, maturity aggregation |
| NIST CSF 2.0 | 6 Function navigator (with new GOVERN), 22 Categories, 106 Subcategories, Tier assessment |
| NIST 800-53 Rev 5 | 20 control families, Low/Mod/High baselines, privacy overlay, tailoring workflow |
| NIST 800-171 Rev 3 | 14 families, CMMC Level 2 mapping, DFARS compliance |
| CMMC 2.0 | 3-level (Foundational/Advanced/Expert) tracking, C3PAO assessment, DIBCAC |
| NIST RMF | 7-step workflow (Prepare, Categorize, Select, Implement, Assess, Authorize, Monitor), POA&M tracking |
| ITIL 4 | 34 practices organized by 3 categories, SVS model, 4 Dimensions |
| CIS Controls v8 | 18 controls, 3 Implementation Groups (IG1/2/3), 153 safeguards, NIST CSF mapping |
| FedRAMP | Low/Mod/High/Li-SaaS, 3PAO, JAB/Agency ATO, 800-53 Rev 5 |
| SOC 2 | 5 Trust Services Criteria, Type I/Type II, CC1-CC9 |
| NIST Privacy Framework | 5 Functions (Identify-P/Govern-P/Control-P/Communicate-P/Protect-P) |
| GDPR | Art. 5, 6, 25, 30, 32, 33-34, 35, 37-39 tracking |
| NIST AI RMF | 4 Functions (GOVERN/MAP/MEASURE/MANAGE), Generative AI Profile |
| ISO 42001 | AI Management System certification support |
| EU AI Act | 4-tier risk classification (Unacceptable/High/Limited/Minimal) |
| DevSecOps | SSDF compliance, SLSA levels, SBOM tracking, CI/CD control mapping |
