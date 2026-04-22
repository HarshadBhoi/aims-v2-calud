# Fieldwork and Work Papers

> The largest day-to-day auditor surface. Work programs, work papers with supervisory review, sampling worksheets, audit testing execution, observation capture and escalation to findings. Where Anjali spends most of her time and where Priya reviews. The execution layer between engagement planning and finding issuance.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 7
**Primary personas**: Anjali (Staff), Priya (AIC), Marcus (CAE for material WP review)
**MVP phase**: 1.0

---

## 1. Feature overview

Fieldwork is where the audit actually happens. The engagement team executes test procedures defined in the audit program, documents evidence in work papers, draws preliminary observations, and escalates the meaningful ones to findings. This module covers:

1. **Work programs** — structured test plans per engagement
2. **Work papers** — the documentation of what was tested, how, and what was found
3. **Sampling worksheets** — representative sample selection with methodology
4. **Audit testing execution** — per-sample-item test results
5. **Observation capture** — preliminary issues flagged for judgement
6. **Observation → finding escalation** — promoting observations to formal findings
7. **Evidence upload + attachment** — attaching documents to work papers (integrates with PBC Module 7a)
8. **Supervisory review workflow** — preparer/reviewer pattern with pack-specific evidence requirements

Everything flows through the engagement's FIELDWORK phase per `rules/workflow-state-machines.md §2`. Work papers lock when the engagement transitions out of FIELDWORK.

### 1.1 Why this is the largest module

Anjali (Staff Auditor) spends 80%+ of her working hours in this module. It's the biggest UX surface for daily auditors, and the biggest correctness surface for audit quality.

---

## 2. User stories — Work programs

### 2.1 US-WP-001 — Priya authors the work program for engagement

```gherkin
GIVEN Oakfield FY27 is in PLANNING
  AND the engagement has GAGAS + IIA + Single Audit attached
  AND Priya is authoring the audit work program
WHEN she opens Work Programs → Create
  AND selects template: "Single Audit - Federal Grants (GAGAS + Single Audit)"
THEN template populates with:
  - Standard sections per engagement type:
    * Planning & Risk Assessment
    * Control Testing (per compliance requirement)
    * Substantive Testing
    * Engagement Close
  - Pre-populated test steps per section
  - Time budgets per section
  - Evidence requirements per step
WHEN Priya customizes:
  - Scopes specific to Oakfield (federal programs audited)
  - Adds tenant-specific steps based on prior-year learnings
  - Assigns test steps to team members (Priya for complex judgment; Anjali for detail testing)
THEN work program finalised with ~60 test steps
```

**Acceptance criteria**:
- Template library with 8-10 pre-configured work programs per engagement type
- Template customization supported (add/remove steps, reorder within phases, adjust budgets)
- Each step has: name, description, evidence expected, time budget, responsible person
- Work program version-tracked (prior versions accessible)

### 2.2 US-WP-002 — Work program approval at PLANNING → FIELDWORK transition

```gherkin
GIVEN work program is complete
  AND APM is approved
  AND engagement is at the PLANNING → FIELDWORK gate
WHEN Priya requests phase transition
THEN work program must be approved (it's part of the gate check)
  AND approval chain per `rules/approval-chain-rules.md §2.4` runs
```

**Acceptance criteria**:
- Work program approval is a phase-transition gate
- Changes to approved work program require CAE approval (scope changes)

---

## 3. User stories — Work paper authoring

### 3.1 US-WP-003 — Anjali creates work paper for a specific test step

```gherkin
GIVEN engagement is in FIELDWORK
  AND Anjali is assigned to "Test Federal Grant Expense Classification" test step
WHEN she opens the test step and clicks "Create Work Paper"
THEN a new WorkPaper entity is created with:
  - status: DRAFT
  - linked test step
  - template-populated structure per work paper type:
    * Header (engagement info, auditor info, date)
    * Procedure description
    * Sample selection narrative
    * Test results table
    * Exceptions and notes
    * Conclusion
    * Supervisory review signature block
  - Evidence reference section (empty; populated as documents attached)
  - Auto-generated work paper number (WP-{engagement-prefix}-{sequential})
```

