/**
 * SOC 2 — Trust Services Criteria (2017 revision)
 *
 * Control framework pack demonstrating the `control_framework` packType
 * in the three-tier standard-pack taxonomy.
 *
 * SOC 2 is NOT an audit methodology — it is a control framework. Audits
 * *against* SOC 2 use methodology packs (typically AICPA AT-C §105/§205
 * for attestation engagements; PCAOB AS for public-company contexts).
 * This pack provides the control library; the methodology pack attached
 * to the engagement provides workflow, finding shape, and report format.
 *
 * Authority:
 *   - AICPA Trust Services Criteria (2017 revision, with 2022 points of focus update)
 *   - TSP Section 100 "Trust Services Criteria"
 *   - Related: AT-C §105, AT-C §205 (AICPA SSAE 21 attestation standards)
 *
 * Scope — five categories, with Security always required; others optional:
 *   - CC — Common Criteria (Security) — 9 criteria categories, 33+ criteria
 *   - A  — Availability (3 criteria)
 *   - PI — Processing Integrity (5 criteria)
 *   - C  — Confidentiality (2 criteria)
 *   - P  — Privacy (8 criteria)
 *
 * This pack ships the Common Criteria (Security) — the universal baseline.
 * Availability / PI / Confidentiality / Privacy criteria can be added as
 * additional entries when the engagement scope includes those TSCs.
 *
 * Authored 2026-04-20 to stress-test the `control_framework` packType
 * introduced in schema v1.1.0. See references/multi-standard-design.md §3
 * Decision 1.
 */

import type { StandardPack } from '../standard-pack-schema';

