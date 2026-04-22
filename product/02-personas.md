# Personas

> Who uses AIMS v2, what they do with it, what they need from it. The Oakfield cast from [`docs/02-worked-example-single-audit.md`](../docs/02-worked-example-single-audit.md) shows up in full, plus non-Oakfield roles the worked example didn't cover. Every feature spec in [`features/`](features/) references these personas by name so the "who wants this?" question stays concrete.

---

## How to read this

Personas are not user-research artifacts pretending to be literal individuals. They're archetypes — "a representative user with these responsibilities, goals, and pain points" — with enough detail that product and engineering discussions can use them as shared reference points rather than debating "would a user want X?" in the abstract.

Each persona includes:

- **Role** — their job title and organisational position
- **Responsibilities** — what they're accountable for
- **Goals** — what success looks like for them (not what they want from our product specifically; what they want from their job)
- **Pain points** — what's hard or frustrating in their current workflow
- **Product relationship** — how they interact with AIMS v2; what they do frequently vs. rarely
- **Key capabilities needed** — the features they rely on most
- **Access profile** — what they can see and do; compliance-driven constraints
- **Anti-patterns** — what *not* to design for them (where easy assumptions are wrong)

The Oakfield personas (§1–§4) were introduced in the worked example. Non-Oakfield roles (§5–§10) are the rest of the surface.

---

## 1. Priya Sharma — Auditor-in-Charge (AIC), Oakfield State University Internal Audit

### Role

Priya is a CIA-certified senior auditor at Oakfield State University's Internal Audit Division. She leads the Oakfield FY27 Single Audit as Auditor-in-Charge: plans the engagement, directs the work of the staff auditors, authors the findings, and coordinates with the CAE on the final report issuance.

### Responsibilities

- Translate the approved audit plan into a detailed engagement program (risk assessment, test scope, sampling methodology)
- Supervise 2–4 staff auditors per engagement
- Perform the higher-judgment work herself (finding writing, management-response review, compliance-with-criteria analysis)
- Ensure GAGAS documentation sufficiency — every finding traceable to evidence, every procedure supervised per §6.33
- Interface with the Oakfield CFO's office for management responses on draft findings
- Draft the Yellow Book report; the CAE signs and issues

### Goals

- Complete engagements on schedule (budgeted hours vs. actual) with no peer-review issues flagged two years later
- Develop the staff auditors on her team — delegate work that stretches them; review work that teaches
- Maintain CPE currency: 80 hours per 2-year cycle, 24 governmental, documented
- Not have the final report delayed by avoidable quality issues on her side

### Pain points

- Typing the same finding content three times — once for Yellow Book, once for Audit Committee, once for Single Audit Schedule — because the existing tool (AIMS v1) models one report per engagement
- Tracking which rules apply (GAGAS retention = 5 yr; Single Audit retention = 3 yr; which wins?) without maintaining her own rule spreadsheet
- Reviewing staff work papers in a system whose "supervisory review" feature is checkbox-driven rather than integrated with the work itself
- Management responses that arrive late and force her to rush final draft assembly

### Product relationship — **primary heavy user**

Priya is in AIMS every working day, often for several hours. She authors findings, reviews staff work papers, escalates observations to findings, manages the engagement's phase progression, reviews reports before CAE sign-off. She is the single most important persona for getting the UX right.

### Key capabilities needed

- Finding authoring with multi-standard rendering (the feature that eliminates the triple-typing pain)
- Work-paper review (inline commenting, sign-off, linking to findings)
- Engagement dashboard (hours burned vs. budget, open observations, phase gates)
- Review workflows (her team submits; she reviews; she submits; CAE reviews)
- Multi-report generation (Yellow Book + Audit Committee + Schedule of Findings produced from the same finding set)
- Compliance-statement builder (assembles the "conducted in accordance with..." sentence correctly per report)

### Access profile

Role: `Auditor-in-Charge` on the specific engagements assigned to her. Can edit engagements she's assigned to; cannot modify engagements outside her assignment. Can approve findings through her stage of the workflow but not through the CAE stage.

### Anti-patterns

- Do not design for Priya as a tool-power-user who enjoys configuration. She wants sensible defaults and fast paths for common cases; she doesn't want to configure the engagement's workflow every time.
- Do not assume Priya has deep methodology-pack knowledge. She knows GAGAS and IIA deeply; she does not need to know the schema of a `StandardPack` record. Pack attachments should be selectable by standard name + version, not by JSON editing.
- Do not design admin-adjacent flows for Priya. She doesn't manage users, she doesn't configure SSO, she doesn't set up workflows. Those are the CAE's or an admin's job.

---

## 2. Marcus Chen — Chief Audit Executive (CAE), Oakfield State University Internal Audit

### Role

Marcus leads Oakfield's Internal Audit Division. CPA + CIA, 18 years in public-sector audit, reports functionally to the University Board's Audit Committee and administratively to the Chief Financial Officer. Seven auditors report to him including Priya.

### Responsibilities

- Annual audit plan — risk-assessment-driven selection of engagements, approved by the Audit Committee
- Final sign-off on every issued report and every material finding
- Peer review management (triennial GAGAS requirement)
- Quality Assurance and Improvement Program (QAIP) per IIA Standard 15.1
- Annual Internal Audit Summary Report to the Board
- Board and Audit Committee reporting (quarterly reviews, incident briefings)
- CPE program management for his team
- Budget and staffing for the function

### Goals

- Clean peer review outcome every 3 years (no modified opinions)
- Audit Committee confident in the function's coverage and rigor
- Staff retention through engagement variety and professional development
- No regulatory surprises — findings that management can act on, reports timely enough to inform Board decisions

### Pain points

- Reviewing a report package in Word, with tracked changes from three different reviewers, and reconciling which changes are substantive vs. editorial
- Explaining to the Audit Committee what changed between 2018 GAGAS and 2024 GAGAS and what it meant for the division's procedures
- Coordinating Single Audit completion deadlines (Federal Audit Clearinghouse filing 9 months post-fiscal-year-end) across multiple concurrent engagements
- Peer review prep — re-gathering evidence of supervisory review across years of engagements

### Product relationship — **regular user, medium depth**

