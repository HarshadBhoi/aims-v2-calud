# API Catalog

> The single authoritative reference for AIMS v2's API surface. Consolidates the tRPC procedures, REST endpoints, and webhook events described across the 18 feature specs in [`features/`](features/). This is the artifact engineers build against, QA tests against, and integrators read before writing a line of client code. Schemas are defined once here and referenced from the feature specs.

---

## 1. Purpose and boundaries

AIMS v2 exposes three interface types:

1. **tRPC procedures** — the primary data interface for the Next.js frontend. Typed end-to-end via TypeScript. Internal consumption only; not exposed to external integrators. Versioned by Zod snapshot tests per ADR-0007 (not URL-versioned).
2. **REST API** (`/v1/*`) — public external-integrator surface. URL-major + dated-header-minor versioning per [ADR-0007](../references/adr/0007-api-versioning-hybrid.md). OpenAPI 3.1 spec generated from Zod schemas.
3. **Webhook events** — outbound event delivery to customer-configured endpoints via transactional outbox per [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md). HMAC-signed (Stripe-style).

### 1.1 What this catalog is NOT

- **Not a feature spec.** For feature-level user stories, acceptance criteria, edge cases, see [`features/`](features/).
- **Not a reproduction of the OpenAPI spec.** The formal OpenAPI 3.1 document is auto-generated from Zod schemas at build time; this catalog is the human-readable companion.
- **Not the data model schema.** Entity-level data shapes are in [`data-model/tenant-data-model.ts`](../data-model/tenant-data-model.ts). The catalog shows API-level request/response shapes, which may differ from internal data model.

### 1.2 Conventions used in this doc

- `🔒 RLS`: enforced by Prisma Client Extension + RLS policies per [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md)
- `🔑 Auth`: authentication requirement (JWT for tRPC; API key / OAuth2 for REST)
- `🧪 Idempotency`: mutation accepts `Idempotency-Key` header for duplicate-safe retries
- `📋 Audit log`: emits hash-chained audit event per [ADR](../references/adr/)
- `📡 Webhook`: emits webhook event(s) via transactional outbox
- `⏱ Rate limit`: subject to rate limiting per §8

---

## 2. Cross-cutting conventions

### 2.1 Authentication

#### tRPC (internal)

- **JWT Bearer tokens** issued by the auth service per [`features/identity-auth-sso.md`](features/identity-auth-sso.md)
- EdDSA-signed, 15-minute TTL per ADR-0005
- `Authorization: Bearer <jwt>` header
- Tenant context derived from JWT claims — no tenant ID in URL paths
- Token refresh via opaque refresh tokens (rotation-tracked)

#### REST (external)

**MVP 1.0 — API keys only**:
- `Authorization: Bearer aims_pk_live_<random>` header
- Key scoped to tenant + permissions (read / write / per-entity-type)
- Rotatable; expires per tenant policy (default 12 months)
- Created via tenant admin UI; shown once at creation

**v2.1 — adds OAuth 2.0 Client Credentials**:
- `POST /oauth/token` exchanges client_id + client_secret for short-lived access token
- `Authorization: Bearer <oauth-access-token>` header
- Standard OAuth scopes: `read:engagements`, `write:findings`, etc.

### 2.2 Versioning

Per [ADR-0007](../references/adr/0007-api-versioning-hybrid.md):

- **URL major**: `/v1/` (stable; `/v2/` only for hard-breaking changes, rare)
- **Header minor**: `Api-Version: YYYY-MM-DD` (dated snapshots)
- Response includes `Api-Version` header echoing the version applied
- Absent `Api-Version` → server defaults to the oldest active version for that major
- Dated versions frozen in shape; additions ship as new dated versions
- Compatibility shim per dated version lives at `api/requests/rest/versioning/`
- Deprecation: `Deprecation: true` + `Sunset: <ISO date>` response headers per RFC 8594
- Minimum 18-month support window per dated version

### 2.3 Idempotency

All mutations accept `Idempotency-Key` header:

- Client-generated UUID or ULID
- Stored in `idempotency_keys` table with 24-hour TTL
- Duplicate request with same key + same payload → returns original response (with `Idempotent-Replay: true` header)
- Duplicate request with same key + different payload → `409 Conflict` with `code: idempotency_key_conflict`
- Recommended for all writes from retrying clients (webhook handlers, background workers)

### 2.4 Pagination

Cursor-based pagination across all list endpoints:

**Request**:
```
GET /v1/engagements?pageSize=50&cursor=eyJpZCI6IjEyMyJ9
```

**Response**:
```json
{
  "items": [ ... ],
  "pageInfo": {
    "hasNextPage": true,
    "nextCursor": "eyJpZCI6IjE3MyJ9",
    "totalCount": 342
  }
}
```

- `pageSize` default 25, max 100
- `cursor` opaque base64-encoded string; do not parse client-side
- `totalCount` optional per endpoint; expensive queries may omit
- Cursors stable across requests within a short window; tombstoned after 1 hour

### 2.5 Error taxonomy

