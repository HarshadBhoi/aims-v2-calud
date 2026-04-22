/**
 * Finding Zod schemas.
 *
 * Findings are polymorphic — `elementValues` contains standard-specific fields
 * (GAGAS: 4 elements; IIA: 5 elements; SOX: severity classification; etc.)
 *
 * Element validation happens at the service layer against the active Standard Pack.
 */

import { z } from 'zod';
import {
  CuidSchema,
  VersionSchema,
  NonEmptyStringSchema,
  DateOnlySchema,
  CurrencyAmountSchema,
  FindingStatusEnum,
  RiskRatingEnum,
  PaginationInputSchema,
  sortInputSchema,
  DateRangeSchema,
  PackRefSchema,
} from './common.schemas';

// =============================================================================
// ELEMENT VALUES (polymorphic JSONB)
// =============================================================================

/**
 * Finding element values are validated against the Standard Pack's findingElements.
 * This schema just ensures the shape; semantic validation is service-layer.
 */
export const FindingElementValuesSchema = z.record(
  z.string().regex(/^[A-Z][A-Z0-9_]*$/),  // Element codes
  z.union([
    z.string(),                            // Rich text / text values
    z.number(),                            // Numeric
    z.boolean(),
    z.null(),
    z.array(z.string()),                   // Multi-select
    z.record(z.string(), z.unknown()),     // Structured (rare)
  ]),
);

// =============================================================================
// BASE FIELDS
// =============================================================================

const FindingBaseSchema = z.object({
  title: NonEmptyStringSchema.max(500),
  findingNumber: NonEmptyStringSchema.max(50).optional(),

  // Element values (polymorphic, standard-specific)
  elementValues: FindingElementValuesSchema,

  // Classification (from pack findingClassifications)
  classification: z.string().optional(),
  classificationScheme: z.string().optional(),
  riskRating: RiskRatingEnum.optional(),

  // Single Audit overlay fields
  questionedCostsKnown: CurrencyAmountSchema.optional(),
  questionedCostsLikely: CurrencyAmountSchema.optional(),
  federalProgramAln: z
    .string()
    .regex(/^\d{2,3}\.\d{3}$/, 'Expected ALN format like "93.778"')
    .optional(),

  // Repeat finding
  isRepeatFinding: z.boolean().default(false),
  priorFindingId: CuidSchema.optional(),

  // Bitemporal
  validFrom: DateOnlySchema.optional(),
  validTo: DateOnlySchema.optional(),

  // Custom fields
  customFields: z.record(z.string(), z.unknown()).default({}),
}).refine(
  (data) => {
    // Classification requires scheme and vice versa
    if (data.classification && !data.classificationScheme) return false;
    if (data.classificationScheme && !data.classification) return false;
    return true;
  },
  { message: 'classification and classificationScheme must be provided together' },
).refine(
  (data) => !data.isRepeatFinding || data.priorFindingId !== undefined,
  { message: 'priorFindingId required when isRepeatFinding is true' },
);

// =============================================================================
// CREATE
// =============================================================================

export const CreateFindingInputSchema = z
  .object({
    engagementId: CuidSchema,
    title: NonEmptyStringSchema.max(500),
    elementValues: FindingElementValuesSchema,
    classification: z.string().optional(),
    classificationScheme: z.string().optional(),
    riskRating: RiskRatingEnum.optional(),

    questionedCostsKnown: CurrencyAmountSchema.optional(),
    questionedCostsLikely: CurrencyAmountSchema.optional(),
    federalProgramAln: z.string().regex(/^\d{2,3}\.\d{3}$/).optional(),

    isRepeatFinding: z.boolean().default(false),
    priorFindingId: CuidSchema.optional(),

    validFrom: DateOnlySchema.optional(),
    validTo: DateOnlySchema.optional(),

    customFields: z.record(z.string(), z.unknown()).default({}),

    // Initial linked workpapers (optional)
    linkedWorkpaperIds: z.array(CuidSchema).default([]),

    // Option: escalate from an existing observation
    fromObservationId: CuidSchema.optional(),
  })
  .refine(
    (data) => !data.isRepeatFinding || data.priorFindingId !== undefined,
    { message: 'priorFindingId required when isRepeatFinding is true' },
  );
export type CreateFindingInput = z.infer<typeof CreateFindingInputSchema>;

// =============================================================================
// UPDATE
// =============================================================================

