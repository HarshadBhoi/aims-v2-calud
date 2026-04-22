# Recommendations and Corrective Action Plans

> Closes the remediation loop. Recommendations are separate entities with M:N to findings (per ADR data-model decision) and pack-driven presentation modes (inline / separate / suppressed / both). CAPs (Corrective Action Plans) are auditee-drafted remediation plans; auditor-verified completion. Includes the Summary Schedule of Prior Audit Findings feature and the 5-report Single Audit overlay plan for MVP 1.0.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Modules 8 (recommendations) + 9 (CAPs + follow-up)
**Primary personas**: Priya (AIC), Marcus (CAE), David (Auditee CFO), Tom (PBC Manager for CAP intake)
**MVP phase**: 1.0

---

## 1. Feature overview

After a finding is issued, two downstream workflows run:

1. **Recommendation**: auditor-provided suggestion for remediation (per pack's presentation mode)
2. **CAP (Corrective Action Plan)**: auditee-provided plan to address the finding

Recommendations are separate entities from findings (M:N relationship) because:
- Different packs require different recommendation presentation (inline / separate / suppressed)
- Same recommendation can address multiple findings
- Recommendations can exist separate from specific finding contexts (e.g., process improvements)
- This shape supports the multi-report differentiator

CAPs are auditee-driven but tracked by auditor. The workflow differs from findings in that David (auditee CFO) is a primary user for drafting.

This spec covers:
- Recommendation authoring and linking
- Recommendation presentation per pack
- CAP drafting (auditee-side) and approval (auditor-side)
- CAP execution tracking
- Evidence submission and verification
- Follow-up audit support
- Summary Schedule of Prior Audit Findings

### 1.1 Why recommendations are separate

Per `docs/06-design-decisions.md §1.4` and `rules/workflow-state-machines.md §6`, recommendations are first-class entities because the 4 major methodologies diverge philosophically:

- **GAGAS §6.47**: separate report section; one rec may address multiple findings
- **IIA GIAS Standard 15.1**: integrated with finding as the "5th C"
- **ISO 19011 Cl. 6.4**: auditor doesn't issue recommendations; auditee prepares CARs
- **PCAOB AS 2201 / AS 1305**: auditor-issued ICFR recommendations prohibited

The data model's separate-entity + M:N + per-report presentation mode handles all 4 cases without compromise.

---

## 2. User stories — Recommendation authoring

### 2.1 US-REC-001 — Priya drafts a recommendation for a finding

```gherkin
GIVEN Priya is authoring finding 2026-001 (in DRAFT state)
  AND she wants to add a recommendation
WHEN she opens the finding's "Recommendations" tab
  AND clicks "Draft Recommendation"
  AND fills in:
    - Recommendation text: "Implement quarterly reconciliation procedures between initial expense coding and approved program budgets for federal grants."
    - Specific actionable steps:
      1. Define reconciliation procedure
      2. Train staff
      3. Implement reconciliation (starts Q1 FY28)
      4. Document reconciliation evidence
    - Target completion: 6 months from issuance
    - Assigned organization unit: Grant Accounting
    - Suggested owner: Michelle Zhao (Grant Accountant)
  AND clicks Save
THEN a new Recommendation entity is created
  AND M:N link to Finding 2026-001 established
  AND recommendation enters DRAFT state
  AND per `rules/workflow-state-machines.md §6`, it will follow the finding's workflow for approval
```

**Acceptance criteria**:
- Recommendation is separate entity (not a field on finding)
- Multiple recommendations possible per finding (M:N)
- One recommendation can address multiple findings
- Draft state is editable by author
- Presentation mode determined by pack-per-report declaration (not per-recommendation)

### 2.2 US-REC-002 — Same recommendation addresses multiple findings

```gherkin
GIVEN engagement has 3 related findings about grant administration controls:
  - 2026-001: Federal grant expense classification
  - 2026-003: Indirect cost rate application
  - 2026-005: Grant reporting reconciliation
  AND Priya identifies that one recommendation addresses all three
WHEN Priya opens Recommendation Management
  AND drafts: "Implement monthly grant-account reconciliation with documented review by CFO"
  AND links it to all three findings
THEN one Recommendation record is linked to 3 findings
  AND each finding's "Related Recommendations" section shows this recommendation
```

**Acceptance criteria**:
- M:N linking supported in UI
- Link can be created either from finding or recommendation side
- Unlinking possible (with audit log)
- Visibility: each finding shows recommendations linked to it; each recommendation shows findings addressed

### 2.3 US-REC-003 — Recommendation draft → approved

```gherkin
GIVEN Priya has drafted the recommendation
  AND it's linked to findings that are in IN_REVIEW state
WHEN the finding's review is completed and finding transitions to APPROVED
THEN the linked recommendation's lifecycle triggers:
  - Recommendation inherits the finding's approval state (APPROVED)
  - Pre-publication checks run
  - Ready for inclusion in relevant reports
```

**Acceptance criteria**:
- Recommendation workflow per `rules/workflow-state-machines.md §6.1`
- Lifecycle states: DRAFT → FINALISED → PUBLISHED → RESOLVED → ARCHIVED
- Pack-specific workflow variations (e.g., PCAOB suppression)
- Changes to recommendation after finding approval require new finding-level approval

---

## 3. User stories — Recommendation presentation per pack

### 3.1 US-REC-004 — Yellow Book report shows recommendations in separate section (GAGAS)

```gherkin
GIVEN Yellow Book report is being composed
  AND engagement has GAGAS attached (primaryMethodology)
  AND GAGAS declares recommendationPresentation: SEPARATE
WHEN the Yellow Book report is rendered
THEN findings appear first (per GAGAS §6.02)
  AND "Recommendations" appears as a separate section
  AND each recommendation lists the findings it addresses
  AND hyperlinks connect each recommendation to its related findings
```

### 3.2 US-REC-005 — Audit Committee report shows recommendations inline (IIA)

```gherkin
GIVEN Audit Committee report is being composed
  AND engagement has IIA attached as additionalMethodology
  AND IIA declares recommendationPresentation: INLINE
WHEN the Audit Committee report is rendered
THEN each finding includes the recommendation as the "5th C" (Criteria, Condition, Cause, Effect, + Recommendation)
  AND no separate "Recommendations" section
  AND the same recommendation appears inline with each finding it addresses (duplicated text if shared across findings)
```

**Acceptance criteria**:
- Rendering is automatic per pack-declared presentation mode
- Report composer doesn't need to decide; report template handles it
- Per-report consistency validated at issue time

### 3.3 US-REC-006 — PCAOB ICFR report suppresses recommendations (AS 1305)

```gherkin
GIVEN an engagement has PCAOB attached
  AND PCAOB declares recommendationPresentation: SUPPRESSED (AS 1305 prohibition)
WHEN a PCAOB ICFR report is being composed
THEN findings appear without recommendations
  AND the recommendation entities still exist in the data model but are hidden from PCAOB rendering
  AND reports that attest to OTHER packs (not PCAOB) still show them appropriately
```

**Acceptance criteria**:
- Per-report presentation mode driven by attestsTo pack declaration
- Recommendations remain attached to findings (data intact); just hidden from PCAOB rendering
- Cross-pack consistency not violated (other reports in same engagement still show)

### 3.4 US-REC-007 — soxSuppressRecommendation flag (finding-level override)

```gherkin
GIVEN a finding has sensitive content that shouldn't appear as a recommendation in any report
  AND a CAE sets the finding's soxSuppressRecommendation flag to true
WHEN rendering any report including this finding
THEN the recommendation is suppressed regardless of pack-declared presentation mode
  AND the flag is visible in audit trail with rationale
```

**Acceptance criteria**:
- Flag is per-finding, boolean, with rationale
- CAE-only to set
- Overrides pack defaults for all reports

---

## 4. User stories — CAP drafting (auditee-side)

### 4.1 US-CAP-001 — CAP drafting via secure link (with delegation awareness)

```gherkin
GIVEN Oakfield FY27's Yellow Book report was issued
  AND finding 2026-001 requires CAP
  AND David (CFO) is the auditee contact of record
WHEN David receives the CAP request email
  AND clicks the secure portal link
THEN the portal loads with an identity confirmation step (not assumed):
  "You've arrived via a secure link addressed to David Park, CFO.
   If you are David, continue. If you are someone else working on his behalf, please identify yourself below."
   
  [ I am David Park, CFO — continue ]
   
  [ I am drafting on David's behalf — ]
     Name:  _______________
     Title: _______________
     Email: _______________ (optional, for future access)
WHEN the actual drafter (e.g., Michelle Zhao, Grant Accountant) identifies herself
  AND confirms she is delegated to draft
THEN session records Michelle as the active user
  AND David's magic-link identity is logged as the "link-bearer" (for audit trail)
  AND Michelle can draft the CAP
WHEN Michelle fills in the CAP (as David's delegate):
  - Specific remediation actions:
    1. Update Grant Accounting Policy (due Sep 30, 2027)
    2. Implement automated reconciliation system (due Dec 31, 2027)
    3. Train all grant accounting staff (due Q1 2028)
    4. Formal quarterly reconciliation starting (due Q2 2028)
  - Responsible person: Michelle Zhao (Grant Accountant)
  - Target completion: March 31, 2028
  - Explanation narrative
  - Supporting documentation
  AND clicks Submit (prompted to type her own name + title as submitter)
THEN CAP is saved with status: IN_REVIEW
  AND audit trail records:
    - Submitter: "Michelle Zhao, Grant Accountant" (her typed attestation)
    - Link bearer of record: "David Park, CFO"
    - Session timestamp + IP
  AND Tom (PBC Manager) or Priya notified
```

**Acceptance criteria**:
- **Magic link does NOT auto-authenticate as the link-addressed user**: the link establishes the session context (which engagement, which auditee contact) but requires an identity confirmation step before any CAP content is attributed.
- **Delegation is a first-class flow**: "I am drafting on behalf" is explicit, not hidden
- **Submitter typed attestation**: at submit, the active user types their name + title. This is the signature equivalent; the audit trail captures this typed attestation.
- Audit trail captures three things: the link-bearer of record (David), the active session user (Michelle, who identified themselves), and the typed submitter attestation (matching the active session).
- If the active user is not David, the CAP is flagged as "Drafted by delegate on behalf of David Park" in Priya's review UI.
- CAP submission via portal or email-based form
- Mandatory fields: actions (at least 1), responsible person, target completion, typed submitter attestation
- Supporting docs attachable (staged like PBC)
- Save incrementally (draft state)
- CAP target date must be reasonable per the finding's severity (not >1 year typically)

**Why this matters**: audit trails that conflate the email recipient with the actual drafter produce indefensible records. If Michelle submits a CAP but the audit trail says David submitted it, peer reviewers and regulators will question authenticity. The delegation flow captures the reality without requiring everyone in the auditee organisation to have a full AIMS account.

### 4.2 US-CAP-002 — David cannot submit incomplete CAP

```gherkin
GIVEN David is drafting CAP
  AND he's left off the responsible person
WHEN he tries to Submit
THEN validation fails with clear message:
  "Responsible person is required — please identify the owner of this corrective action"
  AND other missing fields highlighted
```

**Acceptance criteria**:
- Validation on submit (not save)
- Each required field flagged with specific issue
- Save-draft works without validation
- Submit requires all required fields

### 4.3 US-CAP-003 — David updates CAP before auditor approval

```gherkin
GIVEN CAP in IN_REVIEW (not yet approved)
WHEN David realizes he needs to update the target date
  AND opens the CAP
  AND makes the edit
  AND re-submits
THEN CAP is updated
  AND version history preserved
  AND auditor notified of change
```

---

## 5. User stories — CAP approval (auditor-side)

### 5.1 US-CAP-004 — Priya reviews CAP

```gherkin
GIVEN CAP for finding 2026-001 is in IN_REVIEW
WHEN Priya opens CAP review queue
  AND evaluates:
    - Does the plan meaningfully address the finding?
    - Are actions specific and measurable?
    - Is the timeline reasonable?
    - Is the responsible person appropriate?
  AND provides feedback: "Plan is solid. Consider adding metric for tracking reconciliation completion."
WHEN she clicks "Approve"
  AND confirms
THEN CAP transitions IN_REVIEW → ACCEPTED
  AND David notified
  AND audit trail logged
```

**Acceptance criteria**:
- Review takes < 2 business days for typical CAP
- Feedback supports discussion thread (David can respond)
- Approval records auditor signature + date

### 5.2 US-CAP-005 — Priya requests CAP revision

```gherkin
GIVEN Priya reviews but finds the plan insufficient
WHEN she clicks "Request Revision"
  AND provides specific feedback:
    "The target date of 2 years is unreasonable for a control deficiency this significant.
     Please reduce to 6-9 months and provide interim progress milestones."
THEN CAP transitions IN_REVIEW → REVISION_REQUESTED
  AND David notified with specific changes needed
  AND David can revise and resubmit
```

### 5.3 US-CAP-006 — CAP approval chain for material findings

```gherkin
GIVEN finding 2026-001 is classified Material Weakness
  AND per `rules/approval-chain-rules.md §5.3`, material-finding CAPs require CAE approval
WHEN Priya (AIC) approves
THEN CAP transitions IN_REVIEW → AIC_APPROVED (intermediate state)
  AND Marcus (CAE) notified
WHEN Marcus also approves
THEN CAP transitions AIC_APPROVED → ACCEPTED
```

---

## 6. User stories — CAP execution tracking

### 6.1 US-CAP-007 — CAP in IN_PROGRESS; auditee reports progress

```gherkin
GIVEN CAP is ACCEPTED
  AND David is executing the plan
WHEN David updates progress:
  - Action 1 (policy update): Completed on Sep 25 (on time)
  - Action 2 (system implementation): In progress, 60% complete
  - Action 3 (training): Not yet started
  - Action 4 (quarterly reconciliation): Not yet started
THEN progress is recorded in CAP entity
  AND Priya notified of update (if configured per tenant)
  AND CAP dashboards reflect update
```

**Acceptance criteria**:
- Progress updates via portal or email
- Per-action tracking
- Timeline comparison (planned vs. actual)
- Progress visible on dashboards

### 6.2 US-CAP-008 — CAP transitions to OVERDUE

```gherkin
GIVEN CAP's target date has passed
  AND completion evidence not yet submitted
WHEN the scheduled job fires
THEN CAP transitions IN_PROGRESS → OVERDUE
  AND David notified (escalation reminder)
  AND Priya notified
  AND CAP appears in "Overdue CAPs" dashboard section
```

**Acceptance criteria**:
- Automatic transition via scheduled job
- Target date comparison uses business calendar
- Notification cadence per `rules/workflow-state-machines.md §5.6`: 10d escalation to AIC; 20d escalation to CAE

### 6.3 US-CAP-009 — Escalation of overdue CAP

Covered in `workflow-state-machines.md §5.6`. Summary:

- 10 days OVERDUE: automatic escalation to CAE (Marcus)
- 20 days OVERDUE: automatic escalation to Engagement Partner
- 30+ days OVERDUE: audit committee communication (for material findings)

---

## 7. User stories — CAP completion and verification

### 7.1 US-CAP-010 — David submits completion evidence

```gherkin
GIVEN CAP is IN_PROGRESS with Action 2 completed (system implementation)
WHEN David clicks "Submit Evidence for Action 2"
  AND uploads:
    - Screenshots of new system
    - Sample reconciliation output from new system
    - Training rollout record
    - Policy update memo
  AND describes the evidence
THEN evidence is attached to CAP
  AND CAP transitions to EVIDENCE_SUBMITTED
  AND Priya notified for verification
```

**Acceptance criteria**:
- Multi-file upload support
- Evidence per-action linkage
- Size limits per PBC spec
- Verification workflow per CAP state machine

### 7.2 US-CAP-011 — Priya verifies CAP completion

```gherkin
GIVEN CAP has evidence submitted (state: EVIDENCE_SUBMITTED)
  AND the CAP's OVERDUE timer transitioned to PAUSED state (see below)
WHEN Priya opens verification queue
  AND state transitions EVIDENCE_SUBMITTED → EVIDENCE_UNDER_REVIEW (automatic when Priya opens it; clock stays paused)
  AND Priya reviews evidence against CAP's stated actions
  AND determines sufficient
WHEN she clicks "Verify Complete"
THEN CAP transitions EVIDENCE_UNDER_REVIEW → VERIFIED
  AND Finding 2026-001 can transition to RESOLVED (per `rules/workflow-state-machines.md §3.7`)
  AND David notified
  AND audit trail captures verification + total time in EVIDENCE_UNDER_REVIEW state
```

### 7.3 US-CAP-012 — Priya requests more evidence (SLA clock pause)

```gherkin
GIVEN CAP is in EVIDENCE_SUBMITTED state (auditee has submitted; auditor review pending)
  AND the OVERDUE timer against the CAP's target date is PAUSED during auditor review
  (otherwise David would be penalised while waiting for Priya to review)
WHEN Priya reviews evidence but finds it insufficient
  AND she clicks "Request More Evidence"
  AND specifies what's missing: "Please provide actual reconciliation outputs, not just the system screenshot"
THEN CAP transitions EVIDENCE_UNDER_REVIEW → MORE_EVIDENCE_REQUESTED
  AND the OVERDUE timer **resumes** (accurate accounting of auditee response time, net of auditor review periods)
  AND David notified with specific feedback
  AND David has reasonable window to re-submit (typically 15 business days from feedback; configurable)
  AND audit trail captures the timer pause/resume with total-paused-time
```

**Acceptance criteria for the OVERDUE timer pause**:
- **CAP SLA clock is the cumulative time the CAP is in auditee-active states (IN_PROGRESS, PROPOSED, MORE_EVIDENCE_REQUESTED)** — not all states
- **Clock pauses during auditor-active states** (EVIDENCE_UNDER_REVIEW specifically; can also include scheduled pause for auditor leave with CAE approval)
- **Clock resumes when state transitions back to an auditee-active state** (MORE_EVIDENCE_REQUESTED)
- When OVERDUE threshold is crossed while clock is running, normal escalation fires
- When clock is paused, no further OVERDUE escalation fires; but existing OVERDUE state is not cleared (it's "paused at N days past target")
- **Audit trail captures total-paused-time per CAP** — visible in CAP details and in peer review evidence bundle

**Why this matters**: without the pause, CAPs transition to OVERDUE while Priya is reviewing evidence the auditee already provided. David gets escalation emails because Priya took 5 days to verify. The pause accurately attributes time to the party actually holding the process — David when he's acting; Priya when she's reviewing; escalations fire only for genuine auditee delays.

### 7.3.1 Additional state: EVIDENCE_UNDER_REVIEW

Adds to the CAP workflow from `rules/workflow-state-machines.md §5.1`:

- **EVIDENCE_UNDER_REVIEW** — transitional state: auditee has submitted evidence, auditor has opened it for review, but not yet accepted or rejected. OVERDUE clock is paused during this state.
- Transitions:
  - EVIDENCE_SUBMITTED → EVIDENCE_UNDER_REVIEW (automatic when auditor opens)
  - EVIDENCE_UNDER_REVIEW → VERIFIED (auditor accepts)
  - EVIDENCE_UNDER_REVIEW → MORE_EVIDENCE_REQUESTED (auditor requests more)
  - EVIDENCE_UNDER_REVIEW → EVIDENCE_SUBMITTED (auditor closes without action; unusual — auto-expires after 3 days)

### 7.4 US-CAP-013 — Auditee abandons CAP

```gherkin
GIVEN CAP is IN_PROGRESS
  AND David determines remediation is infeasible (e.g., system being sunset in 6 months anyway)
WHEN David requests ABANDONED status with rationale
  AND Priya + Marcus approve (per `rules/workflow-state-machines.md §5.1`)
THEN CAP transitions IN_PROGRESS → ABANDONED
  AND finding remains ISSUED (not RESOLVED via this CAP)
  AND alternative resolution path documented
  AND Audit Committee communication fired for material findings
```

---

## 8. User stories — Follow-up audit

### 8.1 US-CAP-014 — Priya creates follow-up audit engagement

```gherkin
GIVEN Oakfield FY26 had CAPs that were marked as VERIFIED
  AND some CAPs remain unverified from prior years
WHEN Marcus initiates Follow-Up Audit for Oakfield FY27
  AND specifies: "Test prior year CAPs (2025, 2026) for effectiveness"
THEN a new engagement is created with:
  - Type: Follow-Up Audit
  - Objective: Test effectiveness of prior CAPs
  - Pre-populated with prior CAPs requiring testing
  - Relevant pack attachments carried forward
```

**Acceptance criteria**:
- Follow-up engagement type supported
- Carries CAP context from prior engagements
- Related findings visible for cross-reference

### 8.2 US-CAP-015 — Follow-up audit identifies repeat findings

```gherkin
GIVEN follow-up audit tests prior CAPs
  AND testing reveals that CAP for 2026-001 was marked VERIFIED but control not actually operating
WHEN Priya creates finding in follow-up:
  - Title: "Federal Grant Expense Misclassification - REPEAT"
  - Repeat Finding flag: True
  - References prior CAP as "implemented but ineffective"
THEN finding is created as repeat finding
  AND Summary Schedule of Prior Audit Findings gets new entry
  AND escalated attention from CAE
```

---

## 9. User stories — Summary Schedule of Prior Audit Findings

### 9.1 US-CAP-016 — Priya generates Summary Schedule of Prior Audit Findings

```gherkin
GIVEN Oakfield FY27 is Single Audit
  AND prior years have unresolved findings
WHEN Priya creates Summary Schedule of Prior Audit Findings
THEN report is generated showing all findings from prior fiscal years with status:
  - Original finding number
  - Fiscal year of finding
  - Status in current period (Resolved / Partially Resolved / Not Yet Resolved / Not Applicable)
  - For resolved: verification date
  - For not resolved: reason (e.g., "Auditee did not implement within reasonable time")
  - For partial: specific elements remaining
  - For not applicable: explanation
```

**Acceptance criteria**:
- Auto-generated from system state (not manually drafted)
- Formatted per 2 CFR 200.511(b)
- Included in Yellow Book report (or as separate report per Single Audit overlay; MVP 1.5 for the separate version)

---

## 10. Edge cases

### 10.1 Recommendation deleted after issuance

If a recommendation is deleted after a finding issues:
- Recommendation transitions to SUPERSEDED state
- Historical records preserve the original version
- Amendments handled via normal amendment workflow

### 10.2 CAP target date passes during auditor unavailability

If Priya is out and CAP passes target:
- Automatic OVERDUE transition fires
- Primary notification goes to CAE (as escalation path)
- Priya notified upon return

### 10.3 Auditee non-responsive

If David doesn't submit CAP (not refusing, just delayed):
- After CAP response window elapses, "CAP Proposal Overdue" workflow
- Finding can be issued with "management declined to respond" note (per `workflow-state-machines.md §5.1.1`)
- Different from CAP.ABANDONED (which is active decision)

### 10.4 Same recommendation across multiple engagements

A recommendation can span engagements (e.g., "Implement organization-wide reconciliation" applied to multiple auditee units):
- Supported via explicit cross-engagement linking
- Each engagement can have its own CAP for tracking

### 10.5 Audit partner oversight

Elena (Audit Partner) doesn't typically interact directly with CAPs but:
- Her dashboards show CAP completion rates across engagements
- Significantly overdue CAPs might trigger partner-level review
- Systemic CAP problems flagged

---

## 11. Data model touch points

Per `data-model/tenant-data-model.ts`:

- `Recommendation` — primary entity (fields: id, tenantId, text, actionableSteps, targetCompletion, presentationMode, linkedFindings M:N)
- `CAP` (CorrectiveActionPlan) — per finding
- `CAPAction` — individual actions within CAP
- `CAPEvidence` — evidence submitted for CAP
- `CAPApproval` — approval chain entries
- `CAPFollowUp` — follow-up audit references

---

## 12. API endpoints

### 12.1 tRPC procedures

```typescript
// Recommendations
recommendation.create(input: RecommendationInput): Recommendation
recommendation.update(input: RecommendationUpdateInput): Recommendation
recommendation.linkFinding(input: {recommendationId, findingId}): void
recommendation.unlinkFinding(input: {recommendationId, findingId}): void
recommendation.suppress(input: {findingId, reason}): Finding  // soxSuppressRecommendation

// CAPs (auditor-facing)
cap.create(input: CAPInput): CAP
cap.review(input: {capId}): CAPReview
cap.approve(input: {capId, comment?}): CAP
cap.requestRevision(input: {capId, feedback}): CAP
cap.verify(input: {capId, evidenceReviewedNote}): CAP
cap.requestMoreEvidence(input: {capId, specificRequests}): CAP
cap.abandon(input: {capId, reason}): CAP

// CAPs (auditee-facing)
auditeeCap.list(input: {}): CAP[]
auditeeCap.draft(input: {capId, draft}): CAP
auditeeCap.updateProgress(input: {capId, actionId, progressNotes}): CAP
auditeeCap.submitEvidence(input: {capId, files, note}): Evidence
auditeeCap.requestAbandonment(input: {capId, rationale}): CAP

// Summary Schedule of Prior Audit Findings
summarySchedule.generate(input: {engagementId}): Report
summarySchedule.getHistoricalFindings(input: {entityId}): Finding[]

// Follow-up audit
followUp.create(input: {engagementId, targetEngagementId}): Engagement
followUp.getPriorCAPs(input: {engagementId}): CAP[]
```

### 12.2 REST endpoints

`POST /v1/recommendations`, `GET /v1/findings/:id/recommendations`, `POST /v1/caps`, `GET /v1/caps/:id`, etc.

### 12.3 Webhook events

- `recommendation.created`
- `recommendation.linked_to_finding`
- `cap.drafted`
- `cap.approved`
- `cap.overdue`
- `cap.evidence_submitted`
- `cap.verified`
- `cap.abandoned`

---

## 13. Permissions

| Role | Draft recommendation | Link finding | CAP draft | CAP approve | CAP verify | Abandon CAP |
|---|---|---|---|---|---|---|
| Priya (AIC) | ✅ | ✅ | ❌ (Priya doesn't draft; she approves) | ✅ | ✅ | Escalate to CAE |
| Marcus (CAE) | ✅ | ✅ | ❌ | ✅ (material-finding) | ✅ (material) | ✅ |
| David (Auditee) | ❌ | ❌ | ✅ | ❌ | ❌ | Request only (requires CAE approve) |
| Tom (PBC) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 14. Observability

- `recommendation.create.count`
- `cap.drafted.count`
- `cap.approved.count`
- `cap.overdue.count`
- `cap.verified.count`
- `cap.abandoned.count`
- `cap.verification.duration` (histogram)
- `cap.escalation.count` (breakdown by severity)

---

## 15. Performance characteristics

- Recommendation creation p99 < 500ms
- CAP creation p99 < 1s
- CAP dashboard load p99 < 1s (with 100+ CAPs)
- Summary Schedule generation p99 < 30s

Scale:
- 30-50 CAPs per engagement typical
- 200+ historical CAPs per tenant
- 1000+ total CAP updates per tenant per year

---

## 16. Compliance implications

- **GAGAS §6.47 recommendations**: handled via recommendation presentation per pack
- **IIA GIAS Standard 15.1**: inline recommendations supported
- **PCAOB AS 1305 prohibition**: suppression supported
- **2 CFR 200.511(b) Summary Schedule**: generated automatically
- **2 CFR 200.516 CAP**: tracked end-to-end
- **Audit trail**: every CAP state change logged

---

## 17. Dependencies

- Findings (Module 8) — recommendations and CAPs both reference findings
- Reports (Module 10) — recommendations rendered per pack
- Engagement (Module 4) — CAPs tracked per engagement
- Workflow state machines — CAP and Recommendation lifecycles

---

## 18. UX references

Detailed UX in [`ux/recommendation-management.md`](../ux/recommendation-management.md), [`ux/cap-auditee-portal.md`](../ux/cap-auditee-portal.md), [`ux/cap-auditor-review.md`](../ux/cap-auditor-review.md) (Phase 6 pending).

---

## 19. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Modules 8 (recommendations) + 9 (CAPs)
- [`rules/workflow-state-machines.md §5 (CAP) + §6 (Recommendation)`](../rules/workflow-state-machines.md)
- [`rules/approval-chain-rules.md §5`](../rules/approval-chain-rules.md) — CAP approval chains
- [`features/finding-authoring.md`](finding-authoring.md) — findings that CAPs reference
- [`features/report-generation.md`](report-generation.md) — recommendations rendered in reports
- [`features/engagement-management.md`](engagement-management.md) — engagement-level context
- [`02-personas.md §4 + §12`](../02-personas.md) — David (auditee) + Tom (PBC)

---

## 20. Domain review notes — Round 1 (April 2026)

External review flagged two refinements:

- **§4.1 — magic link delegation loophole**: reviewer correctly flagged that David (CFO) typically forwards the CAP request email to Michelle (Grant Accountant) who clicks the magic link. If Michelle submits under David's identity, the audit trail is fraudulent. Fix: magic link no longer auto-authenticates as the addressed user. The portal requires explicit identity confirmation ("I am David" vs. "I am drafting on David's behalf"); delegate identifies themselves by name + title + optional email; submitter types their own name + title as attestation. Audit trail captures three things: the link-bearer of record, the active session user, and the typed submitter attestation.
- **§7 — EVIDENCE_UNDER_REVIEW state + SLA pause**: reviewer correctly flagged that if Priya's evidence-review time counts against the auditee's SLA clock, David gets OVERDUE escalations for Priya's slowness. Fix: added EVIDENCE_UNDER_REVIEW state between EVIDENCE_SUBMITTED and VERIFIED/MORE_EVIDENCE_REQUESTED. CAP SLA clock is the **cumulative time in auditee-active states** (IN_PROGRESS, PROPOSED, MORE_EVIDENCE_REQUESTED); **clock pauses during auditor-active states** (EVIDENCE_UNDER_REVIEW). Total paused time captured in audit trail; peer review evidence shows accurate attribution of delay.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
