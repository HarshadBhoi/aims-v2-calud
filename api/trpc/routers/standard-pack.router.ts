/**
 * Standard Pack Router
 *
 * Two distinct procedures:
 * - Tenant-scoped (authenticated users): list available packs, activate/deactivate,
 *   read pack content for their engagements
 * - Platform-scoped (superadmin only): publish new pack versions, update crosswalks,
 *   manage the global pack catalog
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../middleware';
import {
  authedProcedure,
  adminProcedure,
  platformProcedure,
} from '../procedures';
import {
  CuidSchema,
  PackRefSchema,
  PaginationInputSchema,
  sortInputSchema,
  PackStatusEnum,
} from '../schemas/common.schemas';
import { packService } from '@/services/pack.service';

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const ListAvailablePacksInputSchema = PaginationInputSchema.extend({
  filters: z
    .object({
      status: z.array(PackStatusEnum).optional(),
      codes: z.array(z.string()).optional(),
      sectors: z.array(z.string()).optional(),
      jurisdictions: z.array(z.string()).optional(),
      activatedForTenant: z.boolean().optional(),
    })
    .default({}),
  sort: sortInputSchema(['effectiveFrom', 'name', 'code']),
});

const GetPackInputSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  version: z.string(),
});

const ActivatePackInputSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  version: z.string(),
  isDefault: z.boolean().default(false),
  customConfig: z.record(z.string(), z.unknown()).default({}),
});

const DeactivatePackInputSchema = z.object({
  code: z.string(),
  version: z.string(),
});

const GetCrosswalksInputSchema = z.object({
  sourcePack: PackRefSchema,
  targetPack: PackRefSchema.optional(),  // Optional: if omitted, return all crosswalks from source
});

// Platform procedures
const PublishPackInputSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  version: z.string(),
  packContent: z.record(z.string(), z.unknown()),  // Full StandardPack JSON
  publishNote: z.string().max(2000).optional(),
  skipValidation: z.boolean().default(false),  // Only for emergency hotfixes
});

const UpdatePackStatusInputSchema = z.object({
  code: z.string(),
  version: z.string(),
  newStatus: PackStatusEnum,
  reason: z.string().max(2000),
});

const AddCrosswalkInputSchema = z.object({
  sourcePackCode: z.string(),
  sourcePackVersion: z.string(),
  sourceSection: z.string(),
  sourceDescription: z.string(),
  targetPackCode: z.string(),
  targetPackVersion: z.string(),
  targetSection: z.string(),
  targetDescription: z.string(),
  mappingType: z.enum([
    'equivalent',
    'partial',
    'related',
    'this_stricter',
    'mapped_stricter',
    'no_equivalent',
  ]),
  confidence: z.enum(['authoritative', 'curated', 'suggested']),
  notes: z.string().max(5000).optional(),
});

// =============================================================================
// ROUTER
// =============================================================================

export const standardPackRouter = router({
  // ===========================================================================
  // QUERIES (tenant-scoped)
  // ===========================================================================

  /**
   * List standard packs available to the tenant.
   * Excludes SUPERSEDED and WITHDRAWN packs by default.
   */
  listAvailable: authedProcedure
    .input(ListAvailablePacksInputSchema)
    .query(async ({ input, ctx }) => {
      return packService.listAvailable({
        tenantId: ctx.auth.tenantId,
        filters: input.filters,
        pagination: {
          cursor: input.cursor,
          limit: input.limit,
          sort: input.sort,
        },
      });
    }),

  /**
   * Get pack content by code:version.
   */
  get: authedProcedure
    .input(GetPackInputSchema)
    .query(async ({ input, ctx }) => {
      const pack = await ctx.prisma.standardPack.findUnique({
        where: { code_version: { code: input.code, version: input.version } },
      });
      if (!pack) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      // Only return EFFECTIVE, TRANSITIONING, SUPERSEDED (for legacy reads)
      if (['PROPOSED', 'WITHDRAWN'].includes(pack.status)) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return pack;
    }),

  /**
   * List packs currently activated for the tenant.
   */
  listActivated: authedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return ctx.prisma.tenantStandardPack.findMany({
        where: {
          tenantId: ctx.auth.tenantId,
          deactivatedAt: null,
        },
        orderBy: [{ isDefault: 'desc' }, { activatedAt: 'desc' }],
      });
    }),

  /**
   * Get crosswalk mappings for a pack.
   */
  getCrosswalks: authedProcedure
    .input(GetCrosswalksInputSchema)
    .query(async ({ input, ctx }) => {
      return ctx.prisma.packCrosswalk.findMany({
        where: {
          sourcePackCode: input.sourcePack.code,
          sourcePackVersion: input.sourcePack.version,
          ...(input.targetPack && {
            targetPackCode: input.targetPack.code,
            targetPackVersion: input.targetPack.version,
          }),
        },
        orderBy: { sourceSection: 'asc' },
      });
    }),

  // ===========================================================================
  // MUTATIONS (tenant admin only)
  // ===========================================================================

  /**
   * Activate a pack for this tenant.
   */
  activate: adminProcedure
    .input(ActivatePackInputSchema)
    .mutation(async ({ input, ctx }) => {
      return packService.activateForTenant({
        tenantId: ctx.auth.tenantId,
        activatedByUserId: ctx.auth.userId,
        packCode: input.code,
        packVersion: input.version,
        isDefault: input.isDefault,
        customConfig: input.customConfig,
      });
    }),

  /**
   * Deactivate a pack (cannot deactivate if engagements actively use it).
   */
  deactivate: adminProcedure
    .input(DeactivatePackInputSchema)
    .mutation(async ({ input, ctx }) => {
      return packService.deactivateForTenant({
        tenantId: ctx.auth.tenantId,
        deactivatedByUserId: ctx.auth.userId,
        packCode: input.code,
        packVersion: input.version,
      });
    }),

  // ===========================================================================
  // PLATFORM QUERIES (superadmin only — cross-tenant)
  // ===========================================================================

  /**
   * Platform-wide pack catalog including PROPOSED and WITHDRAWN.
   */
  platformListAll: platformProcedure
    .input(PaginationInputSchema)
    .query(async ({ input, ctx }) => {
      // Full catalog visibility for platform operators
      const packs = await ctx.prisma.standardPack.findMany({
        take: input.limit + 1,
        skip: input.cursor ? 1 : 0,
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      });

      const hasMore = packs.length > input.limit;
      return {
        items: hasMore ? packs.slice(0, -1) : packs,
        hasMore,
        nextCursor: hasMore ? String(packs[packs.length - 2]!.code) : null,
      };
    }),

  // ===========================================================================
  // PLATFORM MUTATIONS (superadmin only)
  // ===========================================================================

  /**
   * Publish a new Standard Pack version.
   *
   * Service layer:
   * - Runs full validation (structure, referential integrity, content review)
   * - Computes SHA-256 content hash
   * - Sets status = FINAL_PENDING (or EFFECTIVE if effectiveFrom is past)
   * - Emits platform event for tenants to discover
   */
  publish: platformProcedure
    .input(PublishPackInputSchema)
    .mutation(async ({ input, ctx }) => {
      return packService.publish({
        publishedByUserId: ctx.auth.userId,
        packCode: input.code,
        packVersion: input.version,
        packContent: input.packContent,
        publishNote: input.publishNote,
        skipValidation: input.skipValidation,
      });
    }),

  /**
   * Transition pack status (e.g., FINAL_PENDING → EFFECTIVE on effective date).
   * Automated transitions also run via pg_cron; this is manual override.
   */
  updateStatus: platformProcedure
    .input(UpdatePackStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      return packService.updateStatus({
        updatedByUserId: ctx.auth.userId,
        packCode: input.code,
        packVersion: input.version,
        newStatus: input.newStatus,
        reason: input.reason,
      });
    }),

  /**
   * Add/update crosswalk entry.
   */
  addCrosswalk: platformProcedure
    .input(AddCrosswalkInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.packCrosswalk.upsert({
        where: {
          sourcePackCode_sourcePackVersion_sourceSection_targetPackCode_targetPackVersion_targetSection: {
            sourcePackCode: input.sourcePackCode,
            sourcePackVersion: input.sourcePackVersion,
            sourceSection: input.sourceSection,
            targetPackCode: input.targetPackCode,
            targetPackVersion: input.targetPackVersion,
            targetSection: input.targetSection,
          },
        },
        create: {
          ...input,
          createdBy: ctx.auth.userId,
        },
        update: {
          ...input,
          reviewedBy: ctx.auth.userId,
        },
      });
    }),
});
