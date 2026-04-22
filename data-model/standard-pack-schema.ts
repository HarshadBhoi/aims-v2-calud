/**
 * AIMS v2 — Standard Pack Data Model
 *
 * A Standard Pack is the versioned configuration that drives a specific
 * audit framework (GAGAS, IIA GIAS, SOX, ISO 19011, etc.) within the
 * standard-agnostic audit engine.
 *
 * Design principles:
 * - Type safety end-to-end
 * - Versioning as first-class (every pack version is immutable)
 * - Effective date ranges for regulatory clarity
 * - Dependency resolution (e.g., GAGAS → AICPA AU-C)
 * - Conditional applicability (engagement type, jurisdiction, entity size)
 * - Extensibility without schema changes
 *
 * All references to standard paragraphs (e.g., §6.39) should be verified
 * against primary sources before production use.
 */

// =============================================================================
// 1. TOP-LEVEL STANDARD PACK
// =============================================================================

export interface StandardPack {
  /** Machine-readable identifier (e.g., "GAGAS", "IIA_GIAS", "SOX_PCAOB"). */
  code: string;

  /** Pack version (e.g., "2024", "2018", "2022"). Combined with code gives unique key. */
  version: string;

  /** Schema version for the StandardPack structure itself (semver). */
  schemaVersion: '1.1.0';

  /**
   * Discriminator distinguishing three semantic pack types. See
   * `references/multi-standard-design.md §3 Decision 1` for the taxonomy.
   *
   * - `methodology`         — how you audit (GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, ISSAI)
   * - `control_framework`   — what you audit against (SOC 2, ISO 27001, NIST 800-53, COBIT, HIPAA, PCI DSS)
   * - `regulatory_overlay`  — layered requirements (Single Audit 2 CFR 200, SOX §404, CSRD/ESRS)
   *
   * An Engagement MUST reference exactly one methodology pack as its primary,
   * and MAY reference additional methodology packs + control frameworks +
   * regulatory overlays.
   */
  packType: PackType;

  /** Metadata about the standard. */
  meta: StandardMeta;

  /** Regulatory status of this pack. */
  status: RegulatoryStatus;

  /** Terminology mappings (labels shown to users). */
  terminology: TerminologyMap;

  // ---------------------------------------------------------------------------
  // METHODOLOGY-SPECIFIC FIELDS
  //
  // Required when `packType === 'methodology'`; optional otherwise.
  //
  // `control_framework` packs provide control libraries (see below); they
  // inherit workflow/phases/findings from the engagement's host methodology.
  //
  // `regulatory_overlay` packs add deltas (e.g., additional finding elements,
  // extra reports) on top of a host methodology — they rarely define these
  // end-to-end. Validation Layer 5 (VALIDATION.md) enforces per-packType rules.
  // ---------------------------------------------------------------------------

  /** Engagement types supported by this standard. Methodology packs only. */
  engagementTypes?: EngagementTypeDefinition[];

  /** Lifecycle phases an engagement progresses through. Methodology packs only. */
  phases?: PhaseDefinition[];

  /** Finding element structure (3-5+ elements varying by standard). Methodology packs only. */
  findingElements?: FindingElementDefinition[];

  /** Finding classification schemes (e.g., MW/SD/D for SOX, Critical/Major/Minor for IIA). Methodology packs only. */
  findingClassifications?: FindingClassificationScheme[];

  /** Quality assurance checklists, independence declarations, peer review. Methodology packs only. */
  checklists?: ChecklistDefinition[];

  /** Independence and objectivity requirements. Methodology packs only. */
  independenceRules?: IndependenceRules;

  /** Continuing Professional Education / Development rules. Methodology packs only. */
  cpeRules?: CPERules;

  /** Approval workflows (standard-specific review chains). Methodology packs only. */
  workflows?: WorkflowDefinition[];

  /** Report structure definitions. Methodology packs only. */
  reportDefinitions?: ReportDefinition[];

  /** Template definitions (planning memo, work programs, etc.). Methodology packs only. */
  templates?: TemplateDefinition[];

  /**
   * Mappings from this pack's finding-element codes to canonical semantic
   * codes (CRITERIA / CONDITION / CAUSE / EFFECT / ...). Enables multi-standard
   * engagements to populate Finding.coreElements consistently regardless of
   * which methodology is primary. See `references/multi-standard-design.md §4`.
   */
  semanticElementMappings: SemanticElementMapping[];

  /** Crosswalks to other standards. */
  crosswalks: CrosswalkEntry[];

  /** Dependencies on other standard packs (e.g., GAGAS incorporates AU-C). */
  dependencies: StandardDependency[];

  /** Who must/should apply this standard. */
  applicability: ApplicabilityRules;

  /** Optional sector-specific extensions. */
  sectorOverlays?: SectorOverlay[];

  /** Risk rating scheme used by this standard. Methodology packs only. */
  riskRatings?: RiskRatingScheme;

  /** Evidence requirements (what constitutes sufficient evidence). Methodology packs only. */
  evidenceRules?: EvidenceRules;

  // ---------------------------------------------------------------------------
  // CONTROL FRAMEWORK CONTENT
  //
  // Required when `packType === 'control_framework'`; absent otherwise.
  // ---------------------------------------------------------------------------

  /**
   * Control library — the testable controls this framework defines.
   * Required for `control_framework` packs (SOC 2, ISO 27001, NIST 800-53, ...).
   */
  controls?: ControlDefinition[];

  /**
   * Logical grouping of controls (e.g., SOC 2's CC1-CC9 Common Criteria;
   * NIST 800-53's control families). Used for report organization +
   * navigation.
   */
  controlCategories?: ControlCategory[];

