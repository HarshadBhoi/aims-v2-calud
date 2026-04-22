# Audit Planning — Universe + Annual Plan

> The strategic layer above engagement management. Audit universe (the catalogue of auditable entities with risk scoring and cycle tracking), annual plan authoring and approval, and plan-vs-actual dashboard tracking. Where Marcus and Kalpana decide what gets audited each year, how engagements chain to the strategic plan, and how the audit function reports its coverage to governance.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 3
**Primary personas**: Marcus (CAE), Kalpana (Audit Function Director)
**MVP phase**: 1.0 (most features); multi-year cycle tracking → v2.1; risk-based optimisation → v2.2+

---

## 1. Feature overview

The audit universe and annual plan together form the strategic layer of the audit function:

- **Audit universe** — the inventory of auditable entities (processes, programs, departments, systems, risk areas) the function might examine; scored by risk; tracked across multi-year cycles
- **Annual audit plan** — the subset of universe entities selected for audit in a given fiscal year, with estimated hours, assigned leads, and governance approval
- **Plan-to-engagement linkage** — plan items flow into engagement creation, maintaining traceability
- **Plan vs. actual tracking** — mid-year and year-end dashboards showing progress against plan

This spec covers all of the above as one coherent feature area because they're strategically entangled — the universe feeds the plan; the plan drives engagements; engagements refresh the universe's risk ratings; the cycle continues.

### 1.1 Why Marcus and Kalpana are the primary personas

AICs (Priya) execute engagements; CAEs and Audit Function Directors set strategy. Audit universe and annual plan are strategy-layer artifacts. An AIC rarely touches them directly except to reference the plan item their engagement traces to.

---

## 2. User stories — Audit universe

### 2.1 US-AP-001 — Marcus authors the audit universe

```gherkin
GIVEN Marcus is CAE for Oakfield's audit function
  AND no universe exists yet (first year setup)
WHEN Marcus opens Audit Universe → Create
  AND adds entities:
    - "Federal Grants Administration" (type: Program, risk: High)
    - "Student Financial Aid" (type: Program, risk: Medium)
    - "General Ledger Close" (type: Process, risk: Medium)
    - "IT General Controls" (type: System, risk: High)
    - "HR Payroll" (type: Process, risk: Low)
    - ... (typically 30-80 entities at this tier of organization)
  AND for each entity, specifies:
    - Name, type, description
    - Inherent risk rating (High / Medium / Low, or numeric 1-10)
    - Control rating (strong / moderate / weak)
    - Residual risk (auto-calculated: inherent × control inverse)
    - Last audited (date or "never")
    - Next-audit priority date
    - Budget envelope (estimated hours for future audit)
    - Responsible department / executive
THEN universe is saved
  AND visible in Audit Universe dashboard
  AND ready to feed annual planning
```

**Acceptance criteria**:
- Entity types: Process, Program, Department, System, Risk Area, Compliance Domain, Vendor
- Risk scoring methodology configurable per tenant (qualitative 3-tier, 5-tier, or numeric 1-10)
- Residual risk auto-calculated from inherent × control
- Each entity maintains change history (inherent risk changes tracked with date + reason)
- Bulk import supported (CSV upload for initial setup)

### 2.2 US-AP-002 — Kalpana updates entity risk ratings after quarterly review

```gherkin
GIVEN Q2 risk assessment completed
  AND IT General Controls risk has increased due to recent incidents
WHEN Kalpana updates:
  - IT General Controls inherent risk: High → Critical
  - Reason: "Q2 2027 incident analysis: 3 material IT control failures"
  - Next audit priority advanced from Q4 2028 to Q1 2028
  AND saves
THEN change is logged with date, person, reason
  AND annual plan flags affected (plan may need rebalancing)
  AND dashboard shows risk trending
```

**Acceptance criteria**:
- Risk updates require documented reason
- Change history visible (who, when, what, why)
- Impact on annual plan surfaced if entity is on current plan

### 2.3 US-AP-003 — Universe filtered by cycle coverage

```gherkin
GIVEN Marcus wants to ensure 3-year coverage
WHEN he filters universe by "not audited in 2+ years"
THEN entities due for audit surface, sorted by risk × last-audited-age
```

