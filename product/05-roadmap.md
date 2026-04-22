# Product Roadmap

> The calendar view of AIMS v2's phased delivery. Takes the scope commitments from [`04-mvp-scope.md`](04-mvp-scope.md) and maps them to a time axis with gate criteria, business objectives per phase, customer-segment alignment, and the dependencies between phases. Read this after 04; this doc assumes the MVP 1.0 / MVP 1.5 / v2.1 / v2.2+ scope decisions are already settled.

---

## 1. The roadmap at a glance

Four named releases + pre-release + post-v2.2+ open-ended:

| Release | Target | Scope theme | Customer segment ready |
|---|---|---|---|
| **Engineering kickoff** | Year 1 Q1 | Infrastructure + core data model | (internal) |
| **Alpha (internal)** | Year 1 Q2 | Core engagement lifecycle working end-to-end with seeded Oakfield data | (internal + design partners) |
| **Private beta** | Year 1 Q3 | First paid pilots; 2-3 Segment A customers under paid beta agreement | Segment A pilots |
| **MVP 1.0 — GA** | **Year 1 Q4** | Complete MVP 1.0 per [`04 §2`](04-mvp-scope.md) | **Segment A + Segment B** |
| **MVP 1.5** | **Year 2 Q2** | Full QA program; extended reports; SAML+SCIM; ops tooling | **+ Segment C (government)** |
| **v2.1** | Year 2 Q4 | DOCX, OAuth2, advanced integrations, pack dependency viz | Segment A enterprise expansion |
| **v2.2+** | Year 3+ | Custom pack authoring SDK; private consortium registry; regional silo automation; mobile | Strategic moat unlocks |

Below, each release is broken down into its contents, its gate criteria, its business-objectives scorecard, and the dependencies inbound and outbound.

---

## 2. Engineering kickoff — Year 1 Q1 (Months 0-2)

**Goal**: stand up the infrastructure that MVP 1.0 builds on. No feature work merges until this phase completes.

### 2.1 Scope

- AWS baseline in us-east-2 per [ADR-0006](../references/adr/0006-regional-deployment-silos.md): EKS on Bottlerocket, RDS PostgreSQL 16 Multi-AZ, ElastiCache Redis, S3, SQS, EventBridge Scheduler, KMS, Secrets Manager, CloudWatch, Route 53
- Terraform modules applied to dev environment; drift detection scheduled
- CI/CD via GitHub Actions with OIDC to AWS (no long-lived creds) per [ADR-0003](../references/adr/0003-nestjs-scoped-to-workers.md)
- Observability stack operational: OTel collector, Grafana Loki + Prometheus + Tempo, Sentry with source-map integration
- Argo Rollouts with SLO-gated canary configured against staging
- `packages/prisma-client/` Tenant-isolation extension built + tested end-to-end per [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md)
- `packages/encryption/` ALE module built + tested against real KMS per [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md)
- `packages/auth/` — basic JWT mint + verify with `blocklist_checkable` claim infrastructure per [ADR-0005](../references/adr/0005-session-revocation-hybrid.md)
- Hiring: engineering team scaled to ~8 engineers (platform + frontend + backend + data) by end of Q1

### 2.2 Gate criteria — must-pass before Alpha

- Integration test: two-layer tenant isolation — synthetic canary attempts cross-tenant read; app-layer blocks; RLS layer blocks; both logged
- Integration test: ALE roundtrip — encrypt via per-tenant DEK, decrypt, verify plaintext; rotate DEK, verify old ciphertext still decrypts
- Integration test: session blocklist — mint `blocklist_checkable: true` token, add jti to blocklist, verify middleware rejects
- Deploy test: push to dev via GitHub Actions OIDC; Argo Rollouts promotes through canary gates; observability traces propagate end-to-end
- DR test: initiate region-failure simulation in dev; RDS fails over; apps reconnect
- Performance baseline: empty-schema Postgres responds < 5ms p99 to simple queries under light load

### 2.3 Business objectives

- **Engineering productivity established**: CI pipeline green for every PR; 12-minute CI budget met
- **Architectural guarantees validated**: the ADR-committed patterns actually work as documented
- **Team formed**: engineers onboarded via [`docs/07-handbook-for-engineers.md`](../docs/07-handbook-for-engineers.md); Week 1-4 onboarding program executed for at least 3 of the hires

### 2.4 Risks