  // ---------------------------------------------------------------------------
  // REGULATORY OVERLAY CONTENT
  //
  // Meaningful when `packType === 'regulatory_overlay'`. Overlay packs add
  // deltas on top of a host methodology, declared via `dependencies`.
  // ---------------------------------------------------------------------------

  /**
   * Additional finding elements the overlay contributes (e.g., Single Audit's
   * questioned costs, federal program, repeat indicator). Rendered when
   * the overlay is attached to an engagement.
   */
  additionalFindingElements?: FindingElementDefinition[];

  /**
   * Additional reports required by the overlay (e.g., Single Audit's Schedule
   * of Findings and Questioned Costs, SEFA, Corrective Action Plan).
   */
  additionalReports?: ReportDefinition[];

  /**
   * Additional checklists required by the overlay.
   */
  additionalChecklists?: ChecklistDefinition[];

  /**
   * Overlay-specific overrides to host methodology rules. E.g., a 7-year
   * retention requirement from SOX §802 overriding AICPA's 5-year default.
   * Applied via the strictness resolver (see tenant-data-model.ts
   * EngagementStrictness).
   */
  ruleOverrides?: OverlayRuleOverrides;

  /** Any pack-specific custom fields (extensibility escape hatch). */
  extensions?: Record<string, unknown>;
}

// =============================================================================
// 2. METADATA
// =============================================================================

export interface StandardMeta {
  /** Human-readable name (e.g., "Generally Accepted Government Auditing Standards"). */
  name: string;

  /** Short common name (e.g., "Yellow Book", "Global Internal Audit Standards"). */
  commonName?: string;

  /** Body that issues the standard. */
  issuingBody: IssuingBody;

  /** Official URL for the standard. */
  referenceUrl?: string;

  /** Year of publication (first release of this version). */
  publishedYear: number;

  /** ISO 8601 date when pack version becomes effective. */
  effectiveFrom: string;

  /** ISO 8601 date when pack version is superseded (null if current). */
  effectiveTo?: string;

  /** Early adoption permitted before effectiveFrom? */
  earlyAdoptionAllowed: boolean;

  /** Prior version code:version reference (e.g., "GAGAS:2018"). */
  previousVersion?: string;

  /** Deadline by which transition from previous version must complete. */
  transitionDeadline?: string;

  /** High-level description of the standard. */
  description: string;

  /** Sectors this standard primarily serves. */
  primarySectors: Sector[];

  /** Jurisdictions where this standard is authoritative. */
  jurisdictions: Jurisdiction[];

  /** Tags for search/categorization. */
  tags?: string[];
}

export interface IssuingBody {
  /** Name (e.g., "U.S. Government Accountability Office"). */
  name: string;

  /** Abbreviation (e.g., "GAO", "IIA", "PCAOB"). */
  abbreviation: string;

  /** Country/region. */
  country: string;

  /** Official URL. */
  url?: string;
}

export type Sector =
  | 'US_FEDERAL_GOVERNMENT'
  | 'US_STATE_LOCAL_GOVERNMENT'
  | 'INTERNATIONAL_GOVERNMENT'
  | 'PUBLIC_COMPANY'
  | 'PRIVATE_COMPANY'
  | 'NONPROFIT'
  | 'HEALTHCARE'
  | 'FINANCIAL_SERVICES'
  | 'EDUCATION'
  | 'MANUFACTURING'
  | 'TECHNOLOGY'
  | 'ENERGY_UTILITIES'
  | 'DEFENSE_CONTRACTOR'
  | 'ALL_SECTORS';

export type Jurisdiction =
  | 'US'
  | 'EU'
  | 'UK'
  | 'CA'
  | 'AU'
  | 'IN'
  | 'JP'
  | 'CN'
  | 'BR'
  | 'GLOBAL';

export type RegulatoryStatus =
  | 'PROPOSED'       // Under consultation / NPRM
  | 'FINAL_PENDING'  // Adopted, awaiting effective date
  | 'EFFECTIVE'      // Currently in force
  | 'TRANSITIONING'  // Superseded but transition period ongoing
  | 'SUPERSEDED'     // No longer applicable
  | 'WITHDRAWN'      // Withdrawn (e.g., SEC Climate Rule)
  | 'IN_LITIGATION'; // Status unclear due to court action

/**
 * Three-tier pack taxonomy. See `references/multi-standard-design.md §3
 * Decision 1` for rationale.
 *
 * Distinguishing these prevents conflating *how you audit* (methodology)
 * with *what you audit against* (control framework) with *what layers on
 * top* (regulatory overlay). Competitors (ServiceNow IRM, AuditBoard,
 * TeamMate+) blur these; keeping them separate is both a correctness gain
 * and a competitive differentiator.
 */
export type PackType =
  | 'methodology'          // GAGAS, IIA GIAS, ISO 19011, PCAOB AS 2201, ISSAI
  | 'control_framework'    // SOC 2, ISO 27001, NIST 800-53, COBIT, HIPAA, PCI DSS, CIS
  | 'regulatory_overlay';  // Single Audit (2 CFR 200), SOX §404, CSRD/ESRS

// =============================================================================
// 3. TERMINOLOGY
// =============================================================================

/**
 * Every user-facing label in the UI should come from the active Standard Pack.
 * This allows "Auditor-in-Charge" (GAGAS) vs "Engagement Supervisor" (IIA)
 * vs "Engagement Partner" (SOX) to render contextually.
 */