**Acceptance criteria**:
- WP creation p99 < 500ms
- Multiple WP templates available per test type (financial, operational, IT, control, substantive)
- WP number auto-generated with engagement prefix (e.g., WP-OAK-27-047)

### 3.2 US-WP-004 — Anjali documents procedure execution

```gherkin
GIVEN Anjali has WP-OAK-27-047 open
WHEN she documents:
  - Procedure description (rich text via TipTap): "Test that federal grant expenses are properly classified to program accounts"
  - Sample selection narrative (rich text): "Selected 25 transactions from 100 NSF-funded transactions using random sampling"
  - Test results in a **dedicated data grid component** (not TipTap; see below):
    - 25-100+ rows realistic; 15+ columns common in some audit types
    - Columns: Transaction ID, Account, Amount, Expected, Actual, Variance, Exception notes, Supporting evidence link
    - Edit mode: inline cell editing, keyboard navigation (arrow keys, Tab, Enter)
    - Bulk paste from Excel / Google Sheets supported
  - Exceptions analysis (rich text)
  - Conclusion (rich text): "17 of 25 sampled transactions correctly classified; 8 misclassified"
THEN narrative content saves incrementally (auto-save every 30 seconds)
  AND data grid saves on cell-commit (not debounced; each cell edit creates a change event)
  AND @mentions trigger notifications
  AND the work paper's version increments with each save
  AND bitemporal history preserved
```

**Acceptance criteria** — the test results section is a **dedicated high-performance data grid component**, not a TipTap table. Rich text narrative lives in TipTap fields; tabular data lives in the data grid. This is a deliberate architectural split.

**Why not TipTap table**: TipTap's table plugin handles conceptual prose tables (3-5 rows, simple comparison). It will crash or become unusable with the volume auditors actually work with:
- Sample sizes of 60-100 items are common
- Test procedures often have 15+ attribute columns
- Single Audit testing can produce 500-row work papers
- Copy-paste from Excel source data needs reliable ingestion at this scale
- Horizontal scrolling + column freezing + virtual scrolling + keyboard navigation are all required

**Data grid component**: ag-Grid Community (or Handsontable; or a custom React grid on react-virtuoso + focused-cell library). Must support:

- **Virtual scrolling** — handles 1000+ rows without DOM bloat
- **Column freezing** — first 2-3 columns (Transaction ID + description) stay visible during horizontal scroll
- **Column resizing + reordering** — user customization persisted per work paper
- **Cell-level editing** with keyboard navigation (Tab → next column; Enter → next row; Esc → cancel)
- **Copy-paste from Excel/Sheets** — respecting column alignment; numeric / date parsing
- **Auto-sum / formulas** on numeric columns (total tested amount, total variance)
- **Conditional formatting** (exception rows highlighted; pass rows flagged)
- **Per-row expand** for extended detail (exception notes, evidence links)
- **CSV/XLSX export** for sharing with reviewers outside the system

**Other standards**:
- Auto-save for narrative sections: every 30s
- Data grid saves per-cell commit (blur or Enter triggers save)
- Bulk operations: select multiple rows → apply status → bulk test result update
- Column configuration per test step type (tenant-configurable templates)

**Why this matters**: auditors working on a Single Audit may log 500-item samples across 20 columns in a single work paper. If the tool can't handle that scale, auditors maintain testing in Excel outside AIMS and paste conclusions into the system — defeating the platform and creating an evidence-integrity gap.

### 3.3 US-WP-005 — Anjali attaches evidence documents

```gherkin
GIVEN Anjali needs to attach supporting evidence
  AND the documents are in the PBC staging queue (per Module 7a) — Tom accepted the trial balance
WHEN Anjali clicks "Attach Evidence"
  AND searches for document in the staging queue
  AND selects trial balance + GL excerpt
THEN documents are attached to the work paper
  AND PBC items mark as "linked to WP"
  AND documents' references update (bidirectional)
  AND evidence list visible in work paper
```

