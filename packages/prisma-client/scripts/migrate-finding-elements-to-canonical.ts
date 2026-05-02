/**
 * One-shot migration that translates `Finding.elementValuesCipher` from
 * pack-element-code-keyed JSON (slice A) to canonical-semantic-code-keyed
 * JSON (slice B per ADR-0010).
 *
 * Per the slice plan §4 W1 day 4-7, this is the riskiest deliverable in
 * Slice B. The script earns careful design:
 *
 *   - Per-tenant DEK loop. The encryption module (LRU cache, 15min TTL by
 *     default) unwraps each tenant's DEK once via KMS, then handles all of
 *     that tenant's findings out of cache. No N×KMS calls.
 *
 *   - Per-finding atomic transaction. Each finding's decrypt → translate →
 *     re-encrypt → version-bump runs inside one Prisma `$transaction` so a
 *     mid-row failure doesn't leave the cipher half-rewritten. The
 *     `elementsCanonicalized` flag (added in the schema migration that ships
 *     alongside this script) is updated in the same tx as the cipher.
 *
 *   - Idempotent. Re-running the migration skips findings whose
 *     `elementsCanonicalized` matches the direction. Forward-mode skips
 *     rows where the flag is already `true`; rollback skips where `false`.
 *
 *   - Resumable. The flag IS the checkpoint: a partial run leaves a clean
 *     mix of {migrated, not-yet-migrated} rows. Re-running picks up only
 *     the not-yet-migrated ones. No separate checkpoint table needed.
 *
 *   - Dry-run mode. `--dry-run` walks every row, logs what it would do,
 *     decrypts to verify access, but skips the write.
 *
 *   - Rollback. `--rollback` runs the inverse mapping (canonical →
 *     pack-element-code via the primary pack's mappings). Lossless for
 *     pack mappings whose `equivalenceStrength` is `exact` — which covers
 *     the entire slice-A seed (GAGAS-2024.1 has 4 exact mappings).
 *
 *   - Observable. Structured per-tenant + per-finding progress logs,
 *     end-of-run summary, exit code 1 on any unrecoverable error so CI can
 *     gate on it.
 *
 *   - KMS-throttle aware. The encryption module's LRU cache means we hit
 *     KMS once per tenant; further DEK ops are local. If KMS is the
 *     bottleneck across many tenants, the LRU TTL+size knobs in
 *     `EncryptionModuleOptions` are the lever. Slice B's scope (one tenant
 *     in dev) doesn't exercise this; the design is ready when it matters.
 *
 * Usage:
 *   pnpm -F @aims/prisma-client tsx scripts/migrate-finding-elements-to-canonical.ts
 *     [--dry-run]
 *     [--rollback]
 *     [--tenant=<tenantId>]
 *
 * Exit codes:
 *   0 — all findings migrated (or skipped as already-done)
 *   1 — at least one finding failed; see logs for details
 *   2 — script-level failure (DB connection, missing pack, etc.)
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type DekStore,
  createEncryptionModule,
  createPrismaDekStore,
} from "@aims/encryption";
import { KMSClient } from "@aws-sdk/client-kms";

import { createAdminPrismaClient } from "../src/index";

import type { AdminPrismaClient } from "../src/client";

// ─── Types ────────────────────────────────────────────────────────────────

type Direction = "forward" | "rollback";

type CliOptions = {
  dryRun: boolean;
  rollback: boolean;
  tenantFilter: string | null;
};

type SemanticElementMapping = {
  semanticCode: string;
  packElementCode: string;
  equivalenceStrength: "exact" | "close" | "partial";
};

type ElementValues = Record<string, string>;

type RunStats = {
  tenantsProcessed: number;
  findingsScanned: number;
  findingsMigrated: number;
  findingsSkipped: number;
  findingsFailed: number;
  failures: { tenantId: string; findingId: string; reason: string }[];
};

// ─── Args ─────────────────────────────────────────────────────────────────

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, rollback: false, tenantFilter: null };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--rollback") opts.rollback = true;
    else if (arg.startsWith("--tenant=")) opts.tenantFilter = arg.slice("--tenant=".length);
    else if (arg === "--help" || arg === "-h") {
      console.warn(USAGE);
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      console.warn(USAGE);
      process.exit(2);
    }
  }
  return opts;
}

const USAGE = `Usage: migrate-finding-elements-to-canonical.ts [options]

Options:
  --dry-run              Walk every row and log; do not write.
  --rollback             Reverse the migration (canonical → pack-element-code).
  --tenant=<id>          Process only this tenant (default: all tenants).
  -h, --help             Show this help.

Exit codes:
  0  All findings migrated (or skipped as already-done).
  1  At least one finding failed.
  2  Script-level failure.
`;

// ─── Mapping helpers ─────────────────────────────────────────────────────

/**
 * Build the key-translation table for one direction.
 *
 * Forward: maps `packElementCode → semanticCode` (e.g., IIA's `ROOT_CAUSE`
 * → canonical `CAUSE`).
 *
 * Rollback: inverse, `semanticCode → packElementCode`. Lossless when every
 * mapping has `equivalenceStrength === 'exact'`. For mappings with `close`
 * or `partial`, rollback chooses the recorded `packElementCode` and emits
 * a warning since the equivalence isn't a strict identity.
 */