All errors return structured JSON body + appropriate HTTP status:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "Engagement with id 'eng-oak-2027-00042' not found",
    "details": { "resource": "Engagement", "id": "eng-oak-2027-00042" },
    "requestId": "req_01H...",
    "timestamp": "2027-11-24T14:32:00Z"
  }
}
```

#### HTTP status ranges

- `2xx` — success
- `4xx` — client error (bad input, unauthorized, forbidden, conflict, rate-limited)
- `5xx` — server error (retry may succeed)

#### Error codes (machine-readable; stable across versions)

Generic:
- `unauthorized` — no valid auth (401)
- `forbidden` — authenticated but insufficient permissions (403)
- `resource_not_found` — target entity missing or RLS-hidden (404)
- `invalid_input` — Zod validation failed (400; includes `details.issues` array)
- `conflict` — concurrent modification or uniqueness violation (409)
- `rate_limited` — rate limit exceeded (429; includes `Retry-After` header)
- `internal_error` — unexpected server failure (500)

Idempotency:
- `idempotency_key_conflict` — same key used with different payload (409)
- `idempotency_key_ttl_expired` — key older than 24h (400)

Domain-specific (non-exhaustive; feature specs list full per-feature errors):
- `engagement_phase_gate_failed` — transition blocked by unmet phase gate
- `pack_validation_failed` — pack content fails validation layer
- `resolver_override_required` — engagement has unresolved override (per strictness-resolver-rules.md §4)
- `finding_immutable_post_issuance` — attempted edit of ISSUED finding
- `approval_chain_violated` — approval step out of order
- `cpe_compliance_blocked` — engagement assignment blocked by RED CPE status

Full error code reference in §7.

### 2.6 Webhook delivery

Per [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md) transactional outbox:

- Event written to `outbox_event` table in same DB transaction as state change
- NestJS worker dispatches HMAC-signed POST to customer-configured endpoint
- Retry schedule: 1m, 5m, 15m, 1h, 6h, 24h (6 attempts max)
- After exhaustion → DLQ; customer notified; manual re-drive from admin UI
- Delivery expected within 30s of state change at p99
- Each event has unique `event_id`; consumer deduplication via this key

#### HMAC signature verification

**Headers on every delivery**:
```
X-AIMS-Signature: sha256=<hex-digest>
X-AIMS-Event-Id: evt_01H...
X-AIMS-Event-Type: finding.issued
X-AIMS-Timestamp: 2027-11-24T14:32:00Z
X-AIMS-Delivery-Attempt: 1
```

**Signature computation** (Stripe-style):
```
signature = HMAC-SHA256(
  secret = webhook_secret,
  message = timestamp + "." + request_body
)
```

Consumer verifies:
1. Check `X-AIMS-Timestamp` within 5-minute tolerance (prevents replay)
2. Compute HMAC-SHA256 of `<timestamp>.<raw body>` using shared secret
3. Compare against `X-AIMS-Signature` header via constant-time comparison
4. Return 2xx to acknowledge; any non-2xx triggers retry

### 2.7 Tenant isolation

All queries tenant-scoped per ADR-0002 two-layer isolation:
- App-layer Prisma Client Extension injects `tenantId` into every WHERE clause
- RLS policy double-checks via `SET LOCAL app.current_tenant`
- Tenant derived from JWT claims (tRPC) or API key metadata (REST)
- **No endpoint accepts tenant ID as explicit parameter** — tenant is implicit from auth context

### 2.8 Field-level encryption (ALE)

Per [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md):
- Sensitive fields (financial interests, PHI, specific PII) encrypted application-layer via `packages/encryption/`
- Encrypted at rest via KMS-wrapped per-tenant DEK
- API responses return plaintext (decrypted in service layer for authorized users)
- Deterministic encryption for equality-queryable fields; blind indexes for search

---

## 3. tRPC Procedure Catalog

Organized by namespace. Each procedure documented with:
- Input Zod schema (reference to `packages/validation/`)
- Output shape
- Permissions (role-based)
- Side effects (audit log, webhook, notification)
- Performance SLO (from feature specs)
- Back-reference to feature spec

### 3.1 `engagement.*` — Engagement management

Primary spec: [`features/engagement-management.md`](features/engagement-management.md)

#### `engagement.create`
- **Input**: `{ name, clientEngagementCode?, type, entity, primaryMethodology, additionalMethodologies?, controlFrameworks?, regulatoryOverlays?, fiscalPeriod, teamTemplate? }`
- **Output**: `Engagement` (full object)
- **Permissions**: AIC+, CAE+, Audit Function Director, Audit Partner (Elena); not Staff or Tenant Admin
- **🔒 RLS** 🔑 Auth 🧪 Idempotency 📋 Audit log 📡 Webhook `engagement.created`
- **SLO**: p99 < 2s (includes resolver run)
- **Errors**: `invalid_input`, `pack_validation_failed`, `resolver_override_required` (on creation if any override-required dimension)

#### `engagement.createFromTemplate`
- **Input**: `{ templateId, overrides }`
- **Output**: `Engagement`
- Same permissions / SLOs / side effects as `create`

#### `engagement.clone`
- **Input**: `{ sourceEngagementId, overrides }`
- **Output**: `Engagement`
- Copies structure only — not findings/work papers/reports
- Pack refs carried forward at source's pinned version

#### `engagement.get`
- **Input**: `{ id }`
- **Output**: `Engagement` (with eager-loaded packs, team, resolver output summary)
- **Permissions**: any user assigned to engagement OR CAE+ in tenant
- **SLO**: p99 < 500ms

#### `engagement.list`
- **Input**: `{ filter?: { status?, type?, phase?, aicId?, auditeeEntityId?, dateRange? }, sort?, pagination }`
- **Output**: `PaginatedEngagements`
- **SLO**: p99 < 1s with 500 engagements per tenant

#### `engagement.search`
- **Input**: `{ query, filters?, pagination }`
- **Output**: `PaginatedEngagements`
- Full-text across name, clientEngagementCode, entity, description

#### `engagement.updateMetadata`
- **Input**: `{ id, metadataVersion, name?, clientEngagementCode?, description? }`
- **Output**: `Engagement`
- Per-concern optimistic concurrency per `features/engagement-management.md §3.6`
- **Errors**: `conflict` (metadataVersion stale)

#### `engagement.updateScope`
- **Input**: `{ id, scopeVersion, scope?, auditeeEntity?, fiscalPeriod? }`
- **Output**: `Engagement`

#### `engagement.updateBudget`
- **Input**: `{ id, budgetVersion, phase, memberBudgets[], phaseBudget? }`
- **Output**: `EngagementBudget`

#### `engagement.attachPack`
- **Input**: `{ engagementId, packRef: { code, version }, rationale }`
- **Output**: `Engagement` with updated attachments + re-resolver output
- **Permissions**: AIC (DRAFT/PLANNING); CAE+ (post-PLANNING with rationale)
- **📋 Audit log** 📡 Webhook `engagement.pack.attached`
- **SLO**: resolver re-run p99 < 2s

#### `engagement.detachPack`
- **Input**: `{ engagementId, packRef, rationale }`
- **Output**: `Engagement`
- **Permissions**: CAE only (always)

#### `engagement.upgradePackVersion`
- **Input**: `{ engagementId, packCode, newVersion }`
- **Output**: `UpgradePreview | Engagement`
- Preview first; require CAE approval to commit
- **Errors**: `pack_validation_failed`, `engagement_in_wrong_phase`

#### `engagement.assignTeamMember`
- **Input**: `{ engagementId, userId, role, budget?, teamVersion }`
- **Output**: `TeamAssignment`
- Runs CPE compliance check per `features/qa-independence-cpe.md §3.3`; returns GREEN/YELLOW/RED status; YELLOW creates `EngagementAssignmentCondition`

#### `engagement.removeTeamMember`
- **Input**: `{ engagementId, userId, reason, teamVersion }`
- **Output**: void
- **Permissions**: AIC (draft); CAE (post-planning)

#### `engagement.transition`
- **Input**: `{ engagementId, toPhase, overrideJustification?, phaseVersion }`
- **Output**: `Engagement`
- Runs all phase-gate checks per workflow state machine
- **Errors**: `engagement_phase_gate_failed` with specific failed checks in details

#### `engagement.regressPhase`
- **Input**: `{ engagementId, toPhase, rationale }`
- **Output**: `Engagement`
- **Permissions**: CAE only
- Requires min 100-char rationale

#### `engagement.getActivity`
- **Input**: `{ engagementId, filter?, pagination }`
- **Output**: `PaginatedActivity`

#### `engagement.addComment`
- **Input**: `{ engagementId, content, mentionedUsers? }`
- **Output**: `Comment`
- 📡 Webhook `engagement.comment.added`

#### `engagement.resolveComment`
- **Input**: `{ commentId }`
- **Output**: `Comment`

#### `engagement.archive`
- **Input**: `{ engagementId }`
- **Output**: `Engagement`
- **Permissions**: CAE+

#### `engagement.schedulePurge`
- **Input**: `{ engagementId, purgeDate }`
- **Output**: `Engagement`
- **Permissions**: CAE (with tenant admin countersign per `features/tenant-onboarding-and-admin.md`)

### 3.2 `finding.*` — Finding authoring

Primary spec: [`features/finding-authoring.md`](features/finding-authoring.md)

#### `finding.create`
- **Input**: `{ engagementId, title, applicableMethodologies? }`
- **Output**: `Finding` (DRAFT state)
- **Permissions**: AIC+; not Staff (per feature spec §9)
- 🧪 Idempotency 📋 Audit log

#### `finding.update`
- **Input**: `{ id, findingVersion, coreElements?, standardExtensions?, ... }`
- **Output**: `Finding`
- Incremental save in DRAFT only
- **Errors**: `finding_immutable_post_issuance` (if ISSUED)

#### `finding.submitForReview`
- **Input**: `{ findingId }`
- **Output**: `Finding` (IN_REVIEW)
- Validation: required fields, classifications per applicable pack, ≥1 evidence reference
- 📡 Webhook `finding.submitted`

#### `finding.approve`
- **Input**: `{ findingId, comment? }`
- **Output**: `Finding`
- **Permissions**: CAE; or approval chain per `rules/approval-chain-rules.md §3`
- 📋 Audit log 📡 Webhook `finding.approved`

#### `finding.requestRevision`
- **Input**: `{ findingId, comments }`
- **Output**: `Finding` (back to DRAFT)
- **Permissions**: reviewer in approval chain

#### `finding.reject`
- **Input**: `{ findingId, reason }`
- **Output**: `Finding` (ABANDONED)
- **Permissions**: CAE

#### `finding.issue`
- Typically triggered by report issuance (see `report.issue`); direct API exists for standalone findings
- **Input**: `{ findingId }`
- **Output**: `Finding` (ISSUED)
- 📡 Webhook `finding.issued` (triggers CAP workflow + response window)

#### `finding.initiateAmendment`
- **Input**: `{ findingId, rationale }` (min 100 chars)
- **Output**: `Finding`
- **Permissions**: CAE only

#### `finding.submitAmendment`
- **Input**: `{ findingId, newContent }`
- **Output**: `Finding`

#### `finding.approveAmendment`
- **Input**: `{ findingId }`
- **Output**: `Finding`
- 📡 Webhook `finding.amended`

#### `finding.get` / `finding.list` / `finding.getHistory`
- Standard CRUD read patterns
- History returns bitemporal versions

#### `finding.getPreview`
- **Input**: `{ findingId, forPackRef }`
- **Output**: `FindingRendering` (shows how the finding renders under a specific pack's vocabulary)
- Supports multi-standard rendering per `features/finding-authoring.md §1.1`

#### `finding.linkEvidence`
- **Input**: `{ findingId, workPaperId, note? }`
- **Output**: `EvidenceLink`

#### `finding.unlinkEvidence`
- **Input**: `{ evidenceLinkId }`
- **Output**: void

#### `finding.associateRecommendation`
- **Input**: `{ findingId, recommendationId }`
- **Output**: void
- M:N relationship

#### `finding.dissociateRecommendation`

#### `finding.addComment`
- **Input**: `{ findingId, elementCode?, content, mentions? }`
- **Output**: `Comment`
- Element-anchored or finding-level
- 📡 Webhook `finding.comment.added`

#### `finding.replyToComment` / `finding.resolveComment`

#### `finding.bulkUpdate`
- **Input**: `{ findingIds[], operation, context }`
- **Output**: `BulkUpdateJob`
- Per `features/dashboards-and-search.md §8.1` — strong confirmation required client-side; no undo
- Async via SQS worker

### 3.3 `report.*` — Report generation

Primary spec: [`features/report-generation.md`](features/report-generation.md)

#### `report.create`
- **Input**: `{ engagementId, template, attestsTo: { code, version } }`
- **Output**: `Report` (DRAFT)
- 📋 Audit log

#### `report.update`
- **Input**: `{ reportId, reportVersion, sections?, distributionList? }`
- **Output**: `Report`

#### `report.submitForReview`

#### `report.approve`
- **Permissions**: per approval chain (Senior Manager → CAE etc. per `rules/approval-chain-rules.md §4`)

#### `report.requestRevision`

#### `report.issue`
- **Input**: `{ reportId }`
- **Output**: `Report` (ISSUED)
- **Permissions**: CAE only
- Large transactional commit: report locks, all included findings transition to ISSUED, CAP workflows start, distribution fires
- 📡 Webhooks `report.issued`, `finding.issued` (bulk for each included finding)

#### `report.get` / `report.list` / `report.getVersion`

#### `report.getPreview`
- **Input**: `{ reportId, format: 'pdf' | 'html' }`
- **Output**: `URL` (for PDF) or `HTMLString`
- PDF async via SQS worker per `features/report-generation.md §2.5`; returns job ID; polling endpoint
- HTML synchronous

#### `report.selectFindings`
- **Input**: `{ reportId, findingIds[] }`
- **Output**: `Report`

#### `report.updateSection`
- **Input**: `{ reportId, sectionName, content }`
- **Output**: `ReportSection`
- Auto-save target

#### `report.generateComplianceStatement`
- **Input**: `{ reportId }`
- **Output**: `ComplianceStatement` (auto-assembled from engagement's attached packs + `conformanceClaimed` flags)

#### `report.getDistributionList`
- **Input**: `{ reportId }`
- **Output**: `DistributionList`

#### `report.sendDistribution`
- **Input**: `{ reportId }`
- **Output**: `DistributionResult`
- Triggered at issuance; separate endpoint for re-delivery

#### `report.initiateAmendment` / `report.submitAmendment` / `report.issueAmendment`
- Full amendment workflow per `rules/workflow-state-machines.md §4.5`

#### `annualReport.create` / `.update` / `.issue`
- CAE-level annual summary report per `features/report-generation.md §4.4`

### 3.4 `recommendation.*` — Recommendations

Primary spec: [`features/recommendations-and-caps.md`](features/recommendations-and-caps.md)

#### `recommendation.create`
- **Input**: `{ text, actionableSteps?, targetCompletion?, findingIds? }`
- **Output**: `Recommendation`

#### `recommendation.update` / `.get` / `.list`

#### `recommendation.linkFinding`
- **Input**: `{ recommendationId, findingId }`
- **Output**: void

#### `recommendation.unlinkFinding`

#### `recommendation.suppress`
- **Input**: `{ findingId, reason }`
- Sets `soxSuppressRecommendation: true` on the finding (PCAOB ICFR use case)
- **Permissions**: CAE only

### 3.5 `cap.*` — Corrective Action Plans (auditor-side)

Primary spec: [`features/recommendations-and-caps.md`](features/recommendations-and-caps.md)

#### `cap.review`
- **Input**: `{ capId }`
- **Output**: `CAPReview` (moves to EVIDENCE_UNDER_REVIEW state, pauses SLA clock)

#### `cap.approve`
- **Input**: `{ capId, comment? }`
- **Output**: `CAP`
- 📡 Webhook `cap.approved`

#### `cap.requestRevision`
- **Input**: `{ capId, feedback }`

#### `cap.verify`
- **Input**: `{ capId, evidenceReviewedNote }`
- **Output**: `CAP` (VERIFIED)
- 📡 Webhook `cap.verified`; triggers finding RESOLVED transition

#### `cap.requestMoreEvidence`
- **Input**: `{ capId, specificRequests }`
- SLA clock resumes (auditee-active state)

#### `cap.abandon`
- **Input**: `{ capId, reason }`
- **Permissions**: CAE only; rationale min 200 chars

### 3.6 `auditeeCap.*` — CAPs (auditee-side)

Primary spec: [`features/recommendations-and-caps.md §4`](features/recommendations-and-caps.md)

Accessed via magic-link portal session per `features/recommendations-and-caps.md §4.1`:

#### `auditeeCap.list`
- Returns open CAPs visible to the session-active user

#### `auditeeCap.draft`
- **Input**: `{ capId, draft }`
- Identity captured per delegation flow

#### `auditeeCap.updateProgress`
- **Input**: `{ capId, actionId, progressNotes }`

#### `auditeeCap.submitEvidence`
- **Input**: `{ capId, files, note }`
- **Output**: `Evidence`
- 📡 Webhook `cap.evidence_submitted`

#### `auditeeCap.requestAbandonment`
- Auditee requests; auditor must approve to commit

### 3.7 `pbc.*` — PBC Request Management

Primary spec: [`features/pbc-management.md`](features/pbc-management.md)

#### `pbc.createList`
- **Input**: `{ engagementId, template? }`
- **Output**: `PBCList`

#### `pbc.addItem` / `.updateItem` / `.deleteItem`

#### `pbc.importFromPriorYear`
- **Input**: `{ engagementId, priorEngagementId }`

#### `pbc.generateRequests`
- **Input**: `{ listId, groupBy, sendSchedule }`
- **Output**: `GenerationResult`
- Bulk-generates emails with staggered send; async via SQS

#### `pbc.previewRequest`
- **Input**: `{ itemIds[], template }`
- **Output**: `EmailPreview`

#### `pbc.getStatus`
- **Input**: `{ engagementId, filter? }`
- **Output**: `StatusGrid`

#### `pbc.acceptDocument` / `.rejectDocument` / `.uploadDocument`

#### `pbc.sendReminder`
- **Input**: `{ itemId }`

#### `pbc.configureReminderCadence`
- **Input**: `{ engagementId, cadence }`

#### `pbc.getCompletionReport`

#### `pbc.listTemplates` / `pbc.createTemplate`

### 3.8 `auditeePortal.*` — Auditee-facing endpoints

Accessed via magic link per `features/recommendations-and-caps.md §4.1`:

#### `auditeePortal.login`
- **Input**: `{ magicLinkToken }`
- **Output**: `Session`
- Delegation flow: prompts for identity confirmation (I am X vs. drafting on behalf)

#### `auditeePortal.listRequests`
- Returns PBC requests + CAPs for session-active user

#### `auditeePortal.uploadDocument`
- **Input**: `{ documentContext, file }`
- Signed-URL upload directly to S3 for large files

### 3.9 `workpaper.*` — Fieldwork work papers

Primary spec: [`features/fieldwork-and-workpapers.md`](features/fieldwork-and-workpapers.md)

#### `workpaper.create`
- **Input**: `{ engagementId, stepId, template? }`
- **Output**: `WorkPaper`

#### `workpaper.update`
- **Input**: `{ workpaperId, workpaperVersion, narrative?, testResults? }`
- Test results go through data grid component per `features/fieldwork-and-workpapers.md §3.2`

#### `workpaper.submitForReview`

#### `workpaper.approve`
- **Input**: `{ workpaperId, signature }`
- **Permissions**: supervisor role per pack (GAGAS §6.33 etc.)

#### `workpaper.requestRevision`

#### `workpaper.attachEvidence`
- **Input**: `{ workpaperId, documentId, note? }`

#### `workpaper.lock` / `.unlock`
- Cascade lock on engagement phase transition; unlock requires CAE reason + approval

### 3.10 `workProgram.*`

#### `workProgram.create` / `.update` / `.addStep` / `.approveForFieldwork`

### 3.11 `sampling.*`

#### `sampling.createWorksheet`
- **Input**: `{ stepId, populationDescription, populationSize, sampleSize, methodology, riskRating, seed? }`
- Methodologies supported: GAGAS, AICPA, PCAOB, statistical random, attribute

#### `sampling.generateSample`
- **Input**: `{ worksheetId }`
- **Output**: `Sample[]`
- Reproducible via seed

#### `sampling.recordTestResult`

### 3.12 `observation.*`

#### `observation.create` / `.update`

#### `observation.escalateToFinding`
- **Input**: `{ observationId }`
- **Output**: `Finding` (pre-populated DRAFT)
- Carries observation context forward

#### `observation.dismiss`
- **Input**: `{ observationId, reason }`

### 3.13 `apm.*` — Audit Planning Memo

Primary spec: [`features/apm-workflow.md`](features/apm-workflow.md)

#### `apm.create`
- **Input**: `{ engagementId, template }`

#### `apm.updateSection`
- Section-level locking per `features/apm-workflow.md §2.3`; locks auto-release after 10 min inactivity

#### `apm.submitForReview` / `.approve` / `.requestRevision`
- Phase-gate: APM approval gates PLANNING → FIELDWORK transition

#### `apm.getVersion` / `.diff`
- Bitemporal version history

#### `apm.exportPDF`
- Async via SQS worker

### 3.14 `prcm.*` — Process-Risk-Control Matrix

Primary spec: [`features/prcm-matrix.md`](features/prcm-matrix.md)

#### `prcm.create` / `.update` / `.addProcess` / `.addRisk` / `.updateCell`

#### `prcm.linkControl`
- **Input**: `{ cellId, packRef, controlId }`
- Links PRCM cell to control framework pack (SOC 2 CC6.1, NIST 800-53 AC-2, etc.)

#### `prcm.exportPDF` / `.clone`

### 3.15 `auditUniverse.*`

Primary spec: [`features/audit-planning.md`](features/audit-planning.md)

#### `auditUniverse.list` / `.create` / `.update`

#### `auditUniverse.updateRisk`
- **Input**: `{ entityId, newRisk, reason }`
- Risk change tracked with rationale; drives plan suggestions

### 3.16 `annualPlan.*`

Primary spec: [`features/audit-planning.md`](features/audit-planning.md)

#### `annualPlan.create` / `.addItem` / `.submit` / `.approve`

#### `annualPlan.amend`
- Mid-year amendment with CAE approval; Audit Committee ratification at next meeting

### 3.17 `planProgress.*`

#### `planProgress.get`
- **Input**: `{ planId }`
- Real-time aggregation of plan vs. actual

#### `planProgress.yearEndReport`
- **Input**: `{ fiscalYear }`
- Year-end plan execution for board reporting

### 3.18 `pack.*` — Standard Pack Library

Primary spec: [`features/pack-attachment-and-annotation.md`](features/pack-attachment-and-annotation.md)

#### `pack.list`
- **Output**: `StandardPack[]` (shipped + tenant-annotated variants)

#### `pack.get`
- **Input**: `{ packRef }`
- **Output**: Full pack content

#### `pack.getChangelog`
- **Input**: `{ packRef, fromVersion, toVersion }`

### 3.19 `annotation.*` — Pack annotation/override

#### `annotation.list`
- **Input**: `{ tenantId, packRef? }`

#### `annotation.create` / `.update` / `.delete`
- **Permissions**: CAE+, Kalpana (Audit Function Director)

#### `annotation.preview`
- **Input**: `AnnotationInput`
- **Output**: `AnnotationPreview`
- Shows affected engagements + resolver dimension changes without committing

#### `annotation.history`
- Bitemporal version history per annotation

### 3.20 `resolver.*` — Strictness resolver

#### `resolver.getEngagementResolution`
- **Input**: `{ engagementId }`
- **Output**: `ResolverResult[]` — all ~30 dimensions with drivenBy attribution

#### `resolver.explainDimension`
- **Input**: `{ engagementId, dimensionKey }`
- **Output**: `DimensionExplanation` — full pack contributions + resolution + override status

### 3.21 `packVersion.*`

#### `packVersion.preview`
- **Input**: `{ packRef, newVersion }`
- **Output**: `UpgradePreview`

#### `packVersion.upgradeEngagement`
- **Input**: `{ engagementId, newVersion, rationale }`
- **Permissions**: CAE only for engagements past PLANNING

#### `packVersion.bulkUpgrade`
- **Input**: `{ engagementIds[], newVersion, timing, rationale }`
- **Output**: `BulkUpgradeJob`
- Async via SQS

### 3.22 `independence.*`

Primary spec: [`features/qa-independence-cpe.md`](features/qa-independence-cpe.md)

#### `independence.submitAnnual`
- **Input**: `DeclarationInput`

#### `independence.submitPerEngagement`
- **Input**: `EngagementDeclarationInput`

#### `independence.discloseImpairment`
- **Input**: `ImpairmentInput`
- Triggers evaluation workflow per `rules/independence-rules.md §4.4`

#### `independence.resolveImpairment`
- **Input**: `ResolutionInput`

### 3.23 `cpe.*`

Primary spec: [`features/qa-independence-cpe.md`](features/qa-independence-cpe.md)

#### `cpe.submitCourse`
- **Input**: `{ title, provider, date, hours, categoryAllocations[], certificate }`

#### `cpe.getDashboard`
- **Input**: `{ userId }`
- **Output**: `CPEDashboard` with GREEN/YELLOW/RED per requirement per `rules/cpe-rules.md`

#### `cpe.getComplianceStatus`
- **Input**: `{ userId }`
- Used during engagement-assignment check

#### `cpe.exportPeerReviewBundle`
- **Input**: `{ period }`
- MVP 1.5

### 3.24 `staff.*`

#### `staff.getDirectory` / `staff.updateProfile`

### 3.25 `time.*`

#### `time.submit` / `time.approve`

### 3.26 `qa.*` — MVP 1.5

#### `qa.createReview` / `qa.completeChecklist`

### 3.27 `pbc.*` — see §3.7

### 3.28 `dashboard.*`

Primary spec: [`features/dashboards-and-search.md`](features/dashboards-and-search.md)

#### `dashboard.getUserHome`
- Role-appropriate home dashboard

#### `dashboard.getFindingAging` / `.getCAPCompliance` / `.getRiskHeatMap` / `.getPlanVsActual`

#### `dashboard.getCPEDashboard`
- **Input**: `{ scope: 'self' | 'team' }`

### 3.29 `search.*`

#### `search.global`
- **Input**: `{ query, filters?, pagination }`
- Tenant-scoped full-text

#### `search.typeahead`
- **Input**: `{ query }`
- Sub-second autocomplete

#### `search.saveSearch` — MVP 1.5

### 3.30 `bulk.*`

#### `bulk.update`
- **Input**: `{ entityType, entityIds[], operation }`
- **Output**: `BulkResult`
- No undo; strong upfront confirmation required client-side

### 3.31 `notification.*`

Primary spec: [`features/notifications-and-activity.md`](features/notifications-and-activity.md)

#### `notification.list` / `.markRead` / `.markAllRead` / `.archive`

#### `preferences.get` / `preferences.update`

### 3.32 `tenantAdmin.*` — Tenant administration

Primary spec: [`features/tenant-onboarding-and-admin.md`](features/tenant-onboarding-and-admin.md)

#### `tenantAdmin.configureTeams` / `.configureEmailIdentity` / `.setEventDefaults`

#### `tenantAdmin.getSettings` / `.updateSettings`

#### `tenantAdmin.updateBilling` / `.offboard`

### 3.33 `auditLog.*`

Primary spec: [`features/audit-trail-and-compliance.md`](features/audit-trail-and-compliance.md)

#### `auditLog.query`
- **Input**: `{ filters, pagination }`

#### `auditLog.getEntityHistory`
- **Input**: `{ entityId, entityType }`

#### `auditLog.export`
- **Input**: `{ format, filters }`
- Async for large exports

#### `auditLog.verifyIntegrity`
- **Input**: `{ range }`
- **Permissions**: CAE+; platform admin for cross-tenant

### 3.34 `retention.*`

#### `retention.getPolicy` / `.scheduleArchival`

### 3.35 `erasure.*`

#### `erasure.requestForUser`
- **Input**: `{ userId, rationale }`

#### `erasure.getStatus`

### 3.36 `legalHold.*`

#### `legalHold.apply` / `.lift`

### 3.37 `auth.*` — Authentication

Primary spec: [`features/identity-auth-sso.md`](features/identity-auth-sso.md)

#### `auth.login`
- **Input**: `{ email, password, mfaToken? }`
- **Output**: `Session` with JWT + refresh token

#### `auth.ssoLogin`
- **Input**: `SSOLoginInput`

#### `auth.refreshToken`
- **Input**: `{ refreshToken }`

#### `auth.logout`

#### `auth.revokeSession`

#### `auth.enrollMFA` / `.verifyMFA`

### 3.38 `user.*`

#### `user.invite` / `.activate` / `.deactivate` / `.changeRole` / `.listSessions`

### 3.39 `sso.*`

#### `sso.configure` — Tenant admin only

### 3.40 `apiKey.*`

Primary spec: [`features/integrations-and-api.md`](features/integrations-and-api.md)

#### `apiKey.create`
- **Input**: `APIKeyInput`
- **Output**: `APIKey` (secret shown once)

#### `apiKey.list` / `.rotate` / `.revoke`

### 3.41 `webhook.*`

#### `webhook.create` / `.list`

#### `webhook.testDelivery`
- **Input**: `{ webhookId, sampleEvent }`
- **Output**: `DeliveryResult`

### 3.42 `csvImport.*`

Primary spec: [`features/integrations-and-api.md`](features/integrations-and-api.md)

#### `csvImport.upload`
- **Input**: `UploadInput`
- Supported entity types: Audit Universe, Staff+CPE, Archived Engagements (per Phase 4 Part 2 R1 fix)
- **Does NOT support**: in-flight engagement import

#### `csvImport.getStatus` / `.rollback`

### 3.43 `warehouseExport.*`

#### `warehouseExport.configure`
- **Input**: `ExportConfig` (S3 bucket + IAM role)
- Star-schema flat-file dump; no native CDC per Phase 4 Part 2 R1 fix

#### `warehouseExport.triggerSync`

#### `warehouseExport.getSchema`

### 3.44 `platformAdmin.*` — Internal only

Primary spec: [`features/platform-admin-and-board-reporting.md`](features/platform-admin-and-board-reporting.md)

#### `platformAdmin.listTenants`
- **Permissions**: Platform admin only (Ravi)

#### `platformAdmin.enterSupportMode`
- **Input**: `SupportModeInput` (ticket ref, scope, duration, rationale)
- Time-bounded session per ADR-0005

#### `platformAdmin.breakGlass`
- Two-person approval required; max 2-hour session

#### `platformAdmin.publishPack`
- **Input**: `PackInput`
- Two-person approval required

#### `platformAdmin.getIncidents`

### 3.45 `boardDashboard.*` / `boardPack.*` / `acCommunication.*`

Primary spec: [`features/platform-admin-and-board-reporting.md`](features/platform-admin-and-board-reporting.md)

#### `boardDashboard.get` — MVP 1.0

#### `boardPack.export` — MVP 1.5

#### `acCommunication.log` — MVP 1.5

---

## 4. REST Endpoint Catalog

Public external API at `/v1/*`. Generated OpenAPI 3.1 spec at `developer.aims.io/openapi.yaml`.

### 4.1 Authentication

All endpoints require `Authorization: Bearer <api-key>` OR OAuth2 access token (v2.1+).

### 4.2 Common headers

**Request**:
- `Authorization: Bearer <token>` (required)
- `Api-Version: YYYY-MM-DD` (optional; defaults to oldest active version within major)
- `Idempotency-Key: <uuid>` (required on mutations for retry safety)
- `Content-Type: application/json`

**Response**:
- `Api-Version: YYYY-MM-DD` (echoes applied version)
- `X-Request-Id: <req_id>` (for support/debugging)
- `X-RateLimit-Limit / -Remaining / -Reset` (rate limit state)
- `Deprecation: true` (if using deprecated version)
- `Sunset: <ISO date>` (if using deprecated version approaching sunset)

### 4.3 Engagements

```
GET    /v1/engagements
GET    /v1/engagements/{id}
POST   /v1/engagements
PATCH  /v1/engagements/{id}
POST   /v1/engagements/{id}/packs                    Attach pack
DELETE /v1/engagements/{id}/packs/{packRef}          Detach pack
POST   /v1/engagements/{id}/team                     Assign team member
DELETE /v1/engagements/{id}/team/{userId}            Remove team member
POST   /v1/engagements/{id}/transition               Phase transition
GET    /v1/engagements/{id}/activity                 Activity feed
POST   /v1/engagements/{id}/comments                 Add comment
POST   /v1/engagements/{id}/archive
```

### 4.4 Findings

```
GET    /v1/engagements/{engagementId}/findings
GET    /v1/findings/{id}
POST   /v1/findings
PATCH  /v1/findings/{id}
POST   /v1/findings/{id}/submit
POST   /v1/findings/{id}/approve
POST   /v1/findings/{id}/issue
GET    /v1/findings/{id}/history                     Bitemporal versions
GET    /v1/findings/{id}/preview?forPackRef=...      Multi-standard rendering
POST   /v1/findings/{id}/evidence                    Link work paper
DELETE /v1/findings/{id}/evidence/{linkId}
POST   /v1/findings/{id}/recommendations/{recId}     Associate recommendation
DELETE /v1/findings/{id}/recommendations/{recId}
POST   /v1/findings/{id}/comments
```

### 4.5 Reports

```
GET    /v1/reports
GET    /v1/reports/{id}
POST   /v1/reports
PATCH  /v1/reports/{id}
POST   /v1/reports/{id}/submit
POST   /v1/reports/{id}/approve
POST   /v1/reports/{id}/issue
GET    /v1/reports/{id}/preview?format=pdf|html
GET    /v1/reports/{id}/compliance-statement
POST   /v1/reports/{id}/distribute
```

### 4.6 Recommendations

```
GET    /v1/recommendations
GET    /v1/recommendations/{id}
POST   /v1/recommendations
PATCH  /v1/recommendations/{id}
POST   /v1/recommendations/{id}/findings/{findingId}
DELETE /v1/recommendations/{id}/findings/{findingId}
```

### 4.7 CAPs

```
GET    /v1/caps
GET    /v1/caps/{id}
POST   /v1/caps/{id}/review
POST   /v1/caps/{id}/approve
POST   /v1/caps/{id}/verify
POST   /v1/caps/{id}/request-evidence
POST   /v1/caps/{id}/abandon
POST   /v1/caps/{id}/evidence                        Submit evidence
```

### 4.8 PBC

```
GET    /v1/engagements/{engagementId}/pbc
POST   /v1/engagements/{engagementId}/pbc/items
PATCH  /v1/pbc/items/{itemId}
POST   /v1/pbc/items/{itemId}/generate-request
POST   /v1/pbc/items/{itemId}/accept-document
POST   /v1/pbc/items/{itemId}/reject-document
```

### 4.9 Work papers / Fieldwork

```
GET    /v1/engagements/{engagementId}/workpapers
POST   /v1/workpapers
PATCH  /v1/workpapers/{id}
POST   /v1/workpapers/{id}/submit
POST   /v1/workpapers/{id}/approve
POST   /v1/workpapers/{id}/evidence                  Attach document
```

### 4.10 Packs

```
GET    /v1/packs                                     Shipped + tenant packs
GET    /v1/packs/{packRef}
GET    /v1/packs/{packRef}/changelog
POST   /v1/annotations                               Pack annotation (CAE+)
GET    /v1/engagements/{id}/resolved-rules
```

### 4.11 Staff / CPE

```
GET    /v1/staff
POST   /v1/staff/{userId}/cpe/courses
GET    /v1/staff/{userId}/cpe/dashboard
GET    /v1/staff/{userId}/cpe/compliance
```

### 4.12 Annual plan

```
GET    /v1/plans
POST   /v1/plans
POST   /v1/plans/{id}/submit
POST   /v1/plans/{id}/approve
POST   /v1/plans/{id}/amend
GET    /v1/plans/{id}/progress
```

### 4.13 Audit universe

```
GET    /v1/audit-universe
POST   /v1/audit-universe/entities
PATCH  /v1/audit-universe/entities/{id}
POST   /v1/audit-universe/entities/{id}/risk-update
```

### 4.14 Audit log

```
GET    /v1/audit-log?filters=...
GET    /v1/entities/{entityType}/{entityId}/history
POST   /v1/audit-log/export
POST   /v1/audit-log/verify-integrity                CAE+
```

### 4.15 Data exports

```
POST   /v1/data-export/warehouse                     Star-schema to S3
GET    /v1/data-export/warehouse/schema
POST   /v1/data-export/tenant                        Full tenant export (offboarding)
```

### 4.16 Tenant admin

```
GET    /v1/tenant/settings
PATCH  /v1/tenant/settings
GET    /v1/tenant/users
POST   /v1/tenant/users                              Invite
PATCH  /v1/tenant/users/{id}
DELETE /v1/tenant/users/{id}                         Deactivate
POST   /v1/tenant/api-keys
GET    /v1/tenant/api-keys
POST   /v1/tenant/api-keys/{id}/rotate
DELETE /v1/tenant/api-keys/{id}
POST   /v1/tenant/webhooks
GET    /v1/tenant/webhooks
DELETE /v1/tenant/webhooks/{id}
POST   /v1/tenant/webhooks/{id}/test
```

### 4.17 SCIM 2.0 (MVP 1.5)

```
GET    /scim/v2/Users
POST   /scim/v2/Users
GET    /scim/v2/Users/{id}
PATCH  /scim/v2/Users/{id}
DELETE /scim/v2/Users/{id}
GET    /scim/v2/Groups
POST   /scim/v2/Groups
```

Per RFC 7644. Bearer token auth.

### 4.18 OAuth 2.0 (v2.1)

```
POST   /oauth/token                                  Client credentials exchange
POST   /oauth/revoke
```

---

## 5. Webhook Event Catalog

Delivered via transactional outbox per ADR-0004. All events HMAC-signed per §2.6.

### 5.1 Event envelope

All events share the structure:

```json
{
  "event_id": "evt_01H...",
  "event_type": "finding.issued",
  "event_version": "2027-01-15",
  "created_at": "2027-11-24T14:32:00Z",
  "tenant_id": "ten_oakfield",
  "data": { /* event-type-specific payload */ },
  "metadata": {
    "triggered_by_user_id": "usr_priya",
    "request_id": "req_01H..."
  }
}
```

### 5.2 Engagement events

| Event | Payload | Triggers |
|---|---|---|
| `engagement.created` | `{ engagement: Engagement }` | New engagement created |
| `engagement.updated` | `{ engagement, changes[] }` | Metadata update |
| `engagement.pack.attached` | `{ engagement, packRef }` | Pack attached |
| `engagement.pack.detached` | `{ engagement, packRef, rationale }` | Pack detached |
| `engagement.phase.transitioned` | `{ engagement, fromPhase, toPhase }` | Phase transition |
| `engagement.team.member.added` | `{ engagement, user, role }` | Team assignment |
| `engagement.team.member.removed` | `{ engagement, user, reason }` | Team removal |
| `engagement.budget.exceeded` | `{ engagement, variance }` | Budget over 25% |
| `engagement.archived` | `{ engagement }` | Archival |
| `engagement.comment.added` | `{ engagement, comment }` | Comment posted |

### 5.3 Finding events

| Event | Payload |
|---|---|
| `finding.created` | `{ finding }` |
| `finding.submitted` | `{ finding }` |
| `finding.approved` | `{ finding, approver }` |
| `finding.issued` | `{ finding, report? }` — **critical; triggers CAP workflow** |
| `finding.amended` | `{ finding, amendmentDetails }` |
| `finding.resolved` | `{ finding, capRef }` |
| `finding.rejected` | `{ finding, reason }` |
| `finding.comment.added` | `{ finding, comment }` |

### 5.4 Report events

| Event | Payload |
|---|---|
| `report.created` | `{ report }` |
| `report.submitted` | `{ report }` |
| `report.approved` | `{ report, approver }` |
| `report.issued` | `{ report }` — **critical; triggers mass finding.issued** |
| `report.amended` | `{ report, amendmentDetails }` |
| `report.distributed` | `{ report, recipients[] }` |

### 5.5 CAP events

| Event | Payload |
|---|---|
| `cap.drafted` | `{ cap }` |
| `cap.approved` | `{ cap }` |
| `cap.evidence_submitted` | `{ cap, evidence }` |
| `cap.verified` | `{ cap }` |
| `cap.overdue` | `{ cap, daysOverdue }` |
| `cap.abandoned` | `{ cap, reason }` |

### 5.6 PBC events

| Event | Payload |
|---|---|
| `pbc.request.created` | `{ request }` |
| `pbc.request.sent` | `{ request, recipient }` |
| `pbc.response.received` | `{ request, document }` |
| `pbc.document.accepted` | `{ request, document }` |
| `pbc.document.rejected` | `{ request, document, reason }` |
| `pbc.request.overdue` | `{ request, daysOverdue }` |

### 5.7 Pack events

| Event | Payload |
|---|---|
| `pack.published` | `{ pack }` — platform-level, filtered per tenant subscription |
| `pack.version.available` | `{ packCode, newVersion }` |
| `annotation.created` | `{ annotation }` |
| `annotation.updated` | `{ annotation, changes }` |
| `resolver.override.required` | `{ engagement, dimension }` |

### 5.8 User / auth events

| Event | Payload |
|---|---|
| `user.invited` | `{ user }` |
| `user.activated` | `{ user }` |
| `user.deactivated` | `{ user, reason }` |

### 5.9 Plan events

| Event | Payload |
|---|---|
| `annualPlan.submitted` | `{ plan }` |
| `annualPlan.approved` | `{ plan }` |
| `annualPlan.amended` | `{ plan, amendment }` |
| `engagement.plan.linked` | `{ engagement, planItem }` |

### 5.10 Notification events (less commonly subscribed)

| Event | Payload |
|---|---|
| `notification.delivered` | `{ notification, channel }` |
| `notification.bounced` | `{ notification, channel, reason }` |

---

## 6. Shared Zod schemas

Canonical Zod schemas live in `packages/validation/`. The feature specs reference them by name. Key shared schemas documented here for orientation.

### 6.1 Common primitives

```typescript
// IDs
tenantId: z.string().regex(/^ten_[a-z0-9]+$/)
userId: z.string().regex(/^usr_[a-z0-9_]+$/)
engagementId: z.string().regex(/^eng_[a-z0-9_-]+$/)
findingId: z.string().regex(/^fnd_[a-z0-9_-]+$/)
// ... etc per entity

