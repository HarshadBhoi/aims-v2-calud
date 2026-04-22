# Feature Inventory

> The full product surface of AIMS v2, organised by module. Every feature listed here either exists in AIMS v1 and is being ported, exists in v1 and is being enhanced in v2, or is new in v2. This doc answers "what does this product actually do?" at survey depth; deep specs per feature live in [`features/`](features/).

---

## How to read this

20 modules (18 original + 2 added in R1 review: PBC Management, Notifications & Alerts Center). Each module has a short introduction and a feature table. The feature tables use consistent columns:

- **Feature** — name of the feature (matches the URL/route where applicable)
- **What it does** — one-sentence description
- **Primary personas** — who uses it (shorthand names from [`02-personas.md`](02-personas.md))
- **v1 status** — `v1` if carried from AIMS v1, `new-v2` if genuinely new, `v2-extends` if v1 had a simpler version that v2 expands
- **MVP** — `MVP` if part of the first shippable release, `v2.1` / `v2.2+` if phased later, `stretch` if desired but removable if scope pressure arises
- **Complexity** — rough S / M / L / XL estimate reflecting design + implementation + testing effort

### Persona shorthand

- **Priya** — Auditor-in-Charge (AIC)
- **Marcus** — Chief Audit Executive (CAE)
- **Anjali** — Staff Auditor
- **David** — Auditee CFO
- **Kalpana** — Audit Function Director (pack annotation/override, not from-scratch authoring)
- **Aisha** — Consortium Pack Author (post-MVP persona)
- **Ravi** — Platform Admin (internal)
- **Sofia** — Tenant Admin (customer-side IT)
- **Jin** — External API Integrator
- **Reviewer** — External peer / regulatory reviewer
- **Elena** — CPA Firm Audit Partner (Segment A economic buyer)
- **Tom** — PBC Request Manager (dedicated PBC-chasing role at larger firms)

### Status caveat

The MVP column is a working hypothesis as of 2026-04-21. [`04-mvp-scope.md`](04-mvp-scope.md) (Phase 2) will commit formally. Until then, the column represents my proposed cut; treat it as a conversation starter, not a decision.

---

## Module 1 — Tenant onboarding & account management

> Everything that happens before an auditor ever authors a finding. Tenant provisioning, subscription, billing, seat management, regional-silo binding, offboarding. Owned operationally by Ravi + customer success.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Self-serve signup (Starter tier) | Public signup flow; choose home region; tenant provisioned automatically | (prospect) | new-v2 | MVP | L |
| Enterprise sales-assisted onboarding | Account executive–driven onboarding with custom terms, SSO integration, data import from competitor | (prospect), Sofia | new-v2 | MVP | L |
| Tenant settings (general) | Tenant name, branding, logo, domain, default timezone, fiscal year | Marcus, Sofia | v1 | MVP | S |
| Subscription management | Plan tier, seat count, billing cycle, upgrade / downgrade | Marcus, Sofia | new-v2 | MVP | L |
| Billing portal | Invoice history, payment method, usage metering for metered components | Marcus, Sofia | new-v2 | MVP | M |
| Tenant regional binding | Lock tenant to a home region at signup; visible in settings | Sofia | new-v2 | MVP | M |
| Tenant offboarding | Data export, retention-period hold, cryptographic erasure at hold expiry | Marcus, Sofia, Ravi | new-v2 | MVP | L |
| Regional migration support | Offboard-and-re-onboard flow for tenants wanting to relocate regions | Sofia, Ravi | new-v2 | v2.2+ | XL |
| On-premises deployment packaging | Helm chart + Docker Compose bundle for government clients | Sofia, Ravi | new-v2 | v2.2+ | XL |
| Trust center (public-facing) | Public transparency page: SOC 2 status, subprocessor list, DPA template | (prospect), Sofia, Jin | new-v2 | MVP | M |
| Sub-processor change notification | 30-day customer notification when subprocessor list changes, per DPA | Sofia | new-v2 | MVP | S |
| Tenant-admin audit log | Who changed what in tenant settings; exportable | Sofia, Reviewer | v2-extends | MVP | M |

---

## Module 2 — Identity, auth, SSO

> Authentication, authorisation, SSO, MFA, session management, user lifecycle. Core infrastructure; see [`auth/`](../auth/) for the technical architecture. This module focuses on the user- and admin-facing features built on that foundation.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Email/password login | Primary auth for smaller tenants and self-service users | All | v1 | MVP | S |
| TOTP (Authenticator app) MFA | RFC 6238 TOTP as baseline MFA | All | v1 | MVP | S |
| WebAuthn / Passkeys MFA | W3C Level 3 WebAuthn support; passkey preferred over TOTP | All | new-v2 | MVP | M |
| SSO via OIDC | OIDC integration (Okta, Azure AD, Google Workspace) | All, Sofia config | new-v2 | MVP | M |
| SSO via SAML 2.0 | SAML 2.0 integration (enterprise IdPs) | All, Sofia config | new-v2 | MVP | M |
| SCIM 2.0 provisioning | Automated user / group provisioning from IdP | Sofia | new-v2 | MVP | L |
| Self-service password reset | Email-link password reset flow | All | v1 | MVP | S |
| MFA enforcement policies | Tenant-level require-MFA rules (per role, per action) | Sofia | new-v2 | MVP | M |
| Session management UI | Per-user view of active sessions across devices; revoke individually | All | v1 | MVP | S |
| Multi-device management | Force logout across all devices; step-up MFA on sensitive actions | All | new-v2 | MVP | M |
| Admin-initiated session kill | Tenant admin revokes a specific user's active session | Sofia | new-v2 | MVP | M |
| User lifecycle events | Audit log of login, logout, MFA events, role changes, SSO group sync | Sofia, Reviewer | v2-extends | MVP | S |
| `require_instant_revocation` tenant flag | Force `blocklist_checkable: true` on all tokens in the tenant (per ADR-0005) | Sofia | new-v2 | v2.1 | S |
| Step-up authentication | Re-verify MFA for sensitive actions (e.g., issuance, export, admin ops) | All | new-v2 | MVP | M |
| IP allowlist (optional, per tenant) | Restrict login by source IP range | Sofia | new-v2 | v2.1 | M |

---

## Module 3 — Audit universe & annual planning

