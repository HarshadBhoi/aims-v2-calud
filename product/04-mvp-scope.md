# MVP Scope

> The formal commitment to what AIMS v2's Minimum Viable Product contains, what it explicitly doesn't, and how we sequence it to market. This doc resolves the central Phase 2 question — single MVP vs. staged MVP — and gives engineering and go-to-market a shared artifact to build and sell against. Pairs with [`05-roadmap.md`](05-roadmap.md), which converts this scope into a calendar.

---

## 1. The single-vs-staged MVP decision

[`03-feature-inventory.md`](03-feature-inventory.md) R1 review surfaced an honest timeline assessment: ~190 MVP features across 20 modules is a **12-15 month build for a well-staffed engineering team**, not a 6-9 month sprint. That creates a strategic choice: commit to a single big launch late in Year 2, or stage the release so something ships to market earlier with incomplete scope.

### Arguments for single MVP (Year 2 Q1)

- One cleaner launch moment with a complete feature set; simpler marketing narrative ("here's AIMS v2")
- No "it's coming in v1.5" customer friction during the early post-launch period
- Single migration cutover for existing AIMS v1 customers
- Lower coordination overhead across product / engineering / go-to-market

### Arguments for staged MVP (MVP 1.0 Year 1 Q4 + MVP 1.5 Year 2 Q2)

- Ship something real to the first customers at month 9-10 (Year 1 Q4) rather than waiting another 4-6 months
- Get customer feedback that informs the MVP 1.5 feature set — before we've committed engineering cycles to features that turn out to be misscoped
- Book Year 1 revenue instead of deferring everything to Year 2
- If MVP 1.5 slips, MVP 1.0 is still in market; single-MVP has no fallback if month 10 reveals a scope problem
- CPA-firm Segment A has fast sales cycles (60-120 days) — we can only capitalise on them if we have a product to sell them in Year 1

### Decision — staged MVP

**We commit to the staged model.** Specifically:

- **MVP 1.0** ships Year 1 Q4 (approximately 9-10 months from engineering kickoff). Scope: the minimum viable deliverable that enables a complete audit engagement from creation to report issuance, with the multi-standard differentiator demonstrable.
- **MVP 1.5** ships Year 2 Q2 (approximately 6 months after MVP 1.0). Scope: fills out the operationally-complete story — QA program, peer-review evidence bundle, extended reports, refined strictness resolver UX.
- **v2.1** ships Year 2 Q4. Scope: advanced integrations, enterprise polish, DOCX output, OAuth2, specialised reports.
- **v2.2+** opens Year 3 for the strategic-differentiator capabilities (full custom pack authoring, SDK, consortium registry) that need real customer traction before investment is justified.

The staging is driven by the **go-to-market segment alignment** from [`01-product-vision.md` §2](01-product-vision.md): MVP 1.0 is Segment A (CPA firms) + Segment B (self-serve small practices) ready. MVP 1.5 adds Segment C (government audit shops) readiness via QA + peer-review evidence + extended reports. v2.1 adds Segment A enterprise expansion via integrations. v2.2+ unlocks the strategic moat for long-term defensibility.

The trade-offs accepted: marketing a staged release is harder than a single launch. We own that by being explicit with customers that MVP 1.0 is "ready for fast-cycle segments, with government-segment capabilities filling in through MVP 1.5." Customers who would buy but only after government-grade capabilities land wait 6 months; that's acceptable.

---

## 2. MVP 1.0 scope — the "Year 1 Q4" cut

Detailed per-module, with explicit in-scope and out-of-scope lists. Every feature from [`03-feature-inventory.md`](03-feature-inventory.md) marked MVP is either in MVP 1.0 or pushed to MVP 1.5; features marked v2.1 / v2.2+ / stretch stay at those designations.

### 2.1 MVP 1.0 "must-have" principles

Four principles govern what earns inclusion in MVP 1.0:

1. **A customer in Segment A must be able to run a complete GAGAS + Single Audit engagement end-to-end** — from engagement creation, through PBC management and fieldwork, to finding authoring, management response, CAP authoring, and report issuance (Yellow Book + Schedule of Findings).
2. **The multi-standard differentiator must be demonstrable in a sales conversation** — Segment A prospects must see that one engagement can attach GAGAS + IIA GIAS + Single Audit overlay, with findings rendering under all three vocabularies and two reports produced from one finding set.
3. **Tenant isolation and data residency must be production-grade** — no compromise on the architectural guarantees from [`docs/06`](../docs/06-design-decisions.md) §2.2 / §2.3 / §4.8. A customer must be able to sign a real DPA without asterisks.
4. **Operational trust must be credible** — 99.9% SLA achievable, observability functional, incident response tested, at least SOC 2 Type I in progress with attestation readiness by end of Year 1 Q4 + 3 months.

If a feature doesn't serve one of these four principles, it's not in MVP 1.0 regardless of whether it was tagged MVP in the inventory.

### 2.2 MVP 1.0 in-scope — by module

**Module 1 — Tenant onboarding & admin** (all core; some enterprise-only features deferred):
- Self-serve signup (Starter tier); enterprise sales-assisted onboarding; tenant settings; subscription management; billing portal; tenant regional binding; trust center; tenant-admin audit log
- **Deferred to MVP 1.5**: enterprise-scale onboarding workflow refinements (custom contract terms UI); subprocessor change notification automation (manual email until 1.5)
- **Deferred to v2.2+**: regional migration support; on-premises deployment packaging