// References
PackRef: z.object({
  code: z.string().regex(/^[A-Z_]+$/),
  version: z.string().regex(/^\d{4}(\.\d+)?$/)
})

// Pagination
PaginationInput: z.object({
  pageSize: z.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
})

PaginatedResult: z.object({
  items: z.array(ItemSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().optional()
  })
})
```

### 6.2 Engagement

```typescript
Engagement: z.object({
  id: engagementId,
  tenantId: tenantId,
  name: z.string().min(1).max(200),
  clientEngagementCode: z.string().max(64).optional(),
  type: z.enum(['SingleAudit', 'SOC2', 'PerformanceAudit', 'FinancialAudit', ...]),
  status: z.enum(['DRAFT', 'PLANNING', 'FIELDWORK', 'REPORTING', 'FOLLOW_UP', 'CLOSED', 'ARCHIVED']),
  auditeeEntityId: z.string(),
  fiscalPeriod: z.object({ start: z.date(), end: z.date() }),
  primaryMethodology: PackRef,
  additionalMethodologies: z.array(PackRef).default([]),
  controlFrameworks: z.array(PackRef).default([]),
  regulatoryOverlays: z.array(PackRef).default([]),
  team: z.array(TeamAssignment),
  budget: EngagementBudget,
  resolverOutput: ResolverResult.nullable(),
  metadataVersion: z.number().int(),
  scopeVersion: z.number().int(),
  budgetVersion: z.number().int(),
  teamVersion: z.number().int(),
  packVersion: z.number().int(),
  phaseVersion: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lockedAt: z.date().nullable()
})
```

### 6.3 Finding

```typescript
Finding: z.object({
  id: findingId,
  tenantId: tenantId,
  engagementId: engagementId,
  title: z.string().min(1).max(500),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ISSUED', 'AMENDED', 'RESOLVED', 'CLOSED_WITHOUT_ACTION', 'ABANDONED', 'ARCHIVED']),
  coreElements: z.record(SemanticElementCode, RichText),
  standardExtensions: z.record(StandardPackKey, z.record(z.string(), z.unknown())),
  classifications: z.array(FindingClassification),
  applicableMethodologies: z.array(PackRef),
  soxSuppressRecommendation: z.boolean().default(false),
  evidenceReferences: z.array(z.string()),
  relatedRecommendationIds: z.array(z.string()),
  findingVersion: z.number().int(),
  bitemporalFields: { validFrom, validTo, transactionFrom, transactionTo },
  createdAt: z.date(),
  issuedAt: z.date().nullable()
})