export interface TerminologyMap {
  // Roles
  auditor: Term;
  leadAuditor: Term;          // AIC, Engagement Supervisor, Lead Auditor
  headOfFunction: Term;        // Audit Director, CAE, Auditor General
  supervisor: Term;
  qaReviewer: Term;            // EQR Reviewer, QAIP Reviewer, Concurring Partner
  auditee: Term;               // Auditee, Engagement Client, Organization

  // Core entities
  engagement: Term;            // Engagement, Audit, Assessment
  finding: Term;               // Finding, Observation, Nonconformity, Control Deficiency
  recommendation: Term;        // Recommendation, Corrective Action Request, Remediation Plan
  workpaper: Term;             // Workpaper, Working Paper, Audit Documentation
  correctiveAction: Term;      // CAP, Follow-Up, Management Action Plan

  // Phases & activities
  fieldwork: Term;             // Fieldwork, Testing, Examination
  planning: Term;
  reporting: Term;
  followUp: Term;

  // Documents
  planningMemo: Term;          // Audit Planning Memorandum, Engagement Plan
  auditCharter?: Term;         // IIA-specific
  workProgram: Term;
  auditReport: Term;

  // Quality
  independence: Term;
  peerReview?: Term;
  qaChecklist: Term;

  // Other
  managementResponse: Term;    // Management Response, CAP, Views of Responsible Officials
  riskAcceptance?: Term;       // IIA-specific
}

export interface Term {
  /** Primary term (e.g., "Auditor-in-Charge"). */
  label: string;

  /** Short form for constrained UI (e.g., "AIC"). */
  shortLabel?: string;

  /** Plural form (e.g., "Auditors-in-Charge"). */
  plural?: string;

  /** Contextual help text shown in tooltip/help. */
  helpText?: string;

  /** Alternative labels accepted (for search/import). */
  aliases?: string[];
}

// =============================================================================
// 4. ENGAGEMENT TYPES
// =============================================================================

export interface EngagementTypeDefinition {
  /** Unique code within the pack (e.g., "FINANCIAL_AUDIT"). */
  code: string;

  /** User-facing label. */
  label: string;

  /** Description shown when user selects this type. */
  description: string;

  /** Which standard paragraph/clause defines this engagement type. */
  referenceSection?: string;

  /** Phase codes applicable to this engagement type. Subset of pack.phases. */
  applicablePhases: string[];

  /** Default workflow code to use. */
  defaultWorkflowCode: string;

  /** Required documents/deliverables (template codes from pack.templates). */
  requiredTemplates: string[];

  /** Required checklists (codes from pack.checklists). */
  requiredChecklists: string[];

  /** Minimum team composition requirements. */
  teamRequirements?: TeamRequirement;

  /** Default risk assessment methodology. */
  defaultRiskMethodology?: string;

  /** Whether this engagement type supports multiple standards simultaneously. */
  supportsMultiStandard: boolean;

  /** Tags for filtering. */
  tags?: string[];
}

export interface TeamRequirement {
  /** Minimum number of team members. */
  minMembers: number;

  /** Required roles (at least one person must have each). */
  requiredRoles: string[];

  /** Competency requirements beyond CPE. */
  competencyRequirements?: string[];
}

// =============================================================================
// 5. PHASES
// =============================================================================

export interface PhaseDefinition {
  /** Code (e.g., "PLANNING", "FIELDWORK"). */
  code: string;

  /** Display label. */
  label: string;

  /** Order within the lifecycle (1-based). */
  order: number;

  /** Description of the phase. */
  description: string;

  /** Criteria that must be met to exit this phase. */
  exitCriteria: ExitCriterion[];

  /** Required documents that must exist before phase exit. */
  requiredDocuments?: string[];

  /** Required approvals before phase exit. */
  requiredApprovals?: string[];

  /** Whether this phase can be skipped. */
  isOptional: boolean;
}

export interface ExitCriterion {
  /** Unique code. */
  code: string;

  /** Human description. */
  description: string;

  /** Reference to standard (e.g., "§7.05"). */
  referenceSection?: string;

  /** How to validate (manual checkbox vs automated rule). */
  validationType: 'manual_checkbox' | 'automated_rule' | 'document_present' | 'approval_complete';
}

// =============================================================================
// 6. FINDING ELEMENTS
// =============================================================================

/**
 * The most important standard-specific configuration.
 * GAGAS = 4 elements, IIA = 5 elements (+ recommendation inline),
 * SOX = 3-6 elements including severity classification,
 * ISO 19011 = 3 elements, COBIT = 4 elements.
 */
export interface FindingElementDefinition {
  /** Code (e.g., "CRITERIA", "CONDITION", "CAUSE", "EFFECT"). */
  code: string;

  /** Display label (e.g., "Criteria", "Root Cause"). */
  label: string;

  /** Description shown to auditor. */
  description: string;

  /** Detailed guidance for populating this element. */
  helpText: string;

  /** Example content shown as placeholder/guidance. */
  example?: string;

  /** Is this element required? (some standards make elements optional). */
  isRequired: boolean;

  /** UI field type. */
  fieldType: FindingFieldType;

  /** Minimum character length (where applicable). */
  minLength?: number;

  /** Maximum character length. */
  maxLength?: number;

  /** For select fields, the options. */
  options?: SelectOption[];

  /** Reference to standard paragraph. */
  referenceSection?: string;

  /** Display order in the form. */
  order: number;
}

export type FindingFieldType =
  | 'text'
  | 'richtext'
  | 'select'
  | 'multi-select'
  | 'number'
  | 'currency'
  | 'date'
  | 'checkbox_group'
  | 'file_upload';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  color?: string; // For badges
}

