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
import { renderFindingForPack, type PackContent } from "@aims/pack-renderer";
import {
  ComplianceReportInput,
  CreateReportInput,
  DownloadReportPdfInput,
  GetReportInput,
  ListReportsInput,
  RegenerateReportDataSectionsInput,
  SignReportInput,
  SubmitReportForSignoffInput,
  UpdateReportEditorialInput,
  computeReportContentHash,
  type ReportComplianceStatement,
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
  // Slice B (per VERTICAL-SLICE-B-PLAN §3.1 + ADR-0010): every report
  // attests to a specific pack. The pack drives cross-pack rendering of
  // finding elements via @aims/pack-renderer. When `attestsToPack*` is
  // omitted, defaults to the engagement's primary methodology — preserves
  // slice-A behavior (one pack per engagement → one report attesting to it).
  create: authenticatedProcedure
    .input(CreateReportInput)
    .mutation(async ({ ctx, input }): Promise<ReportDetail> => {
      const engagement = await ctx.services.prismaTenant.engagement.findUnique({
        where: { id: input.engagementId },
      });
      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found." });
      }

      const attestsTo = await resolveAttestsToPack(
        ctx.services.prismaTenant,
        input.engagementId,
        input.attestsToPackCode,
        input.attestsToPackVersion,
      );

      const sections = await buildInitialSections(
        ctx.services.prismaTenant,
        ctx.services.encryption,
        ctx.session.tenantId,
        input.engagementId,
        attestsTo,
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
              attestsToPackCode: attestsTo.packCode,
              attestsToPackVersion: attestsTo.packVersion,
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

  // ─── compliance ─────────────────────────────────────────────────────────
  // Slice B (per VERTICAL-SLICE-B-PLAN §3.2 + §1.1 + ADR-0012): assembles
  // the "conducted in accordance with…" sentence for a report from its
  // engagement's attached packs filtered to `conformanceClaimed=true`.
  //
  // Per ADR-0012, semantics depend on the report's lifecycle:
  //   - DRAFT: computed live from the engagement's currently-attached
  //     packs (the auditor is iterating; live feedback is helpful).
  //   - SIGNED: returns the frozen sentence captured into
  //     `ReportVersion.complianceStatement` at sign-off — a published
  //     report is a legal artifact and must not silently mutate when
  //     packs change after the fact.
  // Read-only — no side effects.
  compliance: authenticatedProcedure
    .input(ComplianceReportInput)
    .query(async ({ ctx, input }): Promise<ReportComplianceStatement> => {
      const { report, version } = await loadReportWithVersion(
        ctx.services.prismaTenant,
        input.id,
      );
      // Signed report → return the frozen snapshot. The persisted sentence
      // is the legal artifact; live recomputation could leak post-sign
      // attachment changes into a published claim.
      if (version.complianceStatement !== null) {
        return {
          reportId: report.id,
          attestsTo: {
            packCode: report.attestsToPackCode,
            packVersion: report.attestsToPackVersion,
          },
          claims: [],
          sentence: version.complianceStatement,
          frozen: true,
        };
      }
      // DRAFT path: live computation.
      return computeLiveCompliance(ctx.services.prismaTenant, report);
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
        {
          packCode: report.attestsToPackCode,
          packVersion: report.attestsToPackVersion,
        },
      );

      // Preserve editorial content; replace data sections with fresh values.
      const next = mergeEditorialOver(fresh, current);
      const cipher = await ctx.services.encryption.encryptJson(
        ctx.session.tenantId,
        next,
      );

      // Per Gemini W2 round-2: use updateMany with version guard so the DB
      // enforces optimistic concurrency. A bare `update where id=…` would
      // race with a concurrent updateEditorial autosave (W3 UI surface) —
      // the contentCipher write would silently clobber the autosave.
      const [updatedReport, updatedVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const result = await tx.report.updateMany({
            where: { id: report.id, version: report.version },
            data: { version: { increment: 1 } },
          });
          if (result.count !== 1) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                `Report ${report.id} was modified concurrently (expected version ` +
                `${report.version.toString()}). Refresh and retry.`,
            });
          }
          const v = await tx.reportVersion.update({
            where: { id: version.id },
            data: { contentCipher: cipher },
          });
          const r = await tx.report.findUniqueOrThrow({ where: { id: report.id } });
          return [r, v] as const;
        },
      );

      return toDetail(updatedReport, updatedVersion, next);
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

      // Per Gemini W2 round-2: same race pattern as regenerateDataSections.
      // updateMany with version guard so concurrent autosaves (W3 UI hits
      // this on every keystroke pause) collide cleanly via CONFLICT
      // rather than silently clobbering each other's contentCipher.
      const [updatedReport, updatedVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          const result = await tx.report.updateMany({
            where: { id: report.id, version: report.version },
            data: { version: { increment: 1 } },
          });
          if (result.count !== 1) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                `Report ${report.id} was modified concurrently (expected version ` +
                `${report.version.toString()}). Refresh and retry.`,
            });
          }
          const v = await tx.reportVersion.update({
            where: { id: version.id },
            data: { contentCipher: cipher },
          });
          const r = await tx.report.findUniqueOrThrow({ where: { id: report.id } });
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

      // Per Gemini W2 round-2: updateMany + version guard. A bare update
      // would race with a concurrent updateEditorial autosave that bumps
      // the version after our editorial-completeness check above.
      const result = await ctx.services.prismaTenant.report.updateMany({
        where: { id: report.id, version: report.version },
        data: { status: "IN_REVIEW", version: { increment: 1 } },
      });
      if (result.count !== 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            `Report ${report.id} was modified concurrently (expected version ` +
            `${report.version.toString()}). Refresh and retry.`,
        });
      }
      const updated = await ctx.services.prismaTenant.report.findUniqueOrThrow({
        where: { id: report.id },
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

      // Snapshot the compliance sentence per ADR-0012. A signed report is
      // a legal artifact whose attestation claims must not silently mutate
      // when packs change later. Computed live here from the engagement's
      // currently-attached packs and frozen into ReportVersion.
      const liveCompliance = await computeLiveCompliance(
        ctx.services.prismaTenant,
        report,
      );
      const complianceSnapshot = liveCompliance.sentence;

      const signedAt = new Date();

      const [updatedReport, updatedVersion] = await ctx.services.prismaTenant.$transaction(
        async (tx) => {
          // Per Gemini W2 round-2: updateMany + version guard so a
          // concurrent updateEditorial that snuck in between the
          // submitForSignoff and sign-off can't silently change the
          // signed contentCipher's parent version.
          const updResult = await tx.report.updateMany({
            where: { id: report.id, version: report.version },
            data: { status: "PUBLISHED", version: { increment: 1 } },
          });
          if (updResult.count !== 1) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                `Report ${report.id} was modified concurrently (expected version ` +
                `${report.version.toString()}). Refresh and retry.`,
            });
          }
          const r = await tx.report.findUniqueOrThrow({ where: { id: report.id } });
          const v = await tx.reportVersion.update({
            where: { id: version.id },
            data: {
              isDraft: false,
              contentHash,
              signedBy: ctx.session.userId,
              signedAt,
              complianceStatement: complianceSnapshot,
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

/**
 * Resolves the pack a report attests to. When the caller doesn't supply
 * `attestsToPackCode`/`attestsToPackVersion`, defaults to the engagement's
 * primary methodology — slice-A behavior preservation. When the caller does
 * supply them, validates that pack is actually attached to the engagement
 * (a report can only attest to packs the engagement has formally attached).
 */
async function resolveAttestsToPack(
  prisma: AuthedPrisma,
  engagementId: string,
  packCode: string | undefined,
  packVersion: string | undefined,
): Promise<{ packCode: string; packVersion: string }> {
  if (packCode !== undefined && packVersion !== undefined) {
    const attached = await prisma.packAttachment.findUnique({
      where: {
        engagementId_packCode_packVersion: {
          engagementId,
          packCode,
          packVersion,
        },
      },
    });
    if (!attached) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          `Cannot attest to ${packCode}:${packVersion} — pack is not attached ` +
          `to the engagement. Attach it via pack.attach first.`,
      });
    }
    return { packCode, packVersion };
  }
  // Default: the engagement's primary methodology.
  const primary = await prisma.packAttachment.findFirst({
    where: { engagementId, isPrimary: true },
  });
  if (!primary) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Engagement has no primary methodology — attach one via pack.attach " +
        "before creating reports.",
    });
  }
  return { packCode: primary.packCode, packVersion: primary.packVersion };
}

