# AIMS v2 Entity Relationship Diagram

## Schema Overview

Three logical schemas:
- **`public`** — Tenant-scoped business objects (engagements, findings, etc.)
- **`audit`** — Append-only audit trail (audit_log, workflow_events)
- **`platform`** — Cross-tenant reference data (standard_packs, crosswalks)

---

## High-Level Relationship Map

```
┌──────────────────────────────────────────────────────────────────────┐
│ PLATFORM SCHEMA (cross-tenant reference data)                        │
│                                                                      │
│  standard_packs  ←───  tenant_standard_packs                         │
│  (versioned,         (tenant activations)                            │
│   immutable)                                                         │
│                                                                      │
│  pack_crosswalks  (many-to-many between packs, curated)              │
└──────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ referenced by
                              │
┌─────────────────────────────┼────────────────────────────────────────┐
│ PUBLIC SCHEMA (tenant-scoped)                                        │
│                             │                                        │
│   ┌──────────┐              │                                        │
│   │  Tenant  │──┬── users ──┴── user_tenants                         │
│   │          │  │                                                    │
│   │          │  ├── engagements ──┬── engagement_standard_packs      │
│   │          │  │                 ├── engagement_team_members        │
│   │          │  │                 ├── engagement_phases              │
│   │          │  │                 ├── planning_documents             │
│   │          │  │                 ├── work_programs                  │
│   │          │  │                 │     └── work_program_procedures  │
│   │          │  │                 ├── observations                   │
│   │          │  │                 │     └── escalated to Finding     │
│   │          │  │                 ├── findings  ⭐ (core)            │
│   │          │  │                 │     ├── management_responses     │
│   │          │  │                 │     ├── recommendations          │
│   │          │  │                 │     │     └── corrective_actions │
│   │          │  │                 │     └── finding_test_links       │
│   │          │  │                 ├── workpapers                     │
│   │          │  │                 │     ├── workpaper_versions       │
│   │          │  │                 │     │     └── files              │
│   │          │  │                 │     └── workpaper_links (poly)   │
│   │          │  │                 ├── audit_tests                    │
│   │          │  │                 ├── sampling_worksheets            │
│   │          │  │                 ├── reports                        │
│   │          │  │                 │     └── files (PDF)              │
│   │          │  │                 ├── checklist_instances            │
│   │          │  │                 ├── independence_declarations      │
│   │          │  │                 ├── approvals (polymorphic)        │
│   │          │  │                 └── time_entries                   │
│   │          │  │                                                   │
│   │          │  ├── audit_universe_entities (hierarchical)           │
│   │          │  ├── annual_audit_plans                               │
│   │          │  ├── peer_reviews                                     │
│   │          │  ├── certifications                                   │
│   │          │  ├── cpe_records                                      │
│   │          │  ├── notifications                                    │
│   │          │  └── files (S3 metadata)                              │
│   └──────────┘                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ every mutation logged
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ AUDIT SCHEMA (append-only, hash-chained)                             │
│                                                                      │
│  audit_log       — every CREATE/UPDATE/DELETE with hash chain        │
│                    Partitioned by month, 7-year retention            │
│  workflow_events — event sourcing for approval workflows             │
│  idempotency_keys — prevent duplicate mutations                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Finding — The Core Entity (Detail)

Findings are the most heavily referenced audit artifact. Immutable once ISSUED.

```
                   ┌──────────────┐
                   │  Engagement  │
                   └──────┬───────┘
                          │ N
                          │
                   ┌──────┴───────┐
              ┌────│   Finding    │────┐
              │    │              │    │
              │    │ elementValues│    │  ← JSONB keyed by
              │    │ (polymorphic)│    │     pack findingElements
              │    │              │    │
              │    │ locked_at    │    │  ← immutability after ISSUED
              │    │ signed_hash  │    │  ← e-signature for non-repudiation
              │    └──────────────┘    │
              │                        │
              │                        │
         1:1  │                      N │
              ▼                        ▼
   ┌──────────────────┐       ┌─────────────────┐
   │ Management       │       │ Recommendation  │
   │ Response         │       │                 │
   └──────────────────┘       └────────┬────────┘
                                       │ N
                                       │
                                  ┌────┴──────────┐
                                  │ Corrective    │
                                  │ Action (CAP)  │
                                  └───────────────┘

    N:N links to:                  N:N links to:
   ┌────────────┐               ┌────────────────┐
   │ Workpapers │               │ Audit Tests    │
   └────────────┘               └────────────────┘
      (via workpaper_links)       (via finding_test_links)

    Self-reference:
   ┌─────────────────────────┐
   │ prior_finding_id → Finding (for REPEAT findings)
   └─────────────────────────┘
```

---

## Standard Pack Resolution

When an engagement is created, the engine resolves multiple Standard Packs:

```
Engagement
    │
    │ primary_pack_code + primary_pack_version
    ▼
StandardPack (e.g., GAGAS:2024)
    │
    │ dependencies:
    │   - "AICPA_AUC:current" (incorporates)
    │   - "UNIFORM_GUIDANCE:2024" (requires for SINGLE_AUDIT)
    ▼
Multiple packs resolved and merged for:
    - Terminology
    - Finding elements (superset if multi-standard)
    - Workflows (stricter wins)
    - Report sections
    - Checklists (union)
```

The `engagement_standard_packs` table stores which packs apply to each engagement (supporting multi-standard).

---

## Immutability State Machine

```
DRAFT
  │
  ▼
UNDER_REVIEW  ──┬──▶ REJECTED  ──▶ (back to DRAFT)
  │              │
  │              └──▶ CHANGES_REQUESTED ──▶ (back to DRAFT)
  ▼
APPROVED
  │
  ▼
