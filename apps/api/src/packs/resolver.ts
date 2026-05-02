/**
 * Pack resolver — Slice B.
 *
 * Slice A: single pack per engagement; multi-pack threw NOT_IMPLEMENTED.
 * Slice B: ≥1 pack with the strictness resolver computing effective rules
 * across the attached set, idempotently persisted to `EngagementStrictness`
 * (per ADR-0011).
 *
 * Hardcoded directions for the rules in slice B's §10 gate-2 scope:
 *   - retentionYears        max    (longer = stricter)
 *   - coolingOffMonths      max    (longer = stricter)
 *   - cpeHours              max    (more = stricter; null = no requirement)
 *   - documentationRequirements    field-by-field (OR for booleans, max for retention)
 *   - requiredCanonicalCodes       union via semanticElementMappings
 *
 * Pack-declared per-rule strictness directions (a future enhancement) layer
 * on top of this without changing the resolver shape.
 *
 * Determinism: input pack order does not affect output (ADR-0011 invariant +
 * slice plan §1.2 acceptance criterion). Implementation sorts packs primary-
 * first then alphabetical; each rule applies the same tie-break ("primary
 * wins"). The `drivenBy` audit trail cites the pack that drove each rule's
 * effective value.
 */

import {
  type DocumentationRequirements,
  type FindingClassificationRequirement,
  type FindingElementRequirement,
  type ResolvedRequirements,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import { type AuthedPrisma } from "../trpc";

// ─── Types ────────────────────────────────────────────────────────────────

type SemanticElementMapping = {
  semanticCode: string;
  packElementCode: string;
  equivalenceStrength: "exact" | "close" | "partial";
};

/** Shape we expect inside `StandardPack.packContent` for slice-B-aware packs. */
export type ExpectedPackContent = {
  findingElements?: FindingElementRequirement[];
  findingClassifications?: FindingClassificationRequirement[];
  documentationRequirements?: DocumentationRequirements;
  semanticElementMappings?: SemanticElementMapping[];
  independenceRules?: { coolingOffPeriodMonths?: number };
  cpeRequirements?: { requiredHoursPerCycle?: number | null };
};

/** A single attached pack as the resolver consumes it. */
export type PackInput = {
  packCode: string;
  packVersion: string;
  isPrimary: boolean;
  content: ExpectedPackContent;
};

export type StrictnessDirection = "max" | "min" | "union" | "override_required";

export type DrivenByEntry = {
  rule: string;
  value: unknown;
  source: {
    packCode: string;
    packVersion: string;
    direction: StrictnessDirection;
  };
};

/** Persistence-ready strictness data — what writes to `EngagementStrictness`. */
export type EngagementStrictnessData = {
  retentionYears: number;
  coolingOffMonths: number;
  cpeHours: number | null;
  documentationRequirements: DocumentationRequirements;
  requiredCanonicalCodes: string[];
  drivenBy: DrivenByEntry[];
};

/** Resolver output: both the API-facing requirements + the persistence data. */
export type StrictnessResolution = {
  resolved: ResolvedRequirements;
  strictness: EngagementStrictnessData;
};

// ─── Pure resolver ────────────────────────────────────────────────────────

const DEFAULT_DOCUMENTATION_REQUIREMENTS: DocumentationRequirements = {
  fourElementComplete: true,
  workPaperCitationRequired: false,
  retentionYears: 7,
};

/**
 * Resolves the effective requirements + strictness across a set of attached
 * packs. Pure — same input always yields the same output.
 *
 * Throws if `packs` is empty or has zero/multiple primaries.
 */
export function resolveStrictness(packs: readonly PackInput[]): StrictnessResolution {
  if (packs.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No packs attached to this engagement. Attach at least one pack first.",
    });
  }

  const primaries = packs.filter((p) => p.isPrimary);
  if (primaries.length === 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No primary methodology found among attachments. Pack-attachment invariant violated.",
    });
  }
  if (primaries.length > 1) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Multiple primary methodologies found among attachments. Pack-attachment invariant violated.",
    });
  }

  // Determinism: primary first, then alphabetical by code/version.
  const sorted = [...packs].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.packCode !== b.packCode) return a.packCode.localeCompare(b.packCode);
    return a.packVersion.localeCompare(b.packVersion);
  });
  const primary = sorted[0];
  if (!primary) {
    // Unreachable given the empty + primary checks above, but narrows the type.
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "no primary after sort" });
  }

  // Per-rule resolution. For every "max" rule, primary wins ties (slice plan
  // §1.2 invariant). The `pickMaxDriver` helper centralizes this.

  const retention = pickMaxDriver(sorted, (p) => p.content.documentationRequirements?.retentionYears);
  const cooling = pickMaxDriver(sorted, (p) => p.content.independenceRules?.coolingOffPeriodMonths);
  const cpe = pickMaxNullableDriver(sorted, (p) => p.content.cpeRequirements?.requiredHoursPerCycle);

  // documentationRequirements — per-field merge:
  //   fourElementComplete:        OR (any pack requires → required)
  //   workPaperCitationRequired:  OR
  //   retentionYears:             same `max` value computed above
  let fourElementComplete = false;
  let workPaperCitationRequired = false;
  let fourElementDriver: PackInput | null = null;
  let citationDriver: PackInput | null = null;
  for (const pack of sorted) {
    const dr = pack.content.documentationRequirements;
    if (dr?.fourElementComplete && (!fourElementDriver || pack.isPrimary)) {
      fourElementComplete = true;
      fourElementDriver ??= pack;
    }
    if (dr?.workPaperCitationRequired && (!citationDriver || pack.isPrimary)) {
      workPaperCitationRequired = true;
      citationDriver ??= pack;
    }
  }
  const documentationRequirements: DocumentationRequirements = {
    fourElementComplete,
    workPaperCitationRequired,
    retentionYears: retention.value ?? DEFAULT_DOCUMENTATION_REQUIREMENTS.retentionYears,
  };

  // requiredCanonicalCodes — union via semanticElementMappings.
  // For each pack, translate its required findingElements (pack-codes) to
  // canonical codes via that pack's semanticElementMappings, then union.
  const codeContributors = new Map<string, PackInput>();
  for (const pack of sorted) {
    const findingElements = pack.content.findingElements ?? [];
    const mappings = pack.content.semanticElementMappings ?? [];
    const codeToCanonical = new Map<string, string>();
    for (const m of mappings) {
      codeToCanonical.set(m.packElementCode, m.semanticCode);
    }
    for (const el of findingElements) {
      if (!el.required) continue;
      const canonical = codeToCanonical.get(el.code);
      if (canonical === undefined) continue; // unmapped — skip silently for slice B
      if (!codeContributors.has(canonical) || pack.isPrimary) {
        codeContributors.set(canonical, pack);
      }
    }
  }
  const requiredCanonicalCodes = [...codeContributors.keys()].sort();

  // drivenBy trail.
  const drivenBy: DrivenByEntry[] = [];
  if (retention.driver !== null) {
    drivenBy.push({
      rule: "retentionYears",
      value: retention.value,
      source: { ...packRef(retention.driver), direction: "max" },
    });
  }
  if (cooling.driver !== null) {
    drivenBy.push({
      rule: "coolingOffMonths",
      value: cooling.value,
      source: { ...packRef(cooling.driver), direction: "max" },
    });
  }
  if (cpe.driver !== null) {
    drivenBy.push({
      rule: "cpeHours",
      value: cpe.value,
      source: { ...packRef(cpe.driver), direction: "max" },
    });
  }
  if (fourElementDriver !== null) {
    drivenBy.push({
      rule: "documentationRequirements.fourElementComplete",
      value: fourElementComplete,
      source: { ...packRef(fourElementDriver), direction: "union" },
    });
  }
  if (citationDriver !== null) {
    drivenBy.push({
      rule: "documentationRequirements.workPaperCitationRequired",
      value: workPaperCitationRequired,
      source: { ...packRef(citationDriver), direction: "union" },
    });
  }
  for (const code of requiredCanonicalCodes) {
    const driver = codeContributors.get(code);
    if (driver) {
      drivenBy.push({
        rule: `requiredCanonicalCodes.${code}`,
        value: code,
        source: { ...packRef(driver), direction: "union" },
      });
    }
  }

  // ResolvedRequirements: UI labels come from primary; multi-pack consumers
  // take primary's findingElements as the canonical-label source per ADR-0010.
  const resolved: ResolvedRequirements = {
    findingElements: primary.content.findingElements ?? [],
    findingClassifications: primary.content.findingClassifications ?? [],
    documentationRequirements,
    sources: sorted.map((p) => ({ packCode: p.packCode, packVersion: p.packVersion })),
  };

  return {
    resolved,
    strictness: {
      retentionYears: documentationRequirements.retentionYears,
      coolingOffMonths: cooling.value ?? 0,
      cpeHours: cpe.value,
      documentationRequirements,
      requiredCanonicalCodes,
      drivenBy,
    },
  };
}

