/**
 * Public types for the cross-pack finding renderer.
 *
 * Intentionally minimal + structural — the package is consumed by both
 * apps/api and apps/worker, neither of which should pull in @prisma/client
 * just to render. The caller adapts its own pack/finding shapes onto these
 * inputs.
 */

/** Mirror of `data-model/standard-pack-schema.ts` SemanticElementMapping. */
export type SemanticElementMapping = {
  semanticCode: string;
  packElementCode: string;
  equivalenceStrength: "exact" | "close" | "partial";
};

/** Mirror of `@aims/validation` FindingElementRequirement plus the slice-B
 *  `fallbackPrompt` field for `partial`-equivalence renders. */
export type FindingElementRequirement = {
  code: string;
  name: string;
  required: boolean;
  minLength: number;
  /**
   * Slice B (per VERTICAL-SLICE-B-PLAN §4 W2 day 3-4): displayed when a
   * `partial` mapping fires and there's no faithful translation. Optional;
   * the renderer falls back to a generic "(no equivalent)" line when absent.
   */
  fallbackPrompt?: string;
};

/** The subset of pack content the renderer needs. */
export type PackContent = {
  findingElements?: FindingElementRequirement[];
  semanticElementMappings?: SemanticElementMapping[];
};

/** A pack identity reference for source/target citations. */
export type PackRef = {
  packCode: string;
  packVersion: string;
};

/** A pack ready to render under (target) — content + identity. */
export type TargetPack = PackRef & {
  content: PackContent;
};

/** The source pack the finding was authored under (for `close`-mapping notes). */
export type SourcePack = PackRef;

/**
 * One rendered row in a finding under the target pack's vocabulary.
 *
 * `value` is the displayable string. `footerNote` carries the
 * equivalenceStrength annotation when not strict-identity. `fallbackUsed`
 * marks rows where the target pack offered a fallback prompt because its
 * mapping is `partial`. `warning` is set when the renderer emitted a
 * non-fatal concern the caller may want to surface (audit log, banner, etc).
 */
export type RenderedFindingRow = {
  /** Canonical semantic code this row was translated to/from. */
  canonicalCode: string;
  /** The label as the target pack names this slot (e.g., "Root Cause" for IIA). */
  label: string;
  /** The value to render. Empty string when the finding has no value for this slot. */
  value: string;
  /** equivalenceStrength of the target pack's mapping for this slot. */
  equivalenceStrength: "exact" | "close" | "partial" | "missing";
  /** Footer note for `close` mappings, or null otherwise. */
  footerNote: string | null;
  /** True when the value was sourced from `fallbackPrompt` (partial mapping). */
  fallbackUsed: boolean;
  /** Non-fatal warning the caller may surface; null when no concern. */
  warning: string | null;
};

/** The renderer's output: ordered rows + collected warnings. */
export type RenderedFinding = {
  rows: RenderedFindingRow[];
  /** Warnings collected across all rows (for audit-log emission etc.). */
  warnings: string[];
  /** Echo of inputs for traceability. */
  target: PackRef;
  source: PackRef | null;
};

/**
 * Inputs to `renderFindingForPack`.
 *
 * `elementValues` is canonical-keyed (slice-B per ADR-0010). For legacy
 * findings still in pack-coded storage, the caller normalizes upstream
 * (apps/api/src/packs/key-translation.ts) before calling this package.
 */
export type RenderFindingInput = {
  elementValues: Record<string, string>;
  targetPack: TargetPack;
  /**
   * The pack the finding was authored under, used in `close` mapping
   * footer notes (e.g., "rendered under GAGAS mapping"). When omitted,
   * `close` rows still annotate but with a generic "source mapping" tag.
   */
  sourcePack?: SourcePack;
};