// =============================================================================
// 7. FINDING CLASSIFICATIONS
// =============================================================================

export interface FindingClassificationScheme {
  /** Code (e.g., "GAGAS_RISK_RATING", "SOX_DEFICIENCY_TIER", "IIA_SEVERITY"). */
  code: string;

  /** Display label (e.g., "Risk Rating", "Severity"). */
  label: string;

  /** Description. */
  description: string;

  /** Classification levels from highest to lowest severity. */
  levels: ClassificationLevel[];

  /** Whether this scheme is required on every finding. */
  isRequired: boolean;

  /** Whether auditee management response changes classification. */
  allowsReclassification: boolean;
}

export interface ClassificationLevel {
  /** Code (e.g., "MATERIAL_WEAKNESS", "SIGNIFICANT_DEFICIENCY", "DEFICIENCY"). */
  code: string;

  /** Display label. */
  label: string;

  /** Short code for badges (e.g., "MW", "SD", "D"). */
  shortLabel?: string;

  /** Description / criteria for this level. */
  description: string;

  /** Color hex for UI badges. */
  color: string;

  /** Numeric severity (higher = more severe). */
  severity: number;

  /** Reference to standard. */
  referenceSection?: string;

  /** Whether this level requires special reporting/escalation. */
  requiresEscalation: boolean;
}

// =============================================================================
// 8. CHECKLISTS
// =============================================================================

export interface ChecklistDefinition {
  /** Code (e.g., "QA_REVIEW", "INDEPENDENCE", "PEER_REVIEW", "QAIP"). */
  code: string;

  /** Display label. */
  label: string;

  /** Category for grouping. */
  category: ChecklistCategory;

  /** Description. */
  description: string;

  /** Reference to standard requiring this checklist. */
  referenceSection?: string;

  /** Items grouped by section. */
  sections: ChecklistSection[];

  /** Who completes this checklist. */
  assigneeRole: string;

  /** When is this completed? */
  completionPoint: 'per_engagement' | 'annual' | 'per_fieldwork_phase' | 'per_quarter' | 'once';

  /** Is this mandatory for the engagement type? */
  isRequired: boolean;

  /** Passing criteria (e.g., "all required items answered"). */
  passingCriteria: string;
}

export type ChecklistCategory =
  | 'QUALITY_ASSURANCE'
  | 'INDEPENDENCE'
  | 'PEER_REVIEW'
  | 'SUPERVISORY_REVIEW'
  | 'QAIP'
  | 'ENGAGEMENT_QUALITY_REVIEW'
  | 'COMPLIANCE_AUDIT'
  | 'CONTROL_TESTING'
  | 'SECTOR_SPECIFIC';

export interface ChecklistSection {
  code: string;
  title: string;
  description?: string;
  order: number;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  code: string;
  text: string;
  helpText?: string;
  referenceSection?: string;
  isRequired: boolean;
  responseType: ChecklistResponseType;
  /** Applicable engagement type codes (empty = all). */
  applicableEngagementTypes?: string[];
  /** Weight in overall score (if scored). */
  weight?: number;
  /** Minimum evidence required (e.g., "workpaper_attached"). */
  evidenceRequired?: string[];
  order: number;
}

export type ChecklistResponseType =
  | 'yes_no'
  | 'yes_no_na'
  | 'rating_1_5'
  | 'rating_satisfactory'  // Satisfactory / Needs Improvement / Unsatisfactory
  | 'conformance'           // Generally / Partially / Does Not Conform (IIA QAIP)
  | 'text'
  | 'checkbox'
  | 'date'
  | 'file';

// =============================================================================
// 9. INDEPENDENCE RULES
// =============================================================================

export interface IndependenceRules {
  /** Reference to standard. */
  referenceSection: string;

  /** Declaration required per engagement? Per year? */
  declarationFrequency: 'per_engagement' | 'annual' | 'biannual';

  /** Cooling-off period in months (time after operational role before auditing). */
  coolingOffPeriodMonths: number;

  /** Partner rotation requirement (if applicable, in years). */
  partnerRotationYears?: number;

  /** Specific threats to evaluate (GAGAS conceptual framework). */
  threatTypes: IndependenceThreat[];

  /** Declaration form structure. */
  declarationForm: IndependenceDeclarationForm;

  /** Non-audit services evaluation required? */
  nonAuditServicesEvaluation: boolean;

  /** Prohibited non-audit services (SOX §201 list, IIA list, etc.). */
  prohibitedNonAuditServices?: string[];

  /** Safeguards framework (where to document mitigations). */
  safeguardsFramework: boolean;
}

export interface IndependenceThreat {
  code: string;
  label: string;
  description: string;
  examples: string[];
}

export interface IndependenceDeclarationForm {
  sections: {
    code: string;
    label: string;
    questions: {
      code: string;
      text: string;
      responseType: 'yes_no' | 'yes_no_na' | 'text';
      followUpIfYes?: boolean;
      referenceSection?: string;
    }[];
  }[];
}

// =============================================================================
// 10. CPE RULES
// =============================================================================

export interface CPERules {
  /** Required hours in the cycle. */
  hoursRequired: number;

  /** Cycle length. */
  cycleType: 'annual' | 'biennial' | 'triennial' | 'rolling_2_year' | 'rolling_3_year';

  /** Per-year minimum (if cycle > 1 year). */
  annualMinimum?: number;

  /** Topic-specific requirements. */
  topicRequirements?: CPETopicRequirement[];

  /** Accepted activity types. */
  acceptedActivityTypes: string[];