FindingClassification: z.object({
  packRef: PackRef,
  code: z.string(),  // scheme-specific: GAGAS_SIGNIFICANT_DEFICIENCY, IIA_MAJOR, etc.
  rationale: z.string().optional()
})

SemanticElementCode: z.enum(['CRITERIA', 'CONDITION', 'CAUSE', 'EFFECT', 'AUDIT_CRITERIA', 'OBJECTIVE_EVIDENCE', 'ROOT_CAUSE', 'NC_CLAUSE', 'RECOMMENDATION'])
```

### 6.4 Report, Recommendation, CAP

Similar structural shapes — see feature specs for field definitions. All share:
- `id`, `tenantId`, `status`
- Per-concern version fields for optimistic concurrency
- `bitemporalFields`

### 6.5 Resolver output

```typescript
ResolverResult: z.object({
  dimension: DimensionKey,
  value: z.unknown(),  // type depends on dimension
  drivenBy: z.array(PackRuleContribution),
  applicability: z.enum(['resolved', 'conflict-requires-override', 'override-applied', 'not-applicable']),
  conflictNarrative: z.string().optional(),
  overrideRationale: z.string().optional(),
  overrideBy: userId.optional(),
  overrideAt: z.date().optional()
})

PackRuleContribution: z.object({
  packRef: PackRef,
  contributedValue: z.unknown(),
  source: z.string()  // e.g., "GAGAS §6.80"
})