Marcus is in AIMS multiple times per week but usually briefly. He reviews findings at the sign-off stage, browses dashboards for the quarterly Board briefing, drills into specific engagements when Priya flags something requiring his attention. He does not author findings himself, does not write work papers, but he does review most reports before issuance.

### Key capabilities needed

- Approval workflow inbox — findings + reports awaiting his review, sorted by deadline urgency
- Engagement portfolio dashboard — all active engagements, their phase, their budget status, their flagged risks
- Annual Summary Report generator (auto-populates most sections from the year's engagements)
- CPE compliance dashboard (are his auditors meeting GAGAS 80/2yr?)
- Peer review evidence viewer (show me all supervisory review sign-offs across the last 3 years for a representative engagement)

### Access profile

Role: `CAE`. Can approve findings and reports at the highest stage. Can view all engagements in the Oakfield tenant. Can override assignments (reassign an engagement to a different AIC if needed). Cannot see other tenants' data.

### Anti-patterns

- Do not make Marcus type. He reviews and approves; he does not author. Long-form input is out of his workflow.
- Do not expect Marcus to maintain configuration. SSO settings, tenant admin, system-level configuration — someone else handles that.
- Do not bury approvals behind multiple clicks. The approval workflow is his most frequent interaction; one click from inbox to finding-in-context is the right target.

---

## 3. Anjali Das — Staff Auditor, Oakfield State University Internal Audit

### Role

Anjali is a 2nd-year staff auditor on the Oakfield FY27 Single Audit, reporting to Priya. CPA-track (sitting for exams), not yet CIA-certified. Responsible for executing specific test procedures, documenting evidence in work papers, drafting preliminary observations for Priya's review and potential escalation to findings.

### Responsibilities

- Execute test procedures per the audit program Priya approved
- Document work in work papers (the reviewable record of what was tested, how, and what was found)
- Draft initial observations when test results suggest an issue; escalate to Priya for judgment on whether they rise to a finding
- Maintain her own CPE hours
- Attend engagement team meetings and contribute to planning discussions

### Goals

- Complete her assigned test procedures within the budgeted hours
- Produce work papers that pass Priya's review without excessive rework cycles
- Learn enough from each engagement to grow toward senior auditor
- Pass her CPA exams; maintain her CPE currency

### Pain points

- Work papers that feel like box-ticking bureaucracy rather than structured evidence documentation
- Re-entering the same evidence into multiple work papers when testing touches multiple control objectives
- Unclear review feedback — "please redo the work paper" without specifics on what to change

### Product relationship — **heavy user, narrower surface**

Anjali is in AIMS daily during fieldwork phases. She spends most of her time in work papers, less in findings. She rarely touches reports (Priya drafts, Marcus reviews, Anjali reads when finalised). She does not touch configuration, admin, or reference data.

### Key capabilities needed

- Work-paper authoring (structured templates per engagement type; evidence attachment; cross-referencing)
- Sampling worksheets (pick a representative sample of transactions to test; document the selection methodology)
- Observation recording (noting a potential issue; flagging for Priya)
- Testing templates (per engagement type; reusable across engagements)
- Personal CPE tracker (her hours, her credentials)

### Access profile

Role: `Staff Auditor` on the specific engagement. Can author work papers and observations on the engagements she's assigned to. Cannot escalate observations to findings herself — that's Priya's judgment call. Cannot approve anything.

### Anti-patterns

- Do not design Anjali's flows around the assumption that she knows the full methodology. She is still learning GAGAS; she should not have to configure pack-related things. The system should render the forms correctly based on the engagement's pack without requiring her to pick the right schema.
- Do not hide review feedback from her. If Priya rejects a work paper, Anjali needs the specific comments inline, not a "rejected — see Priya" banner.

---

## 4. David Lee — Chief Financial Officer, Oakfield State University (Auditee Role)

### Role

David is the University's CFO, reporting to the President. During the Single Audit, he is the primary auditee-side contact — responsible for providing requested documentation, coordinating responses from departments under his authority, and drafting management responses to preliminary findings.

### Responsibilities

- Produce requested documentation (trial balance, general ledger extracts, board minutes, grant-award letters, policy documents) in a timely manner
- Review draft findings; concur, dispute, or propose corrective actions
- Oversee implementation of corrective action plans for accepted findings
- Coordinate with the Federal Audit Clearinghouse submission once the audit package is ready

### Goals

- The audit completes without surprises that embarrass the University to the Board or to federal stakeholders
- Findings, when they arise, have remediation paths that are actually achievable by his organisation
- Minimal disruption to normal operations during fieldwork
- No questioned-costs findings that result in federal reimbursement demands

### Pain points

- Evidence requests that arrive as ad-hoc emails, requiring manual cross-referencing of what was already provided
- Draft findings worded in a way that feels accusatory rather than collaborative
- Corrective action plans that bounce between versions as the auditor refines expectations
- Having no view into the audit's status until the draft report lands

### Product relationship — **email-first, with portal for heavy interactions**

An honest description of auditee behaviour: David does not enjoy logging into audit tools. Neither do most auditees. They log in once, set a password, forget it three weeks later, and end up emailing PDFs to Priya when requests come in. Designing for portal-as-primary-interaction is a well-documented B2B GRC trap.

AIMS v2's design inverts the traditional auditee-portal approach. Most of David's interactions with AIMS happen via **email**, not via a portal login:

- Priya sends an evidence request from AIMS → David receives an email with the request + a secure upload link that does not require login for small files
- David replies to that email with documents attached → AIMS ingests the reply, matches the request by the email thread ID, attaches the documents to the appropriate work papers, notifies Priya of the receipt
- Priya sends a draft finding for management response → David receives the draft in his inbox, clicks a signed link to compose his response inline (single-use authenticated link; no password)
- CAP progress updates, overdue reminders, final-report notifications all flow through email

The portal **exists** for heavier interactions where email isn't sufficient: reviewing a week's worth of evidence requests as a batch, drafting a multi-page management response that needs preservation across sessions, authoring a Corrective Action Plan with multiple task dependencies. David logs in episodically during intensive 1–2 week windows (management-response period, CAP authoring period) and is absent otherwise.

This email-first pattern is a deliberate architectural choice from the earlier [`docs/06 §7.3`](../docs/06-design-decisions.md) "we do not build an auditee project management tool" position. Auditees don't want to live in our product; our product should meet them in their inbox.

### Key capabilities needed

- **Email-based evidence response** — reply to the evidence request email with attachments; AIMS ingests the reply, matches by thread ID, attaches documents to work papers, notifies the auditor (no portal login needed)
- **Secure single-use authenticated links** — management response, CAP sign-off, and other document-review interactions delivered via signed email link (no password)
- **Portal inbox for batch review** — when David does log in, show him all open evidence requests, draft findings, and CAPs he owns (complement to email, not replacement)
- **Document upload via portal** — for larger files (>25 MB) where email fails; categorisation aligned to the auditor's request
- **Draft finding review** — see the finding, the criteria, the condition; compose a management response inline (inbox or portal)
- **Corrective action plan authoring** — what will be done, by whom, by when; portal-based because multi-task CAPs don't fit in email
- **Follow-up status view** — status of CAPs past target completion; delivered both as weekly digest email and portal dashboard

### Access profile

Role: `Auditee Contact` on specific engagements. Can view and respond to findings where he is listed as the management-response contact. Cannot view other engagements, other tenants, or other auditee contacts' work. Auditee data within the audit (his organisation's financial statements, work papers referencing his organisation) is visible where the auditor has explicitly shared it.

