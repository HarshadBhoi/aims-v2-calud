/**
 * Unit tests for `renderFindingForPack`.
 *
 * Pure-function tests — no DB, no fixtures-with-state. Each test constructs
 * the inputs inline. Coverage per slice plan §1.2 acceptance criteria:
 *   - exact mapping: verbatim, no annotation.
 *   - close mapping: verbatim + footer note citing the source pack.
 *   - partial mapping: fallback text + warning event.
 *   - missing mapping: empty + warning (pack-authoring gap).
 *   - missing canonical value (draft finding): empty, no warning.
 *   - cross-pack identity (GAGAS finding rendered under IIA): keys translate.
 *   - architectural-risk smoke alarm: no `if (pack.code === ...)` branch is
 *     observable (handled implicitly by all renderers being mapping-driven).
 */

import { describe, expect, it } from "vitest";

import { renderFindingForPack } from "./render-finding";

import type { TargetPack } from "./types";

// ─── Test fixtures ────────────────────────────────────────────────────────

const GAGAS_PACK: TargetPack = {
  packCode: "GAGAS",
  packVersion: "2024.1",
  content: {
    findingElements: [
      { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
      { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
      { code: "CAUSE", name: "Cause", required: true, minLength: 50 },
      { code: "EFFECT", name: "Effect", required: true, minLength: 50 },
    ],
    semanticElementMappings: [
      { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
      { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
      { semanticCode: "CAUSE", packElementCode: "CAUSE", equivalenceStrength: "exact" },
      { semanticCode: "EFFECT", packElementCode: "EFFECT", equivalenceStrength: "exact" },
    ],
  },
};

const IIA_PACK: TargetPack = {
  packCode: "IIA-GIAS",
  packVersion: "2024.1",
  content: {
    findingElements: [
      { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
      { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
      { code: "ROOT_CAUSE", name: "Root Cause", required: true, minLength: 50 },
      { code: "CONSEQUENCE", name: "Consequence", required: true, minLength: 50 },
      { code: "RECOMMENDATION", name: "Recommendation", required: true, minLength: 50 },
    ],
    semanticElementMappings: [
      { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
      { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
      { semanticCode: "CAUSE", packElementCode: "ROOT_CAUSE", equivalenceStrength: "exact" },
      { semanticCode: "EFFECT", packElementCode: "CONSEQUENCE", equivalenceStrength: "exact" },
      {
        semanticCode: "RECOMMENDATION",
        packElementCode: "RECOMMENDATION",
        equivalenceStrength: "close",
      },
    ],
  },
};

const FILLED_FINDING: Record<string, string> = {
  CRITERIA: "the criterion text spelled out at length, padded to length minimum",
  CONDITION: "the condition text spelled out at length, padded to length minimum",
  CAUSE: "the cause text spelled out at length, padded to length minimum",
  EFFECT: "the effect text spelled out at length, padded to length minimum",
  RECOMMENDATION:
    "the recommendation text spelled out at length, padded to length minimum",
};

// ─── exact path ───────────────────────────────────────────────────────────

describe("renderFindingForPack — exact mapping", () => {
  it("renders GAGAS finding under GAGAS verbatim, no annotations", () => {
    const out = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: GAGAS_PACK,
    });

    expect(out.rows).toHaveLength(4);
    for (const row of out.rows) {
      expect(row.equivalenceStrength).toBe("exact");
      expect(row.footerNote).toBeNull();
      expect(row.fallbackUsed).toBe(false);
      expect(row.warning).toBeNull();
      expect(row.value).toBeTruthy();
    }
    expect(out.warnings).toEqual([]);
  });

  it("preserves the target pack's row order (CRITERIA, CONDITION, CAUSE, EFFECT)", () => {
    const out = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: GAGAS_PACK,
    });
    expect(out.rows.map((r) => r.canonicalCode)).toEqual([
      "CRITERIA",
      "CONDITION",
      "CAUSE",
      "EFFECT",
    ]);
  });
});

// ─── cross-pack rendering ─────────────────────────────────────────────────

describe("renderFindingForPack — cross-pack (GAGAS finding under IIA)", () => {
  it("uses IIA's labels (Root Cause, Consequence) sourced from canonical CAUSE / EFFECT", () => {
    const out = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: IIA_PACK,
      sourcePack: { packCode: "GAGAS", packVersion: "2024.1" },
    });

    expect(out.rows.map((r) => r.label)).toEqual([
      "Criteria",
      "Condition",
      "Root Cause",
      "Consequence",
      "Recommendation",
    ]);
    // Cross-translation: IIA's "Root Cause" row carries GAGAS's CAUSE value.
    const rootCause = out.rows.find((r) => r.label === "Root Cause");
    expect(rootCause?.value).toBe(FILLED_FINDING["CAUSE"]);
    const consequence = out.rows.find((r) => r.label === "Consequence");
    expect(consequence?.value).toBe(FILLED_FINDING["EFFECT"]);
  });

  it("RECOMMENDATION row carries the close-mapping footer note citing the source pack", () => {
    const out = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: IIA_PACK,
      sourcePack: { packCode: "GAGAS", packVersion: "2024.1" },
    });

    const rec = out.rows.find((r) => r.canonicalCode === "RECOMMENDATION");
    expect(rec?.equivalenceStrength).toBe("close");
    expect(rec?.footerNote).toBe("(rendered under GAGAS:2024.1 mapping)");
    expect(rec?.fallbackUsed).toBe(false);
    expect(rec?.value).toBe(FILLED_FINDING["RECOMMENDATION"]);
  });

  it("close-mapping footer falls back to a generic source tag when no sourcePack supplied", () => {
    const out = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: IIA_PACK,
    });
    const rec = out.rows.find((r) => r.canonicalCode === "RECOMMENDATION");
    expect(rec?.footerNote).toBe("(rendered under source mapping mapping)");
  });
});

