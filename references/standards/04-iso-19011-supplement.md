# ISO 19011 & Management Systems — Round 2 Supplement

> Supplements `04-iso-19011-deep-dive.md` with Annex SL Harmonized Structure, ISO 27001:2022 full Annex A, IAF mandatory documents, certification process, and integrated audits.

---

## 1. Annex SL / Harmonized Structure (HS)

Since 2012, all new and revised ISO management system standards follow the **High-Level Structure** (renamed **Harmonized Structure** in 2021). This enables integration because the shell is identical — only Clause 8 differs substantively between standards.

### Common 10-Clause Structure

| Clause | Title |
|--------|-------|
| 1 | Scope |
| 2 | Normative references |
| 3 | Terms and definitions |
| 4 | Context of the organization (4.1 external/internal issues; 4.2 interested parties; 4.3 scope; 4.4 MS and processes) |
| 5 | Leadership (5.1 L&C; 5.2 policy; 5.3 roles/responsibilities/authorities) |
| 6 | Planning (6.1 risks/opportunities; 6.2 objectives; 6.3 planning changes — added 2021) |
| 7 | Support (7.1 resources; 7.2 competence; 7.3 awareness; 7.4 communication; 7.5 documented information) |
| 8 | **Operation** — standard-specific content (varies per standard) |
| 9 | Performance evaluation (9.1 monitoring/measurement; 9.2 internal audit; 9.3 management review) |
| 10 | Improvement (10.1 general; 10.2 nonconformity and corrective action; 10.3 continual improvement) |

---

## 2. ISO 19011:2018 Annex A and B Details

### Annex A — Discipline-Specific Knowledge/Skills
Informative guidance for auditors in specific disciplines:
- Transportation safety management
- Environmental management (GHG emissions, life cycle assessment, biodiversity)
- Quality management (customer focus, process approach, statistical techniques)
- Records management (lifecycle, metadata, preservation)
- Resilience, security, preparedness, continuity management
- Information security management (cryptography, access control, cyber threats, incident response)
- Occupational health and safety management (HAZOP, FMEA, Bowtie methodologies)
- Asset management (asset lifecycle, condition monitoring, maintenance)
- Energy management (EnPIs, energy baselines, significant energy uses)
- Anti-bribery management (red flags, due diligence, third-party risk)
- Compliance management (compliance obligations register)
- Road traffic safety management (ISO 39001)
- Medical devices quality (ISO 13485)

### Annex B — Practical "How-to" Section

**B.1 Applying audit methods** — Four method combinations:

| Extent of involvement | On-site (human interaction) | Remote (no human interaction) |
|----------------------|---------------------------|------------------------------|
| With human interaction | Interviews, observation, sampling | Interactive communication via phone/video |
| Without human interaction | Document review on-site, observation of work | Document review off-site, CCTV surveillance, data analysis |

**B.2-B.18 Guidance topics**:
- Process approach to auditing (turtle diagrams, SIPOC, interaction between processes)
- Professional judgment
- Performance results vs ability to achieve results (leading vs lagging indicators)
- Verifying information through triangulation
- Sampling (judgment-based vs statistical)
- Auditing compliance within a management system
- Auditing context, leadership, risks/opportunities, life cycle
- Auditing supply chain
- Preparing audit work documents
- Visiting auditee's location (safety, security clearance, PPE, escort protocols)
- Auditing virtual activities and locations (remote auditing)
- Conducting interviews (open questions, hypothetical scenarios, reaching non-management)
- Audit findings (describing conformity AND non-conformity)

---

## 3. ISO/IEC 27001:2022 — Major Update Detail

**Published October 25, 2022** — Major revision. Transition deadline **October 31, 2025**.

### Structure Change
**2013 version**: 114 controls in 14 domains
**2022 version**: **93 controls in 4 themes** (consolidation + modernization)

### Annex A Four Themes

**A.5 Organizational controls (37 controls)**:
- A.5.1 Policies for information security
- A.5.7 Threat intelligence (**NEW**)
- A.5.23 Information security for use of cloud services (**NEW**)
- A.5.30 ICT readiness for business continuity (**NEW**)
- Supplier relationships, access control policy, asset management policies