export const UpdateFindingInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,

  // All fields optional (partial update)
  title: NonEmptyStringSchema.max(500).optional(),
  elementValues: FindingElementValuesSchema.optional(),
  classification: z.string().optional(),
  classificationScheme: z.string().optional(),
  riskRating: RiskRatingEnum.optional(),

  questionedCostsKnown: CurrencyAmountSchema.optional(),
  questionedCostsLikely: CurrencyAmountSchema.optional(),
  federalProgramAln: z.string().regex(/^\d{2,3}\.\d{3}$/).optional(),

  isRepeatFinding: z.boolean().optional(),
  priorFindingId: CuidSchema.optional(),

  validFrom: DateOnlySchema.optional(),
  validTo: DateOnlySchema.optional(),

  customFields: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateFindingInput = z.infer<typeof UpdateFindingInputSchema>;

// =============================================================================
// DELETE / WITHDRAW
// =============================================================================

export const DeleteFindingInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  reason: z.string().min(10).max(1000),  // Reason mandatory for audit trail
});

export const WithdrawFindingInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  withdrawalReason: z.string().min(20).max(2000),
  notifyAuditee: z.boolean().default(true),
});

// =============================================================================
// STATUS TRANSITIONS
// =============================================================================

export const SubmitForReviewInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  comments: z.string().max(2000).optional(),
});

export const ApproveFindingInputSchema = z.object({
  approvalId: CuidSchema,
  comments: z.string().max(2000).optional(),
  confirmReviewed: z.literal(true),
});

export const RejectFindingInputSchema = z.object({
  approvalId: CuidSchema,
  reason: z.string().min(10).max(2000),
  returnToStep: z.number().int().optional(),
});

export const IssueFindingInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  confirmAllElementsComplete: z.literal(true),
  confirmRecommendationsLinked: z.literal(true),
  confirmManagementResponseReceived: z.literal(true),
  signatureNote: z.string().max(1000).optional(),
});

// =============================================================================
// GET
// =============================================================================

export const GetFindingInputSchema = z.object({
  id: CuidSchema,
  include: z
    .object({
      recommendations: z.boolean().default(false),
      correctiveActions: z.boolean().default(false),
      managementResponse: z.boolean().default(false),
      workpapers: z.boolean().default(false),
      approvals: z.boolean().default(false),
      auditTrail: z.boolean().default(false),
    })
    .default({}),
});

// =============================================================================
// LIST
// =============================================================================

export const FindingFiltersSchema = z.object({
  status: z.array(FindingStatusEnum).optional(),
  engagementId: CuidSchema.optional(),
  classification: z.array(z.string()).optional(),
  riskRating: z.array(RiskRatingEnum).optional(),
  createdAt: DateRangeSchema.optional(),
  issuedAt: DateRangeSchema.optional(),
  search: z.string().trim().min(2).max(200).optional(),
  isRepeat: z.boolean().optional(),
  hasQuestionedCosts: z.boolean().optional(),
  federalProgramAln: z.string().optional(),
  packCode: z.string().optional(),
  assignedToMe: z.boolean().optional(),
  includeDeleted: z.boolean().default(false),
});
export type FindingFilters = z.infer<typeof FindingFiltersSchema>;

export const ListFindingsInputSchema = PaginationInputSchema.extend({
  filters: FindingFiltersSchema.default({}),
  sort: sortInputSchema([
    'createdAt',
    'updatedAt',
    'title',
    'findingNumber',
    'classification',
    'riskRating',
  ]),
});
export type ListFindingsInput = z.infer<typeof ListFindingsInputSchema>;

// =============================================================================
// MANAGEMENT RESPONSE
// =============================================================================

export const SubmitManagementResponseInputSchema = z.object({
  findingId: CuidSchema,
  responseType: z.enum(['AGREE', 'DISAGREE', 'PARTIAL']),
  responseText: NonEmptyStringSchema.max(10_000),
  agreedActionPlan: z.string().max(10_000).optional(),
  targetDate: DateOnlySchema.optional(),
  responsiblePerson: z.string().max(200).optional(),
}).refine(
  (data) =>
    data.responseType !== 'AGREE' || (data.agreedActionPlan && data.targetDate),
  { message: 'agreedActionPlan and targetDate required when responseType is AGREE' },
);

export const EvaluateManagementResponseInputSchema = z.object({
  findingId: CuidSchema,
  auditorNotes: NonEmptyStringSchema.max(5000),
  acceptanceStatus: z.enum(['ACCEPTED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED']),
});

// =============================================================================
// STATS
// =============================================================================

export const FindingStatsInputSchema = z.object({
  engagementId: CuidSchema.optional(),
  fiscalYear: z.number().int().optional(),
  groupBy: z.enum(['classification', 'risk_rating', 'status', 'pack']).default('classification'),
});