**Acceptance criteria**:
- Evidence picker shows engagement's accepted PBC documents + previously-attached documents
- Quick-upload for new documents directly
- Bidirectional linkage maintained
- Per-evidence note supported

### 3.4 US-WP-006 — Anjali submits work paper for review

```gherkin
GIVEN work paper is complete with narrative + test results + evidence + conclusion
WHEN Anjali clicks "Submit for Review"
THEN work paper transitions DRAFT → READY_FOR_REVIEW
  AND Priya (supervisor) is notified via unified notification center
  AND work paper is read-only for Anjali until review completes
  AND audit_event logged
```

**Acceptance criteria**:
- Validation at submit (required sections populated)
- Submit blocks if any required fields empty
- Notification fires immediately

---

## 4. User stories — Supervisory review

### 4.1 US-WP-007 — Priya reviews Anjali's work paper

```gherkin
GIVEN WP-OAK-27-047 is in READY_FOR_REVIEW
  AND Priya is supervisor
WHEN Priya opens the review queue and clicks the work paper
THEN she sees:
  - Full work paper content (read-only)
  - Inline review comment anchors (per section)
  - Reviewer decision buttons: "Approve", "Request Revision", "Reject"
  - Auto-analysis hints (e.g., "8 exceptions identified — consider potential finding")
  - Evidence attachments accessible
WHEN Priya reads, adds comments inline:
  - On "Procedure description": "Well-stated; include reference to 2 CFR 200.413(a) definition of 'allowable'"
  - On "Exception analysis": "Great detail. Can you check if any of the 8 exceptions are material?"
  AND she clicks "Request Revision"
  AND provides overall note: "Mostly strong; see inline comments for 2 items"
THEN work paper transitions READY_FOR_REVIEW → DRAFT
  AND Anjali notified with Priya's feedback
```

**Acceptance criteria**:
- Inline comments anchor to specific element/section
- Review summary with overall decision
- Comments thread for discussion
- Audit log captures review actions

### 4.2 US-WP-008 — Priya approves the work paper

```gherkin
GIVEN Priya has reviewed and is satisfied
WHEN she clicks "Approve"
  AND confirms (with signature stamp)
THEN work paper transitions READY_FOR_REVIEW → REVIEWED
  AND Priya's signature, date, and reviewer identity recorded in supervisory review signature block
  AND work paper becomes immutable
  AND Anjali receives notification
  AND audit_event with supervisory signature logged per GAGAS §6.33
```

**Acceptance criteria**:
- Signature is not editable after save
- Review decision logged with hash-chain entry
- Per-pack evidence of review (required signatures)

### 4.3 US-WP-009 — Pack-specific review requirements

```gherkin
GIVEN engagement is Single Audit (GAGAS attached) + Engagement has federal grants (SINGLE_AUDIT overlay)
  AND WP being reviewed contains federal grant testing
WHEN Priya approves
THEN she's prompted for additional signature required by GAGAS:
  "Evidence of supervisory review: Do you confirm that the sampling methodology and results are GAGAS §6.41-compliant?"
WHEN she confirms
THEN GAGAS-specific signature recorded
```

For PCAOB ICFR engagements, additional reviewer required (Engagement Quality Reviewer per AS 1220). The workflow shows two concurrent review states that must both be satisfied.

---

## 5. User stories — Sampling worksheets

### 5.1 US-WP-010 — Anjali creates a sampling worksheet

