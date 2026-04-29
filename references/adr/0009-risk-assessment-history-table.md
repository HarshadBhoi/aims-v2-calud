# 0009 — Risk Assessment as a per-fiscal-year history table

- **Status**: Proposed
- **Date**: 2026-04-28
- **Deciders**: @HarshadBhoi
- **Consulted**: v1 SPFx schema review (provision-aims.ps1), schema gap analysis 2026-04-28
- **Informed**: engineering, product
- **Tags**: #database #data-model #risk #internal-audit #planning

---

## Context

Annual risk assessment of the audit universe is a foundational internal-audit deliverable. Each fiscal year, the audit team scores every auditable entity (department, process, system, program) on multiple risk dimensions — typically Strategic, Operational, Compliance, Financial, Reputational, each on a 1-5 scale — to produce a composite score that drives the annual audit plan. This is required by GAGAS §5.07 (planning), the IIA Standards (especially Standard 9.4 Internal Audit Plan), and ISO 19011.

A risk assessment is a *per-fiscal-year, point-in-time* artifact. Year-over-year trending is itself a deliverable — auditors and audit committees ask "did the risk profile of this department go up or down since last year, and why?" The history is the value.

The v1 SPFx implementation (`Claude_RiskAssessments` in [`provision-aims.ps1`](../../scripts/provision-aims.ps1)) modeled this correctly: one row per (auditable unit, fiscal year), with five dimension scores, composite, rating, assessor, approver, dates.

The initial v2 [`schema.prisma`](../../database/schema.prisma) draft collapsed this into a JSONB `riskFactors` blob plus `inherentRiskScore` / `residualRiskScore` / `lastRiskAssessment` columns on the [`AuditUniverseEntity`](../../database/schema.prisma) row. This represents the *current* assessment but loses every prior year. It also flattens the dimension structure — JSONB has no schema enforcement, no per-dimension indexing, and no built-in support for pack-specific dimension sets.

A decision is needed before [Slice A](../../VERTICAL-SLICE-PLAN.md) builds, because:
- An audit committee asking "show me the risk trend for the procurement department over the last three years" requires the history to exist *as data*, not as a snapshot
- Pack-specific dimension sets (GAGAS uses 5 dimensions; COSO ERM uses different categories; ISO 31000 has its own taxonomy) need a place to live with structure preserved per assessment
- Rebuilding history later is expensive (scrape PDFs, re-enter manually) — the cost of writing the row at the time of the assessment is near-zero

---

## Decision

Risk assessments are stored in a `RiskAssessment` table, one row per (auditable entity, fiscal year). Dimensions are stored as JSONB to support pack-defined dimension sets, with a denormalized `compositeScore` and `riskRating` for query and reporting.

The current "snapshot" columns on `AuditUniverseEntity` (`inherentRiskScore`, `residualRiskScore`, `lastRiskAssessment`) remain — they serve as a fast-path cache for the most-recent assessment without joining the history table. The cache is updated by the same transaction that writes the new `RiskAssessment` row; no out-of-band reconciliation needed.

Approval workflow uses the existing `Approval` polymorphic table with `entityType = 'risk_assessment'`. Audit-trail entries on the `RiskAssessment` table use the existing audit log (per ADR baseline). Assessment lock/immutability semantics match other planning-phase artifacts: editable until approved, then locked.

---

## Alternatives considered

### Option A — JSONB blob on `AuditUniverseEntity`  (rejected — was the initial draft)

A `riskFactors Json` column plus snapshot scores plus a single `lastRiskAssessment` date.

**Pros**
- One fewer table; no join for the common "show me current risk" query
- Pack-specific dimensions trivially supported
- Simpler to write; no FK fan-out

