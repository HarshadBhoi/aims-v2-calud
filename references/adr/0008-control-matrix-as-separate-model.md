# 0008 — Control Matrix (PRCM) as a separate model upstream of Audit Tests

- **Status**: Accepted
- **Date**: 2026-04-28
- **Deciders**: @HarshadBhoi
- **Consulted**: v1 SPFx schema review (provision-aims.ps1), schema gap analysis 2026-04-28
- **Informed**: engineering, product
- **Tags**: #database #data-model #internal-audit #sox #fieldwork

---

## Context

The Process-Risk-Control Matrix (PRCM) is a load-bearing artifact in internal audit, SOX 404, IIA assurance engagements, and ISO management-system audits. It documents the *control universe* for an engagement: each row maps a process to a risk to a control, with attributes for control type (preventive/detective/corrective/directive), nature (manual/automated/IT-dependent), frequency, owner, and effectiveness. Audit tests then *exercise* these controls; findings reference the control row that failed.

The v1 SPFx implementation (`Claude_PRCM` in [`provision-aims.ps1`](../../scripts/provision-aims.ps1)) has 22 fields covering this concept and is referenced by the existing UX, reports, and engagement workflow.

The initial v2 [`schema.prisma`](../../database/schema.prisma) draft did not include a PRCM model. Control documentation was collapsed into the [`AuditTest`](../../database/schema.prisma) row (`controlId`, `controlDescription`, `assertionTested`). This conflates two different audit-lifecycle artifacts:

1. **What controls exist and should be tested** — documented during planning, owned by the auditee or audit team, may include controls not tested this engagement (out-of-scope but documented for completeness)
2. **What was tested and what we found** — the AuditTest row, owned by the auditor, captures sample size, exceptions, conclusion

Conflating them prevents:
- Representing controls that exist but were not tested this engagement
- Tracking control effectiveness independent of any specific test
- Linking multiple tests to the same control (TOD + TOE for the same SOX key control)
- Multi-engagement reuse of the same control universe (controls are stable; tests are per-engagement)
- Reporting "control coverage" — what % of identified controls were tested

A decision is needed before [Slice A](../../VERTICAL-SLICE-PLAN.md) builds, because retrofitting AuditTest from "row also documents the control" to "row references a control" is a non-trivial migration and changes the engagement-planning UX surface.

---

## Decision

PRCM is modeled as a separate `ControlMatrix` table, scoped to an engagement. Each row documents one (process, risk, control) triple with full v1 fidelity. `AuditTest` gains an optional `controlMatrixId` foreign key — a test may reference a matrix row, or it may stand alone (substantive financial tests, walkthroughs without an identified key control).

Pack-specific control attributes (e.g., COSO 2013 component reference, ISO 27001 Annex A clause) live in `customAttributes` JSONB; canonical attributes (type, nature, frequency, effectiveness) are first-class columns for query and reporting.

The matrix row carries its own status (`DRAFT → ACTIVE → TESTED → CLOSED`) independent of the engagement and any test; this lets the planning team finalize a control universe before testing begins, and lets the post-engagement review flag controls documented but never tested.

---

## Alternatives considered

### Option A — Collapse PRCM into AuditTest  (rejected)

The initial v2 draft. Each AuditTest row carries `controlId`, `controlDescription`, `controlType`, etc.

**Pros**
- One fewer table; simpler joins
- Aligns with "the test is what matters; document the control inline"
- Substantive-testing-heavy engagements don't pay for an unused matrix

**Cons**
- Cannot represent untested controls (out-of-scope-but-documented is a real planning artifact)
- Multiple tests on the same control (TOD + TOE for SOX) duplicate control attributes across rows, causing drift
- No "control coverage" report — can't tell what fraction of identified controls were tested
- Conflates planning-phase artifact (control documentation) with fieldwork artifact (test execution)
- v1 has separate PRCM; collapsing breaks UX continuity for users migrating from v1
- Pack templates that expect a control universe (SOX 404 workflow, ISO management review) cannot reference a stable artifact

### Option B — Standalone `ControlMatrix` referenced by `AuditTest`  (chosen)

Separate table for the control matrix. AuditTest may optionally reference a matrix row.

**Pros**
- Faithful to the audit-domain artifact; matches GAGAS, SOX 404, IIA, ISO 27001 expectations
- Supports control coverage analysis and "untested control" reports
- Multiple tests per control (TOD + TOE) without attribute duplication
- Pack templates can reference a stable upstream artifact for planning-phase outputs (PRCM PDF report, SOX management assertion package)
- Preserves v1 UX continuity for users familiar with separate PRCM management
- Optional FK on AuditTest — substantive-only engagements pay nothing if they don't use it

**Cons**
- Additional table; one more migration to write and one more model to keep in sync with the data-model schema
- Risk of orphan matrix rows (engagement closed, controls documented, no tests run) — accepted, since "documented but not tested" is a legitimate state
- Engagement-scoping means matrix doesn't cross-reference between engagements; a future "control library" feature would be a separate entity (out of scope for now)

### Option C — PRCM as JSONB on Engagement  (rejected)

Store the entire control matrix as a JSONB array on the Engagement row.

**Pros**
- No additional table
- Pack-specific shape supported via JSONB