DimensionKey: z.enum([
  'DOCUMENTATION_RETENTION_YEARS',
  'INDEPENDENCE_COOLING_OFF_MONTHS',
  'PEER_REVIEW_CYCLE_YEARS',
  'CPE_HOURS_PER_CYCLE',
  // ... all ~30 dimensions from rules/strictness-resolver-rules.md
])
```

### 6.6 RichText

Uses TipTap v2 ProseMirror-compatible JSON:

```typescript
RichText: z.object({
  type: z.literal('doc'),
  content: z.array(ProseMirrorNode)
})
```

### 6.7 Webhook event envelope (repeated from §5.1)

```typescript
WebhookEvent: z.object({
  event_id: z.string(),
  event_type: z.string(),
  event_version: z.string(),  // YYYY-MM-DD
  created_at: z.date(),
  tenant_id: tenantId,
  data: z.unknown(),  // event-type-specific
  metadata: z.object({
    triggered_by_user_id: userId.optional(),
    request_id: z.string().optional()
  })
})
```

---

## 7. Error Code Reference

Stable machine-readable codes across API versions. Human-readable messages may vary.

### 7.1 Authentication / authorization (401, 403)

- `unauthorized` — missing or invalid auth credentials
- `token_expired` — JWT past expiry; client should refresh
- `token_revoked` — session revoked via blocklist (ADR-0005)
- `api_key_invalid` — REST API key not recognized
- `api_key_revoked` — REST API key explicitly revoked
- `api_key_scope_insufficient` — key valid but lacks required scope
- `forbidden` — authenticated but role lacks required permission
- `mfa_required` — step-up MFA required for this action
- `tenant_isolation_violation` — attempted cross-tenant access (P1 incident)

### 7.2 Input validation (400)

- `invalid_input` — Zod schema validation failed; `details.issues[]` lists specific field errors
- `missing_required_field`
- `invalid_field_format`
- `field_length_exceeded`

### 7.3 Resource state (404, 409)

- `resource_not_found` — entity missing or RLS-hidden
- `resource_archived` — entity exists but is archived
- `resource_conflict` — optimistic concurrency version mismatch
- `idempotency_key_conflict`
- `idempotency_key_ttl_expired`
- `duplicate_entity` — uniqueness constraint violated

### 7.4 Business rule violations (422)

- `engagement_phase_gate_failed` — phase transition blocked (details include failed gates)
- `pack_validation_failed`
- `resolver_override_required`
- `finding_immutable_post_issuance`
- `approval_chain_violated` — attempted approval out of sequence
- `cpe_compliance_blocked` — RED CPE status
- `independence_impairment_blocks_action`
- `cap_target_date_unreasonable`
- `recommendation_presentation_conflict` — philosophical conflict requiring override

### 7.5 Rate limiting (429)

- `rate_limited` — includes `Retry-After` header + `X-RateLimit-Reset`
- `quota_exceeded` — usage-based quota (API calls, storage)

### 7.6 Server (5xx)

- `internal_error` — unexpected failure; logged with request ID
- `service_degraded` — transient; retry with backoff
- `resource_locked` — entity under admin maintenance
- `dependency_unavailable` — upstream service (KMS, database) temporarily unavailable

---

## 8. Rate Limits

Defaults per API key per endpoint category:

| Category | Limit | Window |
|---|---|---|
| Read (GET) | 1000 requests | per hour |
| Write (POST/PATCH/DELETE) | 100 requests | per hour |
| Bulk operations | 10 requests | per hour |
| Export (full-tenant, report PDF) | 5 requests | per hour |
| Search | 200 requests | per hour |

**Per-tenant limits** (aggregate across all API keys in tenant):
- 10,000 total requests per hour
- 1 TB data transfer per month

**Response headers** on every API response:
- `X-RateLimit-Limit: <limit>`
- `X-RateLimit-Remaining: <count>`
- `X-RateLimit-Reset: <unix timestamp>`

**Burst tolerance**: token-bucket algorithm; brief bursts permitted up to 2× limit if average stays under.

**Enterprise tier**: negotiable custom limits per contract.

---

## 9. Example integration flows

### 9.1 Third-party risk-intelligence platform (Jin's use case)

```
1. Jin's platform obtains API key from Oakfield tenant (via UI or OAuth2 in v2.1+)

