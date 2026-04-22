# QA, Independence, and CPE

> The professional-responsibility infrastructure. Independence declarations (annual + per-engagement + impairment disclosure), CPE tracking with graduated compliance (GREEN/YELLOW/RED), and QA program (checklist, peer review, QAIP). Combines modules 11 (QA) + 12 (Staff/Time/CPE) because they're operationally intertwined — CPE compliance gates engagement assignments, independence is checked at assignment, QA reviews the whole thing.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Modules 11 + 12
**Primary personas**: Priya (AIC, primary user), Anjali (Staff), Marcus (CAE), Kalpana (QA oversight)
**MVP phase**: 1.0 for independence declarations + CPE tracking; full QA program → 1.5 (per `04-mvp-scope.md §2.2 Module 11`)

---

## 1. Feature overview

Three intertwined feature areas:

1. **Independence** — per `rules/independence-rules.md`. Annual declaration + per-engagement declaration + impairment disclosure + declaration workflow. Load-bearing for professional responsibility.
2. **CPE tracking** — per `rules/cpe-rules.md`. Course submission, category allocation, compliance dashboard, graduated GREEN/YELLOW/RED check at engagement assignment, evidence export for peer review.
3. **QA program** — QA checklists per GAGAS + IIA, peer review management, QAIP, independent QA reviewer workflow. Mostly deferred to MVP 1.5.

### 1.1 MVP 1.0 vs. 1.5 scope

- **MVP 1.0**: Independence declarations (annual + per-engagement + impairment), CPE tracking, CPE compliance dashboard, graduated engagement-assignment check, staff directory, time tracking. 4 of 10 QA features (independence and related only).
- **MVP 1.5**: Full QA checklist execution (60+ items GAGAS), peer review management, QAIP (IIA Standard 15), peer review evidence bundle export, QA dashboard.

---

## 2. User stories — Independence

### 2.1 US-QA-001 — Priya completes annual independence declaration

```gherkin
GIVEN Priya's annual declaration anniversary approaches
  AND her tenant has annual affirmation policy (IIA GIAS Principle 11.2)
WHEN AIMS sends reminder
  AND Priya opens Annual Independence Declaration
  AND reviews:
    - Personal financial interests
    - Family relationships with auditees
    - Prior employment (last 2 years)
    - Non-audit services to current clients (via negative assurance per `rules/independence-rules.md §7`)
    - Outside business interests
  AND attests (checkbox + typed name)
  AND submits
THEN declaration recorded
  AND visible in Priya's profile
  AND attached to all her current engagement assignments
  AND Kalpana reviews (CAE or delegate)
```

**Acceptance criteria**:
- Annual cadence automatic; reminders at 60/30/7 days
- Reviewer approval required (Audit Function Director or CAE)
- Historical declarations preserved (bitemporal)

### 2.2 US-QA-002 — Per-engagement independence declaration

```gherkin
GIVEN Priya is assigned to Oakfield FY27
WHEN engagement is in PLANNING phase
THEN system prompts Priya to declare for this specific engagement:
  - Auditee-specific threats (personal relationships, prior engagement)
  - Federal employment history (if Single Audit)
  - Any new threats since annual declaration
WHEN Priya submits
THEN declaration attached to engagement
  AND AIC review required
  AND if any threat disclosed: impairment workflow fires
```

### 2.3 US-QA-003 — Impairment disclosure workflow

```gherkin
GIVEN Priya discloses potential impairment (she previously worked at Oakfield's finance office)
WHEN disclosure saved
THEN impairment workflow fires:
  - AIC (Priya in this case) notes; if independent AIC exists, they take over
  - CAE + Independence Officer review
  - Per `rules/independence-rules.md §4.4` state machine:
    DISCLOSED → EVALUATING → MITIGATED / SIGNIFICANT / REASSIGNED / ENGAGEMENT_DECLINED
  - Documented mitigation if possible
  - Or reassignment if not
```

**Acceptance criteria**:
- Threshold: ANY_IDENTIFIED impairment disclosable (per strictness resolver §3.11)
- Resolution options tracked
- Audit log for each decision

### 2.4 US-QA-004 — Annual Audit Committee communication

