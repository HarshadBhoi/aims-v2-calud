# Dashboards, Search, and Bulk Operations

> Cross-engagement analytics and discovery. Home dashboard, engagement progress, finding aging, CAP compliance, CPE compliance, risk heat map, annual plan vs. actual, global search, saved searches, bulk operations, cross-tenant search for platform admin. Five to seven opinionated canned dashboards per `docs/06 §7.7` — explicitly not a BI tool; custom analytics goes to Power BI / Tableau via warehouse export per `integrations-and-api.md`.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 16
**Primary personas**: Priya (her engagements), Marcus (CAE portfolio), Elena (firm WIP), Kalpana (bureau analytics), Ravi (cross-tenant)
**MVP phase**: 1.0 (core dashboards + global search + bulk ops on findings); saved searches, bulk ops for CAPs/WPs → 1.5

---

## 1. Feature overview

AIMS v2 ships ~7 opinionated canned dashboards + global search + bulk operations + cross-tenant search. Each dashboard surfaces a specific insight for a specific persona:

1. **Home dashboard** (per-user) — role-appropriate landing page
2. **Engagement progress** — per-engagement dashboard (covered in `engagement-management.md §2.5`)
3. **Finding aging** — findings by age, status, severity; overdue-response alerts
4. **Recommendation tracker** — cross-engagement recommendation status + CAP linkages
5. **CAP compliance** — CAP completion, overdue, verification backlog
6. **CPE compliance** — per-auditor CPE status (auditor self-view and CAE team view)
7. **Risk heat map** — audit universe risk × coverage cycle
8. **Annual plan vs. actual** — plan execution tracking
9. **Multi-standard coverage** (MVP 1.5) — for multi-pack engagements

Plus:
- **Global search** — cross-entity keyword search with filters
- **Bulk operations** — multi-select + bulk-action per entity type
- **Cross-tenant search** (platform admin) — Ravi's support tool

### 1.1 Why not a BI tool

Per `docs/06 §7.7` negative architecture: we ship opinionated canned dashboards; anything custom goes to Power BI / Tableau / Looker via the star-schema warehouse export (per `integrations-and-api.md`). BI tooling is its own product category; we don't compete there.

---

## 2. User stories — Home dashboard

### 2.1 US-DASH-001 — Priya sees role-appropriate home

```gherkin
GIVEN Priya is AIC
WHEN she logs in and lands on Home
THEN she sees:
  - Her active engagements (cards with phase + progress + budget)
  - Pending action items (review queue, approval inbox, overdue items)
  - Recent activity from engagements she's on
  - Upcoming deadlines (phase gates, CAP verifications, CPE deadlines)
  - Quick actions (Create Engagement, Create Finding, Review Inbox)
```

### 2.2 US-DASH-002 — Marcus sees CAE portfolio home

```gherkin
GIVEN Marcus is CAE
WHEN he logs in and lands on Home
THEN he sees:
  - Portfolio overview (active engagements by phase)
  - Approval queue (findings, reports, plans awaiting him)
  - Budget variance flags (engagements > 25% over)
  - Escalated items (CAPs overdue > 10d, security events)
  - Team summary (availability, CPE status)
  - Quick actions
```

### 2.3 US-DASH-003 — Elena sees partner WIP dashboard

```gherkin
GIVEN Elena is CPA firm Audit Partner
WHEN she logs in
THEN she sees:
  - WIP across all her engagements
  - Realization rate per engagement
  - Capacity utilization
  - Client profitability summary
  - Budget variance summary
  - Revenue forecasts
```

**Note**: Elena is Segment A's economic buyer per `02-personas.md §11`. Her dashboard is deliberately economic-focused (different from Marcus's compliance-focused dashboard).

---

## 3. User stories — Finding aging dashboard

### 3.1 US-DASH-004 — Marcus views finding aging

```gherkin
WHEN Marcus opens Finding Aging Dashboard
THEN he sees:
  - Findings grouped by age bucket: 0-30d, 31-60d, 61-90d, 90+d
  - Color-coded by severity (Material Weakness in red; Significant Deficiency orange; Deficiency yellow)
  - Filterable by engagement, classification, status, auditee
  - Drill-down to specific finding
  - Trend chart: finding count over time
```

