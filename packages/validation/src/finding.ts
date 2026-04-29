/**
 * Zod schemas for the finding domain.
 *
 * Slice A scope: DRAFT → IN_REVIEW → APPROVED with approve / return / reject
 * decisions. Multi-version amendments and PUBLISHED state arrive with the
 * report-signoff slice.
 */

import { z } from "zod";

import { CuidString } from "./common";

// ─── Enum mirrors (kept in sync with packages/prisma-client schema) ───────

export const FindingStatusInput = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
]);
export type FindingStatusInput = z.infer<typeof FindingStatusInput>;

export const FindingClassificationInput = z.enum([
  "MINOR",
  "SIGNIFICANT",
  "MATERIAL",
  "CRITICAL",
]);
export type FindingClassificationInput = z.infer<typeof FindingClassificationInput>;

export const FindingDecisionInput = z.enum(["APPROVED", "REJECTED", "RETURNED"]);
export type FindingDecisionInput = z.infer<typeof FindingDecisionInput>;

/**
 * Element-code → value map. Keys are pack-defined (e.g., GAGAS uses
 * `CRITERIA / CONDITION / CAUSE / EFFECT`); the resolver validates them
 * against the engagement's resolved requirements.
 */
export const ElementValuesInput = z.record(
  z.string().min(1).max(64),
  z.string().max(50_000),
);
export type ElementValuesInput = z.infer<typeof ElementValuesInput>;

// ─── Inputs ────────────────────────────────────────────────────────────────

export const CreateFindingInput = z.object({
  engagementId: CuidString,
  title: z.string().min(1).max(500),
  classification: FindingClassificationInput.optional(),
  validFrom: z.coerce.date().optional(),
  initialElements: ElementValuesInput.optional(),
});
export type CreateFindingInput = z.infer<typeof CreateFindingInput>;

export const GetFindingInput = z.object({ id: CuidString });
export type GetFindingInput = z.infer<typeof GetFindingInput>;

export const ListFindingsInput = z.object({ engagementId: CuidString });
export type ListFindingsInput = z.infer<typeof ListFindingsInput>;

export const UpdateFindingElementInput = z.object({
  id: CuidString,
  elementCode: z.string().min(1).max(64),
  value: z.string().max(50_000),
  expectedVersion: z.number().int().nonnegative(),
});
export type UpdateFindingElementInput = z.infer<typeof UpdateFindingElementInput>;

export const SubmitFindingInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().nonnegative(),
});
export type SubmitFindingInput = z.infer<typeof SubmitFindingInput>;

export const DecideFindingInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().nonnegative(),
  decision: FindingDecisionInput,
  comment: z.string().max(2_000).optional(),
});
export type DecideFindingInput = z.infer<typeof DecideFindingInput>;

// ─── Outputs ───────────────────────────────────────────────────────────────

export type FindingSummary = {
  readonly id: string;
  readonly engagementId: string;
  readonly findingNumber: string;
  readonly title: string;
  readonly status: FindingStatusInput;
  readonly classification: FindingClassificationInput;
  readonly elementsComplete: number;
  readonly authorId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type FindingDetail = FindingSummary & {
  /** Decrypted at the API boundary; not persisted in plaintext anywhere. */
  readonly elementValues: Record<string, string>;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
  readonly lockedAt: Date | null;
};
