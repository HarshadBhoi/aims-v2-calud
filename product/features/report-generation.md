# Report Generation

> The multi-report-from-one-finding differentiator, concretely. One engagement → two reports in MVP 1.0 (Yellow Book + Schedule of Findings and Questioned Costs) with compliance-statement builder, PDF rendering, review workflow, CAE signing/issuance, and Annual Summary Report. Report template variety expands to 7+ reports in MVP 1.5; DOCX in v2.1; PCAOB templates in v2.1.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 10
**Primary personas**: Priya (AIC), Marcus (CAE), Audit Committee reviewers (external)
**MVP phase**: 1.0 (2 reports + Annual Summary); expanded to 7+ in 1.5

---

## 1. Feature overview

Reports are the external-facing deliverable of audit work. MVP 1.0 ships two pack-driven report templates:

1. **Yellow Book Report** (attestsTo: GAGAS:2024) — GAGAS §6.02 structure with GAGAS's four-element finding vocabulary
2. **Schedule of Findings and Questioned Costs** (attestsTo: SINGLE_AUDIT:2024) — 2 CFR 200.516(a) structure for Single Audit engagements

Plus the **Annual Summary Report** (the CAE-level Board deliverable).

Each report:
- Declares `attestsTo: StandardPackRef` — which pack it conforms to
- Includes a `includedFindingIds: string[]` — findings cross-listed into the report
- Renders findings pack-appropriately (GAGAS vocabulary in Yellow Book; Single Audit vocabulary in Schedule of Findings)
- Uses the **compliance-statement builder** to auto-assemble the "conducted in accordance with..." sentence from the engagement's attached packs
- Goes through a multi-stage approval chain per `rules/approval-chain-rules.md §4`
- Is formally signed and issued by the CAE; issuance locks content
- Distributed per distribution list
- Subject to amendment after issuance (high-friction, CAE-initiated)

### 1.1 The 2-report compression

Per [`04-mvp-scope.md §2.2 Module 10`](../04-mvp-scope.md) and [`features/engagement-management.md`](engagement-management.md), MVP 1.0 ships 2 reports + Annual Summary. The other 5 Single Audit reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP as formal report, Engagement Letter) are produced via professional services during MVP 1.0 era and ship natively in MVP 1.5. This is the explicit compression from the original 7-report plan per the Phase 1 R1 review.

Implication: a Single Audit customer on MVP 1.0 gets:
- Yellow Book report (automated)
- Schedule of Findings and Questioned Costs (automated)
- The other 5 reports produced manually by AIMS professional services included in their contract

MVP 1.5 removes this manual component and ships native automation for all 7.

### 1.2 The differentiator, concretely

One engagement, one set of findings, two reports — each rendering the same finding differently:

**Yellow Book report** renders finding 2026-001 as:
> **Finding 2026-001 — Federal Grant Expense Miscoding**
> 
> **Criteria**: 2 CFR 200.404 requires that all costs charged to a federal award be necessary, reasonable, and allocable...
> 
> **Condition**: Testing identified $127,400 in direct costs charged to administrative accounts...
> 
> **Cause**: Grant accounting controls did not include procedures to validate initial expense coding...
> 
> **Effect**: Misstated financial reporting to NSF...
> 
> *Classification: Significant Deficiency*
> 
> *Recommendation [separate section]*: Implement quarterly reconciliation procedures...

**Schedule of Findings and Questioned Costs** renders finding 2026-001 as:
> **Finding 2026-001 — Federal Grant Expense Miscoding**
> 
> **Federal Program(s) Affected**: NSF (47.049) — $87,400; NIH (93.310) — $25,000; DOE (81.049) — $15,000
> 
> **Questioned Costs (Known)**: $127,400
> 
> **Questioned Costs (Likely)**: $340,000
> 
> **Compliance Requirement**: Allowable Costs
> 
> **Repeat Finding**: No
> 
> **[Same narrative as Yellow Book]**
> 
> *Classification: Significant Deficiency*