// ─── Persistence wrapper ──────────────────────────────────────────────────

/**
 * Loads attachments → resolves → upserts `EngagementStrictness` atomically.
 *
 * Callers should pass either the regular tenant client (for standalone
 * resolves) or the transaction-bound client they already opened around
 * their attachment write (the typical pack.attach / pack.detach /
 * pack.swapPrimary path). Both client shapes share the same model API,
 * so the function body doesn't care which it received.
 */
export async function resolveAndPersist(
  engagementId: string,
  prisma: AuthedPrisma,
): Promise<StrictnessResolution> {
  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });

  const inputs: PackInput[] = attachments.map((a) => ({
    packCode: a.packCode,
    packVersion: a.packVersion,
    isPrimary: a.isPrimary,
    content: a.pack.packContent as ExpectedPackContent,
  }));

  const resolution = resolveStrictness(inputs);

  // Idempotent overwrite: upsert keyed by engagementId. Bumps `version` on
  // every re-run so optimistic-concurrency callers can detect the change.
  await prisma.engagementStrictness.upsert({
    where: { engagementId },
    // @ts-expect-error — tenantId injected at runtime by our tenant extension
    create: {
      engagementId,
      retentionYears: resolution.strictness.retentionYears,
      coolingOffMonths: resolution.strictness.coolingOffMonths,
      cpeHours: resolution.strictness.cpeHours,
      documentationRequirements: resolution.strictness.documentationRequirements,
      requiredCanonicalCodes: resolution.strictness.requiredCanonicalCodes,
      drivenBy: resolution.strictness.drivenBy,
    },
    update: {
      retentionYears: resolution.strictness.retentionYears,
      coolingOffMonths: resolution.strictness.coolingOffMonths,
      cpeHours: resolution.strictness.cpeHours,
      documentationRequirements: resolution.strictness.documentationRequirements,
      requiredCanonicalCodes: resolution.strictness.requiredCanonicalCodes,
      drivenBy: resolution.strictness.drivenBy,
      version: { increment: 1 },
    },
  });

  return resolution;
}

