/**
 * Unit tests for the pure strictness resolver (Slice B W1 Day 2-3).
 *
 * Pure-function tests — no DB, no Prisma. Exercise the rule-merge logic
 * directly by constructing PackInput[] arrays. The integration tests in
 * `routers/business.test.ts` cover the persistence + procedure layer.
 *
 * Key invariants per ADR-0011 + slice plan §1.2:
 *   - Order independence: resolve([A,B]) === resolve([B,A])
 *   - Primary precedence: when ties, primary's drivenBy citation wins
 *   - Union semantics for required canonical codes
 *   - Hardcoded strictness directions (max for retention/cooling/cpe; OR
 *     for boolean doc requirements; union for canonical codes)
 */

import { describe, expect, it } from "vitest";

import {
  type ExpectedPackContent,
  type PackInput,
  resolveStrictness,
} from "./resolver";

// ─── Test fixtures ────────────────────────────────────────────────────────

const GAGAS_CONTENT: ExpectedPackContent = {
  findingElements: [
    { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
    { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
    { code: "CAUSE", name: "Cause", required: true, minLength: 50 },
    { code: "EFFECT", name: "Effect", required: true, minLength: 50 },
  ],
  findingClassifications: [
    { code: "MINOR", severity: 1 },
    { code: "MATERIAL", severity: 3 },
  ],
  documentationRequirements: {
    fourElementComplete: true,
    workPaperCitationRequired: true,
    retentionYears: 7,
  },
  semanticElementMappings: [
    { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
    { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
    { semanticCode: "CAUSE", packElementCode: "CAUSE", equivalenceStrength: "exact" },
    { semanticCode: "EFFECT", packElementCode: "EFFECT", equivalenceStrength: "exact" },
  ],
  independenceRules: { coolingOffPeriodMonths: 24 },
  cpeRequirements: { requiredHoursPerCycle: 80 },
};

const IIA_CONTENT: ExpectedPackContent = {
  findingElements: [
    { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
    { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
    { code: "ROOT_CAUSE", name: "Root Cause", required: true, minLength: 50 },
    { code: "CONSEQUENCE", name: "Consequence", required: true, minLength: 50 },
    { code: "RECOMMENDATION", name: "Recommendation", required: true, minLength: 50 },
  ],
  findingClassifications: [
    { code: "LOW", severity: 1 },
    { code: "HIGH", severity: 3 },
  ],
  documentationRequirements: {
    fourElementComplete: false,
    workPaperCitationRequired: true,
    retentionYears: 5,
  },
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
  independenceRules: { coolingOffPeriodMonths: 12 },
  cpeRequirements: { requiredHoursPerCycle: null },
};

function gagas(opts: { isPrimary?: boolean } = {}): PackInput {
  return {
    packCode: "GAGAS",
    packVersion: "2024.1",
    isPrimary: opts.isPrimary ?? false,
    content: GAGAS_CONTENT,
  };
}

function iia(opts: { isPrimary?: boolean } = {}): PackInput {
  return {
    packCode: "IIA-GIAS",
    packVersion: "2024.1",
    isPrimary: opts.isPrimary ?? false,
    content: IIA_CONTENT,
  };
}

// ─── Single-pack baseline ─────────────────────────────────────────────────

describe("resolveStrictness — single pack (slice A parity)", () => {
  it("returns GAGAS's rules when only GAGAS is attached", () => {
    const out = resolveStrictness([gagas({ isPrimary: true })]);

    expect(out.strictness.retentionYears).toBe(7);
    expect(out.strictness.coolingOffMonths).toBe(24);
    expect(out.strictness.cpeHours).toBe(80);
    expect(out.strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
    ]);
    expect(out.resolved.findingElements.map((e) => e.code)).toEqual([
      "CRITERIA",
      "CONDITION",
      "CAUSE",
      "EFFECT",
    ]);
  });

  it("returns IIA's rules when only IIA is attached (primary)", () => {
    const out = resolveStrictness([iia({ isPrimary: true })]);

    expect(out.strictness.retentionYears).toBe(5);
    expect(out.strictness.coolingOffMonths).toBe(12);
    expect(out.strictness.cpeHours).toBeNull();
    expect(out.strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
  });

  it("rejects an empty pack list", () => {
    expect(() => resolveStrictness([])).toThrow(/no packs attached/i);
  });

  it("rejects when no primary is present", () => {
    expect(() => resolveStrictness([gagas({ isPrimary: false })])).toThrow(
      /no primary methodology/i,
    );
  });

  it("rejects when more than one primary is present", () => {
    expect(() =>
      resolveStrictness([gagas({ isPrimary: true }), iia({ isPrimary: true })]),
    ).toThrow(/multiple primary/i);
  });
});

// ─── Multi-pack: GAGAS primary + IIA secondary ───────────────────────────

describe("resolveStrictness — multi-pack (GAGAS primary + IIA secondary)", () => {
  it("retention picks max (GAGAS 7 > IIA 5)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.strictness.retentionYears).toBe(7);
    const driver = out.strictness.drivenBy.find((e) => e.rule === "retentionYears");
    expect(driver?.source.packCode).toBe("GAGAS");
    expect(driver?.source.direction).toBe("max");
  });

  it("cooling-off picks max (GAGAS 24 > IIA 12)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.strictness.coolingOffMonths).toBe(24);
    const driver = out.strictness.drivenBy.find((e) => e.rule === "coolingOffMonths");
    expect(driver?.source.packCode).toBe("GAGAS");
  });

  it("cpe picks max-non-null (GAGAS 80, IIA null) → 80", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.strictness.cpeHours).toBe(80);
    const driver = out.strictness.drivenBy.find((e) => e.rule === "cpeHours");
    expect(driver?.source.packCode).toBe("GAGAS");
  });

  it("requiredCanonicalCodes is the union of both packs (GAGAS 4 + IIA 5 → 5)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
  });

  it("documentationRequirements.fourElementComplete is OR (GAGAS true || IIA false → true)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.strictness.documentationRequirements.fourElementComplete).toBe(true);
  });

  it("ResolvedRequirements.findingElements comes from the primary pack (GAGAS labels)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.resolved.findingElements.map((e) => e.code)).toEqual([
      "CRITERIA",
      "CONDITION",
      "CAUSE", // GAGAS uses "CAUSE", not IIA's "ROOT_CAUSE"
      "EFFECT",
    ]);
  });

  it("ResolvedRequirements.sources lists both packs in deterministic order (primary first)", () => {
    const out = resolveStrictness([gagas({ isPrimary: true }), iia()]);

    expect(out.resolved.sources.map((s) => s.packCode)).toEqual(["GAGAS", "IIA-GIAS"]);
  });
});