**Module 2 — Identity, auth, SSO** (tight scope; SCIM depth deferred):
- Email/password, TOTP, WebAuthn, SSO via OIDC, password reset, MFA enforcement, session management UI, admin-initiated session kill, user lifecycle events, step-up authentication
- **Deferred to MVP 1.5**: SSO via SAML 2.0 (OIDC covers most IdPs; SAML enterprise-specific)
- **Deferred to MVP 1.5**: Full SCIM 2.0 provisioning (manual user provisioning via CSV for MVP 1.0; see Module 15)
- **Deferred to v2.1**: `require_instant_revocation` tenant flag; IP allowlist

**Module 3 — Audit universe & annual planning** (core features):
- Entity catalogue, risk scoring, audit history, annual plan authoring, approval workflow, plan vs. actual dashboard, plan-to-engagement linkage
- **Deferred to MVP 1.5**: multi-year audit cycle tracking
- **Deferred to v2.2+**: risk-based plan optimisation (ML-assisted)

**Module 4 — Engagement management** (core everything):
- Engagement creation; multi-pack attachment; template library; team assignment; phase tracking; budget tracking; engagement risk register; multi-auditee engagements; "in conjunction with" attachment; cloning; search & filtering; dashboard; activity feed; engagement-level comments; archive
- **Deferred to MVP 1.5**: scope change management

**Module 5 — Audit Planning Memo (APM)** (ships whole):
- All 8 features in MVP 1.0 — authoring, templates, collaborative editing (operational transforms; not real-time CRDT), approval workflow, version history, PDF export, phase linkage, cross-standard scope section

**Module 6 — PRCM** (ships whole):
- All 6 features in MVP 1.0 — matrix authoring, risk ratings, universe import, PDF export, control-framework-aware, cloning

**Module 7 — Fieldwork** (core testing flow):
- Work program authoring; templates; work paper authoring; work paper templates; evidence upload; review & sign-off; sampling worksheet; audit testing execution; observation capture; observation → finding escalation; TipTap rich text; evidence-request fulfilment (auditee side)
- **Deferred to MVP 1.5**: cross-work-paper references; work paper search

**Module 7a — PBC Request Management** (ships whole):
- All 14 features in MVP 1.0 — the operational module that makes Tom functional and makes Segment-A prospects take us seriously against InFlight / Pascal / AuditBoard

**Module 8 — Findings & recommendations** (core + collaboration; advanced deferred):
- Finding authoring; multi-standard rendering; classification per-pack; linked evidence; review workflow; recommendation authoring; presentation mode; management response; status lifecycle; search + filters; repeat-finding detection; numbering; inline comments; @mentions; track-changes during finalisation
- **Deferred to MVP 1.5**: finding amendment workflow; finding diff view
- **Deferred to v2.1**: `soxSuppressRecommendation` UI

**Module 9 — CAP & follow-up** (ships whole):
- All 10 features in MVP 1.0 — auditee CAP authoring; auditor approval; status tracking; evidence upload; verification; follow-up audit; overdue reminders; dashboards (both sides); Summary Schedule of Prior Audit Findings

**Module 10 — Reports** (the compressed MVP scope):
- Report composition; 2 report templates (**Yellow Book report** under GAGAS:2024 + **Schedule of Findings and Questioned Costs** under SINGLE_AUDIT:2024); `attestsTo`; multi-report per engagement (2 reports); compliance-statement builder for 2 reports; review workflow; PDF generation; HTML preview; versioning; signing / issuance; distribution list; Annual Summary Report; branding
- **Deferred to MVP 1.5**: 5 additional Single Audit reports (SEFA, Summary Schedule of Prior Audit Findings as separate report, Data Collection Form, CAP as formal report, Engagement Letter); IIA Audit Committee report template; ISO Audit Report template
- **Deferred to v2.1**: DOCX generation; redaction for distribution; PCAOB report templates

**Module 11 — QA** (mostly deferred; minimal MVP 1.0 scope):
- Independence declaration; independence impairment reporting; annual independence declaration; independence rules by pack (strictness resolver output)
- **Deferred to MVP 1.5**: QA checklist execution; QA checklist by pack; peer review management; QAIP management; peer review evidence bundle; QA dashboard — this is the bulk of the QA module; Segment C prospects need it, but Segment A can function without full QA program formality in MVP 1.0

**Module 12 — Staff, time, CPE** (ships with full MVP scope):
- Staff directory; time tracking; time approval; CPE tracking; CPE compliance per pack; CPE event entry; CPE expiration alerts; CPE dashboards (auditor + CAE)
- **Deferred to MVP 1.5**: CPE evidence-for-peer-review export

**Module 13 — Board reporting** (minimal MVP 1.0):
- Board reporting dashboard (basic)
- **Deferred to MVP 1.5**: Board presentation pack export; Audit Committee communication log

**Module 14 — Standards pack management (the MVP differentiator)** (pack annotation/override pulled in):
- Pre-built pack library (GAGAS:2024, IIA_GIAS:2024, SINGLE_AUDIT:2024, SOC2:2017; ISO:19011:2018 in a reduced-scope beta form); pack attachment UI; pack browsing & version viewer; **pack annotation/override** (the MVP-era differentiator); annotation-impact preview; annotation version history; pack version transition management; pack validation reports; pack-specific translation layer; strictness resolver UI; strictness resolver override
- **Deferred to v2.1**: pack dependency graph visualization
- **Deferred to v2.2+**: custom pack authoring from scratch; pack authoring SDK; private consortium pack registry

