/**
 * Finding tRPC procedures.
 *
 * State machine (slice A subset):
 *   DRAFT ──submitForReview──▶ IN_REVIEW
 *      ▲                         │
 *      └────RETURN/REJECT decision┤
 *                                 ▼
 *                              APPROVED  (terminal for slice A)
 *
 * Element values are encrypted as a single ALE envelope (per ADR-0001 +
 * ADR-0008-superseded slice plan) keyed by the engagement's tenant DEK.
 * The denormalized `elementsComplete` count is non-sensitive and supports
 * the four-element progress bar without requiring decryption.
 *
 * `decide` uses `mfaFreshProcedure` so the approver's session must have
 * an unexpired MFA freshness window — the slice plan's task 3.5 step-up.
 */

import { type EncryptionModule } from "@aims/encryption";
import {
  CreateFindingInput,
  DecideFindingInput,
  GetFindingInput,
  ListFindingsInput,
  SubmitFindingInput,
  UpdateFindingElementInput,
  type FindingClassificationInput,
  type FindingDetail,
  type FindingStatusInput,
  type FindingSummary,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import {
  countCanonicalElementsComplete,
  normalizeElementKey,
  normalizeToCanonical,
  translateCanonicalToPack,
} from "../packs/key-translation";
import { type ExpectedPackContent } from "../packs/resolver";
import {
  authenticatedProcedure,
  mfaFreshProcedure,
  router,
  type AuthedPrisma,
} from "../trpc";

export const findingRouter = router({
  // ─── create ─────────────────────────────────────────────────────────────
  // Slice B (per ADR-0010): new findings are canonical-native. Storage keys
  // are canonical semantic codes; `elementsCanonicalized=true`. The input
  // accepts either pack-element-codes (legacy slice-A clients) or canonical
  // codes (slice-B native); the server normalizes and logs a deprecation
  // warning for any pack-element-codes submitted.
  create: authenticatedProcedure
    .input(CreateFindingInput)
    .mutation(async ({ ctx, input }): Promise<FindingDetail> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }

      const { primaryPackContent, mergedMappingsContent, requiredCanonicalCodes } =
        await loadCanonicalContext(ctx.services.prismaTenant, input.engagementId);

      const rawElements = input.initialElements ?? {};
      const { normalized: elements, deprecatedKeys } = normalizeToCanonical(
        rawElements,
        mergedMappingsContent,
      );
      if (deprecatedKeys.length > 0) {
        ctx.req.log.warn(
          {
            engagementId: input.engagementId,
            tenantId: ctx.session.tenantId,
            deprecatedKeys,
          },
          "finding.create received pack-element-codes; translated to canonical " +
            "(per ADR-0010). Update clients to send canonical codes directly.",
        );
      }

      const elementsComplete = countCanonicalElementsComplete(
        elements,
        requiredCanonicalCodes,
        primaryPackContent,
      );

      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        elements,
      );

      const findingNumber = await nextFindingNumber(
        ctx.services.prismaTenant,
        input.engagementId,
      );

      const validFrom = input.validFrom ?? new Date();

      try {
        const created = await ctx.services.prismaTenant.finding.create({
          // @ts-expect-error — tenantId injected at runtime by our extension.
          data: {
            engagementId: input.engagementId,
            findingNumber,
            title: input.title,
            classification: input.classification ?? "SIGNIFICANT",
            elementValuesCipher: cipher,
            elementsComplete,
            elementsCanonicalized: true,
            authorId: ctx.session.userId,
            validFrom,
          },
        });
        return toDetail(created, elements);
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Concurrent finding creation collided on findingNumber — please retry.",
          });
        }
        throw err;
      }
    }),

  // ─── get ────────────────────────────────────────────────────────────────
  get: authenticatedProcedure
    .input(GetFindingInput)
    .query(async ({ ctx, input }): Promise<FindingDetail> => {
      const finding = await ctx.services.prismaTenant.finding.findUnique({
        where: { id: input.id },
      });
      if (!finding) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
      }
      const stored = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        finding.elementValuesCipher,
      );
      // Always return canonical-keyed elements to the client. Legacy
      // findings (`elementsCanonicalized=false`, pre-W1.4-7 migration)
      // are stored in pack-codes; we normalize to canonical on the read
      // path so slice-B-native UI clients see a consistent shape
      // regardless of storage state. Without this, an unmigrated finding
      // returns pack-keyed data the UI would interpret as empty slots,
      // and the next autosave would clobber the legacy storage with
      // partial pack-keyed data.
      let elements = stored;
      if (!finding.elementsCanonicalized && Object.keys(stored).length > 0) {
        const { mergedMappingsContent } = await loadCanonicalContext(
          ctx.services.prismaTenant,
          finding.engagementId,
        );
        const { normalized } = normalizeToCanonical(stored, mergedMappingsContent);
        elements = normalized;
      }
      return toDetail(finding, elements);
    }),

  // ─── list ───────────────────────────────────────────────────────────────
  list: authenticatedProcedure
    .input(ListFindingsInput)
    .query(async ({ ctx, input }): Promise<FindingSummary[]> => {
      const findings = await ctx.services.prismaTenant.finding.findMany({
        where: { engagementId: input.engagementId },
        orderBy: { createdAt: "asc" },
      });
      return findings.map(toSummary);
    }),

  // ─── listPending (review queue) ─────────────────────────────────────────
  listPending: authenticatedProcedure.query(
    async ({ ctx }): Promise<FindingSummary[]> => {
      const findings = await ctx.services.prismaTenant.finding.findMany({
        where: { status: "IN_REVIEW" },
        orderBy: { updatedAt: "asc" },
      });
      return findings.map(toSummary);
    },
  ),

  // ─── updateElement (autosave) ───────────────────────────────────────────
  // Per ADR-0010: input `elementCode` may be either a pack-element-code or
  // a canonical semantic code. The server normalizes to canonical, then
  // writes against the finding's current storage shape:
  //   - elementsCanonicalized=true (slice-B-native + post-migration)  →
  //     stored canonical-keyed; just write `next[canonical] = value`.
  //   - elementsCanonicalized=false (legacy slice-A finding)           →
  //     stored pack-keyed; translate canonical back to pack via the
  //     primary pack's mappings before writing. Run the W1 migration
  //     script to flip these to the canonical-native shape.
  updateElement: authenticatedProcedure
    .input(UpdateFindingElementInput)
    .mutation(async ({ ctx, input }): Promise<FindingDetail> => {
      const current = await ctx.services.prismaTenant.finding.findUnique({
        where: { id: input.id },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
      }
      assertVersion(current.version, input.expectedVersion);
      assertStatus(current.status, "DRAFT", "Element edits");

      const { primaryPackContent, mergedMappingsContent, requiredCanonicalCodes } =
        await loadCanonicalContext(ctx.services.prismaTenant, current.engagementId);

      const { canonical, wasDeprecated } = normalizeElementKey(
        input.elementCode,
        mergedMappingsContent,
      );
      if (wasDeprecated) {
        ctx.req.log.warn(
          {
            findingId: current.id,
            engagementId: current.engagementId,
            tenantId: ctx.session.tenantId,
            submittedCode: input.elementCode,
            canonicalCode: canonical,
          },
          "finding.updateElement received a pack-element-code; translated to " +
            "canonical (per ADR-0010). Update clients to send canonical codes.",
        );
      }

      const elements = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        current.elementValuesCipher,
      );

      // Build the new payload in whatever shape the finding's storage uses.
      // Canonical-native: keys are canonical, write canonical.
      // Legacy pack-keyed: translate canonical → pack-element-code for the
      // single key being updated, write pack-keyed. The other keys stay as
      // they were.
      let nextStored: Record<string, string>;
      let nextCanonicalView: Record<string, string>;
      if (current.elementsCanonicalized) {
        nextStored = { ...elements, [canonical]: input.value };
        nextCanonicalView = nextStored;
      } else {
        const packKey = translateCanonicalToPack(
          { [canonical]: input.value },
          primaryPackContent,
        );
        nextStored = { ...elements, ...packKey };
        // For elementsComplete counting, view through the canonical lens.
        const { normalized: viewed } = normalizeToCanonical(
          nextStored,
          primaryPackContent,
        );
        nextCanonicalView = viewed;
      }

      const elementsComplete = countCanonicalElementsComplete(
        nextCanonicalView,
        requiredCanonicalCodes,
        primaryPackContent,
      );
      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        nextStored,
      );

      // Atomic optimistic-concurrency guard: the W1 migration script can
      // flip `elementsCanonicalized` (and re-encrypt the cipher) on a
      // legacy finding concurrently with this autosave. If we did a bare
      // `update where id=…`, our pack-keyed write would silently clobber
      // the migration's canonical-keyed write — leaving the row in a
      // corrupt state where the flag says canonical but storage is pack.
      // Use `updateMany where { id, version }` so the DB enforces the
      // version match and we can detect the conflict.
      const result = await ctx.services.prismaTenant.finding.updateMany({
        where: { id: input.id, version: current.version },
        data: {
          elementValuesCipher: cipher,
          elementsComplete,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            `Finding ${input.id} was modified concurrently (expected version ` +
            `${current.version.toString()}). Refresh and retry.`,
        });
      }
      const updated = await ctx.services.prismaTenant.finding.findUniqueOrThrow({
        where: { id: input.id },
      });

      return toDetail(updated, nextStored);
    }),

  // ─── submitForReview ────────────────────────────────────────────────────
  submitForReview: authenticatedProcedure
    .input(SubmitFindingInput)
    .mutation(async ({ ctx, input }): Promise<FindingDetail> => {
      const current = await ctx.services.prismaTenant.finding.findUnique({
        where: { id: input.id },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
      }
      assertVersion(current.version, input.expectedVersion);
      assertStatus(current.status, "DRAFT", "Submit for review");

      // Per ADR-0011: "complete" means every required canonical code (from
      // the union across all attached packs) has a value of sufficient
      // length. The persisted strictness row carries that union.
      const { requiredCanonicalCodes } = await loadCanonicalContext(
        ctx.services.prismaTenant,
        current.engagementId,
      );
      const requiredCount = requiredCanonicalCodes.length;
      if (current.elementsComplete < requiredCount) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `All required elements must be complete (${current.elementsComplete.toString()}/${requiredCount.toString()}).`,
        });
      }

      const [updated] = await ctx.services.prismaTenant.$transaction([
        ctx.services.prismaTenant.finding.update({
          where: { id: input.id },
          data: { status: "IN_REVIEW", version: { increment: 1 } },
        }),
        ctx.services.prismaTenant.approvalRequest.create({
          // @ts-expect-error — tenantId injected at runtime by our extension.
          data: {
            targetType: "finding",
            targetId: input.id,
            findingId: input.id,
            status: "PENDING",
            requestedById: ctx.session.userId,
          },
        }),
      ]);

      const elements = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        updated.elementValuesCipher,
      );
      return toDetail(updated, elements);
    }),

  // ─── decide (approve / return / reject — MFA step-up required) ──────────
  decide: mfaFreshProcedure
    .input(DecideFindingInput)
    .mutation(async ({ ctx, input }): Promise<FindingDetail> => {
      const current = await ctx.services.prismaTenant.finding.findUnique({
        where: { id: input.id },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found." });
      }
      assertVersion(current.version, input.expectedVersion);
      assertStatus(current.status, "IN_REVIEW", "Decide");

      const pending = await ctx.services.prismaTenant.approvalRequest.findFirst({
        where: { findingId: input.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
      if (!pending) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No pending approval for this finding.",
        });
      }

      const nextFindingStatus: FindingStatusInput =
        input.decision === "APPROVED" ? "APPROVED" : "DRAFT";
      const nextApprovalStatus =
        input.decision === "APPROVED"
          ? "APPROVED"
          : input.decision === "REJECTED"
            ? "REJECTED"
            : "RETURNED";

      const [updated] = await ctx.services.prismaTenant.$transaction([
        ctx.services.prismaTenant.finding.update({
          where: { id: input.id },
          data: { status: nextFindingStatus, version: { increment: 1 } },
        }),
        ctx.services.prismaTenant.approvalRequest.update({
          where: { id: pending.id },
          data: {
            status: nextApprovalStatus,
            decision: input.decision,
            ...(input.comment !== undefined ? { decisionComment: input.comment } : {}),
            decidedAt: new Date(),
            approverId: ctx.session.userId,
            approverSessionId: ctx.session.sessionId,
          },
        }),
      ]);

      const elements = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        updated.elementValuesCipher,
      );
      return toDetail(updated, elements);
    }),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Stale update: finding is at version ${actual.toString()}, caller expected ${expected.toString()}.`,
    });
  }
}

function assertStatus(
  actual: FindingStatusInput,
  required: FindingStatusInput,
  action: string,
): void {
  if (actual !== required) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${action} requires status ${required} (current: ${actual}).`,
    });
  }
}

