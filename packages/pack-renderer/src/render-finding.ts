/**
 * Cross-pack finding renderer.
 *
 * Given a canonical-keyed finding payload and a target pack, produce an
 * ordered list of rows in the target pack's vocabulary. The renderer
 * consults the target pack's `semanticElementMappings` to translate canonical
 * codes back into pack-element-codes (and the human label that goes with
 * them). `equivalenceStrength` controls render fidelity:
 *
 *   - `exact`    — verbatim, no annotation.
 *   - `close`    — verbatim with a footer note ("(rendered under {source} mapping)").
 *   - `partial`  — fallback text from the target pack's `fallbackPrompt` AND
 *                  a warning the caller can surface (audit-log event etc.).
 *   - missing canonical — empty value, no footer.
 *
 * The function is pure — same input, same output, no side effects. The
 * architectural-risk smoke alarm Slice B §9 names is silent here: there is
 * no `if (pack.code === ...)` branch anywhere in the body.
 */

import {
  type FindingElementRequirement,
  type RenderFindingInput,
  type RenderedFinding,
  type RenderedFindingRow,
  type SemanticElementMapping,
} from "./types";

export function renderFindingForPack(input: RenderFindingInput): RenderedFinding {
  const { elementValues, targetPack, sourcePack } = input;
  const elements = targetPack.content.findingElements ?? [];
  const mappings = targetPack.content.semanticElementMappings ?? [];

  const mappingByPackCode = new Map<string, SemanticElementMapping>();
  for (const m of mappings) {
    mappingByPackCode.set(m.packElementCode, m);
  }

  const rows: RenderedFindingRow[] = [];
  const warnings: string[] = [];
  const sourceTag =
    sourcePack !== undefined
      ? `${sourcePack.packCode}:${sourcePack.packVersion}`
      : "source mapping";

  for (const element of elements) {
    rows.push(
      renderRow({
        element,
        mapping: mappingByPackCode.get(element.code),
        elementValues,
        sourceTag,
        warnings,
      }),
    );
  }

  return {
    rows,
    warnings,
    target: { packCode: targetPack.packCode, packVersion: targetPack.packVersion },
    source: sourcePack ?? null,
  };
}

/**
 * Render a single element row. Extracted for clarity; per-row decisions are:
 *   - find the canonical semantic code via the target pack's mapping
 *   - look up the value in canonical-keyed payload
 *   - apply equivalenceStrength rules
 *   - emit a warning if the row is `partial` or has no canonical mapping
 */
function renderRow(args: {
  element: FindingElementRequirement;
  mapping: SemanticElementMapping | undefined;
  elementValues: Record<string, string>;
  sourceTag: string;
  warnings: string[];
}): RenderedFindingRow {
  const { element, mapping, elementValues, sourceTag, warnings } = args;

  // No mapping at all → the target pack declared this finding-element slot
  // without a corresponding semanticElementMapping entry. This is a pack-
  // authoring gap, not a rendering bug. Render an empty value + warn.
  if (mapping === undefined) {
    const w =
      `Target pack has no semanticElementMapping for findingElement ` +
      `"${element.code}" — slot rendered empty.`;
    warnings.push(w);
    return {
      canonicalCode: element.code,
      label: element.name,
      value: "",
      equivalenceStrength: "missing",
      footerNote: null,
      fallbackUsed: false,
      warning: w,
    };
  }

  const canonical = mapping.semanticCode;
  const rawValue = elementValues[canonical];
  const hasValue = typeof rawValue === "string" && rawValue.length > 0;

  // No value supplied. Render the slot empty regardless of equivalence
  // strength — there's nothing to translate. Don't warn; "draft finding,
  // not yet filled" is a legitimate state.
  if (!hasValue) {
    return {
      canonicalCode: canonical,
      label: element.name,
      value: "",
      equivalenceStrength: mapping.equivalenceStrength,
      footerNote: null,
      fallbackUsed: false,
      warning: null,
    };
  }

  switch (mapping.equivalenceStrength) {
    case "exact": {
      return {
        canonicalCode: canonical,
        label: element.name,
        value: rawValue,
        equivalenceStrength: "exact",
        footerNote: null,
        fallbackUsed: false,
        warning: null,
      };
    }
    case "close": {
      return {
        canonicalCode: canonical,
        label: element.name,
        value: rawValue,
        equivalenceStrength: "close",
        footerNote: `(rendered under ${sourceTag} mapping)`,
        fallbackUsed: false,
        warning: null,
      };
    }
    case "partial": {
      const fallback =
        element.fallbackPrompt ??
        `(no faithful equivalent — see source pack for original wording)`;
      const w =
        `Element "${element.code}" mapped from canonical ` +
        `"${canonical}" with equivalenceStrength=partial; rendered fallback ` +
        `text instead of the source value.`;
      warnings.push(w);
      return {
        canonicalCode: canonical,
        label: element.name,
        value: fallback,
        equivalenceStrength: "partial",
        footerNote: `(fallback under ${sourceTag} mapping)`,
        fallbackUsed: true,
        warning: w,
      };
    }
  }
}