**A.6 People controls (8 controls)**:
- A.6.1 Screening, A.6.2 Terms of employment
- A.6.3 Awareness, education, training
- A.6.7 Remote working (**NEW**)
- A.6.8 Information security event reporting

**A.7 Physical controls (14 controls)**:
- A.7.1-7.4 Physical security perimeters, entry, offices, monitoring (**NEW**)
- A.7.10 Storage media
- A.7.14 Secure disposal or re-use of equipment

**A.8 Technological controls (34 controls)**:
- A.8.1 User endpoint devices
- A.8.9 Configuration management (**NEW**)
- A.8.10 Information deletion (**NEW**)
- A.8.11 Data masking (**NEW**)
- A.8.12 Data leakage prevention (**NEW**)
- A.8.16 Monitoring activities (**NEW**)
- A.8.22 Segregation of networks
- A.8.23 Web filtering (**NEW**)
- A.8.28 Secure coding (**NEW**)

### 11 ENTIRELY NEW Controls in 2022
1. A.5.7 Threat intelligence
2. A.5.23 Cloud services
3. A.5.30 ICT readiness for BC
4. A.7.4 Physical security monitoring
5. A.8.9 Configuration management
6. A.8.10 Information deletion
7. A.8.11 Data masking
8. A.8.12 Data leakage prevention
9. A.8.16 Monitoring activities
10. A.8.23 Web filtering
11. A.8.28 Secure coding

### Control Attributes (NEW)
Each control now has attributes:
- Control type (preventive/detective/corrective)
- Info security properties (CIA — Confidentiality, Integrity, Availability)
- Cybersecurity concepts (Identify/Protect/Detect/Respond/Recover — NIST CSF mapping)
- Operational capabilities
- Security domains

### Statement of Applicability (SoA)
Must document which Annex A controls apply, which are excluded, and justification.

### ISO/IEC 27002:2022
Implementation guidance (reference control set, not certifiable).

---

## 4. ISO/IEC 17021-1:2015 — Requirements for Certification Bodies

Full title: "Conformity assessment — Requirements for bodies providing audit and certification of management systems — Part 1: Requirements"

### Key Requirements

**Clause 4 — Principles**: Impartiality, competence, responsibility, openness, confidentiality, responsiveness to complaints, risk-based approach.

**Clause 5 — General requirements**:
- **5.2 Impartiality** — CB must have committee safeguarding impartiality; CB must NOT provide MS consulting or internal audits to client it will certify
- At least **2-year waiting period** for consulting staff to audit a former client (5.2.5)
- Adequate resources and insurance

**Clause 7 — Resource requirements**:
- Competence criteria for auditors, technical experts, decision-makers
- Confidentiality, impartiality agreements
- Use of individual external auditors (held to same standards)
- CB retains responsibility for outsourcing

**Clause 9 — Process requirements**:
- Application, review, audit (Stage 1/2), decision, surveillance, recertification, special audits
- Appeals, complaints
- Suspension, withdrawal, reduction of scope

### Impartiality Threats Identified
- Self-interest (financial dependence)
- Self-review (auditing own work)
- Familiarity (long-term client relationship — **requires rotation**)
- Intimidation
- Trust

### Auditor Rotation
Cannot audit same client more than **6 consecutive years** (specific rules vary by CB/AB).

### Decision-Making Separation
The auditor **cannot make certification decision** (9.5.2). Separate competent person or committee reviews audit report and decides.

---

## 5. Certification Process in Detail

### Stage 1 Audit (Readiness/Documentation Review)

**Purpose** (ISO/IEC 17021-1 Clause 9.3.1.2):
- Review client's MS documented information
- Evaluate site and site-specific conditions
- Review client's understanding of requirements
- Obtain info on scope, sites, processes, applicable legal/reg requirements
- Review resources for Stage 2
- Provide focus for Stage 2 planning
- Evaluate if internal audits and management review are planned/performed
- Assess level of implementation for Stage 2 readiness

**Duration**: ~30% of Stage 2 duration typically; can be on-site or remote.
**Interval**: Stage 2 must occur within ~3-6 months of Stage 1.