**Module 15 — Integrations** (core integrations, advanced deferred):
- Public REST API (`/v1/*`); OpenAPI 3.1 spec + developer portal; webhook delivery; webhook event catalog; API key management; rate limit headers; SSO configuration (OIDC); CSV imports (engagements, findings, staff+CPE); star-schema warehouse export
- **Deferred to MVP 1.5**: SSO configuration (SAML 2.0); SCIM 2.0 endpoint (full implementation)
- **Deferred to v2.1**: OAuth2 client credentials; Power BI / Tableau template files
- **Deferred to v2.2+**: Sentry / Datadog forwarding

**Module 16 — Dashboards & analytics** (essential dashboards; advanced deferred):
- Home dashboard; engagement progress; finding aging; recommendation tracker; CAP compliance; CPE compliance; annual plan vs. actual; risk heat map; global search; bulk operations (findings); cross-tenant search (platform admin)
- **Deferred to MVP 1.5**: multi-standard coverage view; saved searches; bulk ops for CAPs and work papers

**Module 16a — Notifications & alerts** (core in, advanced deferred):
- In-app notification center; @mention support; email digest notifications; per-user preferences; per-event-type defaults (tenant admin); Microsoft Teams webhook integration; notification deep-links; outbound email identity
- **Deferred to MVP 1.5**: Slack integration; notification history
- **Deferred to v2.1**: DND hours
- **Deferred to v2.2+**: mobile push

**Module 17 — Audit trail & compliance evidence** (production-critical; ships whole MVP scope):
- Hash-chained audit log; audit log viewer (admin + platform); supervisory-review trail; immutability enforcement; retention policy enforcement; right-to-erasure (GDPR Article 17)
- **Deferred to MVP 1.5**: compliance evidence exports; DSAR tooling

**Module 18 — Platform administration** (essential ops tooling):
- Tenant search + admin console; scoped support-mode access; incident response console; break-glass access flow; platform-level pack publishing
- **Deferred to MVP 1.5**: SQS inspector internal tool
- **Deferred to v2.2+**: regional silo provisioning automation

### 2.3 MVP 1.0 feature count

Approximate count:

- Module 1: 8 of 12 → MVP 1.0
- Module 2: 10 of 15 → MVP 1.0
- Module 3: 7 of 9 → MVP 1.0
- Module 4: 15 of 16 → MVP 1.0
- Module 5: 8 of 8 → MVP 1.0
- Module 6: 6 of 6 → MVP 1.0
- Module 7: 12 of 14 → MVP 1.0
- Module 7a: 14 of 14 → MVP 1.0
- Module 8: 15 of 18 → MVP 1.0
- Module 9: 10 of 10 → MVP 1.0
- Module 10: 13 of 17 → MVP 1.0
- Module 11: 4 of 10 → MVP 1.0 (the QA compression is deliberate; Segment A can function without full QA program formality)
- Module 12: 9 of 10 → MVP 1.0
- Module 13: 1 of 3 → MVP 1.0
- Module 14: 11 of 14 → MVP 1.0
- Module 15: 10 of 16 → MVP 1.0
- Module 16: 11 of 15 → MVP 1.0
- Module 16a: 8 of 12 → MVP 1.0
- Module 17: 7 of 9 → MVP 1.0
- Module 18: 5 of 7 → MVP 1.0

**MVP 1.0 total: ~184 features** across 20 modules. Of the ~190 MVP-tagged features in the inventory, ~184 make MVP 1.0 and ~6 push to MVP 1.5. The bigger shift is internal module coverage: Module 11 (QA) drops from 6 MVP features to 4; a few other modules drop 1-2 features each to MVP 1.5.

---

## 3. MVP 1.5 scope — the "Year 2 Q2" completion

MVP 1.5 is the ~6-month follow-up that brings the product to operational completeness, particularly for Segment C (government audit shops). It's not v2.1 — it's the second half of "MVP" honestly named.

### 3.1 What MVP 1.5 adds

**QA module completion** (Module 11):
- QA checklist execution (60+ item GAGAS checklist); QA checklist by pack; peer review management; QAIP management (IIA Standard 15); peer review evidence bundle export; QA dashboard

**Extended reports** (Module 10):
- 5 additional Single Audit reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP as formal report, Engagement Letter)
- IIA Audit Committee report template
- ISO Audit Report template
- Compliance-statement builder extended to all these reports

**Board reporting maturation** (Module 13):
- Board presentation pack export
- Audit Committee communication log

**Advanced engagement features**:
- Scope change management workflow (Module 4)
- Cross-work-paper references and full WP search (Module 7)
- Finding amendment workflow (Module 8)
- Finding diff view (Module 8)
- Multi-year audit cycle tracking (Module 3)

**Full SSO & SCIM** (Module 15):
- SAML 2.0 SSO configuration
- Full SCIM 2.0 endpoint (real-time user/group provisioning from IdP)

**Extended dashboards & search** (Module 16):
- Multi-standard coverage view
- Saved searches
- Bulk ops extended to CAPs and work papers

**Compliance evidence tooling** (Module 17):
- Compliance evidence exports (per-framework: SOC 2 evidence package, ISO 27001 evidence package)
- DSAR tooling
- CPE peer-review evidence bundle (Module 12)