### Anti-patterns

- Do not design David's UI as a mini-version of Priya's. His mental model is the audited organisation's perspective, not the auditor's. "Your findings" means "findings against your organisation," not "findings you authored."
- Do not require auditee users to learn audit terminology to use the portal. Translate: "Management Response" is clearer than "§6.54 response"; "Corrective Action Plan" is clearer than "CAP" in first-time UI.

---

## 5. Kalpana Rao — Audit Function Director, State of California Bureau of State Audits (non-Oakfield persona)

### Role

Kalpana runs a 150-person state-level audit function. Reports to the State Auditor (elected position). Sets methodology standards for the bureau, maintains the bureau's audit manual, approves engagement plans at the methodology level, handles external peer review coordination.

### Responsibilities

- Methodology governance — the bureau maintains its own overrides on GAGAS (specific documentation requirements, state-specific independence rules, governor-access protocols for sensitive findings)
- Approve the annual audit plan covering ~80 engagements
- Manage the triennial external peer review
- Coordinate with the State Auditor's legislative relations team on sensitive findings
- Resource allocation across concurrent engagements
- Career progression for auditors (Kalpana has 4 CAE-equivalent direct reports who each manage ~35 auditors)

### Goals

- The bureau's methodology stays current with GAGAS updates and state-specific requirements
- External peer review passes cleanly every 3 years
- Findings that embarrass the executive branch are handled with political sophistication (the reports are still accurate; the release timing and framing are managed)
- The bureau retains its staff despite public-sector compensation ceilings

### Pain points

- The bureau's custom overrides on GAGAS live in a 12-page Word document that's maintained manually; staying current with GAGAS updates means manually reconciling the bureau's overrides against new GAO guidance
- Rolling out a methodology change across 150 auditors is a training-and-documentation exercise, not a configuration change
- Evidence for peer review prep is scattered across years of engagement files

### Product relationship — **infrequent power user of pack annotation/override**

Kalpana is in AIMS episodically — during annual planning, during methodology updates, during peer review prep. Not daily. When she is in, her depth is real but her scope is narrower than initially framed:

**An earlier draft of this persona had Kalpana "authoring a structured methodology pack from scratch" as her primary capability need. This was wrong.** State audit bureaus do not write structured methodologies from scratch. The bureau's audit manual is a 12-page Word document that says something like "we follow GAGAS 2024, with these specific exceptions and additions." It is an *override layer* on a published methodology, not a parallel methodology.

Kalpana's real need, correctly framed: **annotate and override the shipped GAGAS pack with the bureau's specific rules**. Examples of what she'd actually do:

- "The shipped GAGAS pack says documentation retention is 5 years; our bureau policy requires 7 years for state-security-adjacent engagements. Override the retention field for that engagement type."
- "The shipped GAGAS pack's independence rule refers to GAGAS §3.26; our bureau adds state-specific disclosure requirements. Extend the independence checklist with three additional state-specific items."
- "The shipped GAGAS pack's workflow doesn't include our bureau's Governor's Office notification step before any finding touching executive-branch departments. Add a workflow stage between AIC-review and CAE-review, with the specific notification recipients."

These overrides are tenant-scoped, structured, versioned alongside the shipped pack, and visible in the engagement's workflow. They are **not** a new pack; they are an extension layer on top. This is meaningfully simpler than full custom pack authoring — maybe 10% the complexity — and captures what state audit bureaus actually need.

Full custom-methodology authoring (which is what Aisha would use in §6, in the post-MVP timeframe) is a different capability. Most state bureaus don't need it; they need the annotation/override capability. [`03-feature-inventory.md` Module 14](03-feature-inventory.md) reflects this split: pack annotation/override is MVP; full pack authoring + SDK is v2.2+.

### Key capabilities needed

- **Pack annotation/override UI** — override specific rules on the shipped GAGAS pack (retention periods, independence requirements, workflow stages, classification thresholds); structured forms + preview of how the override affects a sample engagement
- **Methodology version management** — when GAGAS publishes a new revision, Kalpana sees what changed, plans the bureau's transition, communicates to her CAEs which engagements transition and when; her overrides auto-migrate to the new version where the underlying field structure is unchanged; manual reconciliation flagged where GAGAS's fields moved or changed meaning
- **Peer review evidence bundle** — given a sample of engagements, export the supervisory-review trail, CPE documentation, independence declarations, and QAIP records in a reviewer-friendly format
- **Annual plan authoring and approval** — high-level engagement portfolio management
- **Cross-engagement analytics** — hours, findings, staff utilisation across the whole bureau

### Access profile

