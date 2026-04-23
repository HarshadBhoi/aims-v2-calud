/**
 * Engagement tRPC procedures.
 *
 * All procedures are tenant-scoped via the authenticated middleware, which
 * sets the AsyncLocalStorage context that our Prisma client extension
 * reads. Queries through `ctx.services.prismaTenant` auto-inject tenantId.
 */

import {
  CreateEngagementInput,
  GetEngagementInput,
  ListEngagementsInput,
  UpdateEngagementInput,
  type EngagementDetail,
  type EngagementSummary,
  type PaginatedResult,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import { authenticatedProcedure, router } from "../trpc";

export const engagementRouter = router({
  // ─── create ─────────────────────────────────────────────────────────────
  create: authenticatedProcedure
    .input(CreateEngagementInput)
    .mutation(async ({ ctx, input }): Promise<EngagementDetail> => {
      if (input.periodEnd < input.periodStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Engagement period end must be on or after period start.",
        });
      }

      // Verify the lead is a user in the same tenant. The tenant extension
      // filters automatically — if leadUserId belongs to a different tenant,
      // findUnique returns null.
      const lead = await ctx.services.prismaTenant.user.findUnique({
        where: { id: input.leadUserId },
      });
      if (lead?.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead user not found (or not active) in this tenant.",
        });
      }

      const engagement = await ctx.services.prismaTenant.engagement.create({
        // @ts-expect-error — tenantId injected at runtime by our extension.
        // The Prisma generated types don't know about the extension, so this
        // is flagged without the cast.
        data: {
          name: input.name,
          auditeeName: input.auditeeName,
          fiscalPeriod: input.fiscalPeriod,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          ...(input.plannedHours !== undefined ? { plannedHours: input.plannedHours } : {}),
          leadUserId: input.leadUserId,
        },
      });

      return toDetail(engagement);
    }),

  // ─── get ────────────────────────────────────────────────────────────────
  get: authenticatedProcedure
    .input(GetEngagementInput)
    .query(async ({ ctx, input }): Promise<EngagementDetail> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.id },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      return toDetail(engagement);
    }),

  // ─── list ───────────────────────────────────────────────────────────────
  list: authenticatedProcedure
    .input(ListEngagementsInput.optional())
    .query(async ({ ctx, input }): Promise<PaginatedResult<EngagementSummary>> => {
      const filter = input ?? { limit: 20 };

      const items = await ctx.services.prismaTenant.engagement.findMany({
        where: {
          ...(filter.status !== undefined ? { status: filter.status } : {}),
          ...(filter.leadUserId !== undefined ? { leadUserId: filter.leadUserId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: filter.limit + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > filter.limit;
      const page = hasMore ? items.slice(0, filter.limit) : items;
      const lastItem = page[page.length - 1];
      const nextCursor = hasMore && lastItem ? lastItem.id : null;

      return {
        items: page.map(toSummary),
        nextCursor,
      };
    }),

  // ─── update ─────────────────────────────────────────────────────────────
  update: authenticatedProcedure
    .input(UpdateEngagementInput)
    .mutation(async ({ ctx, input }): Promise<EngagementDetail> => {
      const { id, expectedVersion, ...patch } = input;

      // Optimistic concurrency: fetch to confirm version matches.
      const current = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      if (current.version !== expectedVersion) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Stale update: engagement is at version ${current.version.toString()}, caller expected ${expectedVersion.toString()}.`,
        });
      }

      const updated = await ctx.services.prismaTenant.engagement.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.auditeeName !== undefined ? { auditeeName: patch.auditeeName } : {}),
          ...(patch.plannedHours !== undefined ? { plannedHours: patch.plannedHours } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          version: { increment: 1 },
        },
      });

      return toDetail(updated);
    }),
});

// ─── Mappers (DB row → wire shape) ─────────────────────────────────────────

type EngagementRow = {
  id: string;
  name: string;
  auditeeName: string;
  fiscalPeriod: string;
  periodStart: Date;
  periodEnd: Date;
  plannedHours: number | null;
  status: "PLANNING" | "FIELDWORK" | "REPORTING" | "CLOSED";
  leadUserId: string;
  packStrategyLocked: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(row: EngagementRow): EngagementSummary {
  return {
    id: row.id,
    name: row.name,
    auditeeName: row.auditeeName,
    fiscalPeriod: row.fiscalPeriod,
    status: row.status,
    leadUserId: row.leadUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function toDetail(row: EngagementRow): EngagementDetail {
  return {
    ...toSummary(row),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    plannedHours: row.plannedHours,
    packStrategyLocked: row.packStrategyLocked,
  };
}
