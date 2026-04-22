/**
 * ISO 19011:2018 Standard Pack (Minimal)
 *
 * Guidelines for Auditing Management Systems
 *
 * Verified facts:
 * - ISO 19011:2018 replaced 2011 edition
 * - Applies to first, second, and third-party audits of any management system
 * - 7 principles, 7 clauses
 * - Guidance standard (not itself certifiable)
 * - Used alongside specific MS standards (ISO 9001, 14001, 27001, 45001, etc.)
 *
 * This minimal pack demonstrates the schema works for a fundamentally different
 * audit approach (management system conformity vs government financial/performance).
 *
 * Source: ISO/IEC 19011:2018
 */

import type { StandardPack } from '../standard-pack-schema';

export const iso190112018: StandardPack = {
  code: 'ISO_19011',
  version: '2018',
  schemaVersion: '1.1.0',
  packType: 'methodology',

  meta: {
    name: 'Guidelines for Auditing Management Systems',
    commonName: 'ISO 19011',
    issuingBody: {
      name: 'International Organization for Standardization',
      abbreviation: 'ISO',
      country: 'CH',
      url: 'https://www.iso.org',
    },
    referenceUrl: 'https://www.iso.org/standard/70017.html',
    publishedYear: 2018,
    effectiveFrom: '2018-07-01',
    earlyAdoptionAllowed: true,
    previousVersion: 'ISO_19011:2011',
    description:
      'Universal guidance for auditing management systems. Applies to internal (1st party), supplier (2nd party), and certification (3rd party) audits of any ISO management system (9001, 14001, 27001, 45001, 22301, etc.). Not itself certifiable.',
    primarySectors: ['ALL_SECTORS'],
    jurisdictions: ['GLOBAL'],
    tags: ['iso', 'management-system', 'certification', 'conformity'],
  },

  status: 'EFFECTIVE',

  terminology: {
    auditor: { label: 'Auditor', plural: 'Auditors' },
    leadAuditor: {
      label: 'Audit Team Leader',
      aliases: ['Lead Auditor'],
    },
    headOfFunction: {
      label: 'Audit Programme Manager',
      helpText: 'Responsible for audit programme management (Clause 5).',
    },
    supervisor: { label: 'Audit Programme Manager' },
    qaReviewer: {
      label: 'Witness Assessor',
      helpText: 'Observes audits for certification body quality assurance.',
    },
    auditee: { label: 'Auditee', plural: 'Auditees' },
    engagement: { label: 'Audit', plural: 'Audits' },
    finding: {
      label: 'Audit Finding',
      plural: 'Audit Findings',
      helpText:
        'Classified as Conformity, Nonconformity (Major/Minor), Observation, or Opportunity for Improvement.',
    },
    recommendation: {
      label: 'Corrective Action Request',
      shortLabel: 'CAR',
    },
    workpaper: {
      label: 'Audit Evidence Record',
      aliases: ['Working Paper', 'Audit Record'],
    },
    correctiveAction: {
      label: 'Corrective Action Plan',
      shortLabel: 'CAP',
    },
    fieldwork: { label: 'Conducting the Audit' },
    planning: { label: 'Audit Preparation' },
    reporting: { label: 'Audit Reporting' },
    followUp: { label: 'Audit Follow-Up' },
    planningMemo: { label: 'Audit Plan' },
    workProgram: { label: 'Audit Checklist' },
    auditReport: { label: 'Audit Report' },
    independence: { label: 'Impartiality' },
    qaChecklist: { label: 'Audit Programme Review' },
    managementResponse: { label: 'Corrective Action Plan' },
  },

  engagementTypes: [
    {
      code: 'FIRST_PARTY',
      label: 'First-Party (Internal) Audit',
      description: 'Organization auditing its own management system.',
      referenceSection: 'Clause 3',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING', 'FOLLOW_UP'],
      defaultWorkflowCode: 'INTERNAL_AUDIT_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN', 'AUDIT_CHECKLIST'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
    {
      code: 'SECOND_PARTY',
      label: 'Second-Party (Supplier) Audit',
      description: 'Customer auditing supplier/external organization.',
      referenceSection: 'Clause 3',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING', 'FOLLOW_UP'],
      defaultWorkflowCode: 'SUPPLIER_AUDIT_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN', 'AUDIT_CHECKLIST'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
    {
      code: 'THIRD_PARTY_STAGE_1',
      label: 'Third-Party Certification — Stage 1 (Readiness)',
      description: 'Documentation and readiness review before certification audit.',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING'],
      defaultWorkflowCode: 'CERTIFICATION_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
    {
      code: 'THIRD_PARTY_STAGE_2',
      label: 'Third-Party Certification — Stage 2 (Certification)',
      description: 'Full certification audit. Leads to initial certification decision.',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING'],
      defaultWorkflowCode: 'CERTIFICATION_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN', 'AUDIT_CHECKLIST'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
    {
      code: 'SURVEILLANCE',
      label: 'Surveillance Audit',
      description: 'Annual partial-scope audit after certification. Covers ~1/3 of MS each year.',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING'],
      defaultWorkflowCode: 'CERTIFICATION_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN', 'AUDIT_CHECKLIST'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
    {
      code: 'RECERTIFICATION',
      label: 'Recertification Audit',
      description: 'Every 3 years. Full-scope audit renewing certification.',
      applicablePhases: ['INITIATION', 'PREPARATION', 'OPENING', 'EVIDENCE', 'CLOSING', 'REPORTING'],
      defaultWorkflowCode: 'CERTIFICATION_APPROVAL',
      requiredTemplates: ['AUDIT_PLAN', 'AUDIT_CHECKLIST'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
  ],

  phases: [
    { code: 'INITIATION', label: 'Audit Initiation', order: 1, description: 'Receive audit request, confirm scope.', exitCriteria: [{ code: 'SCOPE_CONFIRMED', description: 'Audit scope confirmed', validationType: 'manual_checkbox' }], isOptional: false },
    { code: 'PREPARATION', label: 'Audit Preparation', order: 2, description: 'Review prior reports, develop plan.', exitCriteria: [{ code: 'PLAN_DRAFTED', description: 'Audit plan drafted', validationType: 'document_present' }], isOptional: false },
    { code: 'OPENING', label: 'Opening Meeting', order: 3, description: 'Introduce team, confirm scope, establish protocols.', exitCriteria: [{ code: 'MEETING_HELD', description: 'Opening meeting completed', validationType: 'manual_checkbox' }], isOptional: false },
    { code: 'EVIDENCE', label: 'Collecting Evidence', order: 4, description: 'Interviews, observation, document review, testing.', exitCriteria: [{ code: 'EVIDENCE_SUFFICIENT', description: 'Sufficient evidence collected', validationType: 'manual_checkbox' }], isOptional: false },
    { code: 'CLOSING', label: 'Closing Meeting', order: 5, description: 'Present findings to auditee.', exitCriteria: [{ code: 'CLOSING_HELD', description: 'Closing meeting completed', validationType: 'manual_checkbox' }], isOptional: false },
    { code: 'REPORTING', label: 'Audit Reporting', order: 6, description: 'Issue formal audit report.', exitCriteria: [{ code: 'REPORT_ISSUED', description: 'Audit report issued', validationType: 'document_present' }], isOptional: false },
    { code: 'FOLLOW_UP', label: 'Follow-Up', order: 7, description: 'Verify corrective action closure.', exitCriteria: [{ code: 'CAPS_CLOSED', description: 'CAPs verified', validationType: 'automated_rule' }], isOptional: true },
  ],

  // ==========================================================================
  // FINDING ELEMENTS — ISO 19011 uses 3 core elements
  // ==========================================================================
  findingElements: [
    {
      code: 'AUDIT_CRITERIA',
      label: 'Audit Criteria',
      description: 'The requirement (standard clause, procedure, contract) being audited against.',
      helpText: 'Reference the specific requirement, including standard clause number and text.',
      example: '"ISO 9001:2015 Clause 8.4.1: The organization shall ensure that externally provided processes, products and services conform to requirements."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Clause 6.4',
      order: 1,
    },
    {
      code: 'NONCONFORMITY_EVIDENCE',
      label: 'Evidence / Condition',
      description: 'Objective, verifiable evidence of nonconformity (or conformity).',
      helpText: 'Be specific and factual — what was seen, heard, reviewed. Include sample sizes, dates, locations.',
      example: '"Review of approved supplier list dated 2025-01-15 showed 12 active suppliers. No evaluation records found for suppliers BETA or DELTA since onboarding Q1 2024."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Clause 6.4',
      order: 2,
    },
    {
      code: 'ROOT_CAUSE',
      label: 'Root Cause (for Majors)',
      description: 'Root cause of nonconformity — required for Major NCs, expected for Minor NCs.',
      helpText: 'Use 5 Whys, Fishbone, or similar technique to identify underlying cause. Not a restatement of the evidence.',
      isRequired: false, // Required only for majors
      fieldType: 'richtext',
      order: 3,
    },
  ],

  // ==========================================================================
  // FINDING CLASSIFICATIONS — Conformity + Nonconformity levels + Observation/OFI
  // ==========================================================================
  findingClassifications: [
    {
      code: 'ISO_FINDING_TYPE',
      label: 'Finding Classification',
      description: 'ISO 19011 finding types including positive conformity.',
      levels: [
        {
          code: 'MAJOR_NC',
          label: 'Major Nonconformity',
          shortLabel: 'Major NC',
          description:
            'Absence of required process, systemic failure, breakdown casting doubt on MS capability, or legal/safety risk.',
          color: '#DC2626',
          severity: 4,
          requiresEscalation: true,
        },
        {
          code: 'MINOR_NC',
          label: 'Minor Nonconformity',
          shortLabel: 'Minor NC',
          description: 'Isolated lapse; limited impact on MS effectiveness.',
          color: '#EA580C',
          severity: 3,
          requiresEscalation: false,
        },
        {
          code: 'OBSERVATION',
          label: 'Observation',
          description: 'Not a nonconformity, but could become one if not addressed.',
          color: '#D97706',
          severity: 2,
          requiresEscalation: false,
        },
        {
          code: 'OFI',
          label: 'Opportunity for Improvement',
          shortLabel: 'OFI',
          description: 'Suggestion for enhanced performance.',
          color: '#2563EB',
          severity: 1,
          requiresEscalation: false,
        },
        {
          code: 'CONFORMITY',
          label: 'Conformity',
          description: 'Positive finding — evidence that requirement is met.',
          color: '#10B981',
          severity: 0,
          requiresEscalation: false,
        },
      ],
      isRequired: true,
      allowsReclassification: true,
    },
  ],

  checklists: [
    {
      code: 'AUDITOR_COMPETENCE',
      label: 'Auditor Competence Evaluation',
      category: 'QUALITY_ASSURANCE',
      description: 'Evaluate auditor competence per Clause 7.',
      referenceSection: 'Clause 7',
      sections: [
        {
          code: 'PERSONAL_ATTRIBUTES',
          title: 'Personal Attributes (Clause 7.2.2)',
          order: 1,
          items: [
            { code: 'ATT_001', text: 'Demonstrates ethical behavior and integrity', isRequired: true, responseType: 'rating_1_5', order: 1 },
            { code: 'ATT_002', text: 'Fair-minded and impartial', isRequired: true, responseType: 'rating_1_5', order: 2 },
            { code: 'ATT_003', text: 'Attention to detail', isRequired: true, responseType: 'rating_1_5', order: 3 },
          ],
        },
        {
          code: 'KNOWLEDGE_SKILLS',
          title: 'Knowledge and Skills (Clause 7.2.3)',
          order: 2,
          items: [
            { code: 'KS_001', text: 'ISO 19011 principles and practices', isRequired: true, responseType: 'yes_no_na', order: 1 },
            { code: 'KS_002', text: 'Specific MS standard being audited (9001/14001/27001/etc.)', isRequired: true, responseType: 'yes_no_na', order: 2 },
            { code: 'KS_003', text: 'Industry/organizational processes', isRequired: true, responseType: 'yes_no_na', order: 3 },
          ],
        },
      ],
      assigneeRole: 'AUDIT_PROGRAMME_MANAGER',
      completionPoint: 'once', // Periodic reassessment every 2-3 years
      isRequired: true,
      passingCriteria: 'Lead Auditor minimum: 40 audit-hours experience, recognized lead auditor course, current competence',
    },
  ],

  independenceRules: {
    referenceSection: 'Clause 4 (Principle 5 — Independence)',
    declarationFrequency: 'per_engagement',
    coolingOffPeriodMonths: 0, // ISO uses "don't audit own work" principle rather than time-based cooling
    threatTypes: [
      {
        code: 'IMPARTIALITY',
        label: 'Impartiality Threat',
        description: 'Relationships or interests that could impair impartiality.',
        examples: ['Prior work in area audited', 'Personal relationship', 'Financial interest', 'Consulting for auditee'],
      },
    ],
    declarationForm: {
      sections: [
        {
          code: 'IMPARTIALITY',
          label: 'Impartiality Declaration',
          questions: [
            {
              code: 'I1',
              text: 'Have you consulted for or worked on the specific processes being audited?',
              responseType: 'yes_no',
              followUpIfYes: true,
            },
            {
              code: 'I2',
              text: 'Do you have any conflicts that could impair your impartiality?',
              responseType: 'yes_no',
              followUpIfYes: true,
            },
          ],
        },
      ],
    },
    nonAuditServicesEvaluation: false,
    safeguardsFramework: false, // More prescriptive: just don't audit own work
  },

  cpeRules: {
    hoursRequired: 40,
    cycleType: 'triennial',
    annualMinimum: 10,
    acceptedActivityTypes: [
      'Formal training courses',
      'Conferences',
      'Lead auditor recertification courses',
      'Audit experience (as auditor)',
    ],
    referenceSection: 'Clause 7 / IRCA scheme',
  },

  workflows: [
    {
      code: 'INTERNAL_AUDIT_APPROVAL',
      label: 'Internal Audit Report Approval',
      entityType: 'report',
      description: 'Internal (first-party) audit report approval.',
      steps: [
        {
          order: 1,
          label: 'Audit Team Leader Review',
          requiredRole: 'LEAD_AUDITOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'request_changes'],
        },
        {
          order: 2,
          label: 'Audit Programme Manager Approval',
          requiredRole: 'AUDIT_PROGRAMME_MANAGER',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'reject'],
        },
      ],
      visibleToAuditee: true,
    },
    {
      code: 'SUPPLIER_AUDIT_APPROVAL',
      label: 'Supplier Audit Approval',
      entityType: 'report',
      description: 'Second-party supplier audit approval.',
      steps: [
        {
          order: 1,
          label: 'Audit Team Leader Review',
          requiredRole: 'LEAD_AUDITOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'request_changes'],
        },
      ],
      visibleToAuditee: true,
    },
    {
      code: 'CERTIFICATION_APPROVAL',
      label: 'Certification Audit Approval',
      entityType: 'report',
      description: 'Third-party certification body audit approval. Decision-maker must be separate from auditor (per 17021-1 Clause 9.5.2).',
      steps: [
        {
          order: 1,
          label: 'Audit Team Leader Report',
          requiredRole: 'LEAD_AUDITOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'request_changes'],
        },
        {
          order: 2,
          label: 'Certification Decision',
          requiredRole: 'CERTIFICATION_DECISION_MAKER',
          description: 'Must be separate from the audit team per ISO/IEC 17021-1 Clause 9.5.2',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
      ],
      visibleToAuditee: true,
    },
  ],

  reportDefinitions: [
    {
      code: 'AUDIT_REPORT',
      label: 'Audit Report',
      description: 'ISO 19011 audit report per Clause 6.5.',
      sections: [
        { code: 'SCOPE', label: 'Audit Scope', order: 1, description: 'Scope, objectives, criteria', isRequired: true, contentType: 'rich_text', referenceSection: 'Clause 6.5' },
        { code: 'TEAM', label: 'Audit Team', order: 2, description: 'Auditors and auditee participants', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'team' },
        { code: 'SAMPLING', label: 'Sampling Approach', order: 3, description: 'Sampling methodology used', isRequired: false, contentType: 'rich_text' },
        { code: 'CONFORMITIES', label: 'Conformities', order: 4, description: 'Positive findings (clauses conforming)', isRequired: false, contentType: 'auto_generated' },
        { code: 'NONCONFORMITIES', label: 'Nonconformities', order: 5, description: 'Major and Minor NCs with evidence', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'findings' },
        { code: 'OBSERVATIONS_OFIS', label: 'Observations and OFIs', order: 6, description: 'Opportunities for improvement', isRequired: false, contentType: 'auto_generated' },
        { code: 'CONCLUSION', label: 'Overall Conclusion', order: 7, description: 'MS effectiveness conclusion', isRequired: true, contentType: 'rich_text' },
        { code: 'CERTIFICATION_RECOMMENDATION', label: 'Certification Recommendation (3rd party)', order: 8, description: 'Recommend grant/continue/suspend/withdraw', isRequired: false, contentType: 'rich_text', renderCondition: 'engagement.type in [THIRD_PARTY_STAGE_1, THIRD_PARTY_STAGE_2, SURVEILLANCE, RECERTIFICATION]' },
      ],
      defaultFormat: 'pdf',
      requiredForEngagementTypes: ['FIRST_PARTY', 'SECOND_PARTY', 'THIRD_PARTY_STAGE_1', 'THIRD_PARTY_STAGE_2', 'SURVEILLANCE', 'RECERTIFICATION'],
      referenceSection: 'Clause 6.5',
      distribution: {
        required: ['AUDITEE', 'AUDIT_PROGRAMME_MANAGER'],
        publicDistribution: false,
        confidentialityLevel: 'restricted',
      },
    },
  ],

  templates: [
    {
      code: 'AUDIT_PLAN',
      label: 'Audit Plan',
      category: 'planning',
      description: 'Audit plan per Clause 6.3.',
      referenceSection: 'Clause 6.3',
      sections: [
        { code: 'OBJECTIVES', label: 'Audit Objectives', order: 1, description: 'Objectives of the audit', isRequired: true, fieldType: 'richtext' },
        { code: 'SCOPE', label: 'Audit Scope', order: 2, description: 'Areas, processes, sites, time period', isRequired: true, fieldType: 'richtext' },
        { code: 'CRITERIA', label: 'Audit Criteria', order: 3, description: 'Standards against which auditing', isRequired: true, fieldType: 'text' },
        { code: 'SCHEDULE', label: 'Audit Schedule', order: 4, description: 'Dates, times, activities', isRequired: true, fieldType: 'table' },
        { code: 'TEAM', label: 'Audit Team', order: 5, description: 'Team composition and roles', isRequired: true, fieldType: 'table' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'AUDIT_CHECKLIST',
      label: 'Audit Checklist',
      category: 'fieldwork',
      description: 'Checklist of items to audit against the MS standard.',
      sections: [
        { code: 'ITEMS', label: 'Checklist Items', order: 1, description: 'Clause-by-clause audit items', isRequired: true, fieldType: 'checklist' },
      ],
      isRequired: false,
      tenantCustomizable: true,
    },
  ],

  // ISO 19011's 3-category finding model (Nonconformity / Observation / OFI)
  // maps to the canonical semantic slots as follows. Note that ISO 19011 is
  // the methodology; what's audited against is a separate control framework
  // pack (e.g., ISO 27001:2022) — see references/multi-standard-design.md §3.
  semanticElementMappings: [
    {
      semanticCode: 'CRITERIA',
      packElementCode: 'AUDIT_CRITERIA',
      equivalenceStrength: 'close',
      notes: 'ISO 19011 Cl. 6.4 narrows "criteria" to a specific clause of the audited management system standard (e.g., ISO 9001 Cl. 8.4.1). GAGAS Criteria is broader (laws, regulations, best practice); IIA Criteria sits between the two.',
    },
    {
      semanticCode: 'CONDITION',
      packElementCode: 'NONCONFORMITY_EVIDENCE',
      equivalenceStrength: 'close',
      notes: 'ISO 19011 Cl. 6.4.7 "Objective Evidence" fills the Condition slot. ISO emphasizes verifiability; GAGAS/IIA emphasize sufficiency. Same conceptual role.',
    },
    {
      semanticCode: 'CAUSE',
      packElementCode: 'ROOT_CAUSE',
      equivalenceStrength: 'close',
      notes: 'ISO 19011 Cl. 6.4.8 — required for Major NC, optional for Minor NC, informative for OFI. Semantic match to GAGAS §6.39c / IIA ROOT_CAUSE.',
    },
    {
      semanticCode: 'NC_CLAUSE',
      packElementCode: 'AUDIT_CRITERIA',
      equivalenceStrength: 'exact',
      notes: 'ISO 19011 requires citing the specific clause of the audited standard that is violated. This is an ISO-specific semantic slot (NC_CLAUSE) distinct from CRITERIA in classical methodology packs.',
    },
    // Note: ISO 19011 has no "EFFECT" equivalent as a required element.
    // Risk/impact is implied but not mandatory per Cl. 6.4. Consumers that
    // need EFFECT populated (e.g., for multi-standard engagements including
    // GAGAS or IIA) should populate it during finding authoring.
    //
    // Note: ISO does not issue auditor recommendations in the GAGAS/IIA
    // sense. "Opportunities for Improvement" (OFIs) are modeled as a
    // separate finding TYPE via the ISO_FINDING_TYPE classification, not
    // as a RECOMMENDATION semantic slot. Corrective action requests are
    // auditee-owned; we model them through the Recommendation entity with
    // appropriate terminology override.
  ],

  crosswalks: [
    {
      thisSection: 'Clause 6.4 (Nonconformity)',
      thisDescription: 'Major/Minor Nonconformity classification',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§6.41-6.44',
      mappedDescription: 'Material Weakness / Significant Deficiency / Deficiency',
      mappingType: 'related',
      notes: 'Different approaches: ISO focuses on MS conformity; GAGAS focuses on control effectiveness over financial reporting.',
      confidence: 'curated',
    },
    {
      thisSection: 'Clause 4 (Principle 5 — Independence)',
      thisDescription: "Auditor independence (don't audit own work)",
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§3.02-3.108',
      mappedDescription: 'Comprehensive independence framework',
      mappingType: 'mapped_stricter',
      notes: 'GAGAS has much stricter, comprehensive independence framework with conceptual framework, threats, and safeguards.',
      confidence: 'curated',
    },
  ],

  dependencies: [
    {
      standardRef: 'ISO_IEC_17021:2015',
      type: 'references',
      scope: {
        engagementTypes: ['THIRD_PARTY_STAGE_1', 'THIRD_PARTY_STAGE_2', 'SURVEILLANCE', 'RECERTIFICATION'],
      },
      description:
        'For third-party certification audits, certification bodies must also comply with ISO/IEC 17021-1 (Requirements for Certification Bodies).',
    },
  ],

  applicability: {
    mandatoryFor: [
      {
        description: 'Internal audits under any ISO management system standard',
        sectors: ['ALL_SECTORS'],
        jurisdictions: ['GLOBAL'],
      },
    ],
    recommendedFor: [
      {
        description: 'All management system audits regardless of standard',
        sectors: ['ALL_SECTORS'],
        jurisdictions: ['GLOBAL'],
      },
    ],
  },

  riskRatings: {
    levels: [
      { code: 'MAJOR', label: 'Major', color: '#DC2626', description: 'Significant MS impact', severity: 3 },
      { code: 'MINOR', label: 'Minor', color: '#EA580C', description: 'Limited MS impact', severity: 2 },
      { code: 'NONE', label: 'No Risk', color: '#10B981', description: 'Conformance', severity: 0 },
    ],
    allowUnrated: true,
    requiresJustification: false,
  },

  evidenceRules: {
    referenceSection: 'Clause 6.4 / Annex B.14',
    sufficiencyCriteria: 'Sufficient information to achieve audit objectives and conclusions.',
    appropriatenessCriteria: 'Evidence must be verifiable, documented, relevant, sufficient, objective.',
    reliabilityHierarchy: [
      { order: 1, type: 'records_documentation', description: 'Records, procedures, policies, system reports', reliability: 'medium_high' },
      { order: 2, type: 'direct_observation', description: 'Direct auditor observation during walkthroughs', reliability: 'high' },
      { order: 3, type: 'measurements_testing', description: 'Measurements, metrics, testing results', reliability: 'medium_high' },
      { order: 4, type: 'third_party_external', description: 'Customer feedback, regulatory reports', reliability: 'medium' },
      { order: 5, type: 'personnel_statements', description: 'Interview testimony', reliability: 'lower' },
    ],
    retentionPeriodYears: 3,
    experiencedAuditorStandard: false,
    chainOfCustodyRequired: false,
  },
};
