# Platform Administration and Board Reporting

> Two complementary feature areas combined into one spec. Platform administration is Ravi's internal operations tooling — tenant management, scoped support-mode access, incident response, break-glass flows, platform-level pack publishing. Board reporting is the CAE-level output for Audit Committee and governance — basic dashboard (MVP 1.0) with presentation pack + AC communication log deferred to MVP 1.5.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Modules 13 (Board Reporting) + 18 (Platform Admin)
**Primary personas**: Ravi (Platform Admin, internal); Marcus (CAE for Board Reporting)
**MVP phase**: 1.0 for core tooling + basic board dashboard; SQS inspector, regional silo automation, board presentation pack, AC communication log → various future phases

---

## 1. Feature overview

**Platform admin (Module 18)** is AIMS's internal operations tooling — what Ravi uses to support customers, respond to incidents, and keep the platform running. Not sold; not customer-facing. Covers:

- Tenant admin console (cross-tenant support context)
- Scoped support-mode access (time-bounded, audit-logged per ADR-0005)
- Regional silo provisioning automation (v2.2+)
- Incident response console
- SQS inspector internal tool (MVP 1.5)
- Break-glass access flow
- Platform-level pack publishing

**Board reporting (Module 13)** is the CAE's output for the Audit Committee — aggregate view of audit function's execution. Mostly overlaps with Annual Summary Report (covered in `report-generation.md §4.4`). MVP 1.0 ships basic dashboard; presentation pack export + Audit Committee communication log deferred to 1.5.

These are combined because both are "operational infrastructure" rather than core audit workflows.

---

## 2. User stories — Platform admin

### 2.1 US-PA-001 — Ravi opens tenant admin console

```gherkin
GIVEN Ravi is investigating a customer-reported issue
WHEN Ravi opens Platform Admin Console
THEN he sees:
  - List of tenants with search/filter
  - Per-tenant quick stats: users, storage, subscription, health
  - Quick actions: enter support mode, view billing, check SSO
```

**Acceptance criteria**:
- Platform admin console is distinct from customer-facing UI
- MFA required for Ravi
- Every view recorded with tenant + timestamp for compliance

### 2.2 US-PA-002 — Ravi opens scoped support-mode session

```gherkin
GIVEN Ravi needs to investigate Tenant A's issue
WHEN Ravi opens Tenant → Enter Support Mode
  AND provides:
    - Support ticket reference
    - Scope: read-only or read-write
    - Duration: 1 hour (max 4 hours)
    - Rationale: "Ticket #123 - customer reports incorrect classification"
  AND confirms
THEN scoped session created per ADR-0005
  AND Ravi can now read (or optionally write) within Tenant A
  AND session expires automatically
  AND all actions logged with elevated visibility
  AND customer (Tenant A admin Sofia) notified post-session
```

**Acceptance criteria**:
- Read-only default; write requires separate justification
- Session time-bounded (max 4 hours)
- Every action logged; exportable to customer on request
- Customer notified post-session per DPA terms
- Session visible to tenant admin in real-time (during and after)

### 2.3 US-PA-003 — Ravi handles break-glass production debug

```gherkin
GIVEN P1 security incident
  AND Ravi needs production DB access for diagnosis
WHEN Ravi opens Break-Glass Flow
  AND provides:
    - Incident reference
    - Specific access needed (DB read, log files, specific system)
    - Maximum duration: 2 hours
    - Justification (required, 200+ chars)
  AND second approver (another platform admin) approves
THEN access granted
  AND all queries / reads logged
  AND session time-bounded
  AND post-session attestation required
  AND incident report captures access
```

**Acceptance criteria**:
- Two-person rule: Ravi alone cannot invoke break-glass
- Second approver must be a different platform admin
- Actions logged at elevated visibility
- Post-session review mandatory
- Incident ticket updated with access trail

### 2.4 US-PA-004 — Ravi uses SQS inspector (MVP 1.5)

```gherkin
GIVEN Ravi needs to debug a queue issue
WHEN Ravi opens SQS Inspector
THEN he sees:
  - All tenant queues + DLQs
  - Message counts, age of oldest message
  - Failed messages (drill-in to see payloads, error traces)
  - Ability to re-drive specific messages from DLQ
  - Queue health trends
```

### 2.5 US-PA-005 — Ravi publishes pack update

```gherkin
GIVEN AIMS has prepared GAGAS:2024.1 (minor update)
WHEN Ravi opens Platform → Packs → Publish
  AND uploads new pack version
  AND validates (passes data-model/VALIDATION.md layers)
  AND provides metadata: version, effective date, changelog, migration notes
  AND submits for review
  AND another platform admin approves (two-person rule)
THEN pack published to all tenants
  AND notification sent to tenant admins
  AND per `pack-attachment-and-annotation.md §6`, tenants opt-in to upgrade
```

### 2.6 US-PA-006 — Ravi provisions new regional silo (v2.2+)

Per ADR-0006 regional silos, when AIMS expands to eu-central-1:
- Ravi triggers provisioning workflow (Terraform-based)
- Auto-provisions infrastructure
- Validates with smoke tests
- Marks region as "ready for tenant onboarding"

This is deferred to v2.2+ per `04-mvp-scope.md §2.2`.

### 2.7 US-PA-007 — Ravi views incident response console

```gherkin
GIVEN P1/P2 incident is active
WHEN Ravi opens Incident Response Console
THEN he sees:
  - Active incidents
  - SLO health (per tenant, per region)
  - Queue depth + DLQ
  - Error rates per service
  - Recent deployments (correlate with incidents)
  - Alert stream with context
```

