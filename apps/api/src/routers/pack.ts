/**
 * Pack tRPC procedures — pack listing, attachment lifecycle, resolution.
 *
 * Slice B introduces multi-pack attachment, the primary-methodology lifecycle
 * (ADR-0011), and the strictness resolver write path. Lifecycle invariant:
 *   - Exactly one PackAttachment per engagement carries `isPrimary = true`.
 *   - Bare `pack.detach` of the primary returns PRECONDITION_FAILED.
 *   - `pack.swapPrimary({ from, to })` is the sole supported affordance for
 *     changing the primary methodology — atomic detach + attach inside one
 *     transaction with a single resolver re-run at the end.
 *
 * Every state-changing procedure (`attach`, `detach`, `swapPrimary`) wraps
 * the attachment-table write and the strictness re-resolve in one
 * `$transaction` so the EngagementStrictness row is always consistent with
 * the attachment graph (per ADR-0011).
 */

import {
  AttachPackInput,
  DetachPackInput,
  ListAttachedPacksInput,
  ResolvePackInput,
  StrictnessInput,
  SwapPrimaryInput,
  type AttachedPackSummary,
  type PackSummary,
  type ResolvedRequirements,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import { resolveAndPersist, resolvePackRequirements } from "../packs/resolver";
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

  // ─── listAttached (W3 day 2-3 — multi-report composer + strictness UI) ──
  // Returns the engagement's currently-attached packs with the join to
  // StandardPack metadata + the per-attachment flags (`isPrimary`,
  // `conformanceClaimed`). The W3 report composer's `attestsTo` dropdown
  // and the engagement-detail strictness panel both consume this.
  listAttached: authenticatedProcedure
    .input(ListAttachedPacksInput)
    .query(async ({ ctx, input }): Promise<AttachedPackSummary[]> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      const attachments = await ctx.services.prismaTenant.packAttachment.findMany({
        where: { engagementId: input.engagementId },
        include: { pack: true },
        orderBy: [{ isPrimary: "desc" }, { packCode: "asc" }],
      });
      return attachments.map((a) => ({
        packCode: a.packCode,
        packVersion: a.packVersion,
        name: a.pack.name,
        issuingBody: a.pack.issuingBody,
        isPrimary: a.isPrimary,
        conformanceClaimed: a.conformanceClaimed,
      }));
    }),

  // ─── attach ─────────────────────────────────────────────────────────────
  attach: authenticatedProcedure
    .input(AttachPackInput)
    .mutation(async ({ ctx, input }) => {
      const { prismaTenant } = ctx.services;

      // Confirm engagement exists in this tenant.
      const engagement = await prismaTenant.engagement.findUnique({
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
      const pack = await prismaTenant.standardPack.findUnique({
        where: { code_version: { code: input.packCode, version: input.packVersion } },
      });
      if (!pack) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pack not found." });
      }

      // Determine isPrimary: explicit input wins; otherwise default by
      // "first attach → primary, subsequent → non-primary."
      const existingCount = await prismaTenant.packAttachment.count({
        where: { engagementId: input.engagementId },
      });
      const isPrimary = input.isPrimary ?? existingCount === 0;

      // If the caller asks for isPrimary=true but there's already a primary,
      // surface that as a clean error. The DB partial unique index would also
      // catch this, but we throw earlier with a better message.
      if (isPrimary && existingCount > 0) {
        const currentPrimary = await prismaTenant.packAttachment.findFirst({
          where: { engagementId: input.engagementId, isPrimary: true },
          select: { packCode: true, packVersion: true },
        });
        if (currentPrimary) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              `Engagement already has a primary methodology ` +
              `(${currentPrimary.packCode}:${currentPrimary.packVersion}). ` +
              `Use pack.swapPrimary to change which attachment is primary.`,
          });
        }
      }

      // Slice B W3.6-7: validate annotations before the transaction.
      // `loosen` direction is rejected on conformance-claimed packs (the
      // default) — you can't loosen a standard while claiming conformance
      // to it. Slice C may permit loosen on conformanceClaimed=false packs;
      // for slice B we don't introduce that surface.
      if (input.annotations && input.annotations.length > 0) {
        const looseners = input.annotations.filter((a) => a.direction === "loosen");
        if (looseners.length > 0) {
          // The pack attachment defaults conformanceClaimed=true, so any
          // loosen here is rejected. Future slice C may pass
          // conformanceClaimed=false on AttachPackInput; the gate updates then.
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              `Cannot loosen rule(s) on a conformance-claimed pack ` +
              `(${input.packCode}:${input.packVersion}). Loosen annotations ` +
              `are only valid on attachments where conformanceClaimed=false. ` +
              `Affected rule(s): ${looseners.map((a) => a.rule).join(", ")}.`,
          });
        }
      }

      try {
        const attached = await prismaTenant.$transaction(async (tx) => {
          const attachment = await tx.packAttachment.create({
            // @ts-expect-error — tenantId injected at runtime by our extension.
            data: {
              engagementId: input.engagementId,
              packCode: input.packCode,
              packVersion: input.packVersion,
              attachedBy: ctx.session.userId,
              isPrimary,
              ...(input.annotations !== undefined
                ? { annotations: input.annotations }
                : {}),
            },
          });
          await resolveAndPersist(input.engagementId, tx as typeof prismaTenant);
          return attachment;
        });

        return {
          id: attached.id,
          engagementId: attached.engagementId,
          packCode: attached.packCode,
          packVersion: attached.packVersion,
          isPrimary: attached.isPrimary,
          attachedAt: attached.attachedAt,
        };
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This pack version is already attached to this engagement.",
          });
        }
        throw err;
      }
    }),

  // ─── detach ─────────────────────────────────────────────────────────────
  // Per ADR-0011: bare detach of the primary methodology is rejected.
  // Use `pack.swapPrimary` to change which attachment is primary.
  detach: authenticatedProcedure
    .input(DetachPackInput)
    .mutation(async ({ ctx, input }) => {
      const { prismaTenant } = ctx.services;

      const engagement = await prismaTenant.engagement.findUnique({
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

      const attachment = await prismaTenant.packAttachment.findUnique({
        where: {
          engagementId_packCode_packVersion: {
            engagementId: input.engagementId,
            packCode: input.packCode,
            packVersion: input.packVersion,
          },
        },
      });
      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pack attachment not found on this engagement.",
        });
      }
      if (attachment.isPrimary) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cannot detach the engagement's primary methodology directly. " +
            "Use pack.swapPrimary({ from, to }) to change which attachment is primary.",
        });
      }

      await prismaTenant.$transaction(async (tx) => {
        await tx.packAttachment.delete({ where: { id: attachment.id } });
        await resolveAndPersist(input.engagementId, tx as typeof prismaTenant);
      });

      return { detached: true };
    }),

  // ─── swapPrimary ────────────────────────────────────────────────────────
  // Atomic primary swap: detach the old primary, attach (or flip) the new
  // primary, re-run the resolver — all inside one transaction. Idempotent:
  // if `from` is already detached and `to` is already primary, returns a
  // no-op success rather than failing.
  swapPrimary: authenticatedProcedure
    .input(SwapPrimaryInput)
    .mutation(async ({ ctx, input }) => {
      const { prismaTenant } = ctx.services;

      const engagement = await prismaTenant.engagement.findUnique({
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

      // Confirm `to` pack exists (cross-tenant lookup).
      const toPack = await prismaTenant.standardPack.findUnique({
        where: {
          code_version: { code: input.toPackCode, version: input.toPackVersion },
        },
      });
      if (!toPack) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target pack not found." });
      }

      // Idempotency check: read current state. The swap is considered
      // already-done iff:
      //   1. `to` is the current primary, AND
      //   2. `from` is not attached at all (i.e., the prior detach landed).
      // Just "to is primary" isn't enough — a caller passing a bogus `from`
      // must get an error, not a false success. (Round-3 Gemini catch.)
      const currentPrimary = await prismaTenant.packAttachment.findFirst({
        where: { engagementId: input.engagementId, isPrimary: true },
      });
      const fromAttachment = await prismaTenant.packAttachment.findUnique({
        where: {
          engagementId_packCode_packVersion: {
            engagementId: input.engagementId,
            packCode: input.fromPackCode,
            packVersion: input.fromPackVersion,
          },
        },
      });
      const fromMatchesPrimary =
        currentPrimary !== null &&
        currentPrimary.packCode === input.fromPackCode &&
        currentPrimary.packVersion === input.fromPackVersion;
      const toMatchesPrimary =
        currentPrimary !== null &&
        currentPrimary.packCode === input.toPackCode &&
        currentPrimary.packVersion === input.toPackVersion;

      if (toMatchesPrimary && fromAttachment === null) {
        // True idempotent path: the swap already happened in a prior call.
        return { swapped: false, alreadyPrimary: true };
      }

      if (!fromMatchesPrimary) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            `swapPrimary 'from' pack does not match the engagement's current ` +
            `primary methodology (current: ` +
            `${currentPrimary ? `${currentPrimary.packCode}:${currentPrimary.packVersion}` : "none"}).`,
        });
      }

      await prismaTenant.$transaction(async (tx) => {
        // Detach the current primary.
        // We don't `delete` it then re-create — instead flip isPrimary off
        // so any existing (toCode, toVersion) attachment can be promoted.
        // `from` is removed entirely; `to` becomes primary (creating the
        // attachment if it wasn't already there).
        await tx.packAttachment.delete({ where: { id: currentPrimary.id } });

        // Look for an existing non-primary attachment of `to`. If present,
        // flip it to primary; otherwise create it as the new primary.
        const existingTo = await tx.packAttachment.findUnique({
          where: {
            engagementId_packCode_packVersion: {
              engagementId: input.engagementId,
              packCode: input.toPackCode,
              packVersion: input.toPackVersion,
            },
          },
        });
        if (existingTo) {
          await tx.packAttachment.update({
            where: { id: existingTo.id },
            data: { isPrimary: true },
          });
        } else {
          await tx.packAttachment.create({
            // @ts-expect-error — tenantId injected at runtime by our extension.
            data: {
              engagementId: input.engagementId,
              packCode: input.toPackCode,
              packVersion: input.toPackVersion,
              attachedBy: ctx.session.userId,
              isPrimary: true,
            },
          });
        }

        await resolveAndPersist(input.engagementId, tx as typeof prismaTenant);
      });

      return { swapped: true, alreadyPrimary: false };
    }),

  // ─── resolve ────────────────────────────────────────────────────────────
  resolve: authenticatedProcedure
    .input(ResolvePackInput)
    .query(async ({ ctx, input }): Promise<ResolvedRequirements> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      return resolvePackRequirements(input.engagementId, ctx.services.prismaTenant);
    }),

  // ─── strictness ─────────────────────────────────────────────────────────
  // Slice B (ADR-0011): returns the persisted EngagementStrictness row plus
  // its drivenBy trail. Read-only — the resolver is the only writer.
  strictness: authenticatedProcedure
    .input(StrictnessInput)
    .query(async ({ ctx, input }) => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }
      const row = await ctx.services.prismaTenant.engagementStrictness.findUnique({
        where: { engagementId: input.engagementId },
      });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "No strictness row for this engagement yet — attach at least one pack to populate.",
        });
      }
      return {
        engagementId: row.engagementId,
        retentionYears: row.retentionYears,
        coolingOffMonths: row.coolingOffMonths,
        cpeHours: row.cpeHours,
        documentationRequirements: row.documentationRequirements,
        requiredCanonicalCodes: row.requiredCanonicalCodes,
        drivenBy: row.drivenBy,
        version: row.version,
        updatedAt: row.updatedAt,
      };
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
