# Product Vision

> What AIMS v2 is as a product, who it's for, why they'd pay for it, and what it deliberately is not. Companion to [`docs/01-introduction.md`](../docs/01-introduction.md), which tells the architecture-side story of why AIMS v2 exists. This document tells the product-side story.

---

## 1. Elevator pitch

**AIMS v2 is an audit information management platform for internal audit functions, CPA firms, and inspectors general that operate under more than one audit standard.** It lets a single engagement simultaneously claim conformance with multiple methodologies (GAGAS, IIA GIAS, ISO 19011, PCAOB), layer regulatory overlays (Single Audit, SOX §404), and test against multiple control frameworks (SOC 2, ISO 27001, NIST 800-53) — producing each stakeholder's required report automatically, without the auditor maintaining a spreadsheet of cross-standard rule conflicts.

The product is built on the insight — documented in [`docs/03-the-multi-standard-insight.md`](../docs/03-the-multi-standard-insight.md) — that no existing audit or GRC platform treats methodology as a first-class, versioned object. Competitors hard-code GAGAS (TeamMate+), or sell modules per methodology (AuditBoard/Optro), or flatten everything into an undifferentiated "authority document" (ServiceNow IRM). AIMS v2 models methodology as structured content — the three-tier pack taxonomy (methodology / control framework / regulatory overlay) — and lets engagements attach to multiple packs at once.

The product is not a greenfield experiment. AIMS v1 is an existing SPFx application (SharePoint-hosted), deployed and production-running for an internal audit division. AIMS v2 lifts the proven feature surface, generalises it beyond GAGAS, and packages it as a multi-tenant SaaS with an on-premises option for government clients.

---

## 2. Target customers — segmented by sales motion, not calendar priority

Three segments define the addressable market. Earlier drafts of this document listed them by "primary / secondary / tertiary" calendar priority, which was wrong: the B2B-to-government procurement cycle (9–18 months) is too long for a Year 1 revenue story, and the CPA-firm cycle (60–120 days) is too short to ignore early. The honest framing is three segments with **three different sales motions**, served by three different commercial tiers, running concurrently with different time horizons.

### 2.1 Segment A — mid-market CPA and advisory firms (fast sales motion, year 1 revenue driver)