// ─── Determinism: order-independence + primary precedence ─────────────────

describe("resolveStrictness — determinism (slice plan §1.2 invariants)", () => {
  it("resolve([gagas, iia]) and resolve([iia, gagas]) produce identical strictness", () => {
    const a = resolveStrictness([gagas({ isPrimary: true }), iia()]);
    const b = resolveStrictness([iia(), gagas({ isPrimary: true })]);

    expect(a.strictness).toEqual(b.strictness);
    expect(a.resolved).toEqual(b.resolved);
  });

  it("primary precedence: ties cite the primary, not the secondary", () => {
    // Construct a tie: both packs declare retentionYears=10. Primary should
    // be cited as the driver in the drivenBy trail.
    const sharedRetention: ExpectedPackContent = {
      ...GAGAS_CONTENT,
      documentationRequirements: { ...GAGAS_CONTENT.documentationRequirements!, retentionYears: 10 },
    };
    const tiePack: PackInput = {
      packCode: "GAGAS",
      packVersion: "2024.1",
      isPrimary: true,
      content: sharedRetention,
    };
    const otherPack: PackInput = {
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
      isPrimary: false,
      content: {
        ...IIA_CONTENT,
        documentationRequirements: {
          ...IIA_CONTENT.documentationRequirements!,
          retentionYears: 10, // tie
        },
      },
    };

    const out = resolveStrictness([otherPack, tiePack]); // secondary first
    const driver = out.strictness.drivenBy.find((e) => e.rule === "retentionYears");
    expect(driver?.source.packCode).toBe("GAGAS"); // primary wins the tie citation
  });

  it("primary precedence: union codes from both contribute, but primary's citation wins for shared codes", () => {
    const out = resolveStrictness([iia(), gagas({ isPrimary: true })]);

    // CRITERIA, CONDITION are shared. GAGAS is primary, so its packCode
    // appears in the drivenBy entries for those codes.
    const criteriaDriver = out.strictness.drivenBy.find(
      (e) => e.rule === "requiredCanonicalCodes.CRITERIA",
    );
    expect(criteriaDriver?.source.packCode).toBe("GAGAS");

    // RECOMMENDATION is unique to IIA — only IIA can be the driver.
    const recDriver = out.strictness.drivenBy.find(
      (e) => e.rule === "requiredCanonicalCodes.RECOMMENDATION",
    );
    expect(recDriver?.source.packCode).toBe("IIA-GIAS");
  });

  it("idempotent: calling resolve twice with the same input yields identical output", () => {
    const inputs = [gagas({ isPrimary: true }), iia()];
    const a = resolveStrictness(inputs);
    const b = resolveStrictness(inputs);

    expect(a).toEqual(b);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────

describe("resolveStrictness — edge cases", () => {
  it("packs with no findingElements contribute no required canonical codes", () => {
    const empty: PackInput = {
      packCode: "EMPTY",
      packVersion: "1.0",
      isPrimary: true,
      content: {},
    };
    const out = resolveStrictness([empty]);

    expect(out.strictness.requiredCanonicalCodes).toEqual([]);
    expect(out.resolved.findingElements).toEqual([]);
  });

  it("an unmapped findingElement (no semanticElementMappings entry) is skipped silently", () => {
    const orphan: PackInput = {
      packCode: "ORPHAN",
      packVersion: "1.0",
      isPrimary: true,
      content: {
        findingElements: [
          { code: "UNKNOWN", name: "Unknown", required: true, minLength: 10 },
        ],
        // No semanticElementMappings → UNKNOWN never resolves to a canonical.
      },
    };
    const out = resolveStrictness([orphan]);

    expect(out.strictness.requiredCanonicalCodes).toEqual([]);
  });

  it("uses default retention years when no pack declares retention", () => {
    const sparse: PackInput = {
      packCode: "SPARSE",
      packVersion: "1.0",
      isPrimary: true,
      content: {},
    };
    const out = resolveStrictness([sparse]);

    expect(out.strictness.retentionYears).toBe(7); // DEFAULT_DOCUMENTATION_REQUIREMENTS
  });
});