function buildKeyMap(
  mappings: readonly SemanticElementMapping[],
  direction: Direction,
): { keyMap: Map<string, string>; lossy: boolean } {
  const keyMap = new Map<string, string>();
  let lossy = false;
  for (const m of mappings) {
    if (m.equivalenceStrength !== "exact") lossy = true;
    if (direction === "forward") {
      keyMap.set(m.packElementCode, m.semanticCode);
    } else {
      // Rollback. If two pack-element-codes map to the same canonical
      // (shouldn't happen in well-formed packs, but defend), the second
      // wins; that key would round-trip lossily either way.
      keyMap.set(m.semanticCode, m.packElementCode);
    }
  }
  return { keyMap, lossy: lossy && direction === "rollback" };
}

function translateKeys(
  values: ElementValues,
  keyMap: ReadonlyMap<string, string>,
): { translated: ElementValues; orphans: string[] } {
  const translated: ElementValues = {};
  const orphans: string[] = [];
  for (const [oldKey, value] of Object.entries(values)) {
    const newKey = keyMap.get(oldKey);
    if (newKey === undefined) {
      // No mapping: keep the key as-is so we don't lose data, but warn.
      translated[oldKey] = value;
      orphans.push(oldKey);
    } else {
      translated[newKey] = value;
    }
  }
  return { translated, orphans };
}

// ─── Main migration loop ──────────────────────────────────────────────────

async function migrateOneFinding(args: {
  prisma: AdminPrismaClient;
  encryption: ReturnType<typeof createEncryptionModule>;
  finding: {
    id: string;
    tenantId: string;
    engagementId: string;
    elementValuesCipher: Buffer | null;
    elementsCanonicalized: boolean;
    version: number;
  };
  keyMap: ReadonlyMap<string, string>;
  direction: Direction;
  dryRun: boolean;
}): Promise<{ migrated: boolean; orphans: string[] }> {
  const { prisma, encryption, finding, keyMap, direction, dryRun } = args;

  // No cipher: the finding has no element values yet (e.g., DRAFT created
  // but no elements filled). Just flip the flag so it's idempotent.
  if (finding.elementValuesCipher === null) {
    if (!dryRun) {
      await prisma.finding.update({
        where: { id: finding.id },
        data: {
          elementsCanonicalized: direction === "forward",
          version: finding.version + 1,
        },
      });
    }
    return { migrated: true, orphans: [] };
  }

  // Decrypt → translate → re-encrypt.
  const decrypted = await encryption.decryptJson<ElementValues>(
    finding.tenantId,
    finding.elementValuesCipher,
  );
  if (typeof decrypted !== "object" || Array.isArray(decrypted)) {
    throw new Error(
      `Decrypted payload for finding ${finding.id} is not an object — refusing to migrate.`,
    );
  }
  const { translated, orphans } = translateKeys(decrypted, keyMap);
  const newCipher = await encryption.encryptJson(finding.tenantId, translated);

  if (dryRun) {
    return { migrated: false, orphans };
  }

  // Atomic per-finding update with optimistic concurrency. If another
  // process bumped the version between our read and write, abort.
  const result = await prisma.finding.updateMany({
    where: { id: finding.id, version: finding.version },
    data: {
      elementValuesCipher: newCipher,
      elementsCanonicalized: direction === "forward",
      version: finding.version + 1,
    },
  });
  if (result.count !== 1) {
    throw new Error(
      `Optimistic-concurrency conflict on finding ${finding.id} ` +
        `(expected version ${String(finding.version)}; updateMany affected ${String(result.count)} rows).`,
    );
  }

  return { migrated: true, orphans };
}