Mid-tier CPA firms and advisory practices that perform both financial audits (AICPA / PCAOB methodology) and performance audits / GAGAS engagements / internal audit co-sourcing / IT audits against SOC 2 or ISO 27001. Typically 50–500 staff. Often the same firm that pulls Single Audits for nonprofit grantees. Partner economics drive purchase decisions: realisation rates, cross-sell opportunities (e.g., a firm that does SOC 2 for a client should also win that client's Single Audit), work-in-progress visibility, tool consolidation pressure.

These firms today maintain parallel toolsets — one for SOX/financial work (proprietary tool from the firm's parent network), one for Single Audit work (TeamMate+ or a spreadsheet-based homegrown system), sometimes a third for SOC 2 attestation (AuditBoard CrossComply or ServiceNow). The consolidation pitch is clean.

Sales motion: 60–120 day cycle. Sales-assisted via Professional / Enterprise tier (see [§6](#6-commercial-model-initial-sketch)). Implementation light (2–4 weeks for Professional, 1–3 months for Enterprise). Buying triggers: tool-consolidation review; partner-level margin pressure; a new cross-standard engagement that exposes the three-tool pain.

**Expected contribution to Year 1 revenue: dominant.** This is the segment that closes fast enough to book Year 1 ARR.

### 2.2 Segment B — self-serve small audit shops (fast sales motion, Year 1 volume)

Solo CPAs and small audit practices (≤5 auditors): specialised Single Audit firms serving nonprofit grantees, CPE-certified individual practitioners, small municipal audit offices at city/town scale. These shops frequently run on Excel + Word today; tool purchase is a discretionary decision below formal procurement.

Sales motion: self-serve signup, no sales conversation, month-to-month or annual subscription. Onboarding is a product-led experience — documentation + seed-data tutorial + help desk — not a services engagement. Starter tier pricing (see [§6](#6-commercial-model-initial-sketch)).

**Expected contribution to Year 1 revenue: moderate in dollars, significant in logo count.** This segment gives us volume, reference customers, and low-friction product feedback. It also proves the self-serve onboarding works before we try it on Professional-tier prospects.

### 2.3 Segment C — US state and local government audit, defensible Year-2+ play

US state / local government audit shops, county and city auditors, state university systems, federal Offices of Inspector General. The customers currently served by TeamMate+ (Wolters Kluwer) with its ~800-agency footprint. Operating under GAGAS 2024 + often IIA GIAS 2024, many performing Single Audits under 2 CFR 200 Uniform Guidance. Organisation sizes from 5-person city audit shops (which are served by Segment B) to 150-person state-level internal audit divisions and federal OIGs.

Sales motion: **government procurement cycles, 9–18 months on average**, often via formal RFPs. Implementation heavy (3–6 months) with dedicated customer success. Often contingent on compliance attestations (SOC 2 Type II at minimum; FedRAMP Moderate for federal pipeline by Phase 3).

This is not a Year 1 revenue segment. It is a **Year 2+ play** where we close the first large government logos as showcases; scale in Year 3+ as the segment accelerates. Buying triggers: TeamMate+ contract renewal; Yellow Book transition to the 2024 revision exposing gaps in incumbent template systems; new CAE arriving with expectations set by modern SaaS tools.

**Expected contribution to Year 1 revenue: token.** Maybe one or two government logos closing in late Year 1 as lighthouse customers. Real volume in Year 2+. The **defensibility** of this segment (B2G switching costs are enormous once entrenched) makes it the strategic long-term play even though Year 1 contribution is small.

### 2.4 Segment D — international public-sector audit (year 3+)

Supreme Audit Institutions (SAIs) and their subsidiary audit organisations that operate under ISSAI + GAGAS + IIA GIAS combinations, often with country-specific regulatory overlays. India's CAG, UK's NAO, Canada's OAG, and the equivalent offices across Commonwealth and EU member states. Operate at scale (hundreds to thousands of auditors) and under explicit public-transparency obligations.

Slow to move (procurement cycles measured in years; on-premises deployment frequently mandated; jurisdictional data residency required). Strategically important for scale validation and credibility but not a commercial priority until Year 3.

### 2.5 Explicitly not a target segment

- **Big Four accounting firms** — they maintain proprietary tools internally (Deloitte's Omnia, PwC's Aura, EY's Canvas, KPMG's Clara); our product would not displace these nor compete on their cost surface.
- **Fortune 500 internal audit** — AuditBoard and ServiceNow own this market with integrated risk + compliance + audit offerings, and ServiceNow in particular is backed by Big Four SI customisation that can answer most RFP requirements even where native capability lags; we are not competing for this segment.
- **Single-standard operators without multi-standard needs** — a shop that only does SOC 2 attestations or only does one methodology is over-served by us; simpler tools fit their scope better.

### 2.4 Explicitly not a target segment

- **Big Four accounting firms** — they maintain proprietary tools internally (Deloitte's Omnia, PwC's Aura, EY's Canvas, KPMG's Clara); our product would not displace these nor compete on their cost surface.
- **Fortune 500 internal audit** — AuditBoard and ServiceNow own this market with integrated risk + compliance + audit offerings; we are not competing on "SOX testing + findings + board reporting" in the commercial internal audit vertical, where their incumbency is deep.
- **Single-standard operators without multi-standard needs** — a shop that only does SOC 2 attestations or only does one methodology is over-served by us; simpler tools fit their scope better.

---

## 3. Core value proposition

Three things AIMS v2 does that competitors demonstrably do not. Each has architectural support in the ADR series and concrete evidence in the education docs.

### 3.1 Multi-standard engagements as a first-class concept

One engagement attaches to multiple methodology packs, multiple control framework packs, and optional regulatory overlays. Findings carry a semantic core plus per-pack extensions. Reports declare which pack they attest to. The compliance-statement builder assembles the "conducted in accordance with..." sentence automatically from attached packs.

This reduces — it does not eliminate — the auditor's manual rule-reconciliation work. Most numeric conflicts (retention periods, CPE hours, peer-review cycles) resolve mechanically via the strictness resolver, which picks the stricter rule and records which pack drove the decision. Philosophical conflicts between standards (GAGAS's specific documentation detail vs. IIA's specific engagement-charter language, or PCAOB's prohibition on auditor-issued ICFR recommendations vs. IIA's requirement that recommendations appear inline with findings) cannot be mechanically resolved and require explicit human override with documented rationale. The product makes these edge cases visible rather than pretending they don't exist.

Evidence:
- [`docs/02-worked-example-single-audit.md`](../docs/02-worked-example-single-audit.md) — Oakfield's Single Audit walks through GAGAS + IIA GIAS + Single Audit Overlay + SOC 2 on one engagement, seven reports produced, five stakeholder audiences
- [`docs/03-the-multi-standard-insight.md`](../docs/03-the-multi-standard-insight.md) — the architectural reasoning and competitive landscape
- ADRs [0001](../references/adr/0001-ale-replaces-pgcrypto.md) through [0007](../references/adr/0007-api-versioning-hybrid.md) — the formal records

### 3.2 Versioned, structured methodology packs

Standards change. GAGAS 2018 → 2024. IIA IPPF 2017 → GIAS 2024. ISO 27001:2013 → 2022. Our competitors handle these transitions as content updates applied globally; in-flight engagements either absorb the new content mid-stream (creating ambiguity about which version applied) or stay pinned to tenant-configured "classic templates" that don't get updates.

AIMS v2 versions packs explicitly. `GAGAS:2024` and `GAGAS:2018` are distinct pack records. Engagements pin to a version at creation. Transitions are per-engagement decisions, not global tenant decisions. Pack content is structured (not a Word template), which means methodology updates ship as data, not as a services engagement.

Bonus capability: customer-specific or region-specific methodologies (a state auditor's office with its own audit manual; a country-specific variant of ISSAI; a regulated industry's custom audit methodology) can be authored as custom packs that live alongside the shipped ones.

### 3.3 Multi-report output from one engagement

A Single Audit produces seven reports from one engagement per 2 CFR 200.515(d). GAGAS, IIA, ISO, and PCAOB each have different required sections and distribution rules. Most commercial tools model this as "one engagement, one report template," forcing auditors to hand-produce the other reports in Word outside the system.

AIMS v2 models reports as first-class objects with an `attestsTo` field declaring which pack they conform to. The same finding appears in multiple reports, rendered differently each time — the Yellow Book report shows GAGAS's four-element vocabulary; the Audit Committee report shows IIA's "5 Cs" structure with inline recommendations; the Schedule of Findings and Questioned Costs shows Single Audit's fields prominently. The document-generation engine handles per-pack rendering automatically.

---

## 4. Key differentiators from competitors

Based on live documentation validation in April 2026 (see [`references/competitor-analysis.md`](../references/competitor-analysis.md)):

| Capability | AIMS v2 | TeamMate+ | AuditBoard / Optro | ServiceNow IRM |
|---|---|---|---|---|
| Methodology as versioned first-class object | ✅ three-tier pack taxonomy | ❌ template-driven | ❌ module-packaged | ❌ flattened authority-document |
| Multi-standard engagement (statutory + professional + regulatory) | ✅ native multi-pack attachment | ⚠️ template sprawl | ⚠️ multi-module purchase | ❌ natively, but see SI note below |
| Multi-report per engagement from one finding | ✅ `attestsTo` + cross-listing | ⚠️ template per report, manual | ⚠️ module per report type | ❌ natively, but see SI note below |
| Public REST API + webhooks for integration | ✅ URL-major + dated headers + Stripe-style HMAC | ⚠️ limited; services-engagement to extend | ✅ | ✅ |
| On-premises deployment for sensitive clients | ✅ Phase 6 roadmap (FedRAMP-adjacent) | ✅ government install | ❌ cloud only | ✅ |
| Versioned pack authoring (bring-your-own methodology) | ✅ tenant-scoped pack annotation/override in MVP; full SDK + private tenant registry post-MVP | ❌ tenant template | ❌ services engagement | ❌ authority-document creation is heavyweight |
| Honest multi-region compliance story (separate silos, not shared cluster) | ✅ ADR-0006 | ✅ per-region deployment | ⚠️ cloud tenancy claims | ✅ |
| Modern SaaS stack (Next.js 15, tRPC, Fastify+NestJS split) | ✅ | ❌ .NET monolith | ✅ (React + Node) | ❌ ServiceNow platform |

**Note on ServiceNow IRM and Systems Integrators**: the table above evaluates out-of-the-box product capability. Enterprise GRC procurement frequently doesn't work that way. A prospect on ServiceNow IRM typically has a Big Four SI (Deloitte, PwC, EY, KPMG) as an integration partner; when that prospect asks "can ServiceNow do multi-standard reporting like AIMS v2?", the SI's honest answer is "yes, we can build the customisations to make it do that on our Now platform instance for you." This doesn't make ServiceNow's native capability stronger, but it *does* mean a ServiceNow-incumbent prospect can credibly defer to their SI rather than switching platforms. Our sales narrative against ServiceNow should therefore be about **total cost of ownership and implementation speed** (our out-of-the-box vs. their 6–12 month custom-dev), not about raw native capability — ServiceNow's ecosystem absorbs the native-capability gap at a cost their customers have already committed to.

---

## 5. What AIMS v2 is NOT

A product's negative architecture is as definitional as its positive feature list. These are the things AIMS v2 deliberately does not and will not do. All are elaborated in [`docs/06-design-decisions.md` §7](../docs/06-design-decisions.md#part-7--negative-architecture-what-we-deliberately-dont-do).

- **Not an "AI auditor."** We do not automate the evidence-evaluation judgment that professional standards require a qualified human auditor to exercise.
- **Not a financial system of record.** We host audit work, not the auditee's general ledger, transactional data, or payroll systems.
- **Not an auditee's project-management tool.** We track corrective action plans and verify completion; we don't run the auditee's implementation work.
- **Not a regulator-submission pipeline.** We produce the correct filing artifacts (Single Audit package for FAC, SOX §404 letter for SEC, ISO audit report for certification body); the submission happens outside our system.
- **Not a bespoke workflow designer or BI tool.** Workflows are declared per methodology pack, not drawn visually; analytics are exported to customers' existing BI stack via a star-schema warehouse export, not authored in-product.
- **Not a competitor to OSCAL for control catalogs.** We adopt OSCAL where it fits (control framework packs) and interoperate.
- **Not an in-house search or file-conversion engine.** When full-text search matters, we integrate Algolia or AWS OpenSearch; when file conversion matters, we integrate CloudConvert or Aspose. We don't build these categories.

---

## 6. Commercial model (initial sketch)

Not locked in — the roadmap ([`05-roadmap.md`](05-roadmap.md), Phase 2) will commit to specific tiers — but the shape:

### 6.1 SaaS tiers

- **Starter** — solo auditor / small internal audit shop (≤5 users, 1 methodology pack active). Target: self-serve onboarding, low-touch sales. Monthly per-user pricing.
- **Professional** — multi-user audit function (5–50 users, up to 3 methodology packs active + control frameworks). Single Audit overlay available. Standard support. Annual contracts.
- **Enterprise** — multi-function audit operations (50+ users, unlimited pack attachments, SSO, SCIM, dedicated support, priority road-map input). Custom pricing.
- **Government / Regulated** — federal / state government-audit shops requiring GovCloud deployment, FedRAMP attestation, extended support hours. Dedicated account management. Custom pricing with multi-year commitments.

### 6.2 On-premises option

For customers who cannot use cloud (federal agencies with specific data-handling rules, international SAIs with country-specific residency requirements, legal-hold scenarios). Delivered as a Helm chart or Docker Compose bundle; customer runs the infrastructure; we provide periodic releases and support. Higher per-seat licensing to account for the lost SaaS margin and the additional support overhead.

### 6.3 Services — tiered to match reality

The "services-minimised SaaS" claim this document originally carried was naive. In the audit SaaS space, enterprise and government customers demand meaningful implementation services — decades of legacy data to migrate, bespoke Word templates to port, change-management inertia to overcome, specific SSO/SCIM integrations to configure per IdP. AuditBoard is a major services business dressed as a SaaS business; ServiceNow IRM runs through SI partners like Deloitte and PwC precisely because implementation is the hard part. Pretending we can self-serve our way into a 150-person state audit bureau is wishful thinking.

The honest shape per tier:

- **Starter tier — self-serve, no services.** Documentation, seed-data tutorial, community support. Onboarding is a product-led experience. Expected customer size: solo CPAs and small audit practices (Segment B from [§2](#2-target-customers--segmented-by-sales-motion-not-calendar-priority)).
- **Professional tier — self-serve with safety net.** Documentation-led plus standard support (email, 24h response). Onboarding webinars group-scheduled monthly. Optional paid 2–4 week implementation package available. Expected customer size: mid-market CPA firms (Segment A).
- **Enterprise tier — sales-assisted + optional services.** Dedicated customer-success manager. Standard 1–3 month onboarding engagement included with annual contract (data import, SSO/SCIM setup, tenant configuration, initial training, two live workshops). Additional services (custom pack annotation/override authoring, custom report templates, migration from competitor tool) available as paid add-ons. Expected customer size: mid-market CPA firms at scale, smaller government shops (Segments A and the small end of C).
- **Government / Regulated tier — services-heavy.** 3–6 month implementation engagement included. Dedicated CSM with public-sector industry expertise. Optional on-site training. Custom pack annotation/override authoring typically included as part of onboarding. FedRAMP attestation support. Separate pricing structure (government-specific SLAs, multi-year commitments). Expected customer size: state audit bureaus, federal OIGs (Segment C).

Services revenue as a percentage of total should stabilise in the 20–35% range — meaningful but not dominant. Lower than AuditBoard's ~40%+ because our product is designed to minimise the customisation that drives services; higher than the naive "self-serve SaaS" claim because the enterprise and government tiers genuinely need human hands in the setup phase.

**Custom pack authoring** — a tenant wanting their audit manual as structured content — is handled as follows: (a) the MVP provides tenant-scoped pack annotation/override (tenants extend the shipped GAGAS or IIA pack with their specific rules), sufficient for most government audit bureau needs; (b) full custom-methodology authoring via the pack SDK is deferred to post-MVP and will be a paid services engagement at launch, transitioning to self-serve when the SDK matures. This is addressed further in [§10 (v1 → v2 relationship)](#9-relation-to-aims-v1) and in [`03-feature-inventory.md`](03-feature-inventory.md) Module 14.

### 6.4 Pricing anchors

Not final. Current working hypothesis:
- Starter: $29-49 / user / month
- Professional: $99-149 / user / month
- Enterprise: $199-399 / user / month effective (volume-dependent)
- Government / regulated: TBD

Validation: the Starter tier's price deliberately undercuts TeamMate+ and AuditBoard's per-user pricing for small-shop customers. The Enterprise tier is competitive with equivalent AuditBoard / ServiceNow contracts at comparable scope.

---

## 7. Success metrics

How we'd know we've built a good product (not just a good architecture). Two-year horizon:

### 7.1 Adoption

Expectations calibrated to the segment-by-sales-motion framing in [§2](#2-target-customers--segmented-by-sales-motion-not-calendar-priority):

- **End of Year 1**: ~10 paying tenants total. Mix: ~6–8 mid-market CPA firms (Segment A, Professional tier, sales-assisted close), ~2–4 small audit practices (Segment B, Starter tier, self-serve close). 1 lighthouse government logo possible but not counted on.
- **End of Year 2**: ~30 paying tenants total. Segment B (self-serve) scales to ~10–15; Segment A (CPA firms) scales to ~12–18; first 2–3 Segment C (government) logos start closing.
- **End of Year 2**: 3–5 Enterprise-tier tenants signed (across Segments A and C).
- **Late Year 2 / early Year 3**: first government / regulated tenant in GovCloud (requires FedRAMP Moderate ATO process, which takes 12–18 months to complete from initial 3PAO engagement).

The earlier "20+ paying tenants by end of Year 1" target was incompatible with honest B2G procurement timelines. The revised Year 1 target assumes most volume comes from the faster-cycle CPA and small-practice segments.

### 7.2 Product quality

- p99 request latency <300ms for tRPC queries at baseline load (per [`devops/OBSERVABILITY.md`](../devops/OBSERVABILITY.md) SLOs)
- Zero cross-tenant data leakage incidents (ever; this is existential)
- Document generation for Single Audit (7-report package) completes in <60s p99
- 99.9% availability SLA met quarterly

### 7.3 Market positioning

- First competitor reviews (G2, Capterra, Peer Insights) published with average rating ≥4.5
- Named in Gartner or Forrester coverage of the GRC / audit management category by end of year 2 (realistic milestone: "Cool Vendor" or equivalent scoped inclusion, not Magic Quadrant leader)
- At least one public case study from a named primary-segment customer

### 7.4 Platform signals (MVP-era and post-MVP)

**MVP-era signals (Year 1-2)**:
- At least 3 Enterprise tenants actively using tenant-scoped pack annotation/override to customise the shipped GAGAS or IIA pack (demonstrates the differentiator works at the smaller scope)
- External integrator builds at least one third-party tool against our public REST API
- Customers pulling AIMS data into their own BI stack (Power BI / Tableau / Snowflake) via the star-schema warehouse export, with at least one publicly-shared dashboard template contribution

**Post-MVP signals (v2.2+)**:
- Full pack-authoring SDK used by at least one customer (beyond us) to author a custom methodology from scratch — realistic when a state audit bureau or SI partner wants a structured version of their bespoke audit manual
- Private tenant-scoped pack registry adopted by at least one audit-association consortium sharing custom packs among member shops (a closed ecosystem model, not an open-source one — see [`02-personas.md §6`](02-personas.md) for why)

These post-MVP signals are explicitly not MVP requirements; the MVP differentiator is the pack annotation/override capability plus the multi-standard engagement model, which together are sufficient to demo the architectural advantage without requiring the full SDK to exist.

### 7.5 What success does not look like

Explicitly: we are *not* optimising for growth-at-all-costs metrics. Vanity metrics (total users, free-tier signups, "10,000 findings authored") are not our measures. The signals that matter:

- Paid tenants who renew and expand
- Zero cross-tenant data leakage incidents
- Expansion from Professional to Enterprise tier within a tenant (indicating the product has earned deeper investment)
- Net revenue retention > 100% (existing customers spending more year-over-year)

The earlier framing of this section included "pack authoring externally" as a success signal, which contradicted the MVP scope where full pack authoring is deferred to v2.2+. Revised framing in §7.4 now distinguishes MVP-era signals from post-MVP signals.

---

## 8. What would invalidate this vision

Per the falsifying-conditions pattern from [`docs/03 §9`](../docs/03-the-multi-standard-insight.md#9-when-we-might-be-wrong):

- **Competitor ships methodology-as-object first.** Unlikely given the architectural re-shape required for each (TeamMate+ would need to migrate 800 customers off templates; ServiceNow would need to add a methodology concept distinct from authority document), but possible.
- **Pack authoring activation energy is too high.** If writing a pack requires such deep schema expertise that no customer ever authors one, the "open methodology platform" differentiator collapses; we'd still have a good multi-standard audit tool but lose a strategic edge.
- **Multi-standard engagement is a rarer need than our research suggests.** If Single Audit volume decreases (unlikely — statute), if ISO integrated audits become less common (unlikely — IAF MD 11:2023 expanded scope), if GAGAS+IIA overlap shrinks in practice (plausible if the IIA's Global Internal Audit Standards subsume governmental nuances), the "multi-standard first" framing becomes a differentiator without a large market.
- **Machine-readable methodology standards get commoditised.** If GAO/IIA/PCAOB publish their methodologies in a unified machine-readable format (OSCAL-for-methodology), every competitor can ingest; our proprietary pack-format moat shrinks to "best implementation of an open format" rather than "the only structured format."

---

## 9. Relation to AIMS v1

AIMS v1 (SPFx, SharePoint-hosted) is production-running and serves an active internal audit division. v1 is the validation that the feature surface works for real auditors doing real audits under GAGAS + IIA GIAS.

v2 is not a rewrite for rewrite's sake. It exists because:

- SharePoint's architecture limits v1 to single-tenant, single-deployment, Microsoft-365-dependent operation — not scalable to SaaS
- v1 hard-codes GAGAS shapes into the data model (single `standard` field on engagements, GAGAS's four-element finding structure, GAGAS's report template); generalising this within v1 is more work than rebuilding on a schema that supports multi-standard from day one
- v1's UX is competent but SharePoint-shaped; modern auditors expect Notion-or-Linear-level polish, which requires stepping outside the SharePoint web-part constraint
- v1 cannot support the commercial model we want — enterprise multi-tenant SaaS with on-premises option is structurally incompatible with SharePoint hosting

The v1 → v2 relationship is not a deprecation. v1 continues to serve its existing deployment for the foreseeable future; v2 is a new product offering aimed at a broader market. The feature learning from v1 informs v2's requirements, but v2 makes its own design decisions where v1's approach was shaped by SharePoint constraints that no longer apply.

---

## 10. Domain review notes — Round 1 (April 2026)

This document went through external domain-expert review (Google Gemini, reviewer framing: "former product manager in the GRC/Audit SaaS space") in the same program that reviewed the architecture-side documentation. The review was substantive — product strategy has more judgment calls than architecture, and this doc was the target of the sharpest feedback in the whole review cycle. Recording the changes here so a future reader understands why specific sections read the way they do.

### Round 1 — go-to-market reality check

- **Segment priority swap.** The earlier draft listed segments by calendar priority: "US state/local government Year 1, CPA firms Year 1-2, international Year 2+" with a target of "20+ paying tenants by end of Year 1." Reviewer correctly flagged that B2G procurement cycles (9-18 months) make 20 government tenants in Year 1 mathematically impossible without dropping to 5-person shops that won't pay for enterprise SaaS. Fix: reframed §2 as three concurrent segments with different sales motions (Segment A mid-market CPA firms fast motion = Year 1 revenue driver; Segment B self-serve small practices = Year 1 volume; Segment C government = defensible Year 2+ play; Segment D international = Year 3+). Target revised to ~10 tenants Year 1 / ~30 tenants Year 2.
- **Services posture rewrite.** §6.3 originally claimed "services deliberately minimised." Reviewer noted this is naive for enterprise and government audit SaaS — AuditBoard is heavily services-powered; ServiceNow IRM runs through SI partners. Fix: §6.3 rewritten with honest tier-by-tier services posture (Starter self-serve; Professional self-serve + safety net; Enterprise sales-assisted + 1-3 month implementation; Government services-heavy with 3-6 month implementation). Services revenue projected at 20-35% of total, not negligible.

### Round 1 — differentiator alignment

- **Pack authoring: differentiator deferred became differentiator narrowed.** Reviewer caught a sharp contradiction — §7 claimed "adoption of pack authoring externally" as a success metric while [`03-feature-inventory.md`](03-feature-inventory.md) Module 14 deferred full custom pack authoring + SDK + registry to v2.2+. This meant v1.0 would ship looking structurally like TeamMate+. Fix: pulled tenant-scoped **pack annotation/override** (annotate/extend the shipped GAGAS pack; not authoring from scratch) into the MVP as the MVP-era differentiator. Full SDK + private registry stays deferred. §7.4 now separates MVP-era success signals from post-MVP success signals.
- **Ecosystem reframe.** Reviewer correctly flagged that the original "open-source methodology pack ecosystem" framing was wish fulfilment — audit standards are IP-protected by IIA / ISO / AICPA and not available as open contributions. Fix: reframed as tenant-scoped private packs + post-MVP **private audit-association registry** (closed-membership pack sharing among consortium audit shops), not public open-source. See [`02-personas.md §6`](02-personas.md) for the corresponding persona reframe.

### Round 1 — claim calibration

- **§3.1 overclaim softened.** "Without the auditor manually reconciling rule conflicts" was vendor-pitch language. Fix: now honestly states most numeric conflicts resolve mechanically via the strictness resolver but philosophical conflicts (e.g., PCAOB's prohibition on auditor-issued ICFR recommendations vs. IIA's requirement they appear inline) require explicit human override with documented rationale.
- **§4 ServiceNow recalibration.** The competitive table evaluated ServiceNow on native out-of-the-box capability. Reviewer pointed out enterprise GRC procurement frequently doesn't work that way — ServiceNow's Big Four SI ecosystem (Deloitte, PwC, EY, KPMG) absorbs native-capability gaps through custom implementation. Fix: added explicit note that our competitive narrative against ServiceNow is total-cost-of-ownership and implementation speed, not native-capability gap. Two ServiceNow table rows reframed from "❌" to "❌ natively, but see SI note below."
- **§7.5 contradiction fixed.** Originally listed "adoption of pack authoring externally" as a success metric while the feature was deferred to v2.2+; this internally implied we planned to launch a short-term novelty. Fix: §7.4 now separates MVP-era signals from post-MVP signals; §7.5 rewritten with achievable MVP-era success signals (NRR, renewal, tier expansion).

### Round 1 — missing personas flagged

Two personas were missing that a GRC product manager would expect to see: **CPA Firm Audit Partner** (the economic buyer at a firm serving Segment A, whose drivers are margin, realisation rate, cross-sell, WIP visibility — not compliance drivers like Marcus the CAE) and **PBC Request Manager** (often a distinct role at larger audit shops whose entire job is chasing auditee documents). Both were added to [`02-personas.md`](02-personas.md) as §11 and §12 respectively.

### Round 1 — feature inventory gaps

Reviewer flagged four critical missing capabilities in [`03-feature-inventory.md`](03-feature-inventory.md): a full **PBC (Provided-By-Client) Request Management** module (bulk request generation, automated reminders, status tracking, secure document staging), a **Notifications & Alerts Center** (in-app bells, email digests, Teams/Slack integrations, @mentions), **Activity feeds** (unified timelines per engagement), and **real-time collaborative editing** considerations. All addressed in the feature inventory; see its own Domain Review appendix for specifics.

### What this review did not move

Four specific claims that were flagged but intentionally retained after review:

- **Three-tier taxonomy is the correct mental model.** Reviewer agreed, and this is the architecturally-locked decision from ADR work.
- **On-premises deployment is part of our model.** Reviewer didn't challenge; remains as documented.
- **Multi-standard engagement is a real unmet need.** Reviewer agreed the pain is real.
- **Commercial model's rough shape (SaaS with tiers + on-prem option).** Reviewer questioned services minimisation, not the tier structure itself; tiers retained with honest services posture per §6.3.

---

## References

- [`docs/01-introduction.md`](../docs/01-introduction.md) — architecture-side introduction (why AIMS v2 exists)
- [`docs/03-the-multi-standard-insight.md`](../docs/03-the-multi-standard-insight.md) — the central architectural bet
- [`references/multi-standard-design.md`](../references/multi-standard-design.md) — formal design note
- [`references/competitor-analysis.md`](../references/competitor-analysis.md) — April 2026 competitive landscape
- [`docs/06-design-decisions.md`](../docs/06-design-decisions.md) — narrative decision log
- AIMS v1 — the existing SPFx application this v2 builds on

---

*Last reviewed: 2026-04-21.*