### Stage 2 Audit (Certification/Implementation Audit)

**Purpose** (17021-1 Clause 9.3.1.3):
- Evaluate **implementation and effectiveness** of MS
- Conformity with audit criteria
- Monitoring, measuring, reporting, reviewing
- MS capability and performance regarding legal/regulatory/contractual requirements
- Operational control of processes
- Internal auditing and management review
- Management responsibility
- Links between requirements, policy, objectives, legal requirements, responsibilities, competence, operations, procedures, performance data, internal audit findings

### Surveillance Audits

Frequency: **At least annually** (17021-1 Clause 9.6.2.2). First surveillance within 12 months of initial certification.

**Partial scope** — typically 1/3 of MS each year so full MS covered across 3-year cycle. **Must always include**:
- Internal audits and management review
- Review of actions on NCs from previous audit
- Treatment of complaints
- Effectiveness of MS regarding objectives and results
- Progress of planned activities for continual improvement
- Continuing operational control
- Review of any changes
- Use of marks / reference to certification

### Recertification Audit

Every **3 years** before expiry (17021-1 Clause 9.6.3). Full-scope audit.

**Required elements**:
- Effectiveness of MS in entirety in light of changes
- Demonstrated commitment to effectiveness and improvement
- Whether certified MS contributes to organization's policy and objectives
- On-site audit addressing performance over certification period, review of prior surveillance reports

### Transition Audits

When standard is revised (e.g., ISO 27001:2013 → 27001:2022):
- Typically **3 years** from publication to transition all certificates
- Can occur during surveillance or recertification (bundled)
- Or standalone transition audit
- Must audit against new requirements specifically

### Special Audits
- **Scope extension** — add product lines, sites, activities
- **Short-notice / unannounced** — complaints, suspension reviews
- **Following changes** — major ownership, structure, site changes
- **Complaints investigation**

---

## 6. IAF Accreditation and Certification Bodies

### IAF (International Accreditation Forum) MLA

Multilateral Recognition Arrangement — certificate from one IAF member accepted globally.

### Major IAF Accreditation Bodies

| AB | Country |
|----|---------|
| **ANAB** (ANSI National Accreditation Board) | US |
| **UKAS** (United Kingdom Accreditation Service) | UK |
| **DAkkS** (Deutsche Akkreditierungsstelle) | Germany |
| **COFRAC** | France |
| **ACCREDIA** | Italy |
| **JAB / JAS-ANZ** | Japan/Australia-NZ |
| **SCC** | Canada |
| **SAC** | Singapore |
| **CNAS** | China |
| **NABCB** | India |
| **SANAS** | South Africa |
| **RvA** | Netherlands |
| **SWEDAC** | Sweden |
| **INMETRO** | Brazil |

### Certification Bodies (CBs) — Major Players

| CB | Country Origin |
|----|---------------|
| **BSI** | UK (British Standards Institution) |
| **SGS** | Switzerland (largest globally) |
| **DNV** | Norway (formerly Det Norske Veritas) |
| **TÜV SÜD / Rheinland / Nord / Austria** | Germany |
| **DEKRA** | Germany |
| **Intertek** | UK |
| **Bureau Veritas** | France |
| **Lloyd's Register (LRQA)** | UK |
| **NQA** | UK/US |
| **NSF-ISR** | US |
| **Kiwa** | Dutch |
| **Apave** | French |
| **Eurocert** | Greek |
| **Perry Johnson Registrars (PJR)** | US |

### Auditor Certification Schemes

- **IRCA** (International Register of Certificated Auditors) — part of CQI — globally recognized. Grades: Provisional, Auditor, Lead Auditor, Principal Auditor
- **Exemplar Global** — US-based (formerly RABQSA)
- **PECB** — Canadian, strong in ISO 27001 and ISO 22301
- **BSI Training** — internally certified lead auditor courses
- **TÜV schemes** — in-house with wide European recognition

### Typical Lead Auditor Requirements
- Recognized 40-hour lead auditor training course
- Work experience (e.g., 4 years total, 2 in relevant field)
- Audit log (e.g., 4 audits totaling 20 days within preceding 3 years)
- Continuing professional development (CPD)

---