async function buildInitialSections(
  prisma: AuthedPrisma,
  encryption: EncryptionModule,
  tenantId: string,
  engagementId: string,
  attestsTo: { packCode: string; packVersion: string },
): Promise<ReportSectionsInput> {
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
  });

  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });

  // Slice B (per ADR-0010 + W2 day 5): cross-pack rendering. Load the
  // report's `attestsTo` pack content and the engagement's primary pack
  // content; each finding's canonical-keyed elements are translated into
  // the attestsTo pack's vocabulary via @aims/pack-renderer.
  const attestsToPack = await prisma.standardPack.findUniqueOrThrow({
    where: { code_version: { code: attestsTo.packCode, version: attestsTo.packVersion } },
  });
  const primaryAttachment = attachments.find((a) => a.isPrimary);
  const sourcePack = primaryAttachment
    ? { packCode: primaryAttachment.packCode, packVersion: primaryAttachment.packVersion }
    : undefined;

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
      // Render each finding under the attestsTo pack's vocabulary. This is
      // where the architectural-risk smoke alarm is silent — rendering is
      // mapping-driven, no per-pack code branches anywhere.
      const rendered = renderFindingForPack({
        elementValues: elements,
        targetPack: {
          packCode: attestsTo.packCode,
          packVersion: attestsTo.packVersion,
          content: attestsToPack.packContent as PackContent,
        },
        ...(sourcePack !== undefined ? { sourcePack } : {}),
      });
      return { ...f, rendered };
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
      content: [
        `Attests to: ${attestsToPack.name} (${attestsTo.packCode}:${attestsTo.packVersion}) — ${attestsToPack.issuingBody}`,
        attachments.length > 1
          ? `Additional methodologies attached:\n${attachments
              .filter(
                (a) =>
                  !(
                    a.packCode === attestsTo.packCode &&
                    a.packVersion === attestsTo.packVersion
                  ),
              )
              .map(
                (a) =>
                  `  • ${a.pack.name} (${a.packCode}:${a.packVersion}) — ${a.pack.issuingBody}`,
              )
              .join("\n")}`
          : "",
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
    },
    findings_summary: {
      kind: "data",
      content:
        decryptedFindings.length > 0
          ? decryptedFindings
              .map((f) => {
                const targetClassification = translateClassificationToPack(
                  f.classification,
                  attestsToPack.packContent as PackContent,
                );
                const header = `${f.findingNumber} — ${f.title} [${targetClassification}]`;
                const rows = f.rendered.rows.map((row) => {
                  const footer = row.footerNote !== null ? `\n    ${row.footerNote}` : "";
                  const value = row.value.length > 0 ? truncate(row.value, 200) : "(not provided)";
                  return `  ${row.label}: ${value}${footer}`;
                });
                return [header, ...rows].join("\n");
              })
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

/**
 * Translate a stored `Finding.classification` (Prisma enum, currently
 * GAGAS-shaped: MINOR / SIGNIFICANT / MATERIAL / CRITICAL) into the
 * target pack's classification vocabulary by severity tier. The Prisma
 * enum's tiers are 1-4 (MINOR=1 … CRITICAL=4); the target pack's
 * `findingClassifications` declare their own labels at the same severity
 * tiers (IIA: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4).
 *
 * Without this translation the report header would embed GAGAS labels
 * inside an IIA-attesting report — the architectural-risk smoke alarm
 * Gemini surfaced in W2 review. See ADR-0010 for the canonical-data-flow
 * thesis this preserves.
 *
 * If the target pack declares no classification at the matching severity,
 * falls back to the storage value (a fail-safe; no good answer exists if
 * the target pack's vocabulary is incomplete).
 */
const PRISMA_CLASSIFICATION_SEVERITY: Record<string, number> = {
  MINOR: 1,
  SIGNIFICANT: 2,
  MATERIAL: 3,
  CRITICAL: 4,
};

function translateClassificationToPack(
  storedClassification: string,
  targetPackContent: PackContent,
): string {
  const severity = PRISMA_CLASSIFICATION_SEVERITY[storedClassification];
  if (severity === undefined) return storedClassification;
  const targetClassifications =
    (targetPackContent as { findingClassifications?: { code: string; severity: number }[] })
      .findingClassifications ?? [];
  const match = targetClassifications.find((c) => c.severity === severity);
  return match?.code ?? storedClassification;
}

/**
 * Compute the live compliance statement from the engagement's currently
 * attached packs. Used for DRAFT reports (where the auditor wants live
 * feedback) and as the source for the sign-off snapshot per ADR-0012.
 */
async function computeLiveCompliance(
  prisma: AuthedPrisma,
  report: { id: string; engagementId: string; attestsToPackCode: string; attestsToPackVersion: string },
): Promise<ReportComplianceStatement> {
  const claimedAttachments = await prisma.packAttachment.findMany({
    where: { engagementId: report.engagementId, conformanceClaimed: true },
    include: { pack: true },
    orderBy: [{ isPrimary: "desc" }, { packCode: "asc" }],
  });
  const claims = claimedAttachments
    .map((a) => ({
      packCode: a.packCode,
      packVersion: a.packVersion,
      packName: a.pack.name,
      issuingBody: a.pack.issuingBody,
      isPrimary: a.isPrimary,
      isAttestedTo:
        a.packCode === report.attestsToPackCode &&
        a.packVersion === report.attestsToPackVersion,
    }))
    .sort((a, b) => {
      if (a.isAttestedTo !== b.isAttestedTo) return a.isAttestedTo ? -1 : 1;
      return a.packCode.localeCompare(b.packCode);
    });
  const sentence = composeComplianceSentence(claims);
  return {
    reportId: report.id,
    attestsTo: {
      packCode: report.attestsToPackCode,
      packVersion: report.attestsToPackVersion,
    },
    claims,
    sentence,
    frozen: false,
  };
}

/**
 * Compose the compliance "conducted in accordance with…" sentence from the
 * report's claims list. The pack the report attests to is named first; any
 * additional conformance-claimed packs are appended as " and …". When no
 * conformance-claimed packs exist (shouldn't happen given the pack-attach
 * defaults, but guarded), returns a "conformance not formally claimed" line.
 */
function composeComplianceSentence(
  claims: readonly {
    packName: string;
    packCode: string;
    packVersion: string;
    issuingBody: string;
    isAttestedTo: boolean;
  }[],
): string {
  if (claims.length === 0) {
    return "Conformance with any audit standard is not formally claimed for this report.";
  }
  const formatClaim = (c: {
    packName: string;
    packCode: string;
    packVersion: string;
    issuingBody: string;
  }): string => `${c.packName} (${c.packCode}:${c.packVersion}, issued by ${c.issuingBody})`;

  // claims[0] is the attestsTo pack (sorted that way by the procedure).
  const attestsTo = claims[0];
  if (!attestsTo) {
    // unreachable given the length check above
    return "Conformance with any audit standard is not formally claimed for this report.";
  }
  const others = claims.slice(1);
  if (others.length === 0) {
    return `This report was conducted in accordance with ${formatClaim(attestsTo)}.`;
  }
  const othersList = others.map(formatClaim).join("; ");
  return (
    `This report was conducted in accordance with ${formatClaim(attestsTo)}; ` +
    `additional methodologies attached and conformance-claimed: ${othersList}.`
  );
}

async function loadReportWithVersion(
  prisma: AuthedPrisma,
  id: string,
): Promise<{ report: ReportRow; version: ReportVersionRow }> {
  // Single query with `include` — saves a round-trip versus loading the
  // report and the latest version separately. Slice A keeps one
  // ReportVersion per Report (per ADR-0008-deferred slice plan); the
  // `take: 1` future-proofs for amendment chains.
  const reportWithVersions = await prisma.report.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!reportWithVersions) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
  }
  const { versions, ...report } = reportWithVersions;
  const version = versions[0];
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
  attestsToPackCode: string;
  attestsToPackVersion: string;
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
  complianceStatement: string | null;
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