- Hiring pace slips → timeline slips; infra work done by the team present, MVP 1.0 timeline adjusts accordingly
- AWS capacity issues in us-east-2 (rare but real) → contingency plan to use us-east-1 as fallback
- Terraform state management debates consume more time than expected → commit to OpenTofu + S3 backend with DynamoDB lock early

---

## 3. Alpha (internal) — Year 1 Q2 (Months 3-5)

**Goal**: core engagement lifecycle working end-to-end with seeded Oakfield data. Internal team and design partners only; no external customer commitments.

### 3.1 Scope

**Data model and pack library**:
- Standard Pack population: GAGAS:2024, IIA_GIAS:2024, SINGLE_AUDIT:2024, SOC2:2017, ISO_19011:2018 (beta)
- Tenant data model: Engagement, Finding, Recommendation, Report, CAP entities
- Bitemporal columns on Finding + hash-chained `audit_event` table operational

**Core flows**:
- Tenant provisioning (automated via Terraform + onboarding pipeline)
- OIDC SSO via test IdP
- Engagement creation with multi-pack attachment
- APM authoring (collaborative editing via OT, not CRDT)
- PRCM matrix
- Work programs and basic work papers (no cross-WP refs yet)
- Finding authoring with semantic core + standardExtensions + classifications
- Recommendation authoring
- Yellow Book report rendering (basic template; not yet styled to final)
- Dashboard home page

**Oakfield E2E test**:
- Priya logs in, creates an engagement, attaches packs, builds APM, builds PRCM, authors work papers, escalates observation to finding, authors recommendation, drafts Yellow Book report. The flow works, even if rough.

### 3.2 Gate criteria — must-pass before Private Beta

- Oakfield E2E flow completes in staging without manual DB intervention
- p99 latency for tRPC queries < 500ms under light load (alpha-scale; not yet GA-scale)
- No cross-tenant leakage in any test
- Seed data imports cleanly; tenant offboarding cleans up cleanly
- **Data migration validated with realistic source data**: successfully ingest a sanitised historical engagement from at least one design partner via CSV import (engagements + findings + staff + CPE). This is deliberately pulled forward from Private Beta to Alpha — if the CSV import pipeline doesn't survive first contact with real, messy customer data (varying column names, encoding issues, date formats, duplicate records, missing required fields), the Private Beta onboarding will consume disproportionate engineering time. Better to discover these issues in Alpha where they're cheap to fix than in Private Beta where they block pilot customers

### 3.3 Business objectives

- **Core data model validated in code**, not just on paper — the three-tier pack taxonomy, the Finding shape with per-pack rendering, the multi-pack engagement attachment all work as designed
- **Design partners engaged** — 2-3 Segment A prospects commit to Private Beta with paid-beta pricing, acknowledging incomplete state
- **UX primitives established** — the design system from [`frontend/`](../frontend/) is applied to the Alpha surface; core patterns (pack attachment UI, finding authoring rich-text, work paper review) are validated with design-partner feedback

### 3.4 Risks

- Design partners request features outside the plan for beta consideration → decline with specific "that's in MVP 1.5" or "that's in v2.1" framing; partners who need those to sign wait for the relevant release
- Work paper UX unexpectedly hard → pair with a partner CAE for real work paper flow testing in Month 4, not Month 8

---

## 4. Private Beta — Year 1 Q3 (Months 6-8)

**Goal**: 2-3 paid pilot customers running real engagements under a private beta agreement. Product is feature-incomplete but actively used on real audits.

### 4.1 Scope

Everything in Alpha, plus:

**Additional feature build**:
- PBC Request Management (Module 7a) — full MVP scope including email-based auditee fulfilment
- Pack annotation/override (Module 14) with annotation-impact preview
- Multi-report per engagement (Yellow Book + Schedule of Findings and Questioned Costs)
- Compliance-statement builder for the 2 reports
- Strictness resolver UI + override
- CAP authoring (auditee side) + verification (auditor side)
- Notifications & Alerts Center (Module 16a) — in-app + email + Teams integration
- Activity feed + comments + @mentions
- Tenant admin console + basic platform admin tooling
- Webhook delivery + API key management + public REST API at `/v1/*`

**Operational maturity**:
- Observability dashboards operational; first real incidents practiced
- SOC 2 Type I auditor engagement started (Month 6)
- Drata or Vanta populated with real evidence
- 99.9% SLA tracking via internal dashboards

### 4.2 Pilot customer contracts