## 7. Integrated Management System (IMS) Audits

### IAF MD 11 — Application of ISO/IEC 17021 for Audits of Integrated Management Systems

- **Combined audit**: Two or more MS audited together
- **Integrated audit**: Audit of an IMS where processes are FULLY integrated
- **Integration reduction factors**: Up to **20% audit time reduction** if integration is high (common policy, objectives, management review, integrated documentation, integrated internal audit program, integrated improvement process)
- Requires demonstration that processes are truly integrated — not just documents stapled together

### Sample Integrated Audit Plan (3-day IMS audit: ISO 9001 + 14001 + 45001)

```
Day 1:
  08:30  Opening meeting (all functions)
  09:00  Top management interview (Clauses 4, 5, 6, 9.3 — all 3 standards)
  10:30  HR / Competence / Training (Clause 7.2 — all 3)
  13:00  Document & records control (Clause 7.5 — all 3)
  14:30  Risk management process (Clause 6.1 — all 3: quality risk + env aspects + OHS hazards)
  16:00  Internal audit & management review (Clause 9.2, 9.3 — all 3)

Day 2:
  08:30  Operations Site Tour (Clause 8 — all 3)
  13:00  Emergency preparedness (14001 8.2 + 45001 8.2)
  14:30  Supplier/contractor control (9001 8.4 + 14001 8.1 + 45001 8.1.4)
  16:00  Worker consultation (45001 5.4 — OHS specific)

Day 3:
  08:30  Monitoring, measurement, calibration (Clause 9.1 — all 3)
  10:00  Legal compliance evaluation (14001 9.1.2 + 45001 9.1.2)
  11:00  Nonconformity & corrective action (Clause 10 — all 3)
  13:00  Team caucus — finding drafting
  15:00  Closing meeting
```

---

## 8. Management System Standards — Detailed Key Features

### ISO 9001:2015 (Quality Management)
- 10 clauses (standard HS structure)
- Process approach and PDCA cycle
- Risk-based thinking replaces "preventive action"
- Customer satisfaction measurement mandatory (9.1.2)
- Continual improvement (10.1-10.3)
- Documented information (replaces documents/records distinction)

**Key audit focus**: Process interactions, customer satisfaction trends, supplier performance evaluation, design control effectiveness, NCR trend analysis, calibration of monitoring resources.

### ISO 14001:2015 (Environmental)
- Context must consider environmental conditions (climate, air quality, water availability)
- **Environmental aspects and impacts** (6.1.2) — with **life cycle perspective**
- **Compliance obligations** (6.1.3) — legal + voluntary requirements
- **Emergency preparedness and response** (8.2)
- **Evaluation of compliance** (9.1.2) — periodic, typically annual

**Key audit focus**: Aspects register completeness and significance, legal register currency, substantive compliance evaluation, emergency drill records, life cycle considerations.

### ISO/IEC 27001:2022 (Information Security)
- 93 controls in 4 themes (see detailed section above)
- 11 new controls in 2022 version
- Statement of Applicability (SoA) mandatory
- Control attributes for filtering/grouping

**Key audit focus**: SoA completeness, risk assessment methodology, cloud services controls (new A.5.23), remote working (new A.6.7), secure coding (new A.8.28), incident response effectiveness, access reviews, crypto key management.

### ISO 45001:2018 (OHS) — Replaced OHSAS 18001:2007
- **Clause 5.4** — Consultation and participation of workers (mandatory at all levels)
- **Clause 6.1.2.1** — Hazard identification (proactive, ongoing, routine + non-routine)
- **Clause 6.1.2.2** — Hierarchy of controls (Elimination > Substitution > Engineering > Administrative > PPE)
- **Clause 8.1.3** — Management of change
- **Clause 8.1.4** — Outsourcing/contractor control

**Key audit focus**: Worker consultation evidence (not just managers), hazard identification methodology (HAZID, HAZOP, JHA), contractor management, incident investigation root cause, PPE as last resort.

### ISO 22301:2019 (Business Continuity)
- **8.2 Business Impact Analysis (BIA)** — RTO/RPO/MTPD/MBCO
- **8.3 Business continuity strategies and solutions**
- **8.4 Business continuity plans and procedures**
- **8.5 Exercise programme** (must exercise, document, improve)

