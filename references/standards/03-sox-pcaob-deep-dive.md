# SOX / PCAOB — Deep Dive Study

## Sarbanes-Oxley Act & Public Company Accounting Oversight Board

---

## 1. Foundation

| Attribute | Detail |
|-----------|--------|
| **Full Name** | Sarbanes-Oxley Act of 2002 (also "Sarbox" or "SOX") |
| **Enacted** | July 30, 2002 |
| **Why** | Response to Enron ($63.4B collapse), WorldCom ($11B fraud), Arthur Andersen destruction |
| **Regulatory Body** | Securities and Exchange Commission (SEC) |
| **Standards Body** | Public Company Accounting Oversight Board (PCAOB) |
| **Applies To** | All US public companies (SEC registrants) and their auditors |
| **PCAOB Staff** | ~900 people (standards setters, inspectors, investigators) |

---

## 2. Key SOX Sections

### Section 302 — CEO/CFO Certifications
- CEO and CFO must personally certify quarterly (10-Q) and annual (10-K) reports
- Certify: report reviewed, no untrue statements, financial statements fairly represent condition
- Must evaluate and disclose effectiveness of disclosure controls
- **Penalties**: Civil up to $5M; Criminal up to $1M fine + 20 years imprisonment

### Section 404 — ICFR Assessment (The Big One)
- Management must assess effectiveness of Internal Controls over Financial Reporting (ICFR)
- Must document all processes affecting financial reporting
- External auditor must independently audit management's ICFR assessment
- Applies to accelerated and large accelerated filers

### Section 301 — Audit Committee Requirements
- Audit committee must be independent
- Must have at least one financial expert
- Establish procedures for receiving accounting/auditing complaints
- Whistleblower protection (anonymous submission, no retaliation)
- Direct authority over external auditor

### Section 802 — Document Retention
- Audit work papers must be retained for **7 years minimum**
- Destruction with intent to obstruct justice is a felony
- **Penalties**: Up to $250K fine and/or 10 years imprisonment

### Section 906 — Criminal Penalties
- Knowingly certifying false financial statements: up to $5M + 20 years
- Willfully certifying false statements: up to $1M + 20 years

---

## 3. PCAOB Auditing Standards (AS)

### AS 1001 — Responsibilities and Functions of the Independent Auditor
- Provide reasonable assurance (high confidence, not absolute certainty)
- Plan and perform audit to detect material misstatements
- Inherent limitations: judgment, sampling vs population, potential for collusion

### AS 2101 — Audit Planning and Supervision
**Planning Components**:
- **Risk Assessment**: Understand entity, industry, regulatory environment
- **Materiality**: Typically 5% of pre-tax income; performance materiality 50-75% of materiality
- **Significant Accounts**: High risk, high volume, complex, manual entries, estimates
- **Relevant Assertions**: Existence, Completeness, Valuation, Rights & Obligations, Presentation
- **Audit Strategy**: Approach, ICFR scope, resources, specialists, internal audit use

### AS 2201 — Audit of ICFR (The Most Complex Standard)
**Top-Down Approach**:
1. Start with financial statements and disclosures
2. Identify significant accounts and relevant assertions
3. Understand controls over those assertions
4. Test controls (design and operating effectiveness)

**Entity-Level Controls**:
- Control environment (tone at top)
- Risk assessment processes
- Centralized processing and controls
- Period-end financial reporting process
- Monitoring controls
- Audit committee oversight

**Process-Level Controls**:
- Segregation of duties
- Preventive controls (stop error before occurrence)
- Detective controls (find error after occurrence)
- Manual controls (performed by people)
- Automated controls (built into systems)

### AS 2301 — Auditor's Responses to Risks
- **Inherent risk**: Susceptibility to misstatement without controls
- **Control risk**: Ineffectiveness of controls
- **Detection risk**: Auditor not detecting misstatement
- **Significant Risks**: Higher inherent risk requiring more extensive procedures

### AS 2401 — Consideration of Fraud
**Fraud Triangle**:
- **Incentives/Pressures**: Financial targets, compensation, loan covenants
- **Opportunities**: Weak controls, complex transactions, management override
- **Attitudes/Rationalization**: Weak ethics, aggressive reporting, arrogance

### AS 3101 — Auditor's Report
**Opinion Types**:
- **Unqualified (Clean)**: ICFR is effective
- **Adverse**: ICFR is NOT effective (material weakness exists)
- **Qualified**: Limited scope or other issues
- **Disclaimer**: Cannot provide opinion

---

