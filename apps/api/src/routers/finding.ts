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

import { resolvePackRequirements } from "../packs/resolver";
import {
  authenticatedProcedure,
  mfaFreshProcedure,
  router,
  type AuthedPrisma,
} from "../trpc";

export const findingRouter = router({
  // ─── create ─────────────────────────────────────────────────────────────
  create: authenticatedProcedure
    .input(CreateFindingInput)
    .mutation(async ({ ctx, input }): Promise<FindingDetail> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }

      const resolved = await resolvePackRequirements(
        input.engagementId,
        ctx.services.prismaTenant,
      );

      const elements = input.initialElements ?? {};
      validateElementCodes(elements, resolved.findingElements);
      const elementsComplete = countCompleteElements(elements, resolved.findingElements);

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
      const elements = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        finding.elementValuesCipher,
      );
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

  // ─── updateElement (autosave from TipTap) ───────────────────────────────
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

      const resolved = await resolvePackRequirements(
        current.engagementId,
        ctx.services.prismaTenant,
      );
      const knownCodes = new Set(resolved.findingElements.map((e) => e.code));
      if (!knownCodes.has(input.elementCode)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown element code "${input.elementCode}" for the engagement's pack.`,
        });
      }

      const elements = await decryptElements(
        ctx.services.encryption,
        ctx.session.tenantId,
        current.elementValuesCipher,
      );
      const next: Record<string, string> = { ...elements, [input.elementCode]: input.value };
      const elementsComplete = countCompleteElements(next, resolved.findingElements);
      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        next,
      );

      const updated = await ctx.services.prismaTenant.finding.update({
        where: { id: input.id },
        data: {
          elementValuesCipher: cipher,
          elementsComplete,
          version: { increment: 1 },
        },
      });

      return toDetail(updated, next);
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

      const resolved = await resolvePackRequirements(
        current.engagementId,
        ctx.services.prismaTenant,
      );
      const requiredCount = resolved.findingElements.filter((e) => e.required).length;
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

function validateElementCodes(
  values: Record<string, string>,
  allowed: readonly { code: string }[],
): void {
  const allowedSet = new Set(allowed.map((e) => e.code));
  for (const code of Object.keys(values)) {
    if (!allowedSet.has(code)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown element code "${code}" for the engagement's pack.`,
      });
    }
  }
}

function countCompleteElements(
  values: Record<string, string>,
  required: readonly { code: string; required: boolean; minLength: number }[],
): number {
  let count = 0;
  for (const elem of required) {
    if (!elem.required) continue;
    const v = values[elem.code];
    if (typeof v === "string" && v.length >= elem.minLength) count += 1;
  }
  return count;
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