> Maintaining the catalogue of auditable entities (processes, programs, risks, systems) the audit function might examine, and the annual plan that selects which to audit in the coming year. The strategic layer above engagement management.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Audit universe — entity catalogue | CRUD for auditable entities (processes, programs, departments, systems) | Kalpana, Marcus | v1 | MVP | M |
| Audit universe — risk scoring | Per-entity risk scores (inherent, residual) with scoring methodology | Kalpana, Marcus | v1 | MVP | M |
| Audit universe — audit history | Per-entity history of prior audits, findings, cycle times | Marcus | v1 | MVP | S |
| Multi-year audit cycle tracking | Entities planned over 3–5 year cycles, gap-spotting | Kalpana, Marcus | v2-extends | v2.1 | M |
| Annual audit plan authoring | Compose next year's plan: select entities, estimate hours, assign leads | Kalpana, Marcus | v1 | MVP | L |
| Annual plan approval workflow | Route plan through committee review and formal approval | Marcus | v1 | MVP | M |
| Annual plan vs. actual dashboard | Progress tracking: what's been completed, deferred, added in-year | Marcus, Kalpana | v2-extends | MVP | M |
| Risk-based plan optimisation | Suggest plan adjustments based on risk-scoring changes mid-year | Kalpana | new-v2 | v2.2+ | L |
| Plan-to-engagement linkage | Approved plan items auto-populate engagement creation prompts | Priya, Marcus | v2-extends | MVP | M |

---

## Module 4 — Engagement management

> Where most auditor work lives. Engagement creation (including multi-pack attachment), team assignment, phase progression, budget / hours tracking. The central hub from which fieldwork, findings, reports flow.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Engagement creation | Create engagement with type, period, entity, auditor-in-charge | Priya, Marcus | v1 | MVP | M |
| Multi-pack attachment at creation | Attach `primaryMethodology`, `additionalMethodologies`, `controlFrameworks`, `regulatoryOverlays` | Priya, Marcus | new-v2 | MVP | L |
| Engagement template library | Pre-configured engagement types (financial audit, performance audit, Single Audit, SOC 2, ISO) | Priya, Kalpana | v2-extends | MVP | M |
| Team assignment | Assign AIC, staff auditors, specialist reviewers; role-per-engagement | Marcus, Priya | v1 | MVP | M |
| Engagement phase tracking | Planning → Fieldwork → Reporting → Follow-up with phase-gate checks | Priya, Marcus | v1 | MVP | M |
| Budget / hours tracking | Estimated vs. actual hours; per phase; per team member | Priya, Marcus | v1 | MVP | M |
| Scope change management | Formal scope changes with approval; tracked for evidence | Priya, Marcus | v1 | v2.1 | M |
| Engagement risk register | Engagement-specific risks (not entity-level); treatment and owner | Priya | v1 | MVP | S |
| Multi-auditee engagements | One engagement spanning multiple auditee organisations (e.g., Single Audit across federal programs) | Priya | v2-extends | MVP | L |
| "In conjunction with" attachment | Explicit second-methodology attachment with per-pack `conformanceClaimed` flag | Priya | new-v2 | MVP | M |
| Engagement cloning | Clone an engagement structure (not data) as starting point for a similar one | Priya | v1 | MVP | S |
| Engagement search & filtering | Cross-engagement search by status, AIC, entity, methodology, phase | Priya, Marcus | v1 | MVP | M |
| Engagement dashboard | Per-engagement dashboard: hours, findings count, open observations, upcoming phase gate | Priya, Marcus | v1 | MVP | M |
| Engagement activity feed (timeline) | Unified chronological feed per engagement: status changes, uploads, approvals, comments, assignments | Priya, Marcus, Anjali | new-v2 | MVP | M |
| Engagement comments (general) | Engagement-level discussion thread for team coordination (not tied to a specific entity) | Priya, Anjali | new-v2 | MVP | S |
| Engagement archive | Post-issuance, move to archive with retention-period tracking | Marcus, Ravi | v1 | MVP | M |

---

## Module 5 — Audit Planning Memo (APM)

> GAGAS §7.05–7.10 structured planning document. Captures scope, objectives, risk assessment, resources, timeline. Version-controlled, approval-workflow'd.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| APM authoring (14-section structure) | Structured document with sections per GAGAS §7.05–7.10 | Priya | v1 | MVP | L |
| APM templates by engagement type | Pre-populated starting templates per engagement type + methodology | Priya | v1 | MVP | M |
| APM collaborative editing | Multi-user editing with conflict resolution | Priya, Anjali | v1 | MVP | L |
| APM approval workflow | Route through AIC → CAE review + approval | Priya, Marcus | v1 | MVP | M |
| APM version history | Full version history; compare any two versions | Priya, Marcus | v1 | MVP | M |
| APM PDF export | Formal PDF output for internal documentation | Priya | v1 | MVP | S |
| APM linkage to engagement phases | APM approval gates the transition from Planning → Fieldwork | Priya | v1 | MVP | S |
| APM cross-standard scope section | For multi-standard engagements, section declaring which standards apply | Priya | new-v2 | MVP | M |

---

## Module 6 — Risk assessment (PRCM — Process–Risk–Control Matrix)

> The structured risk-to-control mapping that underpins the audit's fieldwork. A specific process has specific risks, controlled by specific controls, tested by specific procedures.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| PRCM matrix authoring | Structured grid: processes × risks × controls × test procedures | Priya, Anjali | v1 | MVP | L |
| Risk rating per risk row | Inherent risk / control risk / residual risk ratings | Priya | v1 | MVP | M |
| PRCM import from universe | Prepopulate from audit universe entries where they exist | Priya | v1 | MVP | M |
| PRCM PDF export | Formatted export for engagement documentation | Priya | v1 | MVP | S |
| Control-framework-aware PRCM | PRCM that links to the engagement's attached control frameworks (e.g., SOC 2 TSC) | Priya | new-v2 | MVP | L |
| PRCM cloning across engagements | Reuse a prior engagement's PRCM as starting point | Priya | v1 | MVP | S |

---

## Module 7 — Fieldwork