**Cons**
- Cannot index control attributes (effectiveness, type, owner) for cross-engagement reports
- Cannot reference a specific control row from AuditTest (would have to reference by JSON path, fragile)
- Bitemporal corrections to a single control row require rewriting the whole engagement JSONB
- Auditing changes (which auditor changed which control's effectiveness rating) becomes coarse-grained
- Loses the v1 UX surface for managing PRCM as discrete records

### Option D — Pack-defined templates only  (rejected)

PRCM is a planning template; sections defined per pack; instances live in `PlanningDocument.sections` JSONB.

**Pros**
- No new model; reuses existing planning-document infrastructure
- Pack authors fully control PRCM shape

**Cons**
- PRCM is a *runtime* artifact (dynamic during fieldwork — controls are added, effectiveness is updated as testing proceeds), not a static planning document
- AuditTest cannot reference individual PRCM rows in a JSONB blob without fragile JSON-path FKs
- Pack-driven structure forces PRCM users to author a pack just to enable a near-universal artifact
- Doesn't match v1 UX; users migrating from v1 lose the dedicated PRCM list

---

## Consequences

### Positive
- Domain-faithful model: PRCM is the artifact internal auditors expect; v2 honors that
- Control coverage reporting becomes a query, not a manual process
- Multiple tests per control without attribute duplication
- v1 → v2 migration path for the PRCM concept is straightforward (one-to-one row mapping)
- Pack templates can reference `ControlMatrix` rows in their report definitions (e.g., a SOX management assertion package can list all TESTED controls and their effectiveness)
- AuditTest stays focused on test execution, not control documentation

### Negative
- One more table to design RLS policies for, write Prisma extension scoping for, and build the API surface around (tRPC procedures for matrix CRUD)
- One more entity in the audit-trail / immutability story — matrix rows lock when engagement issues
- One more place a denormalization decision must be made (do we cache effectiveness counts on Engagement? Probably not before scale forces it)
- Dual-source-of-truth risk: `AuditTest.controlId` (denormalized free text) vs. `AuditTest.controlMatrix.controlCode` (FK-referenced) — must be reconciled at the API layer; we keep both because some engagements (financial substantive testing) genuinely have no upstream PRCM row, and we want the audit test to still document any ad-hoc control reference

### Neutral
- Pack schema (`data-model/standard-pack-schema.ts`) does not need new fields — pack-specific control attributes go in `customAttributes` JSONB; pack reportDefinitions can reference matrix rows by code
- Slice A may or may not exercise this model depending on the chosen vertical slice (the current slice is engagement → finding → PDF, which doesn't require PRCM); if slice A is later extended to include a control-testing flow, this model is ready
- v1-to-v2 data migration tool (future) maps `Claude_PRCM` rows 1:1 onto `ControlMatrix` rows

---

## Validation

- If, six months post-launch, no tenant has populated a `ControlMatrix` row across any engagement, revisit — perhaps the abstraction is wrong for our customer base and we should make it pack-opt-in or remove it
- If multiple tenants ask for cross-engagement control libraries (the same SOX key control documented once and reused across quarterly testing), revisit — we may need to extract a tenant-level `ControlLibrary` and make `ControlMatrix` an instantiation of library entries
- If the `customAttributes` JSONB grows pack-specific keys that 80%+ of tenants use the same way, promote those keys to first-class columns in a follow-up ADR
- If denormalization of effectiveness counts to `Engagement` is needed for dashboard performance at scale, that's a non-architectural performance change, not an ADR

---

## Rollout plan

- **Phase 1 — Schema** (immediate, complete): `ControlMatrix` model added to [`database/schema.prisma`](../../database/schema.prisma); `AuditTest.controlMatrixId` FK added; reverse relations added on `Engagement` and `AuditTest`
- **Phase 2 — Migrations** (when Slice A or follow-up slice exercises this): Prisma migration generated; RLS policy for the new table added in [`database/policies/`](../../database/policies/) following the same `tenant_id` pattern as other engagement-scoped tables
- **Phase 3 — Pack support** (when first pack uses it): Pack reportDefinitions for SOX 404 / IIA / GAGAS gain references to `ControlMatrix` rows where appropriate; pack templates for PRCM PDF reports added
- **Phase 4 — UI** (post-Slice A): tRPC procedures for matrix CRUD, UI surface for PRCM management, AuditTest detail view shows linked matrix row

Pre-launch — no data migration needed.

---

## References

- [`database/schema.prisma`](../../database/schema.prisma) — `ControlMatrix` model and `AuditTest.controlMatrixId` FK
- [`scripts/provision-aims.ps1`](../../scripts/provision-aims.ps1) — v1 `Claude_PRCM` field definitions (reference for migration mapping)
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — pack schema; `customAttributes` extension surface
- Schema gap analysis 2026-04-28 (chat record; v1 → v2 field comparison)
- Related ADRs:
  - [ADR-0002](0002-tenant-isolation-two-layer.md) — tenant isolation pattern (applies to ControlMatrix RLS)

---

<!--
CHANGELOG:
- 2026-04-28: Proposed by @HarshadBhoi following v1 → v2 schema gap analysis
- 2026-05-01: Accepted by @HarshadBhoi — schema landed in `database/schema.prisma`,
  policies/triggers updated, no slice-A regressions (97 integration tests passing)
-->