COMMUNICATED (to auditee)
  │
  ▼
ISSUED ⭐ (LOCKED; locked_at set)
  │   ⚠ Cannot modify — create amendment
  │
  ├──▶ CLOSED  ⭐ (final)
  │
  └──▶ REOPENED (rare, audit trail retained)

  ⚠ WITHDRAWN  ⭐ (only if finding retracted; requires justification)
```

---

## Polymorphic Relationships

### Approvals (polymorphic)
Approvals can be for any entity. Resolved via `entity_type` + `entity_id`:
```
Approval
  ├── entity_type: 'finding'           → finding_id → Finding
  ├── entity_type: 'report'            → entity_id  → Report
  ├── entity_type: 'planning_document' → entity_id  → PlanningDocument
  ├── entity_type: 'engagement'        → engagement_id → Engagement
  └── entity_type: 'independence_declaration' → entity_id → IndependenceDeclaration
```

### Workpaper Links (polymorphic)
Workpapers can evidence any audit artifact:
```
WorkpaperLink
  ├── linked_entity_type: 'finding'   → finding_id
  ├── linked_entity_type: 'procedure' → procedure_id
  ├── linked_entity_type: 'observation' → observation_id
  └── linked_entity_type: 'test'      → test_id
```

---

## Bitemporal Data Model (Findings)

Findings track **two time dimensions**:

| Dimension | Column | Meaning |
|-----------|--------|---------|
| Valid time | `valid_from`, `valid_to` | Real-world dates the finding was true |
| Transaction time | `created_at`, `updated_at` | When the record was created/modified in DB |

Example queries:
- **"What did this finding look like on 2026-03-15?"** — Use `updated_at <= '2026-03-15'`
- **"What was happening in the business on 2026-03-15?"** — Use `valid_from <= '2026-03-15' AND valid_to >= '2026-03-15'`
- **"Is this finding still a current issue?"** — `valid_to IS NULL OR valid_to > CURRENT_DATE`

---

## Key Integrity Rules

| Table | Rule | Enforcement |
|-------|------|-------------|
| `audit_log` | Append-only | Trigger blocks UPDATE/DELETE |
| `audit_log` | Tamper-evident | Hash chain (previous_hash + content_hash) |
| `findings` (ISSUED) | Immutable | Trigger + `locked_at` flag |
| `reports` (ISSUED) | Immutable | Trigger + `locked_at` flag |
| `independence_declarations` (signed) | Immutable | Trigger |
| `approvals` (decided) | Immutable | Trigger |
| `workpaper_versions` | Immutable | Trigger (create new version instead) |
| `standard_packs` (published) | Immutable | Trigger |
| Tenant isolation | Enforced | Row-Level Security policies |
| Optimistic concurrency | Version check | `_version` column + client check |

---

## Cardinality Summary

| Relationship | Cardinality | Notes |
|--------------|-------------|-------|
| Tenant → Users | 1:N | Users belong to one or more tenants via user_tenants |
| Tenant → Engagements | 1:N | |
| Engagement → Findings | 1:N | |
| Engagement → Standard Packs | N:N | Supports multi-standard engagements |
| Finding → Recommendations | 1:N | |
| Recommendation → Corrective Actions | 1:N | |
| Finding → Management Response | 1:1 | |
| Finding → Workpapers | N:N | Via workpaper_links |
| Engagement → Team Members | N:N | With role attribute |
| Engagement → Reports | 1:N | Multiple reports per engagement (Yellow Book + Single Audit + etc.) |
| User → Certifications | 1:N | |
| User → CPE Records | 1:N | |
| Approval → Entity | N:1 (polymorphic) | |
| Finding → Prior Finding | N:1 (self-ref) | For repeat findings |

---

## Volume Estimates

For capacity planning. Conservative estimates per tenant per year for a mid-sized audit organization:

| Table | Volume/year | Notes |
|-------|-------------|-------|
| `engagements` | 50-500 | Depends on tenant size |
| `findings` | 500-5,000 | ~10 findings per engagement |
| `recommendations` | 1,000-10,000 | |
| `corrective_actions` | 1,000-10,000 | |
| `workpapers` | 10,000-100,000 | Often 20+ per engagement |
| `workpaper_versions` | 15,000-150,000 | 1.5x workpapers |
| `audit_tests` | 2,000-50,000 | SOX-heavy tenants generate thousands |
| `time_entries` | 100,000-500,000 | Daily entries per auditor |
| `notifications` | 50,000-500,000 | Multiple per auditor per day |
| `audit_log` | 1,000,000-10,000,000 | Every CRUD + auth event |
| `files` | 15,000-150,000 | |

**Total per tenant year**: ~10-50GB. 100 tenants ≈ 1-5TB/year.

Partition audit_log by month; plan for 7-year retention = ~70-350GB just for audit log.

---

## Index Strategy (Summary — see PERFORMANCE.md for detail)

Critical indexes for query patterns:
- `(tenant_id, status)` on engagements, findings, approvals
- `(tenant_id, created_at)` for time-sorted lists
- `(tenant_id, classification)` for finding filters
- `(assigned_to_id, status)` for "my pending approvals"
- `(tenant_id, user_id, entry_date)` for time tracking
- GIN indexes on JSONB columns for full-text search on `elementValues`
- Partial indexes on `deleted_at IS NULL` for hot data

---

## Materialized Views (Dashboard/Analytics)

Refreshed nightly or on-demand:
- `mv_engagement_summary` — engagement status + counts per tenant
- `mv_finding_trends` — findings by month/risk/type
- `mv_cap_status_pipeline` — CAP aging and status
- `mv_team_utilization` — hours by auditor/engagement
- `mv_standard_coverage` — which standards each engagement covers

See `views/materialized-views.sql` (future).