Each Private Beta customer contract explicitly:
- Priced at 50-70% of standard Professional-tier pricing
- Acknowledges feature incompleteness and month-over-month rapid evolution
- Commits customer to providing structured feedback via monthly review calls
- Gives customer right to cancel at GA if MVP 1.0 doesn't meet their needs (risk of customer churn at GA is real)
- Commits AIMS to providing priority support and any bug fixes within 7 business days
- Commits AIMS to producing the 5 deferred Single Audit reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP as formal report, Engagement Letter) via professional services at no additional cost through MVP 1.5 ship (per [`04-mvp-scope.md §7.2`](04-mvp-scope.md))

### 4.3 Segment A security-review friction — explicit mitigation path

Mid-tier CPA firms are structurally paranoid about their supply-chain security (they audit supply chains for a living). Putting live client audit data into a SaaS platform pre-SOC-2-Type-I is a real procurement blocker. Private Beta go-to-market must plan for this:

**Compliance evidence readiness at Private Beta start (Month 6)** — the package must be production-quality, not draft:
- Sub-processor list complete and accurate
- DPA template legal-counsel-reviewed and executable on Day 1 of pilot
- Pen test report from a named security firm (SISA, Bishop Fox, Trail of Bits, or similar) summarised for customer distribution
- CAIQ v4 / SIG Lite questionnaires pre-answered with 95%+ question coverage
- Trust center at `trust.aims.io` fully published (not "coming soon")
- SOC 2 Type I fieldwork in-progress with named auditor; "our SOC 2 report is under audit, expected [specific date]" is the statement we make; this is defensible only when it's true

**Dedicated-VPC deployment option for first 3 Private Beta customers**: where a pilot customer's InfoSec team blocks standard SaaS tenancy, stand up a per-customer isolated infrastructure (same code, dedicated VPC + dedicated RDS + dedicated S3 + customer-controlled KMS). Operationally expensive (~1.5x standard SaaS cost per customer) but closes the security-objection path for the customers most worth winning. Budget 3 such deployments into Year 1 Q3–Q4 infrastructure planning.

**Dummy-data fallback acknowledged**: if a pilot customer's security team absolutely will not approve live-data use during beta, accept the dummy-data constraint and mark that pilot's "real audit work" success metric as not-achievable for that customer. Better 2/3 beta customers on real work than losing a pilot to InfoSec objection.

**CISO-level reference contact on our side**: the pilot customer's InfoSec team should be able to reach our CISO (or VP Eng dual-hatted per [`docs/06 §6.3`](../docs/06-design-decisions.md)) directly for questions and walkthroughs — not routed through sales. This is the signal that we take their objections seriously and that our security posture is defensible by a named human, not just by a security-questionnaire answer.

### 4.4 Gate criteria — must-pass before GA

- **Oakfield-equivalent E2E test passes** (all of [`04 §5.1`](04-mvp-scope.md) acceptance criteria)
- **Load test passes**: 500 concurrent users, p99 < 300ms for tRPC queries
- **Security review completed**: pen test + SAST + SCA sweep; critical findings resolved; high findings have remediation plan
- **Pilot customer SLO met**: each beta customer sustained 99.9% availability over at least one month
- **Support responsiveness proved**: tickets answered within contract SLA; no P1 incidents unresolved > 4 hours
- **No cross-tenant leakage incidents** throughout beta
- **Compliance evidence package prepared**: sub-processor list, DPA template, trust-center draft, SOC 2 readiness evidence

### 4.5 Business objectives

- **3 active pilots** generating real audit work; at least one is a Single Audit engagement demonstrating multi-pack + multi-report
- **First paid revenue booked** (small, but real — first invoices paid)
- **Customer Success playbook drafted** from actual onboarding experience with pilots
- **Sales-enablement material** drafted with real demos and real customer reference quotes

### 4.6 Risks

- Pilot customer discovers a fundamental product problem that requires rework → slip MVP 1.0 GA; acknowledge honestly rather than ship broken
- Pilot customer churns mid-beta → replace; have 1-2 backup prospects lined up
- Pen test finds critical issue → remediate before GA; no exceptions

---

## 5. MVP 1.0 — General Availability — Year 1 Q4 (Months 9-10)

**Goal**: product available to paid customers in Segment A (sales-assisted) and Segment B (self-serve). Public launch. Marketing / sales / trust / documentation all ready.

### 5.1 Scope

