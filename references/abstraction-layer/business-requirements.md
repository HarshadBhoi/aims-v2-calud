# Business Requirements — Standards Abstraction Layer

Derived from thorough study of GAGAS, IIA GIAS 2024, SOX/PCAOB, ISO 19011, COBIT, ISSAI, and regional/industry standards.

---

## Core Insight

After studying all standards in depth, the audit process has a **universal structure** with **standard-specific variations**:

```
Universal:  Plan → Execute → Document → Find Issues → Recommend → Get Response → Report → Follow Up
Variable:   What to plan | How to document | What elements in a finding | What the report looks like
```

The abstraction layer must capture this universal flow while allowing each standard to configure the specifics.

---

## 1. Standard Pack Configuration Requirements

Each standard pack MUST define:

### 1.1 Metadata
- Standard code, name, version, issuing body, reference URL
- Applicable sectors (government, private, all)
- Applicable geographies (US, EU, global)

### 1.2 Terminology Map (Required — 25+ Terms)
Every label in the UI must come from the standard pack. Based on crosswalk analysis:

| Concept | Must Be Configurable | Example Variations |
|---------|---------------------|-------------------|
| Engagement | Yes | "Engagement" / "Internal Audit Engagement" / "Audit" / "Assessment" |
| Entity being audited | Yes | "Auditee" / "Engagement Client" / "Registrant" / "Organization" |
| Lead auditor | Yes | "Auditor-in-Charge" / "Engagement Supervisor" / "Lead Auditor" / "Audit Team Leader" |
| Head of audit | Yes | "Audit Director" / "Chief Audit Executive" / "Audit Partner" / "Auditor General" |
| QA reviewer | Yes | "EQR Reviewer" / "QAIP Reviewer" / "Concurring Partner" / "QA Reviewer" |
| Workpapers | Yes | "Workpapers" / "Working Papers" / "Audit Documentation" / "Audit Evidence" |
| Issue found | Yes | "Finding" / "Observation" / "Control Deficiency" / "Nonconformity" |
| Suggested fix | Yes | "Recommendation" / "Corrective Action Request" / "Remediation Plan" / "Management Action Plan" |
| Auditee reply | Yes | "Management Response" / "Corrective Action Plan" / "Remediation Plan" / "Management Comments" |
| Fix tracking | Yes | "CAP" / "Follow-Up" / "Remediation Tracking" / "Corrective Action" |

### 1.3 Engagement Types
Each standard defines different types. The engine must support a configurable list:
- GAGAS: Financial, Performance, Attestation, Review, Investigation
- IIA: Assurance, Consulting, Combined, Follow-Up
- SOX: Integrated Audit, Financial Statement Only, ICFR Only, SOC
- ISO: First-Party (Internal), Second-Party (Supplier), Third-Party (Certification)
- COBIT: IT Audit, Maturity Assessment, Compliance Check

### 1.4 Finding Elements (Variable 3-6 Elements)
**Critical requirement**: The finding form must render dynamically based on standard.

| Standard | Elements | Names |
|----------|----------|-------|
| GAGAS | 4 | Criteria, Condition, Cause, Effect |
| IIA GIAS 2024 | 5 | Criteria, Condition, Root Cause, Risk/Impact, Recommendation |
| SOX/PCAOB | 3-6 | Control Description, Deficiency, Severity, Impact, Compensating Controls, Remediation |
| ISO 19011 | 3 | Audit Criteria, Nonconformity Evidence, Root Cause |
| COBIT | 4 | Process, Control Gap, Root Cause, Impact |

**Implementation**: Array of `FindingElementDefinition` in standard pack. Form renders dynamically.

### 1.5 Finding Classification (Variable Scales)
| Standard | Classifications |
|----------|----------------|
| GAGAS | Material Weakness, Significant Deficiency, Deficiency, Observation |
| IIA | Critical, Major, Minor, Advisory |
| SOX | Material Weakness, Significant Deficiency, Deficiency |
| ISO | Major Nonconformity, Minor Nonconformity, Observation, OFI, Conformity |
| COBIT | Critical Control Gap, Significant Control Gap, Control Gap, Improvement |

**Implementation**: Array of `{ code, label, color, description }` in standard pack.

### 1.6 Report Structure
Each standard requires different sections. The report engine reads section definitions from the pack.

**Universal sections** (all standards): Title, Scope, Findings, Recommendations, Management Response
**Standard-specific sections**: GAGAS compliance statement (GAGAS only), Audit opinion (SOX only), Conformance statement (IIA only), Conformity findings (ISO only)

### 1.7 QA Checklists
Each standard has its own quality control requirements:
- GAGAS: 60+ QA items per §5.01
- IIA: QAIP assessment against all 1000/2000 standards
- SOX: Firm QC policies + PCAOB inspection items
- ISO: Audit programme management assessment

### 1.8 Independence Requirements
Form varies by standard:
- GAGAS: Detailed declaration (personal, organizational, external, non-audit services)
- IIA: Objectivity assessment (individual + organizational)
- SOX: Independence confirmation + partner rotation
- ISO: Impartiality declaration (simpler)