Same finding. Pack-appropriate vocabulary in each report.

---

## 2. User stories — Report composition

### 2.1 US-REP-001 — Priya creates a Yellow Book report

```gherkin
GIVEN Oakfield FY27 has GAGAS:2024 + IIA_GIAS:2024 + SINGLE_AUDIT:2024 + SOC2:2017 attached
  AND engagement is in REPORTING phase
  AND findings are all APPROVED
WHEN Priya opens engagement → Reports tab
  AND clicks "New Report"
  AND selects report template: "Yellow Book Report" (attestsTo: GAGAS:2024)
  AND confirms
THEN a new Report entity is created with:
  - attestsTo: GAGAS:2024
  - status: DRAFT
  - includedFindingIds: [] (to be populated)
  - sections: template-populated from GAGAS:2024 pack's report template
  - draft composition: pre-filled with engagement metadata (auditee name, period, scope)
  - complianceStatement: auto-generated from attached packs (see §2.4)
  - distribution list: template-populated with default recipients
```

**Acceptance criteria**:
- Report entity creation p99 < 500ms
- Template populates all GAGAS §6.02 required sections (cover, table of contents, executive summary, objectives, scope, methodology, findings, recommendations, response, signatures)
- Compliance statement builder runs at composition time and again at issuance
- User can customize template sections (add optional sections, reorder within constraints)

### 2.2 US-REP-002 — Priya selects findings to include

```gherkin
GIVEN the report is in DRAFT
  AND the engagement has 15 approved findings
WHEN Priya opens the Findings selector
THEN she sees a grid of the 15 findings with:
  - Finding ID, title, classification per attached pack
  - Selection checkbox
  - "Applicable to this report" indicator (all GAGAS-applicable findings default checked)
WHEN she selects 12 of the 15 (the 3 excluded are IIA-only findings that don't belong in Yellow Book)
  AND clicks "Update Report"
THEN includedFindingIds is updated with the 12
  AND each included finding's rendering preview updates in real-time
  AND audit_event logged
```

**Acceptance criteria**:
- Findings selector shows filter by classification, status, date
- Selection UI batch-friendly (multi-select support)
- Default inclusion logic: "all findings applicable to this report's attestsTo pack"
- Remove from report deletes the cross-listing (finding still exists in engagement; just not in this report)

### 2.3 US-REP-003 — Priya composes narrative sections

```gherkin
GIVEN report is in DRAFT
  AND standard sections are template-populated
WHEN Priya edits:
  - Executive Summary
  - Background / Context
  - Methodology
  - Findings (auto-populated but she can add transition narrative)
  - Conclusions
THEN all section edits saved via incremental auto-save
  AND rich-text editing (TipTap)
  AND @mentions for review coordination
  AND track-changes available if desired
```

**Acceptance criteria**:
- Same rich-text editor as findings
- Auto-save every 30s
- Template sections cannot be deleted; custom sections can
- Section reordering supported within template constraints (GAGAS §6.02 has an ordering requirement)

### 2.4 US-REP-004 — Compliance statement builder generates "conducted in accordance with"

```gherkin
GIVEN report is DRAFT with 12 findings included
  AND attached packs are GAGAS:2024 + IIA_GIAS:2024 + SINGLE_AUDIT:2024 + SOC2:2017
  AND conformanceClaimed flags are: GAGAS=true, IIA=true, SINGLE_AUDIT=true, SOC2=false (SOC2 is for vendor testing scope; not claimed in Yellow Book)
WHEN the compliance statement builder runs at composition time
THEN it generates the "conducted in accordance with" paragraph:
  "We have audited, in accordance with the auditing standards generally accepted in the United States of America and the standards applicable to financial audits contained in Government Auditing Standards (GAGAS) issued by the Comptroller General of the United States. We also conducted our audit in accordance with the Global Internal Audit Standards (GIAS) of the Institute of Internal Auditors, as permitted by GAGAS §2.01. Our audit was performed pursuant to the Single Audit Act of 1984, as amended, and the Uniform Administrative Requirements, Cost Principles, and Audit Requirements for Federal Awards (2 CFR Part 200). [followed by standard paragraphs per GAGAS §6.02]"
  AND this statement is placed in the report's "Basis for Audit Report" section
  AND version-tracked with the report
```

