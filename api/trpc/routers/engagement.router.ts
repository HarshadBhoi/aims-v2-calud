/**
 * Engagement Router
 *
 * Full reference implementation demonstrating all conventions:
 * - Zod input validation
 * - Cursor pagination
 * - Optimistic concurrency
 * - Soft delete
 * - Status transitions with exit criteria
 * - Tenant-scoped via RLS (middleware handles)
 * - Idempotency for mutations (middleware handles)
 * - Permission checks via middleware
 * - Service layer separation
 * - Typed errors
 * - Audit trail (DB triggers + explicit summaries)
 */

import { TRPCError } from '@trpc/server';
import { router } from '../middleware';
import {
  authedProcedure,
  permissionProcedure,
  directorProcedure,
} from '../procedures';
import { assertUpdateAffected } from '../middleware';
import {
  CreateEngagementInputSchema,
  UpdateEngagementInputSchema,
  DeleteEngagementInputSchema,
  GetEngagementInputSchema,
  GetByNumberInputSchema,
  ListEngagementsInputSchema,
  TransitionEngagementStatusInputSchema,
  CloneEngagementInputSchema,
  IssueEngagementInputSchema,
  AddTeamMemberInputSchema,
  RemoveTeamMemberInputSchema,
  UpdateTeamMemberInputSchema,
  EngagementStatsInputSchema,
} from '../schemas/engagement.schemas';
import { engagementService } from '@/services/engagement.service';
import { buildCursorPagination, encodeCursor } from '@/lib/cursor';
import { buildEngagementWhere } from '@/services/engagement.queries';