```gherkin
GIVEN Audit Committee meeting approaching
WHEN Kalpana generates Independence Communication
THEN report aggregates:
  - All annual declarations for past year
  - Impairments identified + resolutions
  - Non-audit services tracking summary
  - Firm-wide independence status
```

---

## 3. User stories — CPE tracking

### 3.1 US-QA-005 — Priya enters completed CPE course

```gherkin
GIVEN Priya attended "Federal Grants Audit Procedures" (8 hours, IIA-recognised)
WHEN she opens CPE → Add Course
  AND enters:
    - Course title, provider, date
    - Hours: 8
    - Category allocation:
      - GAGAS governmental: 8 hours
      - IIA general: 8 hours
    - Attaches certificate (PDF)
  AND submits
THEN course captured
  AND allocated to applicable requirements per `rules/cpe-rules.md §3.2`
  AND dashboard updates
```

### 3.2 US-QA-006 — Priya views her CPE dashboard

Per `rules/cpe-rules.md §3.1`:

```
Priya's CPE Compliance — Year 1 of 2027-2028 cycle

  GAGAS cycle 2027-2028           ████████░░ 42/80 hours
    Governmental topics                      ██░░░ 12/24
    Ethics                                   █░░░░ 2/2 ✓
    
  IIA CIA 2027                    ███░░░░░░░ 28/40 hours
    Ethics                                   █░░░░ 2/2 ✓
    
  NY CPA 2027                     ██░░░░░░░░ 18/40 hours
    Ethics                                   █░░░░ 2/4 🔶 Need 2 more
```

### 3.3 US-QA-007 — Graduated engagement-assignment CPE check

Per `rules/cpe-rules.md §4.2`:

```gherkin
GIVEN Marcus is assigning Anjali to Oakfield FY27
WHEN assignment check runs
THEN result: 🟡 YELLOW (4 ethics hours short; catchable)
  AND Marcus offered "Assign with condition"
  AND creates EngagementAssignmentCondition:
    - "Anjali must complete 4 ethics CPE hours before fieldwork begins"
    - Deadline: Fieldwork start date
  AND Anjali notified
  AND condition auto-tracked as CPE is logged
```

### 3.4 US-QA-008 — CPE evidence for peer review (MVP 1.5)

For peer review, AIMS exports:
- Per-auditor CPE records for review period
- Certificates
- Aggregate compliance per requirement per cycle
- Formatted per peer review protocol

---

## 4. User stories — Staff directory

### 4.1 US-QA-009 — Marcus views staff directory

```gherkin
WHEN Marcus opens Staff Directory
THEN he sees team members with:
  - Name, role, certifications (CPA, CIA, CISA)
  - Current engagement assignments
  - CPE compliance status (GREEN/YELLOW/RED per requirement)
  - Independence status
  - Contact info
```

### 4.2 US-QA-010 — Marcus sees capacity forecast

```gherkin
WHEN Marcus opens Capacity Forecast
THEN he sees:
  - Per-auditor hours utilisation (current + projected)
  - Availability for new engagements
  - Hour-based forecasts based on annual plan (integrates with `features/audit-planning.md`)
```

---

## 5. User stories — Time tracking

### 5.1 US-QA-011 — Anjali logs time

```gherkin
WHEN Anjali submits weekly time entries
  AND allocates hours per engagement + phase + task type
THEN entries saved
  AND submitted to AIC for approval
  AND budget variance calculated (vs. engagement's budget per `engagement-management.md §2.3`)
```

### 5.2 US-QA-012 — Priya approves time entries

```gherkin
WHEN Priya reviews Anjali's time
  AND approves
THEN entries accepted
  AND billable hours aggregated
  AND variance visible
```

---

## 6. User stories — QA program (MVP 1.5)

### 6.1 US-QA-013 — Kalpana executes QA checklist on completed engagement

```gherkin
GIVEN Oakfield FY27 is ISSUED
WHEN Kalpana opens QA → New Review
  AND selects engagement + QA checklist template (60+ items per GAGAS)
  AND walks through each item:
    - "Were independence declarations completed per §3.26?" ✓
    - "Was APM approved before fieldwork?" ✓
    - "Did supervisor sign off on all material work papers?" ✓
    - ... (60 items)
  AND documents findings for any non-compliance
  AND completes review
THEN QA review recorded
  AND findings drive QAIP tracking
  AND dashboard updates
```