export const soc22017: StandardPack = {
  code: 'SOC2',
  version: '2017',
  schemaVersion: '1.1.0',
  packType: 'control_framework',

  // ==========================================================================
  // METADATA
  // ==========================================================================
  meta: {
    name: 'SOC 2 — Trust Services Criteria',
    commonName: 'SOC 2',
    issuingBody: {
      name: 'American Institute of Certified Public Accountants',
      abbreviation: 'AICPA',
      country: 'US',
      url: 'https://www.aicpa-cima.com',
    },
    referenceUrl: 'https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services',
    publishedYear: 2017,
    effectiveFrom: '2017-12-15',
    earlyAdoptionAllowed: false,
    description:
      'SOC 2 Trust Services Criteria (TSC) is the AICPA-published control framework for service organizations that store or process customer data. Used as the "what you audit against" in SOC 2 engagements — the methodology (AT-C §105/§205 attestation procedures) is separate. Common Criteria (Security) is universal; Availability, Processing Integrity, Confidentiality, and Privacy are additional categories customers elect based on their commitments.',
    primarySectors: ['TECHNOLOGY', 'PUBLIC_COMPANY', 'PRIVATE_COMPANY', 'FINANCIAL_SERVICES', 'HEALTHCARE'],
    jurisdictions: ['US', 'GLOBAL'],  // widely used globally even though AICPA is US
    tags: ['soc2', 'trust-services-criteria', 'aicpa', 'service-organizations', 'attestation'],
  },

  status: 'EFFECTIVE',

  // ==========================================================================
  // TERMINOLOGY (minimal — control-framework packs inherit most from
  // the host methodology)
  // ==========================================================================
  terminology: {
    auditor: { label: 'Service Auditor', plural: 'Service Auditors' },
    leadAuditor: { label: 'Engagement Partner', shortLabel: 'EP' },
    headOfFunction: { label: 'Firm Audit Leader' },
    supervisor: { label: 'Supervisor' },
    qaReviewer: { label: 'EQR Reviewer', helpText: 'Engagement Quality Reviewer per PCAOB AS 1220 / AICPA QM 1' },
    auditee: { label: 'Service Organization', plural: 'Service Organizations' },
    engagement: { label: 'SOC 2 Engagement', plural: 'SOC 2 Engagements' },
    finding: {
      label: 'Control Exception',
      plural: 'Control Exceptions',
      helpText: 'A deviation from expected control operation identified during testing. May or may not represent a deficiency depending on severity.',
    },
    recommendation: {
      label: 'Management Observation',
      helpText: 'SOC 2 reports communicate exceptions to management; formal auditor-issued "recommendations" are limited to preserve attest-engagement independence under AT-C.',
    },
    workpaper: { label: 'Workpaper' },
    correctiveAction: { label: 'Management Response' },
    fieldwork: { label: 'Testing' },
    planning: { label: 'Planning' },
    reporting: { label: 'Reporting' },
    followUp: { label: 'Subsequent Review' },
    planningMemo: { label: 'Engagement Letter + Planning Memo' },
    workProgram: { label: 'Control Test Plan' },
    auditReport: { label: 'SOC 2 Report' },
    independence: { label: 'Independence', helpText: 'AICPA independence rules — see AT-C §105 and ET §1.200' },
    qaChecklist: { label: 'Engagement QC Checklist' },
    managementResponse: { label: 'Management Assertion' },
  },

  // ==========================================================================
  // SEMANTIC ELEMENT MAPPINGS
  // SOC 2 (as a control framework) does not define its own finding schema —
  // findings inherit from the host methodology. This array is therefore
  // empty. Crosswalks below describe how SOC 2 controls map to other
  // frameworks' controls (that's where this pack's intellectual content lives).
  // ==========================================================================
  semanticElementMappings: [],

  // ==========================================================================
  // CONTROL CATEGORIES — Common Criteria organization
  // ==========================================================================
  controlCategories: [
    {
      code: 'CC1',
      label: 'Control Environment',
      description: 'The entity\'s commitment to integrity + ethical values, board oversight, organizational structure, and personnel competence.',
      order: 1,
    },
    {
      code: 'CC2',
      label: 'Communication and Information',
      description: 'Internal and external communication of information to support controls.',
      order: 2,
    },
    {
      code: 'CC3',
      label: 'Risk Assessment',
      description: 'Identification, analysis, and response to risks that threaten the achievement of objectives.',
      order: 3,
    },
    {
      code: 'CC4',
      label: 'Monitoring Activities',
      description: 'Ongoing and separate evaluations to ascertain whether controls are present and functioning.',
      order: 4,
    },
    {
      code: 'CC5',
      label: 'Control Activities',
      description: 'Actions established through policies and procedures to mitigate risks.',
      order: 5,
    },
    {
      code: 'CC6',
      label: 'Logical and Physical Access Controls',
      description: 'Controls over logical and physical access to systems and data.',
      order: 6,
    },
    {
      code: 'CC7',
      label: 'System Operations',
      description: 'Controls over system operations — change detection, incident management, configuration, capacity.',
      order: 7,
    },
    {
      code: 'CC8',
      label: 'Change Management',
      description: 'Controls over changes to infrastructure, data, software, and procedures.',
      order: 8,
    },
    {
      code: 'CC9',
      label: 'Risk Mitigation',
      description: 'Controls to mitigate identified risks including vendor management and business disruption.',
      order: 9,
    },
    // Availability (A), Processing Integrity (PI), Confidentiality (C),
    // Privacy (P) categories would extend this when those TSCs are in scope.
  ],

  // ==========================================================================
  // CONTROLS — Common Criteria (Security) — representative sample
  // Full SOC 2 library has ~33+ Common Criteria controls; showing a cross-
  // section here to demonstrate the pack shape. Real production pack would
  // include the complete library with all points of focus per COSO 2013.
  // ==========================================================================
  controls: [
    {
      code: 'CC1.1',
      title: 'Commitment to Integrity and Ethical Values',
      description: 'The entity demonstrates a commitment to integrity and ethical values.',
      categoryCode: 'CC1',
      pointsOfFocus: [
        'Sets the tone at the top via the Board of Directors',
        'Establishes standards of conduct via a code of conduct',
        'Evaluates adherence to standards of conduct',
        'Addresses deviations in a timely manner',
      ],
      testingGuidance: 'Inspect code of conduct + acknowledgment records. Inquire about enforcement. Review disciplinary actions for deviations.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC1.1',
      tags: ['governance', 'culture', 'coso-p1'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.5.1',
          equivalence: 'close',
          notes: 'Both address tone at the top via policy; ISO 27001 is more prescriptive about policy documentation.',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'PM-1',
          equivalence: 'close',
          notes: 'NIST "Information Security Program Plan" covers similar governance commitment.',
        },
      ],
    },
    {
      code: 'CC6.1',
      title: 'Logical Access Security Software and Infrastructure',
      description: 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.',
      categoryCode: 'CC6',
      pointsOfFocus: [
        'Identifies and manages the inventory of information assets',
        'Restricts logical access to authorized personnel through authentication',
        'Manages credentials for infrastructure and software',
        'Uses encryption for data in transit and at rest where appropriate',
        'Protects encryption keys',
      ],
      testingGuidance: 'Inspect access control configurations. Test authentication mechanisms (MFA required for privileged). Review encryption implementation (TLS, KMS). Walkthrough credential lifecycle.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC6.1',
      tags: ['access-control', 'authentication', 'encryption', 'iam'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.5.17',
          equivalence: 'close',
          notes: 'ISO 27001 A.5.17 "Authentication information" — narrower (authentication only), SOC 2 CC6.1 broader (access + encryption).',
        },
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.5',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.5 "Secure authentication".',
        },
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.24',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.24 "Use of cryptography".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'AC-2',
          equivalence: 'partial',
          notes: 'NIST AC-2 is account management; SOC 2 CC6.1 broader scope.',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'IA-2',
          equivalence: 'close',
          notes: 'NIST IA-2 is identification + authentication.',
        },
        {
          frameworkRef: 'HIPAA:2024',
          controlCode: '164.312(a)',
          equivalence: 'close',
          notes: 'HIPAA Security Rule Access Control standard.',
        },
      ],
    },
    {
      code: 'CC6.6',
      title: 'Boundary Protection',
      description: 'The entity implements logical access security measures to protect against threats from sources outside its system boundaries.',
      categoryCode: 'CC6',
      pointsOfFocus: [
        'Restricts access to information assets via network segmentation, firewalls, and other boundary protection',
        'Protects information during transmission',
        'Implements intrusion detection and prevention',
      ],
      testingGuidance: 'Review firewall rules, WAF configuration, network segmentation diagrams. Test boundary protections via observed scans or vendor-supplied pen test results.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC6.6',
      tags: ['network-security', 'firewall', 'boundary'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.20',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.20 "Networks security".',
        },
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.21',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.21 "Security of network services".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'SC-7',
          equivalence: 'close',
          notes: 'NIST SC-7 Boundary Protection.',
        },
      ],
    },
    {
      code: 'CC7.2',
      title: 'System Monitoring',
      description: 'The entity monitors system components for anomalies indicative of malicious acts, natural disasters, and errors affecting the entity\'s ability to meet its objectives.',
      categoryCode: 'CC7',
      pointsOfFocus: [
        'Implements detection policies, procedures, and tools',
        'Investigates and resolves identified anomalies',
      ],
      testingGuidance: 'Review monitoring tooling (SIEM, IDS, application logs). Sample detected anomalies and investigation evidence.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC7.2',
      tags: ['monitoring', 'siem', 'anomaly-detection'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.16',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.16 "Monitoring activities".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'SI-4',
          equivalence: 'close',
          notes: 'NIST SI-4 Information System Monitoring.',
        },
      ],
    },
    {
      code: 'CC7.3',
      title: 'Security Incident Evaluation',
      description: 'The entity evaluates security events to determine whether they could or have resulted in a failure of the entity to meet its objectives.',
      categoryCode: 'CC7',
      pointsOfFocus: [
        'Responds to security incidents via an incident response plan',
        'Communicates security incidents to appropriate parties',
      ],
      testingGuidance: 'Inspect IR plan. Sample recent incidents; trace from detection through resolution + communication evidence.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC7.3',
      tags: ['incident-response', 'security'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.5.24',
          equivalence: 'close',
          notes: 'ISO 27001 A.5.24 "Information security incident management planning and preparation".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'IR-4',
          equivalence: 'close',
          notes: 'NIST IR-4 Incident Handling.',
        },
      ],
    },
    {
      code: 'CC8.1',
      title: 'Change Management',
      description: 'The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.',
      categoryCode: 'CC8',
      pointsOfFocus: [
        'Manages changes throughout the system development lifecycle',
        'Authorizes changes',
        'Designs and develops changes',
        'Documents changes',
        'Tests system changes',
        'Approves system changes',
        'Deploys system changes',
        'Identifies and evaluates system changes affecting availability / security',
      ],
      testingGuidance: 'Review change management ticketing system. Sample N recent changes; trace through authorization + testing + approval + deployment records.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC8.1',
      tags: ['change-management', 'sdlc', 'devops'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.8.32',
          equivalence: 'close',
          notes: 'ISO 27001 A.8.32 "Change management".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'CM-3',
          equivalence: 'close',
          notes: 'NIST CM-3 Configuration Change Control.',
        },
      ],
    },
    {
      code: 'CC9.1',
      title: 'Risk Mitigation Activities',
      description: 'The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.',
      categoryCode: 'CC9',
      pointsOfFocus: [
        'Considers mitigation of risks of business disruptions',
        'Considers insurance mitigation',
      ],
      testingGuidance: 'Review business continuity plan + DR testing evidence. Confirm insurance coverage relevant to claimed TSCs.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC9.1',
      tags: ['bcp', 'dr', 'resilience'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.5.29',
          equivalence: 'close',
          notes: 'ISO 27001 A.5.29 "Information security during disruption".',
        },
      ],
    },
    {
      code: 'CC9.2',
      title: 'Vendor and Business Partner Risk Management',
      description: 'The entity assesses and manages risks associated with vendors and business partners.',
      categoryCode: 'CC9',
      pointsOfFocus: [
        'Establishes requirements for vendor and business partner engagements',
        'Assesses vendor and business partner risks',
        'Monitors vendor and business partner performance',
        'Addresses non-performance via remediation or termination',
      ],
      testingGuidance: 'Inspect vendor risk management program. Sample vendors; review risk assessments + contract provisions + monitoring evidence.',
      trustServiceCriteria: ['Security'],
      referenceSection: 'TSP §CC9.2',
      tags: ['vendor-risk', 'third-party-risk'],
      frameworkCrosswalks: [
        {
          frameworkRef: 'ISO_27001:2022',
          controlCode: 'A.5.19',
          equivalence: 'close',
          notes: 'ISO 27001 A.5.19 "Information security in supplier relationships".',
        },
        {
          frameworkRef: 'NIST_800_53:R5',
          controlCode: 'SA-9',
          equivalence: 'close',
          notes: 'NIST SA-9 External System Services.',
        },
      ],
    },
  ],

  // ==========================================================================
  // CROSSWALKS (cross-framework, structured in the `crosswalks` field for
  // cross-pack reference; finer-grained crosswalks live inside each control's
  // `frameworkCrosswalks` array above)
  // ==========================================================================
  crosswalks: [
    {
      thisSection: 'CC1-CC9 (Common Criteria)',
      thisDescription: 'SOC 2 Trust Services Criteria — Security',
      mappedStandardRef: 'ISO_27001:2022',
      mappedSection: 'Annex A (93 controls in 4 themes)',
      mappedDescription: 'ISO 27001 Information Security Management System controls',
      mappingType: 'partial',
      notes: 'SOC 2 CC and ISO 27001 Annex A have significant overlap (80%+) but different organization. Control-level crosswalks within each SOC 2 control\'s frameworkCrosswalks array.',
      confidence: 'curated',
    },
    {
      thisSection: 'CC1-CC9',
      thisDescription: 'SOC 2 Common Criteria',
      mappedStandardRef: 'NIST_CSF:2.0',
      mappedSection: '6 Functions / 106 Subcategories',
      mappedDescription: 'NIST Cybersecurity Framework 2.0',
      mappingType: 'partial',
      notes: 'SOC 2 maps well to NIST CSF Govern/Identify/Protect/Detect/Respond/Recover. NIST CSF is more principle-based; SOC 2 is testable-control-based.',
      confidence: 'curated',
    },
    {
      thisSection: 'CC1-CC9',
      thisDescription: 'SOC 2 Common Criteria',
      mappedStandardRef: 'HIPAA:2024',
      mappedSection: '§164.308, §164.310, §164.312',
      mappedDescription: 'HIPAA Security Rule Administrative, Physical, and Technical Safeguards',
      mappingType: 'partial',
      notes: 'SOC 2 is broader (service-organization-general); HIPAA is healthcare-PHI-specific. Many SOC 2 controls satisfy HIPAA requirements.',
      confidence: 'curated',
    },
  ],

  // ==========================================================================
  // DEPENDENCIES
  // SOC 2 as a control framework has no methodology-pack dependency — it
  // can be attached to any methodology pack. It does implicitly rely on
  // COSO 2013 for the internal control conceptual framework (as noted below).
  // ==========================================================================
  dependencies: [
    {
      standardRef: 'COSO_IC:2013',
      type: 'incorporates',
      scope: {},
      description: 'SOC 2 Common Criteria are structured per the COSO 2013 Internal Control Integrated Framework. Points of focus under each control derive from COSO 2013 principles.',
      referenceSection: 'TSP §100 introduction',
    },
  ],

  // ==========================================================================
  // APPLICABILITY
  // ==========================================================================
  applicability: {
    recommendedFor: [
      {
        description: 'Service organizations that store or process customer data (SaaS, cloud, data processors)',
        sectors: ['TECHNOLOGY', 'FINANCIAL_SERVICES', 'HEALTHCARE', 'PUBLIC_COMPANY', 'PRIVATE_COMPANY'],
        jurisdictions: ['US', 'GLOBAL'],
      },
    ],
    notApplicableFor: [
      {
        description: 'Entities without information processing obligations to user organizations (SOC 2 is specifically for service organizations)',
      },
    ],
  },

  // ==========================================================================
  // NOTE ON OMITTED FIELDS
  // SOC 2 is a control_framework pack; it does NOT define its own:
  //   - engagementTypes, phases, workflows, reportDefinitions, templates
  //     (these come from the methodology pack — typically AICPA AT-C)
  //   - findingElements, findingClassifications
  //     (these come from the methodology pack; SOC 2 exceptions are classified
  //     by the methodology's scheme, not a SOC 2-specific one)
  //   - checklists, independenceRules, cpeRules
  //     (methodology concerns)
  //   - riskRatings, evidenceRules
  //     (methodology concerns)
  // These fields are optional on StandardPack per schema v1.1.0.
  //
  // For an engagement testing controls against SOC 2 Common Criteria, attach:
  //   primaryMethodology: AICPA_AT_C:CURRENT (or similar methodology pack)
  //   controlFrameworks:  [SOC2:2017]
  //   additionalMethodologies: []  // or [GAGAS:2024] if government-entity SOC 2
  // ==========================================================================
};
