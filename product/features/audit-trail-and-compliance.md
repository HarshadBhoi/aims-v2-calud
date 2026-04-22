# Audit Trail and Compliance Evidence

> The always-on infrastructure that produces evidence for peer reviews, compliance audits, incident investigations. Mostly invisible to daily users; critical for reviewers and regulators. Hash-chained audit log (tamper-evident via SHA-256 chain), audit log viewers (admin + platform), supervisory-review trails, immutability enforcement for issued records, retention policy enforcement, GDPR right-to-erasure.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 17
**Primary personas**: Marcus (CAE, evidence access), Sofia (compliance exports), Reviewer (external peer / regulator), Ravi (platform admin cross-tenant investigations)
**MVP phase**: 1.0 for core infrastructure; compliance evidence bundles + DSAR tooling → 1.5

---

## 1. Feature overview

Audit trail is the infrastructure that captures every meaningful system event with tamper-evidence. Critical because:

- Peer reviews require evidence of supervisory review, independence, CPE compliance
- Regulatory audits (SOC 2, ISO 27001, HIPAA) require compliance evidence
- Incident investigations require forensic trail
- GAGAS §4.26 and IIA Standard 15.2 require documented engagement records

AIMS v2 ships:
- **Hash-chained audit log** — SHA-256 chain per ADR architecture; tampering detectable
- **Audit log viewer** (admin) — tenant-scoped log queries
- **Audit log viewer** (platform) — cross-tenant for Ravi's support investigations (scoped per ADR-0005)
- **Supervisory review trail** — per-engagement review evidence
- **Immutability enforcement** — post-issuance records locked via DB triggers
- **Retention policy enforcement** — strictness-resolver-driven retention with automated archival
- **Right-to-erasure** (GDPR Art. 17) — anonymization while preserving audit log hash integrity
- **Compliance evidence exports** (MVP 1.5) — framework-specific evidence packages

### 1.1 Why tamper-evidence matters

Audit trails that can be silently modified are worthless. If Marcus (CAE) can rewrite history to hide an approval, the audit trail loses its evidentiary value. Hash-chaining means any modification breaks the chain and is detectable.

---

## 2. User stories — Hash-chained audit log

### 2.1 US-AT-001 — Every meaningful event creates an audit log entry

```gherkin
GIVEN Priya creates a finding
WHEN the finding save commits
THEN an audit_event row is inserted with:
  - entityId: finding.id
  - entityType: Finding
  - action: CREATE
  - actorId: Priya
  - tenantId: Oakfield
  - timestamp
  - beforeState: null
  - afterState: { ... }
  - previousHash: (hash of previous audit_event for this tenant)
  - currentHash: (SHA-256 of current row content + previousHash)
  - metadata: { requestId, ipAddress, userAgent, engagementId, sessionId }
  AND hash chain integrity preserved
```

**Acceptance criteria**:
- Every state-changing event captured (create, update, delete, state transition, approval, rejection, issuance, etc.)
- Hash chain per tenant (not global, for isolation)
- Transaction-safe (audit event + entity save in same transaction per ADR transactional outbox)
- Bitemporal awareness (before/after state captured)

### 2.2 US-AT-002 — Hash chain integrity verification

```gherkin
GIVEN a scheduled job runs daily (audit hash chain verification)
WHEN it iterates through tenant's audit log
THEN for each row, it verifies:
  - currentHash matches SHA-256 of row content + previousHash
  - previousHash matches actual previous row's currentHash
  - No gaps in sequence
WHEN tampering detected
THEN alert fires to Ravi
  AND tenant admin notified
  AND forensic hold (prevent further modification; preserve evidence)
```

**Acceptance criteria**:
- Verification completes < 15 minutes for tenant with 1M events
- Any integrity failure is P1 incident
- Ravi + Sofia notified immediately
- Investigation workflow documented

---

## 3. User stories — Audit log viewer

### 3.1 US-AT-003 — Marcus queries tenant audit log

```gherkin
GIVEN Marcus is investigating an issue or preparing peer review evidence
WHEN he opens Admin → Audit Log
  AND filters:
    - Date range: Oct 1 - Dec 31, 2027
    - Entity type: Finding
    - Actor: Priya
    - Action: any
THEN matching events listed with:
  - Timestamp
  - Entity affected
  - Action performed
  - Actor identity
  - Context (engagement, request ID)
  - Click-through to entity detail
  - Export to CSV/PDF
```

**Acceptance criteria**:
- Query performance: p99 < 3s for tenant with 1M events (with appropriate indexes)
- Filter combinations supported
- Export preserves full metadata
- Read-only view (cannot modify from here)

