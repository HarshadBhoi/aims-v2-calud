/**
 * Handler for `report.published` events (slice A task 4.5).
 *
 * Flow:
 *   1. Load `ReportVersion` + parent `Report` from DB.
 *   2. Idempotency: skip if `pdfRenderedAt` is already set.
 *   3. Decrypt section content via ALE (per-tenant DEK).
 *   4. Recompute the content hash; abort on mismatch (vs. DB or vs. event).
 *      Mismatch means tampering, replay, or a hash-function drift — none
 *      acceptable.
 *   5. Render PDF via pdfkit.
 *   6. Upload to the reports S3 bucket under
 *      `reports/{tenantId}/{reportId}/{versionId}.pdf`.
 *   7. Update `ReportVersion.pdfS3Key + pdfRenderedAt` — the trigger on
 *      `public.report_versions` appends a hash-chained audit-log row
 *      automatically (slice plan §4.5 "audit log entry appended").
 *
 * On hash mismatch we throw, leaving the SQS message in flight; SQS redrive
 * (configured in `infra/localstack/init/01-bootstrap.sh`) will eventually
 * route persistent failures to the DLQ.
 */

import { type EncryptionModule } from "@aims/encryption";
import { type AdminPrismaClient } from "@aims/prisma-client";
import {
  computeReportContentHash,
  type ReportSectionsInput,
} from "@aims/validation";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  ENCRYPTION_MODULE,
  S3_CLIENT,
  WORKER_CONFIG,
} from "../aws/aws.module";
import { type WorkerConfig } from "../config";
import { ADMIN_PRISMA } from "../db/db.module";
import { renderReportPdf } from "../render/pdf.renderer";

export type ReportPublishedPayload = {
  readonly reportId: string;
  readonly reportVersionId: string;
  readonly contentHash: string;
  readonly signedBy: string;
  readonly signedAt: string;
};

export type ReportPublishedEvent = {
  readonly id: string;
  readonly tenantId: string;
  readonly eventType: "report.published";
  readonly payload: ReportPublishedPayload;
  readonly createdAt: string;
};

@Injectable()
export class ReportPublishedHandler {
  private readonly logger = new Logger(ReportPublishedHandler.name);

  constructor(
    @Inject(ADMIN_PRISMA) private readonly prisma: AdminPrismaClient,
    @Inject(ENCRYPTION_MODULE) private readonly encryption: EncryptionModule,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  async handle(event: ReportPublishedEvent): Promise<void> {
    const version = await this.prisma.reportVersion.findUnique({
      where: { id: event.payload.reportVersionId },
      include: { report: true },
    });

    if (!version) {
      throw new Error(
        `report.published: version ${event.payload.reportVersionId} not found`,
      );
    }
    if (version.tenantId !== event.tenantId) {
      throw new Error(
        `report.published: tenant mismatch — event=${event.tenantId} db=${version.tenantId}`,
      );
    }
    if (version.pdfRenderedAt !== null) {
      this.logger.log(
        `report.published: skipping ${version.id} — already rendered at ${version.pdfRenderedAt.toISOString()}`,
      );
      return;
    }
    if (version.signedAt === null || version.signedBy === null) {
      throw new Error(
        `report.published: version ${version.id} is not signed yet`,
      );
    }
    if (version.contentHash === null) {
      throw new Error(
        `report.published: version ${version.id} has no contentHash`,
      );
    }

    const sections = await this.encryption.decryptJson<ReportSectionsInput>(
      event.tenantId,
      Buffer.from(version.contentCipher),
    );
    const recomputed = computeReportContentHash(sections);
    if (recomputed !== version.contentHash) {
      throw new Error(
        `report.published: contentHash mismatch vs DB — db=${version.contentHash} computed=${recomputed}`,
      );
    }
    if (recomputed !== event.payload.contentHash) {
      throw new Error(
        `report.published: contentHash mismatch vs event — event=${event.payload.contentHash} computed=${recomputed}`,
      );
    }

    const pdfBuffer = await renderReportPdf({
      title: version.report.title,
      sections,
      versionNumber: version.versionNumber,
      signedBy: version.signedBy,
      signedAt: version.signedAt,
      contentHash: version.contentHash,
    });

    const key = `reports/${event.tenantId}/${event.payload.reportId}/${version.id}.pdf`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.config.reportsBucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      }),
    );

    await this.prisma.reportVersion.update({
      where: { id: version.id },
      data: {
        pdfS3Key: key,
        pdfRenderedAt: new Date(),
      },
    });

    this.logger.log(
      `report.published: rendered ${event.payload.reportId} (${pdfBuffer.length.toString()} bytes) → s3://${this.config.reportsBucket}/${key}`,
    );
  }
}

/**
 * Type guard for the message body. Validates the envelope shape so the
 * dispatcher can safely route to the typed handler.
 */
export function isReportPublishedEvent(value: unknown): value is ReportPublishedEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj["eventType"] !== "report.published") return false;
  if (typeof obj["id"] !== "string") return false;
  if (typeof obj["tenantId"] !== "string") return false;
  const payload = obj["payload"];
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p["reportId"] === "string" &&
    typeof p["reportVersionId"] === "string" &&
    typeof p["contentHash"] === "string" &&
    typeof p["signedBy"] === "string" &&
    typeof p["signedAt"] === "string"
  );
}