**Status**: MVP 1.5 — not in 1.0 scope.

### 6.2 US-QA-014 — Peer review evidence bundle

MVP 1.5. Generates formal evidence package for triennial peer review per GAGAS §5.60.

---

## 7. Edge cases

### 7.1 Auditor changes certifications

New certification triggers new CPE tracking.

### 7.2 Auditor becomes non-compliant post-assignment

Mid-engagement compliance drop: CAE notified; condition recorded.

### 7.3 Retroactive CPE completion

Auditor claims 20 hours from 3 months ago; normal tracking handles.

### 7.4 Multi-certification overlap

Per `rules/cpe-rules.md §3.2` union resolution; single course counts toward multiple requirements.

---

## 8. Data model

- `IndependenceDeclaration` — annual + per-engagement
- `IndependenceImpairment` — disclosure + resolution
- `CPECycle` — per-auditor per-requirement per-cycle
- `CPECourse` — completed courses
- `EngagementAssignmentCondition` — per `cpe-rules.md §4.2.4`
- `StaffMember` — directory entity
- `TimeEntry` — per-week per-auditor per-engagement
- `QAReview` — MVP 1.5

---

## 9. API endpoints

```typescript
// Independence
independence.submitAnnual(input: DeclarationInput): Declaration
independence.submitPerEngagement(input: EngagementDeclarationInput): Declaration
independence.discloseImpairment(input: ImpairmentInput): Impairment
independence.resolveImpairment(input: ResolutionInput): Impairment

// CPE
cpe.submitCourse(input: CourseInput): CPECourse
cpe.getDashboard(input: {userId}): CPEDashboard
cpe.getComplianceStatus(input: {userId}): ComplianceStatus
cpe.exportPeerReviewBundle(input: {period}): Bundle  // MVP 1.5

// Staff + Time
staff.getDirectory(input: {}): StaffMember[]
staff.updateProfile(input: ProfileInput): StaffMember
time.submit(input: TimeEntryInput): TimeEntry
time.approve(input: ApprovalInput): TimeEntry

// QA (MVP 1.5)
qa.createReview(input: {engagementId}): QAReview
qa.completeChecklist(input: ChecklistInput): QAReview
```

---

## 10. Permissions

| Role | Submit own decl. | Review decl. | Submit own CPE | View team CPE | QA review |
|---|---|---|---|---|---|
| Staff (Anjali) | ✅ | ❌ | ✅ | ❌ | ❌ |
| AIC (Priya) | ✅ | ⚠️ (team) | ✅ | ✅ (team) | ❌ |
| CAE (Marcus) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Director (Kalpana) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 11. Observability

- `independence.declaration.count`
- `independence.impairment.count`
- `cpe.course.submitted.count`
- `cpe.compliance.rate` (per requirement)
- `cpe.yellow.assignments.count`
- `cpe.red.overrides.count`
- `time.submitted.hours.gauge`

---

## 12. Performance

- CPE dashboard load p99 < 1s
- Course submission p99 < 500ms
- Staff directory p99 < 1s

---

## 13. Compliance

- GAGAS §3.26 independence + §4.26 CPE
- IIA GIAS Principle 11 independence + CIA CPE
- PCAOB AS 1005 + Rule 3500T
- AICPA ET 1.200 + state CPE requirements
- ISO 19011 §7.3 competency

---

## 14. Dependencies

- Strictness resolver (union for CPE, max for independence)
- Independence rules (full detail in `rules/independence-rules.md`)
- CPE rules (full detail in `rules/cpe-rules.md`)
- Engagement assignment (CPE check gates)
- Dashboard module (compliance visualisation)

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Modules 11 + 12
- [`rules/independence-rules.md`](../rules/independence-rules.md)
- [`rules/cpe-rules.md`](../rules/cpe-rules.md)
- [`features/engagement-management.md`](engagement-management.md) — CPE-gated assignments

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged no specific changes for this file. The combined QA + Independence + CPE spec satisfied the reviewer's test for real-world audit workflow coverage.

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