### 3.2 US-AT-004 — Platform admin cross-tenant search

```gherkin
GIVEN Ravi is investigating a customer-reported issue
  AND he opens scoped support-mode session (time-bounded, logged per ADR-0005)
WHEN Ravi searches across tenants for specific pattern
THEN results aggregated with elevated visibility:
  - Tenant context included
  - All actions within session logged
  - Customer notified post-session (per DPA)
```

### 3.3 US-AT-005 — Audit log retention

```gherkin
GIVEN audit log events subject to tenant retention policy (from strictness resolver)
  AND a tenant's retention is 7 years (GAGAS driven by IIA)
WHEN events age past 7 years
THEN events become eligible for archival
  AND moved to cold storage (S3 Glacier) with query capability
  AND hash chain preserved (archival preserves integrity)
WHEN 7 years + tenant-specific archival-hold expires
THEN cryptographic erasure via ADR-0001
  AND erasure confirmation to tenant admin
```

---

## 4. User stories — Supervisory review trail

### 4.1 US-AT-006 — Per-engagement review trail for peer review

```gherkin
GIVEN peer reviewers are examining Oakfield FY27 engagement
  AND Marcus needs to produce evidence of supervisory review
WHEN Marcus opens Engagement → Review Trail
THEN report generated with:
  - Every work paper supervisory sign-off (who, when, comments)
  - Every finding review + approval chain
  - Every report approval stage
  - Independence declarations
  - CPE compliance per team member
  - Evidence of QA checklist completion (MVP 1.5)
  - Exportable as PDF
```

**Acceptance criteria**:
- Auto-generated from audit log
- Formatted per peer review standards
- Supports multiple frameworks (GAGAS peer review, IIA external QAIP)

### 4.2 US-AT-007 — Triennial peer review evidence bundle (MVP 1.5)

Extended version of US-AT-006 across multiple sample engagements. Formal package for triennial external peer review.

---

## 5. User stories — Immutability enforcement

### 5.1 US-AT-008 — Post-issuance records cannot be edited

```gherkin
GIVEN a finding has been ISSUED
WHEN any attempt is made to modify the finding's content
THEN:
  - Database trigger prevents the write
  - Application returns 409 Conflict
  - Error message: "This record is immutable post-issuance. Use amendment workflow (per `finding-authoring.md §4.3`)"
  - Audit log entry captured (attempt logged)
```

**Acceptance criteria**:
- Enforced at DB level (triggers + constraints), not just application level
- Cannot be bypassed by direct SQL (DB role permissions enforce)
- Raw SQL access requires break-glass per ADR-0001 + `auth/REVOCATION-POLICY.md`

### 5.2 US-AT-009 — Amendment workflow preserves original

Per existing amendment workflows (e.g., `finding-authoring.md §4.3`):
- Original ISSUED record bitemporally preserved
- Amendment creates new bitemporal row
- Full history queryable

---

## 6. User stories — Retention policy

### 6.1 US-AT-010 — Strictness-resolver-driven retention

```gherkin
GIVEN Oakfield FY27 has GAGAS + IIA + Single Audit attached
  AND strictness resolver computed retention: 7 years (IIA Standard 15.2 driver)
WHEN engagement enters ARCHIVED state
THEN retention timer starts
  AND tracked in engagement metadata
  AND approaching end-of-retention triggers notification
  AND purge workflow fires at retention end
```

### 6.2 US-AT-011 — Per-tenant retention override

```gherkin
GIVEN tenant policy extends GAGAS-default retention beyond strictness-resolver output
  (e.g., "our firm retains 10 years")
WHEN Sofia configures tenant retention policy
THEN extension applied (extends beyond resolver min)
  AND cannot shorten below resolver (enforced by validation)
  AND audit log captures the tenant override
```

---

## 7. User stories — Right to erasure (GDPR Art. 17)

### 7.1 US-AT-012 — Tenant requests user data erasure

```gherkin
GIVEN a user (or their legal representative) requests right-to-erasure under GDPR
WHEN Sofia initiates erasure workflow
  AND reviews applicable law (GDPR exceptions apply; audit log may be retained for legal obligations)
  AND documents rationale
  AND initiates erasure
THEN erasure job:
  - User's PII anonymized (email → hash, name → "Redacted User")
  - User's content (findings, work papers, etc.) remains but author field anonymized
  - Audit log entries retain hash but action.userId anonymized
  - Hash chain integrity preserved (hashes preserve the record; only readable PII changes)
  - Legal exceptions documented (audit log retained per GAGAS §4.26 legal requirement)
WHEN erasure completes
THEN confirmation to data subject
  AND attestation retained for compliance
```