> The execution layer. Work programs, work papers, sampling methodology, test execution, observation capture. Where Anjali spends most of her time and where Priya reviews.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Work program authoring | Test plan structured as sections with test steps, evidence expected | Priya | v1 | MVP | L |
| Work program templates | Pre-built by engagement type + methodology (GAGAS, IIA, ISO, SOC 2) | Priya, Kalpana | v2-extends | MVP | M |
| Work paper authoring | Structured work papers with header, procedures, results, conclusions | Anjali, Priya | v1 | MVP | L |
| Work paper templates | Templates per test type, per methodology | Anjali, Priya | v1 | MVP | M |
| Evidence upload + attachment | Attach files (PDF, Excel, images) to work papers with metadata | Anjali | v1 | MVP | M |
| Work paper review & sign-off | Preparer / reviewer workflow; inline comments; resolution tracking | Anjali, Priya | v1 | MVP | L |
| Sampling worksheet | Structured sample selection: population, methodology, sample size calc, selected items | Anjali, Priya | v1 | MVP | L |
| Audit testing execution | Log per-sample-item test results: pass, exception, not applicable, with notes | Anjali | v1 | MVP | M |
| Cross-work-paper references | One work paper references another as supporting evidence | Anjali, Priya | v1 | v2.1 | M |
| Observation capture | Preliminary issues noted during fieldwork, awaiting Priya's judgment to escalate to findings | Anjali | v1 | MVP | M |
| Observation → finding escalation | One-click promotion of observation to finding, carrying context | Priya | v1 | MVP | M |
| Work paper search | Full-text search across work papers within an engagement | Priya, Anjali | v1 | v2.1 | M |
| Inline rich text (TipTap) | Rich-text editor for work paper narratives | Anjali, Priya | v1 | MVP | M |
| Evidence-request fulfilment (auditee side) | David uploads requested documents; Anjali / Priya review and acknowledge (see Module 7a for the full PBC flow) | David, Anjali | new-v2 | MVP | M |

---

## Module 7a — PBC (Provided-by-Client) request management (added R1)