  /** Max self-study percentage. */
  maxSelfStudyPercent?: number;

  /** Reference to standard. */
  referenceSection: string;
}

export interface CPETopicRequirement {
  /** Topic name (e.g., "government auditing"). */
  topic: string;

  /** Hours required in this topic. */
  hoursRequired: number;

  /** Description of qualifying content. */
  qualifyingContent: string;
}

// =============================================================================
// 11. WORKFLOWS
// =============================================================================

export interface WorkflowDefinition {
  /** Code (e.g., "ENGAGEMENT_APPROVAL", "FINDING_APPROVAL", "REPORT_APPROVAL"). */
  code: string;

  /** Display label. */
  label: string;

  /** Entity type this applies to. */
  entityType: WorkflowEntityType;

  /** Description. */
  description: string;

  /** Workflow steps in order. */
  steps: WorkflowStep[];

  /** SLA in days for the whole workflow. */
  slaTargetDays?: number;

  /** Can auditee see the workflow status? */
  visibleToAuditee: boolean;
}

export type WorkflowEntityType =
  | 'engagement'
  | 'planning_document'
  | 'finding'
  | 'recommendation'
  | 'report'
  | 'workpaper'
  | 'independence_declaration'
  | 'qa_checklist'
  | 'corrective_action';

export interface WorkflowStep {
  /** Order (1-based). */
  order: number;

  /** Display label (e.g., "Supervisor Review"). */
  label: string;

  /** Description. */
  description?: string;

  /** Role required to perform this step. */
  requiredRole: string;

  /** Can be skipped (e.g., when EQR not required). */
  isOptional: boolean;

  /** Auto-advance on approval? */
  autoAdvanceOnApproval: boolean;

  /** SLA for this step in business days. */
  slaDays?: number;

  /** Actions allowed. */
  allowedActions: WorkflowAction[];

  /** Reference to standard. */
  referenceSection?: string;
}

export type WorkflowAction =
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'delegate'
  | 'recall'
  | 'add_comments';

// =============================================================================
// 12. REPORT DEFINITIONS
// =============================================================================

export interface ReportDefinition {
  /** Code (e.g., "AUDIT_REPORT", "YELLOW_BOOK_REPORT", "SINGLE_AUDIT_REPORT"). */
  code: string;

  /** Display label. */
  label: string;

  /** Description. */
  description: string;

  /** Required sections in order. */
  sections: ReportSection[];

  /** Default output format. */
  defaultFormat: 'pdf' | 'docx' | 'html';

  /** Page size and orientation. */
  pageLayout?: PageLayout;

  /** Required for which engagement types? */
  requiredForEngagementTypes: string[];

  /** Reference to standard specifying this report. */
  referenceSection: string;

  /** Distribution requirements. */
  distribution: ReportDistribution;
}

export interface ReportSection {
  code: string;
  label: string;
  order: number;
  description: string;
  isRequired: boolean;
  contentType: 'template' | 'auto_generated' | 'rich_text' | 'table' | 'attestation_statement';
  templateReference?: string;        // If contentType is 'template'
  autoGeneratedFrom?: string;        // E.g., "findings", "recommendations", "team"
  referenceSection?: string;
  maxLength?: number;
  /** Conditional rendering (e.g., only if findings exist). */
  renderCondition?: string;
}

export interface PageLayout {
  size: 'letter' | 'a4' | 'legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header?: string;
  footer?: string;
}

export interface ReportDistribution {
  /** Required recipients. */
  required: string[];

  /** Recommended recipients. */
  recommended?: string[];

  /** Public availability required? */
  publicDistribution: boolean;

  /** Confidentiality classification. */
  confidentialityLevel: 'public' | 'restricted' | 'confidential';
}

// =============================================================================
// 13. TEMPLATES
// =============================================================================

export interface TemplateDefinition {
  /** Code (e.g., "PLANNING_MEMO", "WORK_PROGRAM", "SUMMARY_SCHEDULE"). */
  code: string;

  /** Display label. */
  label: string;

  /** Category. */
  category: 'planning' | 'fieldwork' | 'reporting' | 'follow_up' | 'other';

  /** Description. */
  description: string;

  /** Reference to standard. */
  referenceSection?: string;

  /** Template sections/fields. */
  sections: TemplateSection[];

  /** Is this template mandatory for the engagement? */
  isRequired: boolean;

  /** Can be customized per tenant? */
  tenantCustomizable: boolean;
}

export interface TemplateSection {
  code: string;
  label: string;
  order: number;
  description: string;
  isRequired: boolean;
  helpText?: string;
  defaultContent?: string;
  fieldType: 'richtext' | 'text' | 'table' | 'checklist' | 'calculation';
  referenceSection?: string;
}

// =============================================================================
// 14. CROSSWALKS
// =============================================================================

export interface CrosswalkEntry {
  /** This standard's section. */
  thisSection: string;

  /** Short description of this requirement. */
  thisDescription: string;

  /** The mapped standard code:version. */
  mappedStandardRef: string;

  /** The corresponding section in the mapped standard. */
  mappedSection: string;

  /** Short description of mapped requirement. */
  mappedDescription: string;

  /** How they map. */
  mappingType: CrosswalkMappingType;

  /** Notes explaining the mapping nuance. */
  notes?: string;

  /** Confidence level (curated vs auto-generated). */
  confidence: 'authoritative' | 'curated' | 'suggested';
}