**Acceptance criteria**:
- Compliance statement builder runs at composition and re-runs at issuance
- Output format preserves pack-prescribed language verbatim
- Builder handles:
  - Single methodology (just GAGAS)
  - Methodology + overlay (GAGAS + Single Audit)
  - Multiple methodologies (GAGAS + IIA as "in conjunction with")
- Builder fails gracefully if pack attachment is incomplete (missing expected pack)

### 2.5 US-REP-005 — Priya previews the PDF rendering

```gherkin
GIVEN report is in DRAFT with all content composed
WHEN Priya clicks "Generate PDF"
THEN a PDF is generated asynchronously (via NestJS worker per ADR-0003)
  AND she receives the preview in-app (within 60s)
  AND the PDF shows:
    - Cover page with tenant branding
    - Table of contents
    - All sections with finding renderings
    - Compliance statement
    - Distribution list
    - Page numbers and headers per GAGAS §6.02
```

**Acceptance criteria**:
- PDF generation p99 < 30s per `04-mvp-scope.md §5.2`
- PDF quality suitable for formal distribution (not a rough preview)
- Preview differs from final issued PDF only in the "PREVIEW" watermark
- Tenant branding (logo, letterhead) per tenant settings

**Note on PDF generation cadence**: PDF generation is for formal output (final issuance, distribution). It is **not** the primary authoring surface. Auditors doing iterative tweaking of page breaks and layout should use the HTML preview (§2.6) which supports print-media simulation. PDF generation should be invoked at natural gates (pre-review PDF, final issuance PDF), not every minute during composition. A 30-second turnaround for a genuinely formal PDF is acceptable; a 30-second turnaround for each page-break adjustment would be miserable.

### 2.6 US-REP-006 — HTML preview with print-media simulation

```gherkin
GIVEN report is in DRAFT
WHEN Priya or Marcus opens the report's HTML preview
THEN they see the same content rendered in browser AS IT WOULD APPEAR PRINTED
  AND navigation between sections via TOC
  AND findings are clickable (opens finding detail in side panel)
  AND design matches the PDF rendering closely
  AND page breaks are visible at the correct page-height thresholds
  AND orphan/widow warnings highlighted
  AND headers/footers render per print layout
```

**Acceptance criteria**:
- HTML preview p99 < 2s
- Design parity with PDF (within practical limits)
- **Print-media simulation**: uses CSS `@media print` + `page-break-inside: avoid` + `page-break-before` / `page-break-after` rules to accurately simulate how the PDF will paginate. This is non-negotiable — auditors must be able to see "will the recommendation orphan onto the next page" without generating a full PDF
- **Explicit page-break controls in the editor**: Priya can insert a hard page break before any section / finding with a visible "↵ Page Break" button. Soft page breaks suggested automatically based on content length
- **Page count displayed** in real-time as she composes (e.g., "Approximately 34 pages")
- **Print preview view** accessible with Ctrl+P style: shows the rendered layout at actual page dimensions, with visible page boundaries
- Accessibility: WCAG 2.1 AA
- Keyboard navigation, screen-reader compatibility
- Widow and orphan detection: if a finding's Recommendation would orphan onto a new page alone, a subtle warning indicator appears with a one-click fix ("Insert page break before this finding?")

**Why this matters**: auditors care deeply about report layout. A finding whose Recommendation section is orphaned onto a new page alone looks sloppy and draws reviewer criticism. If Priya has to generate a full PDF (~30s each) just to see if her page-break tweak worked, iterative layout refinement becomes agonizing. The HTML preview must be the primary layout-tuning surface; PDF generation is for formal output only.

---

## 3. User stories — Review workflow

