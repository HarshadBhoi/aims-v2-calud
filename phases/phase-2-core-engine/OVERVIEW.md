# Phase 2 — Core Audit Engine

> **Goal**: Build the standard-agnostic audit engine — the heart of the platform.
> This engine handles engagements, findings, evidence, and workflows WITHOUT knowing which audit standard is in use.

**Duration**: Weeks 5-10
**Dependencies**: Phase 1 (Foundation)
**Unlocks**: Phase 3 (GAGAS), Phase 5 (Advanced Features)

---

## Deliverables

| # | Task | Status | Detail |
|---|------|--------|--------|
| 2.1 | Standards Abstraction Layer | Pending | [Detail](2.1-standards-abstraction.md) |
| 2.2 | Engagement Management | Pending | [Detail](2.2-engagements.md) |
| 2.3 | Planning & Risk Assessment | Pending | [Detail](2.3-planning.md) |
| 2.4 | Fieldwork & Evidence | Pending | [Detail](2.4-fieldwork.md) |
| 2.5 | Findings & Recommendations | Pending | [Detail](2.5-findings.md) |
| 2.6 | Workflow & Approval Engine | Pending | [Detail](2.6-workflows.md) |
| 2.7 | Workpaper Management | Pending | [Detail](2.7-workpapers.md) |

---

## Architecture Principle

The core engine defines the **shape** of audit work (engagements have findings, findings have recommendations, etc.) but NOT the **rules** (what fields are required, what approval steps exist, what the report looks like). Rules come from the Standard Pack loaded for each engagement.

```
┌─────────────────────────────────────────┐
│           Standard Pack (GAGAS)          │  ← Rules, templates, terminology
├─────────────────────────────────────────┤
│           Core Audit Engine             │  ← THIS PHASE
│  Engagements | Findings | Workpapers    │
│  Workflows   | Evidence | Planning      │
├─────────────────────────────────────────┤
│           Foundation (Phase 1)          │  ← DB, Auth, UI, Storage
└─────────────────────────────────────────┘
```

---

## Definition of Done

- [ ] Create engagement with type and standard selection
- [ ] Full engagement lifecycle: Draft → Planning → Fieldwork → Reporting → Review → Issued → Closed
- [ ] Planning documents (objectives, scope, methodology, risk assessment)
- [ ] Work programs with procedures and status tracking
- [ ] Findings with configurable elements (not hardcoded to GAGAS four elements)
- [ ] Recommendations with management response and CAP tracking
- [ ] Workpaper upload, review, and sign-off
- [ ] Configurable approval workflows (define steps per standard)
- [ ] Engagement team management with role assignments
- [ ] All CRUD operations have API endpoints and frontend UI
- [ ] All list views have search, filter, sort, and pagination