Complete MVP 1.0 per [`04 §2`](04-mvp-scope.md) — ~184 features across 20 modules. Private Beta scope, plus:

- Self-serve signup flow tested end-to-end
- Billing portal operational with first invoices processing
- Developer portal launched (OpenAPI 3.1 spec, webhook event catalog, API key management)
- Trust center published at `trust.aims.io`
- Subprocessor list public
- DPA template downloadable
- Security questionnaire library (~150 pre-written answers)
- Marketing site at `aims.io` launched
- Customer Success team hired / trained

### 5.2 Launch gate criteria — must-pass before public GA

- **All Private Beta customers retained through pilot→GA transition** (or explicit "acceptable churn" documented per customer)
- **Load test at GA scale**: 1000 concurrent users, p99 < 500ms; p99 report gen < 30s
- **Chaos-engineered DR drill passes**: 15-min RPO / 1-hr RTO validated
- **SOC 2 Type I fieldwork complete** (report due within 3 months post-GA; attestation path is credible)
- **First 3 non-beta paid customers signed** (proving the GTM motion works outside the design-partner network)
- **Monitoring / alerting production-ready**: on-call rotation established; PagerDuty integrated; runbooks tested
- **Documentation complete**: customer-facing help center; developer portal; internal engineer handbook; all in production form
- **Incident response playbooks tested** via tabletop exercise with security lead

### 5.3 Business objectives

