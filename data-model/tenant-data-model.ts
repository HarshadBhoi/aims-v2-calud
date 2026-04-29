/**
 * AIMS v2 — Tenant Runtime Data Model
 *
 * These types describe the shape of customer-generated records — Engagement,
 * Finding, Recommendation, Report — as opposed to pack definitions (which
 * live in `standard-pack-schema.ts`).
 *
 * Packs define *structure*; tenant data carries *values*. Every tenant-data
 * record references one or more packs via `StandardPackRef` (the rich
 * object form), not by `StandardPackKey` (the internal string form).
 *
 * Architecture decisions captured here are resolved in
 * `references/multi-standard-design.md`:
 *  - Decision 2: Engagement carries primary methodology + additional + control
 *                frameworks + regulatory overlays (not flat multi-select).
 *  - Decision 3: Finding has a semantic core + per-pack extensions +
 *                per-pack classifications. coreElements is extensible.
 *  - Decision 4: Recommendation is a separate entity with M:N links to
 *                findings.
 *  - Decision 5: Report attests to a specific pack (multi-report per
 *                engagement is first-class).
 *  - Q1: SOX suppresses recommendations via a flag on Finding; no separate
 *        SOX-deficiency entity.
 *
 * These types reference `StandardPackRef` from the pack schema but do not
 * re-declare pack content.
 */

import type {
  StandardPackRef,
  StandardPackKey,
  SemanticElementCode,
} from './standard-pack-schema';

// =============================================================================
// 1. SHARED SCALARS
// =============================================================================

/** Rich text content (sanitized HTML); stored as a string in DB. */
export type RichText = string;

/** ISO 8601 timestamp string. */
export type IsoDateTime = string;

/** ISO 8601 date string (no time). */
export type IsoDate = string;

/** Opaque tenant identifier. */
export type TenantId = string;

/** Opaque user identifier. */
export type UserId = string;

// =============================================================================
// 2. ENGAGEMENT
// =============================================================================

/**
 * Five modes an engagement can take. The mode clarifies how its attached
 * standard packs relate to each other — driving workflow, reporting, and
 * conformance-statement assembly.
 */
export type EngagementMode =
  | 'single'              // one methodology, no additional packs (most common)
  | 'integrated'          // PCAOB AS 2201 (FS + ICFR combined, two opinions)
  | 'statutory_stacked'   // Single Audit (GAGAS + Uniform Guidance by statute)
  | 'combined'            // ISO IMS (9001 + 14001 + 27001 per IAF MD 11)
  | 'in_conjunction';     // GAGAS "in conjunction with" IIA — elective

/**
 * An audit engagement — the central customer-facing workflow entity.
 *
 * An engagement attaches to exactly one *primary methodology* pack that
 * drives its workflow, default finding schema, and report skeleton.
 * Zero-to-many *additional methodologies*, *control frameworks*, and
 * *regulatory overlays* layer on top per Decision 2 in the design note.
 */
export interface Engagement {
  id: string;
  tenantId: TenantId;

  /** Engagement title (customer-set). */
  title: string;

  /**
   * The methodology pack that drives this engagement's workflow, finding
   * shape, approval chain, and default report structure. Must reference a
   * pack with `packType === 'methodology'`.
   */
  primaryMethodology: StandardPackRef;

  /**
   * Additional methodology packs applied to this engagement, ordered by
   * applicability. Examples: GAGAS (primary) + IIA GIAS (additional) for
   * a public-sector internal audit shop.
   */
  additionalMethodologies: StandardPackRef[];

  /**
   * Control framework packs the engagement tests against. Examples:
   * SOC 2, ISO 27001, NIST 800-53, COBIT. Each must reference a pack
   * with `packType === 'control_framework'`.
   */
  controlFrameworks: StandardPackRef[];

  /**
   * Regulatory overlay packs layered on top (Single Audit, SOX §404,
   * CSRD/ESRS). Each must reference a pack with
   * `packType === 'regulatory_overlay'`.
   */
  regulatoryOverlays: StandardPackRef[];

