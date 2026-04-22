/**
 * Common Zod schemas shared across routers.
 *
 * Import these instead of redefining — keeps validation consistent.
 */

import { z } from 'zod';

// =============================================================================
// PRIMITIVES
// =============================================================================

/** CUID2 — 24-character base32 identifier. */
export const CuidSchema = z
  .string()
  .regex(/^[a-z0-9]{24}$/, 'Invalid ID format (expected CUID2)');

/** Optimistic concurrency version. */
export const VersionSchema = z.number().int().nonnegative();

/** Tenant-scoped number (e.g., engagement number). */
export const ScopedNumberSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[A-Z0-9\-_]+$/, 'Only uppercase letters, digits, dashes, underscores');

/** ISO 8601 date (YYYY-MM-DD). */
export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** ISO 8601 datetime with timezone. */
export const DateTimeSchema = z.string().datetime({ offset: true });

/** SHA-256 hex. */
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** ULID (for idempotency keys, request IDs). */
export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i);

/** Non-empty trimmed string. */
export const NonEmptyStringSchema = z.string().trim().min(1);

/** Rich-text (TipTap JSON serialized). */
export const RichTextSchema = z.string().max(1_000_000);

/** Currency amount (stored as string to avoid float issues). */
export const CurrencyAmountSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'Invalid currency format');

/** Percentage (0-100 inclusive). */
export const PercentageSchema = z.number().min(0).max(100);

// =============================================================================
// PAGINATION
// =============================================================================

export const PaginationInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    totalCount: z.number().int().optional(),
  });

// =============================================================================
// SORTING
// =============================================================================

export const SortDirectionSchema = z.enum(['asc', 'desc']);

export function sortInputSchema<T extends [string, ...string[]]>(fields: T) {
  return z
    .object({
      field: z.enum(fields),
      direction: SortDirectionSchema.default('desc'),
    })
    .optional();
}

// =============================================================================
// DATE RANGES
// =============================================================================

export const DateRangeSchema = z
  .object({
    from: DateTimeSchema.optional(),
    to: DateTimeSchema.optional(),
  })
  .refine(
    (val) => !val.from || !val.to || new Date(val.from) <= new Date(val.to),
    { message: 'from must be before or equal to to' },
  );

export const DateOnlyRangeSchema = z
  .object({
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
  })
  .refine(
    (val) => !val.from || !val.to || val.from <= val.to,
    { message: 'from must be before or equal to to' },
  );

// =============================================================================
// ENUMS FROM PRISMA
// =============================================================================

// These mirror Prisma enums for client-side use without Prisma dependency.
// Keep in sync with database/schema.prisma.

export const EngagementTypeEnum = z.enum([
  'FINANCIAL_AUDIT',
  'PERFORMANCE_AUDIT',
  'ATTESTATION_EXAMINATION',
  'ATTESTATION_REVIEW',
  'AGREED_UPON_PROCEDURES',
  'SINGLE_AUDIT',
  'COMPLIANCE_AUDIT',
  'INTERNAL_AUDIT_ASSURANCE',
  'INTERNAL_AUDIT_CONSULTING',
  'IT_AUDIT',
  'CERTIFICATION_STAGE_1',
  'CERTIFICATION_STAGE_2',
  'SURVEILLANCE',
  'RECERTIFICATION',
  'FOLLOW_UP',
  'INVESTIGATION',
]);
export type EngagementType = z.infer<typeof EngagementTypeEnum>;

export const EngagementStatusEnum = z.enum([
  'DRAFT',
  'PLANNING',
  'FIELDWORK',
  'REPORTING',
  'QUALITY_REVIEW',
  'ISSUED',
  'CLOSED',
  'CANCELLED',
  'FROZEN',
]);
export type EngagementStatus = z.infer<typeof EngagementStatusEnum>;

export const FindingStatusEnum = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'COMMUNICATED',
  'ISSUED',
  'CLOSED',
  'REOPENED',
  'WITHDRAWN',
]);
export type FindingStatus = z.infer<typeof FindingStatusEnum>;

export const RecommendationStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED',
  'CLOSED',
  'RISK_ACCEPTED',
  'SUPERSEDED',
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusEnum>;

export const CAPStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'UNDER_VERIFICATION',
  'VERIFIED',
  'OVERDUE',
  'CANCELLED',
  'REOPENED',
]);
export type CAPStatus = z.infer<typeof CAPStatusEnum>;

export const ApprovalStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DELEGATED',
  'RECALLED',
  'WITHDRAWN',
  'ESCALATED',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const WorkpaperStatusEnum = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'REVIEWED',
  'APPROVED',
  'LOCKED',
  'ARCHIVED',
]);
export type WorkpaperStatus = z.infer<typeof WorkpaperStatusEnum>;

export const PackStatusEnum = z.enum([
  'PROPOSED',
  'FINAL_PENDING',
  'EFFECTIVE',
  'TRANSITIONING',
  'SUPERSEDED',
  'WITHDRAWN',
  'IN_LITIGATION',
]);

export const RiskRatingEnum = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFORMATIONAL',
]);

// =============================================================================
// AUDIT TRAIL
// =============================================================================

export const AuditFieldsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  createdById: CuidSchema,
  deletedAt: z.date().nullable(),
  version: VersionSchema,
});

// =============================================================================
// PACK REFERENCE
// =============================================================================

export const PackRefSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  version: z.string().min(1),
});
export type PackRef = z.infer<typeof PackRefSchema>;

// =============================================================================
// FILE METADATA
// =============================================================================

export const FileCategoryEnum = z.enum([
  'WORKPAPER',
  'EVIDENCE',
  'REPORT_PDF',
  'CPE_CERTIFICATE',
  'CERTIFICATION',
  'PEER_REVIEW_REPORT',
  'LOGO',
  'OTHER',
]);
