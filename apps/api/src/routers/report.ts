/**
 * Report tRPC procedures — slice A vertical slice scope.
 *
 * State machine:
 *   DRAFT ──submitForSignoff──▶ IN_REVIEW ──sign (MFA-fresh + attestation)──▶ PUBLISHED
 *      ▲                            │
 *      └─── (slice A: no return path; future slices add review-and-return)
 *
 * Section model (slice A `engagement-report-v1`):
 *   data sections (server-regenerated):  engagement_overview, pack_disclosure, findings_summary
 *   editorial sections (author-written):  executive_summary, recommendations, closing
 *
 * Persistence:
 *   - One Report row per logical report.
 *   - One ReportVersion row per Report (slice A keeps the draft mutable;
 *     `sign` flips it to `isDraft = false` and stamps signedBy/At/contentHash).
 *   - All section content encrypted as a single ALE blob in `contentCipher`.
 *
 * On `sign` we (a) update Report + ReportVersion, (b) write an `OutboxEvent`
 * with `eventType = "report.published"` so the worker (task 4.4) can render
 * the PDF asynchronously. The audit-log hash chain is appended automatically
 * by triggers on `reports` and `report_versions`.
 */

import { type EncryptionModule } from "@aims/encryption";
import {
  CreateReportInput,
  DownloadReportPdfInput,
  GetReportInput,
  ListReportsInput,
  RegenerateReportDataSectionsInput,
  SignReportInput,
  SubmitReportForSignoffInput,
  UpdateReportEditorialInput,
  computeReportContentHash,
  type ReportDetail,
  type ReportDownloadUrl,
  type ReportSectionsInput,
  type ReportStatusInput,
  type ReportSummary,
} from "@aims/validation";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";

import { captureTraceCarrier } from "../lib/otel-propagation";
import {
  authenticatedProcedure,
  mfaFreshProcedure,
  router,
  type AuthedPrisma,
} from "../trpc";

const DEFAULT_TEMPLATE_KEY = "engagement-report-v1";
const DEFAULT_VERSION_NUMBER = "v1.0";

const EDITORIAL_SECTION_KEYS = [
  "executive_summary",
  "recommendations",
  "closing",
] as const;