export type CrosswalkMappingType =
  | 'equivalent'        // Both standards say essentially the same thing
  | 'partial'           // Overlap but each has unique aspects
  | 'related'           // Related concept, different approach
  | 'this_stricter'     // This standard has stricter requirement
  | 'mapped_stricter'   // Other standard has stricter requirement
  | 'no_equivalent';    // This requirement has no counterpart

// =============================================================================
// 15. DEPENDENCIES
// =============================================================================

export interface StandardDependency {
  /** The standard pack this depends on (code:version or code:current). */
  standardRef: string;

  /** Type of dependency. */
  type: DependencyType;

  /** When this dependency applies. */
  scope: DependencyScope;

  /** Human explanation. */
  description: string;

  /** Reference to standard stating the dependency. */
  referenceSection?: string;
}

export type DependencyType =
  | 'incorporates'     // Standard A incorporates B by reference (GAGAS → AU-C)
  | 'overlays'         // A is applied on top of B (HIPAA overlays NIST CSF)
  | 'extends'          // A extends B with additional requirements (GAGAS extends AICPA)
  | 'requires'         // A cannot be applied without B
  | 'references';      // A references B for certain topics

export interface DependencyScope {
  /** Specific engagement types where this dependency applies (empty = all). */
  engagementTypes?: string[];

  /** Specific phases where it applies. */
  phases?: string[];

  /** Specific finding element codes where it applies. */
  findingElements?: string[];
}

// =============================================================================
// 16. APPLICABILITY RULES
// =============================================================================

export interface ApplicabilityRules {
  /** Mandatory for these sectors. */
  mandatoryFor: ApplicabilityCondition[];

  /** Recommended for these sectors. */
  recommendedFor?: ApplicabilityCondition[];

  /** Not applicable for these sectors. */
  notApplicableFor?: ApplicabilityCondition[];

  /** Dollar thresholds that trigger applicability. */
  thresholds?: ApplicabilityThreshold[];
}

export interface ApplicabilityCondition {
  /** Human description. */
  description: string;

  /** Sector applicability. */
  sectors?: Sector[];

  /** Jurisdiction. */
  jurisdictions?: Jurisdiction[];

  /** Entity size/type conditions. */
  entityConditions?: string[];

  /** Reference to authority (law, regulation). */
  authorityReference?: string;
}

export interface ApplicabilityThreshold {
  /** Threshold type (e.g., "federal_expenditures", "public_float", "annual_revenue"). */
  type: string;

  /** Currency. */
  currency?: string;

  /** Threshold amount. */
  amount: number;

  /** Comparison operator. */
  comparison: 'gte' | 'gt' | 'lte' | 'lt';

  /** What applicability this triggers. */
  triggers: string;

  /** Reference to authority. */
  authorityReference?: string;

  /** Effective date of this threshold. */
  effectiveFrom: string;

  /** Superseded date. */
  supersededOn?: string;
}

// =============================================================================
// 17. SECTOR OVERLAYS
// =============================================================================

/**
 * Sector overlays extend a base standard pack with sector-specific requirements.
 * E.g., Single Audit overlay on top of GAGAS; HIPAA overlay on healthcare engagements.
 */
export interface SectorOverlay {
  code: string;
  label: string;
  sector: Sector;
  description: string;
  referenceSection?: string;

  /** Additional checklists. */
  additionalChecklists?: ChecklistDefinition[];

  /** Additional finding elements (e.g., questioned costs for Single Audit). */
  additionalFindingElements?: FindingElementDefinition[];

  /** Additional report sections. */
  additionalReportSections?: ReportSection[];

  /** Additional applicability thresholds. */
  additionalThresholds?: ApplicabilityThreshold[];

  /** Extensions. */
  extensions?: Record<string, unknown>;
}

// =============================================================================
// 18. RISK RATING SCHEME
// =============================================================================

export interface RiskRatingScheme {
  /** Levels of risk from highest to lowest. */
  levels: RiskRatingLevel[];

  /** Allow unrated findings? */
  allowUnrated: boolean;

  /** Requires risk factor documentation. */
  requiresJustification: boolean;
}

export interface RiskRatingLevel {
  code: string;
  label: string;
  shortLabel?: string;
  color: string;
  description: string;
  severity: number;
}

// =============================================================================
// 19. EVIDENCE RULES
// =============================================================================

export interface EvidenceRules {
  /** Reference to standard. */
  referenceSection: string;

  /** Evidence sufficiency criteria. */
  sufficiencyCriteria: string;

  /** Evidence appropriateness criteria. */
  appropriatenessCriteria: string;

  /** Reliability hierarchy (most to least reliable). */
  reliabilityHierarchy: EvidenceReliabilityLevel[];

  /** Document retention period (years). */
  retentionPeriodYears: number;

  /** Experienced auditor standard applies? */
  experiencedAuditorStandard: boolean;

  /** Require chain of custody for digital evidence? */
  chainOfCustodyRequired: boolean;
}

export interface EvidenceReliabilityLevel {
  order: number;
  type: string;
  description: string;
  reliability: 'high' | 'medium_high' | 'medium' | 'lower';
}

// =============================================================================
// 20. CONTROL FRAMEWORK CONTENT (for packType === 'control_framework')
// =============================================================================

/**
 * A testable control defined by a control framework pack.
 *
 * Examples:
 * - SOC 2 CC6.1: "The entity implements logical access security software..."
 * - ISO 27001 A.5.17: "Authentication information shall be controlled..."
 * - NIST 800-53 AC-2: "The organization manages information system accounts..."
 *
 * Controls are the atoms of compliance. Engagements test controls from
 * attached `control_framework` packs against evidence gathered during
 * fieldwork. Same control may appear in multiple frameworks via crosswalks.
 */
