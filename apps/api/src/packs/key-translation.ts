/**
 * Bidirectional key translation between pack-element-codes and canonical
 * semantic codes (Slice B W2 day 1, per ADR-0010 rollout phase 2).
 *
 * The migration script's `buildKeyMap` covers the same shape but its CLI
 * scope makes it batch-y; the API surface needs the per-request helpers
 * here:
 *   - normalizeToCanonical: input from clients (pack-codes OR canonical) →
 *     canonical-keyed payload for storage. Returns the deprecated keys it
 *     translated so the caller can log a deprecation warning.
 *   - translateToPackKeys: storage in pack-codes (legacy slice-A finding)
 *     → pack-keyed payload after a canonical input was normalized to
 *     pack-codes. Used when updating a legacy non-migrated finding.
 *
 * The canonical → pack direction is lossless for any pack whose
 * `semanticElementMappings` are all `equivalenceStrength: 'exact'`.
 * Slice-A's GAGAS-2024.1 seed satisfies this. Packs with `close` or
 * `partial` mappings will round-trip lossily on the rollback direction
 * — the caller should use the migration script's lossy-flag check.
 */

import { TRPCError } from "@trpc/server";

import { type ExpectedPackContent } from "./resolver";

export type CanonicalCode = string;
export type PackElementCode = string;

/** pack-element-code → canonical semantic code, sourced from a pack's mappings. */
export function buildPackToCanonicalMap(
  content: ExpectedPackContent,
): Map<PackElementCode, CanonicalCode> {
  const map = new Map<PackElementCode, CanonicalCode>();
  for (const m of content.semanticElementMappings ?? []) {
    map.set(m.packElementCode, m.semanticCode);
  }
  return map;
}

/** canonical semantic code → pack-element-code, sourced from a pack's mappings. */
export function buildCanonicalToPackMap(
  content: ExpectedPackContent,
): Map<CanonicalCode, PackElementCode> {
  const map = new Map<CanonicalCode, PackElementCode>();
  for (const m of content.semanticElementMappings ?? []) {
    map.set(m.semanticCode, m.packElementCode);
  }
  return map;
}

/**
 * Normalize an input keyed-values payload to canonical-semantic-code keys.
 *
 * Accepts either pack-element-codes (legacy slice-A clients) or canonical
 * codes (slice-B native clients). Pack-element-codes are translated via the
 * primary pack's `semanticElementMappings`; canonical codes pass through
 * unchanged. Unknown keys (neither a pack-element-code nor a recognized
 * canonical code declared by the pack) raise BAD_REQUEST.
 *
 * The returned `deprecatedKeys` list contains the pack-element-codes the
 * caller submitted; the API procedure logs a deprecation warning so client
 * authors can migrate at their own pace.
 */
export function normalizeToCanonical(
  values: Record<string, string>,
  packContent: ExpectedPackContent,
): { normalized: Record<string, string>; deprecatedKeys: string[] } {
  const packToCanonical = buildPackToCanonicalMap(packContent);
  const canonicalCodes = new Set(packToCanonical.values());

  const normalized: Record<string, string> = {};
  const deprecatedKeys: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (canonicalCodes.has(key)) {
      normalized[key] = value;
      continue;
    }
    const canonical = packToCanonical.get(key);
    if (canonical !== undefined) {
      normalized[canonical] = value;
      deprecatedKeys.push(key);
      continue;
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `Unknown element code "${key}" — expected either a pack-element-code ` +
        `(${[...packToCanonical.keys()].join(", ")}) or a canonical semantic code ` +
        `(${[...canonicalCodes].join(", ")}).`,
    });
  }

  return { normalized, deprecatedKeys };
}

/**
 * Translate canonical-keyed values BACK to pack-element-code keys.
 *
 * Used when a slice-B-native client (canonical input) writes against a
 * legacy finding still stored in pack-codes (`elementsCanonicalized=false`).
 * The migration script is the supported way to flip storage shape; until
 * that runs, the API preserves the existing storage format and just
 * translates the inbound canonical input.
 *
 * Throws BAD_REQUEST if a canonical key has no pack-side equivalent —
 * meaning the slice-B client wrote a canonical code the legacy pack
 * doesn't even know about (e.g., RECOMMENDATION on a GAGAS-only finding).
 */
export function translateCanonicalToPack(
  values: Record<string, string>,
  packContent: ExpectedPackContent,
): Record<string, string> {
  const canonicalToPack = buildCanonicalToPackMap(packContent);
  const out: Record<string, string> = {};
  for (const [canonical, value] of Object.entries(values)) {
    const pack = canonicalToPack.get(canonical);
    if (pack === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Canonical code "${canonical}" has no equivalent in the engagement's ` +
          `primary pack — cannot write to a legacy (pack-keyed) finding without ` +
          `a mapping. Run the canonical-key migration first.`,
      });
    }
    out[pack] = value;
  }
  return out;
}

/**
 * Single-key normalize for `finding.updateElement` style autosave inputs.
 * Returns the canonical key + a `wasDeprecated` flag.
 */
export function normalizeElementKey(
  key: string,
  packContent: ExpectedPackContent,
): { canonical: CanonicalCode; wasDeprecated: boolean } {
  const packToCanonical = buildPackToCanonicalMap(packContent);
  const canonicalCodes = new Set(packToCanonical.values());

  if (canonicalCodes.has(key)) {
    return { canonical: key, wasDeprecated: false };
  }
  const canonical = packToCanonical.get(key);
  if (canonical !== undefined) {
    return { canonical, wasDeprecated: true };
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      `Unknown element code "${key}" — expected either a pack-element-code ` +
      `(${[...packToCanonical.keys()].join(", ")}) or a canonical semantic code ` +
      `(${[...canonicalCodes].join(", ")}).`,
  });
}

/**
 * Count how many of the engagement's required canonical codes have a
 * non-empty value of sufficient length in a canonical-keyed payload.
 *
 * `requiredCanonicalCodes` comes from the persisted `EngagementStrictness`
 * row (the union across all attached packs per ADR-0011). The minLength
 * lookup uses the primary pack's `findingElements` joined to the canonical
 * dictionary via its `semanticElementMappings`.
 */
export function countCanonicalElementsComplete(
  values: Record<string, string>,
  requiredCanonicalCodes: readonly string[],
  primaryPackContent: ExpectedPackContent,
): number {
  const packToCanonical = buildPackToCanonicalMap(primaryPackContent);
  const findingElements = primaryPackContent.findingElements ?? [];

  // Canonical → minLength via primary pack. Codes the primary pack doesn't
  // map (e.g., RECOMMENDATION when only GAGAS is attached) fall back to a
  // any-non-empty rule — the union semantics are about presence, not shape.
  const minLengthByCanonical = new Map<CanonicalCode, number>();
  for (const fe of findingElements) {
    const canonical = packToCanonical.get(fe.code);
    if (canonical !== undefined) {
      minLengthByCanonical.set(canonical, fe.minLength);
    }
  }

  let count = 0;
  for (const code of requiredCanonicalCodes) {
    const v = values[code];
    if (typeof v !== "string") continue;
    const minLength = minLengthByCanonical.get(code) ?? 1;
    if (v.length >= minLength) count += 1;
  }
  return count;
}
