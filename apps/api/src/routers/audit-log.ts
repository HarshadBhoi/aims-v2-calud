/**
 * Audit-log tRPC procedures (slice A task 4.7).
 *
 * Read-only surface over `audit.audit_log`:
 *   - `list` — paginated, tenant-scoped (RLS + Prisma extension), optional
 *     filter by `(entityType, entityId)` so users can drill into "what
 *     happened to this finding / report / engagement".
 *   - `verifyChain` — invokes the SQL function `audit.verify_chain()` to
 *     confirm the SHA-256 chain is intact end-to-end. Uses the admin Prisma
 *     client because the chain is global (cross-tenant): tenant-scoped
 *     reading would see gaps and falsely report "broken".
 */

import {
  ListAuditLogInput,
  type AuditLogEntry,
  type VerifyChainResult,
} from "@aims/validation";

import { authenticatedProcedure, router } from "../trpc";

type AuditLogRow = {
  id: string;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  beforeData: unknown;
  afterData: unknown;
  previousHash: string | null;
  contentHash: string;
  chainPosition: bigint;
  loggedAt: Date;
};

type VerifyChainRow = {
  ok: boolean;
  broken_at: bigint | null;
  total_rows: bigint;
  reason: string;
};

export const auditLogRouter = router({
  // ─── list ───────────────────────────────────────────────────────────────
  list: authenticatedProcedure
    .input(ListAuditLogInput)
    .query(async ({ ctx, input }): Promise<{
      items: readonly AuditLogEntry[];
      nextCursor: string | null;
    }> => {
      // Cursor is the last seen `chainPosition`, encoded as a string. The
      // model's primary key is composite (`id, loggedAt`) so we can't use
      // Prisma's native cursor on a single column; the equivalent
      // "where chainPosition < cursor" filter does the same job for a
      // strictly-monotonic chain.
      const where: {
        entityType?: string;
        entityId?: string;
        chainPosition?: { lt: bigint };
      } = {};
      if (input.entityType !== undefined) where.entityType = input.entityType;
      if (input.entityId !== undefined) where.entityId = input.entityId;
      if (input.cursor !== undefined) {
        where.chainPosition = { lt: BigInt(input.cursor) };
      }

      const rows = (await ctx.services.prismaTenant.auditLog.findMany({
        where,
        orderBy: [{ chainPosition: "desc" }],
        take: input.limit + 1,
      })) as AuditLogRow[];

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const lastRow = page[page.length - 1];
      const nextCursor =
        hasMore && lastRow ? lastRow.chainPosition.toString() : null;

      return {
        items: page.map(toEntry),
        nextCursor,
      };
    }),

  // ─── verifyChain (admin client; chain is global) ────────────────────────
  verifyChain: authenticatedProcedure.query(
    async ({ ctx }): Promise<VerifyChainResult> => {
      const rows = await ctx.services.prisma.$queryRawUnsafe<VerifyChainRow[]>(
        "SELECT ok, broken_at, total_rows, reason FROM audit.verify_chain()",
      );
      const row = rows[0];
      if (!row) {
        // Empty chain — verify_chain always returns a row, but guard anyway.
        return {
          ok: true,
          brokenAt: null,
          totalRows: 0n,
          reason: "chain empty",
        };
      }
      return {
        ok: row.ok,
        brokenAt: row.broken_at,
        totalRows: row.total_rows,
        reason: row.reason,
      };
    },
  ),
});

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    userId: row.userId,
    beforeData: row.beforeData,
    afterData: row.afterData,
    previousHash: row.previousHash,
    contentHash: row.contentHash,
    chainPosition: row.chainPosition,
    loggedAt: row.loggedAt,
  };
}
