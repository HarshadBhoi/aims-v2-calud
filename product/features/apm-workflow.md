# APM (Audit Planning Memo) Workflow

> The structured 14-section Audit Planning Memo per GAGAS §7.05-7.10, with collaborative authoring, approval workflow, version history, and PDF export. APMs are the engagement-level planning artifact that the PLANNING → FIELDWORK phase-gate depends on. Pack-aware cross-standard scope section (new in v2).

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 5
**Primary personas**: Priya (AIC, primary author), Marcus (CAE, reviewer)
**MVP phase**: 1.0

---

## 1. Feature overview

The Audit Planning Memo (APM) is a formal planning document required by GAGAS §7.05-7.10 (and analogous planning requirements in IIA GIAS Domain 3, ISO 19011, and PCAOB AS 2101). It documents:

- Engagement scope, objectives, criteria
- Risk assessment summary
- Methodology and testing approach
- Team composition and responsibility matrix
- Timeline and budget
- Communication plan
- Quality assurance procedures
- Coordination with auditee

AIMS v2 ships APM as a 14-section structured document with:

- Template-based authoring (templates per engagement type + pack combination)
- Collaborative editing (multi-user with conflict resolution; operational transforms, not full CRDT per MVP scope)
- Approval workflow (AIC → CAE; engagement-specific review chain)
- Version history (bitemporal; every save preserved)
- PDF export (formal document for engagement file)
- Phase-gate integration (APM approval gates PLANNING → FIELDWORK transition)
- **Cross-standard scope section** — new in v2, declares which attached packs apply and any pack-specific scope considerations

### 1.1 14-section structure (GAGAS-aligned, pack-extensible)

The standard APM template includes:

1. Executive Summary
2. Engagement Background and Objectives
3. Scope and Coverage (+ Cross-Standard Scope for multi-pack engagements)
4. Risk Assessment (integrates with PRCM per `prcm-matrix.md`)
5. Materiality and Reporting Thresholds
6. Audit Criteria (source references per pack)
7. Methodology and Testing Approach
8. Team Composition and Responsibilities
9. Timeline and Key Milestones
10. Budget and Hours Estimate
11. Communication Plan (auditee and governance)
12. Quality Assurance Procedures
13. Coordination with External Parties
14. Appendices (engagement charter, prior-year findings review, etc.)

Per-pack templates may add or reorder sections; resolver-combined template for multi-pack engagements includes all required sections with pack attribution.

---

## 2. User stories — APM authoring

### 2.1 US-APM-001 — Priya creates APM from template

```gherkin
GIVEN Oakfield FY27 is in PLANNING state
  AND engagement has GAGAS + IIA + Single Audit attached
WHEN Priya opens Engagement → APM → Create
  AND selects template: "Single Audit APM (GAGAS + Single Audit)"
THEN APM created with:
  - 14 sections pre-populated with template prompts
  - Engagement metadata auto-filled (auditee, period, team)
  - Pack-specific Cross-Standard Scope section pre-filled with attached packs + conformanceClaimed flags
  - Reference to engagement's attached packs in Criteria section
  - Status: DRAFT
```

**Acceptance criteria**:
- Template library with 8-10 APM templates per engagement type
- Templates customizable per tenant (saved as tenant-scoped variants)
- Auto-population from engagement metadata
- Cross-Standard Scope section mandatory for multi-pack engagements

### 2.2 US-APM-002 — Priya drafts each section

```gherkin
GIVEN APM is in DRAFT
WHEN Priya opens a section (e.g., "Risk Assessment")
  AND writes narrative using rich text (TipTap)
  AND inserts references to engagement's PRCM rows (link to the matrix)
  AND @mentions Anjali for specific risk areas
  AND saves incrementally
THEN content saves per section
  AND section marked "In Progress" in navigation sidebar
  AND @mentions trigger notifications
```

**Acceptance criteria**:
- Rich text editing per section (TipTap)
- Inter-document references (to PRCM, prior engagements, audit universe entities)
- @mentions within APM
- Auto-save every 30s
- Section completion status visible in navigation

### 2.3 US-APM-003 — Collaborative editing across team (CRDT via Yjs)