  /** How the multi-standard structure should be interpreted. */
  engagementMode: EngagementMode;

  /** Engagement status (customer workflow state; distinct from pack workflow). */
  status: EngagementStatus;

  /** Dates. */
  plannedStartDate?: IsoDate;
  plannedEndDate?: IsoDate;
  actualStartDate?: IsoDate;
  actualEndDate?: IsoDate;

  /** Team (UserId references). */
  leadAuditorId: UserId;
  teamMemberIds: UserId[];

  /** Auditee. */
  auditeeOrganizationId?: string;
  auditeeContactIds?: UserId[];

  /**
   * Computed strictness values — the max/stricter across all active packs.
   * Recomputed on pack attachment/detachment; see Decision 6.
   */
  strictness?: EngagementStrictness;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy: UserId;
}

export type EngagementStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'FIELDWORK'
  | 'REPORTING'
  | 'IN_REVIEW'
  | 'ISSUED'
  | 'CLOSED'
  | 'CANCELLED';

/**
 * Strictness resolver output — the union of rules from all active packs.
 * Computed at engagement creation and recomputed on any pack change.
 *
 * For each rule, we record *which pack drove the value* so the audit trail
 * answers "why is retention 7 years on this engagement?" — even after
 * packs change or versions are superseded.
 *
 * Decision 6 in the design note.
 */
export interface EngagementStrictness {
  /** Max across active packs. PCAOB=7 > AICPA=5 > IIA=unset. */
  documentationRetentionYears: number;
  /** Max cooling-off period; GAGAS tends to be strictest. */
  independenceCoolingOffYears: number;
  /** Union (auditor must satisfy all). GAGAS 80/2yr + CIA 40/yr both apply. */
  cpeHoursPer2Years: number;
  /** Min (shorter = stricter). GAGAS 3yr < IIA 5yr. */
  peerReviewCycleYears: number;
  /** GAGAS-specific; zero unless GAGAS is attached. */
  governmentalCpeHours: number;

  /** Audit trail — which pack drove each value. */
  drivenBy: {
    documentationRetentionYears: StandardPackRef;
    independenceCoolingOffYears: StandardPackRef;
    cpeHoursPer2Years: StandardPackRef;
    peerReviewCycleYears: StandardPackRef;
    governmentalCpeHours?: StandardPackRef;
  };
}

// =============================================================================
// 3. FINDING
// =============================================================================

/**
 * Severity classification — per-pack. The same finding may carry
 * multiple classifications (e.g., GAGAS "Significant Deficiency" +
 * IIA "Major") that legitimately disagree because they're measured
 * against different yardsticks.
 */
export interface FindingClassification {
  /** Which pack's scheme is being used. */
  packRef: StandardPackRef;
  /** Scheme code within the pack (e.g., "GAGAS_DEFICIENCY_TIER"). */
  schemeCode: string;
  /** Level code within the scheme (e.g., "SIGNIFICANT_DEFICIENCY"). */
  levelCode: string;
}

/**
 * An audit finding — the central audit-evidence entity.
 *
 * Findings use a semantic core (populated via canonical codes regardless
 * of which methodology drove their creation) plus per-pack extensions
 * for fields unique to a specific standard (e.g., Single Audit's
 * questioned costs, ISO 19011's clause reference).
 *
 * Decision 3 in the design note.
 */
export interface Finding {
  id: string;
  tenantId: TenantId;
  engagementId: string;

  /** Customer-set title (short summary). */
  title: string;

  /**
   * SEMANTIC CORE — element values keyed by canonical codes.
   *
   * Classical packs (GAGAS, IIA, ISO) populate CRITERIA/CONDITION/CAUSE/EFFECT.
   * Capability-assessment packs (COBIT) populate CAPABILITY_TARGET/CURRENT/GAP.
   *
   * The shape is `Record<SemanticElementCode, RichText>` so pack authors
   * can introduce new semantic codes (via their `semanticElementMappings`)
   * without requiring a schema change — Q2 resolution.
   */
  coreElements: Record<SemanticElementCode, RichText>;

