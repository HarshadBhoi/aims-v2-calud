# Introduction — Why AIMS v2 Exists

> The story. What audit work actually is, why the current tooling fails at it, what we saw that nobody else has acted on, and what we're building in response.

---

## 1. The work

Audit is the discipline of forming a reasoned, evidence-based opinion on whether something is true — whether a financial statement represents reality, whether controls are operating, whether a grantee spent federal money on what they said they would. A public company's annual report is signed because an auditor signed it. A federal grant continues because a Single Audit came back clean. A healthcare provider keeps a contract because their SOC 2 report passed.

The mechanics are ancient. Sample. Test. Document. Conclude. Report. Disagree respectfully with management when the evidence demands it. Issue a finding when it doesn't pan out.

What is *not* ancient is the volume and complexity. A modern audit shop might be staring at:

- A **state auditor's office** running three hundred engagements a year across K-12 districts, municipalities, water authorities, state colleges, and transit agencies — each of which must conform to GAGAS (the Yellow Book), most of which trigger Single Audit requirements under 2 CFR 200, and a meaningful fraction of which interact with federal agencies that each have their own reporting conventions.
- A **Fortune 500 internal audit function** whose charter requires conformance with IIA's Global Internal Audit Standards (GIAS 2024, effective January 9, 2025), whose engagements support management's SOX §404 assertion, whose IT scope tests against COBIT, and whose risk universe covers two hundred auditable entities across six continents.
- An **ISO certification body** performing surveillance audits on clients who hold ISO 9001, ISO 27001, ISO 14001, and ISO 45001 simultaneously — which IAF MD 11 permits auditing together in one engagement, with audit-time discounts, if the team has the combined competence.
- A **small external audit firm** whose practice is 90% single audits of community nonprofits — each of which must integrate GAAS (the AICPA audit standard), GAGAS, and Uniform Guidance, and each of which produces five or six separate report artifacts from the same engagement.

This is not twelve different kinds of work. The underlying audit reasoning is the same. The output — findings, recommendations, reports — is structurally similar. But the standards each engagement must conform to are different, sometimes stacked, occasionally in conflict, and always material to the final report. The auditor cannot ignore them and cannot conflate them.

This is what "audit" is as a working discipline. It is structured, evidence-based, standards-heavy, and produces artifacts whose form is strictly prescribed.

## 2. Who does this work

Enough generalities. Here are the segments, with numbers.

**US Single Audits** — performed on every non-federal entity that expends $1M or more in federal awards per fiscal year. The threshold rose from $750k effective for FY ending Sep 30, 2025 and after. The Federal Audit Clearinghouse receives approximately **40,000 Single Audits per year**. These are GAGAS engagements with a Uniform Guidance overlay — structurally multi-standard by statute.

**State and local government auditors** — every US state has a state auditor or comptroller. Big states (California, Texas, New York) employ hundreds of auditors; smaller states thirty to fifty. Plus county auditors, city inspectors general, university audit shops, special-district auditors. An older-than-you-think commercial platform called TeamMate+ (Wolters Kluwer) advertises **800+ government agency customers**; it is the de-facto incumbent in this segment.

**Federal inspectors general** — 75+ federal IG offices (every cabinet department, most independent agencies). Each conducts GAGAS audits of its own parent agency. Many also perform Single Audit work on federal grantees.

**Internal audit functions** — every public company of any size has an internal audit function, either insourced or co-sourced with a Big Four firm. IIA estimates around **200,000 practicing internal auditors globally**, roughly half of whom work for organizations over $1B in revenue. Most conform (or attempt to conform) with IIA GIAS 2024.

**External audit firms** — the Big Four (Deloitte, PwC, EY, KPMG) and the global mid-tier firms (RSM, BDO, Grant Thornton, Crowe, Baker Tilly, Forvis Mazars, and dozens more). Hundreds of thousands of auditors globally.

**ISO certification bodies** — every ISO management system standard (27001, 9001, 14001, 45001, etc.) is certified by accredited conformity-assessment bodies. These are third-party audit firms performing surveillance audits on certified organizations. ISO 19011 is the audit methodology they use.

**Supreme audit institutions** — each country has one; they audit the national government. INTOSAI is the global body; ISSAI is the standards framework. International government audit, with a particular role in donor-funded-program audits.

These are the people who buy audit software. They are not the general public. They have terminology, certifications (CPA, CIA, CFE, CISA, CGAP), and regulatory obligations. A product built for them must respect both.