**Key metrics**: RTO (Recovery Time Objective), RPO (Recovery Point Objective), MTPD (Maximum Tolerable Period of Disruption), MBCO (Minimum Business Continuity Objective).

### ISO 37001:2016 (Anti-Bribery Management)
- Due diligence on business associates (4.5, 8.2)
- Gifts, hospitality, donations policy (8.7)
- Financial and non-financial controls (8.3, 8.4)
- Anti-bribery compliance function — independent, reports to top mgmt/board
- Raising concerns (8.9) — whistleblower protection

### ISO 37301:2021 (Compliance Management)
Replaces ISO 19600:2014. First **certifiable** compliance management standard.
- Compliance obligations register (4.5)
- Compliance risk assessment (4.6)
- Compliance culture (5.1.2)
- Compliance function independence (5.3.2)
- Investigative processes (9.1.5)

### ISO 50001:2018 (Energy Management)
- Energy review (6.3)
- Energy baseline (EnB)
- Energy performance indicators (EnPIs)
- Must demonstrate **energy performance improvement** (unique)
- Normalization of EnPIs (for weather, production)
- Measurement & Verification (M&V)

### ISO 55001:2014 (Asset Management)
- **Strategic Asset Management Plan (SAMP)**
- Asset Management Plan(s)
- Asset lifecycle activities
- Outsourced activities (higher emphasis)
- Portfolio of assets

---

## 9. Non-Conformity Management Lifecycle

### NC Classification

**Major Nonconformity** (per IAF MD 26):
- **Absence** of required MS process or documented information
- **Systemic failure** to implement defined requirement
- **Multiple minor** NCs against same requirement indicating systemic issue
- **Breakdown** casting doubt on capability to achieve results
- **Legal/regulatory breach** or safety risk
- Results likely to affect product/service quality for customer

**Minor Nonconformity**:
- Isolated lapse in implementation
- Single instance not meeting requirement
- Does NOT affect MS capability/results significantly

**Observation / Opportunity for Improvement (OFI)**:
- NOT a nonconformity
- Could become NC if not addressed
- Suggested improvements

### NC Report Format (Typical Structure)

1. **Requirement** (standard clause + text)
2. **Evidence** (specific, factual)
3. **Nonconformity statement** (the gap)
4. **Classification** (major/minor)

### Root Cause Analysis

**Required for majors**; **expected for minors**.

Common methods:
- **5 Whys**
- **Fishbone (Ishikawa)** — 6M: Man, Machine, Material, Method, Measurement, Environment
- **Fault Tree Analysis**
- **Pareto**
- **8D** (Eight Disciplines — common in automotive)

### Correction vs Corrective Action (ISO 9000:2015)

- **Correction (3.12.3)** — Immediate fix (patch)
- **Corrective action** — Root cause fix (prevent recurrence)
- **Preventive action** — Removed as separate concept in ISO 9001:2015 (absorbed into risk-based thinking)

### Typical Timelines

**Third-party audits (per IAF MD / CB rules)**:
- **Major NC**: Resolved (correction + CAP accepted) before certification OR within **90 days max**. Many CBs require 30 days for action plan, close-out within 90. Follow-up audit may be required on-site.
- **Minor NC**: Action plan and correction accepted; evidence closure at next surveillance (up to 12 months). Typical: action plan within 30-60 days.
- **Observations/OFIs**: No mandatory response; reviewed next cycle.

---

## 10. Remote Auditing — IAF MD 4:2022

### Use of Information and Communication Technology (ICT) for Auditing

Mandatory document for CBs. Updated post-COVID.

**Definitions**:
- **ICT**: Tech for audits when not co-located (video, phone, screen sharing, secure file transfer, drones, IoT, etc.)
- **Remote audit**: Audit performed from location different from auditee
- **Combined/hybrid audit**: Mix of on-site and remote

**Risk assessment required before ICT use**:
- Confidentiality / data protection (GDPR, HIPAA)
- Technology reliability (bandwidth, access to systems, live streaming quality)
- Auditee premises (can remote observe operational areas? Cameras, drones for tours?)
- Interaction quality (ability to interview workers, observe body language)
- Site-specific conditions (some activities require physical presence)

