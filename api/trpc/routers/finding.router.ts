/**
 * Finding Router
 *
 * Demonstrates:
 * - Polymorphic elementValues (standard-specific fields validated at service layer)
 * - Immutability enforcement after ISSUED
 * - E-signature on issuance (signed hash)
 * - Management response workflow
 * - Repeat finding linkage
 * - Bitemporal data (valid_from / valid_to)
 * - Workflow integration (submit for review, approve, reject)
 */

import { TRPCError } from '@trpc/server';
import { router } from '../middleware';
import { authedProcedure, permissionProcedure } from '../procedures';
import { assertUpdateAffected } from '../middleware';
import {
  CreateFindingInputSchema,
  UpdateFindingInputSchema,
  DeleteFindingInputSchema,
  WithdrawFindingInputSchema,
  SubmitForReviewInputSchema,
  ApproveFindingInputSchema,
  RejectFindingInputSchema,
  IssueFindingInputSchema,
  GetFindingInputSchema,
  ListFindingsInputSchema,
  SubmitManagementResponseInputSchema,
  EvaluateManagementResponseInputSchema,
  FindingStatsInputSchema,
} from '../schemas/finding.schemas';
import { findingService } from '@/services/finding.service';
import { workflowService } from '@/services/workflow.service';
import { buildCursorPagination } from '@/lib/cursor';
import { buildFindingWhere } from '@/services/finding.queries';

export const findingRouter = router({
  // ===========================================================================
  // QUERIES
  // ===========================================================================

  list: authedProcedure
    .input(ListFindingsInputSchema)
    .query(async ({ input, ctx }) => {
      const where = buildFindingWhere(input.filters, ctx.auth.tenantId, ctx.auth.userId);
      const orderBy = input.sort
        ? [{ [input.sort.field]: input.sort.direction }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'asc' as const }];

      const { cursor, take, hasMoreCheck } = buildCursorPagination(input);

      const rows = await ctx.prisma.finding.findMany({
        where,
        orderBy,
        take,
        cursor,
        skip: cursor ? 1 : 0,
        include: {
          _count: { select: { recommendations: true } },
          engagement: {
            select: {
              id: true,
              engagementNumber: true,
              title: true,
              primaryPackCode: true,
              primaryPackVersion: true,
            },
          },
        },
      });

      return hasMoreCheck(rows);
    }),

  get: authedProcedure
    .input(GetFindingInputSchema)
    .query(async ({ input, ctx }) => {
      const finding = await ctx.prisma.finding.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.auth.tenantId,
          deletedAt: null,
        },
        include: {
          engagement: {
            select: {
              id: true,
              engagementNumber: true,
              title: true,
              primaryPackCode: true,
              primaryPackVersion: true,
              status: true,
            },
          },
          recommendations: input.include.recommendations
            ? {
                where: { deletedAt: null },
                include: {
                  correctiveActions: input.include.correctiveActions
                    ? { where: { deletedAt: null } }
                    : false,
                },
              }
            : false,
          managementResponse: input.include.managementResponse,
          priorFinding: {
            select: { id: true, findingNumber: true, title: true },
          },
        },
      });

      if (!finding) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Load pack definition for element rendering (cached)
      const pack = await findingService.loadPackForFinding(finding);

      return { ...finding, pack };
    }),

  stats: authedProcedure
    .input(FindingStatsInputSchema)
    .query(async ({ input, ctx }) => {
      return findingService.computeStats(ctx.auth.tenantId, input);
    }),

  // ===========================================================================
  // MUTATIONS — Core CRUD
  // ===========================================================================

  /**
   * Create finding.
   * Service validates:
   * - elementValues match active Standard Pack's findingElements (required/types)
   * - classification valid for classificationScheme
   * - questioned costs required if federalProgramAln present (Single Audit)
   * - priorFindingId exists if isRepeatFinding
   * - User is on engagement team (or has view_all permission)
   */
  create: permissionProcedure('finding:create')
    .input(CreateFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.create({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        input,
        logger: ctx.logger,
      });
    }),

  update: permissionProcedure('finding:update')
    .input(UpdateFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, version, ...updates } = input;

      // Check immutability
      const current = await ctx.prisma.finding.findFirst({
        where: { id, tenantId: ctx.auth.tenantId, deletedAt: null },
        select: { lockedAt: true, status: true, _version: true },
      });
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (current.lockedAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Finding is LOCKED (issued on ${current.lockedAt.toISOString()}). Create an amendment instead.`,
          cause: { code: 'LOCKED', lockedAt: current.lockedAt },
        });
      }

      // Delegate to service for element validation + update
      return findingService.update({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        id,
        version,
        updates,
      });
    }),

  /**
   * Soft delete. Requires justification.
   * Cannot delete ISSUED findings (use withdraw instead).
   */
  delete: permissionProcedure('finding:delete')
    .input(DeleteFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.softDelete({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        id: input.id,
        version: input.version,
        reason: input.reason,
      });
    }),

  /**
   * Withdraw an ISSUED finding (retract).
   * Different from delete: retains finding record but marks WITHDRAWN.
   * Requires extensive justification; notifies auditee.
   */
  withdraw: permissionProcedure('finding:approve')
    .input(WithdrawFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.withdraw({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        id: input.id,
        version: input.version,
        reason: input.withdrawalReason,
        notifyAuditee: input.notifyAuditee,
      });
    }),

  // ===========================================================================
  // MUTATIONS — Workflow
  // ===========================================================================

  /**
   * Submit finding for review. Starts the approval workflow.
   * Service:
   * - Validates all required elements are complete
   * - Transitions status DRAFT → UNDER_REVIEW
   * - Creates first approval record per pack's FINDING_APPROVAL workflow
   * - Notifies first approver
   */
  submitForReview: permissionProcedure('finding:update')
    .input(SubmitForReviewInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.submitForReview({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        id: input.id,
        version: input.version,
        comments: input.comments,
      });
    }),

  /**
   * Approve a finding's current approval step.
   */
  approve: authedProcedure
    .input(ApproveFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.approve({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
        approvalId: input.approvalId,
        comments: input.comments,
      });
    }),

  /**
   * Reject with comments. Returns to author (or specified step).
   */
  reject: authedProcedure
    .input(RejectFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return workflowService.reject({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        approvalId: input.approvalId,
        reason: input.reason,
        returnToStep: input.returnToStep,
      });
    }),

  /**
   * ISSUE finding (terminal lock with e-signature).
   * Only after all approvals complete.
   * Locks record immutably (enforced by DB trigger).
   */
  issue: permissionProcedure('finding:issue')
    .input(IssueFindingInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.issue({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
        id: input.id,
        version: input.version,
        signatureNote: input.signatureNote,
      });
    }),

  // ===========================================================================
  // MUTATIONS — Management Response
  // ===========================================================================

  /**
   * Auditee submits management response. Requires Auditee role.
   */
  submitManagementResponse: permissionProcedure('management_response:create')
    .input(SubmitManagementResponseInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.submitManagementResponse({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        findingId: input.findingId,
        input,
      });
    }),

  /**
   * Auditor evaluates management response.
   */
  evaluateManagementResponse: permissionProcedure('finding:update')
    .input(EvaluateManagementResponseInputSchema)
    .mutation(async ({ input, ctx }) => {
      return findingService.evaluateManagementResponse({
        tenantId: ctx.auth.tenantId,
        userId: ctx.auth.userId,
        findingId: input.findingId,
        auditorNotes: input.auditorNotes,
        acceptanceStatus: input.acceptanceStatus,
      });
    }),
});