**Acceptance criteria**:
- Filter by: last-audited date, risk rating, audit-due date, cycle coverage
- Default views: "High risk not audited recently", "Due this year", "Due next year"
- Visualisation: risk heat map (entity × risk × coverage gap)

### 2.4 US-AP-004 — Multi-year audit cycle tracking (deferred to v2.1)

```gherkin
GIVEN Marcus wants to see 5-year coverage pattern
WHEN he opens Multi-Year Cycle View
THEN grid displays entities × years with audit history
  AND gaps surfaced (entities not audited in cycle)
  AND planned vs. actual cycle coverage
```

**Status**: v2.1 — noted in [`03-feature-inventory.md`](../03-feature-inventory.md) Module 3. MVP 1.0 handles single-year plan + universe; multi-year cycle viz deferred.

---

## 3. User stories — Annual plan authoring

### 3.1 US-AP-005 — Kalpana drafts the annual audit plan

```gherkin
GIVEN universe is populated
  AND Kalpana is drafting FY28 annual plan
WHEN she opens Annual Plan → Create
  AND the system suggests initial selection based on:
    - Highest-risk entities not audited in cycle
    - Previously scheduled entities due this year
    - Regulatory-mandated audits (annual Single Audit, annual SOC 2)
    - Continuation from prior year's plan
  AND she reviews suggestions:
    - Accepts Federal Grants Administration (mandatory Single Audit)
    - Accepts IT General Controls (high risk)
    - Accepts Student Financial Aid (due cycle)
    - Adds Research Grant Compliance (new area)
    - Defers HR Payroll (low risk, adequately covered by management)
    - ... (typically 10-40 engagements per plan)
  AND assigns AIC + estimated hours per engagement
THEN plan draft saved
  AND total estimated hours calculated (budget check)
```

**Acceptance criteria**:
- Initial suggestion algorithm uses risk × cycle × regulatory mandates
- AIC assignment with capacity awareness (existing workload considered)
- Hour estimates editable; sums visible at plan level
- Plan status: DRAFT, IN_REVIEW, APPROVED, IN_EXECUTION

### 3.2 US-AP-006 — Kalpana adjusts plan based on blended capacity estimate

```gherkin
GIVEN draft plan requires 8,500 hours
  AND Kalpana's team of 7 auditors has blended capacity 7,000 billable hours/year (based on team size × standard billable hours/FTE)
WHEN the capacity check flags overcommitment (8,500 > 7,000)
THEN Kalpana can:
  - Reduce scope on specific engagements
  - Defer lower-priority engagements to next year
  - Propose adding contractor capacity (documented + board-approved)
  - Accept the overage with explanation
```

**Acceptance criteria**:

AIMS is not the source of truth for HR data. Auditors don't diligently log PTO, CPE time off, or training in AIMS; that data lives in the firm's HR / PTO tracking system (BambooHR, Workday, ADP, etc.). MVP 1.0 uses a simplified blended estimate:

- **MVP 1.0 capacity formula**: `Total Headcount × Standard Billable Hours per FTE per Year`
  - Standard billable hours per FTE: tenant-configurable (default 1,600/year for government auditors; 1,800/year for CPA firms; based on industry norms)
  - Total Headcount sourced from staff directory (Module 12)
  - Result: a blended annual capacity number at the function or bureau level
- **Comparison**: draft plan's total estimated hours vs. blended capacity
- **Visualization**: simple green (under 90% capacity) / yellow (90-105%) / red (over 105%) indicator
- **Deferred engagements** tracked for next year's planning
- **Per-auditor utilization view**: shows each auditor's committed vs. available hours (based on assigned engagements' estimated hours) — but still doesn't subtract PTO/training (that's HR data)

**Deferred to v2+**: precise capacity integration with HR system calendar (Workday, BambooHR, Microsoft Outlook calendar) for per-auditor PTO/training awareness. If a customer requires precise capacity planning with calendar integration, they can use their HR system's capacity features + manually adjust AIMS estimates. This is an explicit MVP simplification; Kalpana-type users can live with the blended approximation.

### 3.3 US-AP-007 — Kalpana submits plan for approval

```gherkin
GIVEN plan draft is complete
WHEN Kalpana clicks Submit for Approval
THEN plan transitions DRAFT → IN_REVIEW
  AND approval chain per `rules/approval-chain-rules.md §2.1` fires:
    1. Kalpana (author)
    2. CAE (Marcus)
    3. Audit Committee Chair
    4. Audit Committee formal approval
  AND each approver notified in sequence
```

