/**
 * Pack tRPC procedures — pack listing, attachment, and resolution.
 *
 * `pack.list` is cross-tenant (StandardPack is a platform-level model and
 * exempted from the tenant extension). The other procedures are tenant-
 * scoped because PackAttachment is.
 */

import {
  AttachPackInput,
  ResolvePackInput,
  type PackSummary,
  type ResolvedRequirements,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import { resolvePackRequirements } from "../packs/resolver";
import { authenticatedProcedure, router } from "../trpc";

export const packRouter = router({
  // ─── list ───────────────────────────────────────────────────────────────
  list: authenticatedProcedure.query(async ({ ctx }): Promise<PackSummary[]> => {
    // StandardPack is cross-tenant — passes through the extension unchanged.
    const packs = await ctx.services.prismaTenant.standardPack.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
      select: {
        code: true,
        version: true,
        name: true,
        issuingBody: true,
        publishedYear: true,
      },
    });
    return packs;
  }),

  // ─── attach ─────────────────────────────────────────────────────────────
  attach: authenticatedProcedure
    .input(AttachPackInput)
    .mutation(async ({ ctx, input }) => {
      // Confirm engagement exists in this tenant (extension scopes).
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      if (engagement.packStrategyLocked) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Pack strategy is locked — unlock first (requires CAE approval).",
        });
      }

      // Confirm the pack exists (cross-tenant).
      const pack = await ctx.services.prismaTenant.standardPack.findUnique({
        where: { code_version: { code: input.packCode, version: input.packVersion } },
      });
      if (!pack) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pack not found." });
      }

      // Create the attachment. Unique constraint on
      // (engagementId, packCode, packVersion) surfaces P2002 on duplicate.
      try {
        const attachment = await ctx.services.prismaTenant.packAttachment.create({
          // @ts-expect-error — tenantId injected at runtime by our extension.
          data: {
            engagementId: input.engagementId,
            packCode: input.packCode,
            packVersion: input.packVersion,
            attachedBy: ctx.session.userId,
          },
        });
        return {
          id: attachment.id,
          engagementId: attachment.engagementId,
          packCode: attachment.packCode,
          packVersion: attachment.packVersion,
          attachedAt: attachment.attachedAt,
        };
      } catch (err) {
        // Prisma uniqueness violation code
        if (isPrismaUniqueViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This pack version is already attached to this engagement.",
          });
        }
        throw err;
      }
    }),

  // ─── resolve ────────────────────────────────────────────────────────────
  resolve: authenticatedProcedure
    .input(ResolvePackInput)
    .query(async ({ ctx, input }): Promise<ResolvedRequirements> => {
      // Verify engagement exists + is in this tenant.
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      return resolvePackRequirements(input.engagementId, ctx.services.prismaTenant);
    }),
});

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "P2002"
  );
}
