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
  /**
   * Whether this attachment is the engagement's primary methodology.
   * Slice B invariant: exactly one primary per engagement at all times
   * (per ADR-0011). When omitted, the server picks: first attach for the
   * engagement → primary; subsequent attaches → non-primary.
   * Use `pack.swapPrimary` to change which attachment is primary.
   */
  isPrimary: z.boolean().optional(),
});
export type AttachPackInput = z.infer<typeof AttachPackInput>;

export const DetachPackInput = z.object({
  engagementId: CuidString,
  packCode: z.string().min(1).max(64),
  packVersion: z.string().min(1).max(32),
});
export type DetachPackInput = z.infer<typeof DetachPackInput>;

export const SwapPrimaryInput = z.object({
  engagementId: CuidString,
  fromPackCode: z.string().min(1).max(64),
  fromPackVersion: z.string().min(1).max(32),
  toPackCode: z.string().min(1).max(64),
  toPackVersion: z.string().min(1).max(32),
});
export type SwapPrimaryInput = z.infer<typeof SwapPrimaryInput>;

export const ResolvePackInput = z.object({
  engagementId: CuidString,
});
export type ResolvePackInput = z.infer<typeof ResolvePackInput>;

export const StrictnessInput = z.object({
  engagementId: CuidString,
});
export type StrictnessInput = z.infer<typeof StrictnessInput>;

// ─── Output: ResolvedRequirements ──────────────────────────────────────────

/**
 * The "effective requirements" that apply to an engagement after resolving
 * its attached packs. For slice A with a single pack, this is essentially
 * the pack's own content. Future slices add multi-pack conflict resolution
 * with strictness-direction (max/min/union/override_required).
 */
export type ResolvedRequirements = {
  readonly findingElements: readonly FindingElementRequirement[];
  readonly findingClassifications: readonly FindingClassificationRequirement[];
  readonly documentationRequirements: DocumentationRequirements;
  readonly sources: readonly PackReference[];
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