async function nextFindingNumber(
  prisma: AuthedPrisma,
  engagementId: string,
): Promise<string> {
  const count = await prisma.finding.count({ where: { engagementId } });
  const year = new Date().getFullYear();
  return `F-${year.toString()}-${(count + 1).toString().padStart(4, "0")}`;
}

/**
 * Loads the engagement's full pack-attachment context + the persisted
 * strictness row. Returns:
 *   - primaryPackContent: the primary pack's content, used for label
 *     resolution and the minLength lookup in completion counting.
 *   - mergedMappingsContent: a synthetic pack content that *unions* every
 *     attached pack's `semanticElementMappings`. The key-translation
 *     helpers operate on a single content shape, so we merge upstream so
 *     they can recognize codes from secondary packs too (e.g., IIA's
 *     ROOT_CAUSE / CONSEQUENCE / RECOMMENDATION when GAGAS is primary).
 *   - requiredCanonicalCodes: union from the strictness row (ADR-0011).
 *
 * Throws PRECONDITION_FAILED if the engagement has no primary pack
 * attached or no persisted strictness row (the resolver hasn't run yet).
 */
async function loadCanonicalContext(
  prisma: AuthedPrisma,
  engagementId: string,
): Promise<{
  primaryPackContent: ExpectedPackContent;
  mergedMappingsContent: ExpectedPackContent;
  requiredCanonicalCodes: readonly string[];
}> {
  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });
  const primaryAttachment = attachments.find((a) => a.isPrimary);
  if (!primaryAttachment) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Engagement has no primary pack attached. Attach a pack via pack.attach first.",
    });
  }
  const strictness = await prisma.engagementStrictness.findUnique({
    where: { engagementId },
  });
  if (!strictness) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "No strictness row for this engagement. The resolver hasn't run — call pack.attach (or detach/swap) to populate.",
    });
  }

  const primaryPackContent = primaryAttachment.pack.packContent as ExpectedPackContent;

  // Merge every attached pack's mappings + findingElements so the
  // key-translation helpers can validate codes contributed by secondary
  // packs. On code collisions (a packElementCode declared by both packs
  // mapping to different canonicals), the primary wins — that matches the
  // "primary precedence" invariant from ADR-0011.
  const mergedMappings: NonNullable<ExpectedPackContent["semanticElementMappings"]> = [];
  const mergedFindingElements: NonNullable<ExpectedPackContent["findingElements"]> = [];
  const seenPackCodes = new Set<string>();
  const seenFindingElementCodes = new Set<string>();
  // Iterate primary first so its mappings take precedence on duplicates.
  const ordered = [primaryAttachment, ...attachments.filter((a) => !a.isPrimary)];
  for (const a of ordered) {
    const content = a.pack.packContent as ExpectedPackContent;
    for (const m of content.semanticElementMappings ?? []) {
      if (seenPackCodes.has(m.packElementCode)) continue;
      seenPackCodes.add(m.packElementCode);
      mergedMappings.push(m);
    }
    for (const fe of content.findingElements ?? []) {
      if (seenFindingElementCodes.has(fe.code)) continue;
      seenFindingElementCodes.add(fe.code);
      mergedFindingElements.push(fe);
    }
  }
  const mergedMappingsContent: ExpectedPackContent = {
    semanticElementMappings: mergedMappings,
    findingElements: mergedFindingElements,
  };

  return {
    primaryPackContent,
    mergedMappingsContent,
    requiredCanonicalCodes: strictness.requiredCanonicalCodes,
  };
}

async function decryptElements(
  encryption: EncryptionModule,
  tenantId: string,
  cipher: Buffer | null,
): Promise<Record<string, string>> {
  if (!cipher || cipher.length === 0) return {};
  return encryption.decryptJson<Record<string, string>>(tenantId, cipher);
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "P2002"
  );
}

// ─── Mappers ───────────────────────────────────────────────────────────────

type FindingRow = {
  id: string;
  engagementId: string;
  findingNumber: string;
  title: string;
  classification: FindingClassificationInput;
  status: FindingStatusInput;
  elementValuesCipher: Buffer | null;
  elementsComplete: number;
  validFrom: Date | null;
  validTo: Date | null;
  authorId: string;
  lockedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(row: FindingRow): FindingSummary {
  return {
    id: row.id,
    engagementId: row.engagementId,
    findingNumber: row.findingNumber,
    title: row.title,
    status: row.status,
    classification: row.classification,
    elementsComplete: row.elementsComplete,
    authorId: row.authorId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: FindingRow, elementValues: Record<string, string>): FindingDetail {
  return {
    ...toSummary(row),
    elementValues,
    validFrom: row.validFrom,
    validTo: row.validTo,
    lockedAt: row.lockedAt,
  };
}