export interface ControlDefinition {
  /** Control code (e.g., "CC6.1", "A.5.17", "AC-2"). */
  code: string;

  /** Short control title. */
  title: string;

  /** Full control statement. */
  description: string;

  /** Category code — references `controlCategories[].code`. */
  categoryCode: string;

  /**
   * Points of focus / sub-criteria the auditor should consider. SOC 2 uses
   * this heavily (each control has 5-20 points of focus per COSO 2013).
   */
  pointsOfFocus?: string[];

  /**
   * Typical test approach — guidance for auditors on how to test this
   * control. Non-prescriptive; methodology pack's workflow still governs.
   */
  testingGuidance?: string;

  /**
   * Trust Service Criteria category (SOC 2-specific). E.g., "Security",
   * "Availability", "Processing Integrity", "Confidentiality", "Privacy".
   */
  trustServiceCriteria?: string[];

  /**
   * Maps this control to other frameworks' controls — for the "test once,
   * satisfy many" pattern. Uses `StandardPackKey` format.
   */
  frameworkCrosswalks?: Array<{
    frameworkRef: StandardPackKey;    // e.g., "ISO_27001:2022"
    controlCode: string;              // e.g., "A.5.17"
    equivalence: 'exact' | 'close' | 'partial' | 'related';
    notes?: string;
  }>;

  /** Reference to framework document section (e.g., "§C1.1", "Clause 5.17"). */
  referenceSection?: string;

  /** Tags for filtering (e.g., "iam", "logging", "encryption"). */
  tags?: string[];
}

/**
 * A logical grouping of controls within a framework.
 *
 * Examples:
 * - SOC 2: "Common Criteria — Control Environment (CC1)"
 * - ISO 27001: "Organizational controls (A.5)"
 * - NIST 800-53: "Access Control (AC)"
 */
export interface ControlCategory {
  /** Category code (e.g., "CC1", "A.5", "AC"). */
  code: string;

  /** Display label. */
  label: string;

  /** Description of the category's scope. */
  description: string;

  /** Display order. */
  order: number;

  /** Optional parent category code (for hierarchical frameworks). */
  parentCode?: string;
}

// =============================================================================
// 20b. REGULATORY OVERLAY RULE OVERRIDES (for packType === 'regulatory_overlay')
// =============================================================================

/**
 * Overlay-specific overrides to host methodology rules. Feeds the strictness
 * resolver — see tenant-data-model.ts `EngagementStrictness`.
 *
 * Example: SOX §802 overrides the host methodology's documentation retention
 * with a 7-year requirement; Single Audit adds a peer review cycle constraint.
 */
export interface OverlayRuleOverrides {
  /** Override documentation retention (years). */
  documentationRetentionYears?: number;

  /** Override independence cooling-off (years). */
  independenceCoolingOffYears?: number;

  /** Override total CPE hours per 2-year cycle. */
  cpeHoursPer2Years?: number;

  /** Additional governmental CPE hours required (GAGAS-style). */
  governmentalCpeHours?: number;

  /** Override peer review cycle (years). */
  peerReviewCycleYears?: number;

  /**
   * Any additional overrides as free-form key-value pairs. Pack authors
   * document the semantics in their own docs.
   */
  additional?: Record<string, string | number | boolean>;
}

// =============================================================================
// 21. SEMANTIC ELEMENT DICTIONARY
// =============================================================================

/**
 * Canonical semantic element codes. Packs declare which of these they
 * support via `semanticElementMappings` and may extend with additional
 * codes for specialized methodologies (e.g., COBIT capability-gap codes).
 *
 * Using `string` in the union keeps the enum extensible — pack authors
 * can introduce new codes without a schema change. The codes below are
 * the shipped baseline every finding-shaped pack should consider.
 *
 * See `references/multi-standard-design.md §4`.
 */
export type SemanticElementCode =
  // Classical finding elements (GAGAS, IIA, ISO)
  | 'CRITERIA'
  | 'CONDITION'
  | 'CAUSE'
  | 'EFFECT'
  | 'RECOMMENDATION'
  | 'EVIDENCE'
  // ISO-specific
  | 'NC_CLAUSE'              // specific standard clause violated (ISO 19011 Cl. 6.4)
  // Single Audit overlay
  | 'QUESTIONED_COST'        // dollar amount questioned (2 CFR 200.516)
  // PCAOB / SOX
  | 'ASSERTION_AFFECTED'     // E/C/V/R/P/D per AS 2201 ¶A3
  // COBIT (shipped empty; populated when COBIT pack lands)
  | 'CAPABILITY_TARGET'
  | 'CAPABILITY_CURRENT'
  | 'CAPABILITY_GAP'
  // Escape hatch — packs may declare custom codes
  | (string & {});

/**
 * Pack authors declare how their finding-element codes map to canonical
 * semantic codes. The audit engine uses these mappings to populate
 * `Finding.coreElements` consistently across methodologies.
 *
 * Example: GAGAS 2024 declares its `criteria` field maps to `CRITERIA`
 * with `exact` strength; ISO 19011:2018 declares its `audit_criteria`
 * field maps to `CRITERIA` with `close` strength (ISO narrows to a
 * specific clause reference).
 */
export interface SemanticElementMapping {
  /** Canonical semantic code. */
  semanticCode: SemanticElementCode;

  /**
   * The code inside this pack's `findingElements` array that carries
   * the value for this semantic slot. Must match a `FindingElementDefinition.code`
   * in the same pack.
   */
  packElementCode: string;