**Acceptance criteria**:
- Approval chain respects pack requirements (IIA GIAS Principle 8 mandates Audit Committee approval)
- Plan locked during review (no edits)
- Reviewers can comment per engagement or plan-wide

### 3.4 US-AP-008 — Audit Committee formally approves plan

```gherkin
GIVEN plan reaches Audit Committee review stage
  AND committee meets and deliberates
WHEN committee votes approval (formal minutes capture)
  AND Chair marks approval in AIMS
THEN plan transitions IN_REVIEW → APPROVED
  AND engagement creation is unlocked for planned items
  AND plan is published to function (all auditors notified)
  AND audit trail captures formal approval
```

**Acceptance criteria**:
- Committee approval is distinct from individual approvals (reflects formal governance)
- Minutes / meeting reference optional but encouraged
- Post-approval, plan changes require formal amendment (not silent edits)

### 3.5 US-AP-009 — Plan amendment mid-year

```gherkin
GIVEN plan is APPROVED and executing
  AND emerging risk requires adding an unplanned audit
WHEN Kalpana initiates Plan Amendment
  AND adds "Cybersecurity Incident Response Audit"
  AND documents rationale
  AND CAE approves amendment
  AND Audit Committee ratifies (may be at next scheduled meeting)
THEN plan amended
  AND audit trail captures both original plan and amendment
  AND new engagement can be created
```

**Acceptance criteria**:
- Amendments preserve original plan (bitemporal)
- CAE approval required; Audit Committee ratification at next meeting (not blocking)
- Amendment history visible

---

## 4. User stories — Plan-to-engagement linkage

### 4.1 US-AP-010 — Engagement creation references plan item

```gherkin
GIVEN plan item "FY28 Federal Grants Administration" is APPROVED
WHEN Priya creates an engagement for it per `engagement-management.md §2.1`
  AND selects "Link to Plan Item" during creation
THEN engagement's metadata includes planItemId
  AND plan dashboard shows this plan item as "In Engagement"
  AND budget allocated in plan flows to engagement default budget
```

**Acceptance criteria**:
- Optional linkage (not every engagement traces to a plan item — emergency / ad hoc engagements)
- Plan dashboard visibility of linked engagements
- Budget inheritance default (user can override)

### 4.2 US-AP-011 — Un-planned engagement flagged

```gherkin
GIVEN Priya creates an emergency engagement (not in plan)
  AND does not link to a plan item
THEN engagement is tagged "Unplanned"
  AND surfaces on Marcus's dashboard for visibility
  AND tracked for plan-vs-actual variance analysis
```

---

## 5. User stories — Plan-vs-actual dashboard

### 5.1 US-AP-012 — Marcus views plan progress mid-year

```gherkin
GIVEN it's Q3 of FY28
  AND plan has 28 engagements
WHEN Marcus opens Plan vs. Actual dashboard
THEN he sees:
  - 15 engagements in ISSUED state (54% complete)
  - 8 engagements in FIELDWORK (28% in progress)
  - 3 engagements in PLANNING (11%)
  - 2 engagements deferred to FY29 (7% slipped)
  - Total hours budget: 6,200; actual: 4,100 (66%)
  - Variance flags: 2 engagements > 25% over budget
```

**Acceptance criteria**:
- Real-time status aggregation
- Drill-down to individual engagements
- Exportable for board reporting (PDF, Excel)

### 5.2 US-AP-013 — Annual review against plan

```gherkin
GIVEN FY28 closes
WHEN Marcus produces year-end plan execution report
THEN report includes:
  - Plan achievement: 24 of 28 engagements completed (86%)
  - Deferred: 4 engagements (reasons documented)
  - Hours variance: -3% (within tolerance)
  - Major findings by plan area
  - Coverage gaps for next year's planning
```

**Acceptance criteria**:
- Report auto-generated from engagement data
- Integrates with Annual Summary Report (per `report-generation.md §4.4`)
- Board-distribution-ready

---

## 6. Edge cases

### 6.1 Universe entity deleted after referenced by plan

Historical integrity preserved. Deletion soft-marks; plan references remain valid historically.

### 6.2 Regulatory change mandates additional audit