export const engagementRouter = router({
  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * List engagements with cursor pagination, filtering, sorting.
   */
  list: authedProcedure
    .input(ListEngagementsInputSchema)
    .query(async ({ input, ctx }) => {
      const where = buildEngagementWhere(input.filters, ctx.auth.tenantId);
      const orderBy = input.sort
        ? [{ [input.sort.field]: input.sort.direction }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'asc' as const }];

      const { cursor, take, hasMoreCheck } = buildCursorPagination(input);

      const rows = await ctx.prisma.engagement.findMany({
        where,
        orderBy,
        take,
        cursor,
        skip: cursor ? 1 : 0,
        include: {
          _count: {
            select: { findings: true, workpapers: true, teamMembers: true },
          },
        },
      });

      const { items, nextCursor, hasMore } = hasMoreCheck(rows);

      return {
        items: items.map((e) => ({
          id: e.id,
          engagementNumber: e.engagementNumber,
          title: e.title,
          engagementType: e.engagementType,
          status: e.status,
          primaryPackCode: e.primaryPackCode,
          primaryPackVersion: e.primaryPackVersion,
          plannedStartDate: e.plannedStartDate,
          plannedEndDate: e.plannedEndDate,
          actualStartDate: e.actualStartDate,
          actualEndDate: e.actualEndDate,
          inherentRiskRating: e.inherentRiskRating,
          residualRiskRating: e.residualRiskRating,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          version: e._version,
          counts: {
            findings: e._count.findings,
            workpapers: e._count.workpapers,
            teamMembers: e._count.teamMembers,
          },
        })),
        nextCursor,
        hasMore,
      };
    }),

  /**
   * Get single engagement by ID with optional related data.
   */
  get: authedProcedure
    .input(GetEngagementInputSchema)
    .query(async ({ input, ctx }) => {
      const engagement = await ctx.prisma.engagement.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.auth.tenantId,
          deletedAt: null,
        },
        include: {
          standardPacks: true,
          teamMembers: input.include.team ? {
            where: { removedAt: null },
            include: {
              // user relation — define in schema or use manual join
            },
          } : false,
          phases: input.include.phases,
          findings: input.include.findingsSummary ? {
            where: { deletedAt: null },
            select: {
              id: true,
              findingNumber: true,
              title: true,
              status: true,
              classification: true,
              riskRating: true,
            },
            take: 100,
          } : false,
          reports: input.include.reports ? {
            where: { deletedAt: null },
            select: {
              id: true,
              reportCode: true,
              title: true,
              status: true,
              issuedAt: true,
              reportVersion: true,
            },
          } : false,
        },
      });

      if (!engagement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Engagement not found',
          cause: { code: 'NOT_FOUND', resourceType: 'engagement', resourceId: input.id },
        });
      }

      return engagement;
    }),

  /**
   * Get by engagement number (human-readable ID).
   */
  getByNumber: authedProcedure
    .input(GetByNumberInputSchema)
    .query(async ({ input, ctx }) => {
      const engagement = await ctx.prisma.engagement.findFirst({
        where: {
          engagementNumber: input.engagementNumber,
          tenantId: ctx.auth.tenantId,
          deletedAt: null,
        },
      });
      if (!engagement) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return engagement;
    }),

  /**
   * Aggregate stats for dashboards.
   */
  stats: authedProcedure
    .input(EngagementStatsInputSchema)
    .query(async ({ input, ctx }) => {
      return engagementService.computeStats(ctx.auth.tenantId, input);
    }),

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  /**
   * Create engagement.
   * Service layer handles:
   * - Auto-generating engagement number (if not provided)
   * - Validating team members belong to tenant
   * - Checking team members meet CPE requirements of standard pack
   * - Creating initial phase (PLANNING)
   * - Creating initial audit log with human summary
   */
  create: permissionProcedure('engagement:create')
    .input(CreateEngagementInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.create({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        input,
        logger: ctx.logger,
      });
    }),

  /**
   * Update engagement fields.
   * Uses optimistic concurrency via _version.
   */
  update: permissionProcedure('engagement:update')
    .input(UpdateEngagementInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, version, ...updates } = input;

      // Check immutability
      const current = await ctx.prisma.engagement.findFirst({
        where: { id, tenantId: ctx.auth.tenantId, deletedAt: null },
        select: { lockedAt: true, status: true },
      });
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (current.lockedAt) {
        throw new TRPCError({
          code: 'CONFLICT',  // 423 mapped — LOCKED
          message: 'Engagement is locked (issued). Create amendment instead.',
          cause: { code: 'LOCKED', lockedAt: current.lockedAt },
        });
      }

      // Attempt update with version check
      const result = await ctx.prisma.engagement.updateMany({
        where: {
          id,
          tenantId: ctx.auth.tenantId,
          _version: version,
          deletedAt: null,
        },
        data: updates,
      });

      await assertUpdateAffected(
        ctx,
        result,
        () => ctx.prisma.engagement.findFirst({
          where: { id, tenantId: ctx.auth.tenantId },
        }),
        'engagement',
        id,
      );

      return ctx.prisma.engagement.findFirstOrThrow({
        where: { id, tenantId: ctx.auth.tenantId },
      });
    }),

  /**
   * Soft delete (sets deletedAt). Only Director+ can delete.
   */
  delete: directorProcedure
    .input(DeleteEngagementInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.softDelete({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        engagementId: input.id,
        version: input.version,
        reason: input.reason,
      });
    }),

  /**
   * Transition status (e.g., PLANNING → FIELDWORK).
   * Validates:
   * - Transition is allowed (status machine)
   * - Exit criteria of current phase are met
   * - User has permission for the target status
   */
  transitionStatus: permissionProcedure('engagement:update')
    .input(TransitionEngagementStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.transitionStatus({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        engagementId: input.id,
        version: input.version,
        newStatus: input.newStatus,
        comments: input.comments,
        skipExitCriteria: !input.confirmExitCriteria,
      });
    }),

  /**
   * Clone an engagement (annual re-audit scenario).
   */
  clone: permissionProcedure('engagement:create')
    .input(CloneEngagementInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.clone({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        input,
      });
    }),

  /**
   * Issue engagement (terminal lock).
   * Requires explicit confirmations to prevent accidental lock.
   * Service checks:
   * - All findings are ISSUED or WITHDRAWN
   * - All checklists passed
   * - All required approvals complete
   * - Signs the engagement with user's session (e-signature)
   */
  issue: directorProcedure
    .input(IssueEngagementInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.issue({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
        engagementId: input.id,
        version: input.version,
        issuanceNotes: input.issuanceNotes,
      });
    }),

  // ===========================================================================
  // TEAM MANAGEMENT
  // ===========================================================================

  addTeamMember: permissionProcedure('engagement:update')
    .input(AddTeamMemberInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.addTeamMember({
        tenantId: ctx.auth.tenantId,
        addedByUserId: ctx.auth.userId,
        ...input,
      });
    }),

  removeTeamMember: permissionProcedure('engagement:update')
    .input(RemoveTeamMemberInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.removeTeamMember({
        tenantId: ctx.auth.tenantId,
        removedByUserId: ctx.auth.userId,
        ...input,
      });
    }),

  updateTeamMember: permissionProcedure('engagement:update')
    .input(UpdateTeamMemberInputSchema)
    .mutation(async ({ input, ctx }) => {
      return engagementService.updateTeamMember({
        tenantId: ctx.auth.tenantId,
        updatedByUserId: ctx.auth.userId,
        ...input,
      });
    }),
});