Role: `Audit Function Director`. Can view all engagements in the bureau's tenant. Can author pack annotations/overrides (not full custom packs — that's a post-MVP capability). Can approve annual plans. Cannot approve individual engagement findings (that's the CAE layer below her).

### Anti-patterns

- Do not expect Kalpana to write from scratch what a published standard already covers. She wants to extend GAGAS with her bureau's 12-page Word-doc overrides translated into structured annotations — not rebuild GAGAS.
- Do not design her flows assuming she uses AIMS daily. Resume-ability matters more for her than for daily users; the system should remember where she was in the override-authoring flow a week later.
- Do not conflate Kalpana's real need (annotation/override) with Aisha's post-MVP aspiration (authoring a full methodology from scratch). These are different features serving different use cases.

---

## 6. Dr. Aisha Okonkwo — Consortium Pack Author (post-MVP persona, realistically scoped)

### Role — and a reframing note

Aisha is the "external pack author" archetype. An earlier draft framed her as a contributor to an **open-source public pack ecosystem** — like an npm author publishing methodology packs freely to anyone. This framing was wrong in a way worth documenting.

Audit standards are not open-source software. The IIA, ISO, AICPA, PCAOB, and IAASB all protect their standards as intellectual property and monetise them through membership dues, certification fees, and paid publications. There is no realistic path to a public GitHub-style registry of methodology packs where anyone can publish a GAGAS variant or an ISO-27001-adjacent control framework. The IP rights, the economic interests, the legitimacy concerns (who gets to publish something called "GAGAS-Texas"?) all argue against a public ecosystem.

The reframed persona below is realistic: Aisha as the author of a **private, consortium-scoped pack** shared among a closed membership of audit shops that opt into the consortium. This is modelled on real-world audit-association patterns (AICPA's Center for Audit Quality membership; INTOSAI working-group sharing; regional state-auditor-association methodology alignment efforts). It's a *private* registry with controlled membership, not a public one.

### Role (reframed)

Aisha is a university professor specialising in public-sector audit methodology, working with the Institute of Internal Auditors Nigeria chapter to produce a **West African Regional Public-Sector Audit Supplement** — a private pack shared among member audit offices in the consortium (perhaps 20–30 SAI offices across West Africa). The supplement extends IIA GIAS 2024 with regional contextual guidance: currency-volatility considerations, limited-IT-controls-maturity audit approaches, specific donor-reporting requirements for UNDP/World Bank-funded programs.

### Responsibilities

- Author and maintain the regional supplement as a structured pack
- Coordinate with the consortium's member offices on pack-content review (private, not public)
- Provide training materials to consortium members on the supplement's application
- Manage the consortium's pack registry (a private, members-only registry hosted by AIMS v2, access-controlled to the consortium's members)

### Goals

- The supplement becomes the standard reference for the consortium's member offices
- Adoption is frictionless for members; non-members cannot access (this is important for the consortium's economic model — membership has value)
- The supplement stays current with IIA GIAS revisions without requiring Aisha's personal effort to port every member's engagements

### Pain points

- No standard format for publishing a methodology supplement within a consortium. The choice today is: publish as a PDF/Word doc (readable, not usable by software), or build custom software per member office that wants to adopt it (expensive, not scalable)
- No way to express "this supplement extends IIA GIAS 2024" in a machine-readable way that downstream tooling can consume

### Product relationship — **post-MVP, consortium-registry contributor**

Aisha is not a user of AIMS v2 in MVP. Her workflow depends on the **pack authoring SDK** and the **private consortium-scoped pack registry**, both of which are v2.2+ capabilities. Shipping the MVP without Aisha being a supported persona is fine — the MVP differentiator (pack annotation/override per Kalpana in §5) demonstrates the architectural capability at a smaller scope.

When the SDK and private registry ship (v2.2+), Aisha's interaction with AIMS is:

- The pack authoring SDK (CLI tool + validation framework) that she uses locally
- The private consortium registry (publishing, versioning, access-controlled discovery for consortium members)
- Documentation and support channels for SDK users

### Key capabilities needed (post-MVP)

- **Pack authoring SDK** — CLI tool + validation framework; Aisha develops locally, runs test engagements to verify her pack works end-to-end
- **Private registry for consortium packs** — publish a new version; control who can access (members of the West Africa Consortium only); version management; audit trail
- **Dependency declarations** — the pack declares it extends IIA GIAS 2024; the pack format captures and validates this relationship
- **Backward-compatibility validation** — when Aisha publishes version 2 of the supplement, tooling tells her which member tenants are on version 1 and what would break
- **Cross-consortium collaboration tooling** — review workflows, comments, multi-author editing for the consortium's content-review process (not present in MVP; deferred)

### Access profile

Aisha is a publisher within a consortium. Her pack is available to consortium members (tenants who are authenticated as having consortium membership). She has no access to any member tenant's actual audit data; she only publishes pack content. Pack content is signed and verifiable.

### Anti-patterns

- Do not pitch AIMS v2's pack authoring as an "open-source community" story. It's a private consortium-registry story. Get that framing right with prospects and in marketing; overpromising a public ecosystem creates customer expectations we cannot meet without renegotiating IP rights with major standards bodies.
- Do not assume Aisha is a software engineer. She's a methodology expert; the SDK needs to be accessible via YAML/structured forms with validation, not require TypeScript or code-compilation literacy.
- Do not require Aisha to host the registry. Registry hosting is our infrastructure; she publishes through our SDK to our hosted registry.
- Do not defer this capability more than v2.2+. If the capability never ships, the "open methodology platform" strategic differentiator evaporates; at some point the SDK + private registry must be real.

---

## 7. Ravi Patel — Platform Administrator (AIMS v2 team, internal persona)

### Role

Ravi is the on-call operations engineer for AIMS v2 at the platform level. Works across `devops/`, `security/`, and the tenant-admin support team. He is not a customer persona — he is one of us.

### Responsibilities

- Respond to operational alerts (API down, DLQ depth, high-error-rate pages)
- Coordinate customer support escalations that require platform-level intervention (tenant data export, tenant offboarding, support access to a specific tenant)
- Execute incident-response playbooks
- Run the regional-silo provisioning process when a new region stands up
- Manage the break-glass access flow for production debugging

### Goals

- Production stays up (SLOs met)
- Customer support escalations resolved within contracted response times
- Security incidents contained per [`security/INCIDENT-RESPONSE.md`](../security/INCIDENT-RESPONSE.md)
- Customer data never exposed through a support access path without audit trail

### Pain points

- Customer asks "why can't my user log in?" — Ravi needs to inspect that tenant's auth config, see failed login attempts, check SCIM sync state, all without seeing the user's actual PII
- A tenant reports wrong data in a report — Ravi needs to reproduce the bug locally, requiring a scrubbed data snapshot of that tenant's state
- An incident spans multiple regional silos — Ravi needs to correlate events across silos' observability stacks

### Product relationship — **operator, not a tenant user**

Ravi is a platform-side user with deliberately-scoped cross-tenant access. Every cross-tenant query Ravi performs is logged. He has access to admin tooling (internal dashboards, SQS inspector, tenant onboarding console) that no customer persona sees.

### Key capabilities needed

- **Tenant admin console** — search tenants, view tenant configuration, trigger tenant-specific maintenance operations (force SCIM resync, reset a tenant's Redis cache, issue a scoped support-access token)
- **Cross-tenant investigation tooling** — with explicit justification requirements, audit-log entry, and time-bounded access
- **Incident response dashboard** — SLOs, queue depth, error rates, regional-silo health, cross-silo trace correlation
- **Tenant lifecycle operations** — provisioning, offboarding, regional migration prep
- **Support ticket integration** — customer's report of a problem is linked to the diagnostic session Ravi opens

### Access profile

Role: `Platform Admin`. Has cross-tenant visibility via deliberate "support mode" sessions that are time-bounded, audit-logged, and require documented justification. Cannot modify customer data routinely; modifications happen through specific, auditable playbooks.

### Anti-patterns

- Do not give Ravi unrestricted cross-tenant read. Even for legitimate support, access must be scoped, time-bounded, logged. A support agent browsing tenant data "just to understand" is a compliance nightmare and a trust-eroding customer experience.
- Do not optimise Ravi's flows at the expense of tenant admins. Ravi's tooling is powerful because it's ours; it should not be the pattern we build user-facing features on.

---

## 8. Sofia Martinez — Tenant Administrator (customer-side, e.g., Oakfield's IT Security)

### Role

Sofia works in Oakfield's central IT Security team. She is not an auditor. She manages Oakfield's identity infrastructure (Okta), security tooling (Sentinel SIEM, CrowdStrike EDR), and vendor relationships (third-party SaaS vendor onboarding, security reviews, DPA execution).

When Oakfield onboarded AIMS v2, Sofia was the technical lead on the customer side — SSO setup, SCIM configuration, security review, signing the DPA. Post-onboarding, she handles periodic maintenance: user lifecycle sync issues, SSO debugging, annual security-review questionnaires.

### Responsibilities

- Onboard new SaaS vendors (security review, DPA execution, SSO/SCIM setup, annual review)
- Manage identity infrastructure across the University's SaaS portfolio
- Respond to security incidents affecting the University
- Ensure vendor compliance with the University's security policies

### Goals

- New vendors integrate cleanly with Okta on first attempt
- Vendor security posture stays aligned with Oakfield's standards
- Incident response is predictable (she knows what to do when a vendor reports a breach)
- Annual security reviews are completed efficiently without endless emails back and forth

### Pain points

- SaaS vendor security documentation that requires a phone call to understand
- SCIM implementations that claim SCIM 2.0 but have vendor-specific quirks
- Annual security questionnaires that take 6 weeks to complete because half the questions have nuanced answers

### Product relationship — **infrequent, deep when engaged**

Sofia interacts with AIMS v2 during onboarding intensively, then episodically — when an SSO misconfiguration surfaces, when a user's SCIM deprovisioning doesn't fire, during the annual review cycle, and during security incidents.

### Key capabilities needed

- **Tenant admin console** (customer-side) — SSO configuration (OIDC / SAML 2.0), SCIM endpoint configuration, session-policy configuration (`require_instant_revocation`, session TTL overrides)
- **Trust center access** — public compliance status, sub-processor list, pre-written security questionnaire responses
- **User/group sync status** — is SCIM healthy? When was the last sync? What errors?
- **Audit log export** — authentication events, admin actions, compliance-relevant state changes for a time window
- **DPA + sub-processor change notifications** — she gets notified when our subprocessor list changes

### Access profile

Role: `Tenant Administrator`. Can configure tenant-wide settings (SSO, SCIM, session policy, data classification rules). Can view audit logs scoped to her tenant. Cannot see audit *content* (engagements, findings, work papers) — her role is infrastructure, not audit substance.

This access separation is deliberate: the University's IT Security team should be able to manage the AIMS deployment without having read access to the Internal Audit Division's findings. Marcus (the CAE) would object — strenuously — to IT being able to read audit work in progress.

### Anti-patterns

- Do not conflate Sofia's role with Marcus's. They are distinct personas with distinct needs and distinct access scopes. AIMS v1 ran them together because SharePoint's permission model is coarse; AIMS v2 must separate them.
- Do not bury security configuration in submenus. Sofia's settings are her landing screen.

---

## 9. Jin Ha — External API Integrator (non-customer persona)

### Role

Jin is a software engineer at a third-party analytics startup building a risk-intelligence dashboard that aggregates audit findings, SOC 2 report statuses, and incident data from multiple tools into a unified risk view for CRO/CISO customers.

Jin is not an AIMS customer. Jin's employer's customers use AIMS and want Jin's product to consume their AIMS data for cross-tool analytics.

### Responsibilities

- Integrate with SaaS APIs (AIMS, AuditBoard, ServiceNow, Sentinel SIEM, etc.) to ingest relevant data streams
- Maintain integration code as vendor APIs evolve
- Handle auth flows (OAuth2, API keys, webhook signatures)
- Monitor integration health and data freshness

### Goals

- Integration ships in a week, not a quarter
- Minimal ongoing maintenance — the vendor doesn't break the contract unannounced
- Data quality — what he ingests matches what the source system shows the end user

### Pain points

- APIs versioned poorly — breaking changes shipped silently; deprecations announced the day before sunset
- Webhook signatures that aren't HMAC-based and can't be verified programmatically
- Documentation that shows the happy path but not the error cases
- Rate limits that aren't documented until they fire

### Product relationship — **external developer, consumes public surfaces only**

Jin interacts with AIMS through:
- The public REST API (`/v1/*` per [ADR-0007](../references/adr/0007-api-versioning-hybrid.md))
- The webhook-receiver endpoints his service exposes (he consumes; we deliver)
- The developer documentation portal (OpenAPI spec, webhook event catalog, SDK if we ship one)

He never sees our frontend, tRPC surface, or internal tooling.

### Key capabilities needed

- **Well-documented REST API** — complete OpenAPI 3.1 spec per dated version; example payloads; error-code catalog
- **Webhook event catalog** — list of event types, payload schemas, delivery guarantees
- **Authentication that's machine-friendly** — API keys with scoped permissions; OAuth2 client credentials for B2B integrations; JWT for user-scoped flows
- **Rate limit visibility** — documented limits per endpoint, HTTP 429 responses with `Retry-After` headers, headers indicating current usage
- **Deprecation signalling** — `Deprecation: true` / `Sunset: <date>` headers per RFC 8594; migration guides published with at least 18 months' lead time
- **Sandbox / test tenant** — a way to develop against realistic data without requiring a real paid customer relationship first

### Access profile

Jin's access is scoped by the API key / OAuth client his customer provisioned. The access is tenant-scoped (same as every authenticated request); the customer controls what scopes are granted (read-only findings, read-write engagements, webhook-only, etc.).

### Anti-patterns

- Do not build the REST API as a thin afterthought on top of tRPC. It's its own surface with its own standards (idempotency keys, pagination, filtering), optimised for external consumers.
- Do not make Jin consult documentation in three places. OpenAPI spec, webhook catalog, error-code list — all in one developer portal.
- Do not change the API contract within a dated version. Integrators pin `Api-Version: 2026-04-20` and expect that shape to be stable forever.

---

## 10. Regulatory Reviewer (peer reviewer, FAC auditor, regulator — non-persistent persona)

### Role

External reviewers who periodically examine AIMS audit outputs for compliance purposes. Three distinct flavours that share enough characteristics to group:

- **GAGAS peer reviewers** — the independent reviewing organisation performing the triennial external peer review of a GAGAS-compliant audit function
- **Federal Audit Clearinghouse auditors** — FAC reviewers examining a Single Audit package for completeness and compliance with 2 CFR 200
- **IIA external QAIP reviewers** — the external quality-assessment team performing the 5-year external QAIP per IIA Standard 15.2

### Responsibilities

Vary by flavour. Common elements: independence from the function being reviewed, structured review protocol, report with findings and recommendations, public or regulator-facing outcome.

### Goals

- Complete the review efficiently with clean, accessible evidence
- Produce a defensible report backed by the reviewed organisation's own records

### Pain points

- Evidence scattered across systems (some in AIMS, some in SharePoint, some in network file shares, some in people's emails)
- Redacting auditee data to produce a reviewable package (GAGAS peer reviewers do not need to see the reviewed function's auditee details)

### Product relationship — **consumer of an evidence export, not a user**

These reviewers typically do not log into AIMS directly. They consume an evidence-export package produced by the function being reviewed (Marcus, in Oakfield's case). The package is a curated set of engagements, work papers, approvals, independence declarations, CPE records, and QAIP evidence in a format suitable for review.

AIMS v2 supports this persona by producing the export package, not by providing login access to the reviewer. Some sophisticated reviews might warrant a time-bounded, scoped login to AIMS — for example, a FAC follow-up inquiry about a specific finding — but that is an exception.

### Key capabilities needed

- **Peer review evidence bundle generator** — given a sample of engagements and a time window, export the supervisory-review trail, CPE records, independence declarations, QA checklist completions, and sanitised (auditee-data-redacted) findings in a reviewer-friendly format
- **Single Audit package generator** — produce the full 2 CFR 200.515(d) package (SEFA, Schedule of Findings, Summary Schedule of Prior Audit Findings, Corrective Action Plan)
- **QAIP evidence assembly** — IIA Standard 15.2 evidence in the format the external QAIP reviewer will expect

### Access profile

No persistent access. If an exceptional reviewer login is warranted, it's a time-bounded scoped role provisioned through Ravi's platform-admin tooling with explicit justification and audit trail.

### Anti-patterns

- Do not design AIMS as a direct review-portal. The review relationship is between the audit function and the reviewer; AIMS supports the function's evidence production, not the reviewer's workflow.
- Do not assume reviewers want polished UI. They want a structured, consumable package (often PDF, often bookmarked, often accompanied by an Excel index). Build for their consumption format, not for their interactive experience.

---

## 11. Elena Vasquez — CPA Firm Audit Partner (Segment A economic buyer)

### Role

Elena is an Audit Partner at Morales Vasquez LLP, a mid-tier regional CPA firm (240 staff) operating across the western US. The firm does financial audits (AICPA + PCAOB for its handful of SEC-registrant clients), Single Audits for ~40 nonprofit grantees annually, SOC 2 attestations for about 50 tech-company clients, and performance-audit engagements for state and local government. Elena leads the firm's assurance practice, owns the P&L, and is accountable to the Managing Partner for the assurance practice's contribution to firm profitability.

This persona is the **economic buyer** for Segment A in [`01-product-vision.md` §2.1](01-product-vision.md). She is not the end-user (those are Priya-equivalents at her firm) but she is the person who signs the contract and renews it. When the contract lapses, Elena decides whether it renews.

### Responsibilities

- Assurance-practice P&L: revenue growth, realisation rate, utilisation, margin
- Client relationships at the senior-partner level (firm's largest or most strategic clients)
- Talent pipeline: partner-track senior managers, retention of high-performers
- Tool and methodology decisions for the practice (subject to Managing Partner / network-firm constraints)
- Risk management: claim loss ratio, malpractice insurance posture, quality-control sign-off
- Cross-sell opportunities: the firm that does a client's SOC 2 should also win that client's Single Audit; the firm that does a financial audit should also win their internal-audit co-sourcing

### Goals

- Grow the assurance practice's revenue by 8–12% annually without corresponding headcount growth (margin expansion)
- Increase realisation rate from 88% to 92% over two years (this is a real number that partners obsess over)
- Reduce the tool-stack friction that frustrates senior managers and causes mid-level turnover
- Win the clients the firm's competitors are losing on service quality, not on price

### Pain points

- Running three audit tools (one for financial audits per the network-firm methodology; TeamMate+ for Single Audit; a separate SOC 2 platform) eats margin and frustrates staff
- Senior managers spend hours reformatting the same finding for three reports (financial audit letter, Single Audit Schedule, SOC 2 attestation report)
- Current tools don't give her a cross-practice WIP dashboard showing realisation by engagement, partner, client
- The Single Audit tool and the SOC 2 tool were procured at different times by different partners and neither is particularly loved

### Product relationship — **infrequent logins, big contract influence**

Elena is not in AIMS daily. She's in the product monthly or quarterly to review WIP and budget-vs-actuals across the firm's engagements. Her relationship with AIMS is mediated: her senior managers (Priya-equivalents) and staff (Anjali-equivalents) live in the tool; she assesses whether the tool is earning its licensing cost by observing their frustration level and her P&L.

But Elena is *the* person to demo to during a sales cycle. If AIMS can show her a cross-engagement WIP dashboard, a realisation-rate breakdown by engagement type, and a tool-consolidation economic case, she's sold. If the demo is only to Priya-level senior managers without Elena in the room, she'll veto the deal at the last minute on budget grounds.

### Key capabilities needed

- **Cross-engagement WIP dashboard** — revenue booked, hours burned, estimated-at-completion realisation by engagement, partner, client, service line
- **Firm-level utilisation dashboard** — auditor utilisation rates, billable-hour percentages, capacity forecasting
- **Client-engagement history view** — for a given client, all audit work the firm has performed across practice lines; useful for partner reviews of client relationships
- **Tool-consolidation economic narrative** — reporting that shows "here's what you'd be paying for three tools; here's what you pay for AIMS v2; here's the senior-manager-hour savings from not reformatting findings"
- **Budget-vs-actuals with variance explanation** — where engagements are burning hours faster than expected, which partners are consistently running over, which engagement types have margin problems
- **Client profitability analysis** — at the client level across all audit work, which clients are margin-positive vs. margin-negative

### Access profile

Role: `Audit Partner`. Can view all engagements in the firm's tenant (not tenant-scoped further; the firm IS the tenant). Can see budget/financial data that staff and senior managers cannot (realisation rates, client profitability). Cannot author or edit engagement work — she reviews, she doesn't do.

### Anti-patterns

- Do not design Elena's dashboards as a simplified version of Marcus's. Marcus cares about compliance outcomes (findings, CAP completion, peer-review readiness); Elena cares about profitability outcomes (realisation, utilisation, margin). Different mental models, different KPIs.
- Do not hide P&L-level data from Elena because it's "sensitive." The Audit Partner IS the person who needs to see it; restricting her access defeats the purpose.
- Do not assume Elena understands audit-technology terminology. She knows audit methodology and firm economics; she doesn't know "tRPC" or "JSONB" or "pack annotation." Demo to her in her language, which is dollars and hours.

---

## 12. Tom Reed — PBC (Provided-by-Client) Request Manager (distinct role at larger shops)

### Role

Tom is a senior associate at Morales Vasquez LLP (the same firm Elena manages in §11) whose primary role is **managing the PBC process** for the firm's 15 largest audit engagements each year. He does not perform audit procedures or draft findings; his entire job is chasing auditees for documents, tracking what's been received, categorising and staging documents for the engagement teams, and escalating overdue items to the engagement partner.

At smaller shops this role doesn't exist — the AIC (Priya-equivalent) manages PBC herself. At firms large enough for dedicated PBC staff, Tom's role is surprisingly common and surprisingly under-served by existing audit tools. Specialised "PBC management" tools (InFlight, Pascal, some AuditBoard modules) exist precisely because the audit tools don't handle this well.

### Responsibilities

- For each of his 15 engagements, build the PBC list at the start of the engagement: 50–300 document requests per engagement, categorised by auditee contact and deadline
- Send request emails to auditees on the engagement's schedule (initial requests at engagement kickoff, follow-up requests as testing progresses, final requests in reporting phase)
- Track status per request: not yet requested, requested, partial response received, acceptable response received, rejected (requires resubmission)
- Nudge auditees on overdue items (weekly email cadence; escalate to AIC after 10 days; escalate to engagement partner after 20 days)
- Stage received documents in a holding area for the engagement team to attach to work papers
- Report weekly to the AIC and engagement partner on PBC completion status

### Goals

- Every PBC request closed (received and accepted) before the fieldwork phase ends
- No engagement blocked by PBC delays
- Auditees treated professionally even when nagging is necessary (auditee relationship matters for next year's engagement)
- His own bandwidth scales — he can't add a 16th engagement to his portfolio without better tooling

### Pain points

- Current tools make PBC a spreadsheet-plus-email workflow; Tom maintains a master Excel file per engagement with status columns, and copy-pastes request text into email templates
- No way to automate the weekly nag cycle; every Monday Tom manually emails every auditee contact with a list of their outstanding items
- No integration between "PBC request fulfilled" and "work paper evidence linked" — once Tom stages the document, the engagement team still has to manually move it into the right work paper
- When an engagement partner (Elena's level) asks "how's PBC going on the Acme engagement?", Tom puts together a manual status summary from his Excel file

### Product relationship — **heavy user of a specific module**

Tom is in AIMS daily during active engagements. His entire day is PBC-management. He touches almost nothing else — he doesn't draft findings, he doesn't review work papers, he doesn't issue reports. His universe within AIMS is the PBC module and the engagement dashboard for the engagements he supports.

### Key capabilities needed

- **PBC list builder** — per-engagement list of document requests, templated from prior-year engagement or standard library, with per-request auditee contact assignment, deadline, category
- **Bulk request generation** — at engagement kickoff, generate 150 request emails to 20 auditee contacts in one action, staggered appropriately
- **Automated reminder cadence** — weekly nag emails to auditees with outstanding items; auto-escalate after 10 / 20 days to AIC / partner
- **Status dashboard per engagement** — grid view of requests × auditee contacts with status cells (not yet requested / requested / received / accepted / rejected); sortable / filterable
- **Document staging area** — received documents queue for engagement team to review, accept, and attach to work papers; rejected documents return to "pending resubmission" with reviewer notes back to the auditee
- **Bulk status update** — mark 10 related requests as "accepted" in one action when they're all received together
- **Email-based auditee fulfilment** — auditee replies to the request email with attachments; AIMS ingests, matches by thread ID, stages in the document queue (see §4 David for the auditee side of this)
- **PBC status report export** — one-click weekly summary PDF/email for Elena and the engagement partner

### Access profile

Role: `PBC Manager`. Scoped to the engagements he's assigned to support. Can view evidence requests and received documents on his engagements; cannot view the engagement team's work papers, findings, or reports (staying strictly in the PBC lane). Can create/edit PBC requests; cannot create/edit engagements themselves.

### Anti-patterns

- Do not lump PBC Manager access into "Staff Auditor" — this role has a different scope and shouldn't accidentally get write access to work papers.
- Do not require Tom to configure his email templates in every new engagement. Templates are reusable across engagements within a tenant; per-engagement customisation is a paid delta, not a requirement.
- Do not design PBC management as an afterthought within Fieldwork. It warrants its own module surface because it's its own dedicated role at larger firms. [`03-feature-inventory.md`](03-feature-inventory.md) Module 7a is now dedicated to PBC.

---

## 13. Personas not covered here (yet)

Some roles are real but haven't been given full persona treatment in this document. Flag them here so they're remembered for future depth:

- **Board / Audit Committee member** — consumes the Annual Summary Report and occasional briefings. Read-only relationship. Needs simple, polished, trustworthy output.
- **CFO / Controller of the audited organisation** (different from David in that they're in industries AIMS v2 serves beyond public-sector — a nonprofit grantee's CFO, a commercial client's CFO on a SOC 2 attestation). Similar to David but different compliance driver and different auditor relationship.
- **Customer Success / onboarding lead (AIMS v2 team)** — the internal persona who onboards new tenants; runs the first 90 days of a customer relationship. Needs visibility into tenant-onboarding progress, playbook execution, training delivery.
- **Account executive (AIMS v2 team)** — runs the sales relationship; needs visibility into tenant usage, expansion signals, renewal risk. Distinct from Ravi (operational) and Success (onboarding/adoption).
- **Sales engineer (AIMS v2 team)** — demos the product; responds to RFPs; does technical deep-dives with prospects' security teams. Needs a demo tenant with realistic data; needs talking points and comparison data.

These will get full persona treatment in a later pass when product and go-to-market decisions require them. For now, the twelve detailed above (§1–§12) cover the primary product-surface decisions.

---

## Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini, framed as "former product manager in the GRC/Audit SaaS space") as part of the same review cycle that covered [`01-product-vision.md`](01-product-vision.md) and [`03-feature-inventory.md`](03-feature-inventory.md). Key changes landed:

### Persona-realism corrections

- **Kalpana reframed from "pack author" to "pack annotator/overrider."** Reviewer correctly pointed out that state audit bureaus do not write structured methodologies from scratch. The bureau's audit manual is a 12-page Word document that says "we follow GAGAS, except X." Earlier draft's "Kalpana authors a full custom pack" was wish fulfilment. Fix: §5 rewritten with Kalpana's real need (annotate / override the shipped GAGAS pack) and explicit acknowledgement that full custom pack authoring (Aisha's use case) is a different, post-MVP capability.
- **Aisha reframed from "public open-source pack ecosystem" to "private consortium-scoped registry."** Reviewer correctly pointed out that audit standards are IP-protected — IIA, ISO, AICPA monetise their standards, and there's no realistic path to a GitHub-style public registry of methodology packs. Fix: §6 rewritten with Aisha as a consortium pack author (West Africa Consortium example: private registry with controlled membership among a closed group of audit offices), not a public ecosystem contributor. This is still a real use case; it's just post-MVP and private rather than public.
- **David reframed to "email-first, with portal for heavy interactions."** Reviewer correctly observed that auditees hate logging into GRC platforms — they log in once, forget their password, and email PDFs to the auditor. Fix: §4's product relationship rewritten around email-first interaction (evidence response via email reply; management response via signed single-use link; portal used only for batch review and multi-session work).

### Missing personas added

- **§11 Elena Vasquez — CPA Firm Audit Partner.** Segment A's economic buyer. Drivers are margin, realisation rate, cross-sell, WIP visibility — different mental model from Marcus the CAE. Adding her closes the cross-document gap where [`01-product-vision.md`](01-product-vision.md) §2.1 targets CPA firms as Year 1 revenue driver but no persona represented that economic profile.
- **§12 Tom Reed — PBC Request Manager.** A distinct role at firms large enough to have dedicated PBC staff; his entire job is chasing auditees for documents. Adding him closes the feature-inventory gap where specialised PBC-management tools (InFlight, Pascal, AuditBoard modules) exist precisely because audit tools handle this poorly.

### What was not changed

- **Priya, Marcus, Anjali, Sofia, Ravi.** Reviewer rated these "highly realistic, excellent grounded definition." No changes.
- **Jin (external API integrator).** Reviewer noted the "third-party risk-intelligence startup" niche is too specific and that the real API consumer is more often an internal IT team pulling AIMS data into PowerBI or Snowflake. However, the broader persona of "external developer consuming the public API" is real for v2+ (third-party integrations do appear once a platform gets traction). Kept §9 as-is but noted the primary consumer early may be internal IT rather than a standalone startup; the feature requirements don't change either way.

---

## References

- [`docs/02-worked-example-single-audit.md`](../docs/02-worked-example-single-audit.md) — introduced Priya, Marcus, Anjali, David (the Oakfield cast)
- [`docs/06-design-decisions.md`](../docs/06-design-decisions.md) — product decisions (§6 / §7) that shape which personas matter
- [`product/01-product-vision.md`](01-product-vision.md) — the three customer segments these personas live within
- `auth/REVOCATION-POLICY.md` — role-based access patterns implementation
- [`references/adr/0006-regional-deployment-silos.md`](../references/adr/0006-regional-deployment-silos.md) — the silo architecture that Sofia configures and Ravi operates

---

*Last reviewed: 2026-04-21.*
