# COBIT 2019 — Deep Dive Study

## Control Objectives for Information and Related Technologies
### ISACA

---

## 1. Foundation

| Attribute | Detail |
|-----------|--------|
| **Full Name** | COBIT 2019 — A Business Framework for the Governance and Management of Enterprise IT |
| **Issuing Body** | ISACA (Information Systems Audit and Control Association) |
| **Current Version** | COBIT 2019 (released December 2018) |
| **Previous Versions** | COBIT 5 (2012), COBIT 4.1 (2007), COBIT 3 (2000) |
| **Usage** | De facto standard for IT governance and IT audit globally |
| **Certifications** | CISA, CGEIT, CRISC |

---

## 2. Who Uses COBIT

- **IT Auditors**: CISA holders use COBIT as audit framework
- **IT Governance Professionals**: CIOs, IT directors, enterprise architects
- **Risk & Compliance Officers**: IT risk management, SOX IT controls
- **Internal Auditors**: Assessing IT controls and IT risk
- **Industries**: Financial services, healthcare, government, manufacturing, telecom, energy

---

## 3. Six Core Principles

1. **Meeting Stakeholder Needs** — Governance creates value for all stakeholders
2. **Covering the Enterprise End-to-End** — IT governance is enterprise-wide (incl. cloud, third-party)
3. **Applying a Single, Integrated Framework** — Unified IT governance under one model
4. **Enabling a Holistic Approach** — All enablers: people, processes, structures, technology, culture
5. **Separating Governance from Management** — Governance = Board strategy; Management = CIO execution
6. **Tailoring for Enterprise Context** — Adapt to size, industry, risk tolerance, maturity

---

## 4. Governance and Management Objectives (40 Total)

### Governance Domain: EDM (Evaluate, Direct, Monitor) — Board/Executive
| Code | Objective |
|------|-----------|
| EDM01 | Ensure Governance Framework Setting and Maintenance |
| EDM02 | Ensure Benefits Delivery |
| EDM03 | Ensure Risk Optimization |
| EDM04 | Ensure Resource Optimization |
| EDM05 | Ensure Stakeholder Transparency |

### Management Domain 1: APO (Align, Plan, Organize) — Strategy
| Code | Objective |
|------|-----------|
| APO01 | Manage the IT Management Framework |
| APO02 | Manage Strategy |
| APO03 | Manage Enterprise Architecture |
| APO04 | Manage Innovation |
| APO05 | Manage Portfolio |
| APO06 | Manage Budget and Costs |
| APO07 | Manage Human Resources |
| APO08 | Manage Relationships |
| APO09 | Manage Service Agreements |
| APO10 | Manage Vendors |
| APO11 | Manage Quality |
| APO12 | Manage Risk |
| APO13 | Manage Security |

### Management Domain 2: BAI (Build, Acquire, Implement) — Projects
| Code | Objective |
|------|-----------|
| BAI01 | Manage Programmes and Projects |
| BAI02 | Manage Requirements Definition |
| BAI03 | Manage Solutions Identification and Build |
| BAI04 | Manage Availability and Capacity |
| BAI05 | Manage Organizational Change Enablement |
| BAI06 | Manage IT Changes |
| BAI07 | Manage Change Acceptance and Transitioning |
| BAI08 | Manage Knowledge |
| BAI09 | Manage Assets |
| BAI10 | Manage Configuration |
| BAI11 | Manage Projects |

### Management Domain 3: DSS (Deliver, Service, Support) — Operations
| Code | Objective |
|------|-----------|
| DSS01 | Manage Operations |
| DSS02 | Manage Service Requests and Incidents |
| DSS03 | Manage Problems |
| DSS04 | Manage Continuity |
| DSS05 | Manage Security Services |
| DSS06 | Manage Business Process Controls |

### Management Domain 4: MEA (Monitor, Evaluate, Assess) — Assurance
| Code | Objective |
|------|-----------|
| MEA01 | Monitor, Evaluate and Assess Performance and Conformance |
| MEA02 | Monitor, Evaluate and Assess System of Internal Controls |
| MEA03 | Monitor, Evaluate and Assess Compliance with External Requirements |

---

## 5. Process Capability Model (Maturity Levels 0-5)

| Level | Name | Description |
|-------|------|-------------|
| **0** | Non-existent | No recognized process; ad-hoc, reactive |
| **1** | Performed (Initial) | Process executed but undocumented; people-dependent |
| **2** | Managed | Planned, documented, managed; metrics tracked; consistent |
| **3** | Defined | Standardized across organization; process improvement |
| **4** | Quantitatively Managed | Data-driven; automation; SLAs monitored; trends analyzed |
| **5** | Optimized | Continuously improved; innovation; predictive |

**Audit Use**: Auditors evaluate each process against capability model; identify gaps between current and target; recommend improvements.

---

## 6. IT Audit Process Using COBIT

