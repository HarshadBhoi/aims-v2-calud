# Design Decisions

> A narrative journey through the load-bearing architectural decisions that shape AIMS v2. Tells the story — the why, the alternatives, the trade-offs — for a reader learning the system. For the structured, immutable, per-decision canonical record, see [references/adr/](../references/adr/).

---

## How to read this doc

Three kinds of architectural record live in this repo, each serving a different purpose:

- **[04 — Architecture Tour](04-architecture-tour.md)** is the *spatial* view: what lives in each folder, how the pieces fit together.
- **This doc (06)** is the *narrative* view: the story of how we got to the current shape. Decisions told in context, clustered by concern, honest about trade-offs.
- **[references/adr/](../references/adr/)** is the *canonical* view: one formal ADR per load-bearing decision, structured (Context → Decision → Alternatives → Consequences → Validation → Rollout → Threats → References), immutable once accepted.

This is the "read on a flight to understand how the system thinks" document. It is not exhaustive. A project of this size accumulates hundreds of small decisions — default timezone handling, naming conventions for boolean columns, which error code means what. Those live in code, commit messages, [engineering/CODE-STANDARDS.md](../engineering/CODE-STANDARDS.md), or ADRs when they matter. What's here is the thirty-or-so choices that shape how the codebase *looks* — the decisions that, if reversed, would force a substantial rewrite.

Reading order matters on the first read: parts are arranged by foundational-ness. The domain shape drives the data model; the data model drives the service tier; the service tier drives the ops layer; and so on outward. On any later visit, each part is self-contained.

When a decision has a formal ADR, we link to it; the ADR is the artifact of record, this narrative is the context. When a decision does *not* yet have a formal ADR, this doc is the provisional record — typically because the decision was settled early enough, or is narrow enough, that an ADR would be ceremony without payoff. The `references/adr/` folder will grow over time as specific decisions merit the structured treatment.

---

## Part 1 — Domain-shaped decisions

> The choices that make AIMS look like AIMS rather than a generic SaaS. Everything downstream — data model, service tier, UI, compliance roadmap — pivots on these.

### 1.1 A three-tier pack taxonomy: methodology / control_framework / regulatory_overlay

The earliest serious design choice was how to model audit standards themselves. Most GRC platforms treat "standard" as a single flat concept — a framework, a regulation, a policy, an authority document, all equal, all attached to controls, all contributing to compliance mapping. That flattening turned out to be wrong, and the correction shapes half the rest of the architecture.

Three kinds of thing look alike but are structurally distinct:

- **Methodology** — *how* you audit. Process, workflow, finding shape, independence rules, reporting structure. GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, AT-C §105/§205.
- **Control framework** — *what* you audit against. A library of testable control objectives or criteria. SOC 2 TSC, ISO 27001, NIST 800-53, COBIT 2019.
- **Regulatory overlay** — additional requirements layered on top of a host methodology when specific regulation applies. Single Audit (Uniform Guidance), SOX §404, CSRD/ESRS.

Methodology and control framework are orthogonal: an ISO 19011 *methodology* audit of an ISO 27001 *control framework* is one engagement; an AT-C attestation *methodology* of a SOC 2 *control framework* is another. Regulatory overlays are a third axis that modifies a methodology — Single Audit has no workflow of its own and no control library, but it adds required deliverables and fields on top of GAGAS.

Our schema has an explicit `packType` discriminator. Engagements attach to packs at type-appropriate slots: `primaryMethodology` (exactly one), `additionalMethodologies[]`, `controlFrameworks[]`, `regulatoryOverlays[]`. A grammar mnemonic that survived the external review: methodology is a *verb* (it audits), control framework is a *noun* (it is audited), regulatory overlay is an *adjective* (it modifies how something audits).

**Trade-off**: more cognitive surface at engagement creation (four questions instead of one), and pack authors must understand which bucket a new standard belongs in. Smart defaults mitigate the first (picking "Single Audit" as engagement type auto-attaches GAGAS + Single Audit overlay); the diagnostic question — "does it audit, is it audited, or does it modify how something audits?" — mitigates the second.

