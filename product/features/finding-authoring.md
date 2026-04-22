# Finding Authoring

> The authoring experience for findings — the single largest-volume workflow-bearing entity in the platform. Multi-standard rendering, semantic core + per-pack extensions, classification picker, inline comments, @mentions, track-changes, approval workflow, issuance, amendment. This is where the differentiator lives: one finding, multiple pack vocabularies, correctly rendered in each.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 8
**Primary personas**: Priya (AIC), Marcus (CAE), Anjali (Staff)
**MVP phase**: 1.0

---

## 1. Feature overview

A finding is what an auditor produces when they identify an issue. It's the core output of audit work — the raw material for reports, the driver for Corrective Action Plans, the subject of Audit Committee discussions, the thing that peer reviewers examine.

In AIMS v2, a finding has:

- A **semantic core** keyed by canonical element codes (`CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, plus others per pack)
- **Per-pack extensions** stored as `standardExtensions: Record<StandardPackKey, Record<string, unknown>>` — e.g., Single Audit contributes `QUESTIONED_COSTS_KNOWN`, `FEDERAL_PROGRAM`, `REPEAT_FINDING`
- **Classifications** as an array, one per attached pack — a finding on a GAGAS + IIA engagement carries both a GAGAS deficiency-tier classification AND an IIA severity classification
- **Linked evidence** to specific work papers and documents
- **Recommendation** associations (M:N with recommendations)
- **Review/approval workflow** per `rules/workflow-state-machines.md §3`
- **Immutability** post-issuance (bitemporal history preserves amendments as new rows)

This spec covers the end-to-end authoring experience for MVP 1.0.

### 1.1 The differentiator — multi-standard rendering

A finding authored on Oakfield FY27 (GAGAS + IIA + Single Audit) renders differently in different reports:
- **Yellow Book report** — GAGAS's four-element structure (CRITERIA / CONDITION / CAUSE / EFFECT)
- **Audit Committee report** — IIA's five-element structure including inline recommendation
- **Schedule of Findings and Questioned Costs** — Single Audit's format with questioned-costs prominent

The auditor authors once; the system renders pack-appropriately. This is the single hardest UX challenge in MVP 1.0 because the auditor needs to understand they're writing once but the output is polyglot.

---

## 2. User stories — Authoring

### 2.1 US-FIND-001 — Priya creates a new finding from scratch

```gherkin
GIVEN Priya is AIC on Oakfield FY27 (GAGAS + IIA + Single Audit attached)
  AND engagement is in FIELDWORK
  AND she has identified an issue with federal grant expense coding
WHEN she clicks "New Finding" from the engagement's Findings tab
THEN a new finding is created with:
  - status: DRAFT
  - author: Priya
  - engagement: Oakfield FY27
  - applicableMethodologies: [GAGAS, IIA] (pre-populated from engagement's packs)
  - coreElements: empty (to be filled)
  - standardExtensions: empty (to be filled per pack)
  - classifications: empty (required at save)
  - title: "" (required)
  - evidenceReferences: []
  - associatedRecommendations: []
  - version: 1
  - auditEvent logged
```

**Acceptance criteria**:
- Finding creation p99 < 1s
- UI shows a multi-tab layout: Core Elements / GAGAS Details / IIA Details / Single Audit Details / Classifications / Evidence / Recommendations
- Required fields marked based on strictness resolver output per `strictness-resolver-rules.md §3.13`
- Save is draft-by-default (no content validation during draft state)

### 2.2 US-FIND-002 — Priya fills in the semantic core

```gherkin
GIVEN Priya is authoring finding 2026-001 (in DRAFT state)
WHEN she fills in:
  - title: "Federal Grant Expense Miscoding"
  - CRITERIA: "2 CFR 200.404 requires that all costs charged to a federal award be necessary, reasonable, and allocable. Per the grant agreement (NSF award 47.049), indirect costs must be charged using the federally-approved negotiated rate."
  - CONDITION: "Testing identified $127,400 in direct costs charged to administrative accounts (6100-series) rather than program accounts (4000-series)..."
  - CAUSE: "Grant accounting controls did not include procedures to validate initial expense coding..."
  - EFFECT: "Misstated financial reporting to NSF..."
THEN each element saves incrementally (auto-save every 30 seconds)
  AND rich-text formatting preserved (TipTap)
  AND @mentions in text trigger notifications
  AND the finding's version increments with each save
  AND bitemporal history preserved
```

**Acceptance criteria**:
- Rich-text editing via TipTap v2
- Auto-save every 30s in draft state; manual save button also available
- No content validation during draft state (validation fires at submit to IN_REVIEW)
- Words/characters count visible for guidance
- Document-level search within the finding (find the word "grant" across all elements)

### 2.3 US-FIND-003 — Priya fills in Single Audit extensions

```gherkin
GIVEN Priya is authoring 2026-001
  AND Single Audit overlay is attached to engagement
WHEN she opens the "Single Audit Details" tab
THEN she sees required fields from Single Audit pack:
  - QUESTIONED_COSTS_KNOWN: currency input
  - QUESTIONED_COSTS_LIKELY: currency input (can be estimated)
  - FEDERAL_PROGRAM: ALN lookup with auto-complete (47.049, 93.310, 81.049 etc.)
  - REPEAT_FINDING: boolean (yes/no)
  - COMPLIANCE_REQUIREMENT: select from Single Audit's 12 compliance requirements (ALLOWABLE_COSTS, ALLOWABLE_ACTIVITIES, CASH_MANAGEMENT, etc.)
  - FINDING_REFERENCE_NUMBER: auto-generated with bureau numbering convention
WHEN she fills in the fields
THEN values save to standardExtensions.SINGLE_AUDIT_2024
  AND validation per Single Audit pack rules fires
```

**Acceptance criteria**:
- Each pack's extensions are in their own tab (clear cognitive separation)
- Required fields marked with asterisk
- ALN auto-complete from ALN database (integrated data)
- Validation errors shown inline
- Tab marks show completion status (green check / red X / pending)

### 2.4 US-FIND-004 — Priya classifies the finding per applicable packs

```gherkin
GIVEN Priya has filled in the finding content
  AND the engagement has GAGAS + IIA + Single Audit attached
WHEN she opens "Classifications" tab
THEN she sees classification pickers per applicable pack:
  - GAGAS:2024 deficiency tier (required):
    ○ Deficiency
    ● Significant Deficiency (selected)
    ○ Material Weakness
  - IIA GIAS:2024 severity (required):
    ○ Advisory
    ○ Minor
    ● Major (selected)
    ○ Critical
  - Single Audit addendum:
    QUESTIONED_COSTS_KNOWN: $127,400 (from extensions)
    REPEAT_FINDING: No (from extensions)
    COMPLIANCE_REQUIREMENT: ALLOWABLE_COSTS (from extensions)
```

**Acceptance criteria**:
- Each pack's scheme shown with pack-declared definitions on hover
- Single Audit flags (QUESTIONED_COSTS, REPEAT_FINDING, etc.) shown as read-only (they come from standardExtensions)
- Cross-scheme hint visible: "Common equivalence: GAGAS Significant Deficiency ≈ IIA Major" (informational, not enforced)
- Save blocked if any classification scheme missing

### 2.5 US-FIND-005 — Priya links evidence from work papers

```gherkin
GIVEN Priya is authoring the finding
  AND the evidence is in work papers WP-2026-047 (grant expense testing) and WP-2026-051 (trial balance comparison)
WHEN she opens "Evidence" tab
  AND clicks "Link Work Paper"
  AND searches and selects WP-2026-047
  AND adds note: "See procedure step 3.2; sampled 25 of 100 transactions"
  AND adds another link to WP-2026-051 with note "Difference analysis"
THEN the evidence references are saved
  AND the work papers' "referenced by findings" field updates
  AND the finding's linked-evidence count is visible
```

**Acceptance criteria**:
- Multiple evidence items supported (at least 20 per finding realistic)
- Search supports partial work paper number, title
- Each reference has optional note/context (500 char limit)
- Bidirectional linkage (finding → work paper; work paper → finding)
- Evidence links preserved through amendments

### 2.6 US-FIND-006 — Priya drafts an associated recommendation

```gherkin
GIVEN Priya is authoring the finding
WHEN she opens "Recommendations" tab
  AND clicks "Draft Recommendation"
  AND fills in:
    - Recommendation text: "Implement quarterly reconciliation procedures between initial expense coding and approved program budgets for federal grants."
    - Target completion: 6 months
    - Assigned to: Oakfield's Grant Accountant (Michelle Zhao)
    - Presentation mode: INLINE (per IIA pack's declaration for IIA Audit Committee report)
THEN a new Recommendation entity is created
  AND M:N linkage to the finding established (this finding → recommendation; potentially other findings can also link)
  AND the recommendation's workflow state = DRAFT
```

**Acceptance criteria**:
- Recommendation is its own entity (not a field on finding); M:N per [`rules/workflow-state-machines.md §6`](../rules/workflow-state-machines.md)
- Presentation mode inheritable from pack's recommendationPresentation but overridable per-recommendation
- Multiple recommendations can be linked to one finding
- One recommendation can address multiple findings
- Recommendation workflow is lighter than finding workflow (per `workflow-state-machines.md §6.1`)

### 2.7 US-FIND-007 — Priya saves draft and continues later

```gherkin
GIVEN Priya has filled in 60% of the finding content
WHEN she clicks Save and closes the browser
  AND returns 2 hours later to the engagement
  AND opens the finding
THEN she sees:
  - Her draft content preserved
  - Auto-save timestamp ("Last saved 2 hours ago")
  - Bitemporal history available
  - Tabs showing completion status
```

**Acceptance criteria**:
- Draft state fully persistent (no data loss)
- UI shows saved state clearly
- Auto-save runs on any meaningful change (debounced)
- Close-before-save edge case: draft survives browser close

---

## 3. User stories — Review workflow

### 3.1 US-FIND-008 — Priya submits finding for review

```gherkin
GIVEN Priya has completed the finding content
  AND all required fields are filled
  AND classifications are set for every applicable pack
  AND at least one evidence reference exists
WHEN she clicks "Submit for Review"
THEN the finding transitions from DRAFT → IN_REVIEW
  AND applicable reviewers are notified based on engagement's approval chain per `rules/approval-chain-rules.md §3`
  AND bitemporal row appended (signaling submission)
  AND audit_event logged
  AND finding is now locked for content editing (comments still allowed)
```

**Acceptance criteria**:
- Validation runs at submit (required fields, classifications, evidence)
- Validation errors prevent submit; show all errors
- Notifications fire immediately after successful submit
- Reviewer queue populated

### 3.2 US-FIND-009 — Marcus reviews the finding and approves

```gherkin
GIVEN Marcus is CAE on Oakfield FY27
  AND finding 2026-001 is in IN_REVIEW state
WHEN he opens the review queue and clicks the finding
THEN he sees the finding with:
  - All tabs visible (read-only unless in edit mode)
  - Review comment area per section
  - Approval button: "Approve as presented" / "Request Revision" / "Reject"
  - Preview of how finding renders in Yellow Book report + Audit Committee report + Single Audit SFQC
WHEN he clicks "Approve as presented"
  AND confirms
THEN finding transitions IN_REVIEW → APPROVED
  AND Priya receives notification
  AND audit_event logged with Marcus's approval
  AND if any other approvers remain in the chain, they're notified next
  AND finding becomes included in engagement's "ready for inclusion in reports" list
```

**Acceptance criteria**:
- Preview shows actual rendering that will go in each report
- Comment-per-section feature for specific guidance
- Approval sequential per `approval-chain-rules.md §3.1`; multi-approver if material per `§3.3`
- Audit log captures approver identity, timestamp, and any comments

### 3.3 US-FIND-010 — Marcus requests revision

```gherkin
GIVEN Marcus is reviewing
  AND he thinks the CAUSE element is underdeveloped
WHEN he clicks "Request Revision"
  AND selects "CAUSE element needs strengthening"
  AND provides specific comment: "The cause description doesn't explain why the reconciliation control wasn't in place. Was it a policy gap or an operational breakdown?"
THEN finding transitions IN_REVIEW → DRAFT
  AND Priya receives notification with Marcus's feedback
  AND comment threads visible on the CAUSE element
  AND Priya can revise and resubmit
```

**Acceptance criteria**:
- Revision comments anchor to specific element (not general)
- Comments thread (Marcus → Priya reply → Marcus)
- Unresolved comments must be resolved before resubmission
- Review history maintained

### 3.4 US-FIND-011 — Priya responds to revision request

```gherkin
GIVEN Priya received revision request with comment on CAUSE element
WHEN she opens the finding
  AND updates CAUSE content
  AND replies to Marcus's comment: "Reworded with more detail about the policy gap; also referenced the controls self-assessment from 2024"
  AND marks comment resolved
  AND resubmits
THEN finding transitions DRAFT → IN_REVIEW
  AND Marcus is notified of resubmission with comment context
  AND full history preserved
```

**Acceptance criteria**:
- Revision → resubmit cycle maintains all prior comments/context
- Reviewer sees diff between prior and revised versions
- Resolution of comments tracked

### 3.5 US-FIND-012 — QAIP reviewer review (when applicable)

```gherkin
GIVEN the engagement attached IIA_GIAS:2024
  AND finding 2026-001 is classified IIA Major (material per IIA GIAS Standard 15)
  AND approval chain per `approval-chain-rules.md §3.2` requires QAIP reviewer
WHEN the QAIP reviewer is designated
  AND reviews the finding in parallel with CAE
THEN both approvals required for APPROVED state
  AND QAIP reviewer's review is focused on methodology adherence (not just substantive content)
  AND both can request revision or approve
```

**Acceptance criteria**:
- Parallel approval chain renders as stacked review cards
- Both approvers see the same content; comments are independent
- Finding reaches APPROVED only when all required approvers approve

---

## 4. User stories — Issuance

### 4.1 US-FIND-013 — Priya includes finding in Yellow Book report

Covered in [`report-generation.md`](report-generation.md). Summary:

- Priya opens Yellow Book report composition
- Selects findings to include
- 2026-001 selected with "APPROVED" status
- Report composition renders 2026-001 in GAGAS format

### 4.2 US-FIND-014 — Report is issued, finding transitions to ISSUED

```gherkin
GIVEN Yellow Book report is approved for issuance
  AND finding 2026-001 is included in the report
WHEN CAE signs/issues the report per `workflow-state-machines.md §4`
THEN finding 2026-001 transitions APPROVED → ISSUED
  AND finding's content becomes immutable
  AND finding's AMENDMENT path activates (only way to change it now)
  AND CAP workflow for this finding enters AWAITING_AUDITEE state
  AND management response window begins (30 days per strictness resolver)
  AND notifications to auditee (David) and CAE sent
  AND webhook `finding.issued` fires
  AND audit_event with hash-chain entry logged
```

**Acceptance criteria**:
- Issuance is transaction-safe (all entities + audit log together)
- Immutability enforced via DB triggers per ADR architecture
- Webhook delivery via transactional outbox per ADR-0004

### 4.3 US-FIND-015 — Amendment (post-issuance change)

```gherkin
GIVEN finding 2026-001 is ISSUED
  AND Priya discovered new information: actually, questioned costs are $140k, not $127,400
WHEN she requests amendment (needs CAE approval)
  AND Marcus approves with rationale: "Revised per post-issuance evidence review on 2028-03-05"
  AND Priya edits finding content with new figures
  AND resubmits for approval
  AND Marcus approves the amended version
THEN bitemporal history captures both versions
  AND amendment workflow runs per `workflow-state-machines.md §3.6`
  AND affected reports (Yellow Book, Schedule of Findings and Questioned Costs) are re-generated (optional: auto-regenerate or flag for manual)
  AND Audit Committee notified of amendment
  AND audit_event with elevated severity logged
```

**Acceptance criteria**:
- Amendment initiation requires CAE approval (not AIC)
- Rationale minimum 100 chars
- All originally-issued artifacts preserved (bitemporal)
- Report re-generation is opt-in; CAE decides whether re-issue
- Amendment notification includes change summary

---

## 5. User stories — Inline comments and collaboration

### 5.1 US-FIND-016 — Priya @mentions Anjali for a question

```gherkin
GIVEN finding 2026-001 is in DRAFT
  AND Priya is unsure about the exact dollar amount of questioned costs
WHEN she adds an inline comment in the CONDITION element:
  "@Anjali — can you verify the sampled transactions add up to $127,400 or $127,483?"
THEN Anjali receives notification (in-app + email digest)
  AND can reply inline: "@Priya confirmed: $127,400 is correct; I'll add the reconciliation to WP-2026-047"
  AND Priya can mark comment resolved when she's satisfied
```

**Acceptance criteria**:
- @mentions autocomplete engagement team members
- Comment threads nest replies
- Resolution flag visible to all viewers
- Notifications fire via unified notification center (Module 16a)

### 5.2 US-FIND-017 — Track-changes during finalisation (rich-text fields only)

```gherkin
GIVEN finding is in IN_REVIEW
  AND Marcus as reviewer wants to tweak the CONDITION element slightly (a rich-text field)
WHEN he clicks "Track Changes" on the CONDITION element
  AND makes a small text edit (adding context)
  AND saves
THEN the change appears as a tracked change (strikethrough + insertion)
  AND Priya is notified of the tracked change
  AND Priya can accept or reject the change
WHEN Priya clicks Accept
THEN the change becomes part of the finding
  AND the tracked change artifact is retained in history
```

**Acceptance criteria**:
- **Track-changes is scoped to rich-text (TipTap) fields only**: the semantic-core elements (CRITERIA, CONDITION, CAUSE, EFFECT, RECOMMENDATION text, title) support TipTap-based track-changes with inline annotations.
- **Structured metadata fields do NOT use track-changes**: classifications, per-pack extension values (QUESTIONED_COSTS_KNOWN currency, REPEAT_FINDING boolean, FEDERAL_PROGRAM select, etc.), evidence references, recommendation links. Changes to these fields follow a lighter pattern:
  - Every change creates a bitemporal row (per existing bitemporal design)
  - The comment thread receives an automatic entry: "Marcus changed Classification from `Significant Deficiency` to `Material Weakness` on 2028-03-05 14:22"
  - Priya is notified of the structured-metadata change
  - Priya can respond in the comment thread, but there's no inline "accept/reject" UI for structured metadata — the change is already applied; Priya's response becomes a record in the discussion thread
- Changes visible with author + timestamp across both patterns
- Rich-text track-changes: accept/reject per inline change
- Structured-metadata changes: bitemporal history + comment-thread annotation
- All changes preserved in audit trail; exportable for peer review evidence

**Why split the pattern**: implementing robust cross-field TipTap track-changes across a complex multi-tab form would be bug-prone and hard to maintain. The rich-text surface (narrative fields) is where track-changes is genuinely useful — that's where reviewers suggest substantive wording tweaks. Structured fields rarely need iterative negotiation; the classification picker is a decision, not a draft-and-tweak surface. Using bitemporal + comment notifications for structured changes simplifies the engineering surface without losing audit trail.

---

## 6. Edge cases

### 6.1 Engagement pack changes mid-finding

If pack attachments change while a finding is in draft (e.g., SOC2:2017 added mid-engagement per `engagement-management.md §2.2`):
- Finding's applicableMethodologies array updates
- If the new pack declares finding elements, the finding's tabs reflect those new requirements
- Required fields re-validated at next save
- Notifications sent to finding author

### 6.2 Classification picker change affects resolved rules

If the auditor changes classification from Significant Deficiency to Material Weakness:
- Approval chain per `approval-chain-rules.md §3.3` may change (higher approval threshold)
- Finding re-enters review if previously approved
- Notifications to affected approvers

### 6.3 Parallel editing conflict

If Priya and Anjali are both editing the finding simultaneously:
- Optimistic concurrency: each edit has version; last-write-wins with conflict resolution
- UI shows "Another user is editing" warning
- Conflict resolution UI lets user merge or choose

### 6.4 Finding rejection by approver (ABANDONED)

If CAE rejects rather than requests revision (indicating "this doesn't rise to finding level"):
- Finding transitions to ABANDONED state
- Finding remains in system for audit trail
- Can be converted to observation if relevant
- Related evidence remains linked

### 6.5 Multiple recommendations for one finding

Priya can link multiple recommendations to one finding. Example: finding about weak grant controls → 3 recommendations (implement reconciliation, update policies, train staff).

### 6.6 Same recommendation for multiple findings

One recommendation can address multiple findings. Example: "Implement quarterly reconciliation" might address findings 2026-001, 2026-004, and 2026-012. M:N relationship enforced.

### 6.7 Finding amendment disagreement

If Priya wants to amend but CAE refuses:
- Amendment is blocked
- Conflict requires Audit Function Director escalation
- If disagreement persists, it's an audit-department-level governance issue

### 6.8 Post-engagement-closure amendment

If engagement is CLOSED and a finding needs amendment:
- Engagement must be reopened (per `workflow-state-machines.md §2.6`)
- All cascading effects handled
- Limited to CAE-initiated; high friction

---

## 7. Data model touch points

Per `data-model/tenant-data-model.ts`:

- `Finding` — the core entity with bitemporal fields (validFrom, validTo, transactionFrom, transactionTo)
- `FindingClassification` — per-pack classification
- `FindingEvidence` — links to work papers
- `FindingComment` — inline + resolution-tracked comments
- `FindingReviewSubmission` — each submit/revise cycle tracked
- `Recommendation` — separate entity, M:N to findings
- `AuditEvent` — hash-chain audit entries for every state change

---

## 8. API endpoints

### 8.1 tRPC procedures

```typescript
// Lifecycle
finding.create(input: FindingCreateInput): Finding
finding.update(input: FindingUpdateInput): Finding  // incremental in draft state
finding.submitForReview(input: {findingId}): Finding  // DRAFT → IN_REVIEW
finding.approve(input: {findingId, comment?}): Finding  // IN_REVIEW → APPROVED
finding.requestRevision(input: {findingId, comments}): Finding  // IN_REVIEW → DRAFT
finding.reject(input: {findingId, reason}): Finding  // IN_REVIEW → ABANDONED
finding.issue(input: {findingId}): Finding  // part of report issuance; see report-generation.md

// Amendment
finding.initiateAmendment(input: {findingId, rationale}): Finding
finding.submitAmendment(input: {findingId, newContent}): Finding
finding.approveAmendment(input: {findingId}): Finding

// Content
finding.get(input: {findingId}): Finding
finding.list(input: {engagementId, filter, sort, pagination}): PaginatedFindings
finding.getHistory(input: {findingId}): FindingHistory[]
finding.getPreview(input: {findingId, forPackRef}): FindingRendering

// Evidence
finding.linkEvidence(input: {findingId, workPaperId, note?}): EvidenceLink
finding.unlinkEvidence(input: {evidenceLinkId}): void

// Recommendations
finding.associateRecommendation(input: {findingId, recommendationId}): void
finding.dissociateRecommendation(input: {findingId, recommendationId}): void

// Comments
finding.addComment(input: {findingId, elementCode?, content, mentions}): Comment
finding.replyToComment(input: {commentId, content}): Comment
finding.resolveComment(input: {commentId}): Comment

// Bulk
finding.bulkUpdate(input: {findingIds, operation, context}): BulkUpdateJob
```

### 8.2 REST endpoints

`GET /v1/findings`, `GET /v1/engagements/:id/findings`, `POST /v1/findings`, `PATCH /v1/findings/:id`, `POST /v1/findings/:id/submit`, `POST /v1/findings/:id/approve`, etc.

### 8.3 Webhook events

- `finding.created`
- `finding.submitted`
- `finding.approved`
- `finding.issued`
- `finding.amended`
- `finding.rejected`
- `finding.comment.added`

---

## 9. Permissions

| Role | Create | Edit draft | Submit for review | Approve | Request revision | Reject | Initiate amendment | Issue |
|---|---|---|---|---|---|---|---|---|
| AIC (Priya) | ✅ | ✅ (her findings) | ✅ | ❌ | ❌ | ❌ | ❌ (CAE only) | ❌ (report-level) |
| Staff (Anjali) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CAE (Marcus) | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Function Director | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| QAIP Reviewer | ❌ | ❌ | ❌ | ✅ (if assigned per material-finding path) | ✅ | ❌ | ❌ | ❌ |

---

## 10. Observability

- `finding.create.count` (counter)
- `finding.submit.count`
- `finding.approve.count`
- `finding.issue.count`
- `finding.amend.count`
- `finding.review.duration` (histogram — time from submit to approve/request-revision)
- `finding.revision.count` (counter — tracks revision loops)

---

## 11. Performance characteristics

- Finding creation p99 < 1s
- Finding save (draft incremental) p99 < 300ms
- Finding get p99 < 500ms
- Finding list (engagement) p99 < 1s
- Finding preview rendering p99 < 2s

Scale:
- 30 findings per engagement typical
- 200 findings per engagement at upper bound
- 10k findings per tenant per year

---

## 12. Compliance implications

- **GAGAS §6.39**: four finding elements — satisfied by semantic core
- **GAGAS §6.40-6.45**: classification tiers — satisfied by classification picker
- **IIA GIAS Standard 11.1**: 5-element finding with inline recommendation — satisfied via finding + recommendation M:N
- **ISO 19011 §6.4**: nonconformity structure — satisfied via ISO pack's finding element mapping
- **Single Audit 2 CFR 200.516**: finding content requirements — satisfied by SINGLE_AUDIT pack extensions
- **PCAOB AS 1005 / AS 1305**: deficiency evaluation + recommendations treatment — satisfied via classification + recommendationPresentation modes

Audit trail requirements:
- Every state change logged with approver identity
- Bitemporal history preserves all amendments
- Supervisory review evidence per GAGAS §6.33

---

## 13. Dependencies

### 13.1 Upstream

- Engagement (must exist; this is a finding on an engagement)
- Pack attachments (drives finding elements required)
- Work papers (evidence references)
- Classification schemes (per attached pack)

### 13.2 Downstream

- Reports (findings included in reports)
- Recommendations (associated)
- CAPs (triggered by issuance)
- Summary Schedule of Prior Audit Findings (references historical findings)

---

## 14. UX references

Detailed UX in [`ux/finding-authoring.md`](../ux/finding-authoring.md) (Phase 6 pending).

Key UX:
- **Multi-tab layout** — Core Elements / GAGAS / IIA / Single Audit / Classifications / Evidence / Recommendations / Comments
- **Rich text editor** (TipTap v2) — full formatting, @mentions, tables, code blocks
- **Live preview per pack** — shows how finding will render in each target report
- **Classification picker** — stacked, per-scheme, with hover definitions
- **Track changes** — element-scoped, accept/reject per change
- **Comment system** — inline anchors + thread

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 8 — feature inventory
- [`rules/workflow-state-machines.md §3`](../rules/workflow-state-machines.md) — finding state machine
- [`rules/approval-chain-rules.md §3`](../rules/approval-chain-rules.md) — finding approval chains
- [`rules/classification-mappings.md`](../rules/classification-mappings.md) — per-pack classification schemes
- [`features/engagement-management.md`](engagement-management.md) — engagement context
- [`features/pack-attachment-and-annotation.md`](pack-attachment-and-annotation.md) — pack attachment
- [`features/report-generation.md`](report-generation.md) — finding inclusion in reports
- [`features/recommendations-and-caps.md`](recommendations-and-caps.md) — recommendation workflow
- [`data-model/tenant-data-model.ts`](../../data-model/tenant-data-model.ts) — Finding entity
- [`docs/02-worked-example-single-audit.md`](../../docs/02-worked-example-single-audit.md) — Oakfield 2026-001 worked example

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§5.2 — track-changes scope**: reviewer correctly flagged that implementing robust track-changes across a complex multi-field form is bug-prone. Fix: track-changes is now **scoped to rich-text (TipTap) fields only** (CRITERIA, CONDITION, CAUSE, EFFECT, RECOMMENDATION text, title). Structured metadata changes (classifications, per-pack extensions, evidence links, currency fields) follow a lighter pattern: bitemporal history + automatic comment-thread annotations like "Marcus changed Classification from `Significant Deficiency` to `Material Weakness`." Accept/reject applies to inline rich-text changes only; structured changes are logged and annotated but not inline-reviewable.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
