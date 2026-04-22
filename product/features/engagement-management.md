# Engagement Management

> The central hub where most auditor work lives. Engagement creation, pack attachment, team assignment, phase progression, budget tracking, activity feed, and the engagement-level search and dashboard surfaces. Every other module hangs off engagements; this doc specifies the engagement entity's behaviour end-to-end for MVP 1.0.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 4
**Primary personas**: Priya (AIC), Marcus (CAE), Anjali (Staff), Elena (CPA Partner for Segment A)
**MVP phase**: 1.0

---

## 1. Feature overview

Engagements are the unit of audit work. An engagement represents one discrete audit — financial, performance, compliance, attestation — with a defined scope, a team, a timeline, a set of applied standards, and deliverables (work papers, findings, reports, CAPs).

In AIMS v1 (the existing SPFx app), engagements were implicitly GAGAS-shaped. In v2, an engagement declares which methodology packs, control frameworks, and regulatory overlays apply to it at creation time — this declaration drives the workflow state machine, the finding elements required, the reports produced, and the rules the strictness resolver applies.

This spec covers the engagement entity from creation through archival: CRUD, multi-pack attachment, team management, phase transitions, budget and hours tracking, activity feeds, comments, cloning, search, and dashboards.

### 1.1 Why engagements are central

Findings belong to engagements. Work papers belong to engagements. Reports belong to engagements. CAPs belong to findings (indirectly to engagements). Every view in AIMS except tenant-admin and cross-engagement dashboards starts with an engagement context. The engagement is the primary navigation unit.

---

## 2. User stories

### 2.1 Engagement creation

**US-ENG-001 — Priya creates a Single Audit engagement with multi-pack attachment**

```gherkin
GIVEN Priya is an AIC on Oakfield's tenant
  AND she has the "create engagement" permission
WHEN she clicks "New Engagement" from the engagement list
  AND she fills in engagement name, type (Single Audit), fiscal period, auditee entity
  AND she selects primaryMethodology: GAGAS:2024
  AND she selects additionalMethodologies: [IIA_GIAS:2024]
  AND she selects regulatoryOverlays: [SINGLE_AUDIT:2024]
  AND she selects controlFrameworks: [SOC2:2017] (for vendor testing scope)
  AND she clicks "Create Engagement"
THEN a new engagement is created with:
  - status = DRAFT
  - primaryMethodology, additionalMethodologies, regulatoryOverlays, controlFrameworks populated
  - strictness resolver has computed rules (documentation retention, CPE, independence, etc.) with drivenBy trail
  - default team populated from Priya's standard team template (if configured)
  - default phase gates populated per resolver-combined workflow per `rules/workflow-state-machines.md §2`
  - audit_event entry logged for engagement creation
  - engagement appears on Priya's home dashboard
```

**Acceptance criteria for US-ENG-001**:
- Resolver runtime p99 < 500ms at engagement creation (per `strictness-resolver-rules.md §7`)
- If any pack is incompatible (e.g., version mismatch), creation blocks with a clear message identifying the conflict
- If any override is required (resolver returns `override-required` for a dimension), engagement is created but flagged pending override resolution before PLANNING → FIELDWORK transition
- Engagement ID format: `eng-{tenantId-prefix}-{year}-{sequence}` (e.g., `eng-oak-2027-00042`); sequence is per-tenant per year
- Engagement creation is idempotent by `idempotencyKey` per `api-catalog.md` conventions
- Engagement name uniqueness enforced within a tenant-year combination
- **`clientEngagementCode` field supported** — user-defined external code (e.g., `SA-2027-001`) for integration with firm's own billing/ERP systems (CCH, Star Practice, Workday PSA). This is separate from the system-generated internal ID and is displayed alongside engagement name in lists and reports. Optional; can be edited by AIC or CAE post-creation. Uniqueness enforced per tenant (not globally).

**US-ENG-002 — Priya creates an engagement from a template**

```gherkin
GIVEN Priya is creating a new engagement
  AND her tenant has templates defined for common engagement types (Single Audit, SOC 2 examination, Performance Audit, etc.)
WHEN she selects "Single Audit (GAGAS + IIA + Single Audit Overlay)" from the template picker
THEN the engagement pre-populates:
  - engagement type = Single Audit
  - pack attachments per the template
  - default team structure (AIC + staff slots)
  - default phase budgets (based on template average + template-stored notes)
  - default APM structure
  - default PRCM structure template (for this engagement type)
WHEN she reviews and confirms
THEN the engagement is created as in US-ENG-001
```

