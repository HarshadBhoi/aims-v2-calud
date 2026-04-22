# Worked Example — A Single Audit at State University of Oakfield

> One engagement, start to finish. Every term in the AIMS v2 vocabulary appears in context. When you finish this doc you will understand the system not as a schema but as a tool an auditor uses.

---

## How to read this

Each section follows a three-part structure:

- **What happened** — the narrative beat. The story as it actually unfolds.
- **Why** — what the audit standards require; what AIMS v2 is doing underneath.
- **How you'd do it in the app** — the concrete user action, with schema snippets where that sharpens the picture.

Every few sections there's a **Check your understanding** box with 3–5 short questions. If you can answer them confidently you're tracking. If not, re-read before continuing. These questions are structured so they can become quiz items in a future certification path — see §14.

Code + data snippets show the actual shapes our schema produces. `TypeScript`-like syntax throughout. JSON where it reads more naturally.

---

## 1. Setup: meet the audit shop and the engagement

### What happened

State University of Oakfield is a fictional public research university in the Midwest. About 28,000 students, 3,400 faculty. It has a medical school, an engineering college, and a large research enterprise. The university's fiscal year follows the standard state-university calendar — July 1 through June 30. In **fiscal year 2026** (July 1, 2026 – June 30, 2027), the university expended **$180 million in federal research grants** across NIH, NSF, and DOE programs.

Federal grant activity at this scale triggers a Single Audit under 2 CFR 200.514. Because the university's fiscal year ends June 30, the FY26 Single Audit is due to the Federal Audit Clearinghouse by **March 31, 2028** — nine months after fiscal year-end.

(The fiscal year choice matters for standards alignment: GAGAS 2024 is effective for financial audits for periods beginning on or after December 15, 2025. FY26 beginning July 1, 2026 falls cleanly inside that window, so the engagement applies GAGAS 2024 by default rather than relying on early adoption.)

The university's **Internal Audit Department** has six staff. They report administratively to the Board of Trustees and functionally to the Audit and Compliance Committee. They are led by Marcus Chen, CIA, CPA — titled *Chief Audit Executive (CAE)* per IIA convention, though the university calls him *Director of Internal Audit* in its organizational chart. They conform with the IIA's **Global Internal Audit Standards (GIAS)**, effective January 9, 2025, and are audited externally against that standard on a five-year cycle.

The department also regularly performs the university's Single Audit in-house — a function that by statute must be conducted in accordance with **GAGAS** (Government Auditing Standards, 2024 revision; the "Yellow Book"). The CAE and three of the five staff auditors maintain governmental CPE (24 hours out of 80 every two years focused on government topics) specifically to retain GAGAS competency.

For this year's engagement, the **Auditor-in-Charge (AIC)** is Priya Nair — CPA + CIA + CGFM, six years experience, recently promoted. She's responsible for planning, staffing, executing, reporting, and ultimately signing off on the engagement. She reports to a *Senior Auditor* (Jordan Akintola) for day-to-day supervision and to Marcus for approval at phase gates.

The audit charter — required by IIA GIAS Principle 6 (Authorized) and the board-approved version dated May 2023 — gives the department unrestricted access to records, systems, property, and personnel, and an independent reporting line direct to the Audit and Compliance Committee.

### Why

Three things matter about this setup for what follows.

**First — the Single Audit requirement is statutory, not elective.** 31 U.S.C. §§ 7501-7507 (the Single Audit Act) and 2 CFR 200 Subpart F require this audit. The university does not get to opt out of GAGAS. The primary methodology is *not a choice*.

**Second — the IIA GIAS conformance is elective but consequential.** The audit function has chosen to conform with IIA GIAS 2024 because the CAE is a CIA, because the function's external assessments are scoped to GIAS, and because the Board's Audit Committee charter references IIA standards. That choice means the engagement's final report will carry an IIA conformance statement (Standard 15.1), which requires the function-level Quality Assurance and Improvement Program (QAIP) to support it. GIAS compliance is attached to the function, not to the individual engagement — but the engagement can only *claim* it if the function qualifies.

**Third — GAGAS and GIAS can run alongside each other.** GAGAS §2.14-2.15 explicitly permits audits conducted "in conjunction with" other professional standards. IIA GIAS Standard 15.1 permits conformance claims on engagements whose function meets GIAS requirements. The two do not conflict. Where they differ on specific mechanical rules (CPE hours, peer review cycles, independence cooling-off periods), AIMS v2 computes the union-or-stricter at engagement setup and enforces it.

### How you'd do it in the app

The tenant — State University of Oakfield — was created when the university onboarded. Marcus was added as the CAE user. Priya, Jordan, and the other team members were provisioned via the university's SSO (Okta). The Internal Audit Department is represented as an **audit function** record with:

```ts
// Tenant-level record — created at onboarding, rarely changed
interface AuditFunction {
  id: string;
  tenantId: string;
  name: "Internal Audit Department";
  reportingLine: "Board of Trustees — Audit and Compliance Committee";
  head: UserId;                          // Marcus Chen
  methodologiesInScope: StandardPackRef[];  // [GAGAS:2024, IIA_GIAS:2024]
  qaipStatus: {
    internalAssessmentLastCompleted: "2027-03-15";
    externalAssessmentLastCompleted: "2023-11-02";
    externalAssessmentNextDue: "2028-11-02";
    meetsGiasStandardFifteenOne: true;   // if true, engagements may claim GIAS conformance
  };
  peerReviewStatus: {
    lastReviewDate: "2025-06-30";        // GAGAS requires 3-year cycle — next due 2028-06-30
    nextDueDate: "2028-06-30";
    rating: "Pass";                      // Pass / Pass with Deficiencies / Fail
    reviewedBy: "Indiana State Board of Accounts";  // could be AGA, a peer firm, etc.
  };
}
```

Priya, as a licensed staff auditor, has CPE tracked:

```ts
interface UserCpeStatus {
  userId: UserId;                        // Priya
  totalHoursLast24Months: 88;
  governmentalHoursLast24Months: 28;     // GAGAS requires 24; she has 28, comfortably compliant
  lastCertificationDate: "2027-06-30";
  meetsGagasCpeRequirement: true;
  meetsIiaCpeRequirement: true;          // IIA CIA: 40 CPE/yr
}
```

The engagement itself is about to be created in §2.

---

## 2. Creating the engagement

### What happened

On July 15, 2027, Marcus meets with the university's CFO and the Audit Committee chair to scope the FY26 Single Audit. They agree fieldwork will begin in mid-September 2027 (after FYE close) and the report will be filed in late February 2028, comfortably ahead of the March 31, 2028 FAC deadline. Priya is confirmed as AIC.

The next morning Priya logs into AIMS and clicks **New engagement**.

### Why

Creating an engagement is deceptively consequential. Five things get locked in at this step, each of which affects the rest of the engagement's life:

1. **The engagement type** drives the default workflow, the default report templates, and the default team composition requirements. Picking the wrong type and later switching is possible but expensive.
2. **The primary methodology** drives *everything methodological* — finding schema, approval chain, report structure, independence mechanics. The primary is chosen from methodologies the audit function is authorized to apply.
3. **Additional methodologies** extend the primary — typically when the function elects to claim conformance with a second standard (as here, IIA GIAS alongside GAGAS).
4. **Regulatory overlays** are sometimes required by dependency rules (Single Audit overlay auto-suggests whenever GAGAS is the primary and the engagement scope touches federal awards above the threshold) and sometimes electable.
5. **Control frameworks** are the libraries of testable controls the engagement uses. In the SOC 2 case we come to later, these are attached so the audit procedures can reference specific CC6.1-style control codes.

### How you'd do it in the app

Priya selects the engagement type **"Single Audit"** from a short list of GAGAS engagement types. Because this type has a declared dependency on a regulatory overlay, the wizard auto-suggests attaching `SINGLE_AUDIT:2024`. Because the function is scoped for IIA GIAS 2024 and Priya's function roster shows `meetsGiasStandardFifteenOne: true`, the wizard offers the option to attach `IIA_GIAS:2024` as an additional methodology — with a toggle for *conformance claimed*. She toggles it on.

The engagement, after Priya clicks **Create**:

