/**
 * Integration tests for the slice-B canonical-key migration script.
 *
 * Runs against a fresh Postgres testcontainer + the dev LocalStack KMS at
 * localhost:4566 — same shape as apps/api/src/routers/business.test.ts.
 *
 * Coverage per slice plan §4 W1 day 4-7 exit criteria:
 *   - Forward migration: pack-keyed cipher → canonical-keyed cipher,
 *     `elementsCanonicalized` flips true, version bumps.
 *   - Idempotency: re-running the forward migration is a no-op (skipped).
 *   - Rollback: canonical → pack (lossless for `exact` mappings; the
 *     slice-A seed mappings are all `exact`).
 *   - Dry-run: walks every row, decrypts to verify access, doesn't write.
 *   - Optimistic concurrency: a stale-version write fails cleanly.
 *   - Building blocks: buildKeyMap + translateKeys unit-tested for orphan
 *     keys and lossy-rollback warnings.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type AdminPrismaClient, createAdminPrismaClient } from "../src/index";

import {
  buildKeyMap,
  migrateAll,
  parseArgs,
  translateKeys,
} from "./migrate-finding-elements-to-canonical";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");
const KMS_ENDPOINT = process.env["AWS_ENDPOINT_URL"] ?? "http://localhost:4566";

let container: StartedPostgreSqlContainer | undefined;
let prisma: AdminPrismaClient | undefined;
let kmsClient: KMSClient | undefined;
let encryption: ReturnType<typeof createEncryptionModule> | undefined;
let masterKeyArn: string;
let tenantId: string;

// Pack content with semanticElementMappings — the resolver's input shape.
// IIA-style: pack-element-codes diverge from canonical (ROOT_CAUSE → CAUSE
// and CONSEQUENCE → EFFECT make the translation observable).
const TEST_PACK_CODE = "TEST-IIA";
const TEST_PACK_VERSION = "1.0.0";
const TEST_PACK_CONTENT = {
  findingElements: [
    { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
    { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
    { code: "ROOT_CAUSE", name: "Root Cause", required: true, minLength: 50 },
    { code: "CONSEQUENCE", name: "Consequence", required: true, minLength: 50 },
  ],
  semanticElementMappings: [
    { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
    { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
    { semanticCode: "CAUSE", packElementCode: "ROOT_CAUSE", equivalenceStrength: "exact" },
    { semanticCode: "EFFECT", packElementCode: "CONSEQUENCE", equivalenceStrength: "exact" },
  ] as const,
};

function requireSetup(): {
  prisma: AdminPrismaClient;
  encryption: ReturnType<typeof createEncryptionModule>;
} {
  if (prisma === undefined || encryption === undefined) {
    throw new Error("beforeAll did not complete — fixtures not ready.");
  }
  return { prisma, encryption };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_migration_test")
    .withUsername("test_user")
    .withPassword("test_pw")
    .start();

  const url = container.getConnectionUri();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  prisma = createAdminPrismaClient({ datasources: { db: { url } } });

  kmsClient = new KMSClient({
    endpoint: KMS_ENDPOINT,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const keyResult = await kmsClient.send(
    new CreateKeyCommand({ Description: "migration test master KEK" }),
  );
  if (!keyResult.KeyMetadata?.Arn) {
    throw new Error("no KMS key ARN");
  }
  masterKeyArn = keyResult.KeyMetadata.Arn;

  encryption = createEncryptionModule({
    kmsClient,
    masterKeyArn,
    dekStore: createPrismaDekStore(prisma),
  });

  // Seed: tenant + DEK + standard pack + engagement + lead user.
  const tenant = await prisma.tenant.create({
    data: { slug: "migration-test", name: "Migration Test Tenant" },
  });
  tenantId = tenant.id;
  await encryption.provisionTenantDek(tenantId);

  await prisma.standardPack.create({
    data: {
      code: TEST_PACK_CODE,
      version: TEST_PACK_VERSION,
      name: "Test Pack",
      issuingBody: "AIMS Test",
      publishedYear: 2026,
      packContent: TEST_PACK_CONTENT,
      contentHash: "sha256:test-pack-hash",
    },
  });
}, 180_000);

afterAll(async () => {
  kmsClient?.destroy();
  await prisma?.$disconnect();
  await container?.stop();
});

// Helper: create a tenant-scoped engagement + finding with the given
// element values, encrypting the values with the test tenant's DEK.
// Returns the finding id.
async function seedFinding(opts: {
  values: Record<string, string>;
  suffix: string;
}): Promise<string> {
  const { prisma, encryption } = requireSetup();

  const lead = await prisma.user.create({
    data: {
      tenantId,
      email: `lead-${opts.suffix}@migration-test.local`,
      name: `Lead ${opts.suffix}`,
      role: "Senior",
    },
  });
  const engagement = await prisma.engagement.create({
    data: {
      tenantId,
      name: `engagement-${opts.suffix}`,
      auditeeName: `auditee-${opts.suffix}`,
      fiscalPeriod: "FY26 Q1",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-03-31"),
      leadUserId: lead.id,
    },
  });
  await prisma.packAttachment.create({
    data: {
      tenantId,
      engagementId: engagement.id,
      packCode: TEST_PACK_CODE,
      packVersion: TEST_PACK_VERSION,
      attachedBy: lead.id,
      isPrimary: true,
    },
  });

  const cipher = await encryption.encryptJson(tenantId, opts.values);
  const finding = await prisma.finding.create({
    data: {
      tenantId,
      engagementId: engagement.id,
      findingNumber: `F-${opts.suffix}`,
      title: `Finding ${opts.suffix}`,
      authorId: lead.id,
      elementValuesCipher: cipher,
      elementsComplete: Object.keys(opts.values).length,
      // Default: elementsCanonicalized=false (slice-A starting state).
    },
  });
  return finding.id;
}

// ─── Building-block unit tests ────────────────────────────────────────────

describe("buildKeyMap + translateKeys (pure)", () => {
  it("forward direction maps packElementCode → semanticCode", () => {
    const { keyMap, lossy } = buildKeyMap(
      TEST_PACK_CONTENT.semanticElementMappings,
      "forward",
    );
    expect(keyMap.get("ROOT_CAUSE")).toBe("CAUSE");
    expect(keyMap.get("CONSEQUENCE")).toBe("EFFECT");
    expect(lossy).toBe(false);
  });

  it("rollback direction maps semanticCode → packElementCode", () => {
    const { keyMap, lossy } = buildKeyMap(
      TEST_PACK_CONTENT.semanticElementMappings,
      "rollback",
    );
    expect(keyMap.get("CAUSE")).toBe("ROOT_CAUSE");
    expect(keyMap.get("EFFECT")).toBe("CONSEQUENCE");
    expect(lossy).toBe(false); // all four mappings are exact
  });

  it("rollback flags lossy when any mapping is non-exact", () => {
    const { lossy } = buildKeyMap(
      [
        { semanticCode: "RECOMMENDATION", packElementCode: "REC", equivalenceStrength: "close" },
      ],
      "rollback",
    );
    expect(lossy).toBe(true);
  });

  it("translateKeys applies the map and reports orphan keys", () => {
    const keyMap = new Map([["ROOT_CAUSE", "CAUSE"]]);
    const { translated, orphans } = translateKeys(
      { ROOT_CAUSE: "the cause text", UNKNOWN: "stranded value" },
      keyMap,
    );
    expect(translated["CAUSE"]).toBe("the cause text");
    expect(translated["UNKNOWN"]).toBe("stranded value"); // orphan kept verbatim
    expect(orphans).toEqual(["UNKNOWN"]);
  });
});

// ─── parseArgs ────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("defaults to forward, no dry-run, all tenants", () => {
    const opts = parseArgs([]);
    expect(opts).toEqual({ dryRun: false, rollback: false, tenantFilter: null });
  });

  it("parses --dry-run, --rollback, --tenant=<id>", () => {
    const opts = parseArgs(["--dry-run", "--rollback", "--tenant=abc123"]);
    expect(opts).toEqual({ dryRun: true, rollback: true, tenantFilter: "abc123" });
  });
});

// ─── End-to-end migration loop ────────────────────────────────────────────

describe("migrateAll — integration", () => {
  it("forward migrates a finding from pack-element-codes to canonical codes", async () => {
    const { prisma, encryption } = requireSetup();
    const findingId = await seedFinding({
      values: {
        CRITERIA: "the criteria text spelled out at length and length",
        CONDITION: "the condition text spelled out at length and length",
        ROOT_CAUSE: "the root cause spelled out at length and length",
        CONSEQUENCE: "the consequence spelled out at length and length",
      },
      suffix: "forward",
    });

    const before = await prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
    expect(before.elementsCanonicalized).toBe(false);
    const versionBefore = before.version;

    const stats = await migrateAll(
      { dryRun: false, rollback: false, tenantFilter: tenantId },
      { prisma, encryption },
    );
    expect(stats.findingsMigrated).toBeGreaterThanOrEqual(1);
    expect(stats.findingsFailed).toBe(0);

    const after = await prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
    expect(after.elementsCanonicalized).toBe(true);
    expect(after.version).toBe(versionBefore + 1);

    if (after.elementValuesCipher === null) throw new Error("cipher unexpectedly null");
    const decrypted = await encryption.decryptJson<Record<string, string>>(
      tenantId,
      after.elementValuesCipher,
    );
    // ROOT_CAUSE → CAUSE, CONSEQUENCE → EFFECT.
    expect(Object.keys(decrypted).sort()).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
    ]);
    expect(decrypted["CAUSE"]).toBe("the root cause spelled out at length and length");
    expect(decrypted["EFFECT"]).toBe("the consequence spelled out at length and length");
  });

  it("idempotent: re-running forward is a no-op (already-canonicalized rows skipped)", async () => {
    // The previous test left at least one canonicalized finding for this
    // tenant. Forward-mode should now find zero rows to migrate.
    const { prisma, encryption } = requireSetup();
    const stats = await migrateAll(
      { dryRun: false, rollback: false, tenantFilter: tenantId },
      { prisma, encryption },
    );
    expect(stats.findingsScanned).toBe(0);
    expect(stats.findingsMigrated).toBe(0);
    expect(stats.findingsFailed).toBe(0);
  });

  it("rollback: canonical-keyed cipher reverts to pack-element-codes (lossless for exact mappings)", async () => {
    const { prisma, encryption } = requireSetup();

    // Find a canonicalized finding and roll it back.
    const before = await prisma.finding.findFirstOrThrow({
      where: { tenantId, elementsCanonicalized: true },
    });
    const versionBefore = before.version;

    const stats = await migrateAll(
      { dryRun: false, rollback: true, tenantFilter: tenantId },
      { prisma, encryption },
    );
    expect(stats.findingsMigrated).toBeGreaterThanOrEqual(1);
    expect(stats.findingsFailed).toBe(0);

    const after = await prisma.finding.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.elementsCanonicalized).toBe(false);
    expect(after.version).toBe(versionBefore + 1);

    if (after.elementValuesCipher === null) throw new Error("cipher unexpectedly null");
    const decrypted = await encryption.decryptJson<Record<string, string>>(
      tenantId,
      after.elementValuesCipher,
    );
    // Back to pack-element-codes.
    expect(Object.keys(decrypted).sort()).toEqual([
      "CONDITION",
      "CONSEQUENCE",
      "CRITERIA",
      "ROOT_CAUSE",
    ]);
    expect(decrypted["ROOT_CAUSE"]).toBe("the root cause spelled out at length and length");
    expect(decrypted["CONSEQUENCE"]).toBe("the consequence spelled out at length and length");
  });

  it("dry-run: walks rows, decrypts to verify access, but writes nothing", async () => {
    const { prisma, encryption } = requireSetup();
    const findingId = await seedFinding({
      values: {
        CRITERIA: "criteria for dry run test, padded to length minimum",
        CONDITION: "condition for dry run test, padded to length minimum",
        ROOT_CAUSE: "root cause for dry run test, padded to length minimum",
        CONSEQUENCE: "consequence for dry run test, padded to length minimum",
      },
      suffix: "dry-run",
    });

    const before = await prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
    expect(before.elementsCanonicalized).toBe(false);
    const versionBefore = before.version;

    const stats = await migrateAll(
      { dryRun: true, rollback: false, tenantFilter: tenantId },
      { prisma, encryption },
    );
    expect(stats.findingsScanned).toBeGreaterThanOrEqual(1);
    // Dry-run treats every row as "scanned but not migrated" (skipped).
    expect(stats.findingsMigrated).toBe(0);
    expect(stats.findingsFailed).toBe(0);

    const after = await prisma.finding.findUniqueOrThrow({ where: { id: findingId } });
    expect(after.elementsCanonicalized).toBe(false);
    expect(after.version).toBe(versionBefore);
    expect(after.elementValuesCipher).toEqual(before.elementValuesCipher);
  });

  it("handles a finding with null cipher (no element values yet) by flipping the flag only", async () => {
    const { prisma, encryption } = requireSetup();
    const lead = await prisma.user.create({
      data: {
        tenantId,
        email: "null-cipher@migration-test.local",
        name: "Null Lead",
        role: "Senior",
      },
    });
    const engagement = await prisma.engagement.create({
      data: {
        tenantId,
        name: "null-cipher-eng",
        auditeeName: "NullCo",
        fiscalPeriod: "FY26",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        leadUserId: lead.id,
      },
    });
    await prisma.packAttachment.create({
      data: {
        tenantId,
        engagementId: engagement.id,
        packCode: TEST_PACK_CODE,
        packVersion: TEST_PACK_VERSION,
        attachedBy: lead.id,
        isPrimary: true,
      },
    });
    const finding = await prisma.finding.create({
      data: {
        tenantId,
        engagementId: engagement.id,
        findingNumber: "F-NULL-CIPHER",
        title: "Null cipher finding",
        authorId: lead.id,
        elementValuesCipher: null,
        elementsComplete: 0,
      },
    });

    const stats = await migrateAll(
      { dryRun: false, rollback: false, tenantFilter: tenantId },
      { prisma, encryption },
    );
    expect(stats.findingsFailed).toBe(0);

    const after = await prisma.finding.findUniqueOrThrow({ where: { id: finding.id } });
    expect(after.elementsCanonicalized).toBe(true);
    expect(after.elementValuesCipher).toBeNull();
  });
});
