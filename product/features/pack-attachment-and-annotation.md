# Pack Attachment and Annotation

> The MVP-era differentiator. Tenants select and attach methodology, control framework, and regulatory overlay packs to engagements; tenant administrators (Kalpana) can annotate/override shipped pack rules for their organisation. This spec covers the pack library surface, the attachment UI, the annotation/override UI, the strictness resolver UI, and the version transition management.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 14
**Primary personas**: Priya (AIC), Marcus (CAE), Kalpana (Audit Function Director), Aisha (post-MVP)
**MVP phase**: 1.0 (annotation/override); full custom authoring + SDK + registry deferred to v2.2+

---

## 1. Feature overview

Pack management has three user-facing layers in MVP 1.0:

1. **Browse / view** — users see available packs, understand what each declares, check version info
2. **Attach** — at engagement creation, users select which packs apply to the engagement
3. **Annotate / override** — tenant admins (Kalpana) extend shipped packs with their organisation-specific rules

The fourth layer — **authoring custom packs from scratch** — is deferred to v2.2+. The SDK and private consortium registry for Aisha are also v2.2+.

This spec covers the three MVP 1.0 layers end-to-end.

### 1.1 Why this is the MVP-era differentiator

Per [01-product-vision.md §4](../01-product-vision.md), no competitor treats methodology as a versioned first-class object. AIMS v2's shipped pack library + tenant-level annotation/override + strictness resolver gives customers a meaningful differentiator to demo in sales conversations — even before full custom-pack authoring ships in v2.2+.

Kalpana (State Auditor Director from California Bureau of State Audits) is the primary persona driving the annotation/override feature — she doesn't write methodologies from scratch; she extends shipped GAGAS with her bureau's 12-page Word-doc of overrides (retention 7yr instead of 5yr for state-security engagements; additional state-specific independence disclosure; governor-office notification workflow step). The annotation UI captures these without requiring full pack authoring.

---

## 2. User stories — Layer 1: Browse and view

### 2.1 US-PACK-001 — Priya browses the pack library

```gherkin
GIVEN Priya is creating a new engagement
  AND she wants to understand which packs are available
WHEN she opens the Standard Packs library (from settings or engagement creation)
THEN she sees:
  - All pre-built packs: GAGAS:2024, IIA_GIAS:2024, SINGLE_AUDIT:2024, SOC2:2017, ISO_19011:2018
  - Her tenant's annotated variants (if any)
  - Pack type badge (methodology / control framework / regulatory overlay)
  - Pack version with effective date
  - Brief description + source citation
  - Link to pack details view
WHEN she clicks on GAGAS:2024
THEN she sees a detailed view showing:
  - Finding elements declared (CRITERIA, CONDITION, CAUSE, EFFECT)
  - Classification scheme (Deficiency / Significant Deficiency / Material Weakness)
  - Workflow phases declared (Planning, Fieldwork, Reporting, Follow-up with pack-specific gates)
  - Rules declared: retention, CPE, independence cooling-off, etc.
  - Cross-pack relationships (e.g., "can combine with: IIA_GIAS:2024, PCAOB")
  - Version changelog (from prior version)
```

**Acceptance criteria**:
- Pack library loads < 500ms
- Pack details view < 1s
- All pack information derives from the pack's JSON definition (no hardcoding)
- Version changelog generated automatically from diff between versions
- Tenant annotations shown inline with "annotated by your organisation" tag

### 2.2 US-PACK-002 — Marcus views the resolver-computed rules for an engagement

```gherkin
GIVEN Oakfield FY27 has GAGAS + IIA + Single Audit attached
WHEN Marcus opens engagement settings → "Applied Rules"
THEN he sees a summary of resolver-computed rules with drivenBy attribution:
  - Documentation retention: 7 years (driven by IIA_GIAS Standard 15.2)
  - Independence cooling-off: 24 months (driven by GAGAS §3.95)
  - CPE requirement: 80/2yr + 24 governmental (GAGAS) UNION 40/yr (IIA CIA)
  - Peer review cycle: 3 years (driven by GAGAS §5.60)
  - Audit response window: 30 days (driven by GAGAS §6.54)
  - Approval chain length: 4 stages (driven by Single Audit overlay)
  - ... (all ~30 dimensions visible)
```