---

## 3. User stories — Board reporting

### 3.1 US-BR-001 — Marcus views board dashboard

```gherkin
GIVEN Marcus preparing for quarterly Audit Committee meeting
WHEN he opens Board Dashboard
THEN he sees:
  - Annual plan execution: completed vs. planned engagements
  - Findings summary: count by classification
  - CAP compliance: completion %
  - CPE compliance: team status
  - Peer review status
  - Emerging risks identified
  - Key metrics trend
```

**Acceptance criteria**:
- Aggregates from all audit activity
- Exportable to PDF for distribution
- Real-time data

### 3.2 US-BR-002 — Marcus exports board presentation pack (MVP 1.5)

```gherkin
GIVEN quarterly meeting approaching
WHEN Marcus opens Export Board Pack
  AND selects sections (all / specific)
  AND customizes for meeting
THEN pack exported:
  - Tenant-branded cover
  - Executive summary
  - Plan execution
  - Material findings
  - Recommendations + CAP status
  - CPE compliance
  - Independence status
  - Next quarter outlook
  - Slides format (PDF) + Word format
```

**Status**: MVP 1.5.

### 3.3 US-BR-003 — Audit Committee communication log (MVP 1.5)

```gherkin
GIVEN Marcus formally communicates with Audit Committee
  (quarterly meeting, special briefing, material finding notification)
WHEN Marcus logs communication in AC Communication Log
  AND captures:
    - Date, topic, attendees
    - Decisions / actions
    - Attachments (presentation, letters)
  AND saves
THEN log entry preserved
  AND available for peer review evidence
  AND supports IIA GIAS Principle 8 (formal AC communication)
```

**Status**: MVP 1.5.

---

## 4. Edge cases

### 4.1 Customer objects to support-mode session

Per DPA terms, customer can object to specific access. Session terminated; issue escalates to CSM for customer call.

### 4.2 Break-glass abused

All break-glass sessions audited; pattern analysis detects abuse; addressed via HR process.

### 4.3 Pack publication failure

If pack fails validation, publication blocks; Ravi notified; rollback possible.

### 4.4 Board dashboard lag

For large tenants, aggregation may be slow. Cached results with refresh button.

---

## 5. Data model

- `PlatformAdminSession` — per-session tracking (support mode, break-glass)
- `BreakGlassApproval` — two-person rule tracking
- `PlatformPack` — published packs (shared across tenants)
- `BoardCommunication` — AC communication log (MVP 1.5)
- `IncidentLog` — internal incidents (not customer-facing)

---

## 6. API endpoints

```typescript
// Platform admin (internal only)
platformAdmin.listTenants(input: {filters}): Tenant[]
platformAdmin.enterSupportMode(input: SupportModeInput): Session
platformAdmin.breakGlass(input: BreakGlassInput): Session (requires second approval)
platformAdmin.publishPack(input: PackInput): Pack (requires approval)
platformAdmin.getIncidents(input: {filters}): Incident[]

// Board reporting
boardDashboard.get(input: {fiscalPeriod}): BoardDashboard
boardPack.export(input: ExportInput): PDF  // MVP 1.5
acCommunication.log(input: CommunicationInput): Communication  // MVP 1.5
```

---

## 7. Permissions

| Role | Platform admin console | Support mode | Break-glass | Publish pack | Board dashboard |
|---|---|---|---|---|---|
| Ravi (Platform Admin) | ✅ | ✅ | ✅ (with 2nd approver) | ✅ (with 2nd approver) | ❌ |
| Customer Success | ✅ (limited) | ✅ (read-only) | ❌ | ❌ | ❌ |
| Marcus (CAE) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Kalpana (Director) | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 8. Observability

- `platform.admin.support_mode.count` (sessions per tenant)
- `platform.admin.break_glass.count`
- `platform.admin.pack.publish.count`
- `board.dashboard.views.count` (per tenant)

---

## 9. Performance

- Tenant list load < 2s (100+ tenants)
- Support mode session creation < 1s
- Board dashboard load < 3s
- Pack publish workflow < 5 minutes (including validation)

---

## 10. Compliance

- Break-glass + support-mode sessions compliance with:
  - SOC 2 CC6.3 (logical access)
  - ISO 27001 A.9 (access control)
  - DPA terms (customer notification)
- Board reporting aligns with IIA GIAS Principle 8 + GAGAS §6.66 (AC communication)

---

## 11. Dependencies

- ADR-0002 tenant isolation (support mode respects tenant boundaries with elevated access)
- ADR-0005 session revocation (`blocklist_checkable` on platform admin sessions)
- Notifications (customer notification post-session)
- Audit trail (all sessions logged)

---

## 12. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Modules 13, 18
- [`02-personas.md §7`](../02-personas.md) — Ravi (platform admin)
- [`references/adr/0002-tenant-isolation-two-layer.md`](../../references/adr/0002-tenant-isolation-two-layer.md)
- [`references/adr/0005-session-revocation-hybrid.md`](../../references/adr/0005-session-revocation-hybrid.md)
- [`features/audit-trail-and-compliance.md`](audit-trail-and-compliance.md)
- [`features/report-generation.md §4.4`](report-generation.md) — Annual Summary (related to board reporting)

---

## 13. Domain review notes — Round 1 (April 2026)

External review flagged no specific changes for this file.

Phase 4 Part 2 overall verdict: **Approved** — "This specification set is phenomenal. It bridges the gap between the compliance requirements of audit and the technical realities of modern B2B SaaS."

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable (final spec); R1 review closed.*