**Notifications extended** (Module 16a):
- Slack webhook integration
- Notification history

**Ops tooling**:
- SQS inspector internal UI (Module 18)
- Subprocessor change notification automation (Module 1)

### 3.2 What MVP 1.5 does not add

v2.1 features stay at v2.1: DOCX generation, OAuth2 client credentials, PCAOB report templates, redaction for distribution, `soxSuppressRecommendation` UI, pack dependency graph visualization, Power BI template files, DND hours.

v2.2+ features stay at v2.2+: custom pack authoring from scratch, pack SDK, private consortium registry, regional migration support, on-premises deployment, regional silo provisioning automation, mobile push notifications, risk-based plan optimisation, Sentry / Datadog observability forwarding, full AI-assisted drafting.

### 3.3 MVP 1.5 feature count

~45-55 additional features layered onto MVP 1.0's ~184. Total post-MVP-1.5 active feature count: ~230-240.

---

## 4. What's explicitly out of MVP (both 1.0 and 1.5)

Deferred to v2.1 or later with explicit rationale:

### v2.1 deferrals (targeted Year 2 Q4)
- **DOCX report generation** — customers convert PDF → DOCX externally until native support ships
- **OAuth2 client credentials** — API keys sufficient for MVP integrator volume
- **PCAOB report templates** — no Segment A or C prospect has demanded; ships when demand warrants
- **Redaction for distribution** — audit function can manually produce public vs. board versions until redaction tooling ships
- **`soxSuppressRecommendation` UI** — configurable via API or admin-level override; UI polish in v2.1
- **Pack dependency graph visualization** — textual description suffices until 2.1
- **Power BI / Tableau template files** — star-schema warehouse export covers the technical capability; templates are a convenience layer
- **DND hours for notifications** — users can set manual defaults via preferences until DND ships
- **Bulk ops for CAPs and work papers beyond findings** — individual operations available; bulk UX refinement in MVP 1.5 / v2.1

### v2.2+ deferrals (targeted Year 3)
- **Custom pack authoring from scratch** — Segment-C signal required; pack annotation/override covers state audit bureau needs in MVP
- **Pack authoring SDK (external)** — requires consortium customer committing to use it; premature before real demand
- **Private consortium pack registry** — paired with SDK; requires same demand signal
- **Regional silo provisioning automation** — operational workstream, not customer-facing
- **On-premises deployment packaging** — government / regulated Segment C+ demand required
- **Native mobile / tablet apps** — responsive web works for tablet form factors; native apps require separate engineering investment and customer signal
- **Risk-based annual plan optimisation (ML-assisted)** — nice-to-have but not a table-stakes capability
- **AI-assisted finding drafting / evidence extraction** — deferred until MVP produces real usage data to ground AI features
- **Sentry / Datadog per-tenant observability forwarding** — niche feature; emerges when a few customers specifically ask

### Out of any release scope (deliberately not built)
Per [`docs/06 §7`](../docs/06-design-decisions.md) negative architecture:
- "AI auditor" (automated evidence evaluation or control-effectiveness rulings)
- Auditee's underlying financial system (we host audit work, not the GL)
- Auditee's PM / implementation tool for CAPs (we track, don't run)
- Regulator submission pipelines (FAC, SEC filings; we produce artifacts, customer transmits)
- Visual workflow / BPMN designer (pack-declared workflows, not drag-drop)
- Bespoke BI / dashboard authoring tool (star-schema export to Power BI / Tableau / Looker)
- In-house full-text search (AWS OpenSearch or Algolia when the need arises)
- Bespoke file-conversion engine (CloudConvert or Aspose if needed)

---

## 5. MVP 1.0 acceptance criteria

How we know MVP 1.0 is "good enough to ship" — the quality gate before general availability. These apply at the product-surface level; feature-level acceptance criteria live in [`features/`](features/) per feature spec (Phase 4).

### 5.1 Functional acceptance — the Oakfield-end-to-end test

A sample Oakfield-like tenant must be able to perform a complete Single Audit engagement end-to-end without manual intervention outside AIMS v2:

1. Tenant admin provisions Oakfield (via sales-assisted onboarding) with SSO against a test Okta instance, 8 seeded users
2. Priya creates an engagement: "Oakfield University FY27 Single Audit"
3. Attaches `primaryMethodology: GAGAS:2024`, `additionalMethodologies: [IIA_GIAS:2024]`, `regulatoryOverlays: [SINGLE_AUDIT:2024]`, `controlFrameworks: [SOC2:2017]`
4. Builds APM, PRCM
5. Tom generates 150 PBC requests; David replies with attachments via email; AIMS ingests
6. Anjali executes testing in work papers; escalates one observation to a finding
7. Priya authors finding 2026-001 with semantic-core fields; attaches the Single-Audit-specific fields (questioned costs, ALN, etc.); adds two classifications (GAGAS SIGNIFICANT_DEFICIENCY + IIA MAJOR); drafts one recommendation addressing it
8. Review workflow: Priya → Marcus; management response from David via email; CAP drafted by David
9. Reports generated: Yellow Book report + Schedule of Findings and Questioned Costs; both render the same finding correctly under their respective pack vocabularies; compliance-statement builder produces correct "conducted in accordance with..." sentences for each
10. Marcus signs and issues the engagement; reports are locked (immutable); audit log reflects the full chain
11. Subsequent period: Jin (external integrator) queries the `/v1/engagements/:id/findings` REST endpoint and retrieves the finding; webhook fires `finding.issued` on issuance; SCIM-provisioned users deprovisioning cascades through the auth blocklist

