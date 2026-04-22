# Approval Chain Rules

> Who can approve what at each stage of every workflow. Every workflow transition that requires approval (engagement APM submission, finding issuance, report signing, CAP acceptance, and more) runs through a role-based chain defined per pack. This document enumerates those chains and explains how the strictness resolver combines them when multiple packs are attached. Pairs with [`workflow-state-machines.md`](workflow-state-machines.md), which defines the state transitions that approval chains gate.

---

## 1. Approval chain fundamentals

An approval chain is a sequence of roles, each of which must approve an artifact before it advances. Some chains are strictly sequential (approver A must approve before approver B can); others are parallel (multiple approvers can act concurrently and all must approve). The resolver per [`strictness-resolver-rules.md §3.9`](strictness-resolver-rules.md) computes the `APPROVAL_CHAIN_LENGTH` dimension as `max` across attached packs — the longest required chain wins.

### 1.1 What makes an approval "an approval"

In AIMS v2, an approval event is a formal action by a named user in a specific role that:
- Records the approver's identity, the approval artifact reference, the approval timestamp
- Optionally captures reviewer comments or notes
- Fires the workflow transition to the next state (if this is the final required approval)
- Is appended to the hash-chained audit log per [`../../docs/04-architecture-tour.md` §8.6](../../docs/04-architecture-tour.md)
- Cannot be silently retracted — an approval, once given, is recorded; withdrawal requires a separate explicit action

This is distinct from:
- **Informal comments** — reviewer adds a comment but does not formally approve or request revision
- **Assignment** — a reviewer is designated but has not yet acted
- **Lock** — a post-issuance immutability state; not an approval

### 1.2 Role-based vs. attribute-based approval

