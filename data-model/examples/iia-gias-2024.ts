/**
 * IIA GIAS 2024 Standard Pack
 *
 * Global Internal Audit Standards — 2024
 * Issued by The Institute of Internal Auditors (IIA)
 *
 * Verified facts:
 * - Released January 9, 2024
 * - Effective January 9, 2025
 * - 5 Domains, 15 Principles, 52 Standards (120-page document)
 * - Replaced the 2017 IPPF
 * - 2017 IPPF remained valid during one-year transition period (ended Jan 9, 2025)
 * - Each standard has 4-part structure: Requirements, Considerations for
 *   Implementation, Examples of Evidence of Conformance, Topical Requirements
 *
 * Standard numbering uses Domain.Principle.Sequence format
 * (e.g., Standard 9.1 = Domain V, Principle 9, sub-standard 1)
 *
 * Source: https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/
 */

import type { StandardPack } from '../standard-pack-schema';

export const iiaGias2024: StandardPack = {
  code: 'IIA_GIAS',
  version: '2024',
  schemaVersion: '1.1.0',
  packType: 'methodology',

  meta: {
    name: 'Global Internal Audit Standards',
    commonName: 'GIAS',
    issuingBody: {
      name: 'The Institute of Internal Auditors',
      abbreviation: 'IIA',
      country: 'US',
      url: 'https://www.theiia.org',
    },
    referenceUrl: 'https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/',
    publishedYear: 2024,
    effectiveFrom: '2025-01-09',
    earlyAdoptionAllowed: true,
    previousVersion: 'IIA_IPPF:2017',
    transitionDeadline: '2025-01-09',
    description:
      'Professional standards for internal audit functions globally. Replaces the 2017 IPPF. Organized into 5 Domains, 15 Principles, 52 Standards. Each standard includes Requirements, Considerations for Implementation, Examples of Evidence of Conformance, and (where applicable) Topical Requirements.',
    primarySectors: ['ALL_SECTORS'],
    jurisdictions: ['GLOBAL'],
    tags: ['internal-audit', 'global', 'professional-standards', 'CIA'],
  },

  status: 'EFFECTIVE',

  terminology: {
    auditor: { label: 'Internal Auditor', plural: 'Internal Auditors' },
    leadAuditor: {
      label: 'Engagement Supervisor',
      helpText: 'Senior auditor leading a specific engagement.',
    },
    headOfFunction: {
      label: 'Chief Audit Executive',
      shortLabel: 'CAE',
      helpText: 'Senior leader of internal audit; reports functionally to Board.',
    },
    supervisor: { label: 'Engagement Supervisor' },
    qaReviewer: {
      label: 'QAIP Reviewer',
      helpText: 'Reviewer for Quality Assurance and Improvement Program.',
    },
    auditee: {
      label: 'Engagement Client',
      plural: 'Engagement Clients',
      helpText: 'The area, function, or unit being audited.',
    },
    engagement: {
      label: 'Internal Audit Engagement',
      shortLabel: 'Engagement',
      plural: 'Internal Audit Engagements',
    },
    finding: {
      label: 'Observation',
      plural: 'Observations',
      aliases: ['Finding'],
      helpText: 'An issue identified during the engagement. IIA uses both "Observation" and "Finding".',
    },
    recommendation: { label: 'Recommendation', plural: 'Recommendations' },
    workpaper: {
      label: 'Working Paper',
      plural: 'Working Papers',
      aliases: ['Workpaper', 'Documented Information'],
    },
    correctiveAction: {
      label: 'Management Action Plan',
      shortLabel: 'MAP',
    },
    fieldwork: { label: 'Engagement Work' },
    planning: { label: 'Engagement Planning' },
    reporting: { label: 'Communicating Results' },
    followUp: { label: 'Monitoring Action Plans' },
    planningMemo: { label: 'Engagement Plan' },
    auditCharter: { label: 'Internal Audit Charter' },
    workProgram: { label: 'Engagement Work Program' },
    auditReport: { label: 'Engagement Communication' },
    independence: { label: 'Independence and Objectivity' },
    qaChecklist: { label: 'QAIP Assessment' },
    managementResponse: { label: 'Management Response' },
    riskAcceptance: {
      label: 'Risk Acceptance',
      helpText: 'When management accepts risk without action. Per Domain V requirements.',
    },
  },

  engagementTypes: [
    {
      code: 'ASSURANCE',
      label: 'Assurance Engagement',
      description:
        'Independent evaluation of effectiveness of risk management, control, and governance. Fixed scope predefined by audit plan.',
      referenceSection: 'Domain V',
      applicablePhases: ['PLANNING', 'ENGAGEMENT_WORK', 'COMMUNICATING', 'MONITORING'],
      defaultWorkflowCode: 'ASSURANCE_REPORT_APPROVAL',
      requiredTemplates: ['ENGAGEMENT_PLAN', 'WORK_PROGRAM'],
      requiredChecklists: ['OBJECTIVITY_ASSESSMENT'],
      teamRequirements: {
        minMembers: 1,
        requiredRoles: ['ENGAGEMENT_SUPERVISOR'],
      },
      supportsMultiStandard: true,
      tags: ['assurance'],
    },
    {
      code: 'CONSULTING',
      label: 'Consulting Engagement',
      description:
        'Advisory services providing advice, recommendations, and subject matter expertise at management request. Flexible scope, client-driven.',
      referenceSection: 'Domain V',
      applicablePhases: ['PLANNING', 'ENGAGEMENT_WORK', 'COMMUNICATING'],
      defaultWorkflowCode: 'CONSULTING_REPORT_APPROVAL',
      requiredTemplates: ['ENGAGEMENT_PLAN'],
      requiredChecklists: ['OBJECTIVITY_ASSESSMENT'],
      supportsMultiStandard: true,
      tags: ['consulting', 'advisory'],
    },
    {
      code: 'COMBINED',
      label: 'Combined Assurance and Consulting',
      description: 'Hybrid engagement with both assurance and consulting elements.',
      applicablePhases: ['PLANNING', 'ENGAGEMENT_WORK', 'COMMUNICATING', 'MONITORING'],
      defaultWorkflowCode: 'ASSURANCE_REPORT_APPROVAL',
      requiredTemplates: ['ENGAGEMENT_PLAN', 'WORK_PROGRAM'],
      requiredChecklists: ['OBJECTIVITY_ASSESSMENT'],
      supportsMultiStandard: true,
    },
    {
      code: 'FOLLOW_UP',
      label: 'Follow-Up Engagement',
      description: 'Monitor implementation of prior audit action plans.',
      applicablePhases: ['PLANNING', 'ENGAGEMENT_WORK', 'COMMUNICATING'],
      defaultWorkflowCode: 'ASSURANCE_REPORT_APPROVAL',
      requiredTemplates: ['ENGAGEMENT_PLAN'],
      requiredChecklists: [],
      supportsMultiStandard: true,
    },
  ],

  phases: [
    {
      code: 'PLANNING',
      label: 'Engagement Planning',
      order: 1,
      description: 'Plan engagement per Principle 13.',
      exitCriteria: [
        {
          code: 'PLAN_APPROVED',
          description: 'Engagement plan approved',
          referenceSection: 'Principle 13',
          validationType: 'approval_complete',
        },
        {
          code: 'OBJECTIVITY_CONFIRMED',
          description: 'Team objectivity confirmed',
          referenceSection: 'Principle 2',
          validationType: 'document_present',
        },
      ],
      isOptional: false,
    },
    {
      code: 'ENGAGEMENT_WORK',
      label: 'Engagement Work',
      order: 2,
      description: 'Perform procedures, obtain evidence per Principle 14.',
      exitCriteria: [
        {
          code: 'EVIDENCE_SUFFICIENT',
          description: 'Sufficient reliable relevant information obtained',
          referenceSection: 'Standard 14.1',
          validationType: 'manual_checkbox',
        },
        {
          code: 'ROOT_CAUSES_ANALYZED',
          description: 'Root causes analyzed',
          referenceSection: 'Standard 14.2',
          validationType: 'manual_checkbox',
        },
        {
          code: 'SUPERVISION_DOCUMENTED',
          description: 'Supervision and review documented',
          referenceSection: 'Standard 14.4',
          validationType: 'approval_complete',
        },
      ],
      isOptional: false,
    },
    {
      code: 'COMMUNICATING',
      label: 'Communicating Results',
      order: 3,
      description: 'Communicate engagement results per Principle 15.',
      exitCriteria: [
        {
          code: 'RESULTS_COMMUNICATED',
          description: 'Results communicated to engagement client and Board',
          referenceSection: 'Standard 15.1',
          validationType: 'document_present',
        },
        {
          code: 'MGMT_ACTION_PLANS',
          description: 'Management action plans obtained',
          referenceSection: 'Standard 15.2',
          validationType: 'document_present',
        },
      ],
      isOptional: false,
    },
    {
      code: 'MONITORING',
      label: 'Monitoring Action Plans',
      order: 4,
      description: 'Monitor implementation per Standard 15.3.',
      exitCriteria: [
        {
          code: 'ACTIONS_TRACKED',
          description: 'Management action plans tracked to closure or risk acceptance',
          referenceSection: 'Standard 15.3',
          validationType: 'automated_rule',
        },
      ],
      isOptional: true,
    },
  ],

  // ==========================================================================
  // FINDING ELEMENTS — 5 elements (IIA differs from GAGAS by including Recommendation)
  // ==========================================================================
  findingElements: [
    {
      code: 'CRITERIA',
      label: 'Criteria',
      description: 'What should be — policy, regulation, best practice, contract requirement.',
      helpText: 'The standard against which the condition is measured.',
      example: '"Company policy requires all purchases over $50,000 to be competitively bid."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Standard 15.1',
      order: 1,
    },
    {
      code: 'CONDITION',
      label: 'Condition',
      description: 'What is — current state, factual observation with evidence.',
      helpText: 'Describe what you observed, with specific examples and data.',
      example: '"We reviewed 15 purchases over $50,000 in Q1 2025; 4 were not competitively bid."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Standard 15.1',
      order: 2,
    },
    {
      code: 'ROOT_CAUSE',
      label: 'Root Cause',
      description: 'Why the gap exists — the underlying reason, not just the symptom.',
      helpText: 'Understanding the WHY enables effective recommendations. May involve multiple factors.',
      example: '"Purchasing manager was unaware of the $50,000 threshold; no training was provided."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Standard 14.2',
      order: 3,
    },
    {
      code: 'CONSEQUENCE',
      label: 'Risk / Consequence',
      description: 'Impact — risk, loss potential, non-compliance, operational inefficiency.',
      helpText: 'Quantify if possible. Connect to business objectives.',
      example: '"Higher procurement costs; estimated $200K overage annually; compliance risk."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Standard 15.1',
      order: 4,
    },
    {
      code: 'RECOMMENDATION',
      label: 'Recommendation',
      description: 'How to address it — action-oriented, addressing root cause.',
      helpText:
        'Specific, actionable recommendation tied to the root cause. IIA includes recommendation as an inline element (unlike GAGAS).',
      example: '"Implement mandatory training and automated threshold alerts in the procurement system."',
      isRequired: true,
      fieldType: 'richtext',
      referenceSection: 'Standard 15.1',
      order: 5,
    },
  ],

  findingClassifications: [
    {
      code: 'IIA_SEVERITY',
      label: 'Finding Severity',
      description: 'IIA commonly uses Critical/Major/Minor severity classifications.',
      levels: [
        {
          code: 'CRITICAL',
          label: 'Critical',
          description: 'Immediate threat to organizational objectives.',
          color: '#DC2626',
          severity: 4,
          requiresEscalation: true,
        },
        {
          code: 'MAJOR',
          label: 'Major',
          description: 'Significant impact on objectives or compliance.',
          color: '#EA580C',
          severity: 3,
          requiresEscalation: true,
        },
        {
          code: 'MINOR',
          label: 'Minor',
          description: 'Limited impact; should be addressed.',
          color: '#D97706',
          severity: 2,
          requiresEscalation: false,
        },
        {
          code: 'ADVISORY',
          label: 'Advisory',
          description: 'Suggestion for improvement.',
          color: '#6B7280',
          severity: 1,
          requiresEscalation: false,
        },
      ],
      isRequired: true,
      allowsReclassification: true,
    },
  ],

  checklists: [
    {
      code: 'QAIP_ASSESSMENT',
      label: 'QAIP Assessment (Principle 12)',
      category: 'QAIP',
      description: 'Quality Assurance and Improvement Program assessment per Principle 12.',
      referenceSection: 'Principle 12 / Standards 12.1, 12.2, 12.3',
      sections: [
        {
          code: 'INTERNAL_ASSESSMENT',
          title: 'Internal Assessment (Standard 12.1)',
          description: 'Ongoing monitoring and periodic self-assessment',
          order: 1,
          items: [
            {
              code: 'QAIP_001',
              text: 'Is there ongoing monitoring integrated into engagements?',
              isRequired: true,
              responseType: 'conformance',
              referenceSection: 'Standard 12.1',
              order: 1,
            },
            {
              code: 'QAIP_002',
              text: 'Has a periodic self-assessment been performed?',
              isRequired: true,
              responseType: 'conformance',
              referenceSection: 'Standard 12.1',
              order: 2,
            },
          ],
        },
        {
          code: 'EXTERNAL_ASSESSMENT',
          title: 'External Assessment (Standard 12.2)',
          description: 'External assessment required at least every 5 years',
          order: 2,
          items: [
            {
              code: 'QAIP_010',
              text: 'Has an external quality assessment been performed in the past 5 years?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: 'Standard 12.2',
              order: 1,
            },
            {
              code: 'QAIP_011',
              text: 'Was the external assessor qualified (CIA + competence in QA)?',
              isRequired: true,
              responseType: 'yes_no',
              order: 2,
            },
          ],
        },
        {
          code: 'COMMUNICATION',
          title: 'Communicating QAIP Results (Standard 12.3)',
          order: 3,
          items: [
            {
              code: 'QAIP_020',
              text: 'Have QAIP results been communicated to senior management and Board?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: 'Standard 12.3',
              order: 1,
            },
          ],
        },
      ],
      assigneeRole: 'CHIEF_AUDIT_EXECUTIVE',
      completionPoint: 'annual',
      isRequired: true,
      passingCriteria: 'Generally Conforms rating on all principles',
    },
    {
      code: 'OBJECTIVITY_ASSESSMENT',
      label: 'Objectivity Assessment',
      category: 'INDEPENDENCE',
      description: 'Per Principle 2 — Maintain Objectivity.',
      referenceSection: 'Principle 2',
      sections: [
        {
          code: 'PERSONAL_OBJECTIVITY',
          title: 'Personal Objectivity',
          order: 1,
          items: [
            {
              code: 'OBJ_001',
              text: 'Have you held a position of direct responsibility in the area being audited in the past 12 months?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: 'Principle 2',
              order: 1,
            },
            {
              code: 'OBJ_002',
              text: 'Do you have any personal relationships that could impair objectivity?',
              isRequired: true,
              responseType: 'yes_no',
              order: 2,
            },
          ],
        },
      ],
      assigneeRole: 'TEAM_MEMBER',
      completionPoint: 'per_engagement',
      isRequired: true,
      passingCriteria: 'All questions answered; any "Yes" triggers impairment evaluation',
    },
  ],

  independenceRules: {
    referenceSection: 'Principles 1, 2, 7, 8',
    declarationFrequency: 'per_engagement',
    coolingOffPeriodMonths: 12, // IIA standard cooling-off
    threatTypes: [
      {
        code: 'PERSONAL',
        label: 'Personal Objectivity Impairment',
        description: 'Personal relationships or interests affecting impartiality.',
        examples: ['Prior role in area', 'Close personal relationships', 'Financial interest'],
      },
      {
        code: 'ORGANIZATIONAL',
        label: 'Organizational Independence Impairment',
        description: 'CAE reporting structure or interference with audit activities.',
        examples: ['CAE reports to auditee', 'Interference with scope', 'Restricted access'],
      },
    ],
    declarationForm: {
      sections: [
        {
          code: 'OBJECTIVITY',
          label: 'Individual Objectivity',
          questions: [
            {
              code: 'O1',
              text: 'Have you worked in the area being audited in the past 12 months?',
              responseType: 'yes_no',
              followUpIfYes: true,
            },
            {
              code: 'O2',
              text: 'Do you have any personal, financial, or professional relationships that could impair your objectivity?',
              responseType: 'yes_no',
              followUpIfYes: true,
            },
          ],
        },
      ],
    },
    nonAuditServicesEvaluation: false, // Less relevant for internal audit
    safeguardsFramework: true,
  },

  cpeRules: {
    hoursRequired: 40,
    cycleType: 'annual',
    acceptedActivityTypes: [
      'Formal education courses',
      'Conferences and seminars',
      'Self-study (up to 50%)',
      'On-the-job training (limited)',
      'Professional activities (writing, teaching)',
      'Technical training',
    ],
    maxSelfStudyPercent: 50,
    referenceSection: 'Principle 3 / Standard 3.1',
  },

  workflows: [
    {
      code: 'ASSURANCE_REPORT_APPROVAL',
      label: 'Assurance Engagement Communication Approval',
      entityType: 'report',
      description: 'Approval workflow for assurance engagement communications.',
      steps: [
        {
          order: 1,
          label: 'Engagement Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'request_changes', 'add_comments'],
        },
        {
          order: 2,
          label: 'CAE Approval',
          requiredRole: 'CHIEF_AUDIT_EXECUTIVE',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'reject', 'request_changes'],
          referenceSection: 'Principle 11',
        },
      ],
      visibleToAuditee: false,
    },
    {
      code: 'CONSULTING_REPORT_APPROVAL',
      label: 'Consulting Engagement Communication Approval',
      entityType: 'report',
      description: 'Lighter approval for consulting engagements.',
      steps: [
        {
          order: 1,
          label: 'Engagement Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'request_changes'],
        },
      ],
      visibleToAuditee: false,
    },
  ],

  reportDefinitions: [
    {
      code: 'ASSURANCE_COMMUNICATION',
      label: 'Assurance Engagement Communication',
      description: 'Communication for assurance engagements per Principle 15.',
      sections: [
        { code: 'TITLE', label: 'Title', order: 1, description: 'Engagement title', isRequired: true, contentType: 'template' },
        { code: 'BACKGROUND', label: 'Background', order: 2, description: 'Context and purpose', isRequired: true, contentType: 'rich_text' },
        { code: 'OBJECTIVES', label: 'Objectives', order: 3, description: 'Engagement objectives', isRequired: true, contentType: 'rich_text', referenceSection: 'Standard 15.1' },
        { code: 'SCOPE', label: 'Scope', order: 4, description: 'Engagement scope', isRequired: true, contentType: 'rich_text' },
        { code: 'METHODOLOGY', label: 'Methodology', order: 5, description: 'Approach and procedures', isRequired: false, contentType: 'rich_text' },
        { code: 'FINDINGS', label: 'Observations', order: 6, description: 'Observations with 5 elements', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'findings' },
        { code: 'CONFORMANCE_STATEMENT', label: 'Conformance Statement', order: 7, description: 'Statement of conformance with GIAS', isRequired: false, contentType: 'attestation_statement' },
        { code: 'MANAGEMENT_RESPONSE', label: 'Management Action Plans', order: 8, description: 'Management responses and action plans', isRequired: true, contentType: 'rich_text', referenceSection: 'Standard 15.2' },
        { code: 'OVERALL_OPINION', label: 'Overall Opinion', order: 9, description: 'Overall assurance opinion (optional)', isRequired: false, contentType: 'rich_text' },
        { code: 'DISTRIBUTION', label: 'Distribution List', order: 10, description: 'Recipients', isRequired: true, contentType: 'auto_generated' },
      ],
      defaultFormat: 'pdf',
      requiredForEngagementTypes: ['ASSURANCE', 'COMBINED'],
      referenceSection: 'Principle 15',
      distribution: {
        required: ['ENGAGEMENT_CLIENT', 'BOARD', 'SENIOR_MANAGEMENT'],
        publicDistribution: false,
        confidentialityLevel: 'confidential',
      },
    },
    {
      code: 'CONSULTING_COMMUNICATION',
      label: 'Consulting Engagement Communication',
      description: 'Less formal advisory communication.',
      sections: [
        { code: 'TITLE', label: 'Title', order: 1, description: 'Engagement title', isRequired: true, contentType: 'template' },
        { code: 'PURPOSE', label: 'Purpose', order: 2, description: 'Purpose of consulting', isRequired: true, contentType: 'rich_text' },
        { code: 'RECOMMENDATIONS', label: 'Recommendations', order: 3, description: 'Advisory recommendations', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'recommendations' },
      ],
      defaultFormat: 'pdf',
      requiredForEngagementTypes: ['CONSULTING'],
      referenceSection: 'Principle 15',
      distribution: {
        required: ['ENGAGEMENT_CLIENT'],
        publicDistribution: false,
        confidentialityLevel: 'restricted',
      },
    },
  ],

  templates: [
    {
      code: 'AUDIT_CHARTER',
      label: 'Internal Audit Charter',
      category: 'other',
      description: 'Board-approved charter per Principle 6.',
      referenceSection: 'Principle 6 / Standard 6.1',
      sections: [
        { code: 'PURPOSE', label: 'Purpose, Authority, Responsibility', order: 1, description: 'Mandate of internal audit', isRequired: true, fieldType: 'richtext' },
        { code: 'REPORTING_LINES', label: 'Reporting Lines', order: 2, description: 'Functional to Board, admin to management', isRequired: true, fieldType: 'richtext' },
        { code: 'NATURE_OF_SERVICES', label: 'Nature of Services', order: 3, description: 'Assurance and consulting', isRequired: true, fieldType: 'richtext' },
        { code: 'ACCESS_RIGHTS', label: 'Access Rights', order: 4, description: 'Unrestricted access to records, personnel, properties', isRequired: true, fieldType: 'richtext' },
        { code: 'INDEPENDENCE', label: 'Independence and Objectivity', order: 5, description: 'Independence protections', isRequired: true, fieldType: 'richtext' },
        { code: 'GIAS_COMMITMENT', label: 'GIAS Conformance', order: 6, description: 'Commitment to conform with GIAS', isRequired: true, fieldType: 'richtext' },
        { code: 'QAIP_COMMITMENT', label: 'QAIP Commitment', order: 7, description: 'Commitment to Quality Assurance and Improvement Program', isRequired: true, fieldType: 'richtext' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'IA_STRATEGY',
      label: 'Internal Audit Strategy',
      category: 'planning',
      description: 'Written IA strategy per Standard 9.1 (NEW explicit requirement in GIAS 2024).',
      referenceSection: 'Standard 9.1',
      sections: [
        { code: 'MISSION', label: 'Mission and Vision', order: 1, description: 'IA function mission aligned with org strategy', isRequired: true, fieldType: 'richtext' },
        { code: 'STAKEHOLDER_EXPECTATIONS', label: 'Stakeholder Expectations', order: 2, description: 'Board, management, external expectations', isRequired: true, fieldType: 'richtext' },
        { code: 'STRATEGIC_OBJECTIVES', label: 'Strategic Objectives', order: 3, description: 'Multi-year objectives for IA', isRequired: true, fieldType: 'richtext' },
        { code: 'RESOURCES', label: 'Resource Plan', order: 4, description: 'Multi-year resource and capability plan', isRequired: true, fieldType: 'richtext' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'ENGAGEMENT_PLAN',
      label: 'Engagement Plan',
      category: 'planning',
      description: 'Per Principle 13.',
      sections: [
        { code: 'OBJECTIVES', label: 'Engagement Objectives', order: 1, description: 'What engagement will accomplish', isRequired: true, fieldType: 'richtext' },
        { code: 'SCOPE', label: 'Scope', order: 2, description: 'Areas, locations, time period', isRequired: true, fieldType: 'richtext' },
        { code: 'APPROACH', label: 'Approach', order: 3, description: 'Methodology', isRequired: true, fieldType: 'richtext' },
        { code: 'RESOURCES', label: 'Resources', order: 4, description: 'Team and hours', isRequired: true, fieldType: 'table' },
        { code: 'RISK_ASSESSMENT', label: 'Engagement Risk Assessment', order: 5, description: 'Risks identified', isRequired: true, fieldType: 'richtext', referenceSection: 'Standard 13.x' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'WORK_PROGRAM',
      label: 'Engagement Work Program',
      category: 'fieldwork',
      description: 'Procedures to execute engagement.',
      sections: [
        { code: 'PROCEDURES', label: 'Procedures', order: 1, description: 'Detailed audit procedures', isRequired: true, fieldType: 'table' },
      ],
      isRequired: false,
      tenantCustomizable: true,
    },
  ],

  // Maps IIA GIAS finding-element codes → canonical semantic codes.
  // IIA 5-C structure (Standard 15.1 / Domain V): Criteria, Condition, Cause,
  // Consequence, Recommendation. Recommendation renders inline (the "5th C")
  // but is modeled as a separate Recommendation entity per Decision 4 of
  // references/multi-standard-design.md — M:N to findings.
  semanticElementMappings: [
    {
      semanticCode: 'CRITERIA',
      packElementCode: 'CRITERIA',
      equivalenceStrength: 'exact',
      notes: 'IIA Standard 15.1 — semantically identical to GAGAS Criteria.',
    },
    {
      semanticCode: 'CONDITION',
      packElementCode: 'CONDITION',
      equivalenceStrength: 'exact',
      notes: 'IIA Standard 15.1 — same as GAGAS Condition.',
    },
    {
      semanticCode: 'CAUSE',
      packElementCode: 'ROOT_CAUSE',
      equivalenceStrength: 'exact',
      notes: 'IIA Standard 14.2 requires root-cause analysis more explicitly than GAGAS §6.39c but the slot is the same.',
    },
    {
      semanticCode: 'EFFECT',
      packElementCode: 'CONSEQUENCE',
      equivalenceStrength: 'exact',
      notes: 'IIA uses "Consequence" which reads more naturally in business contexts; same semantic slot as GAGAS Effect.',
    },
    {
      semanticCode: 'RECOMMENDATION',
      packElementCode: 'RECOMMENDATION',
      equivalenceStrength: 'close',
      notes: 'IIA Standard 15.1 integrates Recommendation as the "5th C" inline with the finding. AIMS models Recommendations as a separate entity (Decision 4) with M:N links to findings; IIA-mode reports render them inline per the pack\'s recommendationPresentation.',
    },
  ],

  crosswalks: [
    {
      thisSection: 'Principle 2 / Standard 2.1',
      thisDescription: 'Maintain Objectivity',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§3.26',
      mappedDescription: 'Independence declarations per engagement',
      mappingType: 'mapped_stricter',
      notes: 'GAGAS stricter: 24-mo cooling-off vs IIA 12-mo; per-engagement declaration required explicitly.',
      confidence: 'curated',
    },
    {
      thisSection: 'Standard 15.1',
      thisDescription: 'Finding elements (5: Criteria, Condition, Cause, Consequence, Recommendation)',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§6.39',
      mappedDescription: 'Four elements (Criteria, Condition, Cause, Effect)',
      mappingType: 'partial',
      notes: 'IIA includes Recommendation inline as 5th element; GAGAS keeps Recommendation separate.',
      confidence: 'authoritative',
    },
    {
      thisSection: 'Standard 3.1',
      thisDescription: 'CPD 40 hours/year for CIA',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§4.16-4.26',
      mappedDescription: 'CPE 80/2yr with 24 govt hours',
      mappingType: 'mapped_stricter',
      confidence: 'authoritative',
    },
    {
      thisSection: 'Principle 12 / Standard 12.2',
      thisDescription: 'External Assessment every 5 years',
      mappedStandardRef: 'GAGAS:2024',
      mappedSection: '§5.60-5.87',
      mappedDescription: 'External peer review every 3 years',
      mappingType: 'mapped_stricter',
      notes: 'GAGAS peer review more frequent (3 years) than IIA external assessment (5 years).',
      confidence: 'authoritative',
    },
  ],

  dependencies: [
    {
      standardRef: 'THREE_LINES_MODEL:2020',
      type: 'references',
      scope: {},
      description:
        'GIAS references IIA Three Lines Model (2020) for positioning internal audit as 3rd line.',
    },
  ],

  applicability: {
    mandatoryFor: [
      {
        description: 'Internal audit functions that claim conformance with GIAS',
        sectors: ['ALL_SECTORS'],
        jurisdictions: ['GLOBAL'],
      },
    ],
    recommendedFor: [
      {
        description: 'All internal audit functions globally',
        sectors: ['ALL_SECTORS'],
        jurisdictions: ['GLOBAL'],
      },
    ],
  },

  riskRatings: {
    levels: [
      { code: 'CRITICAL', label: 'Critical', color: '#DC2626', description: 'Immediate action required', severity: 4 },
      { code: 'HIGH', label: 'High', color: '#EA580C', description: 'Significant attention needed', severity: 3 },
      { code: 'MEDIUM', label: 'Medium', color: '#D97706', description: 'Address within timeline', severity: 2 },
      { code: 'LOW', label: 'Low', color: '#2563EB', description: 'Minor risk', severity: 1 },
    ],
    allowUnrated: false,
    requiresJustification: true,
  },

  evidenceRules: {
    referenceSection: 'Principle 14 / Standard 14.1',
    sufficiencyCriteria:
      'Sufficient reliable relevant and useful information to achieve engagement objectives.',
    appropriatenessCriteria:
      'Information must be sufficient (quantity), reliable (verifiable), relevant (related to objectives), and useful (supports conclusions).',
    reliabilityHierarchy: [
      { order: 1, type: 'documented_external', description: 'Documented information from external sources', reliability: 'high' },
      { order: 2, type: 'documented_internal', description: 'Documented information from internal sources', reliability: 'medium_high' },
      { order: 3, type: 'observation', description: 'Direct auditor observation', reliability: 'medium_high' },
      { order: 4, type: 'interview_corroborated', description: 'Interview evidence corroborated', reliability: 'medium' },
      { order: 5, type: 'interview_alone', description: 'Interview evidence alone', reliability: 'lower' },
    ],
    retentionPeriodYears: 5,
    experiencedAuditorStandard: false,
    chainOfCustodyRequired: false,
  },
};