  /**
   * How closely the pack's field semantically matches the canonical code.
   * - `exact`       — identical semantics, safe to treat as the same field
   * - `close`       — same slot but with narrower or broader scope
   * - `overlapping` — meaningful overlap; specialist interpretation needed
   * - `divergent`   — mapped for completeness but semantics differ materially
   */
  equivalenceStrength: 'exact' | 'close' | 'overlapping' | 'divergent';

  /** Human-readable explanation of any nuance (why not `exact`). */
  notes?: string;
}

// =============================================================================
// 22. PACK REFERENCES + TENANT-SCOPE
// =============================================================================

/**
 * String form of a pack identifier, used for internal pack-to-pack references
 * inside `CrosswalkEntry.mappedStandardRef`, `StandardDependency.standardRef`,
 * `StandardMeta.previousVersion`, and the JSON-map keys in
 * `Finding.standardExtensions` (tenant-data).
 *
 * Format: `${code}:${version}` — e.g., `"GAGAS:2024"`.
 *
 * For tenant-level attachments (Engagement's primary + additional packs),
 * use the richer `StandardPackRef` interface which carries scope +
 * conformance attestation flags.
 */
export type StandardPackKey = `${string}:${string}`;

/**
 * Tenant-scope discriminator on a pack reference.
 *
 * - `'global'`       — the shipped, vendor-managed pack (default)
 * - `tenant:${id}`   — a customer-authored override of a global pack (Q6)
 *
 * Q6 (see design note) is deferred as an implementation feature; the schema
 * reserves the namespace now so future tenant overrides can be added without
 * refactoring every entity that references a pack.
 */
export type StandardPackScope = 'global' | `tenant:${string}`;

/**
 * Rich pack reference used on Engagement, Finding, Report, Recommendation,
 * and other tenant-data entities that attach packs to runtime records.
 *
 * This is distinct from `StandardPackKey` (the internal string form used
 * inside pack bodies for crosswalks/dependencies). Runtime references
 * carry additional context — scope (Q6) and conformance-attestation (Q3).
 */
export interface StandardPackRef {
  /** Pack code (e.g., `"GAGAS"`). */
  packCode: string;

  /** Pack version (e.g., `"2024"`). */
  packVersion: string;

  /**
   * Scope of the pack — `global` for vendor-shipped packs, `tenant:<id>`
   * for a customer-authored override (Q6 — deferred implementation).
   * Omit to default to `'global'`.
   */
  scope?: StandardPackScope;

  /**
   * Applies only when this reference is attached to an `Engagement`.
   *
   * `true`  — the engagement claims conformance with this pack in its
   *           final report (pack is listed in the "conducted in
   *           accordance with…" sentence).
   * `false` — the engagement *applies* this pack's methodology (uses
   *           its workflow, finding shape) but does not claim formal
   *           conformance. Useful for shops using IIA methodology
   *           without meeting GIAS Std 15.1's QAIP requirement.
   *
   * Defaults to `true` when this pack is the engagement's primary
   * methodology; defaults to `false` otherwise unless explicitly set.
   *
   * Q3 (see design note).
   */
  conformanceClaimed?: boolean;
}

// =============================================================================
// 23. HELPERS
// =============================================================================

/**
 * Extract the string-form key for a pack (e.g., `"GAGAS:2024"`).
 */
export function packKey(pack: StandardPack): StandardPackKey {
  return `${pack.code}:${pack.version}`;
}

/**
 * Build a tenant-ready `StandardPackRef` from a `StandardPack`.
 * Defaults to global scope; callers set `conformanceClaimed` and
 * `scope` as needed for their engagement.
 */
export function toStandardPackRef(
  pack: StandardPack,
  overrides: Partial<Omit<StandardPackRef, 'packCode' | 'packVersion'>> = {},
): StandardPackRef {
  return {
    packCode: pack.code,
    packVersion: pack.version,
    scope: overrides.scope ?? 'global',
    ...(overrides.conformanceClaimed !== undefined
      ? { conformanceClaimed: overrides.conformanceClaimed }
      : {}),
  };
}

/**
 * Parse a `StandardPackKey` string back into its parts.
 */
export function parsePackKey(key: StandardPackKey): { code: string; version: string } {
  const idx = key.indexOf(':');
  if (idx === -1) throw new Error(`Invalid StandardPackKey: ${key}`);
  return { code: key.slice(0, idx), version: key.slice(idx + 1) };
}

/**
 * Check if a pack is currently effective.
 */
export function isPackEffective(pack: StandardPack, asOf: Date = new Date()): boolean {
  const effectiveFrom = new Date(pack.meta.effectiveFrom);
  const effectiveTo = pack.meta.effectiveTo ? new Date(pack.meta.effectiveTo) : null;
  if (asOf < effectiveFrom) return pack.meta.earlyAdoptionAllowed;
  if (effectiveTo && asOf > effectiveTo) return false;
  return pack.status === 'EFFECTIVE' || pack.status === 'TRANSITIONING';
}

/**
 * Type guard — narrow a pack to methodology packs only. Useful when
 * resolving an Engagement's `primaryMethodology` in type-safe code.
 */
export function isMethodologyPack(pack: StandardPack): boolean {
  return pack.packType === 'methodology';
}

/**
 * Type guard — narrow a pack to control framework packs only.
 */
export function isControlFrameworkPack(pack: StandardPack): boolean {
  return pack.packType === 'control_framework';
}

/**
 * Type guard — narrow a pack to regulatory overlay packs only.
 */
export function isRegulatoryOverlayPack(pack: StandardPack): boolean {
  return pack.packType === 'regulatory_overlay';
}
