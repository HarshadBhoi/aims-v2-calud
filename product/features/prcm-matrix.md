# PRCM (Process-Risk-Control Matrix)

> The structured risk-to-control mapping that underpins an audit's fieldwork. Processes → Risks → Controls → Test Procedures, with per-cell risk rating and control-framework-aware linking. New in v2: PRCM integrates with the engagement's attached control frameworks (SOC 2, ISO 27001, NIST 800-53).

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 6
**Primary personas**: Priya (AIC), Anjali (Staff)
**MVP phase**: 1.0

---

## 1. Feature overview

The PRCM is a structured matrix documenting:

- **Processes** being audited (rows grouped by process)
- **Risks** identified per process (rows within process)
- **Controls** mitigating each risk (cells per risk × control)
- **Test procedures** that validate each control (associated with cells)
- **Risk ratings** — inherent, control, residual

The matrix serves both as a planning artifact (drives work program) and as an evidence-of-risk-assessment artifact (referenced by APM and Yellow Book report).

### 1.1 Control-framework-aware PRCM (v2 enhancement)

When the engagement has control framework packs attached (SOC 2, ISO 27001, NIST 800-53), the PRCM's Controls column can link to specific controls from those frameworks. A SOC 2 control (e.g., CC6.1 — Logical Access) can be mapped to a PRCM cell showing it mitigates a specific risk. This integration makes PRCM multi-standard-aware.

---

## 2. User stories

### 2.1 US-PRCM-001 — Priya creates PRCM from template

```gherkin
GIVEN Oakfield FY27 engagement has SOC 2 attached as control framework
WHEN Priya creates PRCM
  AND selects template: "Federal Grants Administration"
THEN PRCM populates with:
  - Pre-defined processes (Grant application, award management, expense classification, reporting)
  - Pre-defined risks per process
  - Empty cells for controls and test procedures
  - Option to import SOC 2 controls for applicable risks
```

**Acceptance criteria**:
- Template library per engagement type
- Risk inheritance from audit universe (if linked)
- Cells editable inline

### 2.2 US-PRCM-002 — Priya rates inherent, control, and residual risk

```gherkin
GIVEN PRCM has process-risk rows
WHEN Priya rates:
  - Inherent risk: High (likelihood × impact absent controls)
  - Control risk: Moderate (assessment of existing controls' effectiveness)
  - Residual risk: auto-calculated = inherent - control
THEN ratings save
  AND visualized in matrix (heatmap colors)
  AND aggregate to process-level and engagement-level risk scores
```

### 2.3 US-PRCM-003 — Priya maps SOC 2 controls to PRCM

```gherkin
GIVEN engagement has SOC 2:2017 attached
WHEN Priya identifies that CC6.1 (Logical Access Controls) mitigates "Unauthorized access to grant financial data"
  AND she clicks Link Control in the cell
  AND searches SOC 2 control library
  AND selects CC6.1
THEN linkage captured
  AND test procedures from SOC 2 TSC suggested
  AND PRCM now shows cross-framework mapping
```

**Acceptance criteria**:
- Control framework library accessible from cell editor
- Multi-framework linking supported (cell can reference SOC 2 CC6.1 AND NIST 800-53 AC-2)
- Cross-framework consistency checking (does mapping make sense?)

### 2.4 US-PRCM-004 — Priya authors test procedures per cell

```gherkin
GIVEN a cell links risk "Unauthorized access" to control "CC6.1"
WHEN Priya writes test procedure: "Obtain list of federal grant system users; sample 25; verify authorization documentation; confirm provisioning consistent with least-privilege principle"
THEN procedure saved
  AND linkable to work papers during fieldwork
  AND time budget added
```

### 2.5 US-PRCM-005 — PRCM approved as part of PLANNING phase gate

```gherkin
GIVEN PRCM is complete
  AND APM references PRCM rows
WHEN engagement phase gate PLANNING → FIELDWORK runs
THEN PRCM must be approved (part of gate)
  AND PRCM version locked on approval
```

### 2.6 US-PRCM-006 — Priya clones PRCM from prior engagement

```gherkin
GIVEN Oakfield FY26 PRCM exists
WHEN Priya creates Oakfield FY27 PRCM by cloning
THEN structure preserved
  AND Priya reviews and updates for current year
```

---

## 3. Edge cases

### 3.1 Risk identified but no control exists

PRCM cell shows control risk as "No control" or "Inadequate". Residual risk high. Finding candidate.

### 3.2 Control linked to risk but control not tested

Cell flags "Control identified but test procedure missing" — validation at gate approval.

### 3.3 Multiple packs reference same control

Resolver per classification-mappings cross-pack patterns; PRCM shows linkages across frameworks.

---

## 4. Data model

- `PRCM` — matrix per engagement
- `PRCMProcess` — process rows
- `PRCMRisk` — risk rows per process
- `PRCMCell` — intersection with control + test procedure + ratings
- `ControlLibraryLink` — M:N linkage to control framework packs

---

## 5. API

```typescript
prcm.create(input: {engagementId, template}): PRCM
prcm.addProcess(input: ProcessInput): PRCMProcess
prcm.addRisk(input: RiskInput): PRCMRisk
prcm.updateCell(input: CellUpdateInput): PRCMCell
prcm.linkControl(input: {cellId, packRef, controlId}): void
prcm.exportPDF(input: {prcmId}): PDF
prcm.clone(input: {sourcePrcmId}): PRCM
```

---

## 6. Permissions

| Role | Create | Edit | Approve |
|---|---|---|---|
| AIC | ✅ | ✅ | ❌ |
| Staff | ❌ | ✅ (assigned) | ❌ |
| CAE | ✅ | ✅ | ✅ |

---

## 7. Performance

- Matrix load p99 < 1s (with 100+ cells)
- Cell update p99 < 300ms
- PDF export p99 < 10s

---

## 8. Compliance

- GAGAS risk assessment (§7.06-7.08)
- IIA GIAS Principle 10 (risk-based planning)
- PCAOB AS 2110 (risk identification and assessment)

---

## 9. Dependencies

- Engagement
- Attached control frameworks (for control library linking)
- APM (references PRCM)
- Work programs (derived from test procedures)

---

## 10. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 6
- [`features/apm-workflow.md`](apm-workflow.md)
- [`features/fieldwork-and-workpapers.md`](fieldwork-and-workpapers.md)
- [`rules/strictness-resolver-rules.md §3.15`](../rules/strictness-resolver-rules.md) — risk-based approach depth dimension

---

## 11. Domain review notes — Round 1 (April 2026)

External review flagged no specific changes for this file. The integration of control frameworks directly into PRCM was called out as a "massive differentiator that enterprise buyers will love."

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