**Acceptance criteria**:
- All resolved dimensions visible with drivenBy attribution
- Click on any dimension shows:
  - Pack contributions (each pack's value)
  - Applied resolution (max/min/union/override)
  - Override applied? (yes/no; if yes, by whom, rationale)
- Sorted by rule category (compliance / workflow / operational)

---

## 3. User stories — Layer 2: Attach packs to engagements

### 3.1 US-PACK-003 — Priya attaches packs at engagement creation

Covered in [`engagement-management.md §2.1 US-ENG-001`](engagement-management.md). Summary:

- Pack attachment is part of engagement creation
- User selects primaryMethodology (1), additionalMethodologies (0-N), controlFrameworks (0-N), regulatoryOverlays (0-N)
- Resolver runs synchronously; results displayed before save
- Save triggers engagement creation with full pack context

### 3.2 US-PACK-004 — Priya attaches an additional pack mid-engagement

Covered in [`engagement-management.md §2.2 US-ENG-004`](engagement-management.md). Summary:

- Requires documented rationale
- Requires CAE approval if past PLANNING
- Triggers resolver re-run with before/after comparison
- Affected findings flagged for re-validation (new pack may require additional fields)

### 3.3 US-PACK-005 — Pack version upgrade during engagement lifecycle

```gherkin
GIVEN Oakfield FY27 has GAGAS:2024 attached (version v2024.0)
  AND GAO publishes GAGAS:2024.1 (minor revision with clarifications)
WHEN the pack library shows "update available"
  AND Priya opens engagement → Pack Management
  AND she clicks "Review upgrade to GAGAS:2024.1"
THEN she sees:
  - Differences between v2024.0 and v2024.1 (changelog view)
  - Which resolver dimensions would be affected (e.g., "Retention unchanged; Independence cooling-off unchanged; Peer review cadence unchanged")
  - Which engagement artifacts might be affected
  - Approval path (CAE approval required)
WHEN CAE approves the upgrade
THEN engagement's pack reference updates to v2024.1
  AND resolver re-runs
  AND audit log captures the version change
```

**Acceptance criteria**:
- Upgrade requires CAE approval for engagements past PLANNING
- Rollback window: 14 days (can revert to prior version)
- Upgrade preserves all engagement artifacts
- Changelog viewer shows diff in structured format (not just raw JSON)

### 3.4 US-PACK-006 — Pack detach

Covered in [`engagement-management.md §2.2 US-ENG-005`](engagement-management.md).

---

## 4. User stories — Layer 3: Annotate and override

### 4.1 US-PACK-007 — Kalpana creates her first annotation on shipped GAGAS

```gherkin
GIVEN Kalpana is Audit Function Director for California Bureau of State Audits
  AND her bureau's audit manual says retention = 7 years for state-security engagements
  AND shipped GAGAS:2024 specifies retention = 5 years
WHEN Kalpana opens Settings → Pack Annotations → GAGAS:2024
  AND she clicks "Add Override"
  AND she selects dimension: DOCUMENTATION_RETENTION_YEARS
  AND she sets override value: 7 years
  AND she specifies applicability: "For engagements tagged with engagementType = 'STATE_SECURITY_AUDIT'"
  AND she adds rationale: "Bureau policy per Audit Manual §3.2, mandated by Governor's Office memo 2024-03"
  AND she clicks Save
THEN a PackAnnotation record is created with:
  - packRef: GAGAS:2024
  - tenant: {bureau tenant id}
  - dimension: DOCUMENTATION_RETENTION_YEARS
  - overrideValue: 7
  - applicabilityFilter: {engagementType: 'STATE_SECURITY_AUDIT'}
  - rationale: (as above)
  - authorId: Kalpana
  - createdAt: now
  AND resolver re-runs for all currently-active engagements that match the applicability filter
  AND affected engagements are notified (CAE and AIC on each)
  AND audit log captures the annotation creation
```

**Acceptance criteria**:
- Annotation saved as first-class entity with full audit trail
- Applicability filter supports: engagement type, engagement tags, engagement pack attachment, auditee entity type
- Rationale minimum 100 chars (enforces meaningful justification)
- Annotation version-tracked (diff between annotation versions visible)
- Annotations on a pack auto-migrate when pack version upgrades where underlying fields are preserved

### 4.2 US-PACK-008 — Kalpana previews annotation impact

```gherkin
GIVEN Kalpana is creating the annotation from US-PACK-007
  AND before saving, she clicks "Preview Impact"
WHEN the preview runs
THEN it shows:
  - Which existing engagements in her tenant would be affected (e.g., "3 engagements currently attached to GAGAS:2024 with engagementType = 'STATE_SECURITY_AUDIT'")
  - For each affected engagement:
    - Current resolver-computed retention: 5 years (GAGAS default)
    - Post-annotation retention: 7 years (annotation override)
    - Reason: annotation would be strictly greater than current resolver max
  - Sample engagement showing new dashboard view with annotation applied
```

**Acceptance criteria**:
- Preview runs against staging resolver (doesn't commit changes)
- Preview execution p99 < 3s
- Preview highlights any annotation that would *reduce* strictness (these are rejected; annotations can only make rules stricter)
- Preview exports to PDF for inclusion in bureau's audit manual

### 4.3 US-PACK-009 — Kalpana cannot annotate below strictness threshold

```gherkin
GIVEN Kalpana tries to create an annotation: DOCUMENTATION_RETENTION_YEARS: 3 years
  AND shipped GAGAS says 5 years
WHEN she clicks Save
THEN the save is rejected with an error:
  "Annotation cannot reduce retention below 5 years (shipped GAGAS:2024 default). Annotations can only make rules stricter, not looser."
```

**Acceptance criteria**:
- Validator runs at save time
- Error message references both the attempted value and the shipped pack's value
- Error is per-dimension (retention rule vs. CPE rule vs. etc.)
- Same validation for other pack types (control frameworks, overlays)

### 4.4 US-PACK-010 — Kalpana adds a workflow phase annotation

```gherkin
GIVEN Kalpana wants to add a bureau-specific workflow phase:
  "Governor's Office Notification" between REVIEW and CAE_APPROVAL
WHEN she opens Pack Annotations → GAGAS:2024 → Workflow
  AND she selects "Add workflow phase"
  AND she names it "GOV_OFFICE_NOTIFICATION"
  AND she specifies position: between REVIEW and CAE_APPROVAL
  AND she specifies applicability: "For engagements with entity type = 'STATE_EXECUTIVE_BRANCH_AGENCY'"
  AND she specifies requirements:
    - Who can advance: Designated Governor's Liaison role
    - What must happen: formal notification sent to Governor's Office with engagement report attached
    - SLA: 3 business days
  AND she provides rationale
THEN PackAnnotation saved with WORKFLOW_PHASE type
  AND resolver-combined workflow state machines for affected engagements now include this phase
  AND existing engagements in review state don't regress; new engagements entering review state get the new phase gate
```

**Acceptance criteria**:
- Workflow phase additions require mapping to existing roles or creation of new roles
- Resolver-combined state machines re-validated (reachability per `workflow-state-machines.md §10.1`)
- UI visualizes the annotated state machine side-by-side with shipped state machine

### 4.5 US-PACK-011 — Kalpana edits an existing annotation (with mid-flight engagement safety)

```gherkin
GIVEN Kalpana's retention annotation exists and applies to 12 engagements
  AND she wants to change the applicability filter (from "STATE_SECURITY_AUDIT" to include "PERFORMANCE_AUDIT")
WHEN she opens the annotation
  AND edits the filter
  AND provides reason for the change
  AND clicks Save
THEN the annotation's history records both the old and new state
  AND version auto-increments
  AND annotation applicability is re-evaluated for all tenant engagements
  AND engagements split into two buckets:
    1. **DRAFT or PLANNING engagements** → annotation auto-applies (safe to inherit; no downstream artifacts yet)
    2. **FIELDWORK, REPORTING, FOLLOW_UP, CLOSED engagements** → annotation does NOT auto-apply; instead, an "Annotation Update Available" banner appears on each affected engagement requiring CAE explicit acceptance
  AND audit log captures the change with full before/after context
  AND Kalpana sees a preview of "Auto-applied to N engagements; pending CAE acceptance on M engagements"
```

**Acceptance criteria**:
- Each annotation has version history
- Editing requires new rationale per change
- **Mid-flight migration safety**: annotation changes to engagements past PLANNING do not auto-apply. An engagement in REPORTING phase one day from issuance shouldn't have its required finding elements or retention rules silently change because Kalpana tweaked a tenant-level annotation. CAE explicit acceptance per engagement is required.
- CAE acceptance UI shows: the annotation change, the engagement-level impact (resolver dimension values before/after), affected artifacts (findings that would need re-validation), and options: Accept / Reject / Defer until engagement closes
- Rejection means the engagement stays pinned to the annotation version at its PLANNING-exit time (per `pack-attachment-and-annotation.md` version pinning semantics)
- Change propagation to engagements includes notifications per notification module
- CAE-accepted changes propagate; rejected changes don't; deferred changes re-prompt at next phase transition

**Why this matters**: regulatory compliance evidence depends on consistent rule application throughout an engagement. Silent mid-engagement rule changes would make peer review evidence questionable ("why did retention switch from 5 to 7 years on 2027-11-14?") and could jeopardise statutory filing commitments. Explicit CAE acceptance creates the defensible audit trail.

### 4.6 US-PACK-012 — Kalpana removes an annotation

```gherkin
GIVEN Kalpana's annotation was created but the bureau policy changed
WHEN Kalpana removes the annotation with rationale "Governor's Office memo 2026-05 rescinded the 7-year requirement"
THEN the annotation record is marked `status: RETIRED` (not hard-deleted for audit purposes)
  AND resolver re-runs; affected engagements no longer inherit the annotation
  AND audit log captures the removal
```

**Acceptance criteria**:
- Annotations cannot be hard-deleted (always retained in archive form)
- Status transition: ACTIVE → RETIRED
- Existing issuance-era records (findings, reports already issued under the annotation) preserve their historical resolver state (bitemporal)

### 4.7 US-PACK-013 — Kalpana adds a pack-specific finding element

```gherkin
GIVEN Kalpana wants to add a bureau-specific finding element:
  "StateFundingImpact" — for state-funded engagements, dollar amount of potential state funding impact
WHEN she opens Pack Annotations → GAGAS:2024 → Finding Elements
  AND clicks Add Element
  AND specifies:
    - Element code: STATE_FUNDING_IMPACT
    - Type: currency
    - Required for engagements with: regulatoryOverlays containing STATE_AUDIT_CA
    - Rationale: "Bureau tracks state funding impact per audit standard addendum"
  AND saves
THEN annotation saved
  AND finding-authoring forms for affected engagements include the new required field
  AND existing findings are flagged for retrospective population (Priya gets a notification)
```

**Acceptance criteria**:
- Finding element annotations integrate with dynamic form engine
- Existing findings are not retroactively invalidated; they're flagged for population
- Pack-semantic validation ensures the new element doesn't conflict with existing elements

---

## 5. User stories — Strictness resolver UI

### 5.1 US-PACK-014 — Priya sees strictness resolution for a specific dimension

Covered in US-PACK-002. Detailed UI:

```
Retention Policy: 7 years (driven by IIA_GIAS Standard 15.2)

Contributing Packs:
  • GAGAS:2024    → 5 years (GAGAS §6.80 + AICPA AU-C 230.A29)
  • IIA_GIAS:2024 → 7 years (IIA GIAS Standard 15.2)
  • SINGLE_AUDIT:2024 → 3 years after FAC submission (2 CFR 200.517)
  • SOC2:2017     → 3 years (AICPA AT-C 215.73)

Resolution Rule: max (longest retention wins)
Resolved Value: 7 years

Applied Annotations: None

Would Your Bureau Annotate This?
  Your bureau has 3 engagements that override retention to 10 years 
  (applicable filter: engagementType = 'STATE_SECURITY_AUDIT')
  [View that annotation]
```

### 5.2 US-PACK-015 — Priya resolves a resolver-required override

```gherkin
GIVEN Priya has just attached GAGAS + PCAOB (both attached)
  AND the resolver flags RECOMMENDATION_PRESENTATION as override-required (philosophical conflict)
  AND engagement is in DRAFT state (cannot advance without resolution)
WHEN Priya opens the override resolution UI
THEN she sees:
  - Dimension: RECOMMENDATION_PRESENTATION
  - Conflicting contributions:
    * GAGAS: SEPARATE (§6.47 — separate report section)
    * PCAOB ICFR: SUPPRESSED (AS 1305 — no auditor recommendations for ICFR)
  - Decision needed: which rule applies per report
  - Guidance: "This is a per-report decision. The Yellow Book report (attestsTo: GAGAS:2024) uses SEPARATE. The PCAOB ICFR report (attestsTo: PCAOB:2024) uses SUPPRESSED."
WHEN Priya chooses per-report resolution
  AND documents rationale (100+ chars)
THEN override applied per report
  AND engagement can proceed to PLANNING
  AND audit log captures the override with full context
```

**Acceptance criteria**:
- Override UI explains the conflict with pack citations
- Override rationale minimum 100 chars
- Override logged as `overrideBy: {user, timestamp}`, `appliedToReports: [list]`
- CAE or Audit Function Director only (not AIC)
- Override at engagement-level (affects all reports from this engagement); tenant-level (affects all future engagements); or per-report basis

---

## 6. User stories — Pack version transition

### 6.1 US-PACK-016 — Pack publisher (platform) releases a new version

Per [03-feature-inventory.md](../03-feature-inventory.md) Module 14, platform admin (Ravi at AIMS) publishes new pack versions. Workflow:

```gherkin
GIVEN AIMS has published GAGAS:2024.1 (a minor update)
WHEN Ravi opens Platform Admin → Pack Publishing
  AND uploads the new pack version
  AND validation passes (data-model/VALIDATION.md layers)
  AND metadata: version, effective date, changelog, migration notes
  AND approves publication
THEN pack is published to all tenants
  AND tenant admins see "Update available" notification
  AND no engagement auto-migrates (opt-in per engagement)
```

**Acceptance criteria**:
- Platform admin authentication with 2FA
- Pack version validation: no breaking changes to finding elements without major version bump
- Changelog required at publication
- Subscribers (tenant admins) notified

### 6.2 US-PACK-017 — Kalpana reviews pack upgrade impact before adoption

```gherkin
GIVEN Kalpana sees "GAGAS:2024.1 available"
WHEN she opens Pack Management → GAGAS:2024 → Upgrade Preview
THEN she sees:
  - Changes from v2024.0 to v2024.1 (diff view)
  - How her annotations would migrate:
    * "Retention override (7 years)" — still applies to v2024.1 (underlying dimension unchanged)
    * "Workflow phase (Governor's Office Notification)" — still applies
  - How her active engagements would be affected
  - Recommended upgrade cadence (e.g., "upgrade current in-progress engagements at phase transition")
```

**Acceptance criteria**:
- Upgrade preview non-committal (doesn't modify anything)
- Migration mapping explicit (what stays, what breaks)
- Rollback path documented
- Bulk-upgrade workflow (upgrade all engagements at once) available but not default

### 6.3 US-PACK-018 — Kalpana bulk-upgrades engagements

```gherkin
GIVEN Kalpana has reviewed GAGAS:2024.1 and wants to upgrade
WHEN she opens Pack Management → GAGAS:2024 → Bulk Upgrade
  AND selects engagements (e.g., all 47 engagements attached to v2024.0)
  AND selects upgrade timing (now / at next phase transition / at next engagement creation)
  AND confirms with CAE approval
THEN upgrade workflow fires:
  - For each engagement, at specified timing, pack ref updates
  - Resolver re-runs
  - Affected users notified
  - Audit trail complete
```

**Acceptance criteria**:
- Bulk upgrade runs as background job via SQS per ADR-0004
- Each engagement's upgrade is independent (failures don't cascade)
- Progress dashboard shows completion status
- Rollback available within 30 days

---

## 7. Edge cases

### 7.1 Annotation conflicts with cross-pack resolver decision

If Kalpana annotates GAGAS to say retention = 10 years, but another pack (say IIA_GIAS) contributes 12 years:
- Annotation: 10 years (Kalpana)
- IIA contribution: 12 years
- Resolved (max): 12 years (driven by IIA, not the annotation)
- Annotation is "not applied" in this case; drivenBy trail shows IIA's 12 years superseding
- Kalpana sees in her annotation view: "Currently overridden by IIA_GIAS contribution"

### 7.2 Pack removal that has active annotations

If AIMS deprecates ISO_19011:2018 and Kalpana has annotations on it:
- Annotations remain as historical records
- Tenants are notified of deprecation
- Upgrade path to successor pack (e.g., ISO_19011:2025) shows annotation migration feasibility
- If no migration possible, annotations are archived

### 7.3 Two annotations conflict

If Kalpana accidentally creates two annotations for the same dimension with conflicting values:
- Validation catches at save time
- User shown existing annotation; new annotation replaces with diff history
- Or if marked for merge, both annotations co-exist with explicit applicability scopes that don't overlap

### 7.4 Annotation authored but not yet effective

Annotations can be created with `effectiveDate` in the future. Between creation and effective date, the annotation is in `SCHEDULED` state and doesn't apply to resolver runs.

### 7.5 Pack version mismatch across attached packs

If an engagement attached GAGAS:2024 and IIA_GIAS:2024 (both v2024) but Kalpana's annotation was written for GAGAS:2023 (older):
- Annotation validation at pack upgrade time catches this
- Kalpana receives a notification that the annotation needs migration
- Engagement doesn't auto-upgrade if this isn't resolved

### 7.6 Tenant admin tries to annotate a pack they didn't author

Tenant admins (Kalpana) can only annotate shipped packs. They cannot annotate other tenants' annotations or custom packs (MVP 1.0 doesn't support custom packs).

---

## 8. Data model touch points

Per `data-model/standard-pack-schema.ts` + `data-model/tenant-data-model.ts`:

- `StandardPack` — the shipped pack record (versioned, immutable once published)
- `TenantPackAnnotation` — per-tenant annotations
- `EngagementPackAttachment` — per-engagement pack refs with version pinning
- `ResolverRuleOutput` — computed rules per engagement (cached)
- `PackAnnotationHistory` — version trail for annotations
- `PackVersionMigration` — tracks upgrades per tenant

---

## 9. API endpoints

### 9.1 tRPC procedures

```typescript
// Pack library (read-only for most users)
pack.list(): StandardPack[]
pack.get(input: {packRef}): StandardPack
pack.getChangelog(input: {packRef, fromVersion, toVersion}): ChangelogEntry[]

// Annotations (tenant admin + audit function director)
annotation.list(input: {tenantId, packRef?}): PackAnnotation[]
annotation.get(input: {annotationId}): PackAnnotation
annotation.create(input: AnnotationInput): PackAnnotation
annotation.update(input: AnnotationUpdateInput): PackAnnotation
annotation.delete(input: {annotationId, reason}): void
annotation.preview(input: AnnotationInput): AnnotationPreview
annotation.history(input: {annotationId}): AnnotationVersion[]

// Resolver UI
resolver.getEngagementResolution(input: {engagementId}): ResolverResult[]
resolver.explainDimension(input: {engagementId, dimensionKey}): DimensionExplanation

// Pack version management
packVersion.preview(input: {packRef, newVersion}): UpgradePreview
packVersion.upgradeEngagement(input: {engagementId, newVersion, rationale}): void
packVersion.bulkUpgrade(input: {engagementIds[], newVersion, timing, rationale}): BulkUpgradeJob

// Platform admin (internal)
platformAdmin.pack.publish(input: PackPublishInput): void  // Ravi only
```

### 9.2 REST endpoints

- `GET /v1/packs` — list packs
- `GET /v1/packs/:packRef` — get pack
- `GET /v1/packs/:packRef/changelog` — changelog
- `POST /v1/annotations` — create annotation (CAE/Director only)
- `GET /v1/engagements/:id/resolved-rules` — resolver output

### 9.3 Webhook events

- `pack.published` (platform-level; per-tenant filtered)
- `pack.version.available` (when new version released)
- `annotation.created`
- `annotation.updated`
- `resolver.override.required` (engagement has override pending)

---

## 10. Permissions

| Role | Browse pack library | Attach pack to engagement | Create annotation | Bulk upgrade |
|---|---|---|---|---|
| Auditor-in-Charge | ✅ | ✅ | ❌ | ❌ |
| Staff Auditor | ✅ | ❌ | ❌ | ❌ |
| CAE | ✅ | ✅ | ✅ | ✅ |
| Audit Function Director | ✅ | ✅ | ✅ | ✅ |
| Tenant Admin (Sofia) | ✅ | ❌ | ❌ | ❌ |
| Platform Admin (Ravi) | ✅ | ❌ | ❌ | ❌ |

---

## 11. Observability

- `resolver.dimension.resolved` (counter, labels: dimensionKey, strictnessDirection, overrideApplied)
- `resolver.duration` (histogram)
- `annotation.created` (counter)
- `annotation.impact.preview` (counter)
- `pack.version.upgrade` (counter, labels: fromVersion, toVersion, success)
- `resolver.override.required` (counter — any override-required dimension flagged)

---

## 12. Performance characteristics

- Resolver run at engagement creation: p99 < 500ms
- Resolver re-run at pack attach/detach: p99 < 2s
- Annotation impact preview: p99 < 3s
- Bulk upgrade of 100 engagements: completed in background within 15 minutes (async via SQS)

---

## 13. Compliance implications

- **GAGAS §3.36**: independence threat evaluation — supported via pack rules + annotations
- **IIA GIAS Standard 15.2**: documented methodology governance — satisfied by annotations with rationale + audit trail
- **Peer review evidence**: annotation history + rationale trail exportable
- **Tenant configuration audit**: tenant admin actions logged

---

## 14. Dependencies

### 14.1 Upstream

- Standards pack library (shipped packs must be published before engagements can attach)
- Tenant provisioning (Module 1)
- Identity + auth (Module 2)
- Standards pack schema + validation (data-model layers)

### 14.2 Downstream

- Engagement creation (Module 4) — depends on packs for attachment
- Finding authoring (Module 8) — finding elements derived from packs
- Report generation (Module 10) — report templates derived from packs
- Workflow state machines (all entities) — combined from pack declarations
- Strictness resolver — feeds every rule-bearing dimension

---

## 15. UX references

Detailed UX in [`ux/pack-attachment.md`](../ux/pack-attachment.md) (Phase 6 pending) and [`ux/pack-annotation.md`](../ux/pack-annotation.md) (Phase 6 pending).

Key UX:
- **Pack attachment picker** — multi-select with type badges + version chooser
- **Pack detail drawer** — detailed view per pack with all declared rules
- **Annotation form** — structured form with validation inline
- **Annotation impact preview** — shows before/after for affected engagements
- **Resolver output view** — dimension-by-dimension explanation with drivenBy chain
- **Pack version upgrade wizard** — step-through UI for bulk upgrade

---

## 16. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 14 — feature inventory
- [`04-mvp-scope.md §2.2`](../04-mvp-scope.md) — MVP 1.0 scope
- [`rules/strictness-resolver-rules.md`](../rules/strictness-resolver-rules.md) — resolver algorithm + dimension rules
- [`rules/classification-mappings.md`](../rules/classification-mappings.md) — classifications per pack
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — schema
- [`02-personas.md §5`](../02-personas.md) — Kalpana, the pack-annotation primary persona
- [`docs/03-the-multi-standard-insight.md`](../../docs/03-the-multi-standard-insight.md) §6.6 — pack versioning
- [`features/engagement-management.md`](engagement-management.md) — attachment at engagement creation

---

## 17. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§4.5 — mid-flight migration safety**: reviewer correctly flagged the danger of tenant-level annotation changes silently propagating to engagements in REPORTING phase. Priya's engagement one day from issuance should not have its required finding elements or retention rules change because Kalpana tweaked an annotation. Fix: annotation changes auto-apply only to DRAFT/PLANNING engagements. For engagements in FIELDWORK/REPORTING/FOLLOW_UP/CLOSED, an "Annotation Update Available" banner appears requiring explicit CAE acceptance per engagement. Options: Accept / Reject / Defer until engagement closes.

Phase 4 Part 1's overall verdict was "Approved to proceed to Phase 4 Part 2, with the above adjustments integrated."

---

*Last reviewed: 2026-04-21. Phase 4 Part 1 deliverable; R1 review closed.*