### 3.1 US-REP-007 — Priya submits report for review

```gherkin
GIVEN report is in DRAFT with all content composed
  AND all included findings are in APPROVED state
  AND compliance statement generated
  AND distribution list set
WHEN Priya clicks "Submit for Review"
THEN report transitions DRAFT → IN_REVIEW
  AND applicable reviewers notified per `rules/approval-chain-rules.md §4`
  AND content locked (read-only; reviewers can only comment or track-change)
  AND audit_event logged
```

**Acceptance criteria**:
- Submit runs validation: all findings APPROVED, compliance statement generated, distribution list populated
- Invalid submit shows detailed errors
- Notifications fire immediately

### 3.2 US-REP-008 — Reviewers complete their review per chain

```gherkin
GIVEN report is in IN_REVIEW
  AND approval chain per `approval-chain-rules.md §4.2` for Oakfield + GAGAS + Single Audit is:
  1. AIC (Priya) — compose (done)
  2. Senior Manager — review
  3. Legal Review (if politically sensitive; optional)
  4. CAE (Marcus) — approve
  5. CFO Acknowledgement (on DCF portion; applies once the Single Audit DCF workflow runs)
  6. Issuance Authority — sign
WHEN Senior Manager completes review and approves
THEN report status indicates "Senior Manager approved"
  AND next reviewer (optionally Legal, then CAE) is notified
WHEN each approver acts, they can:
  - Approve
  - Request revision with specific comments
  - Reject (rare)
WHEN all approvers approve
THEN report transitions IN_REVIEW → APPROVED
```

**Acceptance criteria**:
- Sequential approval chain (except where parallel per pack rules)
- Each reviewer's approval/revision logged with identity + timestamp
- Revision requests returns report to DRAFT for author revision
- Legal review is optional (CAE can skip for non-sensitive engagements)

### 3.3 US-REP-009 — Track-changes during review

```gherkin
GIVEN report is in IN_REVIEW
  AND Senior Manager wants to suggest a word change in Executive Summary
WHEN Senior Manager activates Track Changes
  AND makes the edit
  AND saves
THEN change shown as tracked change with strikethrough + insertion
  AND Priya notified
  AND Priya can accept/reject the change
WHEN Priya accepts
THEN change incorporated; tracked-change artifact retained for audit trail
WHEN Priya rejects
THEN change reverted; reviewer notified
```

**Acceptance criteria**:
- Per-section track changes
- Accept/reject per change
- Change history preserved
- Not all reviewers may use track-changes; comments alternative available

---

## 4. User stories — Issuance

### 4.1 US-REP-010 — Marcus (or Issuance Authority) signs and issues

```gherkin
GIVEN report is in APPROVED state
  AND all approvers have signed off
  AND Marcus is designated Issuance Authority (or CAE, which is the same person here)
WHEN Marcus clicks "Sign and Issue"
  AND confirms (prompted for final sign-off)
THEN report transitions APPROVED → ISSUED
  AND all included findings transition APPROVED → ISSUED (per `workflow-state-machines.md §3.5`)
  AND report content becomes immutable
  AND distribution list finalized
  AND CAP workflow for each finding transitions to AWAITING_AUDITEE
  AND management response window begins (per resolver)
  AND webhook `report.issued` fires
  AND audit_event with CAE signature logged (hash-chained)
  AND distribution notifications sent to all recipients
  AND official PDF generated (replacing any preview versions)
```

**Acceptance criteria**:
- Issuance is transactional (all entities + audit log together)
- Immutability enforced via DB triggers per ADR architecture
- Webhook via transactional outbox per ADR-0004
- PDF generated async but URL ready within 60s
- Distribution email sent with link to PDF and brief summary

### 4.2 US-REP-011 — Report distributed to recipients