```gherkin
GIVEN Anjali needs to select a sample for federal grant expense testing
WHEN she opens Sampling Worksheet for the test step
  AND specifies:
    - Population description: "All NSF-funded transactions in FY27"
    - Population size: 1000 transactions (from PBC trial balance)
    - Desired sample size: 25 (using GAGAS-approved formula)
    - Sampling methodology: Statistical random sampling
    - Randomization approach: Random number generator seeded by engagement ID
    - Risk rating: Moderate (per engagement PRCM)
  AND clicks "Generate Sample"
THEN 25 random items selected from the 1000
  AND each sample item is pre-populated for testing
  AND sampling worksheet is produced with:
    - Methodology description
    - Seed value (for reproducibility)
    - Selected items
    - Testing plan
```

**Acceptance criteria**:
- Sample size calculator supports GAGAS formula, AICPA formula, PCAOB formula
- Reproducibility via seed-based random number generation
- Audit trail of sample selection methodology
- Sample items flow to test execution UI

### 5.2 US-WP-011 — Anjali documents test results per sample

```gherkin
GIVEN sampling worksheet has 25 selected items
WHEN Anjali executes testing for each sample:
  - Item 1: Passed (expected amount = actual amount)
  - Item 2: Passed
  - Item 3: Exception (variance > threshold; misclassification)
  - ... (25 items tested)
THEN test result table auto-populated:
  - Pass/exception per item
  - Aggregate statistics (pass rate, exception rate)
  - Monetary impact of exceptions
  - Classification per exception type
```

**Acceptance criteria**:
- Per-item test result with structured fields
- Bulk test entry (upload Excel results)
- Auto-calculated aggregate statistics
- Exception categorization

---

## 6. User stories — Observation capture

### 6.1 US-WP-012 — Anjali flags a preliminary issue as observation

```gherkin
GIVEN Anjali is testing and finds 8 exceptions in federal grant classification
WHEN she determines these collectively warrant flagging as a potential issue
  AND she creates an Observation record:
    - Title: "Federal grant expense misclassification"
    - Description: "8 of 25 sampled transactions misclassified from Program to Administrative accounts"
    - Evidence: links to work paper WP-OAK-27-047
    - Classification: "Significant" (her initial assessment)
    - Status: PRELIMINARY (not yet a finding)
THEN observation is saved
  AND Priya notified as potential finding candidate
  AND observation linked to the work paper
  AND audit_event logged
```

**Acceptance criteria**:
- Observation is a first-class entity (not a field on work paper)
- Per-observation: title, description, severity assessment, evidence links
- Status: PRELIMINARY, ESCALATED_TO_FINDING, DISMISSED, RESOLVED
- Visible in engagement's observation queue for Priya to review

### 6.2 US-WP-013 — Priya reviews observations

```gherkin
GIVEN Priya needs to review observations
WHEN she opens engagement → Observations
THEN she sees all observations from the engagement:
  - Grouped by status
  - Filterable by severity, date, test step
  - One-click navigation to work paper (source)
WHEN she opens observation "Federal grant expense misclassification"
  AND evaluates severity and engagement implications
  AND determines: "This is material; escalate to finding"
THEN she initiates the observation-to-finding escalation
```

### 6.3 US-WP-014 — Observation → finding escalation

```gherkin
GIVEN Priya decides to escalate the observation to a finding
WHEN she clicks "Escalate to Finding"
  AND confirms
THEN a new Finding entity is pre-populated with:
  - Title: "Federal Grant Expense Misclassification" (from observation)
  - CRITERIA: (Priya fills in per 2 CFR 200.404)
  - CONDITION: "Testing identified 8 misclassified transactions totaling $127,400" (carried from observation)
  - CAUSE: (to be filled)
  - EFFECT: (to be filled)
  - applicableMethodologies: copied from engagement (GAGAS + IIA + Single Audit)
  - evidence_references: carried forward (workpaper WP-OAK-27-047)
  - Observation entity linked to the new Finding
WHEN Priya completes the finding per `finding-authoring.md` workflow
THEN observation is marked ESCALATED_TO_FINDING
  AND finding is DRAFT
  AND the observation-to-finding chain is traceable
```

