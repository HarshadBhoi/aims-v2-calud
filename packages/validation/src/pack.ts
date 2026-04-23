/**
 * Zod schemas for the pack domain (StandardPack + PackAttachment).
 */

import { z } from "zod";

import { CuidString } from "./common";

// ─── Inputs ────────────────────────────────────────────────────────────────

export const AttachPackInput = z.object({
  engagementId: CuidString,
  packCode: z.string().min(1).max(64),
  packVersion: z.string().min(1).max(32),
});
export type AttachPackInput = z.infer<typeof AttachPackInput>;

export const ResolvePackInput = z.object({
  engagementId: CuidString,
});
export type ResolvePackInput = z.infer<typeof ResolvePackInput>;

// ─── Output: ResolvedRequirements ──────────────────────────────────────────

/**
 * The "effective requirements" that apply to an engagement after resolving
 * its attached packs. For slice A with a single pack, this is essentially
 * the pack's own content. Future slices add multi-pack conflict resolution
 * with strictness-direction (max/min/union/override_required).
 */
export type ResolvedRequirements = {
  readonly findingElements: ReadonlyArray<FindingElementRequirement>;
  readonly findingClassifications: ReadonlyArray<FindingClassificationRequirement>;
  readonly documentationRequirements: DocumentationRequirements;
  readonly sources: ReadonlyArray<PackReference>;
};

export type FindingElementRequirement = {
  readonly code: string;
  readonly name: string;
  readonly required: boolean;
  readonly minLength: number;
};

export type FindingClassificationRequirement = {
  readonly code: string;
  readonly severity: number;
};

export type DocumentationRequirements = {
  readonly fourElementComplete: boolean;
  readonly workPaperCitationRequired: boolean;
  readonly retentionYears: number;
};

export type PackReference = {
  readonly packCode: string;
  readonly packVersion: string;
};

export type PackSummary = {
  readonly code: string;
  readonly version: string;
  readonly name: string;
  readonly issuingBody: string;
  readonly publishedYear: number;
};
