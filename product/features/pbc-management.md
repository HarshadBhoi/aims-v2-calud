# PBC (Provided-by-Client) Request Management

> The operational module that makes Segment-A prospects take AIMS seriously against InFlight/Pascal/AuditBoard. The PBC process — bulk request generation, automated reminders, email-based auditee fulfilment with thread-ID ingest, document staging, rejected-document workflow. Added as Module 7a in Phase 1 R1 after reviewer flagged it as "vastly understated" in the original inventory.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 7a
**Primary personas**: Tom (PBC Request Manager), David (Auditee CFO), Priya (AIC), Anjali (Staff), Elena (CPA Partner)
**MVP phase**: 1.0

---

## 1. Feature overview

PBC (Provided-by-Client) is the process of requesting, tracking, and managing documents and evidence the auditee must provide to the auditor. On a mid-size audit, a team typically sends 50-300 PBC requests per engagement, chasing auditee contacts for everything from trial balances to board minutes to grant award letters to policy documents. At larger firms, a dedicated role (Tom per [`02-personas.md §12`](../02-personas.md)) spends their entire day on PBC — building the list, generating request emails, tracking status, chasing overdue items, escalating delays.

Specialised tools exist (InFlight, Pascal, AuditBoard's PBC module) precisely because audit tools handle this poorly. AIMS v2 treats PBC as a first-class module.

### 1.1 Email-first, portal-secondary

Per [`02-personas.md §4 David`](../02-personas.md), auditees don't want to log into portals. They'll reply to emails with attachments. AIMS's email-based auditee fulfilment matches thread-ID on replies to ingest documents automatically. Tom's workflow uses the portal; David's workflow is email.

### 1.2 Integration with workpaper evidence flow

When documents are received and accepted, they flow automatically into the staging queue where engagement team members (Anjali) can attach them to specific work papers. PBC is the supply chain; work papers are the destination.

---

## 2. User stories — PBC list creation

### 2.1 US-PBC-001 — Tom creates PBC list for new engagement

```gherkin
GIVEN Tom is PBC Request Manager for Oakfield FY27 Single Audit
  AND the engagement is in PLANNING state
WHEN Tom opens engagement → PBC tab
  AND clicks "Build PBC List"
  AND selects "Import from prior year (FY26)" as the starting template
THEN the PBC list pre-populates with last year's ~150 items:
  - Each item: title, category, auditee contact, target delivery date
  - Flagged for review: items that might not apply this year
  - Pre-populated auditee contacts from engagement team + prior year
WHEN Tom reviews the list:
  - Removes 20 items no longer applicable
  - Modifies 15 to reflect current year scope
  - Adds 10 new items for new program areas
  - Adjusts delivery dates to current year
  - Confirms auditee contact assignments
THEN the finalised list has ~155 items ready for engagement kickoff
```

**Acceptance criteria**:
- PBC list builder supports import from prior year (clone feature)
- Template library with standard PBC items per engagement type (Single Audit, SOC 2, etc.)
- Per-item metadata: title, category (financial/operational/compliance/IT), auditee contact, target date, priority
- Bulk edit support (apply delivery date to selected items; reassign auditee contact across selected items)
- List saves incrementally

### 2.2 US-PBC-002 — Tom uses template library

```gherkin
GIVEN Tom is building PBC for a Single Audit
  AND his firm has a Single Audit template library
WHEN he applies the template "Single Audit Federal Grants"
THEN the list populates with the standard items:
  - Trial balance with GL details
  - All federal grant award letters
  - Grant ledger with charges by program
  - Prior year CAPs
  - Management representation letter (template)
  - Related party disclosure
  - Internal audit reports for the period
  - Contract with any sub-recipient
  - ... (typical Single Audit PBC, ~80 items)
WHEN Tom selects additional templates (e.g., "Governmental Fund Accounting")
THEN additional items added without duplicates
```

**Acceptance criteria**:
- Template library has 6-8 pre-configured PBC templates per engagement type
- Tenant admin can author custom templates (per `03-feature-inventory.md` Module 14 pack annotation scope)
- Template items tagged with minimum-required vs. optional
- Duplicate detection when applying multiple templates

### 2.3 US-PBC-003 — Tom customizes item details

```gherkin
GIVEN PBC list has ~150 items
WHEN Tom opens an item "Grant Award Letter - NSF 47.049"
  AND edits:
    - Category: Federal Grants
    - Auditee contact: Michelle Zhao (Grant Accountant)
    - Target date: August 15, 2027
    - Priority: High
    - Specific instructions: "Please include the most recent amendments and any related correspondence with NSF"
    - Deliverable format: PDF preferred
    - Retention sensitivity: High (contains PII)
  AND saves
THEN item updated
  AND audit_event logged
```

**Acceptance criteria**:
- Per-item detail editor
- Priority levels: Low, Normal, High, Critical
- Retention/sensitivity flagging for PII-handling awareness
- Instructions field (rich text, 2000 char limit)
- Change history maintained

---

## 3. User stories — Request generation

### 3.1 US-PBC-004 — Tom generates bulk requests at engagement kickoff

```gherkin
GIVEN PBC list has 155 items
  AND engagement is in FIELDWORK state
WHEN Tom opens PBC tab
  AND clicks "Generate Initial Requests"
  AND selects "Group by auditee contact"
  AND sets send window: next 3 business days, staggered
THEN system generates:
  - ~25 unique email recipients (auditee contacts)
  - Each recipient gets ONE email with multiple items grouped
  - Emails scheduled to stagger across 3 days (not all at once)
  - Each email contains:
    * Items assigned to that recipient
    * Deadline for each item
    * Secure upload link per item (single-use, signed, no login required)
    * Reply-to address: engagement-specific (e.g., `oakfield-fy27-pbc@aims.io`)
    * Reply-handling instructions
  - Email preview available before final send
WHEN Tom confirms
THEN emails queued and sent
  AND PBC items transition from "Not Yet Requested" to "Requested"
```

**Acceptance criteria**:
- Bulk generation supports grouping by: auditee contact, engagement phase, priority, etc.
- Staggered send (respects auditee's email bandwidth)
- Email template customizable per tenant
- Preview before send
- Rollback possible within 1 hour (before emails reach recipients)

### 3.2 US-PBC-005 — Email templates per engagement type

```gherkin
GIVEN tenant has email templates for:
  - Single Audit first request
  - Single Audit follow-up
  - SOC 2 first request
  - IT audit first request
  - etc.
WHEN Tom generates requests for a Single Audit
THEN "Single Audit first request" template is used
  AND template variables populated (engagement name, AIC, deadline, etc.)
```

**Acceptance criteria**:
- Tenant admin can author/modify templates
- Template variables: {engagement.name}, {auditeeContact.name}, {items.list}, {deadline}, etc.
- Rich text with variable substitution
- Preview of templated email

---

## 4. User stories — Email-based auditee fulfilment

### 4.1 US-PBC-006 — David replies to request email

```gherkin
GIVEN Tom sent David a PBC request email
  AND the email thread ID is stored in the request record
WHEN David replies to the email
  AND attaches 3 files (trial balance PDF, GL excerpt, board minutes)
  AND writes in reply: "Attached: trial balance + GL. Board minutes separately next week."
THEN AIMS receives the reply via webhook from the email service
  AND matches the thread ID to the PBC request
  AND ingests attachments to the staging queue
  AND parses the reply text for context/status hints
  AND transitions request status from "Requested" to "Response Received"
  AND notifies Tom (in-app + email digest)
  AND the items associated with the 2 attached files become "Partially Responded" or "Fully Responded" depending on Tom's item count
```

**Acceptance criteria**:
- Email reply ingestion via email service webhook (SES or equivalent per `devops/README.md`)
- Thread-ID matching robust (handle forward, reply-all, etc.)
- **Attachment handling bound by standard SMTP gateway limits**: max 25MB per email (combined attachments) realistic; max 35MB on some Exchange/Office 365 tenants; **most enterprise gateways hard-cap at 25MB**. If David's email gateway rejects a 45MB PDF, the email bounces from his side and AIMS never receives the webhook.
- **Supported attachment formats**: PDF/DOCX/XLSX/PNG/JPG/ZIP (with scan), individual file max 20MB (to leave room for the email envelope)
- **Larger-file routing**: initial PBC request emails explicitly state: "For files larger than 25MB, please use the secure upload link provided below." The secure upload link (S3 multipart upload, single-use signed, 7-day expiration, no login required) handles files up to 2GB per file
- **Bounce handling**: if email delivery fails or message is rejected by auditee gateway, AIMS logs the bounce; if sustained, escalate to PBC manager (Tom)
- Staging queue holds documents before engagement team accepts
- Auto-notification to Tom on receipt

**Why this matters**: pretending we can ingest 50MB attachments via email when most enterprise gateways cap at 25MB would produce a broken user experience — David tries to reply with his trial balance; his Exchange instance bounces it; he never hears about it; Priya waits for evidence that will never arrive. The 25MB limit matches real SMTP behavior and the secure-upload-link path covers the larger-file case without pretending email is the transport.

### 4.2 US-PBC-007 — Tom reviews received documents

```gherkin
GIVEN David's reply arrived with 3 attachments
WHEN Tom opens PBC → Received Documents
  AND sees the 3 received files in the staging queue
  AND opens trial balance PDF for review
  AND evaluates quality (is it the right document? recent date? complete?)
  AND clicks "Accept for Item: Trial Balance Q4 2027"
THEN the file is associated with PBC item "Trial Balance Q4 2027"
  AND item transitions from "Response Received" to "Accepted"
  AND file moves from staging queue to engagement's document library
  AND item ready for Anjali to attach to specific work papers
  AND audit_event logged
```

**Acceptance criteria**:
- Staging queue UI with quick-review (PDF preview, metadata)
- One-click accept/reject
- File naming convention maintained (original file name preserved + metadata added)
- Audit trail of receive → accept transitions

### 4.3 US-PBC-008 — Tom rejects document with reason

```gherkin
GIVEN David provided a trial balance but it's for Q3 (prior period) instead of Q4 (current period)
WHEN Tom clicks "Reject"
  AND provides reason: "This is Q3 trial balance. Please provide Q4 trial balance."
  AND clicks Send
THEN the item stays in "Response Received" state
  AND David receives automated reply email with Tom's rejection reason
  AND next request is generated with same content but flagged as resubmission
  AND staging queue document moved to "Rejected Files" bin
```

**Acceptance criteria**:
- Reject requires reason (min 20 chars)
- Automated rejection email to auditee with reason + clear next-step
- Rejected documents retained for 7 days then purged from staging
- Resubmission tracking (link between original and resubmission)

### 4.4 US-PBC-009 — Large file upload via portal

```gherkin
GIVEN David has a 500MB GL extract
  AND the file is larger than email limits
WHEN David clicks the secure upload link in the PBC email
THEN browser opens to the tenant's branded upload page
  AND David uploads the file (no login required; single-use signed URL)
  AND the upload completes
  AND AIMS ingests the file to the staging queue
  AND the request is marked "Response Received"
```

**Acceptance criteria**:
- Upload page tenant-branded
- Signed URL with single-use + 7-day expiration
- Supports large files (up to 2GB per file; S3 multipart upload)
- Upload progress indicator
- No login required for the specific requested item

---

## 5. User stories — Reminder and escalation

### 5.1 US-PBC-010 — Weekly automated reminder

```gherkin
GIVEN a PBC request is in "Requested" state
  AND the target date has not yet passed
  AND Tom's tenant has automated reminders configured
WHEN it's Monday morning and the request is overdue by 1 day
THEN an automated reminder email is sent to David:
  "Reminder: The following PBC requests are overdue
   • Trial Balance Q4 2027 (due 2027-08-15; now 2027-08-16)
   • GL Excerpt - NSF 47.049 (due 2027-08-16; now 2027-08-16)
   Please provide by 2027-08-22 or reach out with any questions..."
  AND reminder scheduled frequency: Mon of each week
  AND reminder counter tracked per request
```

**Acceptance criteria**:
- Reminder cadence configurable per tenant (default weekly, can be daily)
- Email template customizable
- Tracks reminder count per request (escalates after N reminders)
- Auditees can reply to stop reminders for specific items

### 5.2 US-PBC-011 — Escalation to AIC after 10 days

```gherkin
GIVEN a PBC request has been overdue for 10 calendar days
  AND no response from David
WHEN the escalation trigger fires
THEN Priya (AIC) receives notification:
  "David (CFO, Oakfield) has not responded to PBC request 'Board Minutes Q2 2027' after 10 days"
  AND Priya can decide:
    - Continue standard reminder cadence
    - Contact David directly (out-of-system)
    - Escalate to CAE (Marcus)
    - Mark as "Will not be provided" and proceed (with finding implications)
```

**Acceptance criteria**:
- Escalation after 10 days (configurable)
- AIC notification includes context (item title, auditee contact, reminder count)
- Escalation decision logged

### 5.3 US-PBC-012 — Escalation to CAE after 20 days

```gherkin
GIVEN a PBC request has been overdue for 20 days
  AND Priya has not explicitly escalated
WHEN the 20-day trigger fires
THEN Marcus (CAE) is notified
  AND a "PBC Delay" flag appears on the engagement dashboard
  AND Marcus can decide to:
    - Personally contact senior auditee leadership
    - Mark as "Management will not provide" (auditor decision to proceed anyway)
    - Trigger the finding's CAP_PROPOSAL_OVERDUE path per `workflow-state-machines.md §5.1.1`
```

**Acceptance criteria**:
- CAE-level escalation with elevated visibility
- Integration with management-non-response handling (BYPASSED path)
- Audit trail captures escalation decision

---

## 6. User stories — Status tracking and dashboards

### 6.1 US-PBC-013 — Tom views PBC status grid

```gherkin
GIVEN Oakfield FY27 has 155 PBC items
WHEN Tom opens PBC Status Grid
THEN he sees a grid:
  - Rows: auditee contacts (David, Michelle Zhao, etc.)
  - Columns: status buckets (Not Requested, Requested, Response Received, Partially Responded, Accepted, Rejected, Overdue)
  - Cell: count of items in that bucket
  - Filterable by: priority, category, date range
WHEN he clicks a cell to drill in
THEN he sees the specific items with full details
```

**Acceptance criteria**:
- Grid view loads < 1s with 200 items
- Filter + sort columns
- Export to CSV for reporting
- Real-time updates as statuses change

### 6.2 US-PBC-014 — Tom sees PBC completion report

```gherkin
GIVEN engagement is in FIELDWORK
WHEN Tom generates weekly PBC completion report
THEN report shows:
  - % of items accepted: 68% (105 of 155)
  - % overdue: 12% (18 items)
  - % not yet requested: 3% (5 items — new requests from scope change)
  - Top 5 overdue items with auditee contact + reminder count
  - Predicted completion date based on current trajectory
  - Auditees ranked by response rate
```

**Acceptance criteria**:
- Report generated on demand (not just scheduled)
- PDF-exportable for partner distribution (Elena would see this)
- Supports week-over-week comparison
- Printable version suitable for team meetings

### 6.3 US-PBC-015 — David views his PBC inbox

```gherkin
GIVEN David is auditee contact for Oakfield FY27
WHEN he receives an email with portal login link (optional)
  AND logs in (single-use magic link)
THEN he sees his PBC dashboard showing:
  - Open requests (with due dates)
  - Overdue requests
  - Completed requests
  - Upcoming deadlines
  AND he can:
    - View request details
    - Upload documents
    - Add comments/questions
    - Request clarification from Tom
```

**Acceptance criteria**:
- Auditee portal is opt-in; email-first remains default
- Single-use magic link (no password required initially; password setup optional)
- Portal shows only this auditee's engagements
- Mobile-friendly for email-on-phone users

---

## 7. User stories — Workpaper integration

### 7.1 US-PBC-016 — Anjali attaches accepted document to work paper

Covered in [`fieldwork-and-workpapers.md`](fieldwork-and-workpapers.md). Summary:

- Accepted documents in staging queue appear in workpaper evidence picker
- Anjali attaches relevant documents to specific work papers
- Document moves from staging queue to permanent engagement record
- Both sides of reference maintained (document knows which work papers use it; work paper references the document)

---

## 8. Edge cases

### 8.1 Duplicate document submission

David might send the same trial balance multiple times (forgot he sent it; replying to multiple emails). AIMS deduplicates by:
- File hash matching
- Auditee contact + date sent
- Associated item ID

If a potential duplicate is detected, Tom sees a merge/keep-both prompt.

### 8.2 Email service outage

If the email service is down:
- Requests cannot send
- Tom sees clear error in UI
- Queue fills; retries per outbox pattern per ADR-0004
- Fallback: allow manual email send outside AIMS (user copies template to clipboard)

### 8.3 Large volume engagement

Some audits have 500+ PBC items. Batch operations must handle this:
- Batch generation 500 emails (staggered over multiple days)
- Status grid scales to 500 items with pagination
- Reminders scheduled in a rolling window, not all-at-once

### 8.4 Auditee requests clarification

David replies with "Is the board minutes request asking for just FY27 or historical?". AIMS:
- Classifies this as a clarification (not a document response)
- Routes to Tom's inbox as a question
- Item status stays "Requested"
- Tom replies to clarify

### 8.5 Auditee says "document doesn't exist"

David replies: "We don't have board minutes for that date because the board didn't meet." AIMS:
- Classifies as "document unavailable"
- Item status transitions to "Unavailable" with David's explanation
- Tom evaluates: is this acceptable? (Sometimes yes; sometimes it's a finding)
- If finding-worthy, Tom escalates

### 8.6 Audit partner-level visibility (Elena)

Elena (Audit Partner) doesn't interact with PBC directly but wants visibility. Her dashboard shows:
- Cross-engagement PBC completion %
- Overdue items that might impact engagement timelines
- Comparison across her engagements (where's the pain?)

Read-only visibility; she doesn't action PBC herself.

### 8.7 Re-engagement with prior auditee

For annual audits, Tom builds on prior year's list. Known-good auditee contacts carried forward; items rescheduled; changes documented.

---

## 9. Data model touch points

Per `data-model/tenant-data-model.ts`:

- `PBCRequest` — primary entity (fields: id, tenantId, engagementId, title, category, auditeeContact, targetDate, status, priority, instructions, emailThreadId, reminderCount)
- `PBCEmailThread` — per-thread tracking (threadId, initialEmailMessageId, replyCount, lastReplyAt)
- `PBCStagingDocument` — documents in staging queue before acceptance
- `PBCTemplate` — reusable templates
- `AuditeeContact` — auditee personnel contact info (per tenant)

---

## 10. API endpoints

### 10.1 tRPC procedures

```typescript
// PBC list management
pbc.createList(input: {engagementId, template?}): PBCList
pbc.addItem(input: {listId, itemDetails}): PBCRequest
pbc.updateItem(input: {itemId, changes}): PBCRequest
pbc.deleteItem(input: {itemId}): void
pbc.importFromPriorYear(input: {engagementId, priorEngagementId}): PBCList

// Request generation
pbc.generateRequests(input: {listId, groupBy, sendSchedule}): GenerationResult
pbc.previewRequest(input: {itemIds, template}): EmailPreview

// Status tracking
pbc.getStatus(input: {engagementId, filter?}): StatusGrid
pbc.getItem(input: {itemId}): PBCRequest
pbc.getListByAuditee(input: {engagementId, auditeeContactId}): PBCList

// Document handling
pbc.acceptDocument(input: {documentId, itemId}): PBCRequest
pbc.rejectDocument(input: {documentId, reason}): PBCRequest
pbc.uploadDocument(input: {itemId, file}): Document

// Reminders
pbc.sendReminder(input: {itemId}): Reminder
pbc.configureReminderCadence(input: {engagementId, cadence}): Config

// Reports
pbc.getCompletionReport(input: {engagementId}): CompletionReport

// Templates
pbc.listTemplates(input: {engagementType}): PBCTemplate[]
pbc.createTemplate(input: TemplateInput): PBCTemplate
```

### 10.2 Auditee-facing endpoints

```typescript
// For email-based auditee interaction
pbc.receiveEmailReply(input: EmailReplyInput): void  // webhook from email service

// For portal (optional auditee login)
auditeePortal.login(input: {magicLinkToken}): Session
auditeePortal.listRequests(input: {}): AuditeeRequest[]
auditeePortal.uploadDocument(input: UploadInput): Document
```

### 10.3 Webhook events

- `pbc.request.created`
- `pbc.request.sent`
- `pbc.request.response_received`
- `pbc.document.accepted`
- `pbc.document.rejected`
- `pbc.request.overdue`
- `pbc.request.escalated`

---

## 11. Permissions

| Role | View PBC list | Add/edit items | Generate requests | Receive documents | Accept/reject |
|---|---|---|---|---|---|
| Tom (PBC Manager) | ✅ | ✅ | ✅ | ✅ | ✅ |
| AIC (Priya) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Staff (Anjali) | ✅ (read) | ❌ | ❌ | ✅ (read) | ❌ |
| CAE (Marcus) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auditee (David) | ✅ (his requests) | ❌ | ❌ | ❌ | ❌ |

---

## 12. Observability

- `pbc.request.created.count`
- `pbc.request.sent.count`
- `pbc.response.received.count`
- `pbc.document.accepted.count`
- `pbc.document.rejected.count`
- `pbc.reminder.sent.count`
- `pbc.escalation.triggered.count`
- `pbc.completion_percentage.gauge` (per engagement)

---

## 13. Performance characteristics

- PBC list load p99 < 1s (with 200 items)
- Bulk request generation p99 < 30s (for 200 items staggered)
- Email reply ingestion < 5 minutes from reply to ingestion
- Large file upload via portal: 500MB in 2 minutes on good bandwidth

Scale:
- 500 PBC items per engagement (upper bound)
- 50 auditee contacts per engagement
- 2000 active PBC items across all engagements per tenant

---

## 14. Compliance implications

- **Audit evidence per GAGAS §6.41**: supported by acceptance workflow
- **GAGAS §6.33 supervisory review**: review of accept/reject decisions
- **Retention**: PBC records retained per engagement retention
- **Data minimization (GDPR Art. 5)**: rejected documents purged after 7 days
- **Audit trail**: every PBC state change logged

---

## 15. Dependencies

- Engagement (must exist)
- Auditee contacts (configured per tenant)
- Email service (for reply ingestion)
- Document storage (S3 for staging + permanent)
- Workpaper (Module 7) — attached documents flow into workpapers

---

## 16. UX references

Detailed UX in [`ux/pbc-list-builder.md`](../ux/pbc-list-builder.md), [`ux/pbc-status-grid.md`](../ux/pbc-status-grid.md), and [`ux/auditee-portal.md`](../ux/auditee-portal.md) (Phase 6 pending).

Key UX:
- **PBC list builder** — grid with filtering + bulk edit
- **Request generation wizard** — grouping + stagger configuration
- **Status grid** — heatmap of completion
- **Document staging** — inbox-style review
- **Auditee portal** (optional login) — simple mobile-friendly view
- **Email templates editor** — for tenant admin

---

## 17. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 7a — feature inventory
- [`02-personas.md §12`](../02-personas.md) — Tom (PBC Request Manager)
- [`02-personas.md §4`](../02-personas.md) — David (Auditee)
- [`04-mvp-scope.md §2.2`](../04-mvp-scope.md) — MVP 1.0 scope
- [`rules/workflow-state-machines.md §5.1.1`](../rules/workflow-state-machines.md) — auditee stonewall path
- [`features/fieldwork-and-workpapers.md`](fieldwork-and-workpapers.md) — workpaper integration

---

## 18. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§4.1 — email attachment size cap**: original spec said "max 50MB per file" for email attachment ingestion. Reviewer correctly flagged that enterprise email gateways (Exchange, Office 365, Google Workspace) hard-cap attachments at 25MB or 35MB. If David attaches a 45MB PDF, his own outbox bounces it; AIMS never sees the webhook. Fix: attachment handling now bound by realistic SMTP limits (25MB combined per email; 20MB per individual file). Initial PBC request emails explicitly direct auditees to the secure upload link for files larger than 25MB. The secure upload link (S3 multipart, single-use signed, 7-day expiration, no login required) handles files up to 2GB per file. Bounce handling added.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