**Cons**
- No history. The single `lastRiskAssessment` date erases all priors. Year-over-year trending becomes impossible from data alone
- Approval workflow per-assessment becomes a clumsy retrofit (the JSONB blob doesn't have an entity-id approvals can reference)
- Cannot represent in-progress assessment (current year's draft) and last-finalized (prior year's locked) at the same time
- Pack-specific dimensions in JSONB lose schema enforcement at the DB layer; mistakes in pack rollout corrupt history silently
- v1 has separate per-FY rows; collapsing breaks UX continuity for users migrating from v1

### Option B — Separate `RiskAssessment` table per (entity, FY)  (chosen)

One row per assessment. Dimensions JSONB. Snapshot columns on universe entity remain as cache.

**Pros**
- Faithful history; trending is a `WHERE fiscal_year IN (2024, 2025, 2026)` query
- Approval workflow integrates cleanly via existing `Approval` polymorphic pattern
- Pack-specific dimensions in JSONB preserve flexibility, while denormalized composite and rating support indexing
- Snapshot columns on universe entity stay — fast-path read is preserved
- Matches v1 model exactly; v1 → v2 data migration is row-for-row
- Lock/immutability per assessment, not per universe entity, so editing the current year doesn't unlock the prior year
- Aligns with how risk assessments are conducted operationally (annual cadence, formal approval, then archived)

**Cons**
- Two sources of truth for the "current" assessment: the snapshot columns on `AuditUniverseEntity` and the most-recent `RiskAssessment` row. Reconciliation is a transactional write, but anyone hand-editing the DB can drift. Mitigated by trigger-based snapshot maintenance in [`database/functions/`](../../database/functions/)
- Slightly more complex to write the "current state" query — though `AuditUniverseEntity` snapshot columns mean the common read path doesn't join

### Option C — Bitemporal columns on `AuditUniverseEntity`  (rejected)

Add `validFrom`/`validTo` to the universe entity itself; rewrite the row on each new assessment, preserving history via the bitemporal columns.

**Pros**
- Reuses the bitemporal pattern already established for findings
- No new table

**Cons**
- Couples *what the entity is* (its name, parent, owner) with *what its risk score was* — you can't update the entity's name without creating a new bitemporal row that also restates risk
- Multiple risk assessments per year (e.g., quarterly updates) violate the bitemporal "one row valid at any time T" invariant
- Approval workflow on a bitemporal row is awkward — what does it mean to approve a snapshot of an entity?
- Risk-dimension flexibility per pack still lives in JSONB on the entity row; no improvement over Option A

### Option D — Time-series database / event sourcing  (rejected)

Each scoring change is an event; current state is a fold over events; historical queries replay events to a target year.

**Pros**
- Maximum auditability — every change is an event
- Aligns with workflow event sourcing already used in `WorkflowEvent`

**Cons**
- Annual cadence is the wrong granularity for event sourcing; risk assessment is a discrete deliverable, not a continuous stream
- Operational overhead (event projections, snapshots) is not justified by the value at this cadence
- Reporting performance for "show last three years of trends" requires snapshot tables anyway — you've reinvented Option B with extra steps
- Industry-standard internal-audit tools all model risk assessments as discrete records, not event streams; auditors expect record semantics

---

## Consequences

### Positive
- Year-over-year trending is a query, not a forensic exercise
- Approval workflow integrates with the existing polymorphic `Approval` table
- Per-assessment immutability (lock when approved) is straightforward
- Pack-specific dimension sets (GAGAS 5-dim, COSO ERM, ISO 31000) coexist via JSONB without losing per-pack schema enforcement at the application layer
- v1 → v2 data migration is row-for-row; no semantic translation
- The "current snapshot" denormalization on `AuditUniverseEntity` keeps the fast-path read fast — no cross-year join for the dashboard view

### Negative
- Two sources of truth for "current assessment" (snapshot on universe entity, most-recent `RiskAssessment` row) — reconciled by trigger; out-of-band hand-editing can drift
- One more table to design RLS policy for, add Prisma extension scoping for, and build CRUD around
- One more entity in the audit-log story
- Pack authors must write their dimension definitions into pack content if they want pack-specific dimensions; default GAGAS 5-dim is the fallback

### Neutral
- Reporting layer must implement YoY-trend queries; not free, but bounded
- Approval audit trail entries grow proportional to (entities × years × approval steps) — modest growth for the reasonable scale

---

## Validation

- If, two years post-launch, no tenant has populated a second year of `RiskAssessment` rows for any entity, revisit — the history value isn't materializing and the table may be a complexity tax
- If `AuditUniverseEntity` snapshot columns drift from `RiskAssessment` history on more than one tenant due to bypassed-trigger writes, harden the trigger or move snapshot maintenance to application-layer transactions only (drop the trigger)
- If pack authors universally use the same five dimensions (Strategic / Operational / Compliance / Financial / Reputational), promote those to first-class columns in a follow-up ADR — the JSONB flexibility cost was unjustified
- If quarterly or ad-hoc risk reassessments become a real use case (not just annual), the `(entityId, fiscalYear)` unique constraint becomes wrong; we'd add an `assessmentDate` to the unique key and drop the FY uniqueness — minor migration

---

## Rollout plan

- **Phase 1 — Schema** (immediate, complete): `RiskAssessment` model added to [`database/schema.prisma`](../../database/schema.prisma); reverse relation added on `AuditUniverseEntity`; snapshot columns retained
- **Phase 2 — Migrations** (when Slice A or a planning slice exercises this): Prisma migration generated; trigger added in [`database/functions/`](../../database/functions/) to update `AuditUniverseEntity` snapshot columns when a `RiskAssessment` row is approved (status transitions to a "locked" state); RLS policy for the new table added in [`database/policies/`](../../database/policies/)
- **Phase 3 — Pack support**: Default GAGAS 5-dimension methodology defined in pack content; tenants opting into other packs (COSO ERM, ISO 31000) get pack-defined dimension sets; pack `riskAssessmentMethodology` field referenced by the assessment form
- **Phase 4 — UI**: tRPC procedures for assessment CRUD, approval workflow surface; trend visualization (year-over-year) on the audit-universe dashboard

Pre-launch — no data migration needed. v1 → v2 import path (future) maps `Claude_RiskAssessments` rows directly.

---

## References

- [`database/schema.prisma`](../../database/schema.prisma) — `RiskAssessment` model
- [`scripts/provision-aims.ps1`](../../scripts/provision-aims.ps1) — v1 `Claude_RiskAssessments` field definitions (reference for migration mapping)
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — `riskAssessmentMethodology` field (line 392)
- Schema gap analysis 2026-04-28 (chat record; v1 → v2 field comparison)
- GAGAS §5.07 — engagement planning and risk assessment requirements
- IIA Standard 9.4 — Internal Audit Plan
- Related ADRs:
  - [ADR-0002](0002-tenant-isolation-two-layer.md) — tenant isolation pattern (applies to RiskAssessment RLS)
  - [ADR-0008](0008-control-matrix-as-separate-model.md) — companion decision: ControlMatrix as separate model upstream of AuditTest

---

<!--
CHANGELOG:
- 2026-04-28: Proposed by @HarshadBhoi following v1 → v2 schema gap analysis
-->