  /**
   * PER-PACK EXTENSIONS — pack-specific extra fields.
   *
   * Key = `StandardPackKey` string form (e.g., `"SINGLE_AUDIT:2024"`).
   * Value = an object whose shape is defined by that pack's
   * `findingElements` (beyond the semantic core).
   *
   * Example:
   *   { "SINGLE_AUDIT:2024": { questionedCost: 12500, alnNumber: "93.778", repeatFinding: false } }
   */
  standardExtensions: Record<StandardPackKey, Record<string, unknown>>;

  /**
   * CLASSIFICATIONS — per-pack severity/category labels.
   * A single finding may carry multiple classifications when it's
   * reportable under multiple packs.
   */
  classifications: FindingClassification[];

  /**
   * Which methodology packs this finding is reported under. Subset of
   * the engagement's primary + additional methodologies.
   */
  applicableMethodologies: StandardPackRef[];

  /**
   * SOX-specific behavior flag (Q1 — Option A).
   *
   * When `true`, recommendations attached to this finding are suppressed
   * from published reports. Set by the SOX/PCAOB methodology pack because
   * auditor-issued recommendations on ICFR violate AS 2201 + AS 1305
   * independence rules (recommending + testing = self-review threat).
   *
   * Rendering is controlled by the report template's
   * `recommendationPresentation` — this flag just marks findings that
   * warrant suppressed treatment regardless of template choice.
   */
  soxSuppressRecommendation?: boolean;

  /** Status in the finding's own approval workflow. */
  status: FindingStatus;

  /** If locked, no further edits (post-issuance immutability). */
  lockedAt?: IsoDateTime;

  /** Authorship + audit trail. */
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy: UserId;
  assignedTo?: UserId;

  /** Optimistic concurrency. */
  version: number;
}

export type FindingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'CLOSED';

// =============================================================================
// 4. RECOMMENDATION (separate entity — Decision 4)
// =============================================================================

/**
 * An auditor's recommendation. Separate from Finding because the
 * relationship is many-to-many:
 *  - GAGAS §6.47 permits one recommendation addressing multiple findings
 *  - A finding may have zero, one, or many recommendations
 *  - ISO "Opportunity for Improvement" is a distinct finding type, not
 *    a Finding-with-recommendation
 *  - SOX ICFR suppresses recommendations from the published report
 *    entirely (auditor independence) — but they may still exist
 *    internally for audit-committee-only communication
 *
 * Rendering varies by report template: consolidated section (GAGAS),
 * inline with finding (IIA), or suppressed (SOX).
 */
export interface Recommendation {
  id: string;
  tenantId: TenantId;
  engagementId: string;

  /**
   * Findings this recommendation addresses. M:N — one rec → many findings.
   */
  findingIds: string[];

  /** Short title / summary. */
  title: string;

  /** Full recommendation text. */
  body: RichText;

  /** Priority (customer workflow; packs may rename the scheme). */
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

  /** Target completion date for the corrective action. */
  targetCompletionDate?: IsoDate;

  /** Assignee on the auditee side (if tracked). */
  assignedToAuditeeUserId?: UserId;

  /** Management response / CAP reference. */
  managementResponse?: RichText;
  correctiveActionPlanId?: string;

  /** Status. */
  status: RecommendationStatus;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy: UserId;
  version: number;
}

export type RecommendationStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'WITHDRAWN';

// =============================================================================
// 5. REPORT (multi-report per engagement — Decision 5)
// =============================================================================

/**
 * A published audit report. One engagement may produce multiple reports,
 * each attesting to a specific pack.
 *
 * The Single Audit case is the canonical example: one engagement emits
 *   1. FS opinion (AICPA AU-C / GAAS)
 *   2. Yellow Book report (GAGAS §6.02)
 *   3. Schedule of findings + questioned costs (2 CFR 200.515(d))
 *   4. Summary schedule of prior audit findings (2 CFR 200.511)
 *   5. Corrective action plan (2 CFR 200.511)
 *
 * Each is a separate `Report` with its own `attestsTo` reference.
 */
export interface Report {
  id: string;
  tenantId: TenantId;
  engagementId: string;

