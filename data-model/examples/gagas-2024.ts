/**
 * GAGAS 2024 Standard Pack
 *
 * Generally Accepted Government Auditing Standards — 2024 Revision
 * "Yellow Book"
 *
 * Verified facts:
 * - Issued February 2024 by GAO
 * - Effective for financial/attestation/review periods beginning on/after Dec 15, 2025
 * - Effective for performance audits beginning on/after Dec 15, 2025
 * - Early adoption permitted
 * - Federal gov audit orgs may defer QMS design to March 16, 2026
 *
 * Paragraph references (e.g., §6.39) must be verified against primary
 * source text before production use. The 2024 revision restructured
 * Chapter 5 (Quality Management), so some paragraph numbers may differ
 * from the 2018 revision.
 *
 * Source: https://www.gao.gov/products/gao-24-106786
 */

import type { StandardPack } from '../standard-pack-schema';

export const gagas2024: StandardPack = {
  code: 'GAGAS',
  version: '2024',
  schemaVersion: '1.1.0',
  packType: 'methodology',

  // ==========================================================================
  // METADATA
  // ==========================================================================
  meta: {
    name: 'Generally Accepted Government Auditing Standards',
    commonName: 'Yellow Book',
    issuingBody: {
      name: 'U.S. Government Accountability Office',
      abbreviation: 'GAO',
      country: 'US',
      url: 'https://www.gao.gov',
    },
    referenceUrl: 'https://www.gao.gov/yellowbook',
    publishedYear: 2024,
    effectiveFrom: '2025-12-15',
    earlyAdoptionAllowed: true,
    previousVersion: 'GAGAS:2018',
    description:
      'Standards for audits of U.S. government entities, programs, and funds. Used by federal, state, and local government auditors and by external auditors of entities receiving federal awards. Mandatory under OMB Uniform Guidance (2 CFR 200) for Single Audits.',
    primarySectors: ['US_FEDERAL_GOVERNMENT', 'US_STATE_LOCAL_GOVERNMENT', 'NONPROFIT'],
    jurisdictions: ['US'],
    tags: ['government', 'public-sector', 'federal-awards', 'single-audit', 'yellow-book'],
  },

  status: 'FINAL_PENDING',

  // ==========================================================================
  // TERMINOLOGY
  // ==========================================================================
  terminology: {
    auditor: { label: 'Auditor', plural: 'Auditors' },
    leadAuditor: {
      label: 'Auditor-in-Charge',
      shortLabel: 'AIC',
      plural: 'Auditors-in-Charge',
      helpText: 'Senior auditor directing and coordinating the engagement.',
    },
    headOfFunction: {
      label: 'Audit Director',
      helpText: 'Senior leader of the audit organization.',
    },
    supervisor: { label: 'Engagement Supervisor' },
    qaReviewer: {
      label: 'Engagement Quality Reviewer',
      shortLabel: 'EQR',
      helpText: 'Independent reviewer performing quality review before report issuance.',
    },
    auditee: {
      label: 'Auditee',
      plural: 'Auditees',
      aliases: ['Audited Entity'],
    },
    engagement: { label: 'Engagement', plural: 'Engagements' },
    finding: {
      label: 'Finding',
      plural: 'Findings',
      helpText:
        'A reportable issue with all four required elements: Criteria, Condition, Cause, Effect.',
    },
    recommendation: { label: 'Recommendation', plural: 'Recommendations' },
    workpaper: {
      label: 'Workpaper',
      plural: 'Workpapers',
      aliases: ['Working Paper', 'Audit Documentation'],
    },
    correctiveAction: {
      label: 'Corrective Action Plan',
      shortLabel: 'CAP',
    },
    fieldwork: { label: 'Fieldwork' },
    planning: { label: 'Planning' },
    reporting: { label: 'Reporting' },
    followUp: { label: 'Follow-Up' },
    planningMemo: {
      label: 'Audit Planning Memorandum',
      shortLabel: 'APM',
    },
    workProgram: { label: 'Audit Program' },
    auditReport: {
      label: 'Yellow Book Report',
      helpText: 'Report on Internal Control Over Financial Reporting and on Compliance and Other Matters.',
    },
    independence: { label: 'Independence' },
    peerReview: { label: 'Peer Review' },
    qaChecklist: { label: 'Quality Management Checklist' },
    managementResponse: {
      label: 'Views of Responsible Officials',
      aliases: ['Management Response'],
    },
  },

  // ==========================================================================
  // ENGAGEMENT TYPES (Chapters 6-10)
  // ==========================================================================
  engagementTypes: [
    {
      code: 'FINANCIAL_AUDIT',
      label: 'Financial Audit',
      description:
        'Audit of financial statements under GAAP/OCBOA. Must comply with GAGAS Chapters 1-6 AND AICPA AU-C sections.',
      referenceSection: 'Chapters 6, 7',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'REVIEW', 'ISSUED', 'FOLLOW_UP'],
      defaultWorkflowCode: 'FINANCIAL_AUDIT_REPORT_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO', 'WORK_PROGRAM', 'SUMMARY_SCHEDULE'],
      requiredChecklists: ['QUALITY_MANAGEMENT', 'INDEPENDENCE_DECLARATION'],
      teamRequirements: {
        minMembers: 2,
        requiredRoles: ['AUDITOR_IN_CHARGE', 'ENGAGEMENT_SUPERVISOR'],
        competencyRequirements: ['Current GAGAS CPE', 'Financial audit experience'],
      },
      supportsMultiStandard: true,
      tags: ['financial', 'GAAP'],
    },
    {
      code: 'PERFORMANCE_AUDIT',
      label: 'Performance Audit',
      description:
        'Evaluates effectiveness, efficiency, and economy of programs, activities, and functions. Broader scope than financial audits.',
      referenceSection: 'Chapters 9, 10',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'REVIEW', 'ISSUED', 'FOLLOW_UP'],
      defaultWorkflowCode: 'PERFORMANCE_AUDIT_REPORT_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO', 'WORK_PROGRAM'],
      requiredChecklists: ['QUALITY_MANAGEMENT', 'INDEPENDENCE_DECLARATION'],
      teamRequirements: {
        minMembers: 2,
        requiredRoles: ['AUDITOR_IN_CHARGE'],
      },
      supportsMultiStandard: true,
      tags: ['performance', '3Es'],
    },
    {
      code: 'ATTESTATION_EXAMINATION',
      label: 'Attestation — Examination',
      description: 'Examination of specific subject matter assertions (highest assurance level).',
      referenceSection: 'Chapters 6, 7',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'REVIEW', 'ISSUED'],
      defaultWorkflowCode: 'ATTESTATION_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO'],
      requiredChecklists: ['QUALITY_MANAGEMENT', 'INDEPENDENCE_DECLARATION'],
      supportsMultiStandard: false,
    },
    {
      code: 'ATTESTATION_REVIEW',
      label: 'Attestation — Review',
      description: 'Limited assurance engagement (negative assurance).',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'ISSUED'],
      defaultWorkflowCode: 'ATTESTATION_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO'],
      requiredChecklists: ['QUALITY_MANAGEMENT', 'INDEPENDENCE_DECLARATION'],
      supportsMultiStandard: false,
    },
    {
      code: 'AGREED_UPON_PROCEDURES',
      label: 'Agreed-Upon Procedures',
      description: 'Specific procedures performed; users draw their own conclusions. No assurance.',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'ISSUED'],
      defaultWorkflowCode: 'ATTESTATION_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO'],
      requiredChecklists: ['INDEPENDENCE_DECLARATION'],
      supportsMultiStandard: false,
    },
    {
      code: 'SINGLE_AUDIT',
      label: 'Single Audit',
      description:
        'Required for entities expending ≥ $1M in federal awards (FY ending on/after Sep 30, 2025). Combines financial audit + compliance audit per 2 CFR 200 Subpart F.',
      referenceSection: '2 CFR 200.500+',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING', 'REVIEW', 'ISSUED', 'FOLLOW_UP'],
      defaultWorkflowCode: 'SINGLE_AUDIT_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO', 'WORK_PROGRAM', 'SUMMARY_SCHEDULE', 'SEFA'],
      requiredChecklists: ['QUALITY_MANAGEMENT', 'INDEPENDENCE_DECLARATION', 'SINGLE_AUDIT_CHECKLIST'],
      teamRequirements: {
        minMembers: 2,
        requiredRoles: ['AUDITOR_IN_CHARGE', 'ENGAGEMENT_SUPERVISOR'],
      },
      supportsMultiStandard: true,
      tags: ['single-audit', 'federal-awards', 'uniform-guidance'],
    },
    {
      code: 'FOLLOW_UP_AUDIT',
      label: 'Follow-Up Audit',
      description: 'Status review of prior audit findings and corrective actions.',
      applicablePhases: ['PLANNING', 'FIELDWORK', 'REPORTING'],
      defaultWorkflowCode: 'PERFORMANCE_AUDIT_REPORT_APPROVAL',
      requiredTemplates: ['PLANNING_MEMO'],
      requiredChecklists: ['INDEPENDENCE_DECLARATION'],
      supportsMultiStandard: true,
    },
  ],

  // ==========================================================================
  // PHASES
  // ==========================================================================
  phases: [
    {
      code: 'PLANNING',
      label: 'Planning',
      order: 1,
      description: 'Audit planning per §7.05-7.10 (or corresponding 2024 revision sections).',
      exitCriteria: [
        {
          code: 'PLANNING_MEMO_APPROVED',
          description: 'Audit Planning Memorandum approved by supervisor',
          referenceSection: '§7.05-7.10',
          validationType: 'approval_complete',
        },
        {
          code: 'INDEPENDENCE_CONFIRMED',
          description: 'All team members have completed independence declarations',
          referenceSection: '§3.26',
          validationType: 'document_present',
        },
        {
          code: 'CPE_CURRENT',
          description: 'All team members meet current GAGAS CPE requirements',
          referenceSection: '§4.16-4.26',
          validationType: 'automated_rule',
        },
        {
          code: 'RISK_ASSESSMENT_COMPLETE',
          description: 'Risk assessment documented',
          referenceSection: '§8.07, §8.35',
          validationType: 'document_present',
        },
        {
          code: 'WORK_PROGRAMS_PREPARED',
          description: 'Work programs prepared for each audit objective',
          validationType: 'document_present',
        },
      ],
      isOptional: false,
    },
    {
      code: 'FIELDWORK',
      label: 'Fieldwork',
      order: 2,
      description: 'Execute audit procedures, gather evidence, document work.',
      exitCriteria: [
        {
          code: 'WORK_PROGRAMS_COMPLETE',
          description: 'All work programs completed',
          validationType: 'manual_checkbox',
        },
        {
          code: 'EVIDENCE_SUFFICIENT',
          description: 'Sufficient appropriate evidence obtained',
          referenceSection: '§6.33',
          validationType: 'manual_checkbox',
        },
        {
          code: 'WORKPAPERS_REVIEWED',
          description: 'Workpapers reviewed by supervisor',
          referenceSection: '§8.51',
          validationType: 'approval_complete',
        },
        {
          code: 'OBSERVATIONS_RESOLVED',
          description: 'All observations resolved or escalated to findings',
          validationType: 'automated_rule',
        },
      ],
      isOptional: false,
    },
    {
      code: 'REPORTING',
      label: 'Reporting',
      order: 3,
      description: 'Draft and finalize audit report.',
      exitCriteria: [
        {
          code: 'DRAFT_REPORT_PREPARED',
          description: 'Draft report with all required §6.02 elements',
          referenceSection: '§6.02',
          validationType: 'document_present',
        },
        {
          code: 'FINDINGS_DOCUMENTED',
          description: 'All findings documented with 4 elements',
          referenceSection: '§6.39',
          validationType: 'automated_rule',
        },
        {
          code: 'MGMT_RESPONSES_RECEIVED',
          description: 'Management responses received',
          referenceSection: '§6.55',
          validationType: 'document_present',
        },
        {
          code: 'QM_REVIEW_COMPLETE',
          description: 'Quality management checklist complete',
          referenceSection: '§5.01',
          validationType: 'approval_complete',
        },
      ],
      isOptional: false,
    },
    {
      code: 'REVIEW',
      label: 'Quality Review',
      order: 4,
      description: 'Engagement Quality Review and final approvals.',
      exitCriteria: [
        {
          code: 'EQR_COMPLETE',
          description: 'Engagement Quality Review complete',
          referenceSection: '§5.03',
          validationType: 'approval_complete',
        },
        {
          code: 'DIRECTOR_SIGN_OFF',
          description: 'Audit Director sign-off obtained',
          validationType: 'approval_complete',
        },
      ],
      isOptional: false,
    },
    {
      code: 'ISSUED',
      label: 'Report Issued',
      order: 5,
      description: 'Report distributed to auditee and required recipients.',
      exitCriteria: [
        {
          code: 'REPORT_DISTRIBUTED',
          description: 'Report distributed per §6.65',
          referenceSection: '§6.65',
          validationType: 'manual_checkbox',
        },
      ],
      isOptional: false,
    },
    {
      code: 'FOLLOW_UP',
      label: 'Follow-Up',
      order: 6,
      description: 'Track corrective action implementation.',
      exitCriteria: [
        {
          code: 'CAPS_TRACKED',
          description: 'All CAPs tracked to closure or escalation',
          validationType: 'automated_rule',
        },
      ],
      isOptional: true,
    },
  ],

  // ==========================================================================
  // FINDING ELEMENTS — §6.39 Four Elements
  // ==========================================================================
  findingElements: [
    {
      code: 'CRITERIA',
      label: 'Criteria',
      description: 'What should be — the law, regulation, standard, or expectation.',
      helpText:
        'Describe the standard, law, regulation, policy, or benchmark against which the condition was measured. Cite the authoritative source.',
      example:
        '"OMB Circular A-133 requires grantees to maintain adequate records of federal expenditures and make them available for audit within 30 days of request."',
      isRequired: true,
      fieldType: 'richtext',
      minLength: 50,
      referenceSection: '§6.39a',
      order: 1,
    },
    {
      code: 'CONDITION',
      label: 'Condition',
      description: 'What is — the current state or situation found during the audit.',
      helpText:
        'Describe the current situation as determined through audit procedures. Include specific examples, data, and scope (how widespread).',
      example:
        '"We requested expenditure records for 3 of 12 federal grants. The grantee could not produce records for 2 grants within 30 days. When records were eventually provided, 15 of 50 sampled transactions lacked supporting documentation."',
      isRequired: true,
      fieldType: 'richtext',
      minLength: 100,
      referenceSection: '§6.39b',
      order: 2,
    },
    {
      code: 'CAUSE',
      label: 'Cause',
      description: 'Why the gap exists — the root cause of the difference between criteria and condition.',
      helpText:
        'Identify the root cause, not the surface-level reason. May involve multiple contributing factors. Common causes: lack of training, inadequate policies, staff turnover, system limitations, management override.',
      example:
        '"The grantee experienced 60% staff turnover in the grants management office during the audit period. New staff were not trained on federal records requirements, and the office lacked written procedures for maintaining grant documentation."',
      isRequired: true,
      fieldType: 'richtext',
      minLength: 50,
      referenceSection: '§6.39c',
      order: 3,
    },
    {
      code: 'EFFECT',
      label: 'Effect',
      description: 'Impact — actual or potential consequence of the condition.',
      helpText:
        'Quantify when possible (dollar amounts, percentages, number of people affected). Distinguish between actual and potential effects. Connect to organizational mission or public interest.',
      example:
        '"As a result, $2.3 million in federal expenditures across 2 grants could not be verified for allowability. This represents 18% of total federal awards and exposes the grantee to potential disallowed costs, grant suspension, or clawback of funds."',
      isRequired: true,
      fieldType: 'richtext',
      minLength: 50,
      referenceSection: '§6.39d',
      order: 4,
    },
  ],

  // ==========================================================================
  // FINDING CLASSIFICATIONS — Internal Control Deficiencies
  // ==========================================================================
  findingClassifications: [
    {
      code: 'GAGAS_DEFICIENCY_TIER',
      label: 'Deficiency Classification',
      description: 'Internal control deficiency classification per §6.41-6.44.',
      levels: [
        {
          code: 'MATERIAL_WEAKNESS',
          label: 'Material Weakness',
          shortLabel: 'MW',
          description:
            'Deficiency or combination where reasonable possibility of material misstatement not being prevented/detected timely.',
          color: '#DC2626',
          severity: 4,
          referenceSection: '§6.41',
          requiresEscalation: true,
        },
        {
          code: 'SIGNIFICANT_DEFICIENCY',
          label: 'Significant Deficiency',
          shortLabel: 'SD',
          description:
            'Less severe than material weakness but important enough to merit attention by those charged with governance.',
          color: '#EA580C',
          severity: 3,
          referenceSection: '§6.42',
          requiresEscalation: true,
        },
        {
          code: 'DEFICIENCY',
          label: 'Deficiency',
          shortLabel: 'D',
          description: 'Control gap that reduces likelihood of detecting misstatement.',
          color: '#D97706',
          severity: 2,
          referenceSection: '§6.43',
          requiresEscalation: false,
        },
        {
          code: 'OBSERVATION',
          label: 'Observation',
          description: 'Minor issue not rising to finding level. Typically reported in management letter.',
          color: '#6B7280',
          severity: 1,
          requiresEscalation: false,
        },
      ],
      isRequired: true,
      allowsReclassification: false,
    },
  ],

  // ==========================================================================
  // CHECKLISTS
  // ==========================================================================
  checklists: [
    {
      code: 'QUALITY_MANAGEMENT',
      label: 'Quality Management Checklist',
      category: 'QUALITY_ASSURANCE',
      description:
        '2024 Revision Quality Management System (replaces 2018 Quality Control). Aligns with AICPA SQMS 1 and 2. 8 components.',
      referenceSection: '§5.01 (2024 revision)',
      sections: [
        {
          code: 'GOVERNANCE_LEADERSHIP',
          title: 'Governance and Leadership',
          order: 1,
          items: [
            {
              code: 'QM_001',
              text: 'Is leadership commitment to quality demonstrated?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§5.01',
              order: 1,
            },
            {
              code: 'QM_002',
              text: 'Is there a designated Engagement Quality Reviewer?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§5.03',
              order: 2,
            },
          ],
        },
        {
          code: 'ETHICS_INDEPENDENCE',
          title: 'Ethics and Independence',
          order: 2,
          items: [
            {
              code: 'QM_010',
              text: 'Have all team members completed independence declarations?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§3.26',
              order: 1,
            },
            {
              code: 'QM_011',
              text: 'Have independence threats been evaluated?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§3.30',
              order: 2,
            },
          ],
        },
        {
          code: 'ENGAGEMENT_PERFORMANCE',
          title: 'Engagement Performance',
          order: 3,
          items: [
            {
              code: 'QM_020',
              text: 'Is sufficient appropriate evidence documented for all findings?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§6.33',
              order: 1,
            },
            {
              code: 'QM_021',
              text: 'Do all findings include all four elements (Criteria, Condition, Cause, Effect)?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§6.39',
              order: 2,
            },
            {
              code: 'QM_022',
              text: 'Have management responses been obtained?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§6.55',
              order: 3,
            },
          ],
        },
        {
          code: 'MONITORING_REMEDIATION',
          title: 'Monitoring and Remediation',
          order: 4,
          items: [
            {
              code: 'QM_030',
              text: 'Has annual evaluation of the QMS been performed?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '§5.01 (2024)',
              order: 1,
            },
          ],
        },
      ],
      assigneeRole: 'ENGAGEMENT_QUALITY_REVIEWER',
      completionPoint: 'per_engagement',
      isRequired: true,
      passingCriteria: 'All required items answered "Yes"',
    },
    {
      code: 'INDEPENDENCE_DECLARATION',
      label: 'Independence Declaration',
      category: 'INDEPENDENCE',
      description: 'Personal independence declaration per §3.26.',
      referenceSection: '§3.26',
      sections: [
        {
          code: 'PERSONAL_INDEPENDENCE',
          title: 'Personal Independence',
          order: 1,
          items: [
            {
              code: 'IND_001',
              text: 'Do you have any financial interest in the auditee?',
              isRequired: true,
              responseType: 'yes_no',
              order: 1,
            },
            {
              code: 'IND_002',
              text: 'Have you held a position of employment or responsibility with the auditee in the past 24 months?',
              isRequired: true,
              responseType: 'yes_no',
              order: 2,
            },
            {
              code: 'IND_003',
              text: 'Do you have close family members employed by the auditee?',
              isRequired: true,
              responseType: 'yes_no',
              order: 3,
            },
          ],
        },
      ],
      assigneeRole: 'TEAM_MEMBER',
      completionPoint: 'per_engagement',
      isRequired: true,
      passingCriteria: 'All questions answered; any "Yes" triggers safeguard assessment',
    },
    {
      code: 'SINGLE_AUDIT_CHECKLIST',
      label: 'Single Audit Checklist',
      category: 'SECTOR_SPECIFIC',
      description: 'Uniform Guidance (2 CFR 200) Single Audit requirements.',
      referenceSection: '2 CFR 200.500+',
      sections: [
        {
          code: 'MAJOR_PROGRAM_DETERMINATION',
          title: 'Major Program Determination',
          order: 1,
          items: [
            {
              code: 'SA_001',
              text: 'Have Type A/Type B programs been identified?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '2 CFR 200.518',
              order: 1,
            },
            {
              code: 'SA_002',
              text: 'Has low-risk auditee status been evaluated?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '2 CFR 200.520',
              order: 2,
            },
            {
              code: 'SA_003',
              text: 'Does percentage-of-coverage meet 20% (low-risk) or 40% (not low-risk)?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '2 CFR 200.518(f)',
              order: 3,
            },
          ],
        },
        {
          code: 'COMPLIANCE_TESTING',
          title: 'Compliance Requirements Testing',
          order: 2,
          items: [
            {
              code: 'SA_010',
              text: 'Have all applicable direct-and-material compliance requirements been tested for each major program?',
              helpText: '12 requirements: A, B, C, E, F, G, H, I, J, L, M, N',
              isRequired: true,
              responseType: 'yes_no',
              order: 1,
            },
          ],
        },
        {
          code: 'SEFA',
          title: 'Schedule of Expenditures of Federal Awards',
          order: 3,
          items: [
            {
              code: 'SA_020',
              text: 'Is SEFA complete with ALN, federal agency, pass-through entity, expenditures?',
              isRequired: true,
              responseType: 'yes_no',
              referenceSection: '2 CFR 200.510(b)',
              order: 1,
            },
          ],
        },
      ],
      assigneeRole: 'AUDITOR_IN_CHARGE',
      completionPoint: 'per_engagement',
      isRequired: true,
      passingCriteria: 'All required items answered "Yes"',
    },
  ],

  // ==========================================================================
  // INDEPENDENCE RULES
  // ==========================================================================
  independenceRules: {
    referenceSection: '§3.02-3.108',
    declarationFrequency: 'per_engagement',
    coolingOffPeriodMonths: 24, // GAGAS is stricter than IIA (12) — goes to 24
    threatTypes: [
      {
        code: 'SELF_INTEREST',
        label: 'Self-Interest Threat',
        description: 'Financial or other interest that could inappropriately influence judgment.',
        examples: [
          'Financial interest in auditee',
          'Close business relationship',
          'Potential employment with auditee',
          'Excessive fee dependency',
        ],
      },
      {
        code: 'SELF_REVIEW',
        label: 'Self-Review Threat',
        description: 'Auditor reviewing own work products.',
        examples: [
          'Providing non-audit services then auditing that area',
          'Designing systems then auditing them',
          'Preparing financial statements then auditing them',
        ],
      },
      {
        code: 'BIAS',
        label: 'Bias / Undue Influence Threat',
        description: 'Personal relationship or external pressure affecting objectivity.',
        examples: [
          'Personal relationship with auditee personnel',
          'Political pressure',
          'External interference with audit scope',
          'Prejudice toward or against auditee',
        ],
      },
    ],
    declarationForm: {
      sections: [
        {
          code: 'PERSONAL',
          label: 'Personal Independence',
          questions: [
            {
              code: 'P1',
              text: 'Do you have any direct or material indirect financial interest in the auditee?',
              responseType: 'yes_no',
              followUpIfYes: true,
              referenceSection: '§3.02',
            },
            {
              code: 'P2',
              text: 'Have you held employment with the auditee in the past 24 months?',
              responseType: 'yes_no',
              followUpIfYes: true,
            },
          ],
        },
        {
          code: 'ORGANIZATIONAL',
          label: 'Organizational Independence',
          questions: [
            {
              code: 'O1',
              text: 'Does your audit organization have organizational independence from the auditee?',
              responseType: 'yes_no',
              referenceSection: '§3.18',
            },
          ],
        },
        {
          code: 'NON_AUDIT_SERVICES',
          label: 'Non-Audit Services',
          questions: [
            {
              code: 'NA1',
              text: 'Has the audit organization provided any non-audit services to the auditee in the past 12 months?',
              responseType: 'yes_no',
              followUpIfYes: true,
              referenceSection: '§3.43-3.59',
            },
          ],
        },
      ],
    },
    nonAuditServicesEvaluation: true,
    prohibitedNonAuditServices: [
      'Bookkeeping or other services related to accounting records',
      'Financial information system design and implementation',
      'Management functions',
      'Certain valuation services',
      'Actuarial services for amounts material to FS',
      'Internal audit outsourcing',
      'Legal services',
    ],
    safeguardsFramework: true,
  },

  // ==========================================================================
  // CPE RULES — §4.16-4.26
  // ==========================================================================
  cpeRules: {
    hoursRequired: 80,
    cycleType: 'rolling_2_year',
    annualMinimum: 20,
    topicRequirements: [
      {
        topic: 'Government Auditing',
        hoursRequired: 24,
        qualifyingContent:
          'GAGAS standards, government environment, government auditing, specific programs audited.',
      },
    ],
    acceptedActivityTypes: [
      'Formal courses',
      'Conferences and seminars',
      'Self-study (limited)',
      'Teaching',
      'Publishing in professional literature',
      'Contributing to professional audit literature',
    ],
    maxSelfStudyPercent: 50,
    referenceSection: '§4.16-4.26',
  },

  // ==========================================================================
  // WORKFLOWS
  // ==========================================================================
  workflows: [
    {
      code: 'FINANCIAL_AUDIT_REPORT_APPROVAL',
      label: 'Financial Audit Report Approval',
      entityType: 'report',
      description: 'Multi-stage approval for financial audit report with EQR.',
      steps: [
        {
          order: 1,
          label: 'Auditor-in-Charge Review',
          requiredRole: 'AUDITOR_IN_CHARGE',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 3,
          allowedActions: ['approve', 'request_changes', 'add_comments'],
        },
        {
          order: 2,
          label: 'Engagement Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 5,
          allowedActions: ['approve', 'reject', 'request_changes', 'add_comments'],
        },
        {
          order: 3,
          label: 'Engagement Quality Review',
          requiredRole: 'ENGAGEMENT_QUALITY_REVIEWER',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 7,
          allowedActions: ['approve', 'reject', 'request_changes', 'add_comments'],
          referenceSection: '§5.03',
        },
        {
          order: 4,
          label: 'Audit Director Approval',
          requiredRole: 'AUDIT_DIRECTOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 3,
          allowedActions: ['approve', 'reject', 'request_changes', 'add_comments'],
        },
        {
          order: 5,
          label: 'Final Sign-Off',
          requiredRole: 'AUDIT_DIRECTOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          slaDays: 2,
          allowedActions: ['approve', 'recall'],
        },
      ],
      slaTargetDays: 20,
      visibleToAuditee: false,
    },
    {
      code: 'PERFORMANCE_AUDIT_REPORT_APPROVAL',
      label: 'Performance Audit Report Approval',
      entityType: 'report',
      description: 'Approval workflow for performance audit reports.',
      steps: [
        {
          order: 1,
          label: 'Auditor-in-Charge Review',
          requiredRole: 'AUDITOR_IN_CHARGE',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 3,
          allowedActions: ['approve', 'request_changes', 'add_comments'],
        },
        {
          order: 2,
          label: 'Engagement Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 5,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
        {
          order: 3,
          label: 'Engagement Quality Review',
          requiredRole: 'ENGAGEMENT_QUALITY_REVIEWER',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 5,
          allowedActions: ['approve', 'reject', 'request_changes'],
          referenceSection: '§5.03',
        },
        {
          order: 4,
          label: 'Audit Director Approval',
          requiredRole: 'AUDIT_DIRECTOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          slaDays: 3,
          allowedActions: ['approve', 'reject'],
        },
      ],
      slaTargetDays: 16,
      visibleToAuditee: false,
    },
    {
      code: 'FINDING_APPROVAL',
      label: 'Finding Approval',
      entityType: 'finding',
      description: 'Finding review before inclusion in report.',
      steps: [
        {
          order: 1,
          label: 'Senior Auditor Review',
          requiredRole: 'SENIOR_AUDITOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          slaDays: 3,
          allowedActions: ['approve', 'request_changes'],
        },
        {
          order: 2,
          label: 'Supervisor Approval',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          slaDays: 3,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
      ],
      visibleToAuditee: false,
    },
    {
      code: 'SINGLE_AUDIT_APPROVAL',
      label: 'Single Audit Report Approval',
      entityType: 'report',
      description: 'Single Audit has multiple reports; uses financial audit workflow.',
      steps: [
        {
          order: 1,
          label: 'Auditor-in-Charge Review',
          requiredRole: 'AUDITOR_IN_CHARGE',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'request_changes'],
        },
        {
          order: 2,
          label: 'Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
        {
          order: 3,
          label: 'EQR',
          requiredRole: 'ENGAGEMENT_QUALITY_REVIEWER',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
        {
          order: 4,
          label: 'Director Sign-Off',
          requiredRole: 'AUDIT_DIRECTOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'reject'],
        },
      ],
      visibleToAuditee: false,
    },
    {
      code: 'ATTESTATION_APPROVAL',
      label: 'Attestation Engagement Approval',
      entityType: 'report',
      description: 'Approval for examination/review/AUP engagements.',
      steps: [
        {
          order: 1,
          label: 'Supervisor Review',
          requiredRole: 'ENGAGEMENT_SUPERVISOR',
          isOptional: false,
          autoAdvanceOnApproval: true,
          allowedActions: ['approve', 'reject', 'request_changes'],
        },
        {
          order: 2,
          label: 'Director Approval',
          requiredRole: 'AUDIT_DIRECTOR',
          isOptional: false,
          autoAdvanceOnApproval: false,
          allowedActions: ['approve', 'reject'],
        },
      ],
      visibleToAuditee: false,
    },
  ],

  // ==========================================================================
  // REPORT DEFINITIONS — §6.02
  // ==========================================================================
  reportDefinitions: [
    {
      code: 'YELLOW_BOOK_REPORT',
      label: 'Yellow Book Report',
      description:
        'Report on Internal Control Over Financial Reporting and on Compliance and Other Matters Based on an Audit of Financial Statements Performed in Accordance with Government Auditing Standards.',
      sections: [
        { code: 'TITLE', label: 'Report Title', order: 1, description: 'Report title and entity identification', isRequired: true, contentType: 'template', templateReference: 'YB_TITLE_TEMPLATE' },
        { code: 'OBJECTIVES_SCOPE_METHODOLOGY', label: 'Objectives, Scope and Methodology', order: 2, description: 'Audit objectives, scope, methodology', isRequired: true, contentType: 'rich_text', referenceSection: '§6.02' },
        { code: 'GAGAS_COMPLIANCE_STATEMENT', label: 'GAGAS Compliance Statement', order: 3, description: 'Explicit statement of GAGAS compliance', isRequired: true, contentType: 'attestation_statement', referenceSection: '§6.05' },
        { code: 'INDEPENDENCE_STATEMENT', label: 'Independence Statement', order: 4, description: 'Auditor independence declaration', isRequired: true, contentType: 'attestation_statement', referenceSection: '§6.10' },
        { code: 'FINDINGS', label: 'Findings', order: 5, description: 'All material/significant findings with four elements', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'findings', referenceSection: '§6.39' },
        { code: 'RECOMMENDATIONS', label: 'Recommendations', order: 6, description: 'Action-oriented recommendations', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'recommendations', referenceSection: '§6.18' },
        { code: 'MANAGEMENT_RESPONSE', label: 'Views of Responsible Officials', order: 7, description: 'Management response to findings', isRequired: true, contentType: 'rich_text', referenceSection: '§6.55' },
        { code: 'CONCLUSIONS', label: 'Conclusions', order: 8, description: 'Summary answering audit objectives', isRequired: true, contentType: 'rich_text' },
        { code: 'AUDITOR_INFO', label: 'Auditor Information', order: 9, description: 'Auditor names, signature, date', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'team' },
        { code: 'DISTRIBUTION', label: 'Distribution Statement', order: 10, description: 'Report distribution', isRequired: true, contentType: 'attestation_statement', referenceSection: '§6.65' },
      ],
      defaultFormat: 'pdf',
      pageLayout: { size: 'letter', orientation: 'portrait', margins: { top: 72, right: 72, bottom: 72, left: 72 } },
      requiredForEngagementTypes: ['FINANCIAL_AUDIT', 'SINGLE_AUDIT'],
      referenceSection: '§6.02',
      distribution: {
        required: ['AUDITEE', 'THOSE_CHARGED_WITH_GOVERNANCE', 'FEDERAL_COGNIZANT_AGENCY'],
        publicDistribution: true,
        confidentialityLevel: 'public',
      },
    },
    {
      code: 'PERFORMANCE_AUDIT_REPORT',
      label: 'Performance Audit Report',
      description: 'Performance audit report per §9.60-9.66.',
      sections: [
        { code: 'TITLE', label: 'Report Title', order: 1, description: 'Report title and entity identification', isRequired: true, contentType: 'template' },
        { code: 'EXEC_SUMMARY', label: 'Executive Summary', order: 2, description: 'High-level summary', isRequired: false, contentType: 'rich_text' },
        { code: 'OBJECTIVES_SCOPE_METHODOLOGY', label: 'Objectives, Scope, and Methodology', order: 3, description: 'Audit objectives, scope, methodology', isRequired: true, contentType: 'rich_text' },
        { code: 'GAGAS_COMPLIANCE_STATEMENT', label: 'GAGAS Compliance Statement', order: 4, description: 'Statement of GAGAS compliance', isRequired: true, contentType: 'attestation_statement' },
        { code: 'FINDINGS', label: 'Findings', order: 5, description: 'Findings with 4 elements', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'findings' },
        { code: 'CONCLUSIONS', label: 'Conclusions', order: 6, description: 'Conclusions answering audit objectives', isRequired: true, contentType: 'rich_text' },
        { code: 'RECOMMENDATIONS', label: 'Recommendations', order: 7, description: 'Recommendations tied to causes', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'recommendations' },
        { code: 'MANAGEMENT_RESPONSE', label: 'Views of Responsible Officials', order: 8, description: 'Management response', isRequired: true, contentType: 'rich_text' },
      ],
      defaultFormat: 'pdf',
      requiredForEngagementTypes: ['PERFORMANCE_AUDIT'],
      referenceSection: '§9.60-9.66',
      distribution: {
        required: ['AUDITEE', 'THOSE_CHARGED_WITH_GOVERNANCE'],
        publicDistribution: true,
        confidentialityLevel: 'public',
      },
    },
    {
      code: 'SUMMARY_SCHEDULE_OF_FINDINGS',
      label: 'Summary Schedule of Findings and Questioned Costs',
      description: 'Single Audit summary schedule per 2 CFR 200.516.',
      sections: [
        { code: 'TITLE', label: 'Title', order: 1, description: 'Title page', isRequired: true, contentType: 'template' },
        { code: 'CURRENT_YEAR_FINDINGS', label: 'Current Year Findings', order: 2, description: 'Current year audit findings with questioned costs', isRequired: true, contentType: 'auto_generated', autoGeneratedFrom: 'findings' },
        { code: 'PRIOR_YEAR_FINDINGS', label: 'Summary Schedule of Prior Audit Findings', order: 3, description: 'Status of prior year findings', isRequired: true, contentType: 'auto_generated' },
      ],
      defaultFormat: 'pdf',
      requiredForEngagementTypes: ['SINGLE_AUDIT'],
      referenceSection: '2 CFR 200.516',
      distribution: {
        required: ['AUDITEE', 'FEDERAL_AUDIT_CLEARINGHOUSE'],
        publicDistribution: true,
        confidentialityLevel: 'public',
      },
    },
  ],

  // ==========================================================================
  // TEMPLATES
  // ==========================================================================
  templates: [
    {
      code: 'PLANNING_MEMO',
      label: 'Audit Planning Memorandum',
      category: 'planning',
      description: '14-section APM per §7.05-7.10.',
      referenceSection: '§7.05-7.10',
      sections: [
        { code: 'ENGAGEMENT_AUTH', label: 'Engagement Authorization', order: 1, description: 'Who authorized the audit', isRequired: true, fieldType: 'richtext' },
        { code: 'BACKGROUND', label: 'Background and Context', order: 2, description: 'Entity description, programs, prior audits', isRequired: true, fieldType: 'richtext' },
        { code: 'OBJECTIVES', label: 'Audit Objectives', order: 3, description: 'Clear statement of what audit will accomplish', isRequired: true, fieldType: 'richtext' },
        { code: 'SCOPE', label: 'Scope and Limitations', order: 4, description: 'Whats included/excluded, any restrictions', isRequired: true, fieldType: 'richtext' },
        { code: 'METHODOLOGY', label: 'Methodology', order: 5, description: 'Audit approach, procedures, data sources', isRequired: true, fieldType: 'richtext' },
        { code: 'CRITERIA', label: 'Applicable Criteria', order: 6, description: 'Laws, regulations, standards, policies', isRequired: true, fieldType: 'richtext', referenceSection: '§8.07' },
        { code: 'RISK', label: 'Risk Assessment', order: 7, description: 'Preliminary risk assessment', isRequired: true, fieldType: 'richtext', referenceSection: '§8.35' },
        { code: 'INTERNAL_CONTROL', label: 'Internal Controls Assessment', order: 8, description: 'Controls relevant to audit objectives', isRequired: true, fieldType: 'richtext' },
        { code: 'MATERIALITY', label: 'Materiality', order: 9, description: 'Quantified thresholds (financial audits)', isRequired: false, fieldType: 'calculation', referenceSection: '§8.25' },
        { code: 'STAFF', label: 'Staff Requirements and Competencies', order: 10, description: 'Team composition, CPE status', isRequired: true, fieldType: 'richtext', referenceSection: '§4.02' },
        { code: 'TIMELINE', label: 'Timeline and Milestones', order: 11, description: 'Audit schedule', isRequired: true, fieldType: 'richtext' },
        { code: 'BUDGET', label: 'Budget and Resources', order: 12, description: 'Estimated hours', isRequired: true, fieldType: 'table' },
        { code: 'COMMUNICATION', label: 'Communication Plan', order: 13, description: 'Entrance/exit conferences, status updates', isRequired: true, fieldType: 'richtext' },
        { code: 'SUPERVISION', label: 'Supervision and Review Plan', order: 14, description: 'Who reviews whom, EQR assignment', isRequired: true, fieldType: 'richtext', referenceSection: '§8.51' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'WORK_PROGRAM',
      label: 'Audit Program',
      category: 'fieldwork',
      description: 'Detailed list of audit procedures.',
      sections: [
        { code: 'OBJECTIVE', label: 'Procedure Objective', order: 1, description: 'What this procedure accomplishes', isRequired: true, fieldType: 'text' },
        { code: 'PROCEDURE', label: 'Procedure Steps', order: 2, description: 'Detailed steps', isRequired: true, fieldType: 'richtext' },
        { code: 'EVIDENCE', label: 'Expected Evidence', order: 3, description: 'Evidence to gather', isRequired: true, fieldType: 'text' },
        { code: 'ASSIGNEE', label: 'Assigned To', order: 4, description: 'Team member responsible', isRequired: true, fieldType: 'text' },
        { code: 'STATUS', label: 'Status', order: 5, description: 'Completion status', isRequired: true, fieldType: 'text' },
      ],
      isRequired: true,
      tenantCustomizable: true,
    },
    {
      code: 'SUMMARY_SCHEDULE',
      label: 'Summary Schedule',
      category: 'reporting',
      description: 'Summary of findings for reporting.',
      sections: [
        { code: 'FINDINGS_TABLE', label: 'Findings Summary', order: 1, description: 'Table of all findings', isRequired: true, fieldType: 'table' },
      ],
      isRequired: false,
      tenantCustomizable: true,
    },
    {
      code: 'SEFA',
      label: 'Schedule of Expenditures of Federal Awards',
      category: 'reporting',
      description: 'SEFA for Single Audits per 2 CFR 200.510(b).',
      referenceSection: '2 CFR 200.510(b)',
      sections: [
        { code: 'SEFA_TABLE', label: 'SEFA', order: 1, description: 'Schedule of expenditures by federal program', isRequired: true, fieldType: 'table' },
        { code: 'NOTES', label: 'Notes to SEFA', order: 2, description: 'Basis of presentation, significant policies, de minimis election', isRequired: true, fieldType: 'richtext' },
      ],
      isRequired: true,
      tenantCustomizable: false,
    },
  ],

  // ==========================================================================
  // SEMANTIC ELEMENT MAPPINGS
  // Maps GAGAS finding-element codes → canonical semantic codes for multi-
  // standard engagements. See references/multi-standard-design.md §4.
  // ==========================================================================
  semanticElementMappings: [
    {
      semanticCode: 'CRITERIA',
      packElementCode: 'CRITERIA',
      equivalenceStrength: 'exact',
      notes: 'GAGAS §6.39a — the required or desired state. Semantically identical across all methodology packs.',
    },
    {
      semanticCode: 'CONDITION',
      packElementCode: 'CONDITION',
      equivalenceStrength: 'exact',
      notes: 'GAGAS §6.39b — the situation that exists. Maps directly to IIA CONDITION and closely to ISO objective_evidence.',
    },
    {
      semanticCode: 'CAUSE',
      packElementCode: 'CAUSE',
      equivalenceStrength: 'exact',
      notes: 'GAGAS §6.39c — why the condition occurred. Same as IIA ROOT_CAUSE.',
    },
    {
      semanticCode: 'EFFECT',
      packElementCode: 'EFFECT',
      equivalenceStrength: 'exact',
      notes: 'GAGAS §6.39d — outcome or impact. Same as IIA CONSEQUENCE.',
    },
  ],

  // ==========================================================================
  // CROSSWALKS
  // ==========================================================================
  crosswalks: [
    {
      thisSection: '§3.26',
      thisDescription: 'Independence declarations per engagement',
      mappedStandardRef: 'IIA_GIAS:2024',
      mappedSection: 'Principle 2 / Standard 2.1',
      mappedDescription: 'Maintain Objectivity',
      mappingType: 'this_stricter',
      notes: 'GAGAS requires per-engagement declaration; IIA requires annual objectivity attestation. GAGAS cooling-off 24mo vs IIA 12mo.',
      confidence: 'curated',
    },
    {
      thisSection: '§6.39',
      thisDescription: 'Four elements of a finding (Criteria, Condition, Cause, Effect)',
      mappedStandardRef: 'IIA_GIAS:2024',
      mappedSection: 'Standard 15.1',
      mappedDescription: 'Finding elements (Criteria, Condition, Cause, Consequence, Recommendation)',
      mappingType: 'partial',
      notes: 'IIA adds inline Recommendation as 5th element; GAGAS keeps Recommendation separate.',
      confidence: 'curated',
    },
    {
      thisSection: '§4.16-4.26',
      thisDescription: 'CPE 80 hours / 2-year with 24 govt hours',
      mappedStandardRef: 'IIA_GIAS:2024',
      mappedSection: 'Standard 3.1',
      mappedDescription: 'CIA: 40 hours per year',
      mappingType: 'this_stricter',
      notes: 'GAGAS is stricter: 80/2yr vs 80/2yr equivalent for IIA CIA, PLUS 24 government-specific hours requirement.',
      confidence: 'authoritative',
    },
    {
      thisSection: '§5.01',
      thisDescription: '2024 Quality Management System (8 components)',
      mappedStandardRef: 'AICPA_SQMS:2024',
      mappedSection: 'SQMS 1',
      mappedDescription: 'Firm-level quality management system',
      mappingType: 'equivalent',
      notes: 'GAGAS 2024 aligned Chapter 5 with AICPA SQMS 1 and 2. Both effective Dec 15, 2025.',
      confidence: 'authoritative',
    },
    {
      thisSection: '§5.03',
      thisDescription: 'Engagement Quality Review before report issuance',
      mappedStandardRef: 'PCAOB_QC:2024',
      mappedSection: 'QC 1000',
      mappedDescription: 'Firm-level QC system with engagement quality review',
      mappingType: 'partial',
      notes: 'Both require engagement quality review. PCAOB QC 1000 effective Dec 15, 2026 (postponed from 2025).',
      confidence: 'authoritative',
    },
    {
      thisSection: '§6.33',
      thisDescription: 'Sufficient appropriate evidence',
      mappedStandardRef: 'IIA_GIAS:2024',
      mappedSection: 'Standard 14.1',
      mappedDescription: 'Conduct engagement work; obtain sufficient reliable relevant evidence',
      mappingType: 'equivalent',
      confidence: 'authoritative',
    },
  ],

  // ==========================================================================
  // DEPENDENCIES
  // ==========================================================================
  dependencies: [
    {
      standardRef: 'AICPA_AUC:current',
      type: 'incorporates',
      scope: {
        engagementTypes: ['FINANCIAL_AUDIT', 'SINGLE_AUDIT'],
      },
      description:
        'GAGAS financial audits MUST comply with both GAGAS Chapters 1-6 AND AICPA AU-C sections. GAGAS adds government-specific requirements on top of AU-C.',
      referenceSection: 'Chapter 7',
    },
    {
      standardRef: 'UNIFORM_GUIDANCE:2024',
      type: 'requires',
      scope: {
        engagementTypes: ['SINGLE_AUDIT'],
      },
      description: 'Single Audits require compliance with 2 CFR 200 Subpart F.',
      referenceSection: '2 CFR 200.500+',
    },
    {
      standardRef: 'COSO_IC:2013',
      type: 'references',
      scope: {
        engagementTypes: ['FINANCIAL_AUDIT', 'SINGLE_AUDIT'],
      },
      description: 'Internal control evaluation typically uses COSO 2013 framework.',
    },
  ],

  // ==========================================================================
  // APPLICABILITY
  // ==========================================================================
  applicability: {
    mandatoryFor: [
      {
        description: 'Federal agencies and Inspector General offices',
        sectors: ['US_FEDERAL_GOVERNMENT'],
        jurisdictions: ['US'],
        authorityReference: 'Inspector General Act; federal statutes requiring GAGAS',
      },
      {
        description: 'State and local governments receiving federal funds above Single Audit threshold',
        sectors: ['US_STATE_LOCAL_GOVERNMENT'],
        jurisdictions: ['US'],
        authorityReference: '2 CFR 200',
      },
      {
        description: 'Non-profit organizations receiving federal grants above Single Audit threshold',
        sectors: ['NONPROFIT'],
        jurisdictions: ['US'],
        authorityReference: '2 CFR 200',
      },
    ],
    recommendedFor: [
      {
        description: 'Government contractors subject to government audit requirements',
        sectors: ['PRIVATE_COMPANY'],
        jurisdictions: ['US'],
      },
    ],
    thresholds: [
      {
        type: 'federal_expenditures_single_audit',
        currency: 'USD',
        amount: 1000000,
        comparison: 'gte',
        triggers: 'Single Audit requirement under 2 CFR 200.501',
        authorityReference: '2 CFR 200.501 (2024 revision)',
        effectiveFrom: '2024-10-01',
      },
      {
        type: 'federal_expenditures_single_audit_legacy',
        currency: 'USD',
        amount: 750000,
        comparison: 'gte',
        triggers: 'Single Audit requirement (pre-2025 threshold)',
        authorityReference: '2 CFR 200.501 (prior to 2024 revision)',
        effectiveFrom: '2015-12-26',
        supersededOn: '2025-09-30',
      },
    ],
  },

  // ==========================================================================
  // SECTOR OVERLAYS
  // Single Audit was previously embedded here as sectorOverlays[0]. It has
  // been extracted into its own regulatory_overlay pack —
  // see examples/single-audit-overlay-2024.ts (code: SINGLE_AUDIT:2024).
  // Attach it as an additional pack on engagements that need it.
  // ==========================================================================

  // ==========================================================================
  // RISK RATINGS
  // ==========================================================================
  riskRatings: {
    levels: [
      { code: 'CRITICAL', label: 'Critical', color: '#DC2626', description: 'Requires immediate action', severity: 5 },
      { code: 'HIGH', label: 'High', color: '#EA580C', description: 'Significant risk requiring prompt attention', severity: 4 },
      { code: 'MEDIUM', label: 'Medium', color: '#D97706', description: 'Moderate risk, action within defined timeline', severity: 3 },
      { code: 'LOW', label: 'Low', color: '#2563EB', description: 'Minor risk, address as resources permit', severity: 2 },
      { code: 'INFORMATIONAL', label: 'Informational', color: '#6B7280', description: 'For management awareness only', severity: 1 },
    ],
    allowUnrated: false,
    requiresJustification: true,
  },

  // ==========================================================================
  // EVIDENCE RULES — §6.33
  // ==========================================================================
  evidenceRules: {
    referenceSection: '§6.33',
    sufficiencyCriteria:
      'Evidence must be sufficient in quantity to support conclusions. Consider nature of finding, materiality, risk, sensitivity.',
    appropriatenessCriteria:
      'Evidence must be appropriate: relevant (relates to audit objective), reliable (trustworthy, independent sources preferred), valid (measures what intended).',
    reliabilityHierarchy: [
      { order: 1, type: 'external_source', description: 'Evidence from independent external sources', reliability: 'high' },
      { order: 2, type: 'internal_strong_controls', description: 'Evidence from internal sources with strong controls', reliability: 'medium_high' },
      { order: 3, type: 'internal_weak_controls', description: 'Evidence from internal sources with weak controls', reliability: 'medium' },
      { order: 4, type: 'oral_corroborated', description: 'Oral evidence corroborated by documentation', reliability: 'medium' },
      { order: 5, type: 'oral_alone', description: 'Oral evidence alone', reliability: 'lower' },
    ],
    retentionPeriodYears: 7,
    experiencedAuditorStandard: true,
    chainOfCustodyRequired: true,
  },
};
