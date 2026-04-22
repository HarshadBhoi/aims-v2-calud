/**
 * Engagement Zod schemas.
 * Input validation for engagement tRPC procedures.
 */

import { z } from 'zod';
import {
  CuidSchema,
  VersionSchema,
  NonEmptyStringSchema,
  RichTextSchema,
  DateOnlySchema,
  EngagementTypeEnum,
  EngagementStatusEnum,
  PackRefSchema,
  PaginationInputSchema,
  sortInputSchema,
  DateRangeSchema,
  CurrencyAmountSchema,
  RiskRatingEnum,
} from './common.schemas';

// =============================================================================
// BASE FIELDS
// =============================================================================

const EngagementBaseSchema = z.object({
  title: NonEmptyStringSchema.max(500),
  engagementNumber: NonEmptyStringSchema.max(50).optional(),
  engagementType: EngagementTypeEnum,
  primaryPack: PackRefSchema,
  additionalPacks: z.array(PackRefSchema).default([]),

  objectives: RichTextSchema.optional(),
  scope: RichTextSchema.optional(),
  methodology: RichTextSchema.optional(),

  auditeeName: z.string().max(500).optional(),
  auditeeContact: z
    .object({
      primaryName: z.string().max(200).optional(),
      primaryEmail: z.string().email().optional(),
      primaryPhone: z.string().max(50).optional(),
      address: z.string().max(1000).optional(),
    })
    .optional(),

  periodStartDate: DateOnlySchema.optional(),
  periodEndDate: DateOnlySchema.optional(),
  plannedStartDate: DateOnlySchema.optional(),
  plannedEndDate: DateOnlySchema.optional(),

  inherentRiskRating: RiskRatingEnum.optional(),
  residualRiskRating: RiskRatingEnum.optional(),
  riskFactors: z.record(z.string(), z.unknown()).optional(),

  budgetedHours: z.number().nonnegative().optional(),

  annualPlanId: CuidSchema.optional(),
  universeEntityId: CuidSchema.optional(),

  customFields: z.record(z.string(), z.unknown()).default({}),
});

// =============================================================================
// CREATE
// =============================================================================

export const CreateEngagementInputSchema = EngagementBaseSchema.extend({
  initialTeam: z
    .array(
      z.object({
        userId: CuidSchema,
        role: z.string().min(1).max(100),
        hoursAllocated: z.number().nonnegative().optional(),
      }),
    )
    .min(1, 'At least one team member required'),
});
export type CreateEngagementInput = z.infer<typeof CreateEngagementInputSchema>;

// =============================================================================
// UPDATE
// =============================================================================

export const UpdateEngagementInputSchema = EngagementBaseSchema
  .partial()
  .extend({
    id: CuidSchema,
    version: VersionSchema,
  });
export type UpdateEngagementInput = z.infer<typeof UpdateEngagementInputSchema>;

// =============================================================================
// DELETE
// =============================================================================

export const DeleteEngagementInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  reason: z.string().min(5).max(500).optional(),
});

// =============================================================================
// GET / BY NUMBER
// =============================================================================

export const GetEngagementInputSchema = z.object({
  id: CuidSchema,
  include: z
    .object({
      team: z.boolean().default(false),
      phases: z.boolean().default(false),
      findingsSummary: z.boolean().default(false),
      reports: z.boolean().default(false),
    })
    .default({}),
});

export const GetByNumberInputSchema = z.object({
  engagementNumber: NonEmptyStringSchema,
});

// =============================================================================
// LIST
// =============================================================================

export const EngagementFiltersSchema = z.object({
  status: z.array(EngagementStatusEnum).optional(),
  type: z.array(EngagementTypeEnum).optional(),
  primaryPackCode: z.array(z.string()).optional(),
  search: z.string().trim().min(2).max(200).optional(),
  createdAt: DateRangeSchema.optional(),
  plannedStart: DateRangeSchema.optional(),
  annualPlanId: CuidSchema.optional(),
  universeEntityId: CuidSchema.optional(),
  teamMemberId: CuidSchema.optional(),
  riskRating: z.array(RiskRatingEnum).optional(),
  includeDeleted: z.boolean().default(false),
});
export type EngagementFilters = z.infer<typeof EngagementFiltersSchema>;

export const ListEngagementsInputSchema = PaginationInputSchema.extend({
  filters: EngagementFiltersSchema.default({}),
  sort: sortInputSchema([
    'createdAt',
    'updatedAt',
    'title',
    'engagementNumber',
    'plannedStartDate',
    'actualStartDate',
    'status',
  ]),
});
export type ListEngagementsInput = z.infer<typeof ListEngagementsInputSchema>;

// =============================================================================
// STATUS TRANSITIONS
// =============================================================================

export const TransitionEngagementStatusInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  newStatus: EngagementStatusEnum,
  comments: z.string().max(2000).optional(),
  confirmExitCriteria: z.boolean().default(true),  // UI confirmation that exit criteria met
});

// =============================================================================
// CLONE
// =============================================================================

export const CloneEngagementInputSchema = z.object({
  sourceId: CuidSchema,
  newTitle: NonEmptyStringSchema.max(500),
  newEngagementNumber: NonEmptyStringSchema.max(50).optional(),
  newPeriodStart: DateOnlySchema.optional(),
  newPeriodEnd: DateOnlySchema.optional(),
  copyTeam: z.boolean().default(true),
  copyWorkPrograms: z.boolean().default(true),
  copyScope: z.boolean().default(true),
});

// =============================================================================
// ISSUE (LOCK)
// =============================================================================

export const IssueEngagementInputSchema = z.object({
  id: CuidSchema,
  version: VersionSchema,
  issuanceNotes: z.string().max(2000).optional(),
  confirmAllChecklistsComplete: z.literal(true),
  confirmAllFindingsApproved: z.literal(true),
});

// =============================================================================
// TEAM MANAGEMENT
// =============================================================================

export const AddTeamMemberInputSchema = z.object({
  engagementId: CuidSchema,
  userId: CuidSchema,
  role: z.string().min(1).max(100),
  hoursAllocated: z.number().nonnegative().optional(),
});

export const RemoveTeamMemberInputSchema = z.object({
  engagementId: CuidSchema,
  userId: CuidSchema,
  role: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
});

export const UpdateTeamMemberInputSchema = z.object({
  engagementId: CuidSchema,
  userId: CuidSchema,
  role: z.string().min(1).max(100),
  newRole: z.string().min(1).max(100).optional(),
  hoursAllocated: z.number().nonnegative().optional(),
});

// =============================================================================
// STATS
// =============================================================================

export const EngagementStatsInputSchema = z.object({
  tenantId: CuidSchema.optional(),  // Defaults to auth tenant
  fiscalYear: z.number().int().min(1900).max(2200).optional(),
  groupBy: z.enum(['status', 'type', 'pack', 'team_member']).default('status'),
});