```gherkin
GIVEN Priya is drafting Risk Assessment
  AND Anjali is concurrently drafting Methodology section
WHEN both work simultaneously
THEN their edits apply without conflict (different sections)
  AND each sees the other's presence indicator (cursor + name)
  AND saves commit to the same APM document with section-level awareness
WHEN both happen to edit the same section concurrently
THEN Yjs CRDT merges edits automatically (character-level)
  AND visual indicators show whose cursor is where with colored selection regions
  AND no explicit conflict UI needed — CRDT guarantees eventual consistency
```

**Acceptance criteria — concurrency approach**:

TipTap v2's collaborative backend is **Yjs (a CRDT)**, accessed via Hocuspocus WebSocket server. This is the pragmatic, well-supported MVP path — not operational transforms (OT) which would require building from scratch and which TipTap doesn't natively target.

- **Primary approach (MVP 1.0): Yjs CRDT via Hocuspocus**
  - Real-time sync over WebSocket
  - Character-level conflict-free merging
  - Presence awareness (cursor position, selection, username, color)
  - Works offline; syncs on reconnect
  - Battle-tested in Notion, Linear, JupyterLab, and similar platforms
  - Hocuspocus server runs as NestJS worker (per ADR-0003); tenant-isolated Yjs rooms per APM document

- **Fallback (if Hocuspocus infrastructure complexity is deferred to MVP 1.5): strict section-level pessimistic locking**
  - Each section has a single active editor at any given time
  - When Priya opens "Risk Assessment" for editing, section locks for her
  - Anjali sees "Priya is editing this section" with her initials; cannot edit
  - Lock auto-releases after 10 minutes of inactivity or explicit save
  - Simpler to implement; less elegant UX for concurrent same-section editing (which is rare anyway — APMs typically have section owners)

**Decision for MVP 1.0**: start with section-level locking (simpler operationally; deployable sooner). Plan Yjs/Hocuspocus integration for MVP 1.5 based on customer feedback. If pilot customers report collaborative-editing pain within sections, accelerate Yjs.

**Why not operational transforms**: OT is notoriously difficult to implement correctly for rich text. Building OT from scratch in 2026 when battle-tested CRDT libraries exist is a poor engineering investment. The original Phase 1 draft's mention of "operational transforms, not full CRDT per MVP scope" was incorrect framing — CRDT via Yjs is *simpler* than rolling OT, not harder.

- Presence indicators (both approaches)
- Section-level visibility of who's-editing-what
- Auto-save every 30s (CRDT) or on-save (locking)

### 2.4 US-APM-004 — Priya attaches supporting documents

```gherkin
GIVEN APM has sections drafted
WHEN Priya attaches:
  - Prior-year findings review (PDF)
  - Auditee engagement letter (DOCX)
  - Reference memos
THEN attachments listed in Appendices section
  AND accessible to reviewers
  AND preserved in APM version history
```

**Acceptance criteria**:
- Multiple file types supported
- Version-tracked with APM

---

## 3. User stories — Review workflow

### 3.1 US-APM-005 — Priya submits APM for review

```gherkin
GIVEN APM draft is complete with all 14 sections populated
WHEN Priya clicks Submit for Review
THEN APM transitions DRAFT → IN_REVIEW
  AND content locked (reviewers can comment + track changes)
  AND approval chain per `rules/approval-chain-rules.md §2.1` fires
  AND Marcus (CAE) notified
```