## 4. COSO Framework (Internal Control — Integrated Framework 2013)

The **de facto standard** for SOX 404 ICFR assessments.

**Developed by**: AICPA, AAA, FEI, IIA, IMA

### 5 Components

#### 1. Control Environment (Foundation)
- Tone at the top — board/management commitment to integrity
- Code of conduct and ethics policies
- HR policies (hiring, promotion, compensation)
- Whistleblower mechanisms
- Board oversight and independence
- Audit committee charter

#### 2. Risk Assessment
- Entity-level risks: strategic changes, regulatory, technology, organizational
- Transaction-level risks: fraud, authorization, recording, valuation, completeness
- Risk identification methods: brainstorming, walkthroughs, interviews, prior misstatements
- Risk analysis: likelihood x impact x velocity x persistence

#### 3. Control Activities
| Type | Description | Examples |
|------|-------------|---------|
| **Preventive** | Stop error before occurrence | Authorization limits, access controls, segregation of duties |
| **Detective** | Find error after occurrence | Reconciliations, exception reports, reviews |
| **Corrective** | Address detected errors | Investigation procedures, adjustment processes |
| **Manual** | Performed by people | Supervisory reviews, manual approvals |
| **Automated** | Built into systems | System validations, edit checks, auto-calculations |

**Most Important Control**: Segregation of Duties
- Authorize transactions
- Record transactions
- Reconcile/review
- Custody of assets
- No single person controls entire transaction

#### 4. Information and Communication
- Chart of accounts design, system configuration, access controls
- Vertical (up/down), horizontal (across), external communication
- Whistleblower channels, process documentation, training

#### 5. Monitoring
- **Ongoing**: Management reviews, budget vs actual, reconciliation reviews
- **Separate Evaluations**: Internal audit, control assessments, self-assessments
- **Remediation**: Investigation, root cause, corrective action, follow-up

### 17 COSO Principles (mapped to 5 components)
1-5: Control Environment (integrity, Board oversight, structure, competence, accountability)
6-9: Risk Assessment (objectives, risk identification, fraud risk, change assessment)
10-12: Control Activities (select controls, technology controls, deploy through policies)
13-15: Information & Communication (relevant information, internal communication, external communication)
16-17: Monitoring (ongoing/separate evaluations, communicate deficiencies)

---

## 5. Deficiency Classification

| Classification | Severity | Likelihood | Magnitude | Reporting | Example |
|---------------|----------|------------|-----------|-----------|---------|
| **Deficiency** | Minor | Remote | Inconsequential | Not separately disclosed | Single control failure, mitigated by compensating control |
| **Significant Deficiency** | Moderate | More than remote | More than inconsequential | Disclosed in ICFR assessment | Weak review process, inadequate estimate controls |
| **Material Weakness** | Major | Remote or greater | Material to financial statements | Disclosed; adverse audit opinion | No AP reconciliation, broken close process, absent key control |

### How Deficiencies Aggregate
- Multiple individual deficiencies can **aggregate** to a significant deficiency or material weakness
- Even if each deficiency alone is minor, their combined effect may be material
- Auditor must evaluate "individually and in aggregate"

---

## 6. Control Testing

### Walkthrough
- Trace single transaction from inception to completion
- Follow through all systems, people, and controls
- Identify all control points
- Typically one walkthrough per significant process
- Documentation: process flowchart with control points

### Test of Design (TOD)
- **Purpose**: Verify control CAN prevent/detect misstatement as designed
- **Procedures**: Inquiry, observation, inspection of configs, review documentation
- **Sample size**: 1-2 transactions typically
- **Timing**: Can occur at any point during year
- **Conclusion**: Does control design address relevant assertion?

### Test of Operating Effectiveness (TOE)
- **Purpose**: Verify control OPERATED effectively throughout the period
- **Procedures**: Inspection, observation, inquiry + evidence, recalculation, reperformance
- **Sample sizes**:
  - Automated controls: 1-5 items (consistent operation)
  - Manual controls: 10-30+ items (depends on frequency, risk)
- **Timing**: Must occur during fiscal year
- **Factors affecting sample size**: Control frequency, risk level, prior results, population size

### Key Control Identification
A "key control" addresses material risk — if it fails, material misstatement could occur:
- Addresses significant assertion
- Significant account or disclosure
- High transaction volume
- Complex judgment or calculation
- Key controls: ALWAYS tested
- Non-key controls: may not require detailed TOE

---

## 7. SOC Reports