```gherkin
GIVEN report is ISSUED
  AND distribution list contains:
  - Oakfield CFO (David) — auditee response contact
  - Oakfield President — senior executive
  - Oakfield Audit Committee Chair — governance
  - State Controller's Office — regulatory
  - (GAGAS distribution requirements per engagement)
WHEN distribution executes
THEN each recipient receives:
  - Email with report PDF attached (or secure link if over size limit)
  - Brief summary of findings
  - Management response window reminder (for auditee contact)
  - Webhook event fired
AND webhook includes metadata about who was notified
```

**Acceptance criteria**:
- Distribution via outbound email with DKIM-signed tenant identity (per Module 16a)
- Large PDFs distributed via signed secure link (30-day expiration)
- Delivery confirmation tracked; failures logged
- Recipient can reply to email; reply ingested per auditee email handling (Module 7a pattern)

### 4.3 US-REP-012 — Schedule of Findings and Questioned Costs issued

```gherkin
GIVEN the Yellow Book report is ISSUED
  AND Oakfield FY27 is a Single Audit engagement
WHEN Priya creates the companion "Schedule of Findings and Questioned Costs" report
  AND sets attestsTo: SINGLE_AUDIT:2024
  AND selects the same findings (cross-listed)
  AND the template renders Single Audit format
  AND approval chain runs
  AND Marcus issues
THEN the Schedule of Findings is ISSUED
  AND the same findings now exist in two formal reports
  AND both reports reference the same finding IDs
  AND distribution list different from Yellow Book (Federal Audit Clearinghouse included)
  AND hash-chained audit events logged for both
```

**Acceptance criteria**:
- Same findings rendered differently in Yellow Book vs. Schedule of Findings
- Cross-listing visible on each finding (shows "included in reports: [Yellow Book, Schedule of Findings]")
- Audit trail tracks both issuances independently

### 4.4 US-REP-013 — Annual Summary Report (CAE deliverable)

```gherkin
GIVEN fiscal year is closing
  AND Marcus needs to produce the Annual Summary Report for the Audit Committee
WHEN Marcus opens Annual Report → Create
  AND selects fiscal year: 2027
  AND confirms
THEN Annual Report template populates with:
  - Coverage: engagements completed during the year (all issued reports)
  - Executive summary (AI-assisted drafting is v2.2+; MVP has CAE manual drafting)
  - Engagement-by-engagement summary
  - Findings dashboard: classification distribution, trending
  - CAP status: completion rates, overdue, escalations
  - Risk trending: audit universe risks
  - Peer review evidence status
  - CPE compliance summary (organisational level)
  - Planned next-year engagements
WHEN Marcus reviews, edits, and approves
THEN Annual Report issued to Audit Committee
```

**Acceptance criteria**:
- Annual Report auto-aggregates data from engagements within the fiscal year
- CAE can customize sections
- PDF rendering as with other reports
- Approved report archived and referenced in next year's plan

---

## 5. User stories — Amendment

### 5.1 US-REP-014 — CAE initiates amendment of issued report

Covered in [`workflow-state-machines.md §4.5`](../rules/workflow-state-machines.md) and [`finding-authoring.md §4.3`](finding-authoring.md). Summary:

- Marcus initiates amendment with rationale (min 100 chars)
- Amended report goes through full approval chain
- New version issued; original remains immutable
- Distribution list notified of amendment
- Bitemporal history preserved

---

## 6. Edge cases

### 6.1 Finding in report transitions to amendment state

If a finding in an already-issued report is amended, the report's bitemporal history preserves the state at issuance. The amended finding creates a new bitemporal row. The auditor can choose to re-issue the report (new version) or leave the original report with the historical finding state.

### 6.2 Report generated but not issued

A report can live in APPROVED state indefinitely without issuance if issuance timing is deferred. This is common — AIC wants the report ready but CAE wants to time the public release.

### 6.3 Compliance statement changes after issuance

If a pack attachment changes after report issuance (unlikely but possible), the original report's compliance statement is preserved. Future reports from the engagement get the new compliance statement.

### 6.4 Report with zero findings

A report can be composed and issued with zero findings. The report still contains:
- Executive summary
- Scope and methodology
- "No findings identified" statement
- Signatures and distribution