**Acceptance criteria**:
- Escalation pre-populates finding with observation data
- Link preserved between observation and finding (audit trail)
- Work paper evidence carries forward
- Can also dismiss observation (no escalation) with rationale

---

## 7. User stories — Work paper locking

### 7.1 US-WP-015 — Engagement transitions out of FIELDWORK; work papers lock

```gherkin
GIVEN engagement is in FIELDWORK
  AND Priya initiates FIELDWORK → REPORTING transition
  AND all work papers have been reviewed and approved
WHEN transition fires per `workflow-state-machines.md §2`
THEN all work papers transition REVIEWED → LOCKED
  AND all work papers become read-only (no edits unless engagement regresses to FIELDWORK)
  AND audit_event logged for bulk lock event
  AND notification to engagement team
```

**Acceptance criteria**:
- Automatic cascade to all work papers on engagement transition
- Regression to FIELDWORK unlocks work papers (per CAE approval)
- Locked work papers remain accessible for reference

---

## 8. Edge cases

### 8.1 Work paper needs edit after lock

If a work paper has an error discovered post-lock:
- Engagement must regress to FIELDWORK (per `workflow-state-machines.md §2.6`)
- CAE approval required
- Work paper unlocks; edit; resubmit; re-review; re-approve; re-lock
- Audit trail captures the regression reason

### 8.2 Conflicting sampling methodology

If Anjali's sampling doesn't match the methodology approved at planning:
- Discrepancy detected at sampling worksheet submit
- Priya flagged for decision
- Options: accept the variance; re-do the sample; document the reason

### 8.3 Test results showing all exceptions

Extreme case: 25 of 25 sampled items fail. This indicates:
- Either the population has systematic issues
- Or the sampling methodology was off
- Anjali flags to Priya for immediate attention
- Typically escalates to significant finding with urgent CAE notification

### 8.4 Missing evidence

If a work paper references evidence that doesn't exist in the engagement:
- Validation at submit prevents completion
- Anjali must either attach evidence or note the absence
- Missing evidence flagged in supervisory review

### 8.5 Reviewer bias concerns

If Priya reviews her own work papers (rare but possible for AIC covering a staff absence):
- System flags conflict
- Marcus (CAE) must approve the self-review
- Documented reason required

---

## 9. Data model touch points

Per `data-model/tenant-data-model.ts`:

- `WorkProgram` — engagement's test plan
- `WorkPaper` — individual work paper with content + evidence + review
- `SamplingWorksheet` — sample selection methodology + results
- `TestStep` — individual test procedure within work program
- `TestResult` — per-sample-item result
- `Observation` — preliminary issue flagged
- `SupervisoryReviewSignature` — review evidence

---

## 10. API endpoints

### 10.1 tRPC procedures

```typescript
// Work programs
workProgram.create(input: {engagementId, template}): WorkProgram
workProgram.update(input: WorkProgramUpdateInput): WorkProgram
workProgram.addStep(input: {programId, step}): TestStep
workProgram.approveForFieldwork(input: {programId}): WorkProgram

// Work papers
workpaper.create(input: {engagementId, stepId}): WorkPaper
workpaper.update(input: WorkPaperUpdateInput): WorkPaper
workpaper.submitForReview(input: {workpaperId}): WorkPaper
workpaper.approve(input: {workpaperId, signature}): WorkPaper
workpaper.requestRevision(input: {workpaperId, comments}): WorkPaper
workpaper.attachEvidence(input: {workpaperId, documentId, note?}): Evidence

// Sampling
sampling.createWorksheet(input: SamplingInput): SamplingWorksheet
sampling.generateSample(input: {worksheetId}): Sample[]
sampling.recordTestResult(input: TestResultInput): TestResult

// Observations
observation.create(input: ObservationInput): Observation
observation.update(input: ObservationUpdateInput): Observation
observation.escalateToFinding(input: {observationId}): Finding
observation.dismiss(input: {observationId, reason}): Observation

// Lock
workpaper.lock(input: {workpaperIds}): WorkPaper[]
workpaper.unlock(input: {workpaperId, reason}): WorkPaper  // CAE only
```