2. Initial sync — load historical findings:
   GET /v1/engagements?status=active&pageSize=100
   → for each engagement:
     GET /v1/engagements/{id}/findings?status=ISSUED

3. Configure webhook:
   POST /v1/tenant/webhooks
   { url: "https://risk.example.com/aims-webhook",
     events: ["finding.issued", "report.issued"] }

4. On webhook receipt, verify HMAC, ingest event, update risk model

5. Periodic re-sync via incremental pull:
   GET /v1/engagements?updatedAfter=<timestamp>
```

### 9.2 Firm-wide Power BI dashboard (Elena's use case)

```
1. Sofia configures warehouse export:
   POST /v1/data-export/warehouse
   { destination: "s3://acme-cpa-audit-warehouse/aims/",
     iamRoleArn: "arn:aws:iam::...",
     schedule: "daily-2am-utc",
     format: "parquet" }

2. Nightly AIMS worker exports star-schema to customer S3

3. Customer's Snowflake Snowpipe loads S3 → warehouse

4. Power BI connects to Snowflake warehouse; Elena's WIP dashboard refreshes daily
```

### 9.3 SSO + SCIM provisioning (Sofia's workflow)

```
1. Sofia configures OIDC SSO:
   POST /v1/tenant/settings/sso
   { provider: "okta", oidcIssuer: "...", clientId: "..." }