**Acceptance criteria**:
- Anonymization preserves audit trail structure
- Hash chain integrity unbroken
- Legal retention exceptions documented (audit evidence typically exempted from erasure per GDPR Art. 17(3)(b))
- DSAR tooling full implementation MVP 1.5

---

## 8. Edge cases

### 8.1 Concurrent tampering attempts

Multiple concurrent tampering attempts: all logged; first-to-detect triggers alert.

### 8.2 Cross-region audit log

For multi-region tenants (future), audit log is per-region per ADR-0006 silo architecture.

### 8.3 Archive query

Post-archival queries to cold storage have higher latency (multiple seconds vs. sub-second).

### 8.4 Legal hold

Tenants can put audit logs on legal hold (pause retention/erasure) during litigation.

---

## 9. Data model

- `AuditEvent` — hash-chained event per ADR
- `AuditEventHash` — chain state tracking per tenant
- `RetentionPolicy` — per-tenant
- `ErasureRequest` — per-request tracking
- `LegalHold` — per-tenant hold states
- `ArchivedAuditEvent` — cold storage references

---

## 10. API endpoints

```typescript
auditLog.query(input: {filters, pagination}): AuditEvent[]
auditLog.getEntityHistory(input: {entityId, entityType}): AuditEvent[]
auditLog.export(input: {format, filters}): ExportResult
auditLog.verifyIntegrity(input: {range}): VerificationResult  // CAE+ only

retention.getPolicy(input: {engagementId}): RetentionPolicy
retention.scheduleArchival(input: {engagementId}): ArchivalJob

erasure.requestForUser(input: {userId, rationale}): ErasureRequest
erasure.getStatus(input: {requestId}): ErasureStatus

legalHold.apply(input: {scope, rationale}): LegalHold
legalHold.lift(input: {holdId}): void
```

---

## 11. Permissions

| Role | Query tenant audit log | Verify integrity | Cross-tenant audit | Erasure request | Apply legal hold |
|---|---|---|---|---|---|
| AIC (Priya) | ⚠️ (her engagements only) | ❌ | ❌ | ❌ | ❌ |
| CAE (Marcus) | ✅ | ✅ | ❌ | ⚠️ (initiate) | ⚠️ |
| Sofia (Tenant Admin) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Ravi (Platform Admin) | ⚠️ (support mode) | ✅ (cross-tenant) | ✅ (support mode) | ⚠️ | ⚠️ |

---

## 12. Observability

- `audit.event.count` (by entity type, action)
- `audit.hash.verify.count` / `.failures.count`
- `audit.retention.expired.count`
- `audit.archival.count`
- `audit.erasure.count`

---

## 13. Performance

- Audit event write < 50ms (in transaction with entity save)
- Query p99 < 3s with 1M events
- Hash verification: 1M events in < 15 minutes

---

## 14. Compliance

- **GAGAS §4.26**: documentation retention — satisfied
- **GAGAS §4.30**: audit evidence preservation — satisfied
- **IIA GIAS Standard 15.2**: quality documentation — satisfied
- **SOC 2 CC7.1-7.5**: system monitoring — satisfied
- **GDPR Art. 30**: records of processing — satisfied
- **GDPR Art. 17**: right to erasure — satisfied (with legal exceptions)
- **HIPAA §164.308(a)(1)(ii)(D)**: audit controls — satisfied
- **PCAOB AS 1215**: audit documentation retention — satisfied (7 years)

---

## 15. Dependencies

- All feature modules (generate audit events)
- Strictness resolver (drives retention)
- ADR-0001 ALE (encryption of audit log entries if PII)
- ADR-0002 tenant isolation (audit log is tenant-scoped)
- ADR-0005 session revocation (platform admin scoping)
- ADR-0006 regional silos (per-region audit logs)

---

## 16. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 17
- [`docs/04-architecture-tour.md §8.6`](../../docs/04-architecture-tour.md) — hash-chained audit log design
- [`docs/06-design-decisions.md §2.4`](../../docs/06-design-decisions.md) — event sourcing + hash-chain
- [`rules/strictness-resolver-rules.md §3.1`](../rules/strictness-resolver-rules.md) — retention dimension

---

## 17. Domain review notes — Round 1 (April 2026)

External review flagged no specific changes for this file. The hash-chained audit log design was specifically called out as a "massive differentiator that enterprise buyers will love."

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