### 6.5 PDF generation failure

If PDF worker fails (timeout, service issue):
- Report stays in current state; PDF is not created
- User sees error + retry option
- Worker retries per DLQ pattern per `devops/QUEUE-CONVENTIONS.md`
- If sustained failure, incident logged for Ravi's investigation

### 6.6 Concurrent report composition by multiple users

Optimistic concurrency per version field. If Priya and Marcus both edit simultaneously:
- Last write wins; conflict detection
- Merge resolution supported (manual)

### 6.7 Template doesn't fit tenant needs

Tenant can customize templates (limited in MVP 1.0 to predefined fields and ordering within GAGAS §6.02 structure). Full template authoring is v2.2+.

### 6.8 Distribution to email-invalid recipient

If recipient email bounces:
- Failure logged
- Retry per webhook retry policy
- If sustained failure, surface to AIC/CAE dashboard
- Exception workflow: CAE can manually deliver (PDF email; phone follow-up)

---

## 7. Data model touch points

Per `data-model/tenant-data-model.ts`:

- `Report` — primary entity (fields: id, tenantId, engagementId, attestsTo, status, sections, includedFindingIds, complianceStatement, distributionList, issuedAt, issuedBy, versions)
- `ReportApproval` — per-approver approvals (identity, timestamp, comment)
- `ReportVersion` — bitemporal version history
- `ReportDistribution` — per-recipient distribution tracking
- `ReportGenerationJob` — async PDF generation job tracking
- `AuditEvent` — hash-chained audit entries

---

## 8. API endpoints

### 8.1 tRPC procedures

```typescript
// Lifecycle
report.create(input: {engagementId, template}): Report
report.update(input: ReportUpdateInput): Report
report.submitForReview(input: {reportId}): Report
report.approve(input: {reportId, comment?}): Report
report.requestRevision(input: {reportId, comments}): Report
report.issue(input: {reportId}): Report

// Content
report.get(input: {reportId}): Report
report.list(input: {engagementId, filter}): PaginatedReports
report.getPreview(input: {reportId, format: 'pdf' | 'html'}): string | URL
report.getVersion(input: {reportId, version}): Report

// Composition
report.selectFindings(input: {reportId, findingIds}): Report
report.updateSection(input: {reportId, sectionName, content}): Report
report.generateComplianceStatement(input: {reportId}): ComplianceStatement

// Distribution
report.getDistributionList(input: {reportId}): DistributionList
report.sendDistribution(input: {reportId}): DistributionResult

// Amendment
report.initiateAmendment(input: {reportId, rationale}): Report
report.submitAmendment(input: {reportId, newContent}): Report
report.issueAmendment(input: {reportId}): Report

// Annual Summary
annualReport.create(input: {fiscalYear}): AnnualReport
annualReport.update(input: {reportId, edits}): AnnualReport
annualReport.issue(input: {reportId}): AnnualReport
```

### 8.2 REST endpoints

`POST /v1/reports`, `GET /v1/reports/:id`, `POST /v1/reports/:id/submit`, `POST /v1/reports/:id/issue`, etc.

### 8.3 Webhook events

- `report.created`
- `report.submitted`
- `report.approved`
- `report.issued` (most significant — triggers finding lockdown, CAP initiation)
- `report.amended`
- `report.distributed`

---

## 9. Permissions

| Role | Create | Compose | Submit for review | Approve | Request revision | Issue | Initiate amendment |
|---|---|---|---|---|---|---|---|
| AIC (Priya) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| CAE (Marcus) | ✅ | ⚠️ (override edit) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Audit Function Director | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Senior Manager | ❌ | ❌ | ❌ | ✅ (per chain) | ✅ | ❌ | ❌ |
| Legal Reviewer | ❌ | ❌ | ❌ | ✅ (per chain, when required) | ✅ | ❌ | ❌ |
| Audit Committee Chair | ❌ | ❌ | ❌ | ✅ (for Audit Committee reports) | ✅ | ❌ | ❌ |