export const reportRouter = router({
  // ─── create ─────────────────────────────────────────────────────────────
  create: authenticatedProcedure
    .input(CreateReportInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }

      const sections = await buildInitialSections(
        ctx.services.prismaTenant,
        ctx.services.encryption,
        ctx.session.tenantId,
        input.engagementId,
      );

      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        sections,
      );

      const templateKey = input.templateKey ?? DEFAULT_TEMPLATE_KEY;

      const [report, draftVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const r = await tx.report.create({
            // @ts-expect-error — tenantId injected at runtime by our extension.
            data: {
              engagementId: input.engagementId,
              templateKey,
              title: input.title,
              authorId: ctx.session.userId,
            },
          });
          const v = await tx.reportVersion.create({
            // @ts-expect-error — tenantId injected at runtime by our extension.
            data: {
              reportId: r.id,
              versionNumber: DEFAULT_VERSION_NUMBER,
              isDraft: true,
              contentCipher: cipher,
            },
          });
          return [r, v] as const;
        },
      );

      return toDetail(report, draftVersion, sections);
    }),

  // ─── get ────────────────────────────────────────────────────────────────
  get: authenticatedProcedure
    .input(GetReportInput)
    .query(async ({ ctx, input }): Promise<ReportDetail> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      const sections = await decryptSections(
        ctx.services.encryption,
        ctx.session.tenantId,
        version.contentCipher,
      );
      return toDetail(report, version, sections);
    }),

  // ─── list (per engagement) ──────────────────────────────────────────────
  list: authenticatedProcedure
    .input(ListReportsInput)
    .query(async ({ ctx, input }): Promise<ReportSummary[]> => {
      const reports = await ctx.services.prismaTenant.report.findMany({
        where: { engagementId: input.engagementId },
        orderBy: { createdAt: "desc" },
      });
      return reports.map(toSummary);
    }),

  // ─── regenerateDataSections ─────────────────────────────────────────────
  regenerateDataSections: authenticatedProcedure
    .input(RegenerateReportDataSectionsInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      assertVersion(report.version, input.expectedVersion);
      assertEditable(report.status, "Regenerate data sections");

      const current = await decryptSections(
        ctx.services.encryption,
        ctx.session.tenantId,
        version.contentCipher,
      );

      const fresh = await buildInitialSections(
        ctx.services.prismaTenant,
        ctx.services.encryption,
        ctx.session.tenantId,
        report.engagementId,
      );

      // Preserve editorial content; replace data sections with fresh values.
      const next = mergeEditorialOver(fresh, current);
      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        next,
      );

      const [updatedReport] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const r = await tx.report.update({
            where: { id: report.id },
            data: { version: { increment: 1 } },
          });
          await tx.reportVersion.update({
            where: { id: version.id },
            data: { contentCipher: cipher },
          });
          return [r] as const;
        },
      );

      const refreshedVersion = await ctx.services.prismaTenant.reportVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      return toDetail(updatedReport, refreshedVersion, next);
    }),

  // ─── updateEditorial (autosave for one editorial section) ───────────────
  updateEditorial: authenticatedProcedure
    .input(UpdateReportEditorialInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      assertVersion(report.version, input.expectedVersion);
      assertEditable(report.status, "Editorial edits");

      const current = await decryptSections(
        ctx.services.encryption,
        ctx.session.tenantId,
        version.contentCipher,
      );
      const target = current[input.sectionKey];
      if (!target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown section "${input.sectionKey}".`,
        });
      }
      if (target.kind !== "editorial") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Section "${input.sectionKey}" is data-bound; use regenerateDataSections instead.`,
        });
      }

      const next: ReportSectionsInput = {
        ...current,
        [input.sectionKey]: { kind: "editorial", content: input.content },
      };
      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        next,
      );

      const [updatedReport, updatedVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const r = await tx.report.update({
            where: { id: report.id },
            data: { version: { increment: 1 } },
          });
          const v = await tx.reportVersion.update({
            where: { id: version.id },
            data: { contentCipher: cipher },
          });
          return [r, v] as const;
        },
      );

      return toDetail(updatedReport, updatedVersion, next);
    }),

  // ─── submitForSignoff ────────────────────────────────────────────────────
  submitForSignoff: authenticatedProcedure
    .input(SubmitReportForSignoffInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      assertVersion(report.version, input.expectedVersion);
      assertStatus(report.status, "DRAFT", "Submit for signoff");

      // Editorial completeness gate — every editorial section must have content.
      const sections = await decryptSections(
        ctx.services.encryption,
        ctx.session.tenantId,
        version.contentCipher,
      );
      for (const key of EDITORIAL_SECTION_KEYS) {
        const sec = sections[key];
        if (!sec || sec.content.trim().length === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Editorial section "${key}" must be filled before signoff.`,
          });
        }
      }

      const updated = await ctx.services.prismaTenant.report.update({
        where: { id: report.id },
        data: { status: "IN_REVIEW", version: { increment: 1 } },
      });

      return toDetail(updated, version, sections);
    }),

  // ─── downloadPdf (presigned URL, 5-min TTL) ─────────────────────────────
  downloadPdf: authenticatedProcedure
    .input(DownloadReportPdfInput)
    .query(async ({ ctx, input }): Promise<ReportDownloadUrl> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      if (report.status !== "PUBLISHED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Report must be PUBLISHED to download (current: ${report.status}).`,
        });
      }
      if (!version.pdfS3Key) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "PDF render is still in progress — try again in a few seconds.",
        });
      }

      const ttlSeconds = ctx.services.config.reportDownloadUrlTtlSeconds;
      const url = await getSignedUrl(
        // Cast bridges the duplicate `@smithy/types` private-field divergence
        // between @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner. Runtime
        // types match; TS sees them as distinct due to copies in the dep tree.
        ctx.services.s3Client as unknown as Parameters<typeof getSignedUrl>[0],
        new GetObjectCommand({
          Bucket: ctx.services.config.reportsBucket,
          Key: version.pdfS3Key,
        }),
        { expiresIn: ttlSeconds },
      );
      return {
        url,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      };
    }),

  // ─── sign (MFA step-up + typed attestation) ─────────────────────────────
  sign: mfaFreshProcedure
    .input(SignReportInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      assertVersion(report.version, input.expectedVersion);
      assertStatus(report.status, "IN_REVIEW", "Sign");

      const sections = await decryptSections(
        ctx.services.encryption,
        ctx.session.tenantId,
        version.contentCipher,
      );
      const contentHash = computeReportContentHash(sections);

      const signedAt = new Date();

      const [updatedReport, updatedVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const r = await tx.report.update({
            where: { id: report.id },
            data: { status: "PUBLISHED", version: { increment: 1 } },
          });
          const v = await tx.reportVersion.update({
            where: { id: version.id },
            data: {
              isDraft: false,
              contentHash,
              signedBy: ctx.session.userId,
              signedAt,
            },
          });
          // Capture the active trace context so the worker can resume the
          // span when it picks the event off SQS (task 4.8). Keys prefixed
          // with `__` mark them as transport metadata, not domain data.
          const trace = captureTraceCarrier();
          await tx.outboxEvent.create({
            // @ts-expect-error — tenantId injected at runtime by our extension.
            data: {
              eventType: "report.published",
              payload: {
                reportId: r.id,
                reportVersionId: v.id,
                contentHash,
                signedBy: ctx.session.userId,
                signedAt: signedAt.toISOString(),
                ...(trace.traceparent
                  ? { __traceparent: trace.traceparent }
                  : {}),
                ...(trace.tracestate
                  ? { __tracestate: trace.tracestate }
                  : {}),
              },
            },
          });
          return [r, v] as const;
        },
      );

      return toDetail(updatedReport, updatedVersion, sections);
    }),
});