2. (MVP 1.5) Configure SCIM:
   POST /v1/tenant/settings/scim
   → receives SCIM endpoint URL + bearer token

3. In Okta:
   - Add AIMS as SAML/OIDC application
   - Assign users to app
   - Configure SCIM push with AIMS endpoint + token

4. Okta provisions users via SCIM:
   POST /scim/v2/Users → creates AIMS user, maps groups to roles

5. Users log in via OIDC; single sign-on flow

6. Deprovisioning: Okta removes user from app → SCIM DELETE → AIMS deactivates user + revokes sessions
```

---

## 10. Deprecation and migration

### 10.1 Deprecation signals

When a feature or dated API version is deprecated:
- `Deprecation: true` response header
- `Sunset: <ISO date>` response header (90+ days out minimum)
- Developer portal banner with migration guide
- Direct email to affected API key holders (if contact info available)

### 10.2 Minimum support windows

- Dated API versions: 18 months from deprecation announcement to sunset
- URL majors: `/v1/` supported minimum 3 years after `/v2/` release
- Webhook event versions: 12 months from old → new version

### 10.3 Migration guides

Published per deprecation at `developer.aims.io/migrations/`. Format:
- Summary of changes
- Side-by-side before/after examples
- Automated tooling where applicable

---

## 11. Sandbox / developer experience

### 11.1 Sandbox tenant

AIMS provides a public sandbox tenant with synthetic data:
- No account creation required for basic API exploration
- Rate-limited (100 requests/hour)
- Data resets weekly
- Full API surface available (all endpoints callable)

### 11.2 API explorer

Interactive Swagger UI at `developer.aims.io/explorer`:
- Execute requests against sandbox
- Auto-generated from OpenAPI spec
- Supports all dated versions

### 11.3 SDKs (v2.1+)

Official SDKs planned:
- TypeScript / JavaScript
- Python
- Go

Community SDKs not officially supported but linked from developer portal when available.

---

## 12. References

**Architecture**:
- [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md) — field-level encryption
- [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md) — tenant isolation
- [ADR-0003](../references/adr/0003-nestjs-scoped-to-workers.md) — API tier split
- [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md) — outbox pattern + webhook delivery
- [ADR-0005](../references/adr/0005-session-revocation-hybrid.md) — JWT revocation
- [ADR-0007](../references/adr/0007-api-versioning-hybrid.md) — API versioning

**Feature specs** (all in [`features/`](features/)):
- engagement-management.md
- pack-attachment-and-annotation.md
- finding-authoring.md
- report-generation.md
- pbc-management.md
- fieldwork-and-workpapers.md
- recommendations-and-caps.md
- audit-planning.md
- apm-workflow.md
- prcm-matrix.md
- tenant-onboarding-and-admin.md
- identity-auth-sso.md
- qa-independence-cpe.md
- notifications-and-activity.md
- dashboards-and-search.md
- integrations-and-api.md
- audit-trail-and-compliance.md
- platform-admin-and-board-reporting.md

**Rules**:
- [`rules/strictness-resolver-rules.md`](rules/strictness-resolver-rules.md)
- [`rules/workflow-state-machines.md`](rules/workflow-state-machines.md)
- [`rules/approval-chain-rules.md`](rules/approval-chain-rules.md)
- [`rules/classification-mappings.md`](rules/classification-mappings.md)
- [`rules/independence-rules.md`](rules/independence-rules.md)
- [`rules/cpe-rules.md`](rules/cpe-rules.md)

---

## 13. Domain review notes — Round 1 (April 2026)

External review (Google Gemini, VP of Product / senior technical reviewer) returned a clean pass with no refinements required. Reviewer specifically validated that the Phase 4 R1 refinements carried through correctly into the consolidated catalog:

- `csvImport.upload` — explicitly excludes in-flight engagement imports (per Phase 4 Part 2 R1 fix)
- `warehouseExport.configure` — scoped to star-schema flat-file dump to S3, not native CDC (per Phase 4 Part 2 R1 fix)
- `apm.updateSection` — section-level locking with 10-minute auto-release (per Phase 4 Part 2 R1 fix on APM concurrency)
- Webhook delivery + rate limiting — HMAC-signed Stripe-style + token-bucket burst tolerance called out as "exactly what enterprise integrators look for"

Verdict: *"An absolute masterpiece of technical product management. You didn't just write an endpoint list — you codified the entire architectural and business logic of the platform into a strict operational contract."*

No additional changes applied; Phase 5 review loop closed.

---

*Last reviewed: 2026-04-22. Phase 5 deliverable; R1 review closed.*