  /** Which pack this report conforms to. */
  attestsTo: StandardPackRef;

  /**
   * Report type discriminator (pack-specific — values come from the
   * pack's `reportDefinitions`). Examples: `"fs_opinion"`,
   * `"yellow_book_report"`, `"single_audit_compliance"`,
   * `"iso_nc_report"`.
   */
  reportType: string;

  /** Report title. */
  title: string;

  /** Report body — structured per the pack's `ReportDefinition.sections`. */
  sections: ReportSectionContent[];

  /**
   * Which findings this report includes. A finding may appear in multiple
   * reports (e.g., a Single Audit finding appearing in both the Yellow
   * Book report and the Single Audit compliance report per §200.515(d)).
   */
  includedFindingIds: string[];

  /**
   * Which recommendations this report includes. Typically the recommendations
   * linked to the included findings, filtered by pack rendering rules
   * (e.g., SOX reports exclude all recommendations).
   */
  includedRecommendationIds: string[];

  /** Published status. */
  status: ReportStatus;
  issuedAt?: IsoDateTime;
  publishedAt?: IsoDateTime;

  /** Generated PDF / docx artifact references. */
  artifacts: ReportArtifact[];

  /** Locked after issuance — no further edits (immutability). */
  lockedAt?: IsoDateTime;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy: UserId;
  version: number;
}

/** Content for one section of a report — maps to a `ReportSection` in the pack definition. */
export interface ReportSectionContent {
  sectionCode: string;   // matches pack.reportDefinitions[].sections[].code
  heading: string;
  body: RichText;
}

export type ReportStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'ISSUED'
  | 'PUBLISHED'
  | 'RETRACTED';

export interface ReportArtifact {
  id: string;
  kind: 'pdf' | 'docx' | 'html';
  storageKey: string;     // S3 or equivalent
  sha256: string;
  sizeBytes: number;
  generatedAt: IsoDateTime;
}

// =============================================================================
// 6. CONTROL MATRIX (PRCM) — separate entity per ADR-0008
// =============================================================================

/**
 * A process-risk-control matrix row. Documents the control universe for an
 * engagement during planning; audit tests then *exercise* these controls.
 *
 * Multi-standard hooks:
 *  - Control taxonomies (type/nature/frequency) are stable across COSO,
 *    ISO 31000, COBIT, and GAGAS — modeled as enums.
 *  - Pack-specific attributes (e.g., COSO 2013 component code, ISO 27001
 *    Annex A clause, NIST 800-53 control ID) live in `customAttributes`
 *    keyed by `StandardPackKey`.
 *  - `packReference` is free text for the auditor's documented reference
 *    (e.g., `"GAGAS §6.39"`, `"COSO 2013 PC3"`).
 *
 * See [ADR-0008](../references/adr/0008-control-matrix-as-separate-model.md)
 * for the rationale on why PRCM is upstream of AuditTest rather than
 * collapsed into it.
 */
export interface ControlMatrixRow {
  id: string;
  tenantId: TenantId;
  engagementId: string;

  /** Engagement-scoped codes for in-engagement cross-reference. */
  riskCode: string;        // e.g., "R-001"
  controlCode?: string;    // e.g., "C-001"

  /** Process being controlled. */
  processName: string;
  processDescription?: RichText;

  /** The risk this control addresses. */
  riskDescription: RichText;
  riskRating: 'HIGH' | 'MEDIUM' | 'LOW';
  likelihood?: 'HIGH' | 'MEDIUM' | 'LOW';
  impact?: 'HIGH' | 'MEDIUM' | 'LOW';

  /** The control. */
  controlDescription?: RichText;
  controlType?: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'DIRECTIVE';
  controlNature?: 'MANUAL' | 'AUTOMATED' | 'IT_DEPENDENT_MANUAL';
  controlFrequency?:
    | 'CONTINUOUS'
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'ANNUALLY'
    | 'AD_HOC';
  controlOwnerId?: UserId;
  controlEffectiveness?:
    | 'EFFECTIVE'
    | 'PARTIALLY_EFFECTIVE'
    | 'INEFFECTIVE'
    | 'NOT_TESTED';