**Where it lives**: [03 §4](03-the-multi-standard-insight.md#4-the-three-tier-taxonomy) (full reasoning and competitive context), `data-model/standard-pack-schema.ts` (the discriminator), `references/multi-standard-design.md` (the design note that drove the schema work). No formal ADR yet — reasonable future promotion.

### 1.2 Engagement with multi-pack attachment, not single-standard

An engagement declares a `primaryMethodology`, an optional list of `additionalMethodologies`, an optional list of `controlFrameworks`, and an optional list of `regulatoryOverlays`. Every slot except `primaryMethodology` is zero-to-many.

The tempting alternative was simpler: one `standard` field per engagement, with multi-standard represented as something else — multiple engagements sharing findings, a tag set, a comma-separated string. Each alternative broke immediately when a real user hit Single Audit (three standards, statutory, ~40,000/year in the US alone) or an ISO Integrated Management System audit (four ISO standards on one engagement, formally blessed by IAF MD 11:2023). The flat shape was a local minimum that collapsed under real use.

The multi-pack shape is harder to implement but correct. Its downstream cascade — per-pack finding extensions, per-pack classifications, multi-report per engagement, a strictness resolver across attached packs — is what [03 §6](03-the-multi-standard-insight.md#6-the-implications-cascade) covers in detail.

**Trade-off**: every downstream layer (API validation, UI forms, report generation, rule resolution) has to handle the multi-attachment case natively. We're not saving ourselves any implementation effort by preserving the simple shape "somewhere else"; we pay the complexity up front where it's visible and centralised.

**Where it lives**: `data-model/tenant-data-model.ts` (the `Engagement` interface), [02 §2](02-worked-example-single-audit.md#2-engagement-setup) (worked example at creation time).

### 1.3 Finding with semantic core + per-pack extensions + classifications array

A finding must render under multiple methodologies simultaneously. Its data shape cannot be a single methodology's schema, but also cannot be a flat bag of unrelated fields — a reader of the Yellow Book report must see GAGAS's four-element structure; a reader of the IIA audit committee report must see the IIA "5 Cs"; both must be reading the same underlying finding.

The solution is a semantic core keyed by canonical element codes (`CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, and others — the list is extensible, not fixed) plus per-pack `standardExtensions` keyed by `StandardPackKey`. Each methodology pack declares `semanticElementMappings` that map its own element codes onto canonical codes with an equivalence strength (`exact`, `close`, `none`). GAGAS's `criteria` maps `exact` to `CRITERIA`; ISO 19011's `audit_criteria` maps `close` to `CRITERIA` (ISO narrows to a specific clause).

Classifications work the same way but for severity. A single finding carries an array of `FindingClassification` objects, one per attached pack whose classification scheme applies. GAGAS's deficiency tier and IIA's severity tier are not the same scheme with different labels — they measure different things, and a finding that's Significant Deficiency under GAGAS might be Major or Minor under IIA depending on which properties are salient. We store both; reports render the classification appropriate to the target pack.

**Trade-off**: the finding shape is structurally more complex than competitors' flat models, and engineers new to the codebase take time to internalise it. Most of [04 §3](04-architecture-tour.md#3-data-plane--following-an-oakfield-finding-through-the-stack) exists specifically to teach this.

**Where it lives**: `data-model/tenant-data-model.ts` (the `Finding` interface), [03 §6.1-6.2](03-the-multi-standard-insight.md#6-the-implications-cascade) (why), [02 §7](02-worked-example-single-audit.md) (worked example at authoring time).

### 1.4 Recommendations are a separate entity, many-to-many with findings

"How do recommendations attach to findings?" has four different answers across the four major methodologies:

- **GAGAS §6.47** — separate report section; one recommendation may address multiple findings; a finding may have zero or many recommendations
- **IIA GIAS Standard 15.1** — integrated with the finding as the "5th C"; required on every finding
- **ISO 19011 Cl. 6.4** — auditors do not issue recommendations; nonconformities trigger auditee-prepared Corrective Action Requests
- **PCAOB AS 2201 / AS 1305** — auditor-issued recommendations on ICFR are prohibited; self-review threat to independence

No unified recommendation model satisfies all four. We modelled recommendations as a separate entity from findings with a many-to-many relationship (`findingIds: string[]`). Rendering is controlled by each target report's `recommendationPresentation` setting: `inline` (IIA), `separate` (GAGAS), `suppressed` (PCAOB ICFR), or `both`. A finding can additionally carry `soxSuppressRecommendation: true` that forces suppression regardless of report template.

**Trade-off**: substantially more complex than "recommendation is a field on finding." Also the only shape that correctly models the real regulatory diversity. We pay a complexity bill where the law demands it; anything simpler produces defective reports.

**Where it lives**: `data-model/tenant-data-model.ts` (the `Recommendation` interface and the `soxSuppressRecommendation` flag), [03 §6.3](03-the-multi-standard-insight.md#63-recommendations--separate-entity-many-to-many-with-findings).

### 1.5 Reports carry `attestsTo`; multi-report per engagement is first-class

One Single Audit produces seven reports from one engagement per 2 CFR 200.515(d). Each attests to a different authority, has a different content structure, has a different distribution list. Flattening this to "one engagement, one report with multiple sections" conflates the legal attestation claims.

Every report has an `attestsTo: StandardPackRef` field declaring the pack the report conforms to, and an `includedFindingIds: string[]` that cross-lists findings into the report. The same finding appears in multiple reports, rendered differently each time — the Yellow Book report shows it under GAGAS's vocabulary; the Schedule of Findings and Questioned Costs shows it with Single Audit's fields prominent; the Report to Audit Committee shows it with IIA's "5 Cs" structure including the inline recommendation.

The compliance-statement builder reads the engagement's attached packs (filtering to those with `conformanceClaimed: true`) and assembles each report's "conducted in accordance with..." sentence correctly. This eliminates a persistent source of auditor error (wrong version cited, wrong standards listed, forgot one).

**Trade-off**: the document generation engine is now a first-class engineering problem — per-pack vocabulary, per-report presentation rules, per-format output (PDF / DOCX / HTML). Not an off-the-shelf templating library. This cost is acknowledged explicitly in [03 §8](03-the-multi-standard-insight.md#8-what-this-costs-us) and handled architecturally as a NestJS worker per [ADR-0003](../references/adr/0003-nestjs-scoped-to-workers.md).

**Where it lives**: `data-model/tenant-data-model.ts` (the `Report` interface), [03 §6.4](03-the-multi-standard-insight.md#64-reports--multi-report-per-engagement-each-attesting-to-a-pack), [02 §13](02-worked-example-single-audit.md) (seven-report walkthrough).

### 1.6 Pack versioning — engagements pin specific versions

GAGAS 2018 and GAGAS 2024 are different standards. An engagement started under GAGAS 2018 before the 2024 effective date applies 2018 rules; an engagement started after applies 2024. A hypothetical engagement straddling the transition complies with whichever version the auditor elected under the transition guidance.

Our schema versions packs explicitly. `GAGAS:2024` and `GAGAS:2018` are different `StandardPack` records with the same `code` and different `version`. Engagement's attached pack references carry both fields. When GAGAS 2025 eventually ships (or 2028), existing engagements do not auto-migrate — new engagements default to the current version but can pin older versions when transition rules require. A pack, once published, is immutable; corrections ship as a new version.

The alternative — treating pack content as tenant-configured templates that update globally — is how TeamMate+ and AuditBoard handle methodology. It produces the "version transition as content update" problem: the template changes globally, in-flight engagements have to decide whether to adopt the updated template mid-stream, and the audit documentation record becomes ambiguous about which version applied when.

**Trade-off**: pack authoring becomes a versioned-artifact discipline, not a tenant-configuration activity. Changing a pack means publishing a new version, not editing the old one. Higher ceremony; also higher integrity of the historical record.

**Where it lives**: `data-model/standard-pack-schema.ts` (the `code`/`version` fields and immutability invariants), [03 §6.6](03-the-multi-standard-insight.md#66-pack-versioning--methodologies-have-versions-that-engagements-pin).

### 1.7 Semantic Element Dictionary with per-pack mappings

The canonical element codes (`CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`, `OBJECTIVE_EVIDENCE`, `ROOT_CAUSE`, `RECOMMENDATION`, `NC_CLAUSE`, and more) live in a single dictionary. Each pack declares its own `findingElements` and maps them onto canonical codes via `semanticElementMappings` with an `equivalenceStrength` enum.

This is the translation layer that lets a finding authored against GAGAS render correctly under IIA or ISO rendering. The alternative — a finding stores both GAGAS fields and IIA fields redundantly — would put the burden of cross-standard consistency on auditors, which is exactly where the cross-standard bugs creep in.

**Trade-off**: mapping authoring is a real skill; pack authors must understand both the target canonical codes and the nuance of their own methodology's element semantics. We ship the dictionary with 12-15 canonical codes spanning the common ground across methodologies; future additions are pack-driven.

**Where it lives**: `data-model/standard-pack-schema.ts` (the `SemanticElementCode` enum and `SemanticElementMapping` interface), `data-model/VALIDATION.md` Layer 4.5 (mapping integrity rules).

### 1.8 Strictness resolver — union/max across attached packs

When multiple methodologies attach to one engagement, you have multiple opinions on the same operating rule. Documentation retention (GAGAS via AICPA AU-C: 5 years; PCAOB via SOX §802: 7 years; Single Audit per 2 CFR 200.517: 3 years). Independence cooling-off (GAGAS: 24 months; IIA: 12 months). CPE hours (GAGAS: 80/2yr with 24 governmental; IIA CIA: 40/yr).

The strictness resolver computes, at engagement attachment time, the effective rule per category via `max`, `union`, or `min` depending on what "stricter" means for that rule. Each computed value carries a `drivenBy` audit trail recording which pack won. Two years later, when someone asks "why is our retention five years?", the answer is queryable: GAGAS drove it via AICPA AU-C incorporation.

The resolver re-runs on any pack attach or detach; change events are logged. This is not a convenience feature — it's the mechanism that lets the platform enforce multi-standard compliance without the auditor maintaining a spreadsheet of rule conflicts.

**Trade-off**: the "additive hardening" case — one standard requires X specific procedure, another requires Y specific procedure, neither prohibits the other — is handled as union (both required), which potentially makes the engagement more bureaucratic than either standard alone would be. This is an explicit, documented choice.

**Where it lives**: `data-model/tenant-data-model.ts` (the `EngagementStrictness` interface and `drivenBy` trail), [03 §6.5](03-the-multi-standard-insight.md#65-strictness-resolver--union-or-max-of-rules-across-attached-packs).

### 1.9 Control Matrix as a separate entity, optional FK from audit tests

The Process-Risk-Control Matrix (PRCM) is a load-bearing artifact in internal audit, SOX 404, and ISO management-system audits — each row maps a process to a risk to a control, with attributes for type, nature, frequency, owner, effectiveness. Audit tests then *exercise* those controls.

The initial v2 draft collapsed this into a row on `AuditTest` itself: `controlId`, `controlDescription`, `assertionTested`. That conflates two different lifecycle artifacts: *what controls exist and should be tested* (planning-phase, sometimes documents controls that won't be tested this engagement) versus *what was tested and what we found* (fieldwork-phase, owned by the auditor). Collapsing them makes "untested but documented" controls inexpressible, duplicates control attributes when one control gets both a TOD and a TOE, and prevents control-coverage reporting.

`ControlMatrix` is a separate engagement-scoped table; `AuditTest.controlMatrixId` is an *optional* FK so that substantive-only engagements with no upstream PRCM pay nothing. Pack-specific control attributes (COSO 2013 component, ISO 27001 Annex A clause) live in `customAttributes` JSONB; canonical attributes (type, nature, frequency, effectiveness) are first-class for indexing and reports. The matrix row carries its own status — `DRAFT → ACTIVE → TESTED → CLOSED` — independent of the engagement and of any individual test.

**Trade-off**: one more table to RLS-scope, write Prisma extension entries for, and migrate; a dual-source-of-truth between `AuditTest.controlId` (free-text, denormalized) and `AuditTest.controlMatrix.controlCode` (FK-referenced) that the API layer reconciles. Accepted because the alternative — collapsing — fails the domain on day one for any SOX or IIA shop.

**Canonical record**: **[ADR-0008](../references/adr/0008-control-matrix-as-separate-model.md)** — full alternatives (collapse-into-AuditTest, JSONB-on-Engagement, pack-templates-only), validation criteria, and rollout phases. This narrative is the orientation; the ADR is the record.

### 1.10 Risk Assessment as a per-fiscal-year history table

Annual risk assessment of the audit universe is foundational — GAGAS §5.07, IIA Standard 9.4, ISO 19011 all require it, and audit committees ask year-over-year-trend questions of the platform ("did procurement's risk profile go up or down since last year, and why?"). The history is the deliverable.

The initial v2 draft collapsed this into a JSONB `riskFactors` blob plus snapshot columns (`inherentRiskScore`, `residualRiskScore`, `lastRiskAssessment`) on `AuditUniverseEntity`. That captures *current* state but erases every prior year — trending becomes a forensic exercise (scrape PDFs, re-enter manually) rather than a query. It also flattens the dimension structure, losing schema enforcement and per-dimension indexing.

`RiskAssessment` is a separate table, one row per (auditable entity, fiscal year). Pack-defined dimensions (GAGAS 5-dim, COSO ERM, ISO 31000) live in JSONB; denormalized `compositeScore` and `riskRating` are first-class for indexing and dashboards. Snapshot columns on `AuditUniverseEntity` stay — they are a fast-path cache for the most-recent assessment, kept in sync by a trigger that fires when an assessment transitions to a locked state. Approval flows through the existing polymorphic `Approval` table with `entityType = 'risk_assessment'`. Lock semantics match other planning artifacts: editable until approved, then immutable.

**Trade-off**: two sources of truth for "current assessment" (the snapshot columns and the most-recent row), reconciled by trigger and accepted as the price of keeping the dashboard read fast. The `(entityId, fiscalYear)` unique constraint forecloses ad-hoc quarterly reassessments — if that pattern emerges as a real use case, the constraint becomes wrong and we add `assessmentDate` to the unique key (called out in the ADR's validation criteria).

**Canonical record**: **[ADR-0009](../references/adr/0009-risk-assessment-history-table.md)** — full alternatives (JSONB-on-entity, bitemporal-on-entity, event-sourcing), validation criteria, rollout. This narrative is the orientation; the ADR is the record.

---

## Part 2 — Data and security foundation

> The foundation the domain model rests on: persistent storage, tenant isolation, encryption, audit trail, historical reconstruction.

### 2.1 PostgreSQL + Prisma, not a document store

Audit data is fundamentally relational. Findings belong to engagements, engagements belong to entities, findings have recommendations, recommendations have corrective actions, corrective actions have evidence. A document store (MongoDB, DynamoDB) would let us denormalise one of those axes at the cost of every other.

PostgreSQL 16 handles our needs: relational integrity for the graph of entities, JSONB for the pack-driven variability inside findings (`coreElements`, `standardExtensions`), row-level security for multi-tenancy, strong consistency for audit-trail guarantees, excellent operational maturity on AWS RDS. Prisma is the ORM — typed, migrations-aware, good enough query ergonomics for the common case, with `$queryRaw` for the cases it isn't.

The alternative we seriously considered was a polyglot setup: Postgres for the relational spine, DynamoDB for the high-write audit event log, ElasticSearch for findings search. We rejected it for the early product — operational surface of three data stores with different consistency models, backup rules, and failure modes is not worth the specialisation until we hit specific scaling problems. We can move individual concerns to specialised stores later; starting simple is cheaper than starting distributed.

**Trade-off**: heavy JSONB usage in finding fields gives us flexibility at the cost of queryability for those specific sub-fields (see §2.5 on bitemporal + JSONB for the scaling cliff). Acceptable for current scale, revisited at ~1M findings per engagement.

**Where it lives**: `database/schema.prisma` (the schema), `database/ERD.md` (the diagram), [04 §3.2](04-architecture-tour.md#32-at-the-database-layer).

### 2.2 Tenant isolation — two layers, not one

Cross-tenant isolation is enforced in two layers: a Prisma Client Extension (primary, app-layer) injects `tenantId` into every WHERE clause; RLS policies (defence-in-depth, DB-layer) double-check. Both must pass; both existing is belt-and-suspenders against developer mistakes, raw-SQL bypasses, and ORM regressions.

The initial RLS-only plan was rejected after external review surfaced Prisma connection-pool GUC-leakage risks — RLS-as-sole-isolation is more a marketing pattern than a production one. Shopify, Linear, and Stripe all run app-layer filters with RLS as the backstop.

**Canonical record**: **[ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md)** — consult for the full alternatives considered, threat model, rollout plan, validation criteria, and per-layer implementation specifics. This narrative is the orientation; the ADR is the record. If this section drifts from the ADR, the ADR is right.

### 2.3 Application-Layer Encryption, not `pgcrypto`

Field-level encryption happens at the application layer, not inside Postgres. AWS KMS wraps a per-tenant Data Encryption Key; the API service encrypts on write and decrypts on read in-process; Postgres only ever sees ciphertext. Deterministic encryption for equality-queryable fields, blind indexes for search-without-reversibility.

`pgcrypto` was rejected because it requires symmetric keys in Postgres memory space — leakage via query logs, `pg_stat_statements`, memory dumps, and replication streams is a known anti-pattern for queryable or PII data.

**Canonical record**: **[ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md)** — consult for the full alternatives (including TDE-only and client-side encryption), threat model, rollout phases, KMS latency-budget validation, and per-field deterministic-vs-randomized rules. This section is the orientation; the ADR is the record.

### 2.4 Event sourcing for workflows + hash-chained audit log

State changes on meaningful entities (engagement, finding, recommendation, report, approval) emit events to an append-only `audit_event` table. Each event row carries a hash over its content plus the previous row's hash, forming a tamper-evident chain — modifying a historical row breaks the chain and is detectable.

The audit log is tenant-scoped, retained per the strictness resolver's output (5 years for GAGAS engagements, 7 for PCAOB, 3 for Single Audit alone), and is the reconstruction mechanism for "who did what when." This is not a convenience feature for compliance theatre; it's a requirement of every audit standard (GAGAS §4.26, IIA GIAS Standard 15.2, ISO 19011 §6.5, PCAOB AS 1215) and the forensic trail when a dispute arises.

The alternative — rely on Prisma's `updatedAt` and row history tables — is the common GRC-tool approach and is structurally insufficient for audit compliance. An audit standard requires tamper-evidence, not just change history.

**Trade-off**: every meaningful mutation writes two rows (the state change + the audit event) inside a transaction, plus the hash computation. The overhead is small but real; the tamper-evidence guarantee is worth it.

**Where it lives**: `database/functions/audit-log-triggers.sql` (the triggers), `database/schema.prisma` (the `audit` schema), [04 §8.6](04-architecture-tour.md#86-audit-trail).

### 2.5 Bitemporal findings, with honest scaling limits

Every update to a finding appends a new row with `validFrom/validTo` (business time) and `transactionFrom/transactionTo` (system time). "What did this finding look like on 2027-12-01?" is answerable after the fact. This is useful for audit reconstruction, for answering auditee disputes ("the version we signed off on showed X, not the current Y"), and for regulatory reviews that want point-in-time states.

Bitemporal-on-JSONB is notoriously hard to query fast — Prisma does not natively generate bounding-box WHERE clauses, and ad-hoc `$queryRaw` scans over bitemporal JSONB get slow past a few million rows. We maintain a hand-written materialised view `finding_as_of` keyed by `(id, as_of_timestamp)` for the hot read paths and reach for raw SQL when the window must be explicit. Dedicated performance attention is needed once any single engagement passes ~50k findings.

The honesty is deliberate. Competitor platforms that advertise bitemporal findings rarely flag the scaling cliff; our acknowledgement in [04 §3.2](04-architecture-tour.md#32-at-the-database-layer) is a statement of engineering culture — *describe the trade-off or someone gets burned later*.

**Trade-off**: more storage per finding; more complex queries; a scaling cliff that requires engineering attention. The payoff is that audit reconstruction is a first-class feature, not a best-effort log-mining exercise.

**Where it lives**: `database/schema.prisma` (the bitemporal columns), `database/PERFORMANCE.md` (the `finding_as_of` materialised view + query patterns), [04 §3.2](04-architecture-tour.md#32-at-the-database-layer).

---

## Part 3 — Service and UI tier

> How a request enters the system, is validated, persists, and returns — and how the UI renders the highly-variable output of a pack-driven data model.

### 3.1 Next.js 15 App Router + React 19 Server Components as the default

The frontend is Next.js 15 with React 19. Server Components are the default; Client Components are pushed as deep into the tree as possible via the `"use client"` directive. Interactive regions (forms, rich-text editors, charts) are Client Components; static or tRPC-fetched content is Server Components.

The alternative — Pages Router with client-first rendering — was the previous industry default. App Router + Server Components reduces the JavaScript bundle shipped to the browser, improves Core Web Vitals significantly, and keeps data-fetching close to the UI (no "pass data through props" gymnastics). It also aligns with the direction of the React ecosystem: future major features are shipping on the App Router surface first.

**Trade-off**: Server Components are a different mental model from classical React. Engineers onboarding from 10 years of client-first React need time to internalise "this component renders on the server; it cannot use hooks; it can be async." We accept the onboarding cost for the long-term alignment with React's direction.

**Where it lives**: `frontend/ARCHITECTURE.md`, `frontend/apps/web/app/` (the routes), [04 §3.4](04-architecture-tour.md#34-at-the-frontend-layer).

### 3.2 tRPC for the request path, not GraphQL or REST-primary

The frontend talks to the backend over tRPC v11. Procedures are typed end-to-end; Zod schemas are the single source of truth for input validation; the UI's form validation and the server's input validation are the same code.

We considered GraphQL (Apollo, Relay). It solves real problems — flexible field selection, client-driven data-shape — that AIMS doesn't have. Our data shapes are domain-driven and stable, not client-composable. The GraphQL overhead (resolver plumbing, N+1 mitigation, persisted queries for security) would be cost without matching benefit.

We also considered REST-primary with tRPC as a secondary path. REST (OpenAPI 3.1) is available at `/v1/*` for external integrators, but it's generated from the same Zod schemas the tRPC layer uses — tRPC is the source of truth, REST is the compatibility surface.

**Trade-off**: tRPC is TypeScript-tied; non-TypeScript clients use the REST layer, which is slightly less ergonomic than if REST were first-class. For a platform where the primary frontend is the Next.js app and integrators are a secondary channel, this inverts correctly.

**Where it lives**: `api/requests/trpc/` (the routers), `packages/validation/` (the shared Zod schemas), `api/rest/openapi.yaml` (the generated OpenAPI spec), [04 §3.3](04-architecture-tour.md#33-at-the-api-layer).

### 3.3 Fastify + NestJS split, not either alone

The API layer is split by role. Request path is Fastify + tRPC v11 + REST (lean, no DI on the hot path). Worker tier is NestJS for document generation, outbox dispatch, scheduled jobs, SCIM sync (DI + module lifecycle + `@Cron` decorators earn their place in the worker tier). Shared code lives in framework-agnostic `packages/`.

NestJS everywhere fights tRPC's natural integration; Fastify + raw-TypeScript workers reinvents NestJS's DI container without matching payoff. The split uses each framework where its primitives match the workload.

**Canonical record**: **[ADR-0003](../references/adr/0003-nestjs-scoped-to-workers.md)** — consult for the five alternatives considered, the shared-code contract across tiers, observability-propagation requirements across the tier boundary, and validation criteria. This section is orientation; the ADR is record.

### 3.4 Transactional Outbox — the only durable happens-before edge we trust

Any state change that needs to produce a side effect outside the database — webhook delivery, search-index update, analytics event, downstream queue message — writes to an `outbox_event` table within the *same transaction* as the state change, and is dispatched by a NestJS worker.

The alternative — fire side effects directly from tRPC handlers or Prisma middleware — is the classic dual-write trap. Three failure modes exist: DB commits and HTTP succeeds (good); DB commits and HTTP fails (consumer diverges); DB rolls back but HTTP already succeeded (event fired for a state change that didn't happen). The last two are not rare on a long enough time horizon.

The outbox collapses all three to one: either the state change and the outbox row commit together, or neither does. Consumers see at-least-once delivery with idempotency keys; we never emit an event without its underlying change, nor retain a change without its event. Per-aggregate ordering is preserved via a partition key on `aggregate_id`; delivery state (pending, delivered, failed, DLQ) is queryable on the outbox table itself rather than inferred from logs.

**Trade-off**: every side-effect-producing mutation writes an extra row; the worker tier has a permanent responsibility; consumers must be idempotent (documented as a contract). Worth it — dual-write bugs are impossible to reason about after the fact.

**Where it lives**: [04 §8.7](04-architecture-tour.md#87-event-outbox--the-only-durable-happens-before-edge-we-trust), `database/schema.prisma` (the `outbox_event` table), `api/workers/outbox/` (the dispatcher).

### 3.5 Dynamic Form Engine reads pack JSON Schema, no codegen

The finding-authoring form (and any other pack-driven form) reads the attached pack's JSON Schema at runtime and renders the required fields via a dynamic form engine. There is no tRPC-level code generation for pack-specific fields; the pack is the source of truth, consulted at runtime by both the frontend form and the server's Zod validator.

The tempting alternative — generate TypeScript types per pack and have tRPC strongly type pack-specific fields — sounded attractive but fails immediately: if an engagement attaches Methodologies A and B at runtime, the tRPC router cannot know at compile time what shape the finding's `standardExtensions` blob has. Static type inference breaks when the schema depends on runtime database state. The honest answer is structural types for the container (`coreElements`, `standardExtensions`, `classifications`) and runtime pack-schema validation for the content. External review in April 2026 explicitly flagged this point and corrected our earlier overclaim of end-to-end inference.

**Trade-off**: pack-specific fields are not compile-time typed on the frontend. Engineers working in the form code see `Record<string, unknown>` for the per-pack content and must rely on the pack JSON Schema + Zod validator at runtime. This is the right trade-off for a methodology-pluralist platform; claiming static inference across pack boundaries would be false.

**Where it lives**: `frontend/implementation/example-dynamic-form.tsx` (reference implementation), [04 §3.4](04-architecture-tour.md#34-at-the-frontend-layer) (narrative), `packages/validation/pack-schemas/` (the per-pack JSON Schemas).

### 3.6 Shadcn/ui + Tailwind v4 + three-tier design tokens, not a monolithic design-system framework

The UI is built on Shadcn/ui components (not a framework, not an npm package — components *copied into* the repo, owned by us, styled with Tailwind v4). Design tokens run in three tiers: *reference* tokens (primitive colours, spacings, font stacks) → *semantic* tokens (text-primary, surface-brand, border-subtle) → *component* tokens (button-padding-x, input-border-radius).

The alternative — Material UI, Ant Design, Chakra, or similar monolithic design-system package — was rejected because it couples product-shape to framework-shape. When Material UI changes its component API, we change with them or stay behind. Shadcn/ui + Tailwind gives us full ownership of the component surface at the cost of writing more of it ourselves.

Tenant theming via CSS variables only — `--color-primary` and `--radius-md` are tenant-configurable; full re-skinning of audit domain colours (finding severity, status) is not. This scopes theming to what tenants actually want (brand colours) and avoids a design-system surface that can be broken by tenant choice.

**Trade-off**: we own more component code than a framework-based team. In exchange, the design system evolves at our pace, not the framework vendor's; styling decisions are transparent (it's Tailwind classes in our repo, not magic from node_modules).

**Where it lives**: `frontend/DESIGN-SYSTEM.md`, `frontend/implementation/design-tokens.ts` + `tailwind.config.ts`, `frontend/apps/web/components/`.

### 3.7 Server Components fetch data via tRPC server-side caller

Server Components that need tRPC data import the tRPC *server caller* directly — no HTTP hop, no client-side JavaScript, direct function call. Client Components use the `@trpc/react-query` adapter for mutations and reactive queries.

This is a meaningful optimisation: a server-rendered page that displays Oakfield's finding list does *not* serialise the data to the browser as JSON and re-hydrate it in a client component; it renders the HTML directly on the server with the data inlined. The data-fetching layer is the same tRPC procedure in both cases — we're just using different transports.

**Trade-off**: Server Components can only use tRPC *queries*, not subscriptions. Interactive data (live updates, optimistic UI) must live in a Client Component using the React Query adapter. This is a natural split.

**Where it lives**: `frontend/STATE-AND-DATA.md`, `frontend/apps/web/app/engagements/[id]/page.tsx` (example usage of the server caller).

### 3.8 AWS SQS for all worker-tier queuing, not Redis/BullMQ

The worker tier's queue infrastructure is AWS SQS — standard queues for at-least-once delivery, FIFO queues where per-aggregate ordering matters (outbox dispatch, SCIM sync). Document generation jobs, webhook deliveries, outbox events, scheduled SCIM pulls — everything non-trivial flows through SQS. NestJS workers consume via a thin SQS adapter.

The first-instinct choice (implied by `@nestjs/bull` in early notes) was BullMQ on Redis. It works for dev ergonomics and small-payload jobs. It does not work well for our real workloads: document generation produces multi-MB payloads that we'd rather keep out of Redis memory; heavy jobs under load stress Redis cluster failover in ways that are hard to reason about; BullMQ's at-least-once semantics are real but less battle-tested under partition than SQS's.

SQS wins on durability (disk-backed, effectively-infinite queue depth), on AWS-native integration (IRSA for auth, KMS for at-rest, CloudWatch metrics, dead-letter queue primitives), and on operational maturity. We pay with less rich local dev tooling than BullMQ provides (LocalStack's SQS is adequate but not BullBoard-level), and with a thinner per-job observability story that we compensate for with OpenTelemetry spans on every `ReceiveMessage` call.

Scheduled jobs (`@Cron`-style in NestJS terms) are handled via EventBridge Scheduler dispatching to SQS, rather than NestJS's `@nestjs/schedule` running in-worker. This separates "what runs when" (EventBridge, observable and configurable) from "what does the work" (SQS + NestJS consumer, independently scalable).

**Trade-off**: we lose BullMQ's developer ergonomics — BullBoard for job inspection, easy retry semantics, rich per-job metadata. We gain durability, scale, and AWS-native integration. Mitigated by building a lightweight internal "SQS inspector" UI for job debugging; not attempting to replicate BullBoard's feature set.

**Canonical record**: **[ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md)** — the full alternatives considered (BullMQ, Kafka/MSK, split-by-workload, SQS), the scheduling-via-EventBridge-Scheduler pattern, per-queue naming conventions, DLQ handling, and local-dev strategy. This section is orientation; the ADR is record.

### 3.9 API versioning — URL-based majors + dated header minors, tRPC unversioned

The public REST API is URL-versioned at the major level (`/v1/`, `/v2/`) with dated header-based minor versioning within a major (`Api-Version: 2026-04-20` header, following Stripe's pattern). The internal tRPC surface between the Next.js frontend and Fastify request path is not versioned — we own both sides; Zod snapshot tests catch breaking changes at build time.

The decision we rejected: deferring API versioning. Retrofitting versioning onto a published B2B API is painful — existing integrators' requests need grandfathering; versioning infrastructure touches every controller; the documentation surface doubles during the transition. Deciding now is strictly cheaper.

The major-vs-minor split matters. URL-based majors (`/v1/` → `/v2/`) signal hard breaks — fundamentally-different request/response shapes, semantically different endpoints, contracts we cannot migrate transparently. They happen rarely (ideally once every 2-3 years). Header-dated minors let us evolve response shapes additively — new fields, new optional parameters, new resource subsets — without forcing integrators to change URLs. An integrator who pins `Api-Version: 2026-04-20` gets the response shape as it existed on that date; changes after that date apply only if they opt in.

tRPC stays unversioned because the snapshot-test contract covers the breaking-change detection, and versioning a tRPC surface would duplicate the Zod schema machinery we already maintain.

**Trade-off**: implementing dated-header versioning requires a response-shape compatibility layer that can render any past version's shape from the current data model. This is not trivial; we budget real engineering time for it in the first public-API release. The alternative — URL-only versioning forcing `/v2/` for every additive change — produces more integrator friction over time.

**Canonical record**: **[ADR-0007](../references/adr/0007-api-versioning-hybrid.md)** — the full alternatives (URL-only, header-only, pure date-based), the compatibility-layer pattern, deprecation policy, and how we decide what counts as a major vs. minor break.

---

## Part 4 — Operations and ops-culture

> How AIMS v2 runs in production: infrastructure, deployment discipline, observability, disaster recovery, secrets.

### 4.1 AWS primary, EKS on Bottlerocket, OpenTofu for IaC

AWS is the primary cloud. Infrastructure is defined in OpenTofu (Terraform-compatible, OSS-licensed, BSL-free). EKS for Kubernetes with Bottlerocket nodes (minimal OS, read-only root filesystem, no shell, attack surface measured in kilobytes not megabytes). ArgoCD for GitOps; Argo Rollouts for SLO-gated canary deployments.

The alternative short-list was Google Cloud (GKE + Anthos), Azure (AKS + Arc), and self-managed Kubernetes. AWS wins on: breadth of services (KMS, Secrets Manager, RDS Postgres 16, Route 53, CloudFront, ACM, WAF, GuardDuty — all integrated with IAM), government market readiness (GovCloud for future FedRAMP), and operational maturity. GovCloud in particular is a differentiator — moving infrastructure to GCP or Azure and then adding a GovCloud strategy later is substantially more work than starting on AWS.

OpenTofu over Terraform is a deliberate license-risk hedge. Terraform's 2023 license change (BSL) introduces future uncertainty; OpenTofu is the community fork that remains Apache 2.0. Module compatibility is effectively 100% today; we can switch back to Terraform if OpenTofu stagnates, but starting on Apache-licensed tooling is the defensive choice.

**Trade-off — AWS**: AWS vendor lock-in is real. Many of the services we depend on (KMS, Secrets Manager, IAM, GuardDuty) are proprietary. The *application* layer stays portable (OpenTelemetry for observability, Postgres for data, standard container interfaces); the *infrastructure* layer is opinionated on AWS and we accept that.

**Trade-off — OpenTofu**: the OpenTofu-over-Terraform choice hedges against HashiCorp, not AWS. By moving to OpenTofu we forfeit the Terraform Cloud ecosystem (hosted state, Sentinel policy-as-code, the first-party private module registry, the broader HashiCorp-curated community integrations). If HashiCorp eventually restricts provider registries to Terraform-licensed consumers, the DevOps team will carry the compatibility burden — writing patched providers, running our own registry mirror. Today the provider compatibility is effectively 100% and the risk is latent; we monitor it as a falsifying condition rather than a present cost.

**Where it lives**: `devops/INFRASTRUCTURE.md`, `devops/implementation/terraform/`, [04 §5.1](04-architecture-tour.md#51-infrastructure).

### 4.2 GitHub Actions with OIDC — no long-lived cloud credentials

CI/CD runs on GitHub Actions. Authentication to AWS is via OIDC federation — a short-lived token issued by GitHub's OIDC provider, exchanged for an AWS IAM role's temporary credentials, valid for the duration of the CI job. There are no long-lived AWS access keys anywhere in the repo, no secrets in GitHub Actions secrets that would enable an ongoing AWS session if exfiltrated.

The alternative — long-lived access keys in GitHub secrets — is still the majority pattern in the industry. It's easier to set up and trivially more dangerous: a repo compromise or a rogue maintainer with secret access can establish persistent AWS access. OIDC federation makes credential theft an impossible class of incident; the worst case is a compromised CI job doing damage during its own run, bounded by the IAM role's policy.

**Trade-off**: OIDC setup is fiddly the first time (trust policy on the IAM role, audience claims, CI job configuration). Worth it — the security posture improvement is substantial and the setup cost is one-time.

**Where it lives**: `devops/CI-CD.md`, `devops/implementation/github-actions/ci.yml` + `cd-production.yml`, `devops/implementation/terraform/eks-module.tf` (OIDC trust policies).

### 4.3 Argo Rollouts with SLO-gated canary promotion

Deployments are canary'd. A new version starts at 5% of traffic; if latency and error rate SLOs stay within budget for 5 minutes, it promotes to 25%, then 50%, then 100%. Any SLO breach triggers automatic rollback. The SLO signal comes from OpenTelemetry-sourced metrics (request latency p99, error rate by endpoint), evaluated by Argo Rollouts' analysis template.

The alternative — blue/green deployments or all-at-once rollouts — puts either a full second environment in flight (expensive) or the whole user base at risk (dangerous). Canary with SLO gates catches the class of breakage that unit + integration tests can't: performance regressions, memory leaks, subtle behavioural changes that only manifest under production load.

**Trade-off**: canary deployment takes longer (20-30 minutes for a full rollout including observation windows). In exchange, a broken deploy that affects 5% of Oakfield users for 5 minutes is the worst case, not "everything's down for half an hour until we re-deploy the last known good."

**Where it lives**: `devops/CI-CD.md`, `devops/implementation/kubernetes/api-rollout.yaml` (Argo Rollouts manifest with SLO analysis), [04 §5.2](04-architecture-tour.md#52-deployment).

### 4.4 OpenTelemetry-native observability, vendor-neutral

Every service emits logs (structured JSON via Pino), metrics (Prometheus-compatible counters and histograms), and traces (OpenTelemetry). The SDK is OTel; the collector is the OTel Collector; the backend is whatever we want it to be at the moment. Today: Grafana Loki for logs, Prometheus for metrics, Tempo for traces, Sentry for errors with source-map integration.

The alternative — Datadog, New Relic, Honeycomb (proprietary SDKs and protocols) — is operationally simpler but ties us to a specific vendor's pricing, feature roadmap, and contract. OpenTelemetry lets us swap backends without rewriting instrumentation. If Datadog offers us a compelling deal tomorrow, we change the collector destination, not the application code. If Grafana Tempo exceeds expectations, we stay on it. The abstraction is load-bearing.

Every request from Priya carries a `traceparent` header. Every tRPC procedure, every database query, every external API call, every outbox worker pickup becomes a span. When something's slow, the trace tells us which span took the time.

**Trade-off**: OpenTelemetry's SDK and collector have more moving parts than a vendor SDK. The configuration surface is real. In exchange, we own our observability data and can swap backends when we need to.

**Where it lives**: `devops/OBSERVABILITY.md`, `devops/implementation/observability/otel-collector.yaml`, [04 §5.3](04-architecture-tour.md#53-observability).

### 4.5 Four environments, build-once-promote-many

Code flows through four environments: **local** (developer's machine, Docker-composed Postgres + Redis + LocalStack) → **preview** (per-PR ephemeral environment, spun up by CI) → **dev** (shared integration environment, continuously deployed from `main`) → **staging** (production-mirror, promoted from dev after a CI pass) → **production** (promoted from staging after SLO analysis).

The build artefact (container image) is built once on the CI server during the initial merge to `main` and promoted through environments by configuration change, not rebuilt per environment. The image that runs in production is the exact bytes that ran in staging, which ran in dev, which ran in preview.

The alternative — rebuild per environment with environment-specific configuration baked in — is the common path for teams not yet operating with CI/CD discipline. It creates a subtle class of bug where "it worked in staging but not production" is explained by "the build was slightly different." Build-once-promote-many eliminates that class of bug.

**Trade-off**: we fight Next.js's build-time optimisations. Next's aggressive SSG caching, per-route bundle analysis, and image-optimisation pipeline all assume build-time knowledge of environment. Deferring configuration to runtime means those optimisations either don't apply or require rebuilding the runtime caches per environment. We pay with slightly larger bundles and slightly less-aggressive edge caching. The cost of the alternative — environment-specific builds that diverge subtly — is worse, so we accept the runtime-config discipline and live with Next's build-time surface we can't fully exploit.

**Where it lives**: `devops/ENVIRONMENTS.md`, `devops/RELEASE.md`.

### 4.6 RPO 15 minutes, RTO 1 hour — the honest number

Our target Recovery Point Objective is 15 minutes (maximum tolerable data loss). Our target Recovery Time Objective is 1 hour (maximum tolerable downtime during a regional disaster). These numbers drive real engineering: cross-region RDS read replicas with automatic failover, S3 cross-region replication with versioning, warm-standby application infrastructure in a secondary region, quarterly DR drills with chaos engineering.

The alternative — "best effort" with no specific RPO/RTO — is where most early-stage products live. It works until the first serious regional outage, at which point the customer reaction is unfavourable. Specifying the targets up front lets us size the DR investment correctly.

More aggressive (RPO 1 minute, RTO 5 minutes) would require active-active multi-region, synchronous cross-region replication, conflict resolution logic. Not justified for the current product — audit data is not latency-critical at the minute scale, and the cost delta is substantial.

**Trade-off**: DR is not free. The secondary region costs ~30% of the primary region's infrastructure bill in steady state. Quarterly DR drills consume engineering time. In exchange, we have a credible answer to "what happens if us-east-2 goes down?"

**Where it lives**: `devops/DISASTER-RECOVERY.md`, `devops/RUNBOOKS.md`.

### 4.7 AWS Secrets Manager + external-secrets + IRSA — no env-var secrets

Secrets (DB credentials, KMS key IDs, third-party API keys) live in AWS Secrets Manager. Kubernetes reads them via the external-secrets operator, which syncs Secrets Manager values into Kubernetes Secret objects. Pods access those Secrets via IAM Roles for Service Accounts (IRSA) — each pod assumes an IAM role tied to its Kubernetes service account, with permissions scoped to exactly what that pod needs.

The alternative — secrets in environment variables injected from CI/CD — is the older pattern. It leaks secrets via process listings, shell history, crash dumps, and container inspection. IRSA + external-secrets keeps secrets in a managed vault with rotation, audit, and scoped access.

**Trade-off**: setup complexity is higher than `env VAULT_TOKEN=...`. Worth it — secret sprawl is one of the most common serious security issues in startups past Series A, and starting with a vault-backed pattern costs less than migrating to one later.

**Where it lives**: `devops/SECRETS.md`, `devops/implementation/terraform/` (IAM + OIDC setup).

### 4.8 Regional deployment silos for data residency

Regional data residency is enforced via **separate deployment silos per region**, not a single global cluster with VPC-level segmentation. At launch: us-east-2 only. When we sign the first EU tenant: eu-central-1 stands up as an independent deployment — its own EKS cluster, its own RDS instance, its own S3 buckets, its own auth service, its own observability stack. When (if) the federal pipeline justifies: govcloud-us-west.

The tempting alternative was a global control plane (central auth, tenant metadata) with regional data planes. It's operationally simpler and it makes SSO / user management trivial. It also produces a compliance story a regulator can poke holes in: "your auth service in us-east-2 is reading claims about our EU tenant — is that a data transfer?" The honest answer is "yes, at the authentication envelope layer" — and then the conversation gets harder. Separate silos make the answer "no; the EU tenant never touches anything outside eu-central-1." That clarity is the compliance story.

Tenant routing happens at DNS level: `oakfield.aims.io` is an A-record in us-east-2; `tuberlin.aims.io` is an A-record in eu-central-1. The marketing site and sign-up flow sit in a thin global layer (CloudFront + S3) that provisions the tenant into its home region at onboarding. Once provisioned, the tenant's data never leaves its region.

**Trade-off**: each region carries the full infrastructure stack in steady state — roughly 3× the cost when all three regions are live (us-east-2 + eu-central-1 + govcloud-us-west). At launch we pay 1×; we scale up as tenant demand warrants each region. Operational complexity scales with N-regions: deployments happen N times, observability needs cross-region correlation for global metrics, incidents may need coordination across teams per region. We accept these as the cost of a clean compliance narrative.

We rejected the shared-global-cluster pattern with VPC isolation because the compliance story under GDPR + potential future FedRAMP requires **physical, demonstrable** isolation — not "logical isolation with strong controls." Logical isolation is fine for SOC 2; regulators with teeth (GDPR supervisory authorities, FedRAMP JAB) want physical.

**Canonical record**: **[ADR-0006](../references/adr/0006-regional-deployment-silos.md)** — the full alternatives (single-cluster VPC isolation, global control plane + regional data planes, hybrid patterns), the tenant-onboarding provisioning flow, the cross-region deployment coordination story, and the specific compliance-framework requirements each regional silo satisfies.

---

## Part 5 — Engineering and quality culture

> The social architecture: how we write, test, review, commit, document, and manage technical debt.

### 5.1 TypeScript strict, everywhere, with no `any` without justification

Every TypeScript file in the repo compiles under `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. `any` is banned by lint; `unknown` with narrowing is the escape hatch when a type is genuinely dynamic. `as` casts require a nearby comment justifying the safety.

The alternative — gradual TypeScript adoption, loose types at the boundaries — is how many codebases end up with "TypeScript-flavoured JavaScript" rather than typed software. Strict-everywhere is a discipline; once established, it stays; the cost of backsliding is the same as the cost of not starting strict.

**Trade-off**: engineers from less-strict TypeScript shops have an adjustment period. Code reviews occasionally block on legitimately hard-to-type cases (inference over JSONB, dynamic dispatch). We accept both; strict TypeScript pays for itself the first time a refactor touches 40 files and the compiler tells us we broke 3 of them.

**Where it lives**: `engineering/CODE-STANDARDS.md`, `engineering/implementation/tsconfig.base.json`, `engineering/implementation/eslint.config.js`.

### 5.2 Feature-first folder layout, not type-first

Code is organised by *feature* (`src/features/engagement/`, `src/features/finding/`) not by *type* (`src/models/`, `src/services/`, `src/controllers/`). Each feature folder contains its own models, services, routers, tests, UI components — the cohesive unit is the domain concept, not the technical layer.

The alternative — type-first — puts `EngagementModel.ts` in `models/`, `EngagementService.ts` in `services/`, `EngagementController.ts` in `controllers/`, and so on. Changes to the engagement feature touch files in five folders; understanding the engagement feature requires reading five folders. Feature-first inverts the locality: one folder, one feature.

**Trade-off**: shared utility code (cross-feature helpers) can feel awkward to place — it goes in `packages/` (truly shared), `src/shared/` (cross-feature), or a specific feature if the "shared" code is really feature-specific. We accept a small amount of "where does this go?" friction in exchange for the dramatic locality improvement.

**Where it lives**: `engineering/CODE-STANDARDS.md` §3, feature folders throughout `api/requests/src/features/` and `frontend/apps/web/src/features/`.

### 5.3 Vitest + Testcontainers, integration tests against real Postgres

Unit tests (pure logic — pack validators, semantic-element mappers, strictness resolver computations) run under Vitest on every PR. Integration tests (service-against-real-Postgres-and-real-Redis) run against Testcontainers-provisioned Docker containers, in CI and locally.

The alternative — mock the database in integration tests — is the common path for teams optimising for test speed. It also misses entire classes of bugs: Prisma Client Extension regressions, RLS policy errors, JSONB query correctness, bitemporal bound conditions, transactional-outbox ordering. Testcontainers integration is slower (~2-3× unit test time) and catches bugs that mocks never could.

**Trade-off**: integration tests need Docker running locally; CI needs the container runtime; test setup is heavier. The 12-minute CI budget (§5.5) forces discipline on integration-test selection — we do not test every unit through the integration path; we pick the paths that matter.

**Where it lives**: `engineering/BACKEND-TESTING.md`, `engineering/TESTING-STRATEGY.md`, per-feature test folders.

### 5.4 Contract testing via Zod schema snapshots, not Pact or protobuf

Both sides of the API contract (frontend and backend) import the same Zod schemas from `packages/validation/`. The contract "test" is the TypeScript compiler: if the backend changes a schema in a backward-incompatible way, the frontend fails to compile. We additionally snapshot the Zod schema's JSON-Schema export and diff across commits — any breaking change produces a visible snapshot diff in the PR.

The alternative — Pact (consumer-driven contract tests with a broker) or protobuf (code generation from .proto files) — is the standard pattern for polyglot microservice architectures. Not needed here: we own both sides of the API, TypeScript does most of the heavy lifting, and the snapshot diff catches the remaining cases. Pact's ceremony would be cost without payoff.

**Trade-off**: works because both sides are TypeScript. If we ever add a non-TypeScript client (a Python data pipeline, a Go integration service), we either generate types from the OpenAPI spec or add a Pact-like layer for that client.

**Where it lives**: `engineering/CONTRACT-TESTING.md`, `packages/validation/__snapshots__/`.

### 5.5 12-minute CI budget, hard ceiling

Every PR's CI must complete in 12 minutes or less. If a test suite pushes CI past 12 minutes, we fix the test or parallelise the pipeline — we do not accept the slowdown. Performance tests (k6) run nightly, not per-PR, for exactly this reason.

The alternative — let CI grow organically — is how teams end up with 45-minute PR pipelines. Slow CI is not just an engineer-time tax; it changes behaviour (engineers batch changes, review with less attention, skip tests locally "because CI will catch it"). A hard ceiling forces us to treat CI performance as a feature.

**Trade-off**: sometimes a test we'd like to run per-PR moves to nightly. Sometimes the fix is parallelising an expensive test across CI runners (extra cost, worth it). Sometimes we discover that a test is slow because it's doing the wrong thing (the fix improves both CI and runtime behaviour).

**Where it lives**: `engineering/QUALITY-GATES.md`, CI pipeline YAML.

### 5.6 20% of engineering capacity for tech debt, reserved not scavenged

One-fifth of sprint capacity is allocated to tech debt — not as "when we have time," but as a reserved line item. Debt items are tracked in a dedicated list with severity, business impact, and accumulated interest. Debt items graduate to features when the cost of not fixing them exceeds the cost of fixing them.

The alternative — "we'll get to it when we can" — is how teams accumulate debt until it paralyses delivery. 20% reserved is a discipline that says *this matters enough to pay for*. It's not a perfect number; the right number depends on the codebase's current debt state. 20% is what we picked to start; we adjust based on the debt backlog trend.

**Trade-off**: product pressure on 20% reserved time is real. The trade-off is explicit — do we ship one more feature per quarter, or do we keep the codebase from rotting? We pick rot-prevention.

**Where it lives**: `engineering/TECH-DEBT.md`.

### 5.7 Diátaxis framework for documentation

Documentation is organised by the Diátaxis four-way split: **tutorials** (learning-oriented, for newcomers), **how-to guides** (task-oriented, for engineers getting specific things done), **reference** (information-oriented, the canonical spec), **explanation** (understanding-oriented, the why). Every doc declares which of the four it is; content that would span two of them gets split.

The alternative — ad-hoc documentation structure — is how README files end up as 40-section monsters that are bad at every purpose simultaneously. The Diátaxis discipline forces us to ask "what is this document *for*?" before we write it.

This `docs/` folder is mostly explanation (`01`, `03`, `06`) and tutorials (`02`, `04`, `07`). `engineering/CODE-STANDARDS.md` is reference. `devops/RUNBOOKS.md` is how-to. The separation is deliberate.

**Trade-off**: requires discipline; engineers writing docs must resist the "just add it wherever" impulse.

**Where it lives**: `engineering/DOCUMENTATION.md`, throughout the repo's doc organisation.

### 5.8 Conventional Commits + commitlint

Every commit message follows Conventional Commits: `type(scope): summary`. Types are a fixed list (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`). Scopes match our feature-first folder layout. Commitlint enforces on every commit.

The alternative — unstructured commit messages — makes the git log useful only to the person writing the commit. Conventional Commits makes `git log --oneline -- auth/` tell the story of how authentication evolved. It also enables automated changelog generation and release-note drafting.

**Trade-off**: commit message ceremony. Engineers new to the convention sometimes fight it for a week. Worth it — the git log quality improvement compounds.

**Where it lives**: `engineering/implementation/commitlint.config.js`, `engineering/CODE-STANDARDS.md`.

### 5.9 Definition of Done with nine criteria

A feature is not done when the code works. It is done when: (1) code merged + deployed, (2) tests written (unit + integration + E2E where applicable), (3) docs updated, (4) observability added, (5) security reviewed, (6) accessibility checked, (7) i18n applied, (8) code reviewed and approved, (9) rollback plan documented.

The alternative — "done = code merged" — is how products accumulate features that are observable only in production incidents, documented only in tribal knowledge, and impossible to roll back safely. The nine-criteria list is opinionated and probably longer than most teams carry. We've picked the list over the alternative (features that leak operational burden forever).

**Trade-off**: features take longer to land by this definition. In exchange, they land in a shape that does not require ongoing rescue.

**Where it lives**: `engineering/QUALITY-GATES.md` — Definition of Done section.

---

## Part 6 — Security and compliance posture

> How we handle data, how we build toward compliance attestation, how we engage with customers on trust.

### 6.1 GDPR-grade for every customer, not regional splits

Every customer's data is handled at GDPR standards regardless of geography. US customers get the same data-subject rights, the same retention enforcement, the same DPA template, the same sub-processor transparency. We do not maintain parallel "GDPR region" and "US-only region" data-handling regimes.

The alternative — region-specific compliance regimes — is operationally cheaper on paper (less-stringent handling for US customers) and strategically more expensive. N regional regimes means N × implementation cost, N × audit cost, N × incident-response cost. One unified GDPR-grade posture means one standard to implement correctly and the incidental benefit that every customer gets the strongest protection.

**Trade-off**: some US customers don't want or need GDPR-grade; we provide it anyway. Cost is marginal at our scale; simplicity is substantial.

**Where it lives**: `security/PRIVACY.md`, `security/POLICIES.md`.

### 6.2 Five-tier data classification, technically enforced

Data is classified into five tiers: **public** (marketing content, public docs) → **internal** (engineering docs, product discussions) → **confidential** (tenant-specific configuration, non-PII operational data) → **restricted** (PII, audit findings, financial data) → **regulated** (HIPAA PHI, specific regulatory categories).

Classification is technical, not policy-paper. Every field in the data model carries a classification label; the label drives logging redaction rules (never log restricted or regulated fields), encryption requirements (restricted+ is ALE-encrypted), retention rules (regulated has specific regulatory retention), and access rules (regulated requires role + audit justification).

The alternative — classification as policy, not code — is common and ineffective. Policy-only classification catches violations in audits, not in incidents. Technical classification catches them at write time.

**Trade-off**: requires upfront work to label every data model field. The label is a schema-level attribute that lints for presence on every new field. A field without a classification is a CI failure.

**Where it lives**: `security/DATA-CLASSIFICATION.md`, `data-model/tenant-data-model.ts` (the labels on each interface field).

### 6.3 Phased compliance roadmap — SOC 2 → ISO 27001 → HIPAA (if demand) → FedRAMP (if demand)

Compliance attestation is a staged journey, not a launch-day checkbox. Phase 1 (launch): GDPR-grade privacy operationally, no formal attestation yet. Phase 2 (6 months): SOC 2 Type I (point-in-time snapshot). Phase 3 (12 months): SOC 2 Type II (6-12 month operating window). Phase 4 (18-24 months): ISO 27001 (broader international traction). Phase 5 (as demanded): HIPAA BAA for healthcare customers. Phase 6 (if government pipeline justifies): FedRAMP Moderate.

The alternative — try to launch with SOC 2 Type II attestation in hand — would delay launch by a year and still not exercise controls under real customer load. Real Type II attestation requires 6-12 months of operating history to audit against; you can't get there faster than time allows.

Sequencing matters. SOC 2 first (US market primary), ISO 27001 second (international + defensible in EU), HIPAA and FedRAMP only if pipeline justifies their non-trivial cost. We do not pursue compliance frameworks speculatively; each phase gate requires confirmed demand.

**Trade-off**: pre-Type-II customers who require formal attestation we don't yet have will not be winnable. We accept that segment loss during Phase 1-2; the cost of premature attestation would be higher.

**Where it lives**: `security/COMPLIANCE-FRAMEWORKS.md`, `security/README.md`.

### 6.4 Drata (or Vanta) for continuous evidence collection

Compliance audits are expensive when they're scramble-the-team, point-in-time evidence-gathering exercises. Drata (or Vanta, both acceptable) wires into AWS, GitHub, Okta, and our other SaaS surfaces and collects evidence continuously. When the annual SOC 2 audit arrives, the auditor walks through pre-collected evidence rather than asking us to produce it reactively.

The alternative — DIY evidence collection — means engineering scrambles every quarter to gather screenshots, config exports, access review outputs. It scales poorly; it's error-prone; it's a permanent operational tax. Drata/Vanta is a line-item SaaS expense that pays for itself in the first real audit.

**Trade-off**: continuous-evidence tools produce sustained alert noise. They flag configurations as "misconfigured" against opinionated rule sets that often disagree with our actual security posture — an IAM policy that's intentionally scoped to a specific worker role gets flagged as "overly permissive" because the rule engine expected a read-only role; a Lambda with a 7-day log retention gets flagged against the tool's preferred 30-day standard even when our compliance framework accepts 7. The result is dozens of false-positive tickets per week requiring DevOps triage. Mitigated by building a suppression layer (documented exceptions with expiry dates) and by treating the tool's output as a *starting point for judgment*, not a ground truth. SaaS lock-in and annual cost are additional but minor next to the alert-fatigue tax.

**Where it lives**: `security/EVIDENCE-COLLECTION.md`.

### 6.5 Trust center on day one — no "coming soon" page

A public `trust.aims.io` page ships at launch. It lists current compliance status (honest — "SOC 2 Type I in progress, Type II targeted Q3" is more credible than "SOC 2 Type II certified" when we're actually pre-audit), the subprocessor list (auto-synced from the internal register), a security questionnaire library with pre-written answers (SIG Lite, CAIQ) saving customer reviewers time, the DPA template, and the sub-processor-change notification policy.

The alternative — reactive security reviews where every customer asks for the same information via email — is a linear operational cost that scales with customer count. A trust center is a fixed cost that scales at zero; customers self-serve 80% of their security questions.

**Trade-off**: maintaining the trust center is ongoing work (subprocessor updates, status changes, SOC 2 report swaps). Cheaper than answering the same questionnaire 200 times.

**Where it lives**: `security/TRUST-CENTER.md`, `trust.aims.io` (the public-facing page).

### 6.6 Subprocessor list public, change-notification contractual

The full list of subprocessors (AWS, KMS, Sentry, Datadog/Grafana Labs, Drata, Stripe, etc.) is public on the trust center. Changes to that list — adding a subprocessor, removing one, changing their scope — trigger a 30-day customer notification per the DPA. Customers who object have explicit opt-out rights within the notification window.

The alternative — opaque subprocessor handling — is the industry's majority pattern and increasingly inadequate under GDPR enforcement. Public transparency is both a compliance feature and a trust feature.

**Trade-off**: we publicly commit to subprocessors; changing them is procedurally heavier than if it were opaque. Worth it — customers who care about this care deeply, and transparency wins their trust in a way nothing else does.

**Where it lives**: `security/TRUST-CENTER.md`, `security/implementation/templates/dpa-template.md`.

### 6.7 Session revocation — short-TTL JWT + targeted Redis blocklist

Access tokens are EdDSA JWTs with 15-minute TTL; refresh tokens are opaque, family-tracked, rotated per use. Standard revocation — a user logs out, their credentials are rotated, their refresh-token family is invalidated and their next access-token refresh fails.

Stateless JWT revocation is the harder case. When an admin fires a user, or a security incident requires immediate session kills, waiting 15 minutes for the JWT TTL is within most SOC 2 / ISO 27001 interpretations of "timely" — but not "instant." The auth service supports instant revocation via a **targeted Redis blocklist**: JWTs minted for users in specific sensitive contexts (admin roles; freshly-issued tokens during active security events; tokens issued within 15 minutes of a revocation request) carry a `blocklist_checkable: true` claim, and the auth middleware does a Redis GET (~1-2ms, cached) against the blocklist for those tokens on every request. JWTs without the claim are verified by signature alone with no Redis hit.

The rejected alternatives: every-request blocklist check (adds Redis latency to every request, regardless of role); full opaque-session store (every request hits Redis; higher baseline latency for no security win on the common path); short-TTL-only with no blocklist (accepts 15-minute revocation lag for every user, including admins — defensible for SOC 2 but awkward to explain to a customer asking about their fired employee).

The targeted model threads the needle: normal users pay no latency cost; sensitive roles and incident-response paths get instant revocation; the blocklist is short-lived (entries expire when the JWT's natural TTL runs out), keeping Redis cardinality bounded.

**Trade-off**: the `blocklist_checkable` claim machinery is real complexity in the auth layer — we need to decide which roles get it, when a user's status change triggers it retroactively, how to propagate "we're in an active incident" to the token-minting path. Simpler than a full-session approach; more complex than short-TTL-only.

**Canonical record**: **[ADR-0005](../references/adr/0005-session-revocation-hybrid.md)** — the full alternatives considered (short-TTL-only, every-request blocklist, full opaque-session, hybrid variations), the specific roles and scenarios that trigger `blocklist_checkable`, the Redis caching layer, and SOC 2 / ISO 27001 / HIPAA revocation-timeline requirements this design satisfies.

---

## Part 7 — Negative architecture (what we deliberately don't do)

> Decisions about what AIMS v2 does not and will not contain. As load-bearing as the positive decisions — negative architecture prevents feature creep that would dilute the product.

### 7.1 We do not replace auditor judgment with "AI auditor"

An auditor tests controls, evaluates evidence, reaches conclusions. We host the structure, the evidence, the findings, and the reports. We do not — and will not — automate the judgment layer. Some GRC platforms market "AI auditor" capabilities; we've watched that market space and concluded that software promising to evaluate controls automatically is creating compliance risk, not reducing it.

Professional standards (GAGAS §6.33, IIA GIAS Standard 15.2, ISO 19011 §5.4, PCAOB AS 1220) require sufficient appropriate evidence gathered and evaluated by a qualified auditor. An AI that classifies controls as "effective" or "ineffective" without the full context a qualified auditor brings is either generating plausible-looking noise or implicitly claiming competence the auditor is professionally required to exercise.

Our AI assistance is elsewhere — drafting finding narratives from auditor-provided evidence, extracting facts from uploaded work papers, surfacing rule conflicts across attached standards, generating draft compliance statements. Never evaluating controls. Never reaching audit conclusions. The line is bright and intentional.

**Where it lives**: [04 §9.1](04-architecture-tour.md#91-we-do-not-run-the-audit-procedures-for-the-auditor), product roadmap commitments.

### 7.2 We do not store auditee's underlying financial or operational data

Oakfield's university-wide financial records live in Oakfield's Workday instance. We host Priya's audit work — findings, work papers she uploaded, her samples and analysis. We do not replicate Workday's general ledger. We do not ingest transactional data.

This is a deliberate scope boundary. Being a system of record for the audit produces is valuable and defensible; being a system of record for the auditee's financial data is a different regulatory category (financial systems regulation, banking rules, SOX §302 certification scope). We stay on our side of the line.

**Where it lives**: [04 §9.2](04-architecture-tour.md#92-we-do-not-store-auditees-underlying-data), data-model scope definitions.

### 7.3 We do not manage the auditee's corrective actions beyond recording them

A Corrective Action Plan is recorded in AIMS. The auditee's implementation happens elsewhere — their PM tools, their IT ticketing, their compliance platform. We track the plan, verify completion via evidence upload, and close the finding when verified. We do not *run* the corrective action.

This is the auditor/auditee separation of concerns. We are the auditor's tool; the auditee's project management system belongs to the auditee. Blurring this line makes us a multi-sided platform with complex data-sharing governance, which is not our product.

**Where it lives**: [04 §9.3](04-architecture-tour.md#93-we-do-not-manage-the-auditees-corrective-actions-beyond-recording-them), corrective-action model scope.

### 7.4 We do not implement specific regulators' transmission protocols

Filing a Single Audit with the Federal Audit Clearinghouse (FAC) is a transmission step that happens outside AIMS. Same for SEC filings, state agency submissions, ISO certification body transmissions. We produce the correct artefacts; the filing is an out-of-system activity.

This could be automated. It isn't in MVP. The current decision is to produce perfect artefacts and let the customer handle transmission — because transmission is where regulatory liability sharpens, and we'd rather not be in the middle. Revisited if customer demand justifies the liability exposure.

**Where it lives**: [04 §9.4](04-architecture-tour.md#94-we-do-not-implement-specific-regulators-transmission-protocols).

### 7.5 We do not extend OSCAL beyond control frameworks

OSCAL (NIST's Open Security Controls Assessment Language) is a production format for control catalogs, profiles, SSPs, assessment plans, assessment results, and POA&Ms. We adopt OSCAL for `control_framework` packs and interoperate where it makes sense. We do not extend OSCAL to methodology — it doesn't fit; methodology's workflow, finding-shape, and rule semantics are outside OSCAL's scope. We do not rebuild control-catalog tooling from scratch — OSCAL does it well.

**Where it lives**: [04 §9.5](04-architecture-tour.md#95-we-do-not-replicate-oscals-scope), OSCAL interop spec.

### 7.6 We do not build a visual workflow / BPMN designer

Audit workflows exist: finding goes Draft → Review → Approved → Issued → Followed-Up. The tempting adjacent product is a drag-and-drop state-machine designer tenants can customise. We don't build it.

State transitions are declared per methodology pack (in the pack's `workflows` array). Tenants attach packs rather than draw boxes-and-arrows. Reasons: bespoke workflow-engine design is an implementation tar pit (Jira, Salesforce, ServiceNow all carry workflow-designer products as ongoing burdens); most customisation customers ask for is satisfied by pack variation; audit standards are the source of truth for workflow, not tenant preference. If a tenant wants a custom workflow, the answer is "author a custom methodology pack," not "drag boxes."

**Where it lives**: [04 §9.6](04-architecture-tour.md#96-we-do-not-build-a-visual-workflow--bpmn-designer).

### 7.7 We do not build a bespoke BI / dashboard-authoring tool

Customers will ask for drag-and-drop pivot tables on findings data. We don't build that. BI tooling is its own decades-old product category — Power BI, Tableau, Looker, Metabase, Mode — and competing with them would burn engineering years for a second-rate result.

We ship five or six opinionated canned dashboards in-app (engagement progress, finding aging, recommendation tracker, CAP compliance, CPE compliance, annual plan vs. actual) — the dashboards every audit function needs. Anything custom goes out via the star-schema warehouse export to Power BI / Tableau / Looker (detailed in [03 §6.7](03-the-multi-standard-insight.md#67-data-export-bi-and-the-2d-flattening-problem)).

**Where it lives**: [04 §9.7](04-architecture-tour.md#97-we-do-not-build-a-bespoke-bi--dashboard-authoring-tool).

### 7.8 We do not build full-text search in-house

Audit platforms live and die by searching work papers. When we need it, we buy — AWS OpenSearch Service (managed, AWS-integrated, good SLAs), Algolia (best-in-class relevance tuning, generous free tier up to our likely launch scale), or Typesense Cloud (faster, open-source-backed, appealing if we want portability). What we do *not* build is a custom Postgres `tsvector` + OCR pipeline + index-maintenance worker in-house.

The reasons map to the BI-tool argument. Full-text search is its own engineering discipline — ranking, relevance, multilingual stemming, synonym handling, typo tolerance, faceted filtering, index update latency management. Building competently takes years; building incompetently produces a search experience customers hate. AWS OpenSearch Service in particular integrates cleanly with our observability stack, IRSA for auth, KMS for index-at-rest encryption, and S3 for snapshot backup — making it the likely first choice when the feature ships.

Interim: users can filter work papers by metadata (date, engagement, author, tags) but cannot full-text-search content. That's a real product limitation we live with until the search-tool decision fires. Adding the managed-search dependency is a single roadmap item, not a multi-quarter engineering build.

**Where it lives**: this section; future placement in `references/adr/` once the specific vendor is picked.

### 7.9 We do not build a bespoke file-conversion engine

Customers will upload `.xlsx` work papers and ask to view them inline in the browser. They'll upload `.docx` and expect PDF rendering. They'll upload image-heavy work papers and want thumbnail previews. Tempting adjacent product: build a headless-LibreOffice microservice, or spin up a Puppeteer-based rendering pipeline, or maintain a collection of format converters (libxlsx, mammoth.js, pdfkit, pandoc).

We don't. File conversion is an infinite R&D sink: every format version, every edge case, every embedded object type is a bug report. Teams that go down this path end up maintaining an ever-growing conversion farm and still producing renderings customers find unsatisfying.

Our line: we render natively what browsers render natively (PDF via the browser's built-in viewer; images inline). For everything else, customers download the original file and open it in the app it belongs to. If real demand emerges for inline viewing of `.xlsx` or `.docx`, we integrate a managed service (CloudConvert, Aspose Cloud, Microsoft Graph's document conversion API) — we do not stand up our own headless-LibreOffice workers.

**Where it lives**: this section; future ADR if/when the managed-service integration lands.

---

## How this doc relates to `references/adr/`

**06 is orientation; ADRs are record.** If the two disagree, the ADR is right.

This doc surveys the architectural landscape — how decisions cluster, why they sit where they do, what themes connect them. The ADRs are the canonical per-decision specification: alternatives considered, threat model, rollout, validation, immutable once accepted. The two are designed to avoid dual-write drift:

- For the decisions that *have* formal ADRs (§2.2 tenant isolation, §2.3 ALE, §3.3 Fastify/NestJS split, §3.8 SQS queuing, §3.9 API versioning, §4.8 data residency, §6.7 session revocation), this doc gives a 2-3 paragraph orientation and explicitly points to the ADR for everything else. We do not duplicate the alternatives list, the threat model, the rollout plan — those live in the ADR and only in the ADR.
- For the decisions that *don't yet* have formal ADRs (most of Parts 1, 4, 5, 6, 7), this doc is the provisional record. Promotion to a formal ADR happens when the decision needs structured treatment — usually because it's about to be relitigated, or because a specific threat model needs documenting.

| This doc (06) | `references/adr/` |
|---|---|
| Narrative orientation | Structured per-decision record |
| Curated — picks the load-bearing | Per-decision, one file each |
| Mutable (editable as thinking evolves) | Immutable once accepted |
| Survey-level context | Decision-level specification |
| For a reader learning the system | For an engineer implementing or revisiting |

**When decisions evolve**: the old ADR is marked `Superseded by ADR-NNNN` and stays as written; a new ADR is created; this doc's orientation paragraph is updated in place. The record is cumulative in the ADR folder and current in 06. If you find this doc claiming something the ADR contradicts, file a PR correcting 06 — the ADR wins by design.

---

## What's not in this doc

Things that would plausibly belong in a full design-decisions doc but are *not* here, with reasons:

- **Database migrations strategy** — handled operationally in `database/` folder docs; not a load-bearing architectural decision at this stage
- **API versioning strategy** — not yet exercised (single version); will become a decision when we cut `v2` of the public API
- **Frontend state management (Zustand + TanStack Query)** — covered in `frontend/STATE-AND-DATA.md`; a meaningful choice but not one that shapes the broader architecture
- **Specific observability backend choice (Grafana Cloud vs. self-hosted)** — decided operationally; OpenTelemetry abstraction means this is reversible
- **Specific email provider, specific support-ticketing tool** — line-item SaaS choices; reversible; not architectural
- **Pricing tiers and plan boundaries** — a product decision, not an architectural one
- **Specific code-formatter choice (Prettier config)** — a convention decision, in `engineering/CODE-STANDARDS.md`

If you think something in this list should actually be a top-level decision here, open a discussion and propose promotion.

---

## Appendix — Domain review notes

This doc went through external domain-expert review (Google Gemini, April 2026) in the same program that reviewed 02, 03, 04, and the three pre-existing ADRs. Round 1 on 06 surfaced four missing decisions, three under-stated trade-offs, two negative-architecture gaps, and a structural concern about dual-write drift with the ADR folder. All were incorporated; the record here lets a future reader understand why specific sections read the way they do.

### Round 1 — missing decisions (four architectural re-decisions)

- **Queuing technology — §3.8 added.** The initial draft casually referenced `@nestjs/bull` without treating queue infrastructure as a load-bearing decision. Fix: AWS SQS is now the canonical choice for the worker tier (durable, AWS-native, scales); BullMQ is rejected for heavy payloads; EventBridge Scheduler handles cron-style scheduling. Formal record in [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md).
- **Session revocation — §6.7 added.** The initial draft said EdDSA JWTs with 15-min TTL but did not specify the revocation story. Fix: short-TTL JWT + targeted Redis blocklist triggered by a `blocklist_checkable` claim on sensitive roles. Regular-user traffic pays no blocklist latency; admin/incident paths get instant revocation. Formal record in [ADR-0005](../references/adr/0005-session-revocation-hybrid.md).
- **Data residency enforcement — §4.8 added.** The initial draft mentioned multi-region but did not specify the topology. Fix: separate deployment silos per region (us-east-2 at launch, eu-central-1 on first EU tenant, govcloud-us-west on federal pipeline). Clean compliance story at the cost of 3× infrastructure at full scale. Formal record in [ADR-0006](../references/adr/0006-regional-deployment-silos.md).
- **API versioning — §3.9 added.** The initial "what's not in this doc" section deferred API versioning to later. Fix: deferral was wrong for a B2B platform; decision made now. Hybrid: URL-based majors (`/v1/`), dated header minors (`Api-Version: 2026-04-20`) within a major, tRPC unversioned. Formal record in [ADR-0007](../references/adr/0007-api-versioning-hybrid.md).

### Round 1 — trade-offs strengthened

- **§4.5 build-once-promote-many** — rewrote trade-off from "config must be externalised" (which is 12-factor best practice, not a cost) to the real cost: fighting Next.js's build-time optimisations (SSG caching, edge-deploy snapshots).
- **§4.1 OpenTofu** — separated the AWS trade-off from the OpenTofu trade-off. OpenTofu hedges HashiCorp, not AWS; the real cost is losing Terraform Cloud's ecosystem (Sentinel, registry, hosted state) and carrying future compatibility burden if HashiCorp restricts provider access.
- **§6.4 Drata/Vanta** — rewrote trade-off from "SaaS lock-in" to the operational reality: continuous-evidence tools generate sustained false-positive alert noise requiring DevOps triage. Mitigation via suppression layer with documented exceptions.

### Round 1 — negative-architecture gaps

- **§7.8 added — no in-house full-text search.** When the need for FTS arises, we buy (AWS OpenSearch Service, Algolia, Typesense Cloud); we do not build a custom Postgres `tsvector` + OCR pipeline.
- **§7.9 added — no bespoke file-conversion engine.** No headless-LibreOffice worker tier; no Puppeteer rendering farm. Native browser rendering for what browsers render; managed services (CloudConvert, Aspose) for format conversion if demanded.

### Round 1 — structural drift concern

The reviewer correctly flagged that the original closing table ("how to read this alongside `references/adr/`") invited dual-write drift: every decision update would require editing both this doc and the ADR. Fix: §2.2, §2.3, §3.3, §3.8, §3.9, §4.8, §6.7 are now *executive summaries* (2-3 paragraphs each) pointing to their canonical ADR for alternatives, threat models, rollout plans, and validation. The closing section was rewritten to reinforce "06 is orientation; ADRs are record; if they disagree, the ADR wins." Future ADR updates will require a one-paragraph orientation update here, not a narrative rewrite.

This is a material structural shift. An earlier version of this doc would have tried to be comprehensive per-decision; the current shape accepts that comprehensive belongs in the ADR and this doc is the index with context.

### Round 2 — review loop closed

R1 revisions went back to the same reviewer for a second pass in April 2026. R2 returned no new action items and explicitly endorsed the four new architectural pillars (SQS + EventBridge Scheduler, targeted Redis blocklist for session revocation, regional deployment silos, hybrid API versioning), the honest-cost reframing of the three trade-off paragraphs (Next.js SSG tension, OpenTofu HashiCorp hedge, Drata/Vanta alert noise), the two negative-architecture fences (no in-house FTS, no bespoke file conversion), and the structural move to "06 is orientation, ADRs are record." The reviewer noted the doc is now at a shape suitable for diligence by Tier-1 VCs or enterprise security teams. Review loop on 06 closed at 2026-04-20.

---

*Last reviewed: 2026-04-20.*