Full end-to-end pass = functional MVP 1.0. Until this passes, MVP 1.0 does not ship.

### 5.2 Operational acceptance — SLO compliance

- **p99 request latency** (tRPC queries) < 300ms at 500 concurrent users under realistic load; p99 < 500ms at 1000 concurrent
- **p99 report generation latency** (2-report Single Audit package) < 30s
- **99.9% availability SLA** sustained for 30 days of continuous operation in staging under realistic load (chaos-engineered outages included)
- **Zero cross-tenant data leakage** in all integration + synthetic tests
- **15-min RPO / 1-hr RTO** validated via real DR drill to secondary region

### 5.3 Compliance acceptance

- **SOC 2 Type I** attestation process initiated with a named auditor; report due within 3 months of MVP 1.0 GA
- **GDPR-grade privacy** operational — no attestation yet but DPAs executable; DSAR process documented (tooling automation in MVP 1.5)
- **Sub-processor list published** on trust center
- **Security questionnaire library** populated with pre-written answers to SIG Lite + CAIQ

### 5.4 Business acceptance

- **First 5 paid customers** signed via sales-assisted Professional tier (Segment A)
- **First 10 self-serve customers** signed via Starter tier (Segment B)
- **Customer Success playbooks** published for onboarding Segment A and Segment B
- **Billing system operational** — first paid invoice generated, paid, reconciled

If MVP 1.0 reaches Year 1 Q4 without achieving 5.4 acceptance, the product launched but the go-to-market didn't — a different kind of failure requiring different remediation.

---

## 6. Critical path

The sequencing dependencies that shape how MVP 1.0 is built. Engineering must respect these; skipping dependency ordering produces rework.

### 6.1 Infrastructure foundation (month 0-2)

Before any feature work can proceed at scale, the infrastructure from [`docs/04`](../docs/04-architecture-tour.md) + ADRs 0001-0007 must be stood up:

- AWS baseline (EKS on Bottlerocket, RDS PostgreSQL, ElastiCache Redis, S3, SQS, KMS, Secrets Manager)
- Terraform modules applied to dev environment
- CI/CD via GitHub Actions with OIDC
- Observability stack (OTel collector, Grafana / Loki / Tempo / Prometheus, Sentry)
- Argo Rollouts with SLO-gated canary
- `packages/prisma-client/` tenant-isolation extension working end-to-end with an integration test proving two-layer isolation
- `packages/encryption/` ALE module working with KMS integration test

This is month 0-2 and gates everything else. No feature PRs merge until infrastructure is green.

### 6.2 Auth + tenant foundation (month 2-3)

Gates almost every feature:

- Tenant provisioning flow (onboarding a test tenant must work)
- Auth (email/password + OIDC SSO) with EdDSA JWT + refresh rotation
- Tenant-scoped Prisma client + RLS policies on every tenant-scoped table
- Basic user management (admin can invite users, assign roles, revoke access)

### 6.3 Core domain data model (month 3-4)

The data model must be stable before feature work begins:

- Standard Pack data model populated with GAGAS:2024, IIA_GIAS:2024, SINGLE_AUDIT:2024, SOC2:2017, ISO:19011:2018 beta
- Engagement entity with multi-pack attachment
- Finding entity with semantic core + per-pack extensions + classifications array
- Recommendation entity with M:N to findings
- Report entity with `attestsTo`
- All bitemporal + audit-log infrastructure working

### 6.4 Sequential feature development (month 4-9)

In rough dependency order:

**Sprint group A — engagement lifecycle** (months 4-5):
- Engagement management module (Module 4)
- APM authoring (Module 5)
- PRCM matrix (Module 6)
- Audit universe basics (Module 3)

**Sprint group B — fieldwork + PBC** (months 5-6):
- Work programs, work papers, sampling (Module 7)
- PBC Request Management (Module 7a) — this is a large-scope module
- Observation capture

**Sprint group C — findings + recommendations** (months 6-7):
- Finding authoring with multi-standard rendering (Module 8)
- Recommendations as separate entity
- Management response + CAP authoring (Module 9)

**Sprint group D — reports + compliance** (months 7-8):
- Report composition (Module 10)
- Yellow Book + Schedule of Findings templates
- Compliance-statement builder
- Pack annotation/override (Module 14)
- Strictness resolver UI

**Sprint group E — cross-cutting** (months 8-9):
- Notifications & Alerts Center (Module 16a)
- Dashboards (Module 16)
- Activity feeds, comments, @mentions
- Platform admin tooling (Module 18)

### 6.5 Pre-GA validation (months 9-10)

- Security testing (pen test, SAST, SCA sweep, threat model review)
- Load testing against realistic scale
- First tenant pilot (2-3 Segment A prospects running real engagements under a paid beta agreement)
- SOC 2 Type I auditor engagement kicked off
- Marketing / sales enablement materials

### 6.6 GA launch (month 10 = Year 1 Q4)

First paid customers flip from pilot to GA. Trust center publishes. Public REST API published. Developer portal online. Documentation complete for MVP 1.0 feature set.

