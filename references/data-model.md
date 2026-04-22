# Data Model — Entity Relationship Overview

## Core Entity Relationships

```
                                    ┌──────────────┐
                                    │   Standard   │
                                    │  (GAGAS,IIA) │
                                    └──────┬───────┘
                                           │ has many
                                    ┌──────┴───────┐
                              ┌─────┤  Standard    │
                              │     │  Requirement │
                              │     └──────────────┘
                              │ crosswalk
                              │
┌──────────┐    has many    ┌─┴────────────┐
│  Tenant  │───────────────▶│ Tenant       │
│          │                │ Standard     │
│          │                └──────────────┘
│          │
│          │    has many    ┌──────────────┐    has many    ┌─────────────┐
│          │───────────────▶│    User      │───────────────▶│ TimeEntry   │
│          │                └──────────────┘                └─────────────┘
│          │                       │
│          │                  team member of
│          │                       │
│          │    has many    ┌──────┴───────┐
│          │───────────────▶│ Engagement   │
└──────────┘                │              │
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┬──────────────┐
                    │              │              │              │
              has many        has many      has many       has many
                    │              │              │              │
             ┌──────┴──┐   ┌──────┴──┐   ┌──────┴──┐   ┌──────┴──┐
             │ Finding  │   │Workpaper│   │  Work   │   │ Report  │
             │          │   │         │   │ Program │   │         │
             └────┬─────┘   └─────────┘   └─────────┘   └─────────┘
                  │
            has many
                  │
         ┌────────┴────────┐
         │ Recommendation  │
         │                 │
         └────────┬────────┘
                  │
            has many
                  │
         ┌────────┴────────┐
         │ Corrective      │
         │ Action (CAP)    │
         └─────────────────┘


Cross-Cutting Entities:
─────────────────────────
Approval ──── polymorphic (Engagement, Finding, Report, PlanningDoc)
AuditLog ──── every entity (immutable, append-only)
Notification ── every user
```

---

## Table Count Summary

| Category | Tables | Examples |
|----------|--------|---------|
| Core Platform | 5 | Tenant, User, Session, Notification, AuditLog |
| Standards | 4 | Standard, TenantStandard, StandardRequirement, Crosswalk |
| Audit Engine | 12 | Engagement, Finding, Recommendation, CAP, Workpaper, WorkProgram, Report, Approval, EngagementTeam, Observation, AuditTest, PlanningDocument |
| Supporting | 6 | TimeEntry, CPERecord, IndependenceDeclaration, QAChecklist, PeerReview, AuditUniverse |
| SaaS | 3 | Subscription, Invoice, ApiKey |
| **Total** | **~30** | |

---

## Key Design Principles

1. **Every tenant-scoped table has `tenantId`** — enforced by Prisma and RLS
2. **Soft deletes via `deletedAt`** — audit data must be recoverable
3. **CUID IDs** — collision-resistant, URL-safe, sortable
4. **JSON fields for flexibility** — standard-specific configs, custom fields
5. **Polymorphic approvals** — one Approval table serves all entity types
6. **Append-only AuditLog** — immutable, partitioned by month
7. **Indexed for common queries** — tenant + status, tenant + date range