> The PBC process is the single most operationally-intensive part of an audit. Building the request list, sending requests, chasing auditees for responses, staging received documents for evidence attachment — at larger firms this is a full-time role (see Tom in [`02-personas.md §12`](02-personas.md)). Existing audit tools handle this as a spreadsheet-plus-email workflow; specialised tools (InFlight, Pascal) exist because of this gap. AIMS v2 treats PBC as a first-class module.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| PBC request list builder | Per-engagement list of document requests, templated from prior-year engagement or a standard library | Tom, Priya | v2-extends | MVP | M |
| Per-request metadata | Category, deadline, auditee contact, priority, work-paper target | Tom | v2-extends | MVP | S |
| Bulk PBC request generation | At engagement kickoff, generate 150+ request emails to 20+ auditee contacts in one action; staggered sending | Tom, Priya | new-v2 | MVP | M |
| Email-based auditee fulfilment | Auditee replies to request email with attachments; AIMS ingests by thread ID; stages in document queue (complement to David's email-first relationship) | David, Tom | new-v2 | MVP | L |
| Automated reminder cadence | Weekly nag emails to auditees with outstanding items; auto-escalate to AIC after 10 days; to partner after 20 days | Tom, David, Priya | new-v2 | MVP | M |
| PBC status grid | Grid view of requests × auditee contacts with status cells (not-requested / requested / received / accepted / rejected) | Tom, Priya | v2-extends | MVP | M |
| Document staging queue | Received documents in a staging area for engagement team to review, accept, and attach to work papers | Tom, Priya, Anjali | new-v2 | MVP | M |
| Rejected-document workflow | Document doesn't meet the request; rejection reason captured; auto-notify auditee to resubmit | Tom, David | new-v2 | MVP | S |
| Bulk status update | Mark 10 related requests as "accepted" in one action when all received together | Tom | new-v2 | MVP | S |
| PBC status report | One-click weekly summary PDF/email for AIC and engagement partner | Tom, Priya, Elena | new-v2 | MVP | S |
| Email template library | Reusable request templates per engagement type (Single Audit, SOC 2, financial audit); tenant-customisable | Tom | new-v2 | MVP | S |
| PBC-to-work-paper linkage | Accepted documents flow from staging queue into work papers with metadata intact | Tom, Anjali | new-v2 | MVP | M |
| PBC dashboard (auditor-facing) | Per-engagement PBC completion %; overdue item count; blockers requiring escalation | Priya, Marcus | v2-extends | MVP | M |
| PBC dashboard (auditee-facing) | David's view of his open, overdue, and completed document requests | David | new-v2 | MVP | M |

---

## Module 8 — Findings & recommendations

> The central output of an audit. Findings (observations of issues), recommendations (auditor's proposed fixes), classifications (severity per applicable pack), linkage to criteria and evidence.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Finding authoring | Structured finding with semantic core + per-pack extensions | Priya | v2-extends | MVP | XL |
| Multi-standard finding rendering | Single finding renders correctly under each attached pack's vocabulary | Priya | new-v2 | MVP | L |
| Finding classification (per-pack) | Array of classifications, one per attached pack with applicable scheme (GAGAS tier, IIA severity, ISO NC category) | Priya | new-v2 | MVP | L |
| Finding linked evidence | Reference specific work papers, test results, external documents | Priya, Anjali | v1 | MVP | M |
| Finding review workflow | Preparer → AIC → CAE approval stages | Priya, Marcus | v1 | MVP | M |
| Recommendation authoring | Separate entity with M:N to findings (ADR-0003 data model) | Priya | v2-extends | MVP | L |
| Recommendation presentation mode | Per-target-report choice: inline / separate / suppressed / both | Priya | new-v2 | MVP | M |
| `soxSuppressRecommendation` flag | Finding-level flag forcing suppression (for PCAOB ICFR cases) | Priya | new-v2 | v2.1 | S |
| Management response capture | Auditee's formal response (concur / partially concur / disagree) per finding | David, Priya | v1 | MVP | M |
| Finding status lifecycle | Draft → In review → Approved → Issued → Resolved (via CAP verification) | Priya, Marcus | v1 | MVP | M |
| Finding amendment (post-issuance) | Formal amendment process; post-issuance changes create new records, original stays immutable | Marcus | v2-extends | v2.1 | M |
| Finding search + filters | By status, classification, engagement, period, recommendation-addressed | Priya, Marcus | v1 | MVP | M |
| Repeat-finding detection | Flag findings that match a prior period's finding (same criteria, same condition) | Priya | v2-extends | MVP | M |
| Finding numbering | Per-engagement or per-fiscal-year sequence (configurable); Single Audit numbering convention supported | Priya | v1 | MVP | S |
| Finding inline comments | Reviewer comments anchored to specific finding fields (criteria, condition, etc.); resolution tracking | Priya, Marcus | new-v2 | MVP | M |
| Finding @mentions | @username in finding text fields; tagged user receives notification (see Module 16a) | Priya, Marcus, Anjali | new-v2 | MVP | S |
| Finding track-changes during finalisation | Reviewer's edits visible as tracked changes during the review-and-approve phase; accept/reject per change | Priya, Marcus | new-v2 | MVP | L |
| Finding diff view | Compare two versions of a finding (e.g., pre-review vs. post-review) side-by-side | Priya, Marcus, Reviewer | new-v2 | v2.1 | M |

---

## Module 9 — Corrective action plans (CAP) & follow-up

> Auditee's plan to address findings; our system tracks the plan and verifies completion, but does not manage the implementation work itself (per `docs/06 §7.3`).

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| CAP authoring | Auditee (David) drafts remediation plan: what, who, when | David, Priya | v1 | MVP | M |
| CAP approval | Priya / Marcus review CAP; accept, request revision, or reject | Priya, Marcus | v1 | MVP | M |
| CAP status tracking | In-progress / completed / overdue / verified | David, Priya | v1 | MVP | M |
| CAP evidence upload | David uploads proof of completion | David | v1 | MVP | S |
| CAP verification | Auditor verifies completion evidence; marks CAP as verified or requests more | Priya | v1 | MVP | M |
| CAP follow-up audit | Formal follow-up audit type specifically testing prior-period CAP completion | Priya | v1 | MVP | L |
| Overdue CAP reminders | Email / dashboard alerts for CAPs past target completion date | David, Priya | v1 | MVP | S |
| CAP dashboard (auditee view) | David's view of his open, overdue, completed CAPs | David | v1 | MVP | M |
| CAP dashboard (auditor view) | Marcus's cross-engagement view of CAP completion rates | Marcus | v2-extends | MVP | M |
| Summary Schedule of Prior Audit Findings | Single Audit required report aggregating current-status of prior findings | Priya | v1 | MVP | M |

---

## Module 10 — Report generation & compliance statements

> The deliverable. Multi-report per engagement (per ADR patterns), compliance-statement builder, PDF rendering.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Report composition | Assemble findings + recommendations into a report per template | Priya | v1 | MVP | L |
| Report templates per pack — MVP scope | Two pack-driven reports: **Yellow Book report** (GAGAS attestation) + **Schedule of Findings and Questioned Costs** (Single Audit). Sufficient to demo multi-report differentiator without the full 7-report scope | Priya | v2-extends | MVP | L |
| `attestsTo` per report | Each report declares its target pack; compliance statement built automatically | Priya | new-v2 | MVP | M |
| Multi-report per engagement (MVP scope) | Two reports from one engagement, each rendering the same finding differently per attached pack | Priya | new-v2 | MVP | L |
| Additional Single Audit reports (5 of 7) | SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, Corrective Action Plan (as formal report), Audit Engagement Letter formalisation — full 2 CFR 200.515(d) coverage | Priya | new-v2 | v2.1 | XL |
| Additional pack-aligned reports | IIA Audit Committee report, ISO Audit Report, PCAOB report templates | Priya | new-v2 | v2.1 | XL |
| Compliance-statement builder (MVP scope) | Assembles "conducted in accordance with..." sentences for the 2 MVP reports from attached packs | Priya | new-v2 | MVP | M |
| Report review workflow | Review stages; track changes; approval per reviewer | Priya, Marcus | v1 | MVP | M |
| Report PDF generation | pdfmake-based rendering with pack-specific styling | Priya | v1 | MVP | L |
| Report DOCX generation | Word-format output for customers requiring editable distribution | Priya | v2-extends | v2.1 | L |
| Report HTML preview | In-app preview matching final PDF structure | Priya | v1 | MVP | M |
| Report versioning | Each sign-off version retained; final issued version locked | Priya, Marcus | v1 | MVP | M |
| Report signing / issuance | Formal issuance by CAE; locks report and all findings | Marcus | v1 | MVP | M |
| Report distribution list | Pack-per-report recipient list; distribution tracking | Priya, Marcus | v1 | MVP | M |
| Annual Summary Report | 15-section annual report aggregating year's activity | Marcus | v1 | MVP | L |
| Report branding | Per-tenant logo, letterhead, styling in report output | Sofia | v1 | MVP | S |
| Report redaction for distribution | Redact auditee-sensitive content for specific audiences (e.g., public version vs. board version) | Priya, Marcus | v2-extends | v2.1 | L |

---

## Module 11 — QA (QAChecklist, Peer Review, Independence)

> Quality assurance infrastructure. GAGAS §5.01 requires a QA program; IIA Standard 15 requires QAIP; peer review is periodic. Independence declarations are a per-engagement prerequisite.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| QA checklist (60+ items) | GAGAS QA checklist execution per engagement | Priya, Marcus | v1 | MVP | L |
| QA checklist by pack | Pack-driven checklist selection (GAGAS + IIA produces both checklists) | Priya | v2-extends | MVP | M |
| Peer review management | Triennial external peer review coordination and evidence assembly | Marcus, Kalpana | v1 | v2.1 | L |
| QAIP management (IIA) | Ongoing internal + periodic external QAIP per IIA Standard 15 | Marcus | v2-extends | v2.1 | L |
| Independence declaration | Per-engagement auditor independence assertion per GAGAS §3.26 / IIA §11.2 | Priya, Anjali | v1 | MVP | M |
| Independence impairment reporting | Flag and track any identified impairments | Priya, Marcus | v1 | MVP | M |
| Annual independence declaration | Annual affirmation (IIA-style) per auditor | Priya, Anjali | v1 | MVP | S |
| Independence rules by pack | Strictness resolver applies the stricter of attached packs' rules (24-mo GAGAS vs. 12-mo IIA) | Priya | new-v2 | MVP | M |
| Peer review evidence bundle | Export curated sample of engagements + supervisory review + CPE + QAIP in reviewer-friendly format | Marcus, Kalpana | new-v2 | v2.1 | L |
| QA dashboard | Cross-engagement QA checklist completion rates; flagged issues | Marcus | v1 | MVP | M |

---

## Module 12 — Staff, time, CPE

> The people side. Staff directory, time tracking against engagements, CPE (Continuing Professional Education) hours per applicable standard.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Staff directory | Auditors + roles + certifications (CIA, CPA, CISA) + contact info | Marcus, Kalpana | v1 | MVP | S |
| Time tracking | Per-engagement time entries; billable/non-billable; categorised | Priya, Anjali | v1 | MVP | M |
| Time approval workflow | Weekly time submission; AIC approves per-engagement hours | Anjali, Priya | v1 | MVP | M |
| CPE tracking | Per-auditor CPE hours accumulation by category (governmental, technical, other) | Priya, Anjali, Marcus | v1 | MVP | M |
| CPE compliance per pack | GAGAS 80/2yr w/ 24 governmental; IIA CIA 40/yr; strictness resolver output | Priya, Marcus | new-v2 | MVP | M |
| CPE event entry | Log courses attended, self-study, instruction, with documentation attached | Priya, Anjali | v1 | MVP | S |
| CPE expiration alerts | Alert auditors and CAE when CPE deadlines approach | Priya, Marcus | v1 | MVP | S |
| CPE dashboard (auditor view) | Per-auditor compliance status, hours by category, remaining required | Priya, Anjali | v1 | MVP | S |
| CPE dashboard (CAE view) | Cross-team CPE compliance; who's at risk of shortfall | Marcus | v1 | MVP | S |
| CPE evidence for peer review | Export per-auditor CPE records for the review period | Marcus, Reviewer | v1 | v2.1 | S |

---

## Module 13 — Annual plan vs. actual & board reporting

> The Audit Committee / Board-facing view of the function's annual operations. Overlaps Module 3 (annual plan) at the dashboard level; overlaps Module 10 (reports) at the formal Board deliverable.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Board reporting dashboard | Executive view: plan completion %, key findings by rating, CAP compliance, hours utilisation | Marcus | v2-extends | MVP | M |
| Board presentation pack export | Formatted slides / PDF for quarterly Audit Committee presentation | Marcus | v2-extends | v2.1 | M |
| Audit Committee communication log | Log of formal communications to the Audit Committee (per IIA Standard 15.3) | Marcus | new-v2 | v2.1 | S |
| Annual summary report (already in Module 10) | See Module 10 | Marcus | v1 | MVP | — |

---

## Module 14 — Standards pack management (new in v2)

> The distinguishing capability. Pack authoring, versioning, publishing, dependency management, validation. Some of this is a customer capability (tenant-specific packs); some is a platform capability (the public pack registry Aisha publishes to).

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Pre-built pack library | Ships with GAGAS:2024, IIA_GIAS:2024, ISO_19011:2018, SOC2:2017, SINGLE_AUDIT:2024 | All | new-v2 | MVP | — (content) |
| Pack attachment UI (engagement-level) | Select packs at engagement creation; sensible defaults per engagement type | Priya, Marcus | new-v2 | MVP | M |
| Pack browsing & version viewer | View pack content: workflows, finding elements, classifications, rules | Priya, Kalpana | new-v2 | MVP | M |
| **Pack annotation/override (MVP-era differentiator)** | Tenant-scoped overrides on a shipped pack: override retention periods, independence rules, classification thresholds, add additional checklist items, add additional workflow stages. Structured forms, not JSON editing. Preserves pack versioning (overrides migrate with pack version updates where underlying fields are unchanged). | Kalpana, Marcus | new-v2 | MVP | L |
| Annotation-impact preview | Before saving an override, preview how the override changes an existing engagement or a sample engagement | Kalpana | new-v2 | MVP | M |
| Annotation version history | Each override has versioned history; diff two versions; revert if needed | Kalpana | new-v2 | MVP | S |
| Custom pack authoring (full, from-scratch — tenant-level) | Author a complete custom methodology / overlay / control framework specific to the tenant | Kalpana | new-v2 | v2.2+ | XL |
| Pack authoring SDK (external, consortium authors) | CLI + validation framework for consortium pack authors (Aisha) | Aisha | new-v2 | v2.2+ | XL |
| Private consortium pack registry | Discovery + publication for consortium-authored packs (closed membership, not public open-source) | Aisha, Kalpana | new-v2 | v2.2+ | XL |
| Pack version transition management | UI for CAE/Director to plan transition of engagements to a new pack version | Marcus, Kalpana | new-v2 | MVP | L |
| Pack dependency graph visualization | Shows which regulatory overlays depend on which methodology versions | Kalpana | new-v2 | v2.1 | M |
| Pack validation reports | Automated validation per [`data-model/VALIDATION.md`](../data-model/VALIDATION.md) layered rules | Aisha, Kalpana | new-v2 | MVP | M |
| Pack-specific translation layer | Given a finding authored under pack A, render under pack B's vocabulary | Priya | new-v2 | MVP | L |
| Strictness resolver UI | Explain to users which pack is driving which rule (retention, CPE, etc.) | Priya, Marcus | new-v2 | MVP | M |
| Strictness resolver override | Explicit human override on a resolved rule, with documented rationale (for philosophical-conflict cases the resolver can't mechanically resolve) | Marcus, Kalpana | new-v2 | MVP | M |

---

## Module 15 — Integrations

> External interfaces: REST API for integrators, webhooks for event delivery, SSO/SCIM for identity, data import/export. Everything that bridges AIMS with the customer's other systems.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Public REST API (`/v1/*`) | URL-major + dated-header-minor versioned public API (per ADR-0007) | Jin | new-v2 | MVP | L |
| OpenAPI 3.1 spec + developer portal | Published API docs with examples; changelog per dated version | Jin | new-v2 | MVP | M |
| Webhook delivery | HMAC-signed outbound webhooks for events (finding.created, report.issued, etc.) | Jin | new-v2 | MVP | M |
| Webhook event catalog | Documented list of event types with payload schemas and delivery guarantees | Jin | new-v2 | MVP | S |
| API key management | Per-tenant API keys with scoped permissions | Sofia, Jin | new-v2 | MVP | M |
| OAuth2 client credentials | B2B OAuth2 flow for integrator-side server-to-server auth | Jin | new-v2 | v2.1 | M |
| Rate limit headers | Documented limits; `Retry-After` on 429; current-usage headers | Jin | new-v2 | MVP | S |
| SSO configuration (SAML 2.0) | Tenant admin configures IdP integration | Sofia | new-v2 | MVP | L |
| SSO configuration (OIDC) | Tenant admin configures IdP integration | Sofia | new-v2 | MVP | M |
| SCIM 2.0 endpoint | Tenant admin configures IdP-to-AIMS user/group provisioning | Sofia | new-v2 | MVP | L |
| CSV import — engagements | Bulk engagement import from CSV (migration use case) | Priya | v1 | MVP | M |
| CSV import — findings | Bulk finding import from CSV (migration use case) | Priya | v1 | MVP | M |
| CSV import — staff + CPE | Bulk staff/CPE import (migration and SSO-independent use cases) | Marcus, Priya | v1 | MVP | M |
| Star-schema warehouse export | Flat, flattened export for customer BI (per `docs/03 §6.7`) | Marcus, Jin | new-v2 | MVP | L |
| Power BI / Tableau template files | Sample dashboards against the warehouse export schema | Marcus | new-v2 | v2.1 | M |
| Sentry / Datadog integration (optional, per tenant) | Forward telemetry to the tenant's own observability stack | Sofia | new-v2 | v2.2+ | M |

---

## Module 16 — Dashboards & analytics

> Information visualisation across the tenant's audit data. Canned dashboards in-product (five to seven); custom visualisations go to customer BI via the warehouse export (Module 15).

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Home dashboard (per-user) | Role-appropriate landing: Priya sees her engagements, Marcus sees portfolio | All | v1 | MVP | M |
| Engagement progress dashboard | Plan vs. actual hours, phase progression, open observations | Priya, Marcus | v1 | MVP | M |
| Finding aging dashboard | Findings by age, status, severity; overdue-response alerts | Priya, Marcus | v1 | MVP | M |
| Recommendation tracker dashboard | Cross-engagement recommendation status + CAP linkages | Priya, Marcus | v1 | MVP | M |
| CAP compliance dashboard | CAP completion %, overdue CAPs, verification backlog | David, Priya, Marcus | v1 | MVP | M |
| CPE compliance dashboard | Per-auditor CPE status across the team | Marcus | v1 | MVP | M |
| Annual plan vs. actual dashboard | Plan completion against the approved annual plan | Marcus, Kalpana | v2-extends | MVP | M |
| Risk heat map | Visualisation of audit universe entities by risk + coverage cycle | Kalpana, Marcus | v1 | MVP | M |
| Multi-standard coverage view | For multi-standard engagements, show which packs are covered by which procedures | Priya, Kalpana | new-v2 | v2.1 | L |
| Global search (across entities) | Search engagements, findings, work papers, reports by keyword; typeahead results | All | new-v2 | MVP | M |
| Saved searches | User-scoped saved query definitions (e.g., "my open findings," "overdue CAPs on my engagements") | Priya, Marcus, Tom | new-v2 | v2.1 | S |
| Bulk operations (findings) | Select N findings; bulk assign, status-change, tag, classify | Priya, Marcus | new-v2 | MVP | M |
| Bulk operations (CAPs) | Select N CAPs; bulk status update, reminder fire | David, Priya | new-v2 | v2.1 | S |
| Bulk operations (work papers) | Select N work papers; bulk reviewer assignment, tag, archive | Priya, Tom | new-v2 | v2.1 | S |
| Cross-tenant search (platform admin only) | Ravi's tool for support investigations (with scoped access per ADR) | Ravi | new-v2 | MVP | M |

---

## Module 16a — Notifications & alerts center (added R1)

> The unified notification layer across all modules. "Priya @mentioned Anjali in a work paper," "David's CAP is overdue," "Marcus needs to approve a finding," "Tom's PBC reminder cycle fired." Earlier draft of this inventory treated notifications as per-feature fragments; reviewer correctly flagged this as table-stakes infrastructure that warrants its own module.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| In-app notification center | Bell icon + inbox; list of unread / recent notifications across all sources | All | new-v2 | MVP | M |
| @mention support | @username in rich-text fields (findings, work papers, comments) triggers notification | Priya, Anjali, Marcus, Tom | new-v2 | MVP | M |
| Email digest notifications | Configurable: immediate / hourly / daily / weekly digest for low-priority notification types | All | new-v2 | MVP | M |
| Per-user notification preferences | User settings: which event types notify via which channel (in-app / email / off) | All | new-v2 | MVP | S |
| Per-event-type defaults (tenant admin) | Tenant admin sets tenant-wide defaults for notification routing | Sofia | new-v2 | MVP | S |
| Microsoft Teams webhook integration | Tenant admin connects a Teams channel; selected event types post to the channel | Sofia | new-v2 | MVP | M |
| Slack webhook integration | Tenant admin connects a Slack workspace; selected event types post to the channel | Sofia | new-v2 | v2.1 | M |
| Notification deep-links | Every notification links to the specific entity in context (finding, work paper, CAP) | All | new-v2 | MVP | S |
| Mobile push (future) | Push notifications for mobile users when mobile app ships | All | new-v2 | v2.2+ | L |
| Do-not-disturb hours | User-configurable quiet hours; digest delivery rather than immediate during DND | All | new-v2 | v2.1 | S |
| Notification history | 90-day history of sent notifications (for audit / debugging) | Sofia | new-v2 | v2.1 | S |
| Outbound email identity | Configurable per tenant (e.g., `audits@oakfield.edu` not `noreply@aims.io`); DKIM-signed | Sofia | new-v2 | MVP | M |

---

## Module 17 — Audit trail & compliance evidence

> The always-on infrastructure that produces evidence for peer reviews, compliance audits, incident investigations. Mostly invisible to daily users; critical for reviewers and regulators.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Hash-chained audit log | Tamper-evident log of every state change (ADR-0002 & `database/README.md §6`) | Marcus, Ravi, Reviewer | v2-extends | MVP | L |
| Audit log viewer (admin) | Query + filter + export audit events for a time window | Marcus, Sofia | v1 | MVP | M |
| Audit log viewer (platform) | Cross-tenant view for Ravi (with scoped support-mode access) | Ravi | new-v2 | MVP | M |
| Supervisory-review trail | Per-engagement record of who reviewed what, when | Marcus, Reviewer | v1 | MVP | S |
| Compliance evidence exports | Exportable bundles per compliance framework (SOC 2 evidence, ISO 27001 evidence) | Sofia, Ravi | new-v2 | v2.1 | L |
| Immutability enforcement | Post-issuance records are read-only; amendments are new records | Marcus, Priya | v1 | MVP | M |
| Retention policy enforcement | Strictness resolver output drives per-record retention; automated archival | Ravi | new-v2 | MVP | M |
| Right-to-erasure (GDPR Article 17) | Anonymise a specific user's identifying data; audit log retains hash only | David, Sofia | new-v2 | MVP | M |
| Data subject access request (DSAR) tooling | Compile a user's data across the tenant for GDPR/CCPA DSAR response | Sofia | new-v2 | v2.1 | L |

---

## Module 18 — Platform administration (internal, not customer-facing)

> Ravi's tooling. Not something customers see; not something we sell. Here for completeness because it's real product surface.

| Feature | What it does | Personas | v1 | MVP | Complexity |
|---|---|---|---|---|---|
| Tenant search + admin console | Internal-facing console for tenant lifecycle and support | Ravi | new-v2 | MVP | L |
| Scoped support-mode access | Time-bounded, audit-logged cross-tenant read for support escalations | Ravi | new-v2 | MVP | L |
| Regional silo provisioning automation | Standing up a new region per ADR-0006 | Ravi | new-v2 | v2.2+ | XL |
| Incident response console | Aggregated SLO + queue + error view across silos | Ravi | new-v2 | MVP | L |
| SQS inspector (internal tool) | Queue-state debugging (per `devops/QUEUE-CONVENTIONS.md`) | Ravi | new-v2 | v2.1 | M |
| Break-glass access flow | Emergency production-debug access with mandatory justification + audit trail | Ravi | new-v2 | MVP | M |
| Platform-level pack publishing | Our publishing flow for shipped packs (GAGAS, IIA, ISO, etc.) | Ravi | new-v2 | MVP | M |

---

## MVP scope at a glance (post-R1 compression)

R1 review compressed the MVP via specific cuts:

- **DOCX report generation → v2.1.** PDF + HTML preview for MVP.
- **Single Audit 7-report package → 2 reports (Yellow Book + Schedule of Findings and Questioned Costs).** Other 5 reports to v2.1.
- **OAuth2 client credentials → v2.1.** API keys sufficient for MVP integrators.
- **Full custom pack authoring → v2.2+.** Pack annotation/override added to MVP as the MVP-era differentiator.
- **SDK + private consortium registry → v2.2+.** Preserved as strategic roadmap but not MVP-critical.

Counts from the tables above (MVP candidates after compression):

- **Module 1 — Tenant onboarding & admin**: 10 of 12 MVP
- **Module 2 — Identity, auth, SSO**: 13 of 15 MVP
- **Module 3 — Audit universe & annual planning**: 6 of 9 MVP
- **Module 4 — Engagement management**: 15 of 16 MVP (added 2 collab features)
- **Module 5 — APM**: 8 of 8 MVP
- **Module 6 — PRCM**: 6 of 6 MVP
- **Module 7 — Fieldwork**: 12 of 14 MVP
- **Module 7a — PBC request management** (**added in R1**): 14 of 14 MVP
- **Module 8 — Findings & recommendations**: 16 of 18 MVP (added 4 collab features; diff view deferred)
- **Module 9 — CAP & follow-up**: 10 of 10 MVP
- **Module 10 — Reports**: 13 of 17 MVP (DOCX deferred; 5 additional Single Audit reports deferred; IIA/ISO/PCAOB report templates deferred)
- **Module 11 — QA**: 6 of 10 MVP
- **Module 12 — Staff, time, CPE**: 9 of 10 MVP
- **Module 13 — Board reporting**: 1 of 3 MVP
- **Module 14 — Standards pack management (revised)**: 8 of 14 MVP (added pack annotation/override + annotation-impact preview + annotation version history + strictness override; deferred full authoring + SDK + registry)
- **Module 15 — Integrations**: 12 of 16 MVP (OAuth2 client credentials deferred)
- **Module 16 — Dashboards & analytics (expanded)**: 11 of 15 MVP (added global search, bulk ops, cross-tenant search)
- **Module 16a — Notifications & alerts** (**added in R1**): 9 of 12 MVP (Slack integration, mobile push, DND, notification history deferred)
- **Module 17 — Audit trail & compliance evidence**: 7 of 9 MVP
- **Module 18 — Platform admin**: 4 of 7 MVP

**Total after R1 compression**: ~190 MVP features across 20 modules (up from 18), with ~55 v2.1 / v2.2+ deferrals.

The feature count went *up* despite the compression because R1 added critical missing capabilities (PBC module, Notifications module, activity feeds, comments, track-changes). Those additions are load-bearing — shipping MVP without them would produce a product that auditors evaluate unfavourably against existing tools.

The scope is still large. Honest assessment: this MVP is a 12–15 month build for a well-staffed engineering team, not a 6–9 month sprint. [`04-mvp-scope.md`](04-mvp-scope.md) will examine whether this MVP should ship as a single release or as a staged MVP-1.0 (Year 1 Q4) + MVP-1.5 (Year 2 Q2) pattern.

---

## Cross-module dependencies

Some features depend on others. Noted here in case the MVP sequencing needs to account for dependency order:

- **Standards pack management (14)** must ship before **Engagement management (4)** — you can't create an engagement without packs to attach
- **Identity, auth (2)** must ship before almost everything — users need to log in
- **Audit universe (3)** supports **Engagement management (4)** and **Risk assessment (6)** — weakly depended on; MVP could ship with universe as a secondary layer
- **Fieldwork (7)** precedes **Findings (8)** — observations escalate to findings
- **Findings (8)** precedes **Reports (10)** — reports assemble findings
- **Findings (8)** + **CAP (9)** have bidirectional linkage — findings require responses; CAPs verify findings
- **All of the above** feeds into **Audit trail (17)** and **Dashboards (16)**
- **Integrations (15)** can be shipped after the core features exist, but Webhooks need Outbox (already in ADR-0004) and REST API needs the tRPC surfaces mature

---

## What's not in this inventory

Four deliberate omissions worth flagging explicitly:

1. **Real-time collaborative editing (Google-Docs style)** — deliberately out of MVP. Comments + @mentions + track-changes (per Module 8) cover ~80% of the collaboration need at ~15% of the engineering cost. Full CRDT-based real-time multi-user editing across rich-text fields is a major investment that touches every rich-text surface; reviewed and deferred to post-MVP. Noted in the domain review appendix. Accepted risk: modern auditors may draft sensitive final reports in Google Docs / O365 and paste into AIMS at the end; our competitors have the same limitation so this is not a uniquely-us weakness, but it is an honest limitation.
2. **Native mobile / tablet applications** — deliberately out of MVP and likely out of v2.1. The web UI works on tablet form factors (responsive design is table stakes and in scope implicitly across all modules), but a dedicated mobile app for fieldwork auditors is not planned. Flagged as a v2.2+ consideration pending real customer demand. Mobile push notifications in Module 16a are the one mobile-adjacent MVP feature and even those are deferred to v2.2+.
3. **AI-assisted content drafting** — deliberately out. Per [`docs/06 §7.1`](../docs/06-design-decisions.md) "we do not replace auditor judgment with AI auditor," no AI-drafted findings or AI-evaluated evidence. AI-assisted auxiliary capabilities (drafting finding narratives *from auditor-provided evidence*, extracting facts from uploaded work papers, surfacing rule conflicts across attached packs, generating draft compliance statements) are candidates for v2.2+ once the MVP has real usage data to ground the AI features against.
4. **Specific UI patterns and design specifics** — this is a *feature* inventory, not a *UX* inventory. What we're committing to ship (a feature); not how it looks (a UX spec). UX is covered in [`ux/`](ux/) (Phase 6).

---

## References

- [`product/01-product-vision.md`](01-product-vision.md) — vision that frames which features matter most
- [`product/02-personas.md`](02-personas.md) — who the Primary Personas columns reference
- [`product/04-mvp-scope.md`](04-mvp-scope.md) — formal MVP scope decision (Phase 2)
- [`docs/02-worked-example-single-audit.md`](../docs/02-worked-example-single-audit.md) — Oakfield scenario exercising many of these features
- [`data-model/standard-pack-schema.ts`](../data-model/standard-pack-schema.ts) — schema for Module 14 (standards pack management)
- AIMS v1 — the feature set this inventory largely lifts and extends

---

## Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini, framed as "former product manager in the GRC/Audit SaaS space") as part of the same review cycle that covered [`01-product-vision.md`](01-product-vision.md) and [`02-personas.md`](02-personas.md). Key changes landed:

### Missing modules added

- **Module 7a — PBC (Provided-by-Client) Request Management.** Reviewer correctly flagged that "evidence-request fulfilment" buried inside Module 7 vastly understated one of the most operationally-intensive parts of an audit. At larger firms this is a dedicated role (Tom in [`02-personas.md §12`](02-personas.md)); specialised tools (InFlight, Pascal, AuditBoard modules) exist because audit tools handle this poorly. Fix: Module 7a created with 14 features including bulk request generation, automated reminder cadence, status grid, document staging queue, email-based auditee fulfilment (complement to David's email-first persona). All 14 features MVP.
- **Module 16a — Notifications & Alerts Center.** Reviewer flagged that notifications are table stakes but were treated as per-feature fragments in the original inventory rather than their own module. Fix: Module 16a with 12 features (in-app notification center, @mention support, email digests, per-user preferences, Teams integration for MVP, Slack + mobile push + DND deferred). Notifications were not "missing features" in v1 — they were just scattered rather than organised; this is a structural fix, not a scope addition.

### Missing cross-cutting features added

- **Activity feeds (engagement timeline)** in Module 4 — unified chronological feed per engagement.
- **Engagement-level comments** in Module 4 — general team-coordination thread.
- **Finding inline comments + @mentions + track-changes** in Module 8 — four new features supporting the "comments + @mentions + track-changes as 80% of collab at 15% of cost" strategic choice (vs. full CRDT-based real-time collab editing, which stays out of MVP).
- **Global search, saved searches, bulk operations** added to Module 16. Cross-cutting; every review site's RFP responses include these.
- **Cross-tenant search for platform admin** added to Module 16 as Ravi's specific tool.

### MVP compression

Reviewer correctly flagged the original ~159-feature MVP as a 2-year build pretending to be a 1-year sprint. Three specific cuts applied:

- **DOCX report generation → v2.1.** PDF + HTML preview for MVP is sufficient; customers can convert PDF → DOCX externally for the edit-and-redistribute use case until native DOCX ships.
- **Single Audit 7-report auto-generation → 2-report MVP.** MVP ships Yellow Book (GAGAS attestation) + Schedule of Findings and Questioned Costs (the two most-critical). Other 5 reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, Corrective Action Plan as formal report, Audit Engagement Letter formalisation) move to v2.1. IIA / ISO / PCAOB report templates also v2.1.
- **OAuth2 client credentials → v2.1.** API keys with scoped permissions are sufficient for MVP integrators; full OAuth2 client credentials flow assumes B2B integrator volume that doesn't exist at MVP launch.

### Differentiator-alignment compression

The largest cross-cutting change: the earlier draft deferred the platform's main architectural differentiator (custom pack authoring + SDK + public registry) to v2.2+, meaning v1.0 would ship looking structurally indistinguishable from TeamMate+. Reviewer correctly flagged this as the biggest risk. Fix:

- **Pulled pack annotation/override into MVP.** Not full custom pack authoring; rather, a more limited capability where tenants can override rules on the shipped GAGAS (or IIA, or ISO) pack — changing retention periods, adding workflow stages, extending independence checklists. This captures what state audit bureaus like Kalpana's actually need (per [`02-personas.md §5`](02-personas.md)), at ~10% the complexity of full pack authoring. Three MVP features: pack annotation/override UI, annotation-impact preview, annotation version history.
- **Added strictness resolver override UI** as MVP feature — for philosophical conflicts between attached packs that the mechanical resolver can't resolve, Marcus/Kalpana can explicitly document the override rationale.
- **Full custom pack authoring from scratch stays v2.2+.** Same timeline; serves different use case (Aisha the consortium pack author, not Kalpana the state bureau director — see [`02-personas.md §5-6`](02-personas.md)).
- **Pack authoring SDK + private consortium registry stay v2.2+.** Preserved in the roadmap as strategic but explicitly not MVP.

### Feature-count evolution

- **Pre-R1 MVP**: ~159 features across 18 modules
- **Post-R1 MVP**: ~190 features across 20 modules
- **Post-R1 v2.1 / v2.2+ deferrals**: ~55 features

The MVP feature *count* went up (not down) despite the compression because the critical missing modules (PBC, Notifications) added real scope that competing tools have and our original draft didn't. The compression affected *specific high-complexity features within modules* (DOCX, 5 Single Audit reports, OAuth2 client credentials, full pack authoring) while the addition affected *breadth of critical capability* (PBC, notifications, collaboration features).

Honest timeline assessment: this is a **12-15 month MVP build** for a well-staffed engineering team, not a 6-9 month sprint. [`04-mvp-scope.md`](04-mvp-scope.md) will decide whether to ship as a single MVP 1.0 (Year 1 Q4) or to stage as MVP 1.0 (a narrower slice, Year 1 Q4) + MVP 1.5 (the rest, Year 2 Q2). That is the single most important scope decision still outstanding.

### What R1 explicitly did not change

- **The 18 original modules.** All remained valid; only 2 modules were added (7a PBC, 16a Notifications).
- **Persona shorthand in the table columns.** Extended with Elena and Tom, but existing persona shorthand preserved.
- **The MVP / v2.1 / v2.2+ / stretch tag framework.** Unchanged; only specific features re-tagged.

---

*Last reviewed: 2026-04-21.*