**Restrictions**:
- Initial certification Stage 2 — typically limited ICT use
- Annex SL Clause 8 (operations) often requires physical presence
- Safety-critical activities require on-site
- CB must have policy and criteria for ICT audits
- Audit report must indicate ICT use and extent

**Hybrid models common post-2021**:
- Document review + top management interviews remote
- Site tours + operations observation on-site
- Technical specialists on-site; generalist auditor remote
- Multi-site: HQ on-site, remote sites via ICT

---

## 11. Audit Evidence Sampling in ISO 19011

**Annex B.6 recognizes**:

**Judgment-based sampling**:
- Based on auditor's knowledge of auditee
- Risk-based (highest-risk areas, new processes, past NCs)
- **Stratified** (subgroups)
- Rationale must be documented
- Most common in MS auditing

**Statistical sampling**:
- Attribute-based (conform/don't) or variable-based (measurable)
- Requires known population, defined confidence level (typically 95%)
- Uses ISO 2859 / ISO 3951 for acceptance sampling
- Less common in MS audits

### IAF MD 1 — Multi-Site Sampling
Sample size for multi-site certification:
- √(remote sites) rounded up for **initial**
- √(remote sites) × 0.6 or 0.8 for **surveillance**

### Key Differences from Financial Audit Sampling
- MS audits use smaller samples (hours, not weeks); judgment dominates
- Goal: find evidence MS is working, NOT detect material misstatement
- Purposive sampling accepted
- "Sample size appropriate if it supports audit conclusion"

---

## 12. Audit Program Manager Role

**Responsibilities** (ISO 19011 Clauses 5.1, 5.4):
- Establishing audit program objectives (aligned with org strategic direction)
- Determining and evaluating risks/opportunities of audit program
- Establishing extent (frequency, duration, number of audits, locations, scope)
- Ensuring resources
- Ensuring audit records maintained
- Monitoring, reviewing, improving audit program
- Selecting, evaluating, managing auditors
- Communicating with top management

**Competence** (Clause 5.4.2):
- Audit principles, procedures, methods
- MS standards and reference documents
- Information on auditee (org context, legal requirements)
- Applicable legal and contractual requirements
- Risk management
- Financial/management aspects

### Metrics and KPIs for Audit Program
- Audit coverage (% of processes/functions/sites audited per cycle)
- On-time audit completion rate
- NCs raised per audit
- NC closure time (avg days major, minor)
- Recurring NCs (root cause effectiveness indicator)
- Auditor competence evaluations
- Auditee satisfaction scores
- Management review actions from audit findings
- % of audit findings leading to improvements
- Cost per audit / auditor-day utilization
- Audit program objective achievement

---

## 13. ISO/IEC 17025:2017 — Testing and Calibration Laboratories

Not a management system standard — **conformity assessment** standard for laboratories. **Accreditation** (not certification) granted by ABs per ISO/IEC 17011.

**Structure** (differs from HS):
- Clause 4 — General requirements (impartiality, confidentiality)
- Clause 5 — Structural requirements
- Clause 6 — Resource requirements (personnel, facilities, equipment, metrological traceability)
- Clause 7 — Process requirements (tender review, method selection/verification, sampling, technical records, measurement uncertainty, validity of results, reporting)
- Clause 8 — Management system requirements (Option A or B — Option B if ISO 9001 already implemented)

**Key audit differences**:
- **Technical audits** by AB assessors including technical experts (metrologists)
- **Proficiency testing (PT)** results reviewed — inter-laboratory comparisons
- **Measurement uncertainty** calculations verified
- **Metrological traceability** chain verified to SI units via NMIs (NIST in US, NPL in UK)
- **Method validation** records
- **Decision rules** for conformity statements (including measurement uncertainty)
- **Scope of accreditation** specific (tests, methods, ranges, uncertainty)

---

## 14. GHG Verification — ISO 14064 / ISAE 3410

### ISO 14064 Series
- **ISO 14064-1:2018** — GHG inventories at organization level (Scope 1, 2, 3 emissions quantification)
- **ISO 14064-2:2019** — GHG projects (reductions/removals)
- **ISO 14064-3:2019** — Validation and verification (how to audit GHG assertions)

### ISO 14065:2020
Requirements for bodies performing validation/verification (like 17021 for GHG verifiers).

### ISO 14066:2023
Competence requirements for GHG validation/verification teams.

### GHG Protocol (WRI/WBCSD) — De Facto Implementation Standard
- **Scope 1** — Direct emissions (owned/controlled: vehicles, boilers, process emissions)
- **Scope 2** — Indirect from purchased energy (electricity, heat, cooling, steam)
- **Scope 3** — All other indirect (value chain): 15 categories including purchased goods/services, capital goods, fuel-energy, upstream transport, waste, business travel, employee commuting, downstream transport, product use, end-of-life, investments

### Assurance Levels (ISO 14064-3)
- **Reasonable assurance** — high level ("no material misstatement")
- **Limited assurance** — moderate level ("nothing came to our attention")

---

## 15. ISO 19011 vs ISAE 3000

### ISAE 3000 — International Standard on Assurance Engagements Other Than Audits or Reviews of Historical Financial Information

Issued by **IAASB** (part of IFAC). Applies to assurance on:
- Sustainability reports (GRI, SASB, CSRD/ESRS)
- Internal control reports
- Compliance with regulations
- Non-financial KPIs
- Privacy programs
- Human rights reports

**Five elements required**:
1. Three-party relationship (practitioner, responsible party, intended users)
2. Underlying subject matter
3. Criteria
4. Evidence
5. Written report

### When Each Applies

| Aspect | ISO 19011 | ISAE 3000 |
|--------|-----------|-----------|
| Issuer | ISO | IAASB (IFAC) |
| Nature | Guidance | Standard (must be followed by signatory accountants) |
| Practitioner | MS auditor (any qualified) | Professional accountant |
| Independence | Required but scheme-specific | Strict IESBA Code of Ethics |
| Subject | Management systems audits | Broader non-financial assurance |
| Output | Audit report with conformity/NC | Assurance opinion |
| Certifiable? | Yes (via ISO 17021 CBs) | No — issues assurance, not certification |
| Evidence standards | Professional judgment | Formalized, similar to ISA |
| Materiality concept | Not central | Central |
| Sampling | Judgmental primarily | Statistical-heavy |

### Hybrid/Overlapping
- Sustainability report assurance often uses ISAE 3000 (+ ISAE 3410 for GHG)
- Some CBs provide ISO MS certification AND ISAE 3000 assurance (Big 4 for sustainability)
- **AA1000AS v3** (2020) — alternative to ISAE 3000 for sustainability; emphasis on stakeholder inclusivity, materiality, responsiveness, impact

---

## 16. Enhanced Software Feature Requirements

Adding to original ISO 19011 feature requirements:

| ISO 19011 / Related Requirement | Enhanced Software Feature |
|--------------------------------|--------------------------|
| Annex SL Harmonized Structure | Standard-agnostic template engine supporting all HS-compliant ISO standards |
| ISO 27001:2022 93 Controls | SoA manager with 4 themes (Org/People/Physical/Technological), 11 new control flags, control attributes (type/CIA/NIST CSF/capabilities/domains) |
| Integrated Management System | Combined/integrated audit support (audit once against multiple standards), 20% time reduction tracking |
| Certification Process | Stage 1/Stage 2 tracking, surveillance scheduling (annual), recertification (3-year), transition audit management |
| IAF MD 1 Multi-Site | Sample size calculator for multi-site certification |
| IAF MD 4 Remote Audits | Remote audit risk assessment, ICT use documentation |
| NC Management | Major/Minor/Observation classification, Correction vs Corrective Action tracking, effectiveness verification |
| Audit Program Manager | Audit program KPI dashboard (coverage, closure time, recurring NCs) |
| GHG Verification (ISO 14064) | Scope 1/2/3 emissions tracking, verification documentation |
| ISO 17025 Labs | Method validation records, measurement uncertainty, metrological traceability |
| ISAE 3000 Hybrid | Option to generate ISAE 3000-style assurance reports for sustainability |