Each approval step is gated by:
- **Role** — user must hold a specific role on this tenant/engagement (AIC, CAE, QA Reviewer, Engagement Partner, EQR, etc.)
- **Attribute** — user must have specific attributes (not conflicted with the finding's subject, currently on-call if approval is break-glass-timing, etc.)

Role-based is primary; attribute-based is additive. A user with the required role but an attribute conflict (e.g., AIC but previously worked at the auditee) is blocked from approval with an explanation.

### 1.3 Delegation

Approvers can delegate to a named substitute for a time-bounded period (e.g., CAE is on vacation; delegates CAE-approval authority to Deputy CAE for two weeks). Delegation:
- Must be explicit with documented reason and time bounds
- Logs the delegation in the audit trail
- Transfers approval authority only — not accountability (the delegating user remains accountable for approvals made under their authority)
- Is visible in the approval chain display (reviewers see "approved by [Deputy], acting as CAE on behalf of Marcus")

### 1.4 Escalation

If an approver is unavailable (not logged in, not responding, on vacation without a delegate), the approval can escalate after a configurable timeout to a backup approver — typically one level up the organisational hierarchy. Escalation is explicit, logged, and emits notifications.

---

## 2. Engagement-level approval chains

### 2.1 APM (Audit Planning Memo) approval

The APM approval chain gates the `PLANNING → FIELDWORK` engagement transition.

**Base chain (GAGAS + IIA):**
1. AIC (author) — submits
2. QA Reviewer (if applicable per pack) — reviews for methodology consistency
3. CAE — approves for fieldwork

**Per-pack variations:**

| Pack | Adds to chain |
|---|---|
| GAGAS:2024 | No additions to the base chain; QA Reviewer role is required (GAGAS §5.40) |
| IIA GIAS:2024 | QAIP reviewer (separate from CAE) per Standard 15.1 |
| PCAOB | Engagement partner required before CAE; EQR optional for smaller engagements |
| SINGLE_AUDIT:2024 | Single Audit compliance officer (if tenant has one) before CAE |
| ISO 19011:2018 | Lead Auditor role (typically same as AIC) + Team Member peer review |
| AICPA AT-C | Attestation partner if this is a formal AT-C engagement |

**Resolver result**: max-length chain wins. For Oakfield FY27 (GAGAS + IIA + Single Audit + SOC 2), the APM approval chain is:

AIC → QAIP Reviewer → Single Audit Compliance Officer (if applicable) → CAE

Approval order is roughly sequential but QAIP + Single Audit reviewers can act in parallel.

### 2.2 Engagement closing approval (REPORTING → FOLLOW_UP)

After all reports issue, engagement advances to FOLLOW_UP.

**Base chain:**
1. AIC — confirms all reports issued, all findings in ISSUED state
2. CAE — signs off on engagement close

**Per-pack variations**: most packs don't add to this transition; the transition is based on report-level approvals already being complete.

### 2.3 Engagement archival approval

Occurs when CLOSED → ARCHIVED transition fires. Usually automatic based on retention timer; CAE approval required only for edge cases (tenant wanting to delay archival).

### 2.4 Engagement reopening

CLOSED → REOPEN transition requires:
1. CAE (or Audit Function Director) approval
2. Documented reason (min 100 characters)
3. Notification to all engagement team members and affected auditee contacts

Reopen is rare and deliberately high-friction.

### 2.5 Scope change approval

Mid-engagement scope change (per [`workflow-state-machines.md §2.6`](workflow-state-machines.md)) requires:
1. AIC (proposer)
2. Engagement Partner or CAE
3. Audit Function Director (Kalpana-level, if scope change affects methodology attachment)

Scope changes that add or remove packs to an engagement are particularly sensitive (they change the strictness resolver output); these require the extended chain above.

---

## 3. Finding approval chains

Finding approval chains gate the `IN_REVIEW → APPROVED` transition.

### 3.1 Base chain (for IN_REVIEW → APPROVED)

For all packs, the base chain is:
1. AIC — reviews for substantive content and evidence sufficiency
2. CAE or equivalent senior role — reviews for classification consistency and engagement-wide alignment

### 3.2 Per-pack additions

| Pack | Adds |
|---|---|
| GAGAS:2024 | Supervisor evidence required — an additional named supervisor signs off with evidence citations |
| IIA GIAS:2024 | QAIP reviewer for material findings (defined as Critical or Major severity) |
| PCAOB ICFR | Engagement partner + EQR for Significant Deficiency or Material Weakness classifications |
| SINGLE_AUDIT:2024 | Questioned costs reviewer (accountant responsible for auditee financials) if questioned costs > threshold |
| ISO 19011:2018 | Lead Auditor + Team Member peer (for Major NCs) |

**Example — Oakfield FY27 finding 2026-001** (classified as GAGAS Significant Deficiency + IIA Major):
- AIC (Priya)
- CAE (Marcus)
- QAIP Reviewer (because IIA Major is a material IIA finding)
- Questioned Costs Reviewer (because this has questioned costs > threshold)

Four-approver chain. Parallel in practice where roles permit.

### 3.3 Material findings require special attention

"Material finding" is defined per pack:
- GAGAS: Material Weakness classification
- IIA: Critical classification
- PCAOB: Material Weakness classification
- ISO: Major Nonconformity

Material findings get:
- Extended review SLA (reviewers see the finding in their queue with a "material" badge)
- Longer required approval window (minimum 48 hours in-review before approval can close)
- Additional required reviewers (per the per-pack additions above)
- Pre-approval legal review if finding has reputational or litigation implications (on request by CAE)

### 3.4 Finding amendment approval chains

Post-issuance amendment (per [`workflow-state-machines.md §3.6`](workflow-state-machines.md)) uses a modified chain:

1. CAE — initiates amendment with documented reason
2. AIC — drafts amendment content
3. CAE — approves amendment content
4. Engagement Partner (if PCAOB attached) — co-signs material amendments

Amendment chains are longer than initial approval chains because post-issuance changes are higher-stakes.

---

## 4. Report approval chains

Report approval is typically the longest chain in any engagement because reports are external-facing.

### 4.1 Base chain

1. Report composer (typically AIC) — drafts
2. Reviewer 1 — typically another senior team member
3. Reviewer 2 — typically the AIC if they didn't compose, or a Senior Manager
4. CAE — final approval
5. Issuance Authority — signs the formal issuance (usually same person as CAE, but separate action)

### 4.2 Per-pack additions

| Pack | Adds |
|---|---|
| GAGAS:2024 | Optional legal review stage before CAE; mandatory if finding carries political / PR sensitivity |
| IIA GIAS:2024 | Audit Committee Chair review before public distribution (for Audit Committee reports specifically) |
| PCAOB AS 3101 | Engagement Partner signature (cannot be delegated) |
| PCAOB AS 2201 | EQR co-signature on integrated audit reports |
| SINGLE_AUDIT:2024 | Organisation's Chief Financial Officer acknowledgement (on the Data Collection Form, not the Yellow Book report itself) |
| ISO 19011:2018 | Review meeting with auditee + their acknowledgement before final distribution |
| SOC 2 / AT-C | Attestation partner + Quality Control partner for material opinion changes |

### 4.3 Report chain length

The `APPROVAL_CHAIN_LENGTH` dimension per [`strictness-resolver-rules.md §3.9`](strictness-resolver-rules.md) is typically 3-4 stages for the base flow; 5-7 stages for enterprise engagements with multiple attached packs.

**Oakfield FY27 Yellow Book report chain** (GAGAS + Single Audit):
1. AIC (Priya) — compose
2. Senior Manager — review
3. Legal Review (if sensitive; skip if not)
4. CAE (Marcus) — approve
5. CFO acknowledgement (on DCF portion)
6. Issuance Authority — sign

6 stages. Sequential for stages 1-4, 5-6 parallel.

### 4.4 Report reviewer assignment

Each reviewer in the chain is assigned to the specific report at report-creation time. Assignment is:
- **Default**: taken from the engagement's team + CAE
- **Override**: engagement partner can re-assign specific reviewers (e.g., if a team member is unavailable)
- **Role-based**: specific roles (Legal, EQR, Partner) are assigned from tenant configuration

### 4.5 Report amendment approval

Amending an issued report (per [`workflow-state-machines.md §4.5`](workflow-state-machines.md)) requires:
1. CAE — initiates amendment, documents reason
2. AIC — drafts amendment content
3. Full original approval chain (or its material subset — reviewers who were on the original chain)
4. CAE — approves amendment
5. Issuance Authority — signs

Amendment chains are typically longer than initial chains because they require original-chain parity plus initiation and final approval.

### 4.6 Issuance gate — separate from approval

"Approved" and "Issued" are distinct events. A report can be Approved but not yet Issued if:
- Distribution is scheduled for a future date
- Legal clearance is pending on a specific finding
- Signature approval is received but the CAE wants to time the public release

The Issuance Gate — `APPROVED → ISSUED` transition — requires:
1. All approvals complete
2. Distribution list finalised
3. CAE or Issuance Authority signature (final action)
4. Optional: Legal counsel countersignature for sensitive reports

Issuance triggers the external-facing events: distribution notification, webhook firing, audit log entry with full approval chain record.

---

## 5. CAP approval chains

CAP approvals are auditor-side (accepting plan, verifying completion) and auditee-side (submitting plan, marking items done). Approval chain is narrower than reports because CAPs are internal operational artifacts.

### 5.1 Plan acceptance chain

For transition PROPOSED → ACCEPTED:

1. AIC — reviews plan content and approves as substantive
2. CAE (if CAP is for material finding) — final approval
3. Finding assignee (the auditor who authored the finding) — co-sign (confirms plan addresses the finding's criteria)

### 5.2 Evidence verification chain

For transition EVIDENCE_SUBMITTED → VERIFIED:

1. AIC — reviews evidence against finding criteria
2. CAE (if CAP is for material finding) — verifies completion

### 5.3 Per-pack CAP chain additions

**GAGAS:2024 + SINGLE_AUDIT**: CAE sign-off on CAP acceptance for findings with questioned costs above threshold (typically $10K for Single Audit CAPs).

**PCAOB ICFR**: Engagement Partner sign-off on CAP for Significant Deficiency or Material Weakness findings. EQR review if material.

**IIA GIAS:2024**: QAIP reviewer for Major findings' CAPs.

### 5.4 Escalation within CAP chain

If CAP becomes OVERDUE (per [`workflow-state-machines.md §5.6`](workflow-state-machines.md)), the CAP escalation chain activates:

- 10 days OVERDUE: notification to CAE (not approval; just visibility)
- 20 days OVERDUE: notification to Engagement Partner + Audit Function Director
- 30+ days OVERDUE: notification to Audit Committee chair (for public-audit-committee-visible engagements)

These escalations don't require approval; they're visibility / accountability triggers. The CAP stays OVERDUE until evidence is submitted and verified, or CAP is ABANDONED with CAE approval.

### 5.5 CAP abandonment chain

Abandoning a CAP (IN_PROGRESS → ABANDONED transition, per [`workflow-state-machines.md §5.1`](workflow-state-machines.md)) requires:
1. CAE approval with documented rationale (min 200 characters — higher bar than other approvals because abandonment means the finding may not be remedied)
2. Notification to the auditor who authored the finding
3. Notification to auditee (to formally close the CAP tracking)
4. Audit Committee communication (if finding was classified Material/Critical)

---

## 6. Recommendation approval

Recommendations follow the finding's approval chain in most packs — they don't have their own separate chain. Per [`workflow-state-machines.md §6`](workflow-state-machines.md), the recommendation is approved/published as part of the parent finding's workflow.

**Exception — PCAOB ICFR**: recommendations are SUPPRESSED (not approved; never published as part of a PCAOB report); they may exist informally as auditor-to-management communication but are not subject to a formal approval chain for publication.

---

## 7. Work paper approval chains

Work papers follow a lighter chain.

### 7.1 Supervisory review chain

For transition READY_FOR_REVIEW → REVIEWED:

1. Preparer (typically staff auditor) — submits
2. Supervisor (typically AIC or Senior Manager) — reviews

Two-person chain is sufficient for most work papers. Per-pack additions:

**GAGAS:2024** — supervisor review is mandatory; evidence of review must be in the work paper; the supervisor's sign-off includes a dated signature.

**IIA GIAS:2024** — same pattern with QAIP reviewer concurrent review for material work papers.

**PCAOB** — for work papers related to control testing or fraud risk, EQR + engagement partner review is required (per AS 1220). This makes certain work paper approval chains 3-4 stages deep instead of 2.

### 7.2 Work paper locking

Once the engagement transitions out of FIELDWORK, work papers lock automatically. No approval needed for the lock itself; it's a cascade from the engagement transition.

---

## 8. Independence declaration approval

Per [`independence-rules.md`](independence-rules.md), independence declarations happen at multiple points:

### 8.1 Annual independence declaration

For user lifecycle: every auditor submits annually (for pack-annotated auditor roles).

- Auditor submits
- Audit Function Director or delegate reviews
- Approved declarations flow to the user's profile and attach to engagements automatically

### 8.2 Per-engagement independence declaration

For each engagement the auditor is assigned to:
- Auditor reviews engagement context (auditee, prior relationships, related-party transactions)
- Auditor submits declaration (no impairment / impairment disclosure)
- AIC reviews
- If impairment disclosed: CAE + Independence Officer review
- If impairment material: engagement partner approves (with decision to either accept with mitigation or decline the assignment)

### 8.3 Impairment disclosure approval chain

For disclosed impairments:

1. Auditor — discloses impairment in writing
2. AIC — reviews impact on engagement
3. CAE + Independence Officer — evaluate whether impairment can be mitigated (via reassignment, additional review, etc.) or requires auditor removal from the engagement
4. If auditor remains: Engagement Partner documents mitigation plan
5. If auditor removed: engagement team is updated; new auditor is onboarded

Per [`strictness-resolver-rules.md §3.11`](strictness-resolver-rules.md), GAGAS requires "any identified" impairments to be disclosed — the broadest disclosure threshold among major packs.

---

## 9. Annual audit plan approval

The annual audit plan (Module 3 per [`../03-feature-inventory.md`](../03-feature-inventory.md)) has its own approval chain.

### 9.1 Plan authoring and approval

1. Audit Function Director — drafts
2. CAE + senior managers — review
3. Audit Committee Chair — approves for formal adoption
4. Audit Committee — public approval at committee meeting (for organisations with visible board governance)

### 9.2 Per-pack additions

**GAGAS:2024** — the plan must demonstrate risk-based coverage; the Audit Committee Chair's approval is typical for government organisations.

**IIA GIAS:2024** — Audit Committee approval is mandated per Principle 8; IIA requires external reporting on plan achievement annually.

---

## 10. Cross-tenant / cross-engagement approvals

Some approvals span tenant boundaries. These are rare but documented for completeness.

### 10.1 Platform admin break-glass approval

When Ravi (per [`../02-personas.md`](../02-personas.md)) performs cross-tenant support actions, the approval chain is:

1. Ravi — initiates with documented reason
2. Security officer — approves (independent approval; Ravi cannot approve their own break-glass action)
3. Session is time-bounded; all actions during the session are logged

This is ADR-0005 compliance; the `blocklist_checkable` claim is set on Ravi's session; approval is logged; customer is notified post-action (per DPA terms).

### 10.2 Customer tenant acquiring support access

For customer-initiated support access (customer needs AIMS to temporarily access their tenant for troubleshooting):

1. Customer (typically Sofia) — authorises in writing
2. AIMS Support Lead — receives authorisation
3. Ravi (or delegate) — performs troubleshooting within authorisation scope
4. Actions logged; customer receives post-session summary

---

## 11. Audit Committee communication approvals

Certain artifacts require Audit Committee communication per IIA GIAS 2024 Principle 8 + GAGAS §6.66. These include:

- Annual audit plan
- Material findings summary (quarterly)
- Engagement-level findings for high-profile engagements
- Changes to audit scope
- Disagreements with management

These communications follow a simplified chain: AIC or CAE drafts → CAE reviews → Audit Committee Chair reviews → Audit Committee communicates (via formal minutes or equivalent).

---

## 12. Automated approvals

Some workflow advancements happen via scheduled jobs, not human approval:

- Finding resolution via automatic CAP verification (when auditor's CAP-verification action is scheduled)
- Engagement archival (scheduled based on retention timer)
- Overdue CAP escalation (scheduled)
- Pack version migration (when a pack version is deprecated, attached engagements migrate automatically on a scheduled date)

These don't have approval chains per se; the scheduled job is the "approval." Audit trail entries clearly identify the trigger as automated (not user-initiated).

---

## 13. Delegation and substitution rules

### 13.1 Who can delegate

- CAE → CAE Deputy or senior manager
- Engagement Partner → another partner
- AIC → senior manager or another AIC (rare)
- Subject matter reviewers (Legal, QA) → same-role substitutes

### 13.2 Delegation constraints

- Cannot delegate below the delegator's role level (CAE can delegate to Deputy; AIC cannot delegate to Staff Auditor for CAE-level approvals)
- Cannot delegate for conflicted situations (user with impairment cannot delegate to someone they've supervised closely on the same engagement — still adjacent to impairment)
- Delegation has mandatory time bounds (typically max 4 weeks; longer requires CAE approval)
- Delegation logs identity of delegator + delegate + reason + time bounds

### 13.3 Delegation visibility

In the UI, approvals made under delegation are displayed as:
"Approved by [Deputy Name], acting as [CAE Name]"

This is transparent to all viewers; post-audit reviewers can trace who acted in what capacity.

---

## 14. Escalation rules

Each approval stage has a configurable escalation trigger. If an approver doesn't respond within the SLA (configurable per stage, typically 3-5 business days), the request escalates.

### 14.1 Escalation targets — context preservation matters

Naïve escalation "AIC inactive → CAE" produces an operational quality failure. The AIC (Priya) is the person who actually read the 400-page grant agreement, reviewed the specific evidence, and understands the nuance. If the request escalates directly to the CAE (Marcus), Marcus cannot meaningfully approve substantive content — he doesn't know the underlying evidence. If the UI lets him click "Approve" just to clear the queue, AIMS has enabled a quality-control failure rather than prevented one.

The correct escalation preserves context by stepping to someone who can still meaningfully review:

- **AIC inactive → Senior Manager / Senior Auditor first, then CAE as last resort**. The Senior Manager typically has engagement context (often supervising the AIC) and can substantively review. CAE escalation only fires if Senior Manager is also inactive, and even then with a specific warning (see §14.1.1).
- **Senior Manager inactive → CAE** (the CAE is the right target here; Senior Manager-level review has fallen through)
- **CAE inactive → Audit Function Director**
- **Audit Function Director inactive → CEO or equivalent** (for organisations that size up to it)
- **Engagement Partner inactive → another partner** (PCAOB / AT-C attestation)

#### 14.1.1 Context-preservation warning for senior escalations

When escalation reaches a level beyond the substantive reviewer (e.g., Senior Manager escalation lands on CAE because Senior Manager is also unavailable), the UI must present an **explicit context warning** to the senior approver:

> You are approving evidence and content you did not prepare and may not have directly reviewed. Acknowledging this approval:
> - Records you as the approver of record
> - Transfers approval accountability to you
> - Does not substitute for the substantive review that the original assignee should have performed
>
> If you are not confident in the evidence, consider:
> - Asking the Senior Manager to re-delegate to another qualified reviewer
> - Invoking emergency override (§14.4) with documented rationale for the rushed decision
> - Requesting the AIC to return and re-review before this artifact is formally approved
>
> [Decline to approve — route back]   [Acknowledge and approve]

The warning is mandatory on any approval where the approver is outside the normal substantive-review role (the engineer reviewing the evidence). It's not a hard block — the CAE may have good reason to approve quickly — but it makes the trade-off visible in the audit trail.

#### 14.1.2 Why this matters for regulatory review

Peer reviewers (per GAGAS §5.60) and QAIP reviewers (per IIA GIAS Domain 4) examine approval chains to verify that artifacts received meaningful review by qualified reviewers. If audit trail shows CAE approving a 200-page APM within an hour of its submission, the reviewer will question whether substantive review occurred. The context warning creates the documented record: "CAE approved with acknowledgment of limitation because Senior Manager also unavailable during hurricane evacuation." That's a defensible record; a silent escalation is not.

### 14.2 Escalation process

1. Original approver's notification fires (day 0)
2. Reminder fires at 50% of SLA (day 2)
3. Escalation trigger fires at SLA expiry (day 5)
4. Backup approver receives the request; original approver also notified
5. Backup approver's SLA clock starts

### 14.3 What escalation means for accountability

Escalation doesn't remove the original approver's accountability — they still have the opportunity to act. Escalation provides a parallel path so that artifacts don't stall. If escalated approver acts, they're accountable for the approval they gave; original approver's slot is marked as "not-acted-upon within SLA."

### 14.4 Emergency override

For truly urgent situations (e.g., a report must be issued before a statutory deadline and a primary approver is unavailable), an emergency override flow exists:
1. CAE initiates override with documented reason
2. Override requires a secondary approver (typically another senior partner or board-level individual)
3. Override is flagged in the audit trail
4. Original approver is notified and may object via a post-override review

Emergency overrides should be rare — typically <1 per engagement per year.

---

## 15. Approval chain analytics

The dashboard (per [`../03-feature-inventory.md`](../03-feature-inventory.md) Module 16) includes approval-chain analytics:

- Average approval turnaround time per stage per engagement
- Approvers with SLA violations (individual accountability)
- Delegation frequency (are specific users over-delegating?)
- Escalation frequency (are specific chains poorly staffed?)

These analytics help the Audit Function Director (Kalpana) spot operational issues and optimise chains.

---

## 16. Edge cases and governance

### 16.1 Two-person rule

For highly sensitive approvals (e.g., material post-issuance amendments, engagement withdrawal, emergency overrides), AIMS supports a "two-person rule" — two different users in appropriate roles must both approve. Neither user can approve unilaterally.

Two-person approval is configured per pack per workflow step; GAGAS and PCAOB both require two-person for certain report amendments.

### 16.2 Conflict-of-interest checks

Before an approver is eligible for a specific approval:
- Check independence declarations (is the approver independent for this engagement?)
- Check prior relationships (did the approver previously work at the auditee?)
- Check family / professional relationships (is the approver related to the auditee's CFO?)

Failed conflict checks block the approval; the user sees an explanation and the approval is routed to an alternate approver.

### 16.3 Approval revocation

An approval, once given, cannot be silently revoked. The approver can initiate a revocation (with documented reason), which fires a re-approval workflow — the artifact returns to the pre-approval state and must be re-approved (possibly by a different approver).

Revocations are logged with full audit trail; they're uncommon and indicate a process issue.

### 16.4 Parallel approvals — concurrency edge case

When multiple approvers must all approve (parallel chain), the UI shows each reviewer's independent status. The artifact advances only when all approvers complete. If one approver requests revision, the artifact returns to draft state — the other approvers' approvals are "expired" and must be renewed once the revision is made.

This is load-bearing behaviour: reviewers cannot tacitly approve; each must re-approve after a revision.

### 16.5 Approval reassignment

An approval stage can be reassigned mid-flight (e.g., original reviewer becomes unavailable; CAE reassigns to a substitute). Reassignment:
- Requires CAE approval
- Logs the reassignment with reason
- Resets the SLA clock (new reviewer has the full original SLA)

Frequent reassignments indicate staffing issues and are surfaced in analytics.

---

## 17. Role hierarchy for approval authority

The hierarchy of roles for approval authority is tenant-configurable but typically follows:

```
CAE (Chief Audit Executive)
├── Deputy CAE / Senior Audit Manager
├── Audit Function Director (Kalpana, on multi-function audit organisations)
│
├── Engagement Partner (for attestation engagements)
│   └── Engagement Quality Reviewer (EQR, for PCAOB)
│
├── Senior Manager / Senior Auditor
│   └── Auditor-in-Charge (AIC, Priya)
│
│       └── Staff Auditor (Anjali)
│
├── Independence Officer (QAIP Reviewer for IIA)
│
└── Legal / Compliance Reviewer (pack-specific)
```

The role hierarchy drives:
- Delegation authority (who can delegate to whom)
- Escalation targets (who receives unresponsive approvals)
- Emergency override authorisation

Specific engagements may modify this via configuration (e.g., Kalpana's bureau has a different sub-hierarchy than Oakfield's university).

---

## 18. References

- [`rules/strictness-resolver-rules.md`](strictness-resolver-rules.md) — chain length dimension (§3.9)
- [`rules/workflow-state-machines.md`](workflow-state-machines.md) — transitions that chains gate
- [`rules/classification-mappings.md`](classification-mappings.md) — material-finding definitions per pack
- [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts) — `workflows` + chain declarations per pack
- [`data-model/tenant-data-model.ts`](../../data-model/tenant-data-model.ts) — `Engagement.team`, `Finding.reviewers`, `Report.approvers` fields
- [`docs/04-architecture-tour.md §8.6`](../../docs/04-architecture-tour.md) — audit trail format
- [`docs/06-design-decisions.md §6.7`](../../docs/06-design-decisions.md) — session revocation (breaks approval chain if approver's session is killed)
- [`references/adr/0005-session-revocation-hybrid.md`](../../references/adr/0005-session-revocation-hybrid.md) — revocation impact on approvals
- [`auth/REVOCATION-POLICY.md`](../../auth/REVOCATION-POLICY.md) — approver role protection
- GAGAS 2024 — approval requirements throughout
- IIA GIAS 2024 — approval requirements throughout
- PCAOB AS 1220 — engagement quality review authority
- ISO 19011:2018 — audit team hierarchy

---

## 19. Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review as part of the Phase 3 rule-files review cycle. **Verdict: Approved with one specific refinement** (context-preserving escalation).

### Round 1 — the escalation trap

Reviewer correctly flagged that naïve escalation "AIC inactive → CAE" produces operational quality failure. The AIC (Priya) is the person who actually read the 400-page grant agreement and reviewed the specific evidence. If the request lands on the CAE (Marcus), Marcus cannot meaningfully approve substantive content — he doesn't know the underlying evidence. If the UI lets him click "Approve" just to clear the queue, the system enables a quality-control failure.

Fix applied to §14.1:
- Escalation path corrected: AIC inactive → **Senior Manager first** (they have engagement context), then CAE only as last resort
- §14.1.1 added: mandatory context-preservation warning for senior escalations. When an approver is outside the normal substantive-review role, the UI presents an explicit warning acknowledging they're approving evidence they didn't prepare. Not a hard block; it makes the trade-off visible in the audit trail.
- §14.1.2 added: explanation of why this matters for regulatory peer review — reviewers check approval chains for evidence of meaningful review; silent escalations produce indefensible records

See strictness-resolver-rules.md §9 for the overall Phase 3 review verdict.

---

*Last reviewed: 2026-04-21. Phase 3 deliverable; R1 review closed.*