### 6.7 Timeline realism — Month 10 is the plan; expect Month 12

The critical path above commits Month 10 as MVP 1.0 GA. Honest calibration: a 184-feature MVP across 6 months of feature-development work (after the Month 0–3 infrastructure phase) with ~8 engineers works out to ~3.8 features per engineer per month. Some features are genuinely small (a checkbox toggle, a filter option); others are XL monsters that consume a senior engineer for 6 weeks (pack annotation/override UX, multi-standard finding rendering, the document-generation engine). The averaged math is aggressive.

**The realistic expectation is a 1–2 month slip.** Planning for Month 10 with an acknowledged expectation of Month 11–12 is the honest framing. This is not a failure mode; it is the default for 184-feature MVPs. §11 of [`05-roadmap.md`](05-roadmap.md) documents the slip playbook for how to handle this without compounding downstream damage.

The difference between a controlled 2-month slip and a catastrophic 6-month slip is the presence of this acknowledgement. If engineering leadership and go-to-market plan around Month 10 and quietly slip month-by-month, the result is pressure that compounds. If both plan around Month 10 with explicit understanding that Month 12 is the defended commitment, the pressure releases and the release is on-schedule-by-its-own-framing.

**External messaging commitment**: trust center and sales cite "MVP 1.0 GA in Year 1 Q4 (target) / Year 2 Q1 (committed)" — giving ourselves the quarter's slack publicly. This costs nothing internally (we still plan to Month 10) and gains honest latitude externally.

---

## 7. Risk register

Risks that could push MVP 1.0 timeline, organised by likelihood × impact.

### 7.1 High-probability, high-impact risks

**Scope creep from Segment A pilots.** A pilot customer asks for one critical capability that's v2.1-tagged; sales pressure pulls it into MVP 1.0; one feature becomes six. Mitigation: explicit "v2.1 items stay v2.1" discipline enforced by product leadership. Pilot customer contracts say "v2.1 features land in v2.1; no early access commitments."

**Pack annotation/override UX is harder than estimated.** The feature is pulled into MVP 1.0 as the differentiator, but designing an accessible UI for what's fundamentally a schema-editing task is genuinely difficult. Mitigation: early UX research with Kalpana-equivalent personas; prototype Month 3-4 before full build in Month 7-8; acceptance of "CLI + YAML fallback for power users if the UI isn't ready."

**SOC 2 Type I audit takes longer than the 3-month post-GA estimate.** Auditor findings require remediation; process stretches to 6 months. Mitigation: Drata or Vanta in production from day one generating evidence; auditor engagement starts in Month 6, not Month 9.

### 7.2 Medium-probability, high-impact risks

**Engineering timeline slips 1–2 months from scope math** (promoted from "low" to acknowledged expected-case). 184 features across 6 months of feature-development with ~8 engineers is genuinely aggressive — ~3.8 features per engineer per month averaged, while individual XL features (pack annotation/override UX, multi-standard finding rendering, document-generation engine) consume 6+ weeks of senior engineer time each. Mitigation: plan internally to Month 10; commit externally to Year 1 Q4 with Year 2 Q1 as the public quarter window (per §6.7); accept 1–2 month slip as the default case, not a crisis; invoke the slip playbook in [`05-roadmap.md §11`](05-roadmap.md) early rather than late.

**Multi-standard finding rendering edge cases.** The "one finding, multiple pack vocabularies" feature is architecturally elegant but operationally complex. Some GAGAS + IIA combinations may produce renderings that customers reject as "not how auditors would write it." Mitigation: Oakfield-like end-to-end test (per §5.1) must pass with SME review before GA; real Segment A pilot customers must validate rendering quality.

**The 2-report Single Audit compression is too aggressive — professional services mitigation is now a committed budget line.** Segment A pilots may reject "only 2 reports" as insufficient even though 2 reports technically demonstrate the differentiator. Mitigation structure (explicit, budgeted, not aspirational):

- **Pilot contract language**: every Private Beta contract (and Year 1 Q4 GA contracts until MVP 1.5 ships) explicitly acknowledges 2-report MVP scope + commits AIMS to providing the other 5 Single Audit reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP as formal report, Engagement Letter) via professional services at no additional cost through MVP 1.5 launch
- **Professional services budget**: we reserve ~2 FTE-weeks of service time per pilot customer per fiscal year for manual report production; this is an explicit cost line in the Year 1 P&L, not an ad-hoc absorb
- **Template library**: Word/LaTeX templates for the 5 manual reports are pre-built and reusable across customers; service time is ~4–8 hours per report per customer once the template is mature, not 40 hours
- **Automation sunset**: as soon as MVP 1.5 ships (Year 2 Q2), the professional services offering is retired; customers transition to native report generation; this caps the services liability to 6 months at modest per-customer cost

This is a deliberate "brilliant, unscalable startup hack" pattern — manually producing at 10x the cost per customer to buy time before the automation ships. The hack is time-boxed and the cost is bounded.

**Segment A CPA firm security-review friction during Private Beta.** Mid-tier CPA firms are specifically paranoid about their own supply-chain security — they audit others for a living and understand supply-chain risk intimately. Asking a 200-person CPA firm to put live client audit data (PII, identified control weaknesses, cybersecurity vulnerabilities in their clients) into a SaaS platform without a completed SOC 2 Type I report is a real deal-breaker in the procurement phase. Mitigation structure:

- **Compliance evidence package must be flawless at Private Beta start (Month 6)**: sub-processor list complete and accurate; DPA template executed by counsel; pen test from a named security firm completed and summary shareable; CAIQ / SIG Lite pre-answered with 95%+ coverage; trust center in a finished state (not "coming soon"); SOC 2 Type I fieldwork actively in progress with named auditor (so we can say "our SOC 2 report is under audit, expected [date]")
- **Dedicated-VPC deployment option offered to first 3 Private Beta customers**: for customers whose InfoSec team will block the standard SaaS tenancy model, we spin up a per-customer isolated infrastructure (same code, dedicated VPC + dedicated RDS + dedicated S3 + customer-controlled KMS). This is expensive operationally (~1.5x the standard SaaS cost per customer) but it closes the security-objection path. Budget 3 such deployments into Year 1 Q3–Q4
- **Dummy-data fallback acknowledged**: if a pilot customer's security team absolutely will not approve live-data use during beta, we accept the dummy-data constraint but mark that pilot's "real audit work" success metric as not-achievable. Better to have 2/3 beta customers running real work and 1/3 on dummy data than to lose a pilot entirely
- **Named reference-security contact on our side**: our CISO (or VP Eng wearing dual hat per [`docs/06 §6.3`](../docs/06-design-decisions.md)) is directly reachable by pilot customer InfoSec teams for questions and walkthroughs; not routed through sales

**Engineering hiring lags commitment.** The timeline assumes a well-staffed engineering team (probably 8-12 engineers by Month 4); hiring may not keep pace. Mitigation: hiring plan front-loaded to Months 0-3; contractor augmentation available as scaling option; timeline explicitly contingent on hiring pace.

### 7.3 Lower-probability, high-impact risks

**Competitor ships multi-standard before us.** TeamMate+ or AuditBoard announces the capability at a conference mid-year. Mitigation: we're ~12 months into architectural commitment; their pivot requires data-model restructure that takes longer than our Year 1 Q4 ship. Competitive monitoring ongoing; response playbook drafted.

**A Segment A customer demands on-premises deployment.** Our model says v2.2+; a big prospect could push timing. Mitigation: decline the deal if the ask is critical; pilots explicitly-cloud-first by contract.

**GDPR supervisory-authority inquiry into our compliance.** EU customer signs, regulator opens file, we need to pause European rollout while responding. Mitigation: no EU tenants onboarded in MVP 1.0 (Segment C EU wait for MVP 1.5); if eu-central-1 silo stands up Year 2, regulatory readiness materials in place.

### 7.4 Risk ownership

- Product risks (scope, feature-set adequacy, UX quality) — VP Product / founder
- Technical risks (pack rendering edge cases, infrastructure stability) — VP Engineering
- Go-to-market risks (pilot rejection, pricing, segment targeting) — VP Sales / founder
- Compliance risks (SOC 2 timing, GDPR readiness) — CISO / security lead
- People risks (hiring pace) — VP Engineering / HR

Each risk owner has a monthly check-in on the risk they own; risks that trend toward triggering events get escalated to founder / leadership for mitigation decisions.

---

## 8. What ships in MVP 1.0 vs. MVP 1.5 — decision rationale summary

The single most important content of this document — the boundary between "ships at Year 1 Q4" and "ships at Year 2 Q2" — boils down to six judgments:

| Decision | MVP 1.0 | MVP 1.5 | Rationale |
|---|---|---|---|
| **QA module** | Independence only (4 features) | Full QA program (6 features) | Segment A can function without QA program formality; Segment C needs it. MVP 1.0 targets Segment A. |
| **Report templates** | 2 (Yellow Book + Schedule of Findings) | +5 additional Single Audit reports + IIA Audit Committee + ISO Audit Report | 2 reports proves multi-report-from-one-finding differentiator; 7 reports overwhelms the engineering month-7-to-8 sprint; customer pilots accept 2-report + manual for the rest |
| **SSO protocols** | OIDC only | OIDC + SAML + full SCIM | OIDC covers ~80% of IdPs (Okta, Azure AD, Google Workspace); SAML for remaining ~20% (mostly older enterprise IdPs); SCIM completion enables fully-automated user lifecycle for MVP 1.5 |
| **Pack authoring** | Annotation/override on shipped packs | Same | Full custom pack authoring is v2.2+; both 1.0 and 1.5 share the annotation/override capability |
| **Advanced engagement features** | Core (cloning, search, archival) | Scope change mgmt, cross-WP refs, amendment workflow, diff view | Operational completeness for Segment C; Segment A pilots can workaround |
| **Evidence exports / DSAR / compliance bundles** | Manual (auditor produces Word-doc compliance bundle) | Automated export tooling | Compliance-evidence tooling is a real engineering investment; manual works for MVP 1.0; automated by MVP 1.5 |

The through-line: **MVP 1.0 is Segment A + B-ready; MVP 1.5 closes the Segment C gaps**. Anything that's Segment-C-specific waits.

---

## 9. What this scope commits us to (and what it doesn't)

**Commits:**
- Engineering roadmap with MVP 1.0 target of Year 1 Q4; MVP 1.5 target of Year 2 Q2
- Go-to-market motion targeting Segments A + B at MVP 1.0 launch; Segment C unlocked at MVP 1.5
- Hiring plan scaled to the ~12-15-month build profile
- SOC 2 Type I attestation engaged for completion ~3 months post-MVP 1.0 GA
- Service model per [`01-product-vision.md §6.3`](01-product-vision.md) — tiered, not minimised
- No AI-auditor capabilities through MVP 1.5 (reconsidered for v2.2+ based on real usage data)