| Report | Purpose | Audience | Content |
|--------|---------|----------|---------|
| **SOC 1 Type I** | Controls exist and are designed | Client's auditor | Point-in-time assessment |
| **SOC 1 Type II** | Controls designed AND operating effectively | Client's auditor | Period-of-time (6+ months) |
| **SOC 2** | Trust Services Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy) | Prospective customers | Detailed control assessment |
| **SOC 3** | High-level assurance | General public | Summary for marketing |

### SOC Relationship to SOX
- Service organization controls may be critical to client's ICFR
- SOC 1 provides evidence of controls at service organizations (payroll processors, cloud providers, etc.)
- Client's auditor may rely on SOC report to reduce testing

---

## 8. Relevant Assertions (5)

| Assertion | Meaning | Example (Accounts Receivable) |
|-----------|---------|-------------------------------|
| **Existence/Occurrence** | Asset/liability exists; transaction occurred | Recorded receivables represent valid sales |
| **Completeness** | All transactions recorded | All shipments recorded as receivables |
| **Valuation/Allocation** | Amounts are appropriate | Allowance for uncollectibles is reasonable |
| **Rights & Obligations** | Organization has rights/obligations | Organization has legal right to collect |
| **Presentation & Disclosure** | Items properly presented and disclosed | Disclosed per GAAP requirements |

---

## 9. Key Terminology

| Term | Definition |
|------|-----------|
| **ICFR** | Internal Controls over Financial Reporting |
| **Material Weakness** | Reasonable possibility of material misstatement not prevented/detected |
| **Significant Deficiency** | Weakness warranting attention, less severe than MW |
| **TOD** | Test of Design — can control prevent/detect? |
| **TOE** | Test of Operating Effectiveness — did control operate throughout period? |
| **Walkthrough** | Tracing single transaction end-to-end |
| **Key Control** | Control addressing material risk; always tested |
| **Compensating Control** | Alternative control mitigating risk if primary fails |
| **Management Override** | When management bypasses controls (highest risk) |
| **Relevant Assertion** | Transaction/account characteristic affecting financial statements |
| **Significant Account** | Account with higher risk, complexity, or materiality |
| **Segregation of Duties** | No single person authorizes, records, reconciles, and has custody |
| **Period-End Close** | Processes to record adjustments, reconcile, consolidate, prepare statements |
| **Fraud Triangle** | Incentive + Opportunity + Rationalization |
| **Reasonable Assurance** | High confidence but not absolute certainty |
| **Top-Down Approach** | Start with financials, identify risks, test relevant controls |
| **ITGC** | IT General Controls — change management, access, segregation, config |

---

## 10. Relationship to GAGAS and IIA

| Aspect | GAGAS | SOX/PCAOB | IIA GIAS 2024 |
|--------|-------|-----------|----------|
| **Applies to** | Government entities | Public companies | All sectors |
| **Control focus** | All controls (operational, compliance, financial) | ICFR only | Risk management, control, governance |
| **Independence** | Organizational independence | Professional independence | Functional independence |
| **Reporting** | Single report (compliance + controls) | Separate reports (financial + ICFR) | Internal reports to Board |
| **CPE** | 80 hrs/2-yr | Per profession | 40 hrs/yr (CIA) |
| **Emphasis** | Compliance with laws + operational effectiveness | Financial statement reliability + ICFR | Risk-based assurance |
| **Standards** | Yellow Book (GAO) | PCAOB AS | IIA Standards |
| **Findings** | 4 elements (§6.39) | Deficiency/SD/MW classification | CCCE + Recommendation |

---

## 11. Software Feature Requirements (Derived from SOX/PCAOB)

| SOX Requirement | Required Software Feature |
|----------------|--------------------------|
| Section 404 ICFR | Control library, risk-control mapping, design documentation |
| Control testing | TOD/TOE workflows, sample selection, evidence management |
| Deficiency classification | Three-tier classification (Deficiency/SD/MW), aggregation analysis |
| Walkthrough documentation | Process flowchart builder with control point identification |
| COSO alignment | 5-component control assessment, 17-principle evaluation |
| SOC reports | SOC report repository, third-party control reliance tracking |
| Section 302 | CEO/CFO certification tracking, assertion documentation |
| Section 301 | Audit committee meeting tracking, whistleblower log |
| Section 802 | 7-year document retention, archive/retrieval system |
| Assertions | 5-assertion mapping per significant account |
| ITGC | Change management testing, access control testing, SOD testing |
| Fraud risk | Fraud risk assessment worksheets, management inquiry templates |
| Audit opinion | Opinion determination workflow, deficiency summary reports |