**Acceptance criteria**:
- Validation at submit: all sections populated (or explicitly marked N/A)
- Cross-standard scope section validated (matches engagement's attached packs)
- Section-level comments available to reviewers

### 3.2 US-APM-006 — Marcus reviews APM

```gherkin
GIVEN APM is IN_REVIEW
WHEN Marcus reads
  AND adds inline comments:
    - On Risk Assessment: "Add specific federal program risks for NSF funding"
    - On Methodology: "Approach looks solid; confirm sample sizes with Priya"
  AND requests revision
THEN APM transitions IN_REVIEW → DRAFT
  AND Priya notified with specific comments
  AND comment threads enable discussion
```

### 3.3 US-APM-007 — APM approved; phase gate unlocked

```gherkin
GIVEN all reviewers have approved
WHEN Marcus clicks final Approval
THEN APM transitions IN_REVIEW → APPROVED
  AND engagement phase gate PLANNING → FIELDWORK unblocks
  AND APM version locked at approved state
  AND Priya receives notification that fieldwork can commence
```

**Acceptance criteria**:
- Approved version immutable (subsequent edits create new version, preserving approved as read-only)
- Version history shows all states including approved snapshot
- Engagement dashboard reflects phase-gate unlock

---

## 4. User stories — Version history

### 4.1 US-APM-008 — Priya views version history

```gherkin
GIVEN APM has gone through multiple revisions
WHEN Priya opens Version History
THEN she sees:
  - List of all versions with timestamps
  - Who made changes per version
  - Diff between any two versions
  - Ability to restore prior version (with CAE approval)
```

**Acceptance criteria**:
- Every save creates version (bitemporal)
- Diff view highlights additions/deletions per section
- Restore requires CAE approval (post-approval)

---

## 5. User stories — PDF export

### 5.1 US-APM-009 — Priya generates APM PDF

```gherkin
GIVEN APM is APPROVED
WHEN Priya clicks Export PDF
THEN PDF generated with:
  - Cover page (engagement, approvers, date)
  - Table of contents
  - All 14 sections formatted
  - Attachments listed with links
  - Signatures/approvals
  AND stored in engagement document library
```

---

## 6. Edge cases

### 6.1 APM modification post-approval (scope change)

Requires engagement regression from FIELDWORK to PLANNING per `workflow-state-machines.md §2.6`. CAE approval required.

### 6.2 Multi-pack template conflicts

If two packs' templates prescribe contradictory section structures, the resolver per `strictness-resolver-rules.md §3.12` flags for CAE override.

### 6.3 APM exceeding page budget

For very complex engagements, the 14-section structure may produce a 50+ page document. Page-break controls, collapsible sections in editor.

---

## 7. Data model

- `APM` — entity with sections, version history
- `APMSection` — per-section content + status
- `APMVersion` — bitemporal versions
- `APMComment` — review comments per section
- `APMApproval` — approval chain entries

---

## 8. API endpoints

```typescript
apm.create(input: {engagementId, template}): APM
apm.updateSection(input: {apmId, section, content}): APMSection
apm.submitForReview(input: {apmId}): APM
apm.approve(input: {apmId}): APM
apm.requestRevision(input: {apmId, comments}): APM
apm.getVersion(input: {apmId, version}): APM
apm.diff(input: {apmId, fromVersion, toVersion}): Diff
apm.exportPDF(input: {apmId}): PDF
```

---

## 9. Permissions

| Role | Create | Edit (draft) | Submit | Approve |
|---|---|---|---|---|
| AIC | ✅ | ✅ | ✅ | ❌ |
| Staff | ❌ | ✅ (assigned sections) | ❌ | ❌ |
| CAE | ✅ | ❌ | ❌ | ✅ |

---

## 10. Observability

- `apm.create.count`
- `apm.approve.count`
- `apm.revision.cycle.count`
- `apm.section.editing.duration`

---

## 11. Performance

- APM load p99 < 1s
- Section save p99 < 300ms
- PDF generation p99 < 15s

---

## 12. Compliance

- GAGAS §7.05-7.10
- IIA GIAS Domain 3 Principle 7 (engagement charter / planning)
- PCAOB AS 2101 (planning)
- ISO 19011 §5.4 (audit planning)

---

## 13. Dependencies

- Engagement (must exist)
- PRCM (referenced from APM Risk Assessment)
- Audit universe (referenced from Scope)
- Pack attachments (drives template + cross-standard scope section)

---

## 14. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 5
- [`rules/workflow-state-machines.md §2.4`](../rules/workflow-state-machines.md) — APM phase gate
- [`rules/approval-chain-rules.md §2.1`](../rules/approval-chain-rules.md) — APM approval chain
- [`features/engagement-management.md`](engagement-management.md) — engagement context
- [`features/prcm-matrix.md`](prcm-matrix.md) — risk-assessment integration

---

## 15. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§2.3 US-APM-003 — collaborative editing approach**: original framing "operational transforms, not full CRDT" was technically wrong. TipTap's collaborative backend is Yjs (a CRDT) via Hocuspocus WebSocket server. Building OT from scratch in 2026 is harder than using a CRDT. Fix: MVP 1.0 decision is **strict section-level pessimistic locking** (simpler; deployable sooner). **Yjs/Hocuspocus full CRDT integration** planned for MVP 1.5 based on pilot feedback. Either approach is better than building OT from scratch.

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