// ─── State-machine helpers ─────────────────────────────────────────────────

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Stale update: report is at version ${actual.toString()}, caller expected ${expected.toString()}.`,
    });
  }
}

function assertStatus(
  actual: ReportStatusInput,
  required: ReportStatusInput,
  action: string,
): void {
  if (actual !== required) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${action} requires status ${required} (current: ${actual}).`,
    });
  }
}

function assertEditable(actual: ReportStatusInput, action: string): void {
  if (actual !== "DRAFT") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${action} requires DRAFT status (current: ${actual}).`,
    });
  }
}

// ─── Section helpers ───────────────────────────────────────────────────────

async function buildInitialSections(
  prisma: AuthedPrisma,
  encryption: EncryptionModule,
  tenantId: string,
  engagementId: string,
): Promise<ReportSectionsInput> {
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
  });

  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });

  const approved = await prisma.finding.findMany({
    where: { engagementId, status: "APPROVED" },
    orderBy: { findingNumber: "asc" },
  });

  const decryptedFindings = await Promise.all(
    approved.map(async (f) => {
      const elements = f.elementValuesCipher
        ? await encryption.decryptJson<Record<string, string>>(
            tenantId,
            Buffer.from(f.elementValuesCipher),
          )
        : {};
      return { ...f, elements };
    }),
  );

  return {
    engagement_overview: {
      kind: "data",
      content: [
        `Engagement: ${engagement.name}`,
        `Auditee: ${engagement.auditeeName}`,
        `Fiscal period: ${engagement.fiscalPeriod}`,
        `Period: ${engagement.periodStart.toISOString().slice(0, 10)} to ${engagement.periodEnd.toISOString().slice(0, 10)}`,
      ].join("\n"),
    },
    pack_disclosure: {
      kind: "data",
      content:
        attachments.length > 0
          ? attachments
              .map(
                (a) =>
                  `${a.pack.name} (${a.packCode}:${a.packVersion}) — ${a.pack.issuingBody}`,
              )
              .join("\n")
          : "No standard packs attached.",
    },
    findings_summary: {
      kind: "data",
      content:
        decryptedFindings.length > 0
          ? decryptedFindings
              .map((f) =>
                [
                  `${f.findingNumber} — ${f.title} [${f.classification}]`,
                  ...Object.entries(f.elements).map(
                    ([k, v]) =>
                      `  ${k}: ${truncate(v, 200)}`,
                  ),
                ].join("\n"),
              )
              .join("\n\n")
          : "No approved findings.",
    },
    executive_summary: { kind: "editorial", content: "" },
    recommendations: { kind: "editorial", content: "" },
    closing: { kind: "editorial", content: "" },
  };
}

function mergeEditorialOver(
  fresh: ReportSectionsInput,
  current: ReportSectionsInput,
): ReportSectionsInput {
  const out: ReportSectionsInput = { ...fresh };
  for (const [key, sec] of Object.entries(current)) {
    if (sec.kind === "editorial") {
      out[key] = sec;
    }
  }
  return out;
}

async function decryptSections(
  encryption: EncryptionModule,
  tenantId: string,
  cipher: Buffer | Uint8Array | null,
): Promise<ReportSectionsInput> {
  if (!cipher || cipher.length === 0) return {};
  return encryption.decryptJson<ReportSectionsInput>(tenantId, Buffer.from(cipher));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function loadReportWithVersion(
  prisma: AuthedPrisma,
  id: string,
): Promise<{ report: ReportRow; version: ReportVersionRow }> {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
  }
  const version = await prisma.reportVersion.findFirst({
    where: { reportId: id },
    orderBy: { createdAt: "desc" },
  });
  if (!version) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Report has no version row — this is a corruption.",
    });
  }
  return { report, version };
}

// ─── Mappers ───────────────────────────────────────────────────────────────

type ReportRow = {
  id: string;
  engagementId: string;
  templateKey: string;
  title: string;
  status: ReportStatusInput;
  authorId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type ReportVersionRow = {
  id: string;
  reportId: string;
  versionNumber: string;
  isDraft: boolean;
  contentCipher: Buffer | Uint8Array;
  contentHash: string | null;
  pdfS3Key: string | null;
  pdfRenderedAt: Date | null;
  signedBy: string | null;
  signedAt: Date | null;
  createdAt: Date;
};

function toSummary(row: ReportRow): ReportSummary {
  return {
    id: row.id,
    engagementId: row.engagementId,
    templateKey: row.templateKey,
    title: row.title,
    status: row.status,
    authorId: row.authorId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(
  report: ReportRow,
  version: ReportVersionRow,
  sections: ReportSectionsInput,
): ReportDetail {
  return {
    ...toSummary(report),
    sections,
    versionNumber: version.versionNumber,
    contentHash: version.contentHash,
    signedBy: version.signedBy,
    signedAt: version.signedAt,
    pdfS3Key: version.pdfS3Key,
    pdfRenderedAt: version.pdfRenderedAt,
  };
}

