/**
 * Single Audit Overlay — 2 CFR 200 Subpart F (2024 revision)
 *
 * Regulatory overlay layered on top of GAGAS for entities that expend
 * $1M or more in federal awards in a fiscal year (threshold for FY ending
 * Sept 30, 2025 and onward; previously $750k).
 *
 * Authority:
 *   - Single Audit Act Amendments of 1996 (31 USC §§ 7501-7507)
 *   - 2 CFR 200 Subpart F (OMB Uniform Guidance, revised 2024)
 *   - OMB Compliance Supplement (annual)
 *   - Assistance Listings (formerly CFDA) for ALN identification
 *
 * Relationship to GAGAS:
 *   - Single Audit REQUIRES GAGAS (2 CFR 200.514(a) — "The audit must be
 *     conducted in accordance with GAGAS.")
 *   - Single Audit REQUIRES GAAS (AICPA AU-C) — which GAGAS incorporates
 *     by reference
 *   - Reporting is stacked: FS opinion (GAAS) + Yellow Book report (GAGAS)
 *     + Single Audit reports (this overlay)
 *
 * This pack expresses only the DELTAS Single Audit adds on top of GAGAS:
 * additional finding elements (questioned costs, federal program, repeat
 * indicator), additional reports (SEFA, Schedule of Findings & Questioned
 * Costs, Summary Schedule of Prior Audit Findings, Corrective Action Plan),
 * and overlay-specific rule overrides.
 *
 * Previously embedded as `sectorOverlays[0]` inside `gagas-2024.ts`;
 * extracted 2026-04-20 per `references/multi-standard-design.md` Decision 1.
 */

import type { StandardPack } from '../standard-pack-schema';