// ─── Backwards-compatible read entry point ─────────────────────────────────

/**
 * Slice-A-shaped entry point: returns just `ResolvedRequirements` (no
 * persistence side effect). Existing tRPC `pack.resolve` query uses this.
 *
 * Slice B's pack.attach / pack.detach / pack.swapPrimary use
 * `resolveAndPersist` instead because they own the strictness write.
 */
export async function resolvePackRequirements(
  engagementId: string,
  prisma: AuthedPrisma,
): Promise<ResolvedRequirements> {
  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });
  if (attachments.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No packs attached to this engagement. Attach at least one pack first.",
    });
  }
  const inputs: PackInput[] = attachments.map((a) => ({
    packCode: a.packCode,
    packVersion: a.packVersion,
    isPrimary: a.isPrimary,
    content: a.pack.packContent as ExpectedPackContent,
  }));
  return resolveStrictness(inputs).resolved;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function packRef(p: PackInput): { packCode: string; packVersion: string } {
  return { packCode: p.packCode, packVersion: p.packVersion };
}

/**
 * Picks the pack with the maximum value for a given rule. Ties broken by
 * primary preference (slice plan §1.2 + ADR-0011 invariant).
 *
 * Returns `{ value: undefined, driver: null }` if no pack declares the rule.
 */
function pickMaxDriver(
  packs: readonly PackInput[],
  extract: (p: PackInput) => number | undefined,
): { value: number | undefined; driver: PackInput | null } {
  let bestValue: number | undefined;
  let bestDriver: PackInput | null = null;
  for (const pack of packs) {
    const v = extract(pack);
    if (v === undefined) continue;
    if (bestValue === undefined || v > bestValue) {
      bestValue = v;
      bestDriver = pack;
    } else if (v === bestValue && pack.isPrimary) {
      bestDriver = pack;
    }
  }
  return { value: bestValue, driver: bestDriver };
}

/**
 * Same as `pickMaxDriver` but treats `null` and `undefined` as "no
 * requirement" — they don't override numeric values from other packs.
 * Used for `cpeHours` where a pack may declare null explicitly.
 */
function pickMaxNullableDriver(
  packs: readonly PackInput[],
  extract: (p: PackInput) => number | null | undefined,
): { value: number | null; driver: PackInput | null } {
  let bestValue: number | null = null;
  let bestDriver: PackInput | null = null;
  for (const pack of packs) {
    const v = extract(pack);
    if (v === null || v === undefined) continue;
    if (bestValue === null || v > bestValue) {
      bestValue = v;
      bestDriver = pack;
    } else if (v === bestValue && pack.isPrimary) {
      bestDriver = pack;
    }
  }
  return { value: bestValue, driver: bestDriver };
}