### Phase 1: Risk-Based Planning
- Assess IT risk profile using COBIT risk categories
- Select objectives to audit based on risk
- Determine scope: systems, processes, controls
- Identify audit criteria: COBIT objectives, ITIL, ISO 27001, SOX ITGC

### Phase 2: Control Assessment
- Map business processes to COBIT management objectives
- Identify control objectives (what should be in place)
- Assess actual controls: documented? implemented? effective?
- Test control execution: sample transactions, review workflows
- Document: Control Design Gap, Control Operating Gap

### Phase 3: Maturity Assessment
- Evaluate capability for each audited objective (levels 0-5)
- Current state vs target state
- Capability gap analysis

### Phase 4: Risk Assessment
- For each gap: likelihood of control failure x impact
- Prioritize remediation by risk level

### Phase 5: Reporting
- Findings organized by COBIT domain
- Control design gaps and operating gaps
- Maturity assessment with improvement roadmap
- Recommendations with timeline and owner

### Phase 6: Follow-Up
- Track management action plans
- Re-audit to verify implementation
- Trend analysis: improvement over time

---

## 7. Seven Enablers

1. **Processes**: Structured activities/workflows achieving objectives
2. **Organizational Structures**: Roles, responsibilities, authority levels
3. **Culture, Ethics & Behavior**: Values and norms supporting governance
4. **Information**: Data supporting decision-making (risk register, KPIs)
5. **Services, Infrastructure & Applications**: Technology resources
6. **People, Skills & Competencies**: Training, certifications, competency models
7. **Policies & Procedures**: Documented guidelines

---

## 8. COBIT Mapping to Other Frameworks

| Framework | Relationship | Example Mapping |
|-----------|-------------|-----------------|
| **NIST CSF** | COBIT broader; NIST security-focused | NIST Identify/Protect/Detect/Respond/Recover → COBIT DSS/MEA |
| **ITIL** | COBIT = governance; ITIL = operational practices | ITIL Incident Management → COBIT DSS02 |
| **ISO 27001** | COBIT = governance structure; ISO 27001 = security controls | COBIT APO13 → ISO 27001 controls |
| **SOX** | COBIT is SOX IT audit framework of choice | COBIT DSS06 → SOX segregation of duties |
| **COSO** | COSO = overall internal controls; COBIT = IT controls | COBIT extends COSO to IT operations |

### SOX IT General Controls (ITGC) mapped to COBIT
| SOX ITGC | COBIT Objective |
|----------|----------------|
| Change Management | BAI06 (Manage IT Changes) |
| Access Control | DSS05 (Manage Security Services), APO07 |
| Segregation of Duties | DSS06 (Manage Business Process Controls) |
| Monitoring & Reconciliation | MEA01, DSS02 |
| System Configuration | BAI10 (Manage Configuration) |

---

## 9. CISA Certification

| Attribute | Detail |
|-----------|--------|
| **Issuing Body** | ISACA |
| **Exam** | 200 questions, 4 hours, 5 domains |
| **Experience** | 5 years (4 with degree) |
| **Recertification** | Every 3 years; 120 CPE hours |
| **CPE** | 40 hrs/year minimum |

**CISA Exam Domains (2024)**:
1. IT Risk Management (20%)
2. IS Governance & Management (15%)
3. IS Acquisition, Development & Implementation (20%)
4. IS Operations, Service Delivery & Support (20%)
5. Monitoring, Evaluating & Assessing IS Performance (25%)

---

## 10. Key Terminology

| Term | Definition |
|------|-----------|
| **Governance** | Board/Executive direction-setting and accountability |
| **Management** | CIO/IT leadership execution and operational control |
| **Enabler** | Resource supporting an objective (people, process, tech, data, structure, culture) |
| **Objective** | Governance or management outcome creating stakeholder value |
| **Control** | Activity ensuring process operates as designed; addresses risk |
| **Control Gap** | Design Gap = control missing; Operating Gap = control not followed |
| **Capability Level** | Process maturity (0-5) |
| **Conformance** | Process meets control objectives and standards |
| **Performance** | Actual outcomes measured against KPIs/KRIs |
| **ITGC** | IT General Controls — change management, access, SOD, config |

---

## 11. Software Feature Requirements (Derived from COBIT)

| COBIT Requirement | Required Software Feature |
|-------------------|--------------------------|
| 40 objectives | IT governance objective navigator by domain (EDM/APO/BAI/DSS/MEA) |
| Capability model | Process capability assessment (0-5), gap analysis, maturity roadmap |
| Control assessment | Control design/operating gap identification and tracking |
| IT risk | Risk register mapped to COBIT objectives, mitigation tracking |
| ITGC testing | Change management, access control, SOD testing templates |
| Framework mapping | Cross-reference COBIT to NIST, ITIL, ISO 27001, SOX |
| CISA support | CPE tracking (40hrs/yr), reference library |
| Audit reporting | Findings by domain, maturity dashboard, remediation tracking |