**Acceptance criteria**:
- Per-tenant scoping (Marcus sees only his tenant's findings)
- Real-time aggregation (< 2s)
- Export to CSV
- Saved filters (MVP 1.5)

### 3.2 US-DASH-005 — Overdue management response alerts

```gherkin
GIVEN a finding has been ISSUED but auditee hasn't responded
  AND the response window (per resolver §3.24) has passed
WHEN dashboard refreshes
THEN finding appears in "Awaiting response" bucket
  AND flagged for AIC attention
```

---

## 4. User stories — CAP compliance dashboard

### 4.1 US-DASH-006 — Marcus views CAP compliance

```gherkin
WHEN Marcus opens CAP Compliance Dashboard
THEN he sees:
  - Total open CAPs
  - On-track CAPs (in progress, within target)
  - Overdue CAPs (highlighted)
  - Escalated CAPs
  - Verification backlog (auditor-side work)
  - CAP completion rate trend (year-over-year)
  - By engagement, by owner, by finding severity
```

### 4.2 US-DASH-007 — David views his CAP status

```gherkin
WHEN David opens his Auditee Dashboard
THEN he sees:
  - His open CAPs with deadlines
  - Overdue items
  - Evidence submitted awaiting verification
  - Completed CAPs
  - Recently approved / rejected items
```

---

## 5. User stories — CPE and recommendation tracking

### 5.1 US-DASH-008 — Per-auditor CPE dashboard

Per `qa-independence-cpe.md §3.2`. Traffic-light graduated compliance per requirement.

### 5.2 US-DASH-009 — CAE team CPE view

```gherkin
WHEN Marcus opens CPE Compliance (team view)
THEN he sees:
  - Team members with GREEN / YELLOW / RED status
  - Per-requirement breakdown
  - Forecasted compliance at end of cycle
  - Risk flags (auditors trending RED)
```

### 5.3 US-DASH-010 — Recommendation tracker

```gherkin
WHEN Marcus opens Recommendation Tracker
THEN he sees:
  - All recommendations across his engagements
  - Linked findings and CAPs
  - Status: Draft / Finalised / Published / Resolved
  - By presentation mode (inline / separate / suppressed)
  - Historical: resolution rate
```

---

## 6. User stories — Risk heat map

### 6.1 US-DASH-011 — Marcus views risk heat map

```gherkin
WHEN Marcus opens Audit Universe → Risk Heat Map
THEN he sees:
  - Matrix: entity × risk rating
  - Color-coded by residual risk (High red, Medium yellow, Low green)
  - Coverage overlay: entities audited in last N years
  - Gaps highlighted (high risk + not audited recently)
  - Used for annual planning (integrates with `audit-planning.md`)
```

---

## 7. User stories — Global search

### 7.1 US-DASH-012 — Priya searches globally

```gherkin
GIVEN Priya wants to find a prior-year finding about grant classification
WHEN she types "grant classification" in global search
  AND optionally filters by: entity type (Finding / Engagement / Work Paper), date range, status
THEN results appear with:
  - Relevance-ranked matches
  - Entity type + context
  - Click-through to full entity
  - Typeahead suggestions
```

**Acceptance criteria**:
- Tenant-scoped (never cross-tenant)
- Searches indexable fields: titles, descriptions, classifications, tags, comments, finding elements, CAP rationale
- Results paginated
- p99 < 2s with 10K+ findings per tenant

### 7.2 US-DASH-013 — Saved searches (MVP 1.5)

```gherkin
GIVEN Priya repeatedly searches for "Material Weakness findings in FY27"
WHEN she clicks "Save Search"
  AND names it "FY27 Material Weaknesses"
THEN saved in her account
  AND accessible from sidebar
  AND can be shared with team (optional)
```

---

## 8. User stories — Bulk operations

### 8.1 US-DASH-014 — Priya bulk-tags findings

```gherkin
GIVEN Priya wants to tag 15 findings with "Federal-Program-Review"
WHEN she selects the 15 in the Findings list (shift-click or checkboxes)
  AND chooses Bulk Actions → Add Tag
  AND enters tag
  AND sees confirmation modal with:
    "You are about to modify 15 findings.
     This will fire 15 webhook events to configured consumers
     and send notifications to 3 users (AICs of affected engagements).
     
     Proceed?   [Cancel]  [Confirm and Commit]"
  AND she clicks Confirm and Commit
THEN all 15 updated in single operation
  AND webhooks fire for all 15 (via transactional outbox per ADR-0004)
  AND notifications delivered
  AND audit log captures bulk action with entity count + actor
  AND change is PERMANENT — no undo
```

**Acceptance criteria**:
- Bulk actions: assign, tag, classify, status change, delete
- **Strong confirmation modal required** — explicitly states the side-effect scope (# entities modified, # webhooks that will fire, # users who will be notified)
- **NO undo mechanism** — bulk operations commit permanently
- Audit log captures entity count + actor + action + timestamp
- Permissions enforced per entity (can't bulk edit entities you can't edit)

**Why no undo**: the transactional outbox pattern per ADR-0004 means every change fires webhooks + notifications immediately upon commit. A "30-second undo" would either:
(a) Require adding 30s latency to the entire outbox dispatcher (which would slow every platform event, not just bulk ops), breaking real-time integrations — unacceptable
(b) Fire a second wave of "never mind" correction webhooks, annoying downstream systems and creating race conditions in customer integrations — also unacceptable

Strong upfront confirmation is the right mitigation. Tell the user exactly what will happen; make them acknowledge; then commit permanently. For the rare "I really meant to undo" case, the user re-applies the inverse operation (tag removal, status revert), which is just another audit-logged action. This is honest architecture rather than a false-hope undo button.

### 8.2 US-DASH-015 — Bulk ops for CAPs (MVP 1.5)

Similar pattern for CAPs. MVP 1.5 adds this.

---

## 9. User stories — Cross-tenant search (platform admin)

### 9.1 US-DASH-016 — Ravi searches across tenants (support mode)

```gherkin
GIVEN Ravi is investigating a support issue
  AND he opens scoped support session per ADR-0002 + ADR-0005
  AND the session is time-bounded + logged
WHEN Ravi searches across all tenants
  AND filters by: issue type, affected feature, date
THEN results aggregated
  AND session all logged
  AND expiry countdown visible
```

---

## 10. Edge cases

### 10.1 Very large result sets

Search limited to 1000 results; refine filters for larger sets.

### 10.2 Slow search

If indexing falls behind, search may lag real-time. In-app indicator of index lag.

### 10.3 Deleted entities in results

Soft-deleted entities appear with "(Archived)" indicator; filter to exclude available.

### 10.4 Dashboard load performance

For large tenants (500+ engagements), server-side aggregation + caching.

---

## 11. Data model

- `Dashboard` — per-user configuration (widget layout, filters)
- `SavedSearch` — per-user (MVP 1.5)
- `SearchIndex` — server-side index (could be DB or dedicated search if scaled)
- `BulkOperationLog` — audit trail for bulk actions

---

## 12. API endpoints

```typescript
dashboard.getUserHome(input: {}): HomeDashboard
dashboard.getFindingAging(input: {filters}): Aging
dashboard.getCAPCompliance(input: {filters}): CAPCompliance
dashboard.getRiskHeatMap(input: {}): HeatMap
dashboard.getPlanVsActual(input: {fiscalYear}): PlanProgress
dashboard.getCPEDashboard(input: {scope: 'self'|'team'}): CPEDashboard

search.global(input: {query, filters, pagination}): SearchResults
search.typeahead(input: {query}): Suggestions
search.saveSearch(input: SavedSearchInput): SavedSearch  // MVP 1.5

bulk.update(input: {entityType, entityIds, operation}): BulkResult
```

---

## 13. Permissions

| Role | Home dashboard | Portfolio dashboards | Finding aging | CAP compliance | Global search | Bulk ops | Cross-tenant search |
|---|---|---|---|---|---|---|---|
| Priya (AIC) | ✅ (AIC view) | ❌ | ✅ (her engagements) | ✅ | ✅ | ✅ | ❌ |
| Marcus (CAE) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Elena | ✅ (Partner view) | ✅ (firm view) | ✅ | ✅ | ✅ | ✅ | ❌ |
| David (Auditee) | ✅ (auditee view) | ❌ | ❌ | ✅ (his CAPs) | ❌ | ❌ | ❌ |
| Ravi (Platform Admin) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (support mode) |

---

## 14. Observability

- `dashboard.load.duration` (per dashboard)
- `search.query.count` / `.duration`
- `bulk.operation.count` (by type)
- `cross_tenant.search.count` (platform admin investigations)

---

## 15. Performance

- Home dashboard p99 < 800ms
- Portfolio dashboards p99 < 1.5s (with 50 engagements)
- Global search p99 < 2s (with 10k entities per tenant)
- Bulk update of 100 entities p99 < 3s

---

## 16. Compliance

- All data access via RLS + app-layer tenant filter per ADR-0002
- Cross-tenant search logged per ADR-0005 platform admin scoping
- Bulk operations audited

---

## 17. Dependencies

- Engagement management (engagements to aggregate)
- All other modules (source of dashboard data)
- Audit trail (bulk operation logging)

---

## 18. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 16
- [`docs/06-design-decisions.md §7.7`](../../docs/06-design-decisions.md) — negative architecture on custom BI
- [`features/integrations-and-api.md`](integrations-and-api.md) — warehouse export for custom BI

---

## 19. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§8.1 US-DASH-014 — bulk operation undo removed**: reviewer correctly pointed out that the 30-second undo conflicts with the transactional outbox architecture (ADR-0004). Bulk-updating 15 findings immediately fires 15 webhook events + notifications; a "cancel" would either require 30s delay on the entire outbox (breaking real-time integrations) or emit correction webhooks (annoying downstream systems). Fix: dropped the undo mechanism. Replaced with strong upfront confirmation modal that explicitly names side-effect scope (# entities, # webhooks, # notifications) and requires acknowledgment before commit. Commit is permanent; inverse operation required for "undo."

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