## 3. Why the existing tools fall short

If you ask a modern auditor what software they use to run engagements, you will hear some combination of:

- *TeamMate+* (Wolters Kluwer) — dominant in internal audit and US government audit. Mature, comprehensive, expensive, methodology-aligned by tenant-configured templates, 6-to-12 month implementations. Owned by a company that just (January 2026) acquired StandardFusion to bolt on control-framework mapping.
- *AuditBoard* — rebranded to **Optro** on March 9, 2026. Fortune-500-focused commercial audit platform. Modules for SOX, operational audit, third-party risk, ESG, and more. Strong on control-framework crosswalks (the SOC 2 / ISO 27001 / NIST 800-53 mapping problem). Absent in government audit.
- *Workiva* — financial-reporting and ESG-disclosure platform. Strong for 10-K / CSRD / GRI multi-framework reporting. Not primarily an audit management platform.
- *ServiceNow IRM / GRC* — for organizations already committed to the ServiceNow platform. Best-in-class control-to-citation mapping via Authoritative Source → Citation → Control Objective → Control. Generic Issue entity; no engagement-level methodology concept.
- *Diligent HighBond* (formerly Galvanize/ACL) — data-analytics-heritage audit platform. Strong on control-framework library. Multi-standard at the control level, not the engagement level.
- *Excel + Word* — still the honest answer for a large fraction of state/local government auditors, Single Audit practices, and smaller nonprofits. The commercial tools don't fit their workflow, their budget, or their regulatory context.

We spent significant research time in early 2026 pulling actual vendor documentation for the top three of these platforms. The finding was consistent and significant: **no commercial audit platform supports engagement-level multi-standard methodology as a first-class capability.**

Let that sink in.

The dominant product in government audit (TeamMate+) encodes methodology as tenant-configured templates. Want to follow GAGAS? Build a GAGAS template. Want to follow IIA GIAS? Build a separate IIA template. Want to follow both on one engagement? Build a third template that tries to satisfy both, maintain all three, and hope they don't diverge. When IIA released GIAS 2024 to replace IPPF 2017, Wolters Kluwer's response was a content update guide — not a versioned methodology object that engagements could migrate between at their own pace. Customer reviews of TeamMate+ cite *template sprawl*, *admin-gated customization*, and *schema rigidity* as common pain points.

The rising challenger in commercial audit (Optro, née AuditBoard) treats "framework" as a compliance-mapping concern. Their headline feature, CrossComply, lets you map one control to multiple frameworks (SOC 2 + ISO 27001 + NIST CSF) — a genuinely useful capability for infosec-adjacent compliance work. But their engagement entity does not carry a "methodology standard" field. Their response to IIA GIAS 2024 was a static gap-assessment checklist, not an engagement-level methodology selector. Their customer roster is Fortune 500 commercial; they have no named government, OIG, or state-auditor references.

ServiceNow's GRC data model is a marvel of many-to-many control-to-authority mapping — one control satisfies citations from many authoritative sources, which is exactly the right shape for compliance attestation. But the audit engagement object (`sn_audit_engagement`) has no direct relationship to authoritative sources. Standards attach transitively through controls. The Issue entity is generic; there is no GAGAS §6.39 four-element finding structure, no IIA five-C pattern. Recommendations are not distinct from issues.

This is not a criticism of the existing products. Each is optimized for the segment it serves and the problem it was designed to solve. AuditBoard/Optro is genuinely excellent at SOX programs. TeamMate+ genuinely owns the government audit workflow market. ServiceNow genuinely scales.

But there is a specific kind of audit work none of them serves well: **engagements that must, by statute or by professional obligation, satisfy more than one standard at the same time.** A Single Audit (GAGAS + GAAS + Uniform Guidance — three layers, all required). An integrated audit (PCAOB AS 2201 — financial statement opinion + ICFR opinion, mandated integration). A government internal audit function that follows both GAGAS and IIA GIAS. An ISO integrated management system audit covering 9001 + 14001 + 27001 in one engagement.

Forty thousand Single Audits a year, forty years of integrated audit practice, a decade of ISO IMS audit growth — all served by template workarounds and Excel spreadsheets.

This is the gap.

## 4. AIMS v1 and what it taught us