// ─── partial mapping path ─────────────────────────────────────────────────

describe("renderFindingForPack — partial equivalenceStrength", () => {
  const PARTIAL_PACK: TargetPack = {
    packCode: "TEST-PARTIAL",
    packVersion: "1.0.0",
    content: {
      findingElements: [
        {
          code: "NC_CLAUSE",
          name: "Nonconformity Clause Reference",
          required: true,
          minLength: 5,
          fallbackPrompt:
            "(no GAGAS-equivalent clause reference; auditor must enter manually)",
        },
      ],
      semanticElementMappings: [
        {
          semanticCode: "CRITERIA",
          packElementCode: "NC_CLAUSE",
          equivalenceStrength: "partial",
        },
      ],
    },
  };

  it("renders the target pack's fallbackPrompt instead of the source value", () => {
    const out = renderFindingForPack({
      elementValues: { CRITERIA: "the criterion text — should not appear under partial" },
      targetPack: PARTIAL_PACK,
      sourcePack: { packCode: "GAGAS", packVersion: "2024.1" },
    });

    expect(out.rows).toHaveLength(1);
    const row = out.rows[0];
    expect(row?.equivalenceStrength).toBe("partial");
    expect(row?.fallbackUsed).toBe(true);
    expect(row?.value).toBe(
      "(no GAGAS-equivalent clause reference; auditor must enter manually)",
    );
    expect(row?.warning).toMatch(/equivalenceStrength=partial/);
    expect(out.warnings).toHaveLength(1);
  });

  it("uses a generic fallback when the target pack omits fallbackPrompt", () => {
    const noPromptPack: TargetPack = {
      ...PARTIAL_PACK,
      content: {
        ...PARTIAL_PACK.content,
        findingElements: [
          {
            code: "NC_CLAUSE",
            name: "Nonconformity Clause Reference",
            required: true,
            minLength: 5,
            // no fallbackPrompt
          },
        ],
      },
    };
    const out = renderFindingForPack({
      elementValues: { CRITERIA: "value" },
      targetPack: noPromptPack,
    });
    expect(out.rows[0]?.value).toBe(
      "(no faithful equivalent — see source pack for original wording)",
    );
  });
});

// ─── missing-value (draft finding) path ───────────────────────────────────

describe("renderFindingForPack — missing canonical value", () => {
  it("renders empty value + no warning when the finding hasn't filled a slot", () => {
    const out = renderFindingForPack({
      elementValues: { CRITERIA: "filled" },
      targetPack: GAGAS_PACK,
    });
    const condition = out.rows.find((r) => r.canonicalCode === "CONDITION");
    expect(condition?.value).toBe("");
    expect(condition?.warning).toBeNull();
    expect(out.warnings).toEqual([]);
  });
});

// ─── missing-mapping (pack-authoring gap) path ────────────────────────────

describe("renderFindingForPack — missing target-pack mapping", () => {
  const ORPHAN_PACK: TargetPack = {
    packCode: "ORPHAN-PACK",
    packVersion: "1.0.0",
    content: {
      findingElements: [
        { code: "GHOST", name: "Ghost", required: true, minLength: 1 },
      ],
      semanticElementMappings: [], // no mapping for GHOST
    },
  };

  it("renders empty value + emits a warning the caller can surface", () => {
    const out = renderFindingForPack({
      elementValues: { CRITERIA: "filled" },
      targetPack: ORPHAN_PACK,
    });
    expect(out.rows).toHaveLength(1);
    const row = out.rows[0];
    expect(row?.equivalenceStrength).toBe("missing");
    expect(row?.value).toBe("");
    expect(row?.warning).toMatch(/no semanticElementMapping/);
    expect(out.warnings).toHaveLength(1);
  });
});

// ─── architectural-risk smoke alarm ───────────────────────────────────────

describe("renderFindingForPack — no per-pack code branches (slice plan §9)", () => {
  it("identical canonical input produces structurally-distinct outputs across packs without per-pack code branches", () => {
    const gagas = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: GAGAS_PACK,
    });
    const iia = renderFindingForPack({
      elementValues: FILLED_FINDING,
      targetPack: IIA_PACK,
    });

    // Different row counts (GAGAS 4, IIA 5) and different labels — proven
    // distinct by the data, not by branching.
    expect(gagas.rows.length).not.toBe(iia.rows.length);
    expect(gagas.rows.map((r) => r.label)).not.toEqual(iia.rows.map((r) => r.label));

    // But the underlying CAUSE value is the same in both — the renderer
    // sourced it via canonical CAUSE both times.
    const gagasCause = gagas.rows.find((r) => r.canonicalCode === "CAUSE");
    const iiaRootCause = iia.rows.find((r) => r.canonicalCode === "CAUSE");
    expect(gagasCause?.value).toBe(iiaRootCause?.value);
  });
});