### 1.9 CPE Rules
| Standard | Hours | Cycle | Specific Topics |
|----------|-------|-------|-----------------|
| GAGAS | 80 | 2-year | 24 govt; 20/yr min |
| IIA (CIA) | 40 | Annual | Relevant to IA |
| CISA | 40 (120/3yr) | 3-year | IT audit |
| ISO 19011 | 40-80 | 3-year | Standard-specific |

**Implementation**: CPE validation rules per standard. One auditor's record validated against ALL applicable standards simultaneously.

### 1.10 Approval Workflows
Different steps per standard:
- GAGAS Report: AIC → Supervisor → QA → Director → EQR → Director sign-off (5-6 steps)
- IIA Report: Auditor → Supervisor → CAE (3 steps)
- SOX ICFR: Auditor → Manager → Partner → Concurring Partner (4 steps)
- ISO Report: Lead Auditor → Programme Manager (2 steps)

---

## 2. Crosswalk Engine Requirements

### 2.1 Many-to-Many Requirement Mapping
- Each standard requirement can map to multiple requirements in other standards
- Mapping types: Equivalent, Partial, Related, No Equivalent
- Bi-directional navigation
- Confidence level (curated vs suggested)

### 2.2 "Test Once, Comply Many" Features
- When a control is tested against one standard, show which other standards it satisfies
- Coverage dashboard: "This engagement satisfies X% of Standard A, Y% of Standard B"
- Gap analysis: requirements in Standard B not covered by this engagement's testing

### 2.3 Crosswalk Viewer
- Interactive matrix (Standard A rows x Standard B columns)
- Color-coded cells (green=equivalent, yellow=partial, blue=related, gray=none)
- Click to see mapping details

### 2.4 Multi-Standard Engagement Support
- Tag engagement to 1+ standards
- Merged finding form (superset of all applicable standard elements)
- Generate separate reports per standard from same engagement data
- Per-standard compliance status indicator

---

## 3. Control Library Requirements

### 3.1 Universal Control Catalog (Tenant-Scoped)
- Central repository of all documented controls
- Tag controls to multiple standard requirements
- Control attributes: ID, description, owner, type (preventive/detective), frequency, evidence

### 3.2 Control Testing
- SOX-specific: TOD (Test of Design) + TOE (Test of Operating Effectiveness)
- GAGAS: Evidence gathering and evaluation
- ISO: Conformity verification
- COBIT: Capability assessment (0-5)

**Abstraction**: Control testing types configured per standard. Core engine handles scheduling, evidence, and conclusions.

---

## 4. Platform-Level Requirements (Standard-Agnostic)

These features are the same regardless of which standard is active:

### 4.1 Multi-Tenancy
- Complete data isolation between organizations
- Each tenant activates their standards
- Tenant-level customization of standard packs

### 4.2 Role-Based Access Control
- Roles are mostly universal: Admin, Director, Supervisor, Senior Auditor, Staff, QA, Auditee, Viewer
- IIA adds: Chief Audit Executive (CAE)
- SOX adds: Audit Committee member
- Permissions defined per role, configurable per tenant

### 4.3 Workflow Engine
- Configurable multi-step approval chains
- Standard pack provides default workflow; tenant can customize
- Same engine for all entity types (engagements, findings, reports)

### 4.4 File/Document Management
- Workpaper upload, version control, review sign-off
- Evidence linking to findings, tests, controls
- 7-year retention (SOX §802 is strictest)

### 4.5 Audit Trail
- Immutable logging of all actions
- Required by ALL standards (evidence integrity)
- Before/after diffs, user, timestamp, IP

### 4.6 PDF Report Generation
- Standard pack provides report template (sections, formatting)
- Engine fills data from database
- Auto-include standard-required elements (compliance statement, independence, etc.)

---

## 5. Feature Priority Matrix

Based on market size, complexity, and overlap with existing AIMS v1:

| Feature | MVP (Phase 1-3) | Growth (Phase 4-5) | Enterprise (Phase 6-7) |
|---------|-----------------|-------------------|----------------------|
| GAGAS standard pack | Yes | — | — |
| Standards abstraction layer | Yes | — | — |
| Dynamic finding form | Yes | — | — |
| Configurable terminology | Yes | — | — |
| Multi-tenant | Yes | — | — |
| IIA standard pack | — | Yes | — |
| SOX standard pack | — | Yes | — |
| Crosswalk engine | — | Yes | — |
| Control library | — | Yes | — |
| ISO 19011 pack | — | — | Yes |
| COBIT pack | — | — | Yes |
| Standard Pack SDK | — | — | Yes |
| ESG/CSRD pack | — | — | Yes |
| Custom report builder | — | — | Yes |
| Mobile app | — | — | Yes |

---

## 6. Validation Checklist

Before implementing any standard pack, verify:

- [ ] All terminology mapped and configurable
- [ ] All engagement types defined
- [ ] All finding elements defined with field types and help text
- [ ] Classification scheme defined with colors
- [ ] Report sections defined (required vs optional)
- [ ] QA checklist items authored with standard references
- [ ] Independence form configured
- [ ] CPE rules defined
- [ ] Approval workflow steps defined
- [ ] Crosswalk mappings to at least one other standard populated
- [ ] PDF report template renders correctly
- [ ] End-to-end test: create engagement → document finding → generate report