### 10.2 REST endpoints

Standard CRUD for work programs, work papers, observations, sampling worksheets.

### 10.3 Webhook events

- `workpaper.created`
- `workpaper.submitted_for_review`
- `workpaper.approved`
- `workpaper.locked`
- `observation.created`
- `observation.escalated_to_finding`

---

## 11. Permissions

| Role | Create WP | Edit WP (draft) | Submit for review | Approve (supervisor) | Lock/unlock |
|---|---|---|---|---|---|
| Anjali (Staff) | ✅ (on assigned test steps) | ✅ (draft, own) | ✅ | ❌ | ❌ |
| Priya (AIC) | ✅ | ✅ (draft, team) | ✅ | ✅ (supervisor role) | ❌ |
| Marcus (CAE) | ✅ | ✅ (override) | ✅ | ✅ (CAE role) | ✅ |
| Tom (PBC) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 12. Observability

- `workpaper.create.count`
- `workpaper.submit.count`
- `workpaper.approve.count`
- `workpaper.locked.count`
- `workpaper.review.duration` (histogram)
- `workpaper.revision.loop.count` (revisions per WP)
- `observation.create.count`
- `observation.escalated.count`
- `sampling.generate.duration`

---

## 13. Performance characteristics

- WP creation p99 < 500ms
- WP save p99 < 300ms
- WP list load p99 < 1s (for engagement with 50+ WPs)
- Bulk WP lock p99 < 30s (for engagement with 200+ WPs)
- Sampling generation p99 < 2s

Scale:
- 200+ WPs per engagement realistic
- 50+ observations per engagement
- 1000+ total WPs per tenant per year

---

## 14. Compliance implications

- **GAGAS §6.33 supervisory review**: per-WP signature evidence
- **GAGAS §6.41 evidence sufficiency**: sampling methodology documented
- **IIA GIAS Domain 3 execution**: work program + WP documentation
- **PCAOB AS 1215 documentation**: per-WP retention in hash-chained audit log
- **Audit trail**: every state change logged; peer-review evidence exportable

---

## 15. Dependencies

- Engagement (must exist)
- Work program template library
- Evidence documents (from PBC + direct upload)
- Supervisor roles (defined in tenant)

### 15.1 Downstream

- Finding authoring (observations become findings)
- Reports (findings reference work papers as evidence)
- Audit trail
- Peer review evidence bundle

---

## 16. UX references

Detailed UX in [`ux/work-paper-authoring.md`](../ux/work-paper-authoring.md) and [`ux/observation-escalation.md`](../ux/observation-escalation.md) (Phase 6 pending).

---

## 17. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 7 — feature inventory
- [`rules/workflow-state-machines.md §7`](../rules/workflow-state-machines.md) — work paper state machine
- [`rules/strictness-resolver-rules.md §3.5`](../rules/strictness-resolver-rules.md) — WP supervisory review requirements
- [`features/engagement-management.md`](engagement-management.md) — engagement context
- [`features/pbc-management.md`](pbc-management.md) — evidence source
- [`features/finding-authoring.md`](finding-authoring.md) — observation escalation destination

---

## 18. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§3.2 — test results data grid**: reviewer correctly flagged that TipTap tables will crash or become unusable at realistic audit data volumes (60-100 item samples × 15+ columns common; 500-row work papers realistic for full-scope Single Audit testing). Fix: test results section is now a **dedicated high-performance data grid component** (ag-Grid Community or equivalent), not a TipTap table. Rich text narrative remains in TipTap; tabular data lives in the data grid. Requirements include virtual scrolling, column freezing, keyboard navigation, Excel-paste, auto-sum, conditional formatting, CSV/XLSX export. This is the architectural split between prose (TipTap) and structured tabular data (data grid) that prevents auditors from resorting to Excel-outside-AIMS for volume testing.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