**Acceptance criteria**:
- Template library has at least 8 engagement types pre-configured in MVP 1.0 (per tenant)
- Tenant admin can author custom templates (limited to MVP 1.0 — full custom template authoring is v2.1)
- Template application is a one-way copy at creation time — future template updates don't retroactively apply to existing engagements

**US-ENG-003 — Priya clones an existing engagement**

```gherkin
GIVEN Oakfield FY26 Single Audit is already in the archive
  AND Priya is creating Oakfield FY27 Single Audit
WHEN she clicks "Clone from existing..." and selects Oakfield FY26
THEN the new engagement pre-populates:
  - structure (pack attachments, team slots, phase budgets)
  - templates for APM, PRCM, work programs
  - carried-forward items flagged for review (prior findings that may be repeat findings; prior CAPs still open)
WHEN she confirms
THEN the new engagement is created with structure copied; findings/work papers/reports are NOT copied (that would be inappropriate)
```

**Acceptance criteria**:
- Clone preserves pack attachment + version (pinned to source engagement's pack version, not necessarily latest)
- Clone does NOT copy findings, work papers, reports (these are per-engagement artifacts)
- Clone DOES copy APM skeleton, PRCM template rows, team roster, budget profile
- Audit log captures the clone source and derivation chain

### 2.2 Multi-pack attachment

**US-ENG-004 — Priya adds an additional methodology mid-engagement**

```gherkin
GIVEN Oakfield FY27 Single Audit exists with GAGAS + Single Audit already attached
  AND Priya realises mid-planning that the engagement should also claim IIA GIAS conformance
WHEN she opens engagement settings → Attached Packs
  AND she clicks "Attach additional methodology"
  AND she selects IIA_GIAS:2024
  AND she provides rationale ("Engagement now supports the bureau's IIA conformance reporting")
  AND she saves
THEN IIA_GIAS:2024 is attached
  AND the strictness resolver re-runs, re-computing all ~30 dimensions
  AND any dimension whose value changed fires a notification to the CAE
  AND a new audit_event is logged with before/after values
  AND the engagement's combined workflow state machine is re-evaluated
```

**Acceptance criteria**:
- Mid-engagement pack attach requires documented rationale (min 50 chars)
- Mid-engagement pack attach requires CAE approval if the engagement is past PLANNING phase
- Re-resolution runtime p99 < 2 seconds at engagement mid-lifecycle
- Any findings already created must be re-validated against the new pack's required finding elements; if the new pack requires additional fields on existing findings, a notification is generated for Priya to fill them in
- Rollback possible within 30 days if attach was erroneous (restoration to pre-attach state)

**US-ENG-005 — Priya detaches a control framework**

```gherkin
GIVEN an engagement has SOC2:2017 attached but the vendor scope was cancelled
WHEN Priya detaches SOC2:2017
  AND provides rationale
  AND CAE approves
THEN SOC2 is removed from the engagement
  AND strictness resolver re-runs
  AND any findings that depended on SOC2-specific classifications or extensions become "flagged for review"
  AND related work papers referencing SOC2 controls remain but are flagged for scope-reduction context
```

**Acceptance criteria**:
- Detach always requires CAE approval (never AIC-only)
- Detach preserves historical data; findings don't lose their SOC2 classification history even if SOC2 is no longer attached going forward
- Detach flags any findings/work papers requiring scope reduction; engagement enters a "pack detach remediation" state until these are reviewed

### 2.3 Team management

**US-ENG-006 — Marcus assigns Priya as AIC and Anjali as staff**

```gherkin
GIVEN Oakfield FY27 engagement is in DRAFT
  AND Marcus is the CAE for the tenant
WHEN he opens the engagement team panel
  AND he adds Priya with role "Auditor-in-Charge"
  AND he adds Anjali with role "Staff Auditor"
  AND he sets hours budget: Priya 120h, Anjali 200h
THEN both auditors are assigned to the engagement
  AND CPE compliance check runs per `rules/cpe-rules.md §4.2` for each auditor:
    - If GREEN: assignment proceeds unblocked
    - If YELLOW: conditional assignment with specific documented condition
    - If RED: hard-block requiring CAE override with rationale
  AND independence declaration requirements are queued for each auditor before engagement enters FIELDWORK
  AND both auditors receive email notification of assignment
  AND the engagement now appears in both their home dashboards
```

**Acceptance criteria**:
- Team member removal during active engagement requires reason + CAE approval
- CPE compliance traffic light visible in team-assignment UI per `cpe-rules.md §4.2.3`
- Independence declarations tracked per auditor per engagement per `independence-rules.md §4`
- Team history maintained — removed members remain in audit log with assignment date range

**US-ENG-007 — Priya cannot exceed budget without CAE approval**

```gherkin
GIVEN Oakfield FY27 is in FIELDWORK
  AND Priya has budget 120h; she has logged 115h; she plans 20h more
WHEN she submits time entry totalling 15h
  AND the cumulative total reaches 130h (over budget)
THEN the time entry is accepted but flagged as "over budget"
  AND the engagement dashboard shows budget variance
  AND an alert is generated for Marcus as CAE
WHEN Priya's next time entry would push cumulative total > 150h (25% over)
THEN the time entry requires Marcus's approval before submission
```

**Acceptance criteria**:
- Budget tracking is per-engagement, per-phase, per-team-member
- Soft warning at 100% of budget; approval required at 125%
- Marcus can extend budget with documented reason (e.g., scope change)

### 2.4 Phase transitions

**US-ENG-008 — Priya transitions engagement from PLANNING to FIELDWORK**

```gherkin
GIVEN Oakfield FY27 is in PLANNING
  AND APM is approved
  AND PRCM is approved
  AND all team members have completed independence declarations
  AND all phase gate checks pass per `rules/workflow-state-machines.md §2.4`
WHEN Priya clicks "Transition to Fieldwork"
THEN engagement state → FIELDWORK
  AND work programs become editable
  AND time entries become billable against FIELDWORK budget
  AND notifications sent to team + CAE
  AND audit_event logged
WHEN a phase gate check fails (e.g., one team member's independence not declared)
THEN transition is blocked with specific message identifying what's missing
  AND Priya can either resolve the blocker or request CAE override (with rationale)
```

**Acceptance criteria**:
- All phase transitions enforce gates per the resolver-combined workflow
- CAE can override any gate with documented rationale (not bypass)
- Gate-check runtime < 2 seconds
- Audit log captures every gate check (passed/failed/overridden) with full context

**US-ENG-009 — Regression transition: FIELDWORK back to PLANNING**

```gherkin
GIVEN Oakfield FY27 is in FIELDWORK
  AND Priya discovers scope change requires APM revision
WHEN Priya requests regression to PLANNING
  AND she documents rationale (min 100 chars)
  AND Marcus approves
THEN engagement regresses to PLANNING
  AND work programs become read-only (protecting evidence)
  AND APM becomes editable again
  AND audit_event logged with regression context
  AND all work paper work-in-progress is preserved (not reset)
```

**Acceptance criteria**:
- Regressions always require CAE approval
- Regressions preserve fieldwork artifacts (work papers don't vanish)
- Regressions are logged with elevated visibility in audit trail for peer review

### 2.5 Engagement dashboard

**US-ENG-010 — Priya views her engagement dashboard**

```gherkin
GIVEN Priya is AIC on Oakfield FY27
WHEN she opens the engagement
THEN she sees a dashboard with:
  - Current phase (FIELDWORK) with phase progress indicator
  - Budget status (hours used vs. budget, per-team-member)
  - Open observations count
  - Open findings count by status (draft/review/approved)
  - Upcoming phase gate checklist with status per item
  - Recent activity feed (chronological)
  - Team members with their status (on/off, CPE status)
  - Pack attachments with version
  - Resolver-driven rule summary (retention, CPE requirement, cooling-off)
```

**Acceptance criteria**:
- Dashboard loads p99 < 800ms
- Activity feed shows last 50 events with pagination
- Dashboard refreshes on state changes (near-real-time via tRPC subscriptions or polling)
- Dashboard filterable by date range, team member, event type

**US-ENG-011 — Marcus views his portfolio dashboard**

```gherkin
GIVEN Marcus is CAE for Oakfield's audit function
WHEN he opens the CAE portfolio view
THEN he sees all active engagements with:
  - Engagement name + phase + % complete
  - Budget variance (green/yellow/red)
  - Open findings count
  - AIC assigned
  - Next phase-gate deadline
  - Any escalated issues (budget overage > 25%, overdue phase gates, quality flags)
```

**Acceptance criteria**:
- Portfolio view loads p99 < 1.5s with 30+ active engagements
- Filterable by phase, AIC, engagement type, status
- Sortable by any column
- Escalations surfaced prominently

### 2.6 Activity feed and comments

**US-ENG-012 — Anjali sees recent engagement activity**

```gherkin
GIVEN Anjali is staff on Oakfield FY27
WHEN she opens the engagement's Activity tab
THEN she sees a chronological feed including:
  - Phase transitions
  - Pack attach/detach events
  - Team member added/removed
  - Work paper uploads
  - Finding status changes
  - CAP milestones
  - Report events
  - Comments added by team members
WHEN Priya @mentions her in a work paper comment
THEN Anjali receives an in-app notification + email digest
```

**Acceptance criteria**:
- Activity feed captures all meaningful engagement events
- @mentions resolve to user accounts; notifications fire via the unified notification center (Module 16a)
- Feed paginated; loads last 50 events in < 500ms
- Filterable by event type, actor, date range

**US-ENG-013 — Priya adds an engagement-level comment for coordination**

```gherkin
GIVEN Priya needs to coordinate with Anjali and Marcus
WHEN she posts an engagement comment "Found issues with the federal grant documentation; Marcus, can we discuss before Anjali starts testing?"
  AND she @mentions Marcus
THEN the comment appears in the engagement's Activity/Comments tab
  AND Marcus gets notified via in-app + email
  AND the comment is preserved as a first-class object (searchable, referenced)
```

**Acceptance criteria**:
- Comments support rich text (same TipTap editor as findings)
- @mentions trigger notifications
- Comments linked to specific engagement; not inherently tied to any specific entity within (that's what inline comments on findings/work papers are for)
- Threaded reply support
- Resolution tracking (comment can be "resolved" indicating addressed)

### 2.7 Search and discovery

**US-ENG-014 — Priya searches for a prior engagement**

```gherkin
GIVEN Priya wants to find Oakfield's prior-year Single Audit
WHEN she uses the global engagement search
  AND searches "Oakfield" + engagement type filter "Single Audit"
THEN matching engagements appear in results
  AND are filterable by date range, AIC, status, pack attachments
  AND she can navigate directly to the engagement
```

**Acceptance criteria**:
- Search is tenant-scoped (strictness resolver + RLS enforced)
- Result relevance based on full-text search with tenant name, engagement name, entity name
- Results paginated with < 500ms p99
- Support saved searches (MVP 1.5+)

### 2.8 Archive and retention

**US-ENG-015 — Marcus archives a closed engagement**

```gherkin
GIVEN Oakfield FY26 is in CLOSED state (all CAPs resolved; follow-up window elapsed)
WHEN Marcus initiates archival
  AND confirms retention period (derived from resolver; 7 years per GAGAS driven by IIA contribution)
THEN engagement transitions to ARCHIVED
  AND all engagement artifacts (work papers, findings, reports, CAPs) are marked archived
  AND artifacts remain readable but become immutable
  AND retention timer starts
  AND audit_event logged
WHEN retention period expires
THEN engagement transitions to PURGE_SCHEDULED
  AND auditee is notified (30-day notice)
  AND cryptographic erasure occurs after notice period
  AND final purge audit_event logged
```

**Acceptance criteria**:
- Archival respects the resolver's `DOCUMENTATION_RETENTION_YEARS` (max across packs)
- Purge is cryptographic (DEK destroyed; ciphertext remains but is unrecoverable) per ADR-0001
- Audit log of purge retained indefinitely (the log itself is not purged)

---

## 3. Edge cases

### 3.1 Pack version upgrade mid-engagement

If an attached pack gets a new version published mid-engagement (e.g., GAGAS:2024 → GAGAS:2024.1 minor update), the engagement stays pinned to the version it was created against unless the user explicitly opts to upgrade.

- Engagement settings show "Pack update available" banner
- Upgrade is not automatic; requires CAE approval
- Upgrade triggers resolver re-run (all ~30 dimensions re-evaluated)
- Upgrade is audit-logged with the before/after version
- Rollback possible within 14 days

### 3.2 Auditee change during engagement

Rare but real: the audited entity changes mid-engagement (e.g., a subsidiary is divested from the parent being audited). Handling:

- Engagement scope is formally amended
- If a different entity becomes in-scope, a new engagement may be warranted (not modification)
- If the modification is scope-contraction, it's logged but the engagement continues

### 3.3 Team member leaves the firm mid-engagement

- Outgoing auditor's records remain attached to the engagement (historical accuracy)
- Their work papers remain under their authorship
- Reassignment of their active work items happens explicitly
- Their engagement access is revoked per `auth/REVOCATION-POLICY.md`

### 3.4 Budget overrun with no funds approved

- Engagement budget can be exceeded only with CAE approval
- CAE-approved budget extension creates a new budget line with new amount
- Original budget remains as reference for variance analysis

### 3.5 Engagement deletion

- Engagements in DRAFT can be deleted by AIC or CAE
- Engagements past PLANNING cannot be deleted — only ABANDONED (a state) with CAE approval + Audit Committee notification for material findings
- Deletion of DRAFT engagement removes the record (with audit log note)
- ABANDONED engagements remain in audit log forever

### 3.6 Concurrent user editing — field-level granularity, not entity-level locks

A naïve entity-level 409 Conflict on every concurrent edit to an engagement would be miserable UX. Priya adjusting the budget for 15 minutes shouldn't have her work wiped because Marcus saved a team-member assignment at minute 14. Engagement is the central hub; concurrency has to be field-level for the daily experience.

**Granular update endpoints, not a single `update()` mutation**: the tRPC API surfaces per-concern endpoints rather than a single `engagement.update()`:

- `engagement.updateMetadata(input: {id, name?, clientEngagementCode?, description?})` — name, code, description only
- `engagement.updateScope(input: {id, scope?, auditeeEntity?, period?})` — scope-level fields
- `engagement.updateBudget(input: {id, phase, memberBudgets[], phaseBudget?})` — budget-only
- `engagement.addTeamMember(input: {id, userId, role, budget})` / `engagement.removeTeamMember(...)` — team changes
- `engagement.attachPack(...)` / `engagement.detachPack(...)` / `engagement.upgradePackVersion(...)` — pack changes
- `engagement.transitionPhase(...)` / `engagement.regressPhase(...)` — phase changes

Each endpoint has its own optimistic-concurrency check scoped to the fields it touches. Priya's budget edit and Marcus's team assignment don't collide.

**Version tracking at field-group level**: the engagement entity has separate version fields per concern:
- `metadataVersion`
- `scopeVersion`
- `budgetVersion`
- `teamVersion`
- `packVersion`
- `phaseVersion`

Each mutation checks + increments only its relevant version. Only genuine conflicts (two users editing the same concern simultaneously) produce a 409.

**Genuine conflict UX (same concern, truly simultaneous)**: if Marcus and another CAE both try to reassign the same team role at literally the same moment:
- 409 returned to the later writer
- Frontend shows a banner: "Your changes conflict with a recent save by Marcus Chen. Review the current state and re-apply your edit."
- The user's in-flight edit is preserved in the frontend (not discarded); they see a diff view of their change vs. current state and can choose to re-apply, merge, or discard
- No wiping of pending work

**When we need real-time collaborative editing**: rich-text fields like APM authoring and finding narratives use operational transforms or CRDTs (per Phase 1 R1 "real-time collab" scope decision — comments/@mentions/track-changes, not full Google-Docs). The engagement-metadata layer uses field-level concurrency; the rich-text authoring layer uses OT where MVP 1.0 + 1.5 needs.

**What this rules out**: an end-to-end "edit engagement" form where every field saves together in one mutation. The engagement view is composed of discrete editors per concern. This is a UX consequence engineering must implement deliberately.

### 3.7 Resolver override required mid-engagement

If a pack attachment change introduces a resolver dimension requiring override (e.g., a new regulatory overlay introduces a material framework conflict with an existing methodology), the engagement transitions to "pending override resolution" and cannot advance phase until Kalpana or CAE resolves with documented rationale per `strictness-resolver-rules.md §4`.

---

## 4. Data model touch points

Primary entities affected per `data-model/tenant-data-model.ts`:

- `Engagement` — the core entity (fields: id, tenantId, name, type, primaryMethodology, additionalMethodologies, controlFrameworks, regulatoryOverlays, team, budget, phase, status, lockedAt, version, bitemporal fields)
- `EngagementTeamAssignment` — role assignments per user per engagement
- `EngagementBudget` — per-phase budget with history
- `EngagementActivity` — activity feed entries
- `EngagementComment` — comments (rich text)
- `EngagementOverride` — resolver overrides applied to this engagement
- `AuditEvent` — hash-chained audit trail

Related entities affected indirectly:
- `Finding` (per engagement)
- `WorkPaper` (per engagement)
- `Report` (per engagement)
- `CAP` (per finding, transitively per engagement)

Resolver-computed fields cached on engagement:
- `effectiveRetentionYears`
- `effectiveCPERequirements` (union across attached packs)
- `effectiveIndependenceCoolingOffMonths`
- `effectivePhaseGates` (the combined workflow)
- etc. for all ~30 dimensions

These cached fields are re-computed on every pack attach/detach and version upgrade.

---

## 5. API endpoints

Per the API conventions in `api-catalog.md` (Phase 5):

### 5.1 tRPC procedures

```typescript
// Creation
engagement.create(input: EngagementCreateInput): Engagement
engagement.createFromTemplate(input: {templateId, overrides}): Engagement
engagement.clone(input: {sourceEngagementId, overrides}): Engagement

// Retrieval
engagement.get(input: {id}): Engagement
engagement.list(input: {filter, sort, pagination}): PaginatedEngagements
engagement.search(input: {query, filters}): PaginatedEngagements

// Updates
engagement.update(input: EngagementUpdateInput): Engagement  // optimistic concurrency
engagement.attachPack(input: {engagementId, packRef, rationale}): Engagement
engagement.detachPack(input: {engagementId, packRef, rationale}): Engagement
engagement.upgradePackVersion(input: {engagementId, packCode, newVersion}): Engagement

// Team
engagement.assignTeamMember(input: {engagementId, userId, role, budget}): TeamAssignment
engagement.removeTeamMember(input: {engagementId, userId, reason}): void
engagement.updateBudget(input: {engagementId, phase, newBudget}): EngagementBudget

// Phase transitions
engagement.transition(input: {engagementId, toPhase, overrideJustification?}): Engagement
engagement.regressPhase(input: {engagementId, toPhase, rationale}): Engagement

// Activity and comments
engagement.getActivity(input: {engagementId, filter, pagination}): PaginatedActivity
engagement.addComment(input: {engagementId, content, mentionedUsers?}): Comment
engagement.resolveComment(input: {commentId}): Comment

// Archival
engagement.archive(input: {engagementId}): Engagement
engagement.schedulePurge(input: {engagementId, purgeDate}): Engagement (CAE only)
```

### 5.2 REST endpoints (for external integrators)

`GET /v1/engagements` — list with filters
`GET /v1/engagements/:id` — get single
`POST /v1/engagements` — create
`PATCH /v1/engagements/:id` — update
`POST /v1/engagements/:id/packs` — attach pack
`DELETE /v1/engagements/:id/packs/:packRef` — detach pack
`POST /v1/engagements/:id/team` — assign
`POST /v1/engagements/:id/transition` — phase transition
`GET /v1/engagements/:id/activity` — activity feed

API versioning: URL-major `/v1/` + dated header minors per ADR-0007.

### 5.3 Webhook events

Per the webhook catalog (Phase 5):

- `engagement.created`
- `engagement.pack.attached`
- `engagement.pack.detached`
- `engagement.phase.transitioned`
- `engagement.team.member.added`
- `engagement.team.member.removed`
- `engagement.budget.exceeded`
- `engagement.archived`

HMAC-signed per ADR-0004.

---

## 6. Permissions and access control

### 6.1 Permission matrix

| Role | Create | View | Edit metadata | Attach/detach pack | Phase transition | Archive | Delete (DRAFT only) |
|---|---|---|---|---|---|---|---|
| Auditor-in-Charge (AIC) | ✅ | ✅ (assigned engagements only) | ✅ | ⚠️ (with CAE approval post-PLANNING) | ✅ | ✅ | ✅ |
| Staff Auditor | ❌ | ✅ (assigned engagements only) | ⚠️ (limited to specific fields) | ❌ | ❌ | ❌ | ❌ |
| CAE | ✅ | ✅ (all engagements in tenant) | ✅ | ✅ | ✅ (approve overrides) | ✅ | ✅ |
| Audit Function Director | ✅ | ✅ | ✅ | ✅ | ✅ (approve overrides) | ✅ | ✅ |
| Audit Partner (Elena) | ✅ | ✅ (firm-level; cross-engagement analytics) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenant Admin (Sofia) | ❌ | ❌ (not audit content; infra only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Platform Admin (Ravi) | ❌ | ⚠️ (support-mode only, time-bounded, logged) | ❌ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Tenant isolation

Enforced via two layers per ADR-0002:
- **Prisma Client Extension** injects `tenantId` into every WHERE clause
- **RLS policies** verify `SET LOCAL app.current_tenant` on every query

Cross-tenant queries impossible by design. Engagement data for Oakfield never accessible from any other tenant's session.

### 6.3 Sensitive fields

ALE-encrypted per ADR-0001:
- Auditee financial information (if stored on engagement record for scope purposes)
- Team member SSN / personal identifiers
- Pack-specific sensitive metadata

---

## 7. Observability

### 7.1 Metrics emitted

- `engagement.create.count` (counter, labels: tenantId, engagementType, primaryMethodology)
- `engagement.create.duration` (histogram)
- `engagement.resolver.duration` (histogram) — resolver runtime
- `engagement.phase.transition.count` (counter, labels: fromPhase, toPhase, overridden)
- `engagement.budget.variance.gauge` (gauge per active engagement)
- `engagement.pack.attach.count` (counter)
- `engagement.team.size.gauge` (gauge per active engagement)

### 7.2 Tracing

OpenTelemetry span per tRPC procedure per ADR-0004:
- `engagement.create` span includes: resolver span, prisma write span, audit log write span
- `engagement.transition` span includes: gate check spans, resolver span, notification span
- Trace propagation across worker boundaries for deferred notifications

### 7.3 Logging

Structured JSON logs via Pino per `docs/04-architecture-tour.md §5.3`:
- Every engagement state change logged at `info` level
- Every pack attach/detach logged at `info` level
- Resolver runs logged at `debug` level (sampled for production volume)
- Audit log entries written to separate hash-chained stream

### 7.4 Alerts

- p99 engagement.create latency > 2s for 5 minutes
- Resolver failures > 10/hour
- Cross-tenant read attempt (always P1; see `database/POOLING.md`)

---

## 8. Performance characteristics

### 8.1 SLO targets (MVP 1.0)

- `engagement.create` p99 < 2s (includes resolver run)
- `engagement.list` p99 < 1s (with 500 engagements per tenant)
- `engagement.search` p99 < 2s
- `engagement.get` p99 < 500ms
- `engagement.transition` p99 < 3s (includes all gate checks + notifications)

### 8.2 Scale targets (MVP 1.0)

- 500 active engagements per tenant
- 10,000 historical engagements per tenant
- 50 concurrent users per tenant
- Engagement search across 10k engagements < 2s

### 8.3 Degraded-mode behaviour

- If resolver service is slow/unavailable: engagement create is blocked (cannot proceed without resolver); UI shows clear message
- If audit log service is unavailable: engagement writes block (audit log is critical path)
- If notification service is unavailable: engagement writes proceed; notifications queue for delivery via retries

---

## 9. Compliance implications

### 9.1 Controls mapped

- **GAGAS §5.40**: engagement planning supervision — satisfied by CAE approval on phase transitions
- **GAGAS §6.33**: supervisory review — satisfied by approval chain per `approval-chain-rules.md`
- **IIA GIAS Principle 10**: engagement planning — satisfied by APM + PRCM workflows
- **IIA GIAS Principle 15**: quality assurance — satisfied by QA checklist (MVP 1.5) + supervisory review evidence
- **PCAOB AS 1220**: engagement quality review — satisfied by EQR workflow (when PCAOB attached)
- **Single Audit (2 CFR 200.514)**: engagement independence — satisfied by independence declaration workflow
- **SOC 2 CC6.1-6.7**: access control + documentation — satisfied by RBAC + audit log
- **GDPR Art. 30**: records of processing — satisfied by comprehensive audit log

### 9.2 Evidence for peer review

- Complete engagement audit trail (state changes, pack attachments, team assignments)
- Budget vs. actual tracking
- Supervisory review evidence (from approval chains)
- Independence and CPE compliance records (related)

All exportable in the peer review evidence bundle (MVP 1.5; manual until then).

### 9.3 Retention

Engagement data retained per `DOCUMENTATION_RETENTION_YEARS` resolver output. For Oakfield (GAGAS + IIA): 7 years. For PCAOB engagements: 7 years minimum. Retention enforced via scheduled archival + cryptographic erasure per ADR-0001.

---

## 10. Dependencies on other features

### 10.1 Upstream dependencies

- **Tenant onboarding + admin** (Module 1) — tenant must exist
- **Identity + auth + SSO** (Module 2) — users must authenticate
- **Standards pack library** (Module 14 pre-built packs) — packs must be available for attachment
- **Annual plan** (Module 3) — engagement typically created from annual plan item

### 10.2 Downstream dependencies (features that depend on engagement)

- APM (Module 5) — created under an engagement
- PRCM (Module 6) — created under an engagement
- Fieldwork + work papers (Module 7) — under an engagement
- PBC (Module 7a) — under an engagement
- Findings (Module 8) — under an engagement
- CAPs (Module 9) — under engagement's findings
- Reports (Module 10) — under an engagement

### 10.3 Cross-cutting dependencies

- Strictness resolver — runs at engagement creation + updates
- Notifications (Module 16a) — engagement events trigger notifications
- Audit log (Module 17) — every state change logged
- Dashboards (Module 16) — engagement data surfaces in dashboards

---

## 11. UX flow references

Detailed UX specifications in [`ux/engagement-creation.md`](../ux/engagement-creation.md) (Phase 6 pending) and [`ux/engagement-dashboard.md`](../ux/engagement-dashboard.md) (Phase 6 pending).

Key UX patterns used:
- **Pack attachment UI** — multi-select with pack-version picker; shows resolver impact preview
- **Phase gate checklist** — visible checklist at top of engagement view showing current gate status
- **Budget burn chart** — time-series visualisation of hours used vs. budget
- **Activity feed** — chronological list with filtering and search
- **Team panel** — grid with role, assignment date, CPE status, independence status

---

## 12. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 4 — feature inventory
- [`04-mvp-scope.md §2.2`](../04-mvp-scope.md) — MVP 1.0 engagement features
- [`rules/strictness-resolver-rules.md`](../rules/strictness-resolver-rules.md) — resolver applied at engagement creation
- [`rules/workflow-state-machines.md §2`](../rules/workflow-state-machines.md) — engagement state machine
- [`rules/approval-chain-rules.md §2`](../rules/approval-chain-rules.md) — engagement-level approval chains
- [`02-personas.md`](../02-personas.md) — Priya, Marcus, Anjali, Elena
- [`data-model/tenant-data-model.ts`](../../data-model/tenant-data-model.ts) — Engagement entity shape
- [`docs/02-worked-example-single-audit.md`](../../docs/02-worked-example-single-audit.md) — Oakfield FY27 worked example
- [`features/pack-attachment-and-annotation.md`](pack-attachment-and-annotation.md) — related spec
- [`features/finding-authoring.md`](finding-authoring.md) — finding spec (engagement-scoped)

---

## 13. Domain review notes — Round 1 (April 2026)

External review (Google Gemini, VP of Product in GRC/Audit SaaS) flagged two refinements:

- **§2.1 — clientEngagementCode**: firms have their own billing/ERP engagement codes (e.g., `SA-2027-001`). System-generated `eng-oak-2027-00042` is fine under the hood but should coexist with a user-defined external code for integration with CCH, Star Practice Management, Workday PSA, etc. Added as a user-editable field in US-ENG-001 acceptance criteria.
- **§3.6 — field-level concurrency**: generic entity-level 409 on every concurrent edit would be miserable UX. Reviewer correctly flagged the "Priya loses 15 minutes of budget tweaking because Marcus assigned a team member" scenario. Fix: granular update endpoints (`engagement.updateMetadata`, `engagement.updateBudget`, `engagement.updateScope`, `engagement.addTeamMember`, etc.) each with their own version fields. Conflicts only fire on genuine same-concern races. Entity-level 409 ruled out.

See strictness-resolver-rules.md §9 for the overall Phase 3 review verdict; Phase 4 Part 1's verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