AIMS originated as a SharePoint-based solution for a specific internal audit division. The first version — what we now call AIMS v1 — shipped as a SharePoint Framework (SPFx) single-page application. Twenty-seven SharePoint lists. Seven user roles. Ten modules covering dashboard, audit universe, engagements, fieldwork, findings, reports, QA, staff and time, and administration. Production features included five distinct approval workflows, twelve PDF report types, a sixty-item QA checklist, and a fourteen-section GAGAS-compliant Audit Planning Memorandum builder.

It was — and is — a real product. It is GAGAS 2024 compliant across the four elements of a finding (§6.39), the ten elements of a report (§6.02), the four independence tests (§3.26), the eighty-hours-per-two-years CPE requirement (§4.26), the peer review cycle (§5.01), and the four-element-plus-recommendation structure for the full finding-through-corrective-action lifecycle.

But v1 had two ceilings.

**The SharePoint ceiling.** Deployment meant a SharePoint Online tenant, a site collection, specific SharePoint groups, custom lists provisioned via PnP PowerShell, and — critically — customers willing to accept the operational footprint of SharePoint. This ruled out every customer whose IT shop wasn't already on SharePoint. It ruled out every customer who wanted a SaaS tool. It ruled out every federal customer with a FedRAMP requirement. It ruled out every customer outside Microsoft 365. The total addressable market was "organizations that want AIMS *and* already operate SharePoint at scale." A real intersection, but a limited one.

**The single-standard ceiling.** AIMS v1 was GAGAS-shaped throughout. Finding schemas were GAGAS §6.39. Reports followed GAGAS §6.02. The approval workflows were GAGAS peer-review-style. An internal audit shop that wanted IIA GIAS conformance couldn't have it without rewriting the schemas. An ISO certification body couldn't have it at all. Single Audit support existed but was nested inside the GAGAS pack as a "sector overlay" — available only to GAGAS engagements, not extractable as an independently attachable concept.

The v1 work was not wasted. The GAGAS conformance has proven surprisingly difficult to reproduce in competing products — several of them claim Yellow Book alignment but don't ship the four-element schema out of the box, don't enforce the ten-section report template, don't track CPE against the governmental-topic requirement. AIMS v1 did all of that in production. What v1 demonstrated — that a careful, standards-faithful product is genuinely buildable for government audit — is the foundation AIMS v2 is built on.

What v2 demonstrates is the move beyond single-standard, single-tenant, SharePoint-coupled design.

## 5. The AIMS v2 thesis

AIMS v2 is an independent, multi-tenant, multi-standard audit information management platform, built to be operated as SaaS or on-premises (GovCloud / customer-managed), with three explicit architectural commitments that none of the competing products make:

**Commitment 1 — Methodology is a first-class, versioned object.**
Not a template. Not a tenant-configuration bundle. Not an implementation-services deliverable. A real, structured, versioned artifact that encodes the workflow, finding shape, classification scheme, independence rules, CPE requirements, report structure, and compliance-claim mechanics of a professional audit standard. GAGAS:2024 is one of these. IIA_GIAS:2024 is another. ISO_19011:2018 is another. A future custom pack authored by a customer for their in-house methodology could be one too. Packs are versioned; packs can depend on each other (GAGAS incorporates AICPA AU-C by reference, and that's a declared dependency); packs can be updated without customers having to reimplement their workflows.

**Commitment 2 — Engagements can attach to multiple standards simultaneously.**
This is the one nobody else does. An engagement picks a *primary methodology* (the one whose workflow drives the default), optionally attaches *additional methodologies* (e.g., IIA GIAS alongside GAGAS), optionally attaches *control frameworks* (e.g., SOC 2 for vendor testing; ISO 27001 for ISMS audits), and optionally attaches *regulatory overlays* (e.g., Single Audit on top of GAGAS). The platform knows how to reconcile conflicts (retention, CPE, independence cooling-off, peer review cycles) via an explicit strictness resolver. It knows how to produce multiple reports from a single engagement (the Single Audit case alone produces five to seven separate attestation artifacts). It knows how to render a finding with GAGAS's four elements and Single Audit's questioned costs and IIA's inline recommendation — in the same underlying record, with pack-specific rendering per report.

**Commitment 3 — Audit methodology is distinct from compliance control frameworks, and we refuse to conflate them.**
SOC 2 is not an audit methodology. It is a control framework — a set of testable criteria. The audit methodology (typically AICPA AT-C for attestation engagements) is separate. ISO 27001 is similarly a control framework; ISO 19011 is the methodology used to audit *against* it. GAGAS is a methodology; COSO 2013 is the internal-control framework that SOX audits apply the methodology against. This distinction is invisible in ServiceNow's flat `Authority Document` type. It is invisible in Optro's framework-library model. Our three-tier pack taxonomy — `methodology` / `control_framework` / `regulatory_overlay` — makes it explicit, and keeps engagements expressible in terms that match how audit professionals actually think.

These three commitments cascade into specific design decisions about schema, API surface, UI, reporting, and compliance evidence — all documented in detail in the other folders. But the core insight is simple: **the real audit world is multi-standard, and modeling it that way produces a dramatically better product.**

## 6. What "multi-standard" actually means

A brief preview; the full treatment is in [03 — The multi-standard insight](03-the-multi-standard-insight.md).

Imagine a state university internal audit department. Their FY26 engagement covers federal research grants. Because the university expended $180M in federal awards, Single Audit applies by statute. GAGAS is the required methodology. The internal audit team is CIA-certified and chooses to also conform with IIA GIAS 2024. The university contracts with a cloud learning management vendor that provides a SOC 2 Type II report; the engagement needs to evaluate whether reliance on that SOC 2 is appropriate for the Single Audit controls testing.

That single engagement attaches:

- **Primary methodology**: `GAGAS:2024` (required by 2 CFR 200.514 for any Single Audit)
- **Additional methodology**: `IIA_GIAS:2024` (elective, per the audit function's professional standards)
- **Regulatory overlay**: `SINGLE_AUDIT:2024` (statutory — Uniform Guidance)
- **Control framework**: `SOC2:2017` (in scope for vendor testing)

The engagement produces, from one workflow:

- Financial statement opinion (GAAS via GAGAS)
- Yellow Book Report on Internal Control and Compliance (GAGAS §6.02)
- Schedule of Findings and Questioned Costs (2 CFR 200.515(d))
- Schedule of Expenditures of Federal Awards / SEFA (2 CFR 200.510(b))
- Summary Schedule of Prior Audit Findings (2 CFR 200.511(b))
- Corrective Action Plan — auditee-authored (2 CFR 200.511(c))
- Report to Audit Committee (IIA GIAS Standard 15.1 — because the function elected IIA conformance)

And when the audit team documents a finding — say, they discovered that 12% of sampled expenses across three research programs were categorized as unallowable activities, amounting to $127,000 in known questioned costs and a projected $340,000 in likely questioned costs — that finding carries:

- The four GAGAS elements (Criteria / Condition / Cause / Effect)
- The Single Audit overlay extensions (questioned costs dollar amounts, Assistance Listing Numbers for the affected federal programs, a repeat-finding indicator, the applicable Compliance Supplement requirement)
- Two legitimate classifications — a GAGAS "Significant Deficiency" on the internal-control tier and an IIA "Major" on the business-severity scale
- A link to a single recommendation (M:N — that same recommendation may address multiple findings, a pattern GAGAS §6.47 explicitly supports)
- References to the methodologies it's reported under, and to the three or four reports it appears in

This is what the structure needs to express. The concrete walkthrough of exactly how this happens lives in [02 — Worked example](02-worked-example-single-audit.md). The *why* of the architecture is in [03 — The multi-standard insight](03-the-multi-standard-insight.md).

## 7. Where AIMS v2 is today

As of April 2026, AIMS v2 is a **design-complete platform** with no running runtime. Ten reference folders containing roughly 220 files and 90,000 lines of documentation, schema, and reference implementations. Five worked example packs (GAGAS, IIA GIAS, ISO 19011, Single Audit overlay, SOC 2 control framework) demonstrate the three-tier taxonomy end-to-end. A working standard-pack schema (TypeScript v1.1.0), validated JSON Schema, and extensive validation rules. The reference implementation covers:

- **Authentication and identity** — Better Auth with custom extensions, JWT EdDSA signing, MFA (TOTP + WebAuthn), SSO (SAML 2.0 + OIDC + SCIM), RBAC + ABAC, STRIDE threat model.
- **Frontend architecture** — Next.js 15 with React 19 Server Components, tRPC for end-to-end type safety, design system with dynamic tenant theming, WCAG 2.1 AA accessibility, next-intl for internationalization (English at launch, GDPR-grade privacy regardless of locale), Core Web Vitals budgets.
- **Backend and data** — NestJS + Prisma + PostgreSQL 16 with Row-Level Security for multi-tenancy, hash-chained audit log for tamper evidence, bitemporal data where needed, monthly partitioning, field-level encryption (planned for Phase 2), cross-region backups and replication.
- **API surface** — tRPC v11 routers + OpenAPI 3.1 REST spec + Stripe-style HMAC webhooks. Zod schemas as the single source of truth, shared between API and UI.
- **DevOps baseline** — GitHub Actions with OIDC (no long-lived cloud credentials), Terraform on AWS (OpenTofu-compatible), EKS + Argo Rollouts + ArgoCD, OpenTelemetry observability, 15-minute RPO / 1-hour RTO disaster recovery, multi-region warm standby.
- **Engineering standards** — Vitest + Testcontainers + Playwright testing pyramid, ESLint flat config with 12-minute CI budget, Conventional Commits with commitlint, Diátaxis-framework docs, 20% capacity budgeted for tech debt, SLO-gated canary deploys.
- **Security and compliance** — phased roadmap from SOC 2 Type I through Type II to ISO 27001 to HIPAA to FedRAMP, Drata or Vanta for continuous evidence, three-tier vulnerability management SLAs (Critical 24h / High 7d / Medium 30d), formal incident response distinct from operational incidents, GDPR-grade privacy program.

None of that is production runtime. It is design. Authoritative design, carefully researched, cross-validated against primary sources and live competitor documentation — but design.

The next phase (Tier 2) is to build the first vertical slice — a single end-to-end workflow (GAGAS engagement creation → finding capture → approval → report generation) that exercises every layer. From there, feature expansion, pilot customers, and eventual general availability.

## 8. Who benefits, specifically

The thesis lands different for different readers. A few of the segments we think AIMS v2 unlocks, in plain terms:

**A state auditor's office running Single Audits.** Today: TeamMate+ templates per engagement type, Excel for tracking questioned costs and federal program identification, re-keying findings across the five-to-seven reports a Single Audit produces. With AIMS v2: one engagement attached to GAGAS + Single Audit overlay, finding shape handles the overlay extensions natively, reports auto-generate per-pack, cross-listing of findings per 2 CFR 200.515(d) is structural rather than manual.

**A Fortune 500 internal audit function wanting IIA GIAS 2024 conformance without tearing up GAGAS-aligned workflows.** Today: Optro works fine for their SOX program but doesn't support engagement-level GIAS claims. Their IIA conformance is tracked in a separate matrix. With AIMS v2: the engagement attaches GAGAS (for the government-like risk work) *and* IIA GIAS (for professional conformance), the strictness resolver handles the CPE union and the peer review cycle (GAGAS 3-year wins over IIA 5-year external), and the final report carries both compliance statements.

**An ISO certification body doing integrated management system audits.** Today: fragmented — ISO-specific tools with no multi-standard engagement model, or Excel. With AIMS v2: one engagement with ISO 19011 as primary methodology, ISO 9001 + 14001 + 27001 + 45001 as attached control frameworks, audit-time discount per IAF MD 11:2023 baked into scope.

**A smaller external firm specializing in nonprofit Single Audits.** Today: Excel, Word templates, hand-crafted report packages per client. TeamMate+ is too expensive; AuditBoard/Optro isn't in this market. With AIMS v2: SaaS pricing at the small-firm tier, Single Audit overlay pack shipped (no custom template build), automatic multi-report generation.

**A pack author** — a customer's regional audit association that wants to encode their local standard (e.g., a state-specific school district audit guide, or a national GAO counterpart in another country, or an industry-specific audit protocol). Today: nobody has an open, versioned, portable methodology pack format. With AIMS v2: a documented schema, reference example packs, and a validation layer that catches authoring errors before the pack reaches a tenant.

None of these users exists yet as a customer. We have not shipped to production. But each corresponds to a researched, validated gap in the current market, and each represents a real organization that today is doing this work with inadequate tools.

## 9. What comes next

If you're new to AIMS v2 and you've read this far, the next doc — [02 — Worked example](02-worked-example-single-audit.md) — is the one that makes the claims in this introduction concrete. It walks through a complete engagement for the state university scenario sketched in §6, in enough detail that you see exactly how every term in the system maps to something a real auditor does.

After that, [03 — The multi-standard insight](03-the-multi-standard-insight.md) is the deep architectural dive, and [04 — Architecture tour](04-architecture-tour.md) walks the ten reference folders.

If you're a domain expert — an experienced auditor, a standards-body participant, a former state auditor or IG professional — we want your critique. The worked example is where we're most exposed to getting the domain wrong. Read it carefully, and tell us where we've slipped.

---

*Last reviewed: 2026-04-20.*
