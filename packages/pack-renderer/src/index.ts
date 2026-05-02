/**
 * @aims/pack-renderer — public surface.
 *
 * Cross-pack rendering of canonical-keyed findings into target-pack
 * vocabularies, honoring `semanticElementMappings.equivalenceStrength`.
 * Per VERTICAL-SLICE-B-PLAN §4 W2 + ADR-0010.
 *
 * The package is consumed by:
 *   - apps/worker — pdfkit report rendering (slice B day 5)
 *   - apps/api    — compliance-statement assembly (slice B day 6-7)
 */

export { renderFindingForPack } from "./render-finding";

export type {
  FindingElementRequirement,
  PackContent,
  PackRef,
  RenderFindingInput,
  RenderedFinding,
  RenderedFindingRow,
  SemanticElementMapping,
  SourcePack,
  TargetPack,
} from "./types";