---

## 10. Observability

- `report.create.count` (counter, labels: reportType)
- `report.submit.count`
- `report.approve.count`
- `report.issue.count`
- `report.amend.count`
- `report.pdfgen.duration` (histogram)
- `report.pdfgen.failure.count` (counter — error on PDF generation)
- `report.distribution.count` (counter — emails sent)
- `report.distribution.failure.count` (counter — email bounces)

---

## 11. Performance characteristics

- Report create p99 < 1s
- Report save (draft) p99 < 500ms
- Report HTML preview p99 < 2s
- Report PDF generation p99 < 30s per `04-mvp-scope.md §5.2`
- Report issuance (including lock + notifications + PDF final) p99 < 60s

Scale:
- 50-100 reports per tenant per year
- 10-20 reports per engagement (multi-report engagements like Single Audit)
- 500 historical reports per tenant

---

## 12. Compliance implications

- **GAGAS §6.02**: report content — satisfied by template compliance + compliance statement builder
- **GAGAS §6.33**: supervisory review — satisfied by approval chain
- **IIA GIAS Principle 10-12**: reporting — satisfied by IIA pack's report template (MVP 1.5)
- **2 CFR 200.516**: Single Audit reporting — satisfied by Single Audit report templates
- **PCAOB AS 3101**: financial audit reporting — v2.1
- **Audit Committee communication per IIA GIAS**: satisfied by Annual Summary + Audit Committee report (1.5)

Retention: reports retained per engagement retention (7 years typical per GAGAS + IIA max).

Immutability: ensured via DB triggers per ADR architecture.

---

## 13. Dependencies

### 13.1 Upstream

- Engagement (must exist and be in REPORTING phase)
- Findings (must be APPROVED for inclusion)
- Pack attachments (drives compliance statement + report template)
- Distribution list (per-tenant default; per-engagement override)

### 13.2 Downstream

- CAPs (triggered by report issuance)
- Audit trail (every state change logged)
- Webhooks (external integrators notified)

---

## 14. UX references

Detailed UX in [`ux/report-composition.md`](../ux/report-composition.md) and [`ux/report-review.md`](../ux/report-review.md) (Phase 6 pending).

Key UX:
- **Template-driven section composer** — section-by-section editor
- **Findings selector** — grid with selection + filter
- **Compliance statement builder** — auto-generated with override option
- **PDF preview panel** — side-by-side with editing
- **Track-changes during review** — element-scoped
- **Approval chain visualization** — stepper showing current state + next approvers
- **Distribution list manager** — per-recipient with delivery status

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 10 — feature inventory
- [`04-mvp-scope.md §2.2`](../04-mvp-scope.md) — MVP 1.0 scope (2 reports) + deferrals
- [`rules/workflow-state-machines.md §4`](../rules/workflow-state-machines.md) — report state machine
- [`rules/approval-chain-rules.md §4`](../rules/approval-chain-rules.md) — report approval chains
- [`rules/strictness-resolver-rules.md §3.7`](../rules/strictness-resolver-rules.md) — report cover content requirements
- [`features/engagement-management.md`](engagement-management.md) — engagement context
- [`features/finding-authoring.md`](finding-authoring.md) — findings that populate reports
- [`features/pack-attachment-and-annotation.md`](pack-attachment-and-annotation.md) — pack attachments drive templates

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§2.5/§2.6 — PDF pagination UX**: reviewer correctly pointed out that 30-second PDF generation per iteration makes page-break tuning agonizing. Auditors care deeply about report layout (orphaned recommendation sections look sloppy). Fix: HTML preview now uses CSS `@media print` + `page-break-inside`/`page-break-before` rules to accurately simulate print pagination in real time. **Explicit page-break controls** in the editor (visible "↵ Page Break" insert button per section/finding). **Widow/orphan detection** with one-click fix. Page count displayed in real-time as user composes. PDF generation is reserved for formal output (review and issuance), not iterative layout tuning.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
