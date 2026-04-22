/**
 * Approval Router (Workflow Engine)
 *
 * Polymorphic approvals — works for engagements, findings, reports,
 * planning documents, workpapers, etc.
 *
 * Workflow definition comes from the active Standard Pack. This router
 * is the generic engine that reads pack workflows and executes them.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../middleware';
import { authedProcedure } from '../procedures';
import {
  CuidSchema,
  NonEmptyStringSchema,
  ApprovalStatusEnum,
  PaginationInputSchema,
  sortInputSchema,
  DateRangeSchema,
} from '../schemas/common.schemas';
import { workflowService } from '@/services/workflow.service';
import { buildCursorPagination } from '@/lib/cursor';

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const ListApprovalsInputSchema = PaginationInputSchema.extend({
  filters: z
    .object({
      status: z.array(ApprovalStatusEnum).optional(),
      entityType: z
        .array(
          z.enum([
            'engagement',
            'planning_document',
            'finding',
            'recommendation',
            'report',
            'workpaper',
            'independence_declaration',
            'qa_checklist',
            'corrective_action',
          ]),
        )
        .optional(),
      entityId: CuidSchema.optional(),
      assignedToMe: z.boolean().default(false),
      mySubmissions: z.boolean().default(false),
      allPending: z.boolean().default(false),  // Requires permission
      slaDue: DateRangeSchema.optional(),
    })
    .default({}),
  sort: sortInputSchema(['createdAt', 'slaDueAt', 'stepOrder']),
});

const GetApprovalInputSchema = z.object({ id: CuidSchema });

const ApproveInputSchema = z.object({
  id: CuidSchema,
  comments: z.string().max(2000).optional(),
});

const RejectInputSchema = z.object({
  id: CuidSchema,
  reason: NonEmptyStringSchema.min(10).max(2000),
  returnToStep: z.number().int().optional(),
});

const DelegateInputSchema = z.object({
  id: CuidSchema,
  toUserId: CuidSchema,
  reason: z.string().max(1000).optional(),
});

const RecallInputSchema = z.object({
  id: CuidSchema,
  reason: z.string().max(1000).optional(),
});

const GetWorkflowStatusInputSchema = z.object({
  entityType: z.string(),
  entityId: CuidSchema,
});

// =============================================================================
// ROUTER
// =============================================================================

export const approvalRouter = router({
  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * List approvals. Supports "my queue" and "all pending" views.
   */
  list: authedProcedure
    .input(ListApprovalsInputSchema)
    .query(async ({ input, ctx }) => {
      const { filters } = input;

      // Enforce permission for "all pending"
      if (filters.allPending && !ctx.auth.permissions.has('approval:view_all')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Viewing all pending approvals requires approval:view_all permission',
          cause: { code: 'UNAUTHORIZED' },
        });
      }

      const where = {
        tenantId: ctx.auth.tenantId,
        ...(filters.status?.length && { status: { in: filters.status } }),
        ...(filters.entityType?.length && { entityType: { in: filters.entityType } }),
        ...(filters.entityId && { entityId: filters.entityId }),
        ...(filters.assignedToMe && {
          assignedToId: ctx.auth.userId,
          status: 'PENDING' as const,
        }),
        ...(filters.mySubmissions && { requestedById: ctx.auth.userId }),
        ...(filters.slaDue && {
          slaDueAt: {
            ...(filters.slaDue.from && { gte: new Date(filters.slaDue.from) }),
            ...(filters.slaDue.to && { lte: new Date(filters.slaDue.to) }),
          },
        }),
      };

      const orderBy = input.sort
        ? [{ [input.sort.field]: input.sort.direction }, { id: 'asc' as const }]
        : [{ slaDueAt: 'asc' as const }, { id: 'asc' as const }];

      const { cursor, take, hasMoreCheck } = buildCursorPagination(input);

      const rows = await ctx.prisma.approval.findMany({
        where,
        orderBy,
        take,
        cursor,
        skip: cursor ? 1 : 0,
      });

      return hasMoreCheck(rows);
    }),

  /**
   * Get single approval with full history of its workflow.
   */
  get: authedProcedure
    .input(GetApprovalInputSchema)
    .query(async ({ input, ctx }) => {
      const approval = await ctx.prisma.approval.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenantId },
      });
      if (!approval) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Also fetch all sibling approvals for this entity (full workflow chain)
      const chain = await ctx.prisma.approval.findMany({
        where: {
          tenantId: ctx.auth.tenantId,
          entityType: approval.entityType,
          entityId: approval.entityId,
          workflowCode: approval.workflowCode,
        },
        orderBy: { stepOrder: 'asc' },
      });

      return { approval, chain };
    }),

  /**
   * Get workflow status for a specific entity.
   * Returns all approvals + current step info.
   */
  getWorkflowStatus: authedProcedure
    .input(GetWorkflowStatusInputSchema)
    .query(async ({ input, ctx }) => {
      return workflowService.getStatus({
        tenantId: ctx.auth.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
      });
    }),

  /**
   * Count of "my pending approvals" — used for topbar badge.
   */
  countMyPending: authedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const count = await ctx.prisma.approval.count({
        where: {
          tenantId: ctx.auth.tenantId,
          assignedToId: ctx.auth.userId,
          status: 'PENDING',
        },
      });
      return { count };
    }),

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  /**
   * Approve current step. Auto-advances to next step if not last.
   * If last step, transitions underlying entity to next status.
   */
  approve: authedProcedure
    .input(ApproveInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.approve({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
        approvalId: input.id,
        comments: input.comments,
      });
    }),

  /**
   * Reject with required reason. Returns entity to author.
   */
  reject: authedProcedure
    .input(RejectInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.reject({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        approvalId: input.id,
        reason: input.reason,
        returnToStep: input.returnToStep,
      });
    }),

  /**
   * Delegate to another user (must have same required role).
   * Original approver retains audit trail accountability.
   */
  delegate: authedProcedure
    .input(DelegateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.delegate({
        tenantId: ctx.auth.tenantId,
        delegatedByUserId: ctx.auth.userId,
        approvalId: input.id,
        toUserId: input.toUserId,
        reason: input.reason,
      });
    }),

  /**
   * Recall submission before first approver acts on it.
   * Only allowed if no approvals in the chain have been decided yet.
   */
  recall: authedProcedure
    .input(RecallInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.recall({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        approvalId: input.id,
        reason: input.reason,
      });
    }),
});