Mandatory audits can be added via amendment without full Audit Committee approval cycle (CAE approval + emergency ratification).

### 6.3 Capacity unexpectedly dropped (auditor departure)

Plan must be amended; deferred engagements rescheduled; board notification.

### 6.4 Risk rating update mid-year

Changes flow to suggestions for next year's plan; don't auto-alter current-year plan.

---

## 7. Data model touch points

- `AuditUniverseEntity` — entity with risk ratings, history
- `AnnualPlan` — yearly plan with items
- `PlanItem` — individual plan entry (potential engagement)
- `PlanAmendment` — formal amendments
- `EngagementPlanLink` — M:N linkage between engagements and plan items

---

## 8. API endpoints

### 8.1 tRPC procedures

```typescript
auditUniverse.list(input: {filter?}): UniverseEntity[]
auditUniverse.create(input: EntityInput): UniverseEntity
auditUniverse.update(input: EntityUpdateInput): UniverseEntity
auditUniverse.updateRisk(input: {entityId, newRisk, reason}): UniverseEntity

annualPlan.create(input: {fiscalYear}): AnnualPlan
annualPlan.addItem(input: {planId, item}): PlanItem
annualPlan.submit(input: {planId}): AnnualPlan
annualPlan.approve(input: {planId, approvalContext}): AnnualPlan
annualPlan.amend(input: AmendInput): AnnualPlan

planProgress.get(input: {planId}): PlanProgress
planProgress.yearEndReport(input: {fiscalYear}): Report
```

### 8.2 Webhook events

- `auditUniverse.entity.created`
- `auditUniverse.risk.updated`
- `annualPlan.submitted`
- `annualPlan.approved`
- `annualPlan.amended`
- `engagement.plan.linked`

---

## 9. Permissions

| Role | View universe | Edit universe | Draft plan | Approve plan | Amend plan |
|---|---|---|---|---|---|
| Priya (AIC) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Marcus (CAE) | ✅ | ✅ | ✅ | ✅ (first approval) | ✅ (initiate) |
| Kalpana (Director) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit Committee | ✅ | ❌ | ❌ | ✅ (formal vote) | ✅ (ratify) |

---

## 10. Observability

- `auditUniverse.entity.count` (gauge per tenant)
- `annualPlan.progress.percent` (gauge per plan)
- `plan.variance.hours` (gauge, +/- from plan)
- `plan.amendments.count` (counter per fiscal year)

---

## 11. Performance

- Universe list p99 < 1s (with 200+ entities)
- Plan draft load p99 < 2s
- Plan progress aggregation p99 < 3s

---

## 12. Compliance

- **IIA GIAS Principle 8**: risk-based annual plan — satisfied
- **GAGAS §5.15**: plan approval by governance — satisfied via Audit Committee workflow
- **Peer review evidence**: approval trail + execution tracking exportable

---

## 13. Dependencies

- Engagement management (Module 4) — plan items become engagements
- Reports (Module 10) — Annual Summary references plan achievement
- Dashboards (Module 16) — plan progress surfaces

---

## 14. UX references

Detailed UX in [`ux/audit-universe.md`](../ux/audit-universe.md) and [`ux/annual-plan.md`](../ux/annual-plan.md) (Phase 6 pending).

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 3
- [`rules/approval-chain-rules.md §9`](../rules/approval-chain-rules.md) — annual plan approval
- [`features/engagement-management.md`](engagement-management.md) — plan-to-engagement linkage
- [`features/report-generation.md §4.4`](report-generation.md) — Annual Summary Report integration

---

## 16. Domain review notes — Round 1 (April 2026)

External review (Google Gemini, VP of Product in GRC/Audit SaaS) flagged one refinement:

- **§3.2 US-AP-006 — capacity-check simplification**: reviewer correctly flagged the "PTO / training / CPE time excluded" capacity formula as requiring HR data integration (Workday, BambooHR, etc.) that AIMS doesn't and shouldn't have in MVP 1.0. Fix: replaced with blended `Headcount × Standard Billable Hours per FTE` formula. Precise calendar integration deferred to v2+.

Phase 4 Part 2 overall verdict: **Approved. "This specification set is phenomenal. It bridges the gap between the compliance requirements of audit and the technical realities of modern B2B SaaS."**

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