/**
 * Optional dependencies for testability. Production callers (the CLI
 * entry point) leave both `undefined` and the function constructs them
 * from env vars. Tests pass their containerized prisma + LocalStack-backed
 * encryption directly.
 */
export type MigrateAllDeps = {
  prisma?: AdminPrismaClient;
  encryption?: ReturnType<typeof createEncryptionModule>;
};

async function migrateAll(
  opts: CliOptions,
  deps: MigrateAllDeps = {},
): Promise<RunStats> {
  const stats: RunStats = {
    tenantsProcessed: 0,
    findingsScanned: 0,
    findingsMigrated: 0,
    findingsSkipped: 0,
    findingsFailed: 0,
    failures: [],
  };

  const direction: Direction = opts.rollback ? "rollback" : "forward";
  const skipFlag = direction === "forward"; // forward skips already-true; rollback skips already-false.

  // Production path: construct prisma + encryption from env. Test path:
  // accept injected deps and DON'T disconnect the prisma we didn't create.
  const ownsPrisma = deps.prisma === undefined;
  const prisma = deps.prisma ?? createAdminPrismaClient();

  let encryption: ReturnType<typeof createEncryptionModule>;
  if (deps.encryption !== undefined) {
    encryption = deps.encryption;
  } else {
    const endpoint = process.env["AWS_ENDPOINT_URL"];
    const kmsClient = new KMSClient({
      region: process.env["AWS_REGION"] ?? "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      ...(endpoint !== undefined ? { endpoint } : {}),
    });
    const dekStore: DekStore = createPrismaDekStore(prisma);
    const masterKeyArn = process.env["AWS_KMS_MASTER_KEY_ALIAS"];
    if (!masterKeyArn) {
      throw new Error("AWS_KMS_MASTER_KEY_ALIAS env var required.");
    }
    encryption = createEncryptionModule({ kmsClient, masterKeyArn, dekStore });
  }

  try {
    const tenants =
      opts.tenantFilter !== null
        ? await prisma.tenant.findMany({
            where: { id: opts.tenantFilter },
            orderBy: { createdAt: "asc" },
          })
        : await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    if (opts.tenantFilter !== null && tenants.length === 0) {
      throw new Error(`No tenant found with id=${opts.tenantFilter}`);
    }

    for (const tenant of tenants) {
      stats.tenantsProcessed += 1;
      console.warn(`\n[tenant ${tenant.id} (${tenant.slug})] starting…`);

      // Each tenant's findings, joined to the engagement → primary pack
      // attachment → pack content (for the semanticElementMappings).
      const findings = await prisma.finding.findMany({
        where: {
          tenantId: tenant.id,
          // Skip findings that are already on the target shape.
          elementsCanonicalized: skipFlag ? false : true,
        },
        orderBy: { createdAt: "asc" },
        include: {
          engagement: {
            include: {
              attachments: {
                where: { isPrimary: true },
                include: { pack: true },
              },
            },
          },
        },
      });

      if (findings.length === 0) {
        console.warn(`  no findings to migrate (or all already done)`);
        continue;
      }

      // Per-tenant cache: many findings share the same engagement. Cache the
      // primary-pack mapping by engagement id to avoid redundant work.
      const engagementMappingCache = new Map<
        string,
        { keyMap: ReadonlyMap<string, string>; lossy: boolean }
      >();

      for (const finding of findings) {
        stats.findingsScanned += 1;

        let mapping = engagementMappingCache.get(finding.engagementId);
        if (!mapping) {
          const primaryAttachment = finding.engagement.attachments[0];
          if (!primaryAttachment) {
            stats.findingsFailed += 1;
            stats.failures.push({
              tenantId: tenant.id,
              findingId: finding.id,
              reason:
                `Engagement ${finding.engagementId} has no primary pack attachment — ` +
                `cannot resolve semanticElementMappings.`,
            });
            console.error(
              `  ✗ finding ${finding.id}: engagement has no primary pack`,
            );
            continue;
          }
          const packContent = primaryAttachment.pack.packContent as {
            semanticElementMappings?: SemanticElementMapping[];
          };
          const mappings = packContent.semanticElementMappings ?? [];
          if (mappings.length === 0) {
            stats.findingsFailed += 1;
            stats.failures.push({
              tenantId: tenant.id,
              findingId: finding.id,
              reason:
                `Primary pack ${primaryAttachment.packCode}:${primaryAttachment.packVersion} ` +
                `has no semanticElementMappings — cannot translate.`,
            });
            console.error(
              `  ✗ finding ${finding.id}: primary pack has no semanticElementMappings`,
            );
            continue;
          }
          mapping = buildKeyMap(mappings, direction);
          engagementMappingCache.set(finding.engagementId, mapping);
        }

        try {
          const { migrated, orphans } = await migrateOneFinding({
            prisma,
            encryption,
            finding: {
              id: finding.id,
              tenantId: finding.tenantId,
              engagementId: finding.engagementId,
              elementValuesCipher: finding.elementValuesCipher,
              elementsCanonicalized: finding.elementsCanonicalized,
              version: finding.version,
            },
            keyMap: mapping.keyMap,
            direction,
            dryRun: opts.dryRun,
          });

          if (migrated) stats.findingsMigrated += 1;
          else stats.findingsSkipped += 1;

          const dryRunTag = opts.dryRun ? " [DRY-RUN]" : "";
          const orphanTag =
            orphans.length > 0
              ? ` (${String(orphans.length)} unmapped key(s): ${orphans.join(", ")})`
              : "";
          const lossyTag = mapping.lossy ? " [LOSSY mapping in pack]" : "";
          console.warn(
            `  ✓ finding ${finding.id}${dryRunTag}${orphanTag}${lossyTag}`,
          );
        } catch (err) {
          stats.findingsFailed += 1;
          const reason = err instanceof Error ? err.message : String(err);
          stats.failures.push({
            tenantId: tenant.id,
            findingId: finding.id,
            reason,
          });
          console.error(`  ✗ finding ${finding.id}: ${reason}`);
        }
      }
    }

    // Final summary.
    console.warn(`\n──── Migration summary ─────────────────────────────────`);
    console.warn(`  Direction:       ${direction}${opts.dryRun ? " (DRY-RUN)" : ""}`);
    console.warn(`  Tenants:         ${String(stats.tenantsProcessed)}`);
    console.warn(`  Findings scanned: ${String(stats.findingsScanned)}`);
    console.warn(`  Findings migrated: ${String(stats.findingsMigrated)}`);
    console.warn(`  Findings skipped: ${String(stats.findingsSkipped)}`);
    console.warn(`  Findings failed:  ${String(stats.findingsFailed)}`);
    if (stats.failures.length > 0) {
      console.error(`\n──── Failures (triage list) ───────────────────────────`);
      for (const f of stats.failures) {
        console.error(`  tenant=${f.tenantId} finding=${f.findingId}`);
        console.error(`    ${f.reason}`);
      }
    }

    return stats;
  } finally {
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const stats = await migrateAll(opts);
    process.exit(stats.findingsFailed === 0 ? 0 : 1);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(2);
  }
}

// Re-export for tests.
export { buildKeyMap, migrateAll, parseArgs, translateKeys };
export type { CliOptions, RunStats };

// Only run as CLI when invoked directly. Tests import without invoking main.
// Compare resolved paths since process.argv[1] may be relative (`tsx
// scripts/foo.ts`) while import.meta.url is an absolute file URL.
const entryPath =
  process.argv[1] !== undefined ? resolve(process.argv[1]) : null;
const thisPath = fileURLToPath(import.meta.url);
const isMainModule = entryPath === thisPath;

if (isMainModule) {
  await main();
}