```ts
{
  id: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  tenantId: "tnt_oakfield_university",
  title: "FY26 Single Audit — State University of Oakfield",
  engagementMode: "statutory_stacked",  // auto-set when a regulatory overlay is attached

  // Primary methodology — drives workflow, default finding schema, default report structure
  primaryMethodology: {
    packCode: "GAGAS",
    packVersion: "2024",
    scope: "global",
    conformanceClaimed: true,     // always true for primary
  },

  // Additional methodologies — attach extra requirements + compliance statement
  additionalMethodologies: [
    {
      packCode: "IIA_GIAS",
      packVersion: "2024",
      scope: "global",
      conformanceClaimed: true,   // Priya elected yes; function qualifies per QAIP
    },
  ],

  // Regulatory overlays — layer-on requirements
  regulatoryOverlays: [
    {
      packCode: "SINGLE_AUDIT",
      packVersion: "2024",
      scope: "global",
      conformanceClaimed: true,   // implicit — the overlay is required by dependency
    },
  ],

  // Control frameworks — in scope for testing. Attached later (§12) when SOC 2 scope confirmed.
  controlFrameworks: [],

  engagementType: "SINGLE_AUDIT",

  plannedStartDate: "2027-09-15",
  plannedEndDate: "2028-02-28",

  leadAuditorId: "usr_priya_nair",
  teamMemberIds: ["usr_jordan_akintola", "usr_marcus_chen", /* + 2 others */],

  auditeeOrganizationId: "org_oakfield_university",
  status: "DRAFT",
  createdAt: "2027-07-16T09:14:22Z",
  updatedAt: "2027-07-16T09:14:22Z",
  createdBy: "usr_priya_nair",
  version: 1,
}
```

Notice `engagementMode: "statutory_stacked"`. AIMS v2 has five modes:

| Mode | Meaning | When it applies here |
|---|---|---|
| `single` | One methodology, no additional packs | Not this engagement — too many packs attached |
| `integrated` | PCAOB AS 2201 — FS + ICFR in one engagement with dual opinions | Not applicable (that's a public-company thing) |
| `statutory_stacked` | Standards stacked by statute — Single Audit is the classical case | ← this one |
| `combined` | ISO IMS audit per IAF MD 11 — multiple control frameworks in one audit | Not applicable |
| `in_conjunction` | GAGAS "in conjunction with" IIA (or similar) — elective additional methodology | GAGAS + IIA here is *in conjunction with*, but because Single Audit is *also* attached, `statutory_stacked` wins — it's the more specific descriptor |

### Check your understanding

1. If Oakfield's federal grant activity dropped to $900k next year, would Single Audit still apply? Why or why not?
2. What would change in the engagement record if the function had an overdue QAIP external assessment?
3. What `engagementMode` would fit a Fortune 500's annual SOX-integrated audit?
4. Priya is both CIA-certified and CPA-licensed. Does her CPA-only colleague qualify to work on this engagement?

> Answers: (1) No — the Single Audit threshold of $1M would not be met; the audit could still be performed under GAGAS if contractually required, but would be called an "audit under Government Auditing Standards" not a Single Audit. (2) `conformanceClaimed` for IIA GIAS would need to be set to `false` — applying the methodology is still fine, but the function cannot claim GIAS conformance in the report until the QAIP is up to date. (3) `integrated`. (4) Yes — GAGAS doesn't require CIA certification, but it does require the CPE rule (80 hours every two years, 24 in government topics); the CPA-only colleague must meet that rule to participate.

---

## 3. The strictness resolver kicks in

### What happened

When Priya hits Create, AIMS computes a **strictness resolver** output for the engagement. She sees a compact summary on the engagement's overview page:

> **Operating rules for this engagement**
>
> - **Documentation retention**: 5 years (driven by AICPA AU-C via GAGAS)
> - **CPE requirements (per auditor, rolling 24 months)**: 80 hours total, with at least 24 in governmental topics (GAGAS §4.16-4.26). CIA-holding staff must additionally maintain 40 hours/year per IIA policy.
> - **Independence cooling-off**: 24 months (GAGAS §3.88 — stricter than IIA's 12-month equivalent)
> - **Quality Assurance cycle**: 3 years peer review (GAGAS §5.73), *plus* 5-year IIA external assessment (GIAS Std 8.3 — QAIP)
> - **Working paper review level**: every work paper reviewed by at least a Senior (GAGAS §6.33; IIA §15.1 complementary)

### Why

Several of the attached packs have opinions on the same operating rule. They don't all agree. We must pick one, and the rule we pick must be the *stricter* of the options so that no active pack's requirement is violated.

- Retention: GAGAS incorporates AICPA AU-C, which requires 5 years. IIA is silent on retention. 2 CFR 200.517 (Single Audit) requires 3 years. The maximum wins: **5 years**. Note that if SOX were also attached — it isn't here — PCAOB's 7-year rule would dominate.
- CPE: GAGAS requires 80 hours per 2 years with 24 governmental. IIA CIA designation requires 40 hours/year. These don't conflict so much as coexist: both must be satisfied by anyone holding both designations. Priya, a CIA, maintains both. AIMS presents this as a *union* rather than picking one.
- Independence: GAGAS §3.88 is stricter than IIA Standard 1100 on cooling-off after serving in a senior non-audit role at an auditee. GAGAS wins.
- Quality cycle: GAGAS §5.73 mandates external peer review every 3 years. IIA GIAS Std 8.3 requires external assessment every 5 years. These are *different cycles for different purposes* — the 3-year GAGAS cycle for government-audit quality, the 5-year IIA cycle for GIAS conformance. Both apply. Both must be maintained.

### How you'd do it in the app

The resolver runs at engagement creation and re-runs whenever a pack is attached or detached:

```ts
interface EngagementStrictness {
  documentationRetentionYears: 5;                 // max across active packs
  independenceCoolingOffYears: 2;                  // max
  cpeHoursPer2Years: 80;                           // max (GAGAS wins)
  governmentalCpeHours: 24;                        // GAGAS-specific — only present if GAGAS attached
  peerReviewCycleYears: 3;                         // min (shorter = stricter) — GAGAS wins over IIA's 5

  drivenBy: {
    documentationRetentionYears: { packCode: "GAGAS", packVersion: "2024" },
    independenceCoolingOffYears: { packCode: "GAGAS", packVersion: "2024" },
    cpeHoursPer2Years: { packCode: "GAGAS", packVersion: "2024" },
    peerReviewCycleYears: { packCode: "GAGAS", packVersion: "2024" },
    governmentalCpeHours: { packCode: "GAGAS", packVersion: "2024" },
  },
}
```

The `drivenBy` block is important for the audit trail. Two years later, when someone asks *"why is our retention 5 years rather than 3?"* the answer is literally queryable.

If GAGAS is detached — hypothetically — the resolver re-runs. IIA's silence on retention falls back to a firm-level default (say, 7 years, conservative). The engagement's documented retention updates. A change-of-strictness event is logged.

---

## 4. Planning — independence, scope, and kickoff

### What happened

Priya drafts the **Audit Planning Memorandum** (APM) in early August. She follows GAGAS's fourteen-section structure (§7.05-7.10) because GAGAS is the primary methodology. The IIA-GIAS additional methodology doesn't prescribe a specific APM format, but GIAS Standard 9 requires a documented engagement plan — which the GAGAS APM satisfies by construction.

The APM includes:

- **Objectives and scope** — Single Audit objectives, programs in scope (all federal programs identified as "major" per 2 CFR 200.518), fiscal year, auditee contacts.
- **Risk assessment** — risk-of-material-misstatement on financial statements; risk of material noncompliance on each major program.
- **Materiality** — financial statement materiality ($X), Single Audit materiality per program (typically the smaller of $25,000 or 0.15% of program expenditures).
- **Independence statement** — per GAGAS §3.26, each team member signs a per-engagement declaration.
- **Team composition and competency** — Priya, Jordan, two staff auditors; CPE current for all four; governmental CPE hours verified.
- **Reliance on other auditors** — none this year.
- **Scheduling and budget** — milestones, hours budget by phase.
- **Expected deliverables** — list of every report (six or seven; see §9).

Marcus approves the APM on August 17, 2027. This is a **phase gate** — the engagement transitions from `PLANNING` to `FIELDWORK_AUTHORIZED`.

### Why

Two things matter.

**First — the fourteen sections aren't optional.** GAGAS §7.05-7.10 specifies what an Audit Planning Memorandum must include for a performance or financial audit. AIMS v2's GAGAS pack ships a `template` with fourteen required sections and validation that prevents phase gate exit if required sections are empty. The IIA GIAS pack doesn't add required sections beyond what GAGAS already covers; it adds a link to the engagement charter (a GIAS Principle 6 requirement).

**Second — independence declarations are per-engagement, not annual.** A lot of internal audit functions maintain annual independence attestations. GAGAS §3.26 requires a *per-engagement* declaration. The strictness resolver caught this: the Oakfield audit function's annual attestation is on file, but Priya, Jordan, and the two staff auditors each sign an additional per-engagement declaration documenting that they have considered and resolved any threats to independence specific to this Single Audit.

### How you'd do it in the app

The APM is a structured document — not a free-text Word file. Each section is a rich-text field inside AIMS:

```ts
interface AuditPlanningMemorandum {
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9";
  standardPackDriver: { packCode: "GAGAS", packVersion: "2024" };  // the pack whose APM template is used
  templateVersion: "14-section-v1";

  sections: [
    { code: "OBJECTIVES_AND_SCOPE",         content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "MATERIALITY",                  content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "RISK_ASSESSMENT_FS",           content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "RISK_ASSESSMENT_COMPLIANCE",   content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "INDEPENDENCE_CONFIRMATION",    content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "TEAM_COMPOSITION",             content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "RELIANCE_ON_OTHERS",           content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "SCHEDULE_AND_BUDGET",          content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "EXPECTED_DELIVERABLES",        content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "CONSULTATION_ARRANGEMENTS",    content: RichText, completeness: "OPTIONAL", status: "EMPTY"    },
    { code: "COMMUNICATIONS_WITH_AUDITEE",  content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "COMMUNICATIONS_WITH_OVERSIGHT",content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "QUALITY_CONTROL_PLAN",         content: RichText, completeness: "REQUIRED", status: "COMPLETE" },
    { code: "SUBSEQUENT_EVENTS_CONSIDERATIONS", content: RichText, completeness: "OPTIONAL", status: "EMPTY" },
  ];

  approvedBy: "usr_marcus_chen";
  approvedAt: "2027-08-17T15:32:08Z";
}
```

Phase gate exit is blocked by any `REQUIRED` section with `status !== "COMPLETE"`. If Priya tried to enter fieldwork with an empty Materiality section, the system would refuse with a structured error.

---

## 5. Fieldwork — the testing that matters

### What happened

Fieldwork runs from mid-September 2027 through mid-December 2027. Priya's team tests:

- Schedule of Expenditures of Federal Awards (SEFA) for completeness and accuracy
- Internal control over federal awards — design and operating effectiveness — for each major program
- Compliance with each applicable compliance requirement in the OMB Compliance Supplement Part 3
- Financial statement internal controls relevant to the auditor's risk assessment
- A sample of expense transactions across the three largest programs

Most testing produces no findings — the university's grants office is a mature operation. But on November 25, 2027, while testing transaction coding in the Allowable Costs/Cost Principles compliance requirement for the NSF Mathematical and Physical Sciences program (Assistance Listing Number 47.049), Jordan notices a pattern: of 40 transactions sampled from the program, 5 are charged to the "indirect cost" activity category despite being clearly direct-charge allowable activities.

Jordan expands the sample to 120 transactions across three research programs — 47.049 NSF Mathematical and Physical Sciences, 93.310 NIH Trans-NIH Research Support (Common Fund), and 81.049 DOE Office of Science Financial Assistance — and finds the same pattern: approximately 12% of transactions miscoded. He documents the extrapolated exposure: $127,000 in known questioned costs (within the sample population) and a projected $340,000 in likely questioned costs (if the sample rate holds population-wide).

Priya reviews Jordan's work papers and agrees this is a finding.

### Why

Two separate things are happening here and they matter both mechanically and legally.

**Mechanically** — this is a Single Audit finding. Per 2 CFR 200.516(a), Single Audit findings must be reported for *any* known questioned cost over $25,000 (§200.516(a)(3)) — so this finding's $127,000 crosses that threshold by a wide margin. The finding also qualifies as a "significant deficiency in internal control over compliance" under §200.516(a)(2) because the error rate (12%) represents a systemic control gap, not an isolated incident.

**Legally** — the university's Research Office and Grants Accounting Office need to be informed, the PI (Principal Investigator) on each affected grant needs to be informed, and the finding will appear in the Single Audit report as a finding against *each* federal agency's programs. The university may need to reclassify the misclassified costs in its next cost-report filing with the awarding agencies, which — if the agencies disagree with the reclassification — could result in cost disallowance.

The finding is, unambiguously, a finding. Now AIMS needs to help Priya write it down correctly.

### How you'd do it in the app

Priya clicks **New Finding** from the engagement's Fieldwork tab. The form she gets is driven by the engagement's attached packs. GAGAS provides the four-element core (Criteria, Condition, Cause, Effect) as required fields. The Single Audit overlay adds its own five extensions (questioned costs known + likely, federal program, repeat-finding indicator, compliance requirement). IIA GIAS doesn't add required fields but adds a severity-classification option using its Critical/Major/Minor/Advisory scheme. We'll see the full shape in the next section.

---

## 6. Authoring the finding — the terminology-dense core

This is the most important single section of the worked example. It's where the three-tier pack taxonomy, the semantic element dictionary, the strictness resolver output, and the overlay-extension mechanism all become concrete.

### What happened

Over December 3-5, 2027, Priya spends most of two days drafting the finding. She consults with Marcus (CAE) and with the Research Office's compliance officer. She writes carefully, because this finding will be read by the awarding agency's program officer, the university's Board of Trustees, the state auditor's office, and — posted on the Federal Audit Clearinghouse — the general public.

The final finding, as saved:

### How you'd do it in the app — the schema

```ts
{
  id: "fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1",
  tenantId: "tnt_oakfield_university",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",

  title: "Inconsistent cost classification in federal research expenses",

  // SEMANTIC CORE — values keyed by canonical semantic codes
  // These are the GAGAS §6.39 four elements, populated universally. Every
  // methodology pack maps ITS element codes onto these canonical codes.
  coreElements: {
    CRITERIA: `
      2 CFR 200.403 (Factors Affecting Allowability of Costs) and OMB Compliance
      Supplement Part 3.2, Activities Allowed or Unallowed, require that costs
      charged to federal awards be allocable to specific activities in accordance
      with the relative benefits received. Additionally, the university's internal
      Research Cost Classification Policy (RCCP-2024-01) requires PI sign-off on
      indirect-cost categorization for any transaction > $1,000.
    `,
    CONDITION: `
      In a sample of 120 transactions drawn across three federal research programs
      (NSF 47.049 n=40, NIH 93.310 n=40, DOE 81.049 n=40) for the period July 1, 2026
      through October 31, 2026, we identified 14 transactions (11.7%) that were charged
      to the "indirect cost" activity category despite evidence — purchase descriptions,
      PI invoices, and departmental records — that the costs should have been direct-
      charged. The error rate was consistent across programs:
        - NSF 47.049:  5 of 40  (12.5%)
        - NIH 93.310:  5 of 40  (12.5%)
        - DOE 81.049:  4 of 40  (10.0%)
      Additionally, 9 of the 14 miscoded transactions lacked the required PI sign-off
      per RCCP-2024-01.
    `,
    CAUSE: `
      Testing identified two contributing factors:

      First, the Grants Accounting Office expense-categorization training curriculum
      does not adequately address the direct-vs-indirect cost distinction for research
      activities. Training materials last updated November 2022. New accounting staff
      (three hired FY25) had no documented training on RCCP-2024-01.

      Second, the university's Workday ERP expense-coding workflow does not
      programmatically enforce PI sign-off for categorization changes. The workflow
      issues a notification but does not block submission. Approximately 40% of
      flagged transactions proceed without PI acknowledgment.
    `,
    EFFECT: `
      Known questioned costs total $127,400 across the three programs tested
      (NSF $54,200; NIH $48,100; DOE $25,100). Applying the sample error rate to
      the population of similar transactions during the audit period yields likely
      questioned costs of approximately $340,000. The university may face cost
      disallowance from awarding agencies, which would require reclassification on
      amended cost reports and potentially funds return to the federal government.
      Additionally, the indirect-cost pool is potentially overstated, which — if not
      corrected — would result in inflated indirect-cost recovery in future periods.
    `,
  },

  // PER-PACK EXTENSIONS — pack-specific extra fields
  // The Single Audit overlay pack contributes these fields specifically for
  // findings on engagements where SINGLE_AUDIT:2024 is attached.
  standardExtensions: {
    "SINGLE_AUDIT:2024": {
      QUESTIONED_COSTS_KNOWN: 127400,
      QUESTIONED_COSTS_LIKELY: 340000,
      FEDERAL_PROGRAM: "47.049 (NSF); 93.310 (NIH); 81.049 (DOE)",
      REPEAT_FINDING: "no",
      COMPLIANCE_REQUIREMENT: "ALLOWABLE_COSTS",
      FINDING_REFERENCE_NUMBER: "2026-001",
    },
  },

  // CLASSIFICATIONS — per-pack severity
  // Two legitimate, non-conflicting classifications from different schemes.
  // GAGAS uses deficiency-tier based on potential-misstatement magnitude.
  // IIA uses severity based on business-impact + likelihood.
  classifications: [
    {
      packRef: { packCode: "GAGAS", packVersion: "2024" },
      schemeCode: "GAGAS_DEFICIENCY_TIER",
      levelCode: "SIGNIFICANT_DEFICIENCY",   // per GAGAS §6.41-6.44
    },
    {
      packRef: { packCode: "IIA_GIAS", packVersion: "2024" },
      schemeCode: "IIA_SEVERITY",
      levelCode: "MAJOR",                    // per the function's severity policy
    },
    // Single Audit overlay does NOT add a separate classification — the
    // GAGAS tier plus the overlay extensions together carry the Single Audit
    // severity semantics. This is a deliberate design choice: not every
    // overlay needs its own scheme.
  ],

  // Which methodologies this finding is reported under.
  // It's the intersection of: engagement's attached methodologies × the finding's
  // relevance to each one's scope.
  applicableMethodologies: [
    { packCode: "GAGAS", packVersion: "2024" },
    { packCode: "IIA_GIAS", packVersion: "2024" },
    // Not attached: SINGLE_AUDIT:2024 is an overlay, not a methodology.
    // The overlay's extensions are carried in standardExtensions above;
    // the finding appears in Single Audit reports because of that, not
    // because it's "under IIA methodology."
  ],

  // SOX independence flag — not applicable here but the field exists universally.
  // Set true only when the engagement attaches a PCAOB methodology pack.
  soxSuppressRecommendation: false,

  status: "IN_REVIEW",

  // Optimistic concurrency — increments on every update to catch race conditions.
  version: 3,

  createdAt: "2027-12-03T14:22:08Z",
  updatedAt: "2027-12-05T10:17:33Z",
  createdBy: "usr_jordan_akintola",   // staff auditor
  assignedTo: "usr_priya_nair",       // AIC owns final review
}
```

### Why — a closer look at each element

**The `coreElements` block.** Keys are canonical semantic codes — not pack-specific field names. Both GAGAS and IIA GIAS declare (in their `semanticElementMappings`) that *their* element `CRITERIA` maps to the canonical `CRITERIA`, with `equivalenceStrength: "exact"`. Same for `CONDITION`, `CAUSE`, and `EFFECT`. This is why Priya fills in a single record and it renders correctly under either methodology — because the two packs have declared semantic equivalence.

If IIA GIAS had used a different element name — say, "Consequence" instead of "Effect" — the semantic code mapping would still normalize them. Priya fills the canonical `EFFECT`; when the report renders under IIA mode, the UI displays the label "Consequence" because that's what IIA calls it. Same data, two renderings.

**The `standardExtensions` block.** The Single Audit overlay pack declares *additional finding elements* — `QUESTIONED_COSTS_KNOWN`, `FEDERAL_PROGRAM`, etc. — that appear only when the overlay is attached. Their values live under the overlay's pack key (`"SINGLE_AUDIT:2024"`) inside the finding's `standardExtensions` map.

This is the pattern for pack-specific fields: they don't bloat the finding's core schema; they live under their owning pack's key. A finding on an engagement that does *not* attach Single Audit simply has an empty `standardExtensions` object, or one that contains keys for other overlays.

**The `classifications` array.** GAGAS classifies this as a Significant Deficiency (it's not a Material Weakness because the error rate and dollar magnitude don't threaten overall program compliance; it's not a Deficiency because the magnitude is substantial). IIA classifies it as Major per the function's internal severity rubric. These two labels are not contradictions — they're different measurement schemes. Both appear on the finding. Both survive to reports. A reader of the GAGAS Yellow Book report sees the GAGAS tier; a reader of the Audit Committee report sees the IIA severity.

**The `applicableMethodologies` array.** The finding will be reported under both GAGAS and IIA GIAS methodologies — because the error is simultaneously a Single Audit finding (under GAGAS's Single Audit engagement type) and a business-risk finding (under IIA's assurance-engagement scope). The overlay — Single Audit — is *not* a methodology. Its extensions ride along because the overlay is attached to the engagement, not because it appears in this array.

**`soxSuppressRecommendation`.** Always present, `false` by default. Set to `true` only when the engagement attaches a PCAOB methodology — which this one doesn't. See [§11 — Sidebar mini-scenarios](#14-what-this-engagement-did-not-hit) for the SOX case.

### Check your understanding

1. Why does the finding's `standardExtensions["SINGLE_AUDIT:2024"].QUESTIONED_COSTS_KNOWN` exist but not `standardExtensions["GAGAS:2024"].QUESTIONED_COSTS_KNOWN`?
2. If Priya noticed a similar miscoding pattern but for only $5,000 in questioned costs, would this still be a Single Audit finding? Explain.
3. The finding has two `classifications`. Could a single finding have *three* classifications? Under what scenario?
4. What would the `coreElements` look like on the same finding if it were an ISO 19011 nonconformity instead of a GAGAS Single Audit finding?

> Answers: (1) Because `QUESTIONED_COSTS_KNOWN` is declared as an *additional finding element* by the Single Audit overlay pack, not by GAGAS. The overlay owns the field; its values live under its pack key. (2) No — $5,000 is below the Single Audit reporting threshold ($25,000 per 2 CFR 200.516(a)(3)). It might still be worth noting as a management letter comment, but it would not be a reportable Single Audit finding. (3) Yes — if, for example, the engagement also attached a third methodology pack (say, ISSAI) that carries its own classification scheme; or if the engagement attached a regulatory overlay that defined its own severity scheme in addition to the host methodology's. The array is unbounded. (4) ISO 19011's pack maps canonical `CRITERIA` to its `AUDIT_CRITERIA` field (narrower; usually a specific clause), `CONDITION` to `NONCONFORMITY_EVIDENCE`, `CAUSE` to `ROOT_CAUSE` (required only for Major NCs), and does not have an `EFFECT` equivalent. The ISO finding would likely also use a different classification scheme — Major NC / Minor NC / Observation / OFI — and have a different semantic slot `NC_CLAUSE` capturing the specific clause of ISO 27001 or ISO 9001 that was violated.

---

## 7. Recommendations — separate entity, many-to-many

### What happened

Priya writes a single recommendation to address this finding. But — uncovered during the same fieldwork — is a related finding about the PI sign-off workflow in Workday: approximately 40% of categorization changes proceed without PI acknowledgment. This second finding (2026-002) has its own four elements (different Condition, different Effect dollar figure), but the same Cause and, critically, the same corrective action.

Rather than write two recommendations saying the same thing, Priya writes one recommendation that addresses both findings.

### Why

The GAGAS §6.47 structure explicitly supports one-recommendation-to-many-findings. In practice this is common:

- A single root cause produces multiple symptoms
- Addressing the root cause addresses all the symptoms
- Writing separate recommendations would force the auditee to respond to "the same thing" multiple times, which adds work without adding value

Many audit tools — including some major commercial platforms — model Recommendation as a field *on* Finding. That forces one-to-one, or requires workarounds. AIMS v2 models Recommendation as its own entity with a `findingIds: string[]` array, allowing true many-to-many linkage.

Further, how the recommendation appears in the final report varies by methodology:

- Under **GAGAS §6.02**, the report includes findings in Section X ("Findings and Recommendations") and a *separate consolidated schedule* of all recommendations at the end of the report (required by §6.47).
- Under **IIA GIAS Standard 15.1**, recommendations appear *inline* with each finding as the "5th C."
- Under **ISO 19011**, formal auditor-issued recommendations don't really exist in the GAGAS/IIA sense; what the auditee prepares is a "Corrective Action Request" in response to a nonconformity. ISO engagements use the Recommendation entity but with terminology overridden.
- Under **PCAOB AS 2201**, the auditor cannot issue recommendations on an ICFR audit because doing so + subsequently testing the remediation = self-review threat (a fundamental independence breach). AIMS v2 handles this via the `soxSuppressRecommendation` flag on the finding — the recommendation entity is created for internal tracking but suppressed from every published report.

The same recommendation data, four different rendering behaviors, driven by which pack the report is being generated for.

### How you'd do it in the app

```ts
{
  id: "rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1",
  tenantId: "tnt_oakfield_university",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",

  findingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  // ^ addresses both the miscoding finding and the PI-signoff-workflow finding

  title: "Strengthen research cost classification controls",
  body: `
    We recommend the university:

    1. Update the Grants Accounting Office expense-categorization training curriculum
       to include a dedicated module on RCCP-2024-01 direct-vs-indirect cost rules,
       with examples drawn from federal research programs. Delivery to all accounting
       staff within 60 days; repeat annually.

    2. Modify the Workday expense-coding workflow to programmatically enforce PI
       sign-off for any categorization change on transactions > $1,000. Current
       notification-only workflow should be replaced with a blocking approval step.

    3. Perform a lookback review of transactions coded "indirect" during FY25 and
       FY26 to identify and correct any additional miscoded transactions. Any
       questioned costs identified should be reclassified in amended cost reports
       to the awarding agencies.
  `,

  priority: "HIGH",
  targetCompletionDate: "2028-08-31",    // roughly six months after reports issued
  assignedToAuditeeUserId: "usr_univ_vp_research",   // recommendation owner on auditee side

  managementResponse: `
    Management agrees with the recommendation. The Office of the VP for Research,
    in partnership with Grants Accounting and University IT, will:
      (a) Deliver updated training by August 30, 2028.
      (b) Implement the Workday workflow change by July 15, 2028.
      (c) Complete the lookback review and file amended cost reports by December 31,
          2028.
    The VP for Research is accountable; the Grants Accounting Director is responsible
    for execution.
  `,

  // When the Corrective Action Plan is completed, this links back.
  correctiveActionPlanId: "cap_01J8BM3K4Z5N6P7Q8R9S0T1U2V3",

  status: "ACCEPTED",   // auditee has committed; CAP in progress

  createdAt: "2027-12-06T11:14:22Z",
  updatedAt: "2027-12-15T09:34:11Z",
  createdBy: "usr_priya_nair",
  version: 2,
}
```

The `managementResponse` is captured as part of the recommendation because it's the auditee's reply to *the recommendation* specifically. The `correctiveActionPlanId` links to a separate CAP record that tracks the auditee's implementation progress over the year ahead.

---

## 8. The approval workflow

### What happened

Priya submits the finding and recommendation for review on December 8, 2027. The workflow her engagement inherits from the GAGAS pack (primary methodology) has four steps:

1. **DRAFT** — authoring phase; AIC and staff can edit
2. **IN_REVIEW_SENIOR** — Senior Auditor (Jordan) reviews
3. **IN_REVIEW_CAE** — CAE (Marcus) reviews and approves
4. **APPROVED** — locked; further changes require formal amendment

Jordan reviews on Dec 9, makes small suggestions on the Cause wording (Priya revises), and on Dec 10 advances the finding to CAE review. Marcus reviews on Dec 12 — no changes requested — and approves. The finding moves to APPROVED status; its `lockedAt` is set; further edits are blocked at the data model layer via the immutability trigger (see `database/functions/immutability-checks.sql`).

Concurrently, the attached IIA GIAS methodology requires a QAIP concurrent review for this finding (Standard 15.1 — Final Engagement Communication must be subject to QAIP). The QAIP reviewer assigned for this engagement is an internal auditor on Marcus's team who did not work on the fieldwork — assigned specifically because QAIP requires independence from the engagement's day-to-day team. The QAIP reviewer completes the checklist on Dec 13, 2027 and signs off.

The finding is now fully approved under both methodologies.

### Why

The workflow the engagement uses is selected by the *primary* methodology. GAGAS's default workflow for finding approval is the four-step chain above. If IIA GIAS were primary instead, the workflow might differ (e.g., IIA's typical model adds an optional external peer review touchpoint, omits the CAE-specific role in favor of a generic "Engagement Senior Owner" role).

The *additional* methodology (IIA here) adds supplementary requirements rather than replacing the workflow. GIAS Standard 15.1 requires QAIP concurrent review; AIMS v2's IIA pack declares that requirement and the engagement enforces it as an additional required step alongside (not inside) the primary workflow.

Every workflow state transition is logged to the hash-chained audit event table (see `database/functions/audit-log-triggers.sql`). Later, when anyone asks *who approved finding 2026-001 and when*, the answer is queryable with provable integrity — the audit log chain would detect any tampering.

### How you'd do it in the app

```ts
// Workflow event, appended to audit log atomically with the finding update
{
  eventId: "evt_01J8BK5T6M7N8P9Q0R1S2T3U4V",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  entityType: "finding",
  entityId: "fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1",
  action: "WORKFLOW_TRANSITION",
  from: "IN_REVIEW_CAE",
  to: "APPROVED",
  actor: "usr_marcus_chen",
  at: "2027-12-12T15:08:44Z",

  // Driven by which pack? Primary methodology.
  workflowDriver: { packCode: "GAGAS", packVersion: "2024" },
  workflowCode: "GAGAS_FINDING_APPROVAL",
  stepCode: "CAE_FINAL_APPROVAL",

  // Hash chain — each event hashes with previous to make tampering detectable
  previousHash: "0x7a3b9c...",
  hash: "0x4d8e2f...",
}

// Separately, the QAIP review appears as its own event
{
  eventId: "evt_01J8BL8X9Y0Z1A2B3C4D5E6F7G",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  entityType: "finding",
  entityId: "fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1",
  action: "QAIP_CONCURRENT_REVIEW_COMPLETE",
  actor: "usr_qaip_reviewer",
  at: "2027-12-13T14:22:08Z",

  // Driven by which pack? Additional methodology.
  workflowDriver: { packCode: "IIA_GIAS", packVersion: "2024" },
  requirementReference: "GIAS Standard 15.1",

  previousHash: "0x4d8e2f...",
  hash: "0x9f6a8b...",
}
```

---

## 9. Multi-report generation — the payoff

This is where multi-standard support stops being an abstraction and becomes the reason the whole architecture exists.

### What happened

By mid-February 2028, fieldwork is complete, findings are approved, and Priya is generating the engagement's report package. She opens the **Reports** tab on the engagement and sees the report definitions contributed by all attached packs — seven total.

She clicks **Generate** on each. The system produces seven distinct report artifacts, each formatted correctly for its target audience and each attesting to its specific pack. On February 26, 2028, Marcus signs all of them, the reports enter `ISSUED` status, their `lockedAt` timestamps are set, and the package is filed with the Federal Audit Clearinghouse (by the university's CFO — well ahead of the March 31, 2028 deadline) and with the Board of Trustees.

### Why

A Single Audit produces multiple reports because 2 CFR 200.515 requires multiple reports. Each report has a specific purpose, a specific format, and a specific attesting standard.

Modeling this as "one engagement, one report, with sections" would flatten the legal structure and conflate attestation claims. A finding might appear in the Yellow Book report and the Schedule of Findings and Questioned Costs — they're both *about the same finding* but attest under different authorities. Each report carries its own compliance statement. Each has its own distribution list. Each has its own retention rules (all 5 years here per the strictness resolver).

AIMS v2 models this exactly as the regulation requires: **one engagement, many reports, each `attestsTo` a specific pack.** Findings and recommendations are linked into each report via `includedFindingIds` and `includedRecommendationIds` arrays, allowing the same finding to be cross-listed in multiple reports.

### How you'd do it in the app — the seven reports

#### Report 1 — Independent Auditor's Report on the Financial Statements

```ts
{
  id: "rpt_01J8C1A2B3C4D5E6F7G8H9J0K1L2",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  attestsTo: { packCode: "AICPA_AUC", packVersion: "CURRENT" },  // GAAS via AU-C
  reportType: "fs_opinion",
  title: "Independent Auditor's Report on the Financial Statements",
  includedFindingIds: [],          // FS opinion doesn't typically itemize findings
  includedRecommendationIds: [],
  status: "ISSUED",
  issuedAt: "2028-02-26T16:00:00Z",
  lockedAt:  "2028-02-26T16:00:00Z",
  // ... sections, artifacts, etc.
}
```

#### Report 2 — Report on Internal Control over Financial Reporting and Compliance (Yellow Book Report)

```ts
{
  id: "rpt_01J8C1F3G4H5I6J7K8L9M0N1O2P3",
  attestsTo: { packCode: "GAGAS", packVersion: "2024" },
  reportType: "yellow_book_report",
  title: "Report on Internal Control over Financial Reporting and on Compliance and Other Matters Based on an Audit of Financial Statements Performed in Accordance with Government Auditing Standards",
  includedFindingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  includedRecommendationIds: ["rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1"],
  status: "ISSUED",
  issuedAt: "2028-02-26T16:00:00Z",
}
```

#### Report 3 — Report on Compliance for Each Major Federal Program (Single Audit Compliance Report)

```ts
{
  id: "rpt_01J8C2A3B4C5D6E7F8G9H0J1K2L3",
  attestsTo: { packCode: "SINGLE_AUDIT", packVersion: "2024" },
  reportType: "single_audit_compliance",
  title: "Report on Compliance for Each Major Federal Program and Report on Internal Control over Compliance Required by the Uniform Guidance",
  includedFindingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  includedRecommendationIds: ["rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1"],
  status: "ISSUED",
}
```

Notice: finding `fnd_01J8ABK3Z2V7...` appears in Reports 2 AND 3 AND the upcoming Report 4 (Schedule of Findings and Questioned Costs). Each is a different report attesting under different authority; the finding is *cross-listed* per 2 CFR 200.515(d), which permits and requires this.

#### Report 4 — Schedule of Findings and Questioned Costs

```ts
{
  id: "rpt_01J8C3F4G5H6I7J8K9L0M1N2O3P4",
  attestsTo: { packCode: "SINGLE_AUDIT", packVersion: "2024" },
  reportType: "schedule_findings_questioned_costs",
  title: "Schedule of Findings and Questioned Costs",
  includedFindingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  includedRecommendationIds: ["rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1"],
  status: "ISSUED",
}
```

This is where the Single Audit overlay extensions (questioned costs, ALN, repeat-finding indicator, compliance requirement) are the primary payload. The finding renders with those fields prominent.

#### Reports 5, 6, 7 — SEFA, Summary Schedule of Prior Audit Findings, Corrective Action Plan

```ts
// Report 5 — SEFA
{ attestsTo: { packCode: "SINGLE_AUDIT", packVersion: "2024" }, reportType: "sefa", ... }

// Report 6 — Summary Schedule of Prior Audit Findings
// Empty this year (no prior findings to report on); will have content next year
{ attestsTo: { packCode: "SINGLE_AUDIT", packVersion: "2024" }, reportType: "summary_schedule_prior_findings", includedFindingIds: [], ... }

// Report 7 — Corrective Action Plan (auditee-authored, AIMS hosts it)
{ attestsTo: { packCode: "SINGLE_AUDIT", packVersion: "2024" }, reportType: "corrective_action_plan", ... }
```

And because the function elected IIA GIAS conformance:

#### Report 8 — Report to the Audit and Compliance Committee

```ts
{
  id: "rpt_01J8C4X5Y6Z7A8B9C0D1E2F3G4H5",
  attestsTo: { packCode: "IIA_GIAS", packVersion: "2024" },
  reportType: "ia_committee_report",
  title: "Internal Audit Report to the Audit and Compliance Committee — FY26 Single Audit",
  includedFindingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  includedRecommendationIds: ["rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1"],
  status: "ISSUED",
}
```

This IIA-style report presents the findings with *inline recommendations* (IIA's 5-C style) — different rendering from the same underlying data than the GAGAS Yellow Book report, which presents findings separately from a consolidated recommendations schedule.

Same data. Different renderings. Both valid. Both required.

### The compliance-statement builder

Each report automatically assembles its "Conducted in accordance with..." sentence from the attached packs with `conformanceClaimed: true`. The Yellow Book report (Report 2) generates:

> We have audited, in accordance with the auditing standards generally accepted in the United States of America and the standards applicable to financial audits contained in *Government Auditing Standards* issued by the Comptroller General of the United States...

And the Internal Audit Committee report (Report 8) generates:

> This engagement was conducted in conformance with the Global Internal Audit Standards, and in conjunction with the Government Auditing Standards (GAGAS 2024 revision) as required by the Single Audit Act and Uniform Guidance...

Each report sees only the packs relevant to it, assembled in the right language.

### Check your understanding

1. Why is the Report 6 (Summary Schedule of Prior Audit Findings) included despite being empty this year?
2. Report 2 (Yellow Book) and Report 3 (Single Audit compliance) both include finding `fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1`. Why? Is this duplicate reporting?
3. Could there be a Report 9 that attests to `IIA_GIAS:2024` but *excludes* all Single Audit extensions? What would that look like?
4. The Yellow Book report (Report 2) and the Audit Committee report (Report 8) both include the same finding, but the recommendation renders inline in Report 8 and as a separate schedule in Report 2. How does the system decide?

> Answers: (1) Required by 2 CFR 200.511(b) for every Single Audit regardless of prior findings; emptiness is reported explicitly as "No prior audit findings to report" in the schedule itself. (2) Not duplicate — cross-listed per 2 CFR 200.515(d). The Yellow Book report attests to GAGAS internal-control-and-compliance testing generally; the Single Audit compliance report attests to compliance with specific major federal programs under Uniform Guidance. The same finding can be material to both. (3) Yes, possible if the function wanted an internal-only GIAS report without the Single Audit dimensions. The report would reference `applicableMethodologies` filtered to IIA_GIAS only and would exclude the `standardExtensions["SINGLE_AUDIT:2024"]` block from rendering. AIMS v2 allows per-report filtering. (4) The pack that the report attests to declares a `recommendationPresentation` rule in its `ReportDefinition` — GAGAS declares `"separate"` (consolidated schedule), IIA GIAS declares `"inline"` (5-C style).

---

## 10. Quality review and peer review

### What happened

Before signing the reports on February 26, 2028, Marcus performs a **final engagement review** — a CAE-level walk through the engagement's work papers, findings, and reports to confirm the work meets professional standards. Both GAGAS §5.01 and IIA GIAS Std 12.3 require this sort of review; the GAGAS pack's QA workflow prompts Marcus through a 60-item checklist.

Separately, the function's QAIP is subject to external assessment every five years. The most recent external assessment was November 2023 (rated "Generally Conforms" — the top tier under IIA's three-tier scale). The next is due November 2028 — about nine months after this engagement ships.

Under GAGAS, the peer review cycle is three years; the last peer review was June 2025 (conducted by the Indiana State Board of Accounts, rated "Pass"). The next is due June 2028 — about four months after this engagement ships.

Both the 5-year IIA external and the 3-year GAGAS peer review are attached to the audit function, not to this specific engagement. But this engagement may be sampled during either review as a test case; the engagement's work papers, findings, and reports must survive that scrutiny.

### Why

Audit quality is maintained through nested review: in-engagement review (Senior + CAE), function-level QA (QAIP for IIA, peer review for GAGAS), and profession-wide oversight (AICPA peer review system, PCAOB inspections for SOX, etc.). Each layer adds assurance.

AIMS v2 doesn't perform external peer reviews — that's a human activity. But it preserves the structured work paper trail and engagement metadata such that a peer reviewer can reconstruct what happened. The hash-chained audit log ensures that what they see is what actually happened. The strictness resolver ensures that the engagement met the stricter of each applicable pack's requirement, so the reviewer can test compliance against the right standard.

### How you'd do it in the app

The final engagement review is itself a structured checklist:

```ts
{
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  reviewerId: "usr_marcus_chen",
  reviewType: "FINAL_ENGAGEMENT_REVIEW",
  packDriver: { packCode: "GAGAS", packVersion: "2024" },

  checklistItems: [
    { code: "APM_REVIEWED_AND_APPROVED",                  status: "PASS", notes: "APM approved August 17" },
    { code: "INDEPENDENCE_CONFIRMED_AT_START",            status: "PASS", notes: "Per-engagement declarations filed by all four team members" },
    { code: "EVIDENCE_SUFFICIENT_AND_APPROPRIATE",        status: "PASS", notes: "Reviewed 85% of work papers directly; spot-checked the rest" },
    { code: "FINDINGS_PROPERLY_STRUCTURED",               status: "PASS", notes: "Both findings follow GAGAS §6.39 four-element structure" },
    { code: "MGMT_RESPONSE_OBTAINED",                     status: "PASS", notes: "Received January 12, 2028; included in reports" },
    { code: "SINGLE_AUDIT_OVERLAY_ELEMENTS_POPULATED",    status: "PASS", notes: "Questioned costs, ALN, compliance requirement all populated on both findings" },
    { code: "REPORTS_COMPLETE_AND_SIGNED",                status: "PASS", notes: "All seven reports approved; Marcus signing simultaneously" },
    { code: "IIA_QAIP_CONCURRENT_REVIEW_COMPLETE",        status: "PASS", notes: "Per-finding QAIP sign-offs on file" },
    // ... 52 more items covering each area of the engagement
  ],

  completedAt: "2028-02-26T10:30:00Z",
  engagementSigned: true,
}
```

---

## 11. Post-issuance and follow-up

### What happened

The reports are filed February 26, 2028 (34 days ahead of the March 31 FAC deadline). The Federal Audit Clearinghouse posts them publicly (as required for Single Audits) within a few business days. The awarding agencies receive them through the FAC's distribution. The Board of Trustees' Audit and Compliance Committee is briefed March 15, 2028.

Priya schedules a follow-up review for January 2029 to verify the university's corrective actions:

- Updated training rolled out (should be done by August 30, 2028 per management's CAP)
- Workday workflow change implemented (by July 15, 2028)
- Lookback review and amended cost reports filed (by December 31, 2028)

In January 2029, Priya's team performs the follow-up. They confirm training was delivered (personnel records + sample interviews), verify the Workday change is in effect (process walkthrough + test transactions), and review the amended cost reports. Everything checks out.

The finding's corrective action plan is marked `VERIFIED` on January 20, 2029.

When the FY27 Single Audit engagement is created in September 2028 (FY27 runs July 1, 2027 – June 30, 2028), it automatically inherits Prior-Year Findings — including the now-closed finding 2026-001. That finding will appear in the FY27 Summary Schedule of Prior Audit Findings with status "Fully Corrected."

### Why

Audit findings have half-lives. Single Audit specifically requires the Summary Schedule of Prior Audit Findings per 2 CFR 200.511(b) — every engagement reports the prior-year findings' current status. This is how the federal government tracks whether non-federal entities actually fix what they promise to fix.

AIMS v2 models this as a cross-engagement link: a finding's `correctiveActionPlan` has its own lifecycle that spans engagements, and subsequent-year engagements automatically pull forward the set of open and recently-closed findings from the auditee's prior engagements.

### How you'd do it in the app

The corrective action plan record:

```ts
{
  id: "cap_01J8BM3K4Z5N6P7Q8R9S0T1U2V3",
  tenantId: "tnt_oakfield_university",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  findingIds: ["fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1", "fnd_01J8ABR4C5D6E7F8G9H0J1K2L3"],
  recommendationId: "rec_01J8AK8Y9Z3R5M7Q2N4V6W8X0T1",

  plannedActions: [
    { code: "TRAINING_UPDATE",    plannedDate: "2028-08-30", actualDate: "2028-07-22", status: "COMPLETE" },
    { code: "WORKDAY_WORKFLOW",   plannedDate: "2028-07-15", actualDate: "2028-06-28", status: "COMPLETE" },
    { code: "LOOKBACK_REVIEW",    plannedDate: "2028-12-31", actualDate: "2028-11-15", status: "COMPLETE" },
  ],

  status: "VERIFIED",             // auditor has verified completion
  verifiedAt: "2029-01-20T11:00:00Z",
  verifiedBy: "usr_priya_nair",

  // Inheritance metadata for next year's engagement
  carriesForwardToNextYear: true,
  priorYearFindingReference: "2026-001",
}

// Next year's engagement automatically gets:
{
  engagementId: "eng_01J9_fy27_single_audit",
  inheritedPriorFindings: [
    {
      originalFindingId: "fnd_01J8ABK3Z2V7N5M9Q4R8S6T7U1",
      originalReference: "2026-001",
      currentStatus: "FULLY_CORRECTED",
      verifiedInEngagement: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
    },
    // ...
  ],
}
```

---

## 12. The SOC 2 sub-thread — control framework in action

### What happened

During fieldwork in October 2027, Priya's team needs to test controls at the university's cloud learning management vendor — "EduCloud" (fictional SaaS company). EduCloud handles federal work-study payments on behalf of the university, which puts it in scope for Internal Control Over Federal Awards testing.

EduCloud provides a **SOC 2 Type II report** prepared by its auditor, covering a 12-month period ending June 30, 2027 — cleanly aligned with Oakfield's FY26 audit period. The SOC 2 covers Security, Availability, and Confidentiality Trust Service Criteria. It includes the 33+ Common Criteria (CC1-CC9) plus additional criteria for Availability and Confidentiality.

Priya's team's job is to determine whether the SOC 2 report provides sufficient evidence over the controls that matter to Oakfield's Single Audit — specifically, logical access controls, change management, and incident response as they affect federal work-study payment processing.

### Why

This is where a control framework pack (SOC 2:2017) differs from a methodology pack. SOC 2 isn't a methodology the auditor applies — it's a library of testable controls the vendor's auditor applied, and the results of which Oakfield's auditor wants to rely on.

The SOC 2:2017 pack in AIMS v2 provides:

- Control library (CC1.1 through CC9.2, plus Availability CC/A, Confidentiality CC/C)
- Points of focus per control (COSO 2013-aligned)
- Testing guidance per control
- **Cross-framework crosswalks** — each control's mapping to ISO 27001:2022, NIST 800-53 Rev 5, HIPAA Security Rule, CIS Controls, etc.

The pack does NOT provide engagement workflow, finding schema, or report structure. Those come from the engagement's primary methodology (GAGAS, here).

When Priya attaches `SOC2:2017` to the engagement's `controlFrameworks[]` array, what she gets is:

- The control library becomes available to reference in her work programs ("Our testing of CC6.1 controls...")
- Findings on those controls can tag the specific control code (e.g., `standardExtensions["SOC2:2017"] = { controlCode: "CC6.1", vendor: "EduCloud" }`)
- If Oakfield's Single Audit later becomes a SOC 2 engagement itself (hypothetically), the framework is already in the system

### How you'd do it in the app

Attaching the framework is a simple update to the engagement record:

```ts
// Engagement updated in December when SOC 2 scope confirmed
{
  id: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  // ... unchanged fields ...
  controlFrameworks: [
    {
      packCode: "SOC2",
      packVersion: "2017",
      scope: "global",
      conformanceClaimed: false,    // we're relying on SOC 2; not claiming conformance ourselves
    },
  ],
  version: 8,                        // incremented from 7
  updatedAt: "2027-10-04T14:00:00Z",
}
```

And a work paper documents the reliance decision:

```ts
{
  workPaperId: "wp_01J8BX2Y3Z4A5B6C7D8E9F0G1H",
  engagementId: "eng_01J7Q8F4X3M0K2N9Z5Y6V7W8R9",
  title: "Reliance on EduCloud SOC 2 Type II Report",

  controlFrameworkRef: { packCode: "SOC2", packVersion: "2017" },
  relevantControls: ["CC6.1", "CC6.6", "CC7.2", "CC7.3", "CC8.1"],

  relianceDecision: "FULL_RELIANCE",   // vs partial, vs no reliance
  relianceRationale: `
    EduCloud's SOC 2 Type II report covers the audit period. The service auditor
    is an AICPA-registered firm in good standing (PCAOB-inspected). Controls CC6.1,
    CC6.6, CC7.2, CC7.3, CC8.1 address logical access, boundary protection,
    monitoring, incident response, and change management — all relevant to federal
    work-study payment processing. The report identifies no exceptions in these
    control areas. We have reviewed the Complementary User Entity Controls (CUECs)
    and confirmed the university's own controls meet those user-entity
    responsibilities.
  `,

  relianceGapsIdentified: `
    None. EduCloud's CUECs require that users manage their own user accounts,
    which the university's IT governance committee confirmed is happening.
  `,
}
```

No findings were identified against the SOC 2 framework at EduCloud this year. If there had been SOC 2 control exceptions in the vendor's report, those might have propagated into Oakfield-specific findings depending on the materiality and compensating controls.

---

## 13. Seed data for future demo + training

Everything above — the engagement record, findings, recommendation, CAP, reports, and audit events — is exactly the seed data a future demo tenant would ship with. Hand a new user a pre-loaded Oakfield scenario, let them click through the workflow, and the concepts that otherwise take three reading passes will click in thirty minutes of hands-on exploration.

For reference, a complete seed for the Oakfield scenario would include roughly:

- 1 tenant record
- 1 audit function record with QAIP + peer review status
- 6 user records with CPE histories
- 1 audit charter document
- 1 engagement with all five pack attachments
- 3 findings (miscoding, workflow, plus one minor finding on SEFA completeness — omitted above for brevity)
- 2 recommendations (one of which is M:N across findings 1 and 2)
- 3 corrective action plans
- 7 reports at ISSUED status
- 1 SOC 2 reliance work paper
- ~45 additional work papers covering fieldwork evidence
- ~12 APM sections with worked content
- ~60 checklist entries covering final engagement review
- ~150 hash-chained audit events tracing every state transition

That corpus — ~300-400 records across ~25 tables — is enough to exercise every feature of the platform. It becomes the reference tenant for product demos, the practice environment for onboarding, and the exam environment for a future certification program (see §14).

---

## 14. What this engagement did NOT hit

The Oakfield Single Audit scenario is dense — every term we wanted to anchor appears above — but it doesn't exercise every corner of the platform. Three important cases the scenario doesn't cover, in sidebar form:

### Sidebar A — SOX-integrated audit (`engagementMode: "integrated"`)

A Fortune 500 public company's annual audit is an *integrated audit* per PCAOB AS 2201 — one engagement produces both an opinion on the financial statements (GAAS) and an opinion on internal control over financial reporting (PCAOB ICFR). The primary methodology pack is AICPA AU-C (via PCAOB standards for issuers); no additional methodologies; one control framework pack (COSO 2013 + possibly COBIT for ITGCs); no regulatory overlays.

Findings on ICFR deficiencies use the AS 2201 severity tiers (Deficiency / Significant Deficiency / Material Weakness). Critically: **recommendations are suppressed** from every published report. The auditor's recommendations attached to a finding carry `soxSuppressRecommendation: true`; report templates for PCAOB-mode attest `recommendationPresentation: "suppressed"`. Internal-to-audit-firm tracking of recommended remediation is still allowed (for audit committee private discussion), but no recommendation ever appears in the public ICFR opinion — auditor-issued recommendations on ICFR violate AS 2201's independence rules (self-review threat).

### Sidebar B — ISO 19011 integrated management system audit (`engagementMode: "combined"`)

An ISO certification body's surveillance audit of a client certified to ISO 9001, ISO 14001, ISO 27001, and ISO 45001 is an integrated management system audit per IAF MD 11:2023. Primary methodology: `ISO_19011:2018`. No additional methodologies. Four control framework packs attached (`ISO_9001:2015`, `ISO_14001:2015`, `ISO_27001:2022`, `ISO_45001:2018`). No regulatory overlays.

Findings use ISO's three-tier classification scheme — Major NC / Minor NC / Observation / OFI (Opportunity for Improvement). Each NC must cite the specific clause of the relevant ISO standard (`standardExtensions["ISO_27001:2022"] = { clauseReference: "A.5.17" }` etc.). Major NCs require root-cause analysis; Minor NCs don't require it but may include it. OFIs are a distinct finding *type*, not a sub-classification — they're suggestions, not nonconformities, and carry different corrective-action implications.

The engagement produces one integrated report (per IAF MD 11) rather than separate reports per standard, though the report sections are organized per-standard internally.

### Sidebar C — Pure GAGAS performance audit (`engagementMode: "single"`)

A state auditor's performance audit of a state agency's fraud-prevention program — no federal money involved, no IIA GIAS claim, no ISO — is a straightforward `single`-mode GAGAS performance audit. Primary methodology: `GAGAS:2024`. No additional methodologies, no control frameworks, no regulatory overlays.

Findings use GAGAS §6.39 four elements plus the GAGAS classification scheme. One report produced per the GAGAS §6.02 ten-section template. The strictness resolver has only one active pack, so its output is simply GAGAS's rules directly.

This is the easiest case mechanically and probably the most common actual engagement type for US state and local government auditors.

---

## 15. Terminology anchored here — index back to glossary

This worked example introduces or demonstrates in context the following terms, each defined in [05 — Glossary](05-glossary.md):

**Engagement + lifecycle:** Engagement, Engagement Mode, Engagement Type, Phase, Phase Gate, Audit Planning Memorandum (APM), Work Paper, Fieldwork, Planning, Reporting, Follow-up

**Standards + packs:** Standard Pack, Pack Type (methodology / control_framework / regulatory_overlay), StandardPackRef, StandardPackKey, Pack Scope (global / tenant), Conformance Claimed, Pack Dependency, Pack Version

**Engagement pack attachments:** Primary Methodology, Additional Methodologies, Control Frameworks, Regulatory Overlays, Strictness Resolver, EngagementStrictness, drivenBy audit trail

**Finding + semantic elements:** Finding, Core Elements, Semantic Element Code (CRITERIA / CONDITION / CAUSE / EFFECT / QUESTIONED_COST / NC_CLAUSE / etc.), Semantic Element Mapping, Equivalence Strength, Standard Extensions, Classifications, Applicable Methodologies, soxSuppressRecommendation

**Recommendation + CAP:** Recommendation, Many-to-many finding linkage, Management Response, Corrective Action Plan (CAP), Target Completion Date, Recommendation Presentation (inline / separate / suppressed)

**Report:** Report, attestsTo, Report Type, Included Finding IDs / Recommendation IDs, Report Section Content, Report Artifact, Report Status (Draft / In Review / Approved / Issued / Published), Compliance Statement Builder

**Workflow + QA:** Workflow Definition, Workflow Step, Workflow Transition, Phase Gate, Final Engagement Review, QAIP Concurrent Review, Peer Review Cycle, Hash-chained Audit Log, Immutability (lockedAt)

**Audit functions + governance:** Audit Function, Chief Audit Executive (CAE), Auditor-in-Charge (AIC), Audit Charter, QAIP, Peer Review, Independence Declaration, CPE Hours, Governmental CPE

**Regulatory + domain:** Single Audit, 2 CFR 200, Uniform Guidance, Federal Audit Clearinghouse, Questioned Costs (Known / Likely), Assistance Listing Number (ALN), OMB Compliance Supplement, Compliance Requirement, Yellow Book, GAGAS, IIA GIAS, AICPA AU-C, GAAS, SOC 2, ISO 19011, PCAOB AS 2201, COSO 2013

**Control frameworks:** Control Definition, Control Category, Points of Focus, Cross-framework Crosswalk, Trust Service Criteria, Complementary User Entity Controls (CUEC), Reliance Decision

For any term above whose meaning didn't fully click from context, jump to [05 — Glossary](05-glossary.md) and search. Every glossary entry links back to at least one section of this worked example where the term appeared naturally.

---

## 16. Extensions — variations for practice

For a user working through this scenario as practice (or for a future certification learner): once the base scenario feels solid, try these variations to test deeper understanding.

**Extension 1 — Change the primary methodology.** What changes if the function's CAE decides IIA GIAS is the *primary* methodology and GAGAS is attached as *additional*? Consider: which workflow governs the approval chain, which report template drives the default, how does the compliance-statement builder reorder authorities?

**Extension 2 — Drop the IIA conformance claim.** The function's external QAIP assessment is overdue. Priya sets `conformanceClaimed: false` on the IIA attachment. What changes in the engagement? What *doesn't* change?

**Extension 3 — Add a repeat finding.** Suppose FY25's engagement identified a very similar miscoding issue, corrective action was marked Complete, but the same issue recurs in FY26. How does the `REPEAT_FINDING` field change? What happens in the Summary Schedule of Prior Audit Findings (Report 6)?

**Extension 4 — A qualified SOC 2.** EduCloud's SOC 2 report identifies a significant exception in CC6.1 (logical access) — one unauthorized account persisted for 47 days without detection. How does Priya's reliance decision change? Does this generate a finding in the Oakfield Single Audit? Under which methodology?

**Extension 5 — Split the engagement.** Oakfield's Board decides the Single Audit and the Internal Audit Committee report should be separate engagements. How does the data split? What duplicates; what doesn't? What reliance does the separate IA engagement place on the Single Audit engagement's work?

**Extension 6 — Multi-tenant wrinkle.** Suppose the university's outside auditor (rather than Internal Audit) performs the Single Audit. The engagement lives in the outside firm's tenant, not the university's. How is access to university records granted? What role does the university-side user play?

These extensions are deliberately ambiguous — they don't have single canonical answers. Working through them (with a reviewer) is how a practitioner internalizes the *why* behind each design choice.

---

## 17. Domain review

This worked example was independently reviewed on 2026-04-20 by an experienced audit-domain expert. The review validated:

- **Regulatory citations** — 2 CFR 200.514/515/516/517, GAGAS 2024 §6.39 and §6.02, IIA GIAS Standard 15.1, OMB Compliance Supplement Part 3, and the 2024 Uniform Guidance revision raising the Single Audit threshold from $750k to $1M were all confirmed accurate.
- **Scenario realism** — the $180M federal research portfolio scale for a mid-size R1/R2 state research university is in the correct range; the 12% miscoding error rate is a characteristic "Allowable Costs / Cost Principles" violation pattern; the questioned-costs mathematics ($127,400 known, $340,000 likely projection) are sound for the sample size and error rate.
- **ALN codes** — 47.049 (NSF Mathematical and Physical Sciences), 93.310 (NIH Trans-NIH Research Support / Common Fund), and 81.049 (DOE Office of Science Financial Assistance Program) are confirmed correct. "ALN" (Assistance Listing Number) is the current terminology; "CFDA" (Catalog of Federal Domestic Assistance) is deprecated and should not appear in new material.
- **Finding text (§6)** — the four-element core reads as an experienced auditor would write it. Criteria correctly cites both federal regulation and institutional policy. Condition uses proper sample parameters. Cause identifies systemic drivers without personal blame. Effect translates the error into business-risk terms the Audit Committee expects.
- **Multi-standard reporting (§9)** — the seven-report package and the cross-listing of a single finding into multiple reports (Yellow Book + Single Audit Compliance + Schedule of Findings and Questioned Costs) accurately reflects real-world Single Audit practice. The GAGAS consolidated-recommendations-schedule vs IIA inline-"5th-C" rendering divergence was specifically called out as a correct representation of a real practitioner headache that most GRC software flattens.

**Effective-date alignment note.** GAGAS 2024 is technically effective for financial audits for periods beginning on or after December 15, 2025. The original draft of this worked example placed Oakfield's FY26 at September 1, 2025 – August 31, 2026, which would have required early adoption. This version shifts FY26 to July 1, 2026 – June 30, 2027 — the standard calendar for state universities — so the engagement falls cleanly within GAGAS 2024's natural effective period. All downstream dates in the scenario (fieldwork, reporting, follow-up, CAP completion) have been cascaded accordingly.

No other factual errors were identified. The reviewer's summary: *"Often, software architecture examples invent simplified business cases that fall apart under practitioner scrutiny. This one does the opposite: it leans into the real-world complexities of public sector and higher-ed auditing, and gets them right."*

Future material changes to this worked example should be re-reviewed by a practicing auditor before publication.

---

*Last reviewed: 2026-04-20. Next review: 2026-07-20 (quarterly cadence per `docs/README.md`).*