  residualRiskRating?: 'HIGH' | 'MEDIUM' | 'LOW';

  /** Financial-audit assertions covered (existence, completeness, etc.). */
  assertionsCovered?: string[];

  /** Free-form auditor reference (e.g., `"GAGAS §6.39"`, `"COSO 2013 PC3"`). */
  packReference?: string;

  /** Pack-defined extensions, keyed by `StandardPackKey`. */
  customAttributes: Record<StandardPackKey, Record<string, unknown>>;

  status: 'DRAFT' | 'ACTIVE' | 'TESTED' | 'CLOSED';

  preparedById: UserId;
  reviewedById?: UserId;
  reviewedAt?: IsoDateTime;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: number;
}

// =============================================================================
// 7. RISK ASSESSMENT — per-fiscal-year history per ADR-0009
// =============================================================================

/**
 * Annual risk assessment of an audit-universe entity. One row per
 * (universeEntityId, fiscalYear); preserves year-over-year history that a
 * JSONB snapshot on the universe entity cannot.
 *
 * Multi-standard hooks:
 *  - Dimension sets vary by methodology — GAGAS 5-dim
 *    (Strategic/Operational/Compliance/Financial/Reputational), COSO ERM,
 *    ISO 31000. The pack defines which dimensions apply via its
 *    `riskAssessmentMethodology`.
 *  - `dimensions` is keyed by canonical dimension code; values are pack-
 *    defined scale (typically 1-5).
 *  - `methodology` carries the pack reference or free text describing how
 *    the assessment was conducted.
 *
 * See [ADR-0009](../references/adr/0009-risk-assessment-history-table.md)
 * for the rationale on why this is a separate table rather than a JSONB
 * blob on the audit-universe entity.
 */
export interface RiskAssessment {
  id: string;
  tenantId: TenantId;
  universeEntityId: string;

  /** Fiscal year this assessment applies to. */
  fiscalYear: number;

  /**
   * Pack-defined dimension scores. Keys are canonical dimension codes
   * (e.g., GAGAS uses `STRATEGIC`, `OPERATIONAL`, `COMPLIANCE`,
   * `FINANCIAL`, `REPUTATIONAL`); values are on the pack-defined scale.
   *
   * Example:
   *   { "STRATEGIC": 4, "OPERATIONAL": 3, "COMPLIANCE": 5,
   *     "FINANCIAL": 2, "REPUTATIONAL": 4 }
   */
  dimensions: Record<string, number>;

  /** Composite score derived from `dimensions` (pack-defined formula). */
  compositeScore?: number;

  /** Categorical rating from `compositeScore` (pack-defined thresholds). */
  riskRating?: 'HIGH' | 'MEDIUM' | 'LOW';

  /** Methodology applied — pack reference or free text. */
  methodology?: string;

  notes?: RichText;

  /** Provenance. */
  assessedById: UserId;
  assessmentDate: IsoDate;
  approvedById?: UserId;
  approvedAt?: IsoDateTime;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: number;
}

// =============================================================================
// 8. COMPLIANCE STATEMENT HELPERS
// =============================================================================

/**
 * Build the "conducted in accordance with…" sentence for a report.
 *
 * Includes only packs attached to the engagement with
 * `conformanceClaimed: true` (Q3). For the report, this is derived from
 * the engagement's methodology list + any regulatory overlays that require
 * compliance statements.
 *
 * The actual phrasing varies by methodology; each pack may provide a
 * preferred template string via `ReportDefinition.conformanceStatement`.
 */
export interface ComplianceStatementInput {
  /** Packs to include in the statement — those with conformanceClaimed=true. */
  packs: StandardPackRef[];
  /** Locale for the statement (defaults to en-US). */
  locale?: string;
}

/**
 * Render a compliance statement. (Implementation lives in engine/services.)
 * Signature exported here so callers can type their inputs correctly.
 */
export type ComplianceStatementRenderer =
  (input: ComplianceStatementInput) => string;