export const singleAuditOverlay2024: StandardPack = {
  code: 'SINGLE_AUDIT',
  version: '2024',
  schemaVersion: '1.1.0',
  packType: 'regulatory_overlay',

  // ==========================================================================
  // METADATA
  // ==========================================================================
  meta: {
    name: 'Single Audit (Uniform Guidance)',
    commonName: 'Single Audit',
    issuingBody: {
      name: 'U.S. Office of Management and Budget',
      abbreviation: 'OMB',
      country: 'US',
      url: 'https://www.whitehouse.gov/omb',
    },
    referenceUrl: 'https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-F',
    publishedYear: 2024,
    effectiveFrom: '2024-10-01',
    earlyAdoptionAllowed: true,
    previousVersion: 'SINGLE_AUDIT:2020',
    description:
      '2 CFR 200 Subpart F requirements for audits of non-federal entities expending federal awards. Applied as an overlay on top of GAGAS; adds specific reporting schedules, questioned-costs tracking, federal program identification, and repeat-finding disclosure. Required when federal expenditures equal or exceed $1M in a fiscal year (threshold applicable for FY ending Sep 30, 2025 and after; previously $750k).',
    primarySectors: ['US_FEDERAL_GOVERNMENT', 'US_STATE_LOCAL_GOVERNMENT', 'NONPROFIT'],
    jurisdictions: ['US'],
    tags: ['single-audit', 'federal-awards', 'uniform-guidance', '2-cfr-200', 'omb'],
  },

  status: 'EFFECTIVE',

  // ==========================================================================
  // TERMINOLOGY (overlay-specific; most inherited from host methodology)
  // ==========================================================================
  terminology: {
    auditor: { label: 'Auditor', plural: 'Auditors' },
    leadAuditor: { label: 'Auditor-in-Charge', shortLabel: 'AIC', plural: 'Auditors-in-Charge' },
    headOfFunction: { label: 'Audit Director', plural: 'Audit Directors' },
    supervisor: { label: 'Supervisor' },
    qaReviewer: { label: 'Quality Reviewer' },
    auditee: { label: 'Non-Federal Entity', helpText: '2 CFR 200.1 — state, local government, Indian tribe, institution of higher education, or nonprofit organization expending federal awards.' },
    engagement: { label: 'Single Audit', plural: 'Single Audits' },
    finding: {
      label: 'Finding',
      plural: 'Findings',
      helpText: 'Deficiency that meets the reporting threshold under 2 CFR 200.516 — includes internal control deficiencies, noncompliance, questioned costs > $25,000, and known/likely fraud.',
    },
    recommendation: { label: 'Recommendation' },
    workpaper: { label: 'Workpaper', plural: 'Workpapers' },
    correctiveAction: {
      label: 'Corrective Action Plan',
      shortLabel: 'CAP',
      helpText: '2 CFR 200.511 — plan prepared by the auditee addressing each finding.',
    },
    fieldwork: { label: 'Fieldwork' },
    planning: { label: 'Planning' },
    reporting: { label: 'Reporting' },
    followUp: { label: 'Follow-Up' },
    planningMemo: { label: 'Audit Planning Memorandum' },
    workProgram: { label: 'Work Program' },
    auditReport: { label: 'Single Audit Report' },
    independence: { label: 'Independence' },
    qaChecklist: { label: 'Quality Management Checklist' },
    managementResponse: {
      label: 'Management Response',
      helpText: 'Required for each finding per 2 CFR 200.511(c); appears in the Corrective Action Plan.',
    },
  },

  // ==========================================================================
  // SEMANTIC ELEMENT MAPPINGS
  // Single Audit inherits CRITERIA/CONDITION/CAUSE/EFFECT semantics from GAGAS
  // (the required host methodology); adds QUESTIONED_COST semantic slot for
  // the overlay-specific finding element.
  // ==========================================================================
  semanticElementMappings: [
    {
      semanticCode: 'QUESTIONED_COST',
      packElementCode: 'QUESTIONED_COSTS_KNOWN',
      equivalenceStrength: 'exact',
      notes: '2 CFR 200.516(b) — known questioned costs. Dollar amount must be reported for findings reaching this finding type. This is a Single-Audit-specific semantic slot; not present in classical GAGAS/IIA/ISO methodology packs.',
    },
  ],

  // ==========================================================================
  // ADDITIONAL FINDING ELEMENTS
  // Rendered on findings when the overlay is attached to an engagement.
  // All layered on top of the GAGAS §6.39 four elements (Criteria, Condition,
  // Cause, Effect) which the host methodology provides.
  // ==========================================================================
  additionalFindingElements: [
    {
      code: 'QUESTIONED_COSTS_KNOWN',
      label: 'Known Questioned Costs',
      description: 'Known questioned costs (required to be disclosed if > $25,000 per compliance requirement per major program — 2 CFR 200.516(b)(3)).',
      helpText: 'Quantified dollar amount of known questioned costs.',
      isRequired: false,
      fieldType: 'currency',
      referenceSection: '2 CFR 200.516(b)',
      order: 5,
    },
    {
      code: 'QUESTIONED_COSTS_LIKELY',
      label: 'Likely Questioned Costs',
      description: 'Projected likely questioned costs when statistical sampling is used (2 CFR 200.516(b)(4)).',
      helpText: 'Statistical projection; typically derived from sampling methodology.',
      isRequired: false,
      fieldType: 'currency',
      referenceSection: '2 CFR 200.516(b)',
      order: 6,
    },
    {
      code: 'FEDERAL_PROGRAM',
      label: 'Federal Program (ALN)',
      description: 'Assistance Listing Number (ALN; formerly CFDA) identifying the federal program affected by the finding.',
      helpText: 'Format: NN.NNN (e.g., 93.778 for Medical Assistance Program).',
      isRequired: true,
      fieldType: 'text',
      referenceSection: '2 CFR 200.516(b)(2)',
      order: 7,
    },
    {
      code: 'REPEAT_FINDING',
      label: 'Repeat Finding Indicator',
      description: 'Whether this finding is a repeat of a prior year finding (2 CFR 200.516(b)(7)).',
      helpText: 'If yes, include a reference to the prior year finding number.',
      isRequired: true,
      fieldType: 'select',
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes (provide prior finding reference)' },
      ],
      referenceSection: '2 CFR 200.516(b)(7)',
      order: 8,
    },
    {
      code: 'COMPLIANCE_REQUIREMENT',
      label: 'Compliance Requirement',
      description: 'Specific compliance requirement from the OMB Compliance Supplement affected by this finding.',
      helpText: 'E.g., "Activities Allowed or Unallowed", "Eligibility", "Procurement and Suspension and Debarment", "Subrecipient Monitoring".',
      isRequired: true,
      fieldType: 'select',
      options: [
        { value: 'ACTIVITIES_ALLOWED', label: 'Activities Allowed or Unallowed' },
        { value: 'ALLOWABLE_COSTS', label: 'Allowable Costs / Cost Principles' },
        { value: 'CASH_MANAGEMENT', label: 'Cash Management' },
        { value: 'ELIGIBILITY', label: 'Eligibility' },
        { value: 'EQUIPMENT_REAL_PROPERTY', label: 'Equipment and Real Property Management' },
        { value: 'MATCHING_LEVEL_OF_EFFORT', label: 'Matching, Level of Effort, Earmarking' },
        { value: 'PERIOD_OF_PERFORMANCE', label: 'Period of Performance' },
        { value: 'PROCUREMENT', label: 'Procurement and Suspension and Debarment' },
        { value: 'PROGRAM_INCOME', label: 'Program Income' },
        { value: 'REPORTING', label: 'Reporting' },
        { value: 'SUBRECIPIENT_MONITORING', label: 'Subrecipient Monitoring' },
        { value: 'SPECIAL_TESTS', label: 'Special Tests and Provisions' },
      ],
      referenceSection: 'OMB Compliance Supplement Part 3',
      order: 9,
    },
    {
      code: 'FINDING_REFERENCE_NUMBER',
      label: 'Finding Reference Number',
      description: 'Sequentially numbered reference for this finding (format: YYYY-NNN).',
      helpText: 'Assigned when finding is finalized; used in prior-year cross-references per 2 CFR 200.516(c).',
      isRequired: true,
      fieldType: 'text',
      referenceSection: '2 CFR 200.516(c)',
      order: 10,
    },
  ],

  // ==========================================================================
  // ADDITIONAL REPORTS
  // Single Audit produces multiple reports from one engagement (per
  // 2 CFR 200.515(d)). These are layered on top of the host methodology's
  // report definitions. See references/multi-standard-design.md Decision 5.
  // ==========================================================================
  additionalReports: [
    {
      code: 'SCHEDULE_FINDINGS_QUESTIONED_COSTS',
      label: 'Schedule of Findings and Questioned Costs',
      description: 'Consolidated schedule listing all findings, with questioned costs, affected federal programs, and cross-references. Required by 2 CFR 200.515(d).',
      referenceSection: '2 CFR 200.515(d)',
      orientation: 'portrait',
      sections: [
        { code: 'SECTION_I_SUMMARY', label: 'Section I — Summary of Auditor\'s Results', order: 1, contentType: 'auto_generated', autoGeneratedFrom: 'engagement_summary', isRequired: true },
        { code: 'SECTION_II_FS_FINDINGS', label: 'Section II — Financial Statement Findings', order: 2, contentType: 'auto_generated', autoGeneratedFrom: 'findings', isRequired: true },
        { code: 'SECTION_III_FEDERAL_AWARD_FINDINGS', label: 'Section III — Federal Award Findings and Questioned Costs', order: 3, contentType: 'auto_generated', autoGeneratedFrom: 'findings', isRequired: true },
      ],
      distribution: {
        public: true,
        federalAwardingAgencies: true,
        passThroughEntities: true,
        fedearalAuditClearinghouse: true,
      },
    },
    {
      code: 'SEFA',
      label: 'Schedule of Expenditures of Federal Awards',
      description: 'Schedule listing federal expenditures by program (ALN), pass-through identifier, and amount. Required by 2 CFR 200.510(b).',
      referenceSection: '2 CFR 200.510(b)',
      orientation: 'landscape',
      sections: [
        { code: 'SEFA_BODY', label: 'Expenditures by Program', order: 1, contentType: 'auto_generated', autoGeneratedFrom: 'sefa_data', isRequired: true },
        { code: 'SEFA_NOTES', label: 'Notes to the Schedule', order: 2, contentType: 'rich_text', isRequired: true },
      ],
      distribution: {
        public: true,
        federalAwardingAgencies: true,
        fedearalAuditClearinghouse: true,
      },
    },
    {
      code: 'SUMMARY_SCHEDULE_PRIOR_FINDINGS',
      label: 'Summary Schedule of Prior Audit Findings',
      description: 'Prior-year findings with current status (fully corrected, partially corrected, not corrected, no longer valid). Required by 2 CFR 200.511(b).',
      referenceSection: '2 CFR 200.511(b)',
      orientation: 'portrait',
      sections: [
        { code: 'PRIOR_FINDINGS_TABLE', label: 'Prior Year Findings', order: 1, contentType: 'auto_generated', autoGeneratedFrom: 'prior_findings', isRequired: true },
      ],
      distribution: {
        public: true,
        federalAwardingAgencies: true,
        fedearalAuditClearinghouse: true,
      },
    },
    {
      code: 'CORRECTIVE_ACTION_PLAN',
      label: 'Corrective Action Plan',
      description: 'Auditee-prepared plan addressing each finding with name of responsible party, planned corrective action, and anticipated completion date. Required by 2 CFR 200.511(c).',
      referenceSection: '2 CFR 200.511(c)',
      orientation: 'portrait',
      sections: [
        { code: 'CAP_HEADER', label: 'Auditee Statement', order: 1, contentType: 'rich_text', isRequired: true },
        { code: 'CAP_ENTRIES', label: 'Corrective Actions', order: 2, contentType: 'auto_generated', autoGeneratedFrom: 'corrective_actions', isRequired: true },
      ],
      distribution: {
        public: true,
        federalAwardingAgencies: true,
        fedearalAuditClearinghouse: true,
      },
    },
  ],

  // ==========================================================================
  // RULE OVERRIDES
  // Feeds strictness resolver. 2 CFR 200.517 requires record retention for
  // three years from submission of the audit report (can be longer for
  // ongoing litigation / claims); this doesn't supersede GAGAS's typical
  // 5-7 year retention — the max wins.
  // ==========================================================================
  ruleOverrides: {
    documentationRetentionYears: 3,  // 2 CFR 200.517 minimum
    // GAGAS typically requires 5+ years; that will win via max() in resolver.
  },

  // ==========================================================================
  // CROSSWALKS
  // ==========================================================================
  crosswalks: [
    {
      thisSection: '2 CFR 200.514',
      thisDescription: 'Audit must be conducted in accordance with GAGAS',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: 'Chapter 1',
      mappedDescription: 'Application of GAGAS',
      mappingType: 'related',
      notes: 'Single Audit is GAGAS-required by statute (31 USC 7502(e)). Overlay cannot be applied without GAGAS as host methodology.',
      confidence: 'authoritative',
    },
    {
      thisSection: '2 CFR 200.516',
      thisDescription: 'Audit findings — content requirements',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§6.39',
      mappedDescription: 'Four elements of a finding (Criteria, Condition, Cause, Effect)',
      mappingType: 'this_stricter',
      notes: 'Single Audit findings include GAGAS four elements PLUS questioned costs, ALN, compliance requirement, and repeat indicator. Superset relationship.',
      confidence: 'authoritative',
    },
    {
      thisSection: '2 CFR 200.515(d)',
      thisDescription: 'Schedule of findings and questioned costs',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§6.02',
      mappedDescription: 'Report content',
      mappingType: 'this_stricter',
      notes: 'Single Audit report = GAGAS report + additional schedules. A finding may appear in both the GAGAS Yellow Book report and the Single Audit Schedule of Findings (cross-listed).',
      confidence: 'authoritative',
    },
  ],

  // ==========================================================================
  // DEPENDENCIES
  // Single Audit REQUIRES GAGAS as the host methodology — this is statutory,
  // not optional.
  // ==========================================================================
  dependencies: [
    {
      standardRef: 'GAGAS:2024',
      type: 'requires',
      scope: { engagementTypes: ['SINGLE_AUDIT'] },
      description: 'Single Audit is required to be conducted in accordance with GAGAS by 31 USC 7502(e) and 2 CFR 200.514(a). The Single Audit overlay cannot be attached to an engagement without GAGAS as the primary methodology.',
      referenceSection: '2 CFR 200.514(a)',
    },
    {
      standardRef: 'AICPA_AUC:CURRENT',
      type: 'incorporates',
      scope: {},
      description: 'Single Audit also requires GAAS via GAGAS\'s incorporation of AICPA AU-C. Transitive dependency.',
      referenceSection: '2 CFR 200.514(a)',
    },
  ],

  // ==========================================================================
  // APPLICABILITY
  // Single Audit is triggered by the $1M federal expenditures threshold.
  // ==========================================================================
  applicability: {
    mandatoryFor: [
      {
        description: 'Non-federal entities expending $1M or more in federal awards in the fiscal year (threshold applicable for FY ending Sep 30, 2025 and after)',
        sectors: ['US_STATE_LOCAL_GOVERNMENT', 'NONPROFIT', 'EDUCATION'],
        jurisdictions: ['US'],
        entityConditions: ['federal_expenditures_gte_1M_usd'],
      },
    ],
    notApplicableFor: [
      {
        description: 'Federal agencies (subject to financial statement audit via other authority)',
        sectors: ['US_FEDERAL_GOVERNMENT'],
      },
      {
        description: 'Commercial for-profit entities (generally exempt; contract-specific audit requirements may apply)',
        sectors: ['PUBLIC_COMPANY', 'PRIVATE_COMPANY'],
      },
    ],
    thresholds: [
      {
        description: 'Single Audit threshold — federal expenditures in fiscal year',
        triggerAtOrAbove: 1000000,
        currency: 'USD',
        supersededOn: '2025-09-30',  // threshold changed from $750k effective FY ending after this date
      },
    ],
  },

  // ==========================================================================
  // NOTE ON OMITTED FIELDS
  // Single Audit is a regulatory_overlay; it does NOT define its own:
  //   - engagementTypes     (host methodology defines — GAGAS has SINGLE_AUDIT type)
  //   - phases              (host methodology provides)
  //   - findingElements     (4 GAGAS elements used; additionalFindingElements adds overlay-specific)
  //   - findingClassifications (host methodology scheme used; overlay may add custom later)
  //   - checklists          (host methodology provides; see SINGLE_AUDIT_CHECKLIST in GAGAS pack)
  //   - independenceRules   (host methodology — GAGAS is stricter than Uniform Guidance)
  //   - cpeRules            (host methodology)
  //   - workflows           (host methodology; see SINGLE_AUDIT_APPROVAL in GAGAS pack)
  //   - reportDefinitions   (additionalReports carries the overlay-specific ones)
  //   - templates           (host methodology provides; overlay may add later)
  //   - riskRatings         (host methodology)
  //   - evidenceRules       (host methodology)
  // These fields are optional on StandardPack per schema v1.1.0; the validator
  // enforces packType-specific requirements via VALIDATION.md Layer 5.
  // ==========================================================================
};