**Does not commit:**
- Specific pricing per tier (working hypothesis in [`01-product-vision.md §6.4`](01-product-vision.md); pricing finalisation is a Phase 2+ go-to-market decision)
- Specific feature sequencing within MVP 1.5 (to be detailed when Phase 4 feature specs complete)
- Specific pilot customer names (sales-driven; named in [`05-roadmap.md`](05-roadmap.md) as known, else placeholder)
- Post-MVP 1.5 roadmap beyond high-level v2.1 and v2.2+ buckets (that's [`05-roadmap.md`](05-roadmap.md)'s scope)
- Specific engineering hiring titles / counts (that's an HR + engineering-leadership planning exercise)

---

## 10. References

- [`product/01-product-vision.md`](01-product-vision.md) — segment strategy, commercial model, v1 → v2 relationship
- [`product/02-personas.md`](02-personas.md) — personas driving feature priorities
- [`product/03-feature-inventory.md`](03-feature-inventory.md) — complete feature catalogue with MVP tags
- [`product/05-roadmap.md`](05-roadmap.md) — calendar view of this scope (Phase 2 companion)
- [`docs/04-architecture-tour.md`](../docs/04-architecture-tour.md) — infrastructure that MVP 1.0 builds on
- [`docs/06-design-decisions.md`](../docs/06-design-decisions.md) — architectural decisions shaping what's possible
- [`references/adr/`](../references/adr/) — the 7 ADRs providing load-bearing architectural commitments

---

## 11. Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini, framed as "former product manager in the GRC/Audit SaaS space") in the same program that reviewed the Phase 1 product specs. Verdict: **Approved with four specific refinements**, all of which are doc-level rather than strategic re-decisions. Recording the feedback here so a future reader understands why specific sections read the way they do.

### Round 1 — timeline realism ("the 184-feature math")

Reviewer calculated that 184 features across 6 months of feature-development with ~8 engineers = ~3.8 features per engineer per month averaged, while individual XL features (pack annotation/override UX, multi-standard finding rendering, document-generation engine) consume 6+ weeks of senior engineer time each. The math is aggressive. Verdict: **expect MVP 1.0 to actually land in Month 12, not Month 10.** Fix: added §6.7 explicitly acknowledging the 1–2 month slip as the expected case (not a crisis); promoted "engineering timeline slips" from low-probability to medium-probability with the defensive framing that planning internally to Month 10 while committing externally to Year 1 Q4 / Year 2 Q1 window gives us the latitude without internal pressure release. The "What if we slip" playbook in [`05-roadmap.md §11`](05-roadmap.md) applies.

### Round 1 — SOC 2 timeline friction for Segment A

Reviewer correctly flagged that mid-tier CPA firms are paranoid about their own supply-chain security (they audit supply chains for a living) and will struggle to put live client audit data into a SaaS platform pre-SOC-2-Type-I. The Private Beta contract language + compliance evidence package quality had to be specifically armed to handle this. Fix: §7.2 now has a dedicated risk entry for Segment A CPA firm security-review friction with explicit mitigations (compliance evidence package readiness at Private Beta start per [`05-roadmap.md §4.3`](05-roadmap.md); dedicated-VPC deployment option for first 3 pilot customers at ~1.5x SaaS cost; dummy-data fallback acknowledged as a valid path for pilot customers whose InfoSec absolutely blocks live-data use; CISO-level reference contact available directly to customer InfoSec teams).

### Round 1 — 2-report compression mitigation strengthened

Reviewer endorsed the 2-report compression decision as "painful but correct" AND the professional-services package mitigation as a "brilliant, unscalable startup hack." Strengthened accordingly: §7.2 now treats the professional-services package as an **explicit budgeted cost line**, not an aspirational commitment. Specifics added: ~2 FTE-weeks per pilot customer per fiscal year reserved; reusable Word/LaTeX template library for the 5 manual reports; services offering time-boxed to MVP 1.5 ship (retires Year 2 Q2); pilot contract language commits AIMS to producing the 5 deferred reports at no additional cost through MVP 1.5.

### Round 1 — Alpha data-migration gate (addressed in 05)

Reviewer flagged that if we wait until Private Beta (Month 6) to test CSV import with real, messy customer data, import bugs will consume Private Beta time that should be feature-validation time. Fix applied in [`05-roadmap.md §3.2`](05-roadmap.md) — added "Successfully ingest a sanitised historical engagement from a design partner via CSV" to the Alpha gate criteria (Month 5–6). This pulls the pain forward to where it's cheap, not where it blocks pilots.

### Final verdict

Reviewer's verdict: **"Approved. You have a staged MVP that logically aligns with your sales segments. Your feature-cut rationale is explicitly documented. Your roadmap acknowledges the dependency of infrastructure before application logic. The plan is aggressive, and you will likely slip a month or two, but because you have documented why things are sequenced the way they are, a 2-month slip won't break the company — it will just shift the calendar."**

This is the intended outcome of the review discipline. Plan defensible; slip bounded; commercial and engineering teams share the same reality.

---

*Last reviewed: 2026-04-21. Phase 2 deliverable; R1 review closed.*
