import { createHash } from "node:crypto";

/**
 * Zod schemas for the report domain.
 *
 * Slice A scope: single template (`engagement-report-v1`) with three data-bound
 * sections (auto-populated from current findings + engagement state) and three
 * editorial sections (author-written narrative). Status transitions
 * `DRAFT → IN_REVIEW → PUBLISHED`; `sign` requires MFA-fresh + typed
 * attestation. Multi-template + section trees + version chains land in later
 * slices.
 */

import { z } from "zod";

import { CuidString } from "./common";

// ─── Enum mirrors ──────────────────────────────────────────────────────────

export const ReportStatusInput = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"]);
export type ReportStatusInput = z.infer<typeof ReportStatusInput>;

export const ReportSectionKindInput = z.enum(["data", "editorial"]);
export type ReportSectionKindInput = z.infer<typeof ReportSectionKindInput>;

/**
 * Sections are stored as a flat record keyed by section code.
 * `kind === "data"` → server-regenerated; UI renders read-only.
 * `kind === "editorial"` → author-written; UI renders editable until signoff.
 */
export const ReportSectionInput = z.object({
  kind: ReportSectionKindInput,
  content: z.string().max(100_000),
});
export type ReportSectionInput = z.infer<typeof ReportSectionInput>;

export const ReportSectionsInput = z.record(z.string().min(1).max(64), ReportSectionInput);
export type ReportSectionsInput = z.infer<typeof ReportSectionsInput>;

// ─── Inputs ────────────────────────────────────────────────────────────────

export const CreateReportInput = z.object({
  engagementId: CuidString,
  title: z.string().min(1).max(500),
  templateKey: z.string().min(1).max(64).optional(),
});
export type CreateReportInput = z.infer<typeof CreateReportInput>;

export const GetReportInput = z.object({ id: CuidString });
export type GetReportInput = z.infer<typeof GetReportInput>;

export const ListReportsInput = z.object({ engagementId: CuidString });
export type ListReportsInput = z.infer<typeof ListReportsInput>;

export const UpdateReportEditorialInput = z.object({
  id: CuidString,
  sectionKey: z.string().min(1).max(64),
  content: z.string().max(100_000),
  expectedVersion: z.number().int().nonnegative(),
});
export type UpdateReportEditorialInput = z.infer<typeof UpdateReportEditorialInput>;

export const RegenerateReportDataSectionsInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().nonnegative(),
});
export type RegenerateReportDataSectionsInput = z.infer<
  typeof RegenerateReportDataSectionsInput
>;

export const SubmitReportForSignoffInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().nonnegative(),
});
export type SubmitReportForSignoffInput = z.infer<typeof SubmitReportForSignoffInput>;

/**
 * Typed attestation per slice plan §4.3. The literal must match exactly.
 */
export const SignReportInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().nonnegative(),
  attestation: z.literal("I approve"),
});
export type SignReportInput = z.infer<typeof SignReportInput>;

export const DownloadReportPdfInput = z.object({ id: CuidString });
export type DownloadReportPdfInput = z.infer<typeof DownloadReportPdfInput>;

export type ReportDownloadUrl = {
  readonly url: string;
  readonly expiresAt: Date;
};

// ─── Outputs ───────────────────────────────────────────────────────────────

export type ReportSummary = {
  readonly id: string;
  readonly engagementId: string;
  readonly templateKey: string;
  readonly title: string;
  readonly status: ReportStatusInput;
  readonly authorId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ReportDetail = ReportSummary & {
  /** Sections decrypted at the API boundary; not persisted in plaintext. */
  readonly sections: ReportSectionsInput;
  readonly versionNumber: string;
  readonly contentHash: string | null;
  readonly signedBy: string | null;
  readonly signedAt: Date | null;
  readonly pdfS3Key: string | null;
  readonly pdfRenderedAt: Date | null;
};

/**
 * Deterministic SHA-256 over the report sections. Shared by:
 *  - `report.sign` (api) — anchors the hash into the audit log + outbox event
 *  - `report.published` handler (worker) — verifies before rendering PDF
 *
 * Both call sites MUST use this exact function; otherwise the worker can't
 * verify what the API signed. Top-level keys are sorted; the inner
 * `{ kind, content }` shape is fixed so the inner object's key order is
 * stable across writers.
 */
export function computeReportContentHash(sections: ReportSectionsInput): string {
  const keys = Object.keys(sections).sort();
  const canonical: ReportSectionsInput = {};
  for (const k of keys) {
    const sec = sections[k];
    if (!sec) continue;
    canonical[k] = { kind: sec.kind, content: sec.content };
  }
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