- **Year 1 revenue booked**: target run-rate ~$500K ARR by end of Q4 (rough working hypothesis; refine with pricing finalisation)
- **~10 paying tenants** (5-8 Segment A Professional tier + 3-5 Segment B Starter tier)
- **First Segment C government lighthouse prospect in active pursuit** (contract signature unlikely in Q4; pipeline visibility is the objective)
- **Developer portal adoption**: at least one external integrator building against the REST API (even if it's their side project; showing external interest matters)
- **Customer health scoring** operational — at least one customer shows "expand" signal (request for additional seats or upgrade to Enterprise tier)

### 5.4 What GA launch week looks like

Week -4 to -1: pilots promoted to GA pricing; public registration enabled; sales onboards first 3-5 paying customers from a pre-qualified pipeline.

**Launch day**:
- Blog post from founder on positioning (`blog.aims.io` / company Substack / LinkedIn)
- Product Hunt launch scheduled for Day 2 or 3 to catch weekly cycle
- Developer portal announcement to Hacker News (`show hn` submission)
- Email blast to opted-in waiting list
- Press release to GRC / audit trade publications
- Customer Success proactively reaches out to beta customers announcing GA readiness

Week 1-4 post-launch: sales pipeline activation, early customer feedback review, first post-launch sprint planning.

### 5.5 Risks

- Launch day traffic overloads infrastructure → auto-scaling configured; degraded-mode fallbacks tested; founder on-call
- Marketing over-promises relative to MVP scope → explicit "here's what's in 1.0; here's what's in 1.5" messaging; no claim of "complete audit platform" in launch materials
- Pilot customer churns within 30 days of GA → treat as highest-priority signal; founder personally manages retention conversation; lessons learned into MVP 1.5 priorities

---

## 6. MVP 1.5 — Year 2 Q2 (Months 15-16)

**Goal**: product operationally complete for Segment C (government audit shops). QA program, extended reports, SSO depth, compliance tooling all land.

### 6.1 Scope

Per [`04 §3`](04-mvp-scope.md):

- QA module completion (60+ item GAGAS checklist; peer review evidence bundle; QAIP; QA dashboard)
- 5 additional Single Audit reports + IIA Audit Committee + ISO Audit Report templates
- SAML 2.0 SSO + full SCIM 2.0
- Scope change management; cross-work-paper references; finding amendment workflow + diff view; multi-year audit cycle tracking
- Board presentation pack + AC communication log
- Compliance evidence exports; DSAR tooling; CPE evidence bundle
- Slack integration; notification history
- SQS inspector internal UI
- Subprocessor change notification automation

### 6.2 Gate criteria

- First Segment C pilot customer (government audit shop) running real engagements on MVP 1.5
- Peer review evidence bundle passes SME review (external CAE or peer-review expert validates the bundle format)
- SOC 2 Type I report **received** (due ~3 months post-GA; by now should be available)
- SOC 2 Type II fieldwork underway (target completion Year 2 Q4)

### 6.3 Business objectives

- **Year 2 H1 revenue**: expanded pipeline with Segment C prospects converting
- **First signed Segment C contract** — government audit shop paying standard Government-tier pricing
- **Segment A expansion**: existing customers upgrading from Professional to Enterprise tier as their usage matures
- **Peer-review evidence bundle demo'd in at least 2 sales conversations** — the Segment C differentiator story is operational

### 6.4 Risks

- Segment C government procurement cycles consume more sales-cycle time than projected → Year 2 Q2 MVP 1.5 launches without a signed government contract in hand; pipeline visibility is the Year 2 H1 target, contracts come in H2
- QA module scope is deeper than estimated → slip MVP 1.5 to Q3; explicitly acknowledge vs. ship incomplete QA features
- SOC 2 Type II audit reveals gaps → remediate; do not ship MVP 1.5 with unremediated audit findings

---

## 7. v2.1 — Year 2 Q4 (Months 21-22)

**Goal**: advanced integrations, enterprise polish, segment-A-enterprise features.

### 7.1 Scope

- DOCX report generation
- OAuth2 client credentials flow
- PCAOB report templates
- Report redaction for distribution
- `soxSuppressRecommendation` UI polish
- Pack dependency graph visualization
- Power BI / Tableau template files
- DND hours for notifications
- Bulk ops for CAPs and work papers (extended from findings-only in MVP 1.0)
- Audit Committee presentation pack (extended from MVP 1.5 basic)
- `require_instant_revocation` tenant flag
- IP allowlist (optional, per tenant)
- Scheduled report delivery
- Report cover-sheet and TOC customization

### 7.2 Gate criteria

- Segment A Enterprise tier offering matured — bulk ops + advanced integrations + redaction make this tier credibly differentiated from Professional
- SOC 2 Type II report received (received during Year 2 H2)
- ISO 27001 certification engagement kicked off (target Year 3 Q1 completion)

### 7.3 Business objectives

- **Segment A Enterprise-tier adoption**: 3-5 Enterprise contracts signed, proving the tier's commercial viability
- **Year 2 ending-ARR**: target $2-3M ARR (rough working hypothesis; refine with pricing finalisation)
- **Developer portal usage growth**: multiple external integrators building against the REST API
- **Public API stability**: first deprecation cycle for a dated-minor version announced (per [ADR-0007](../references/adr/0007-api-versioning-hybrid.md)) — proves the versioning mechanism works in production

---

## 8. v2.2+ — Year 3+ (Months 24+)

**Goal**: strategic moat capabilities. This phase is open-ended; specific features ship based on real customer demand signals.

### 8.1 Primary v2.2+ scope

**Full pack authoring ecosystem** (the long-term differentiator):
- Custom pack authoring from scratch (tenant-level) — the full Kalpana use case beyond annotation/override
- Pack authoring SDK (external) — CLI + validation framework for consortium pack authors
- Private consortium pack registry — members-only publication and discovery

**Operational maturity**:
- Regional silo provisioning automation — standing up eu-central-1 as a repeatable weeks-not-months process
- On-premises deployment packaging — Helm chart + Docker Compose bundle for government / regulated customers

**Mobile + offline**:
- Native mobile / tablet app pilot
- Offline work-paper authoring with eventual consistency sync

**Intelligence layer**:
- AI-assisted finding narrative drafting (from auditor-provided evidence; never replacing judgment)
- AI-assisted evidence extraction from uploaded documents
- Cross-engagement pattern recognition (e.g., "this finding wording matches a prior finding; link?")
- Risk-based annual plan optimisation (ML-assisted)

**Compliance expansion**:
- HIPAA BAA + HIPAA compliance attestation (Phase 5 per [`docs/06 §6.3`](../docs/06-design-decisions.md))
- FedRAMP Moderate ATO process (Phase 6; 12-18 month cycle)

### 8.2 Prioritisation within v2.2+

Features ship when:
- A paying customer with a confirmed contract commits to the feature (demand signal)
- The engineering investment is justified by either the confirmed demand or strategic-differentiator value
- Prerequisites are in place (e.g., mobile requires responsive design stable at MVP 1.0 first)

v2.2+ is not a single release; it's a series of minor releases each adding one or two v2.2+-tagged capabilities based on demand.

### 8.3 Business objectives

- **Segment C government contract volume ramping** — the Year 2 Q4 first contract starts a cadence of additional government signings through Year 3
- **First international tenant** (Segment D) — eu-central-1 silo stands up in support
- **FedRAMP Moderate ATO achieved** (targeted Year 3 Q3-Q4)
- **Year 3 ending-ARR**: target $5-8M (rough working hypothesis)

---

## 9. What gates each release — decision criteria

Each release gate is a formal checkpoint where leadership decides: proceed to next phase, or hold. The criteria:

### 9.1 Engineering Kickoff → Alpha (Month 3)

**Proceed if**:
- All §2.2 gate criteria met
- Engineering team at ≥ 6 engineers (minimum for Alpha-pace work)
- ADR-committed architectural patterns validated in working code

**Hold if**:
- Infrastructure integration tests failing
- Hiring significantly off-pace (< 4 engineers)
- Architectural decisions revealed as impractical (triggers ADR review)

### 9.2 Alpha → Private Beta (Month 6)

**Proceed if**:
- All §3.2 gate criteria met
- Oakfield E2E flow works end-to-end in staging
- At least 2 design partners committed to paid Private Beta pricing

**Hold if**:
- Oakfield E2E fails at critical flow steps
- Design partners all decline Private Beta pricing (GTM signal; not engineering)
- Load test reveals fundamental performance issue

### 9.3 Private Beta → MVP 1.0 GA (Month 10)

**Proceed if**:
- All §4.3 gate criteria met
- Pilot customers recommend the product honestly (NPS > 0 across pilot customer contacts)
- Marketing / sales / customer-success infrastructure ready
- Legal + compliance infrastructure ready (DPA templates, subprocessor list, trust center)

**Hold if**:
- Pilot customer churns mid-beta due to fundamental product issue
- Security review finds critical issue requiring major remediation
- Marketing / GTM not ready (launches should be delayed, not held)

### 9.4 MVP 1.0 → MVP 1.5 (Month 16)

**Proceed if**:
- MVP 1.0 reached ≥ 10 paying customers signed
- Engineering velocity sustained through post-launch period
- SOC 2 Type I report received

**Hold if**:
- MVP 1.0 customer base < 5 (indicates GTM failure requiring investigation before adding scope)
- Post-MVP 1.0 support load saturates engineering team (MVP 1.5 is additive; if maintaining 1.0 is consuming all capacity, hold 1.5 until stabilised)

### 9.5 MVP 1.5 → v2.1 (Month 22)

**Proceed if**:
- MVP 1.5 customer adoption successful — Segment C customers onboarded
- SOC 2 Type II report in hand

**Hold if**:
- Segment C go-to-market fails (< 1 signed government contract by Q3 Year 2)

### 9.6 v2.1 → v2.2+ (Month 24+)

v2.2+ is demand-driven. No gate; individual features enter v2.2+ scope when a paying customer commits to them.

---

## 10. Roadmap risks — macro level

Beyond per-phase risks, four macro-level risks affect the entire roadmap:

### 10.1 Competitor acquisition

A major competitor (TeamMate+, AuditBoard, ServiceNow) announces a product that directly competes with our multi-standard differentiator. Mitigation: the architectural commitment is ~18 months ahead of any realistic competitor pivot; their response requires data-model restructure that takes longer than our MVP 1.0 ship. Ongoing competitive monitoring per [`references/competitor-analysis.md`](../references/competitor-analysis.md); refresh quarterly.

### 10.2 Macroeconomic disruption

Budget-pressure environment causes audit-tool purchase cycles to elongate; CPA firm consolidation reduces the Segment A TAM. Mitigation: customer-retention focus in tougher climates; expansion revenue from existing customers takes priority over new-logo acquisition; pricing flexibility for multi-year commitments.

### 10.3 Regulatory shift

A major regulatory change (e.g., AICPA's Quality Management Standards absorbing significant portions of IIA GIAS, or an unexpected GAGAS revision arriving mid-cycle) forces methodology pack updates that consume engineering time. Mitigation: methodology-pack maintenance is a standing capacity allocation; major changes trigger fast-response; standards-change monitoring automated where possible.

### 10.4 Funding constraints

The roadmap assumes engineering team scaling to 12-15 engineers by MVP 1.5 and possibly 20-25 by v2.2+. Constrained funding cuts this target by 30-50%, extending timelines proportionally. Mitigation: roadmap explicitly scoped to minimum-staffing assumptions in MVP 1.0 (~10 engineers); additional scope scales with team size.

---

## 11. The "what if we slip" playbook

When (not if) a phase slips, how to respond:

### 11.1 One-month slip

- No marketing / sales adjustment needed; internal schedule compresses downstream phases
- Engineering team communicates honestly; does not cover slip with feature compression

### 11.2 One-quarter slip

- Adjust external messaging; update trust center with revised launch timeline
- Commercial sales cycles that were dependent on the ship date get extended; customers in active pipelines get explicit notice
- Re-examine whether a scope cut is appropriate (shipping less on the original date beats shipping everything on the new date)

### 11.3 Half-year-plus slip

- Formal roadmap revision; all downstream phases rescheduled
- Investor / board communication: honest explanation of cause; plan for not-again recurrence
- Consider whether a scope shuffle could de-risk: e.g., swapping an MVP 1.0 feature for an MVP 1.5 feature based on real design-partner signal
- Engineering leadership review: is the timeline assumption still realistic given team size and complexity?

The antipattern to avoid: **shipping the original scope late, then compressing the next phase to catch up**. That compounds the slip. Shipping less-on-time beats shipping all-late.

---

## 12. References

- [`product/04-mvp-scope.md`](04-mvp-scope.md) — the scope this roadmap delivers
- [`product/01-product-vision.md`](01-product-vision.md) — segment strategy driving the phase alignment
- [`product/02-personas.md`](02-personas.md) — personas each phase serves
- [`product/03-feature-inventory.md`](03-feature-inventory.md) — feature catalogue this roadmap navigates
- [`references/adr/`](../references/adr/) — the 7 ADRs providing architectural commitments
- [`docs/06-design-decisions.md`](../docs/06-design-decisions.md) §6 — commercial-model tier structure
- [`references/competitor-analysis.md`](../references/competitor-analysis.md) — competitive landscape the roadmap responds to

---

## 13. Domain review notes — Round 1 (April 2026)

This roadmap went through external domain-expert review alongside [`04-mvp-scope.md`](04-mvp-scope.md) in April 2026. Verdict: **Approved with four specific refinements**, all captured. Per-doc changes noted in [`04-mvp-scope.md §11`](04-mvp-scope.md); the roadmap-specific changes are summarised here.

### Round 1 — §3.2 Alpha data migration gate added

Reviewer flagged that if CSV-import bugs surface in Private Beta (Month 6), they consume pilot-validation time. Fix: added to §3.2 — successfully ingest a sanitised historical engagement from a design partner via CSV at Alpha gate (Month 5–6). This pulls the pain forward to where it's cheap to fix.

### Round 1 — §4.3 Segment A security-review friction mitigation added

Reviewer correctly identified that mid-tier CPA firms' own paranoia about supply-chain security is a specific Private Beta risk that wasn't previously enumerated as a defined mitigation plan. Fix: new §4.3 with:
- Compliance evidence readiness requirements at Private Beta start (Month 6)
- Dedicated-VPC deployment option for first 3 pilot customers
- Dummy-data fallback acknowledged as valid for pilot customers whose InfoSec blocks live-data use
- CISO-level reference contact available directly to customer InfoSec teams

Sections §4.3 onward renumbered (4.3 → 4.4 gate criteria; 4.4 → 4.5 business objectives; 4.5 → 4.6 risks).

### Round 1 — §4.2 pilot contract language strengthened

Reviewer endorsed the professional-services package for the 5 deferred Single Audit reports as a "brilliant, unscalable startup hack." Fix: §4.2 contract language now explicitly commits AIMS to producing the 5 deferred reports (SEFA, Summary Schedule of Prior Audit Findings, Data Collection Form, CAP as formal report, Engagement Letter) via professional services at no additional cost through MVP 1.5 ship.

### Round 1 — no macro-level changes

Gate-criteria framework, slip playbook, phase sequencing, gate decision points, and commercial trajectory targets all retained unchanged. Reviewer's verdict: the macro roadmap structure is sound; refinements are at the pilot-mitigation and data-migration-timing level, not at the roadmap-shape level.

### Final verdict

Reviewer's framing: "The plan is aggressive, and you will likely slip a month or two, but because you have documented why things are sequenced the way they are, a 2-month slip won't break the company — it will just shift the calendar."

That is the intended outcome. The slip playbook in §11 exists precisely because we expect to invoke it; we have not planned around a zero-slip scenario that pretends engineering reality doesn't apply.

---

*Last reviewed: 2026-04-21. Phase 2 deliverable; R1 review closed.*
