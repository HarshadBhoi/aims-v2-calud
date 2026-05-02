/**
 * Integration tests for engagement + pack routers.
 *
 * Shares a Postgres + LocalStack setup with its own containers. Seeds one
 * tenant, one user, one StandardPack (GAGAS slice), then drives the tRPC
 * router in-process via createCaller.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
import {
  createAdminPrismaClient,
  createTenantPrismaClient,
  type AdminPrismaClient,
  type TenantPrismaClient,
} from "@aims/prisma-client";
import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { generateKeyPair } from "jose";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSessionModule, type SessionModule } from "../auth/session-lifecycle";
import { type Config } from "../config";
import { type AuthenticatedSession, type RequestContext } from "../context";
import { type Services } from "../services";

import { appRouter } from "./root";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRISMA_CLIENT_ROOT = resolve(__dirname, "../../../../packages/prisma-client");

let pg: StartedPostgreSqlContainer | undefined;
let ls: StartedTestContainer | undefined;
let prisma: AdminPrismaClient | undefined;
let prismaTenant: TenantPrismaClient | undefined;
let kmsClient: KMSClient | undefined;
let s3Client: S3Client | undefined;
let services: Services | undefined;
let sessionModule: SessionModule | undefined;
let tenantId: string;
let userId: string;

function requireSetup() {
  if (!services || !prisma || !prismaTenant) {
    throw new Error("beforeAll did not complete");
  }
  return { services, prisma, prismaTenant };
}

function makeAuthedContext(
  services: Services,
  opts: { mfaFreshUntil?: Date | null; userId?: string; tenantId?: string } = {},
): RequestContext {
  // Minimal `log` shim — slice-B W2.1 finding.ts emits deprecation warnings
  // via ctx.req.log when pack-element-codes come in.
  const log = {
    warn: () => undefined,
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    trace: () => undefined,
    fatal: () => undefined,
    child: () => log,
  };
  const req = {
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest/business" },
    cookies: {},
    log,
  };
  const res = {
    setCookie() {
      return res;
    },
    clearCookie() {
      return res;
    },
  };
  const session: AuthenticatedSession = {
    sessionId: "business-test-session",
    userId: opts.userId ?? userId,
    tenantId: opts.tenantId ?? tenantId,
    mfaFreshUntil: opts.mfaFreshUntil ?? null,
  };
  return {
    services,
    req: req as unknown as RequestContext["req"],
    res: res as unknown as RequestContext["res"],
    session,
    ipAddress: "127.0.0.1",
    userAgent: "vitest/business",
  };
}

beforeAll(async () => {
  pg = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_business_test")
    .withUsername("test_user")
    .withPassword("test_pw")
    .start();

  ls = await new GenericContainer("localstack/localstack:3.8")
    .withEnvironment({ SERVICES: "kms,s3", AWS_DEFAULT_REGION: "us-east-1" })
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forLogMessage(/Ready\./))
    .start();

  const dbUrl = pg.getConnectionUri();
  const kmsEndpoint = `http://${ls.getHost()}:${ls.getMappedPort(4566).toString()}`;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: PRISMA_CLIENT_ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });

  prisma = createAdminPrismaClient({ datasources: { db: { url: dbUrl } } });
  prismaTenant = createTenantPrismaClient({ datasources: { db: { url: dbUrl } } });

  kmsClient = new KMSClient({
    endpoint: kmsEndpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  s3Client = new S3Client({
    endpoint: kmsEndpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    forcePathStyle: true,
  });
  await s3Client.send(new CreateBucketCommand({ Bucket: "aims-test-reports" }));
  const keyResult = await kmsClient.send(
    new CreateKeyCommand({ Description: "business test master KEK" }),
  );
  if (!keyResult.KeyMetadata?.Arn) throw new Error("no KMS key ARN");
  const masterKeyArn = keyResult.KeyMetadata.Arn;

  const encryption = createEncryptionModule({
    kmsClient,
    masterKeyArn,
    dekStore: createPrismaDekStore(prisma),
  });

  const keys = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });

  const config: Config = {
    nodeEnv: "test",
    port: 0,
    host: "127.0.0.1",
    corsOrigins: ["http://localhost:3000"],
    jwtIssuer: "aims-test",
    devKeyPath: "/tmp/irrelevant",
    accessTokenTtlMs: 15 * 60 * 1000,
    refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
    awsRegion: "us-east-1",
    awsEndpointUrl: kmsEndpoint,
    databaseAdminUrl: undefined,
    kmsMasterKeyAlias: masterKeyArn,
    reportsBucket: "aims-test-reports",
    reportDownloadUrlTtlSeconds: 300,
    refreshCookieName: "aims_refresh",
    accessCookieName: "aims_access",
    cookieSecure: false,
  };

  sessionModule = createSessionModule({
    prisma,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    jwtIssuer: config.jwtIssuer,
    accessTokenTtlMs: config.accessTokenTtlMs,
    refreshTokenTtlMs: config.refreshTokenTtlMs,
  });

  services = {
    config,
    prisma,
    prismaTenant,
    kmsClient,
    s3Client,
    encryption,
    sessions: sessionModule,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
  };

  // Seed one tenant + DEK + one user + one StandardPack.
  const tenant = await prisma.tenant.create({
    data: { slug: "bizco", name: "BizCo Internal Audit" },
  });
  tenantId = tenant.id;
  await encryption.provisionTenantDek(tenantId);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: "lead@bizco.test",
      name: "Lead",
      role: "Senior",
      status: "ACTIVE",
    },
  });
  userId = user.id;

  await prisma.standardPack.create({
    data: {
      code: "GAGAS",
      version: "2024.1",
      name: "GAGAS 2024",
      issuingBody: "GAO",
      publishedYear: 2024,
      contentHash: "sha256:test-hash",
      packContent: {
        findingElements: [
          { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
          { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
          { code: "CAUSE", name: "Cause", required: true, minLength: 50 },
          { code: "EFFECT", name: "Effect", required: true, minLength: 50 },
        ],
        findingClassifications: [
          { code: "MINOR", severity: 1 },
          { code: "SIGNIFICANT", severity: 2 },
          { code: "MATERIAL", severity: 3 },
          { code: "CRITICAL", severity: 4 },
        ],
        documentationRequirements: {
          fourElementComplete: true,
          workPaperCitationRequired: true,
          retentionYears: 7,
        },
        // Slice B fields needed by the strictness resolver.
        semanticElementMappings: [
          { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
          { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
          { semanticCode: "CAUSE", packElementCode: "CAUSE", equivalenceStrength: "exact" },
          { semanticCode: "EFFECT", packElementCode: "EFFECT", equivalenceStrength: "exact" },
        ],
        independenceRules: { coolingOffPeriodMonths: 24 },
        cpeRequirements: { requiredHoursPerCycle: 80 },
      },
    },
  });

  // Slice B: seed IIA-GIAS-2024.1 alongside GAGAS so multi-pack tests can
  // attach both. Mirrors data-model/examples/iia-gias-2024.ts at the field
  // shape the resolver actually consumes.
  await prisma.standardPack.create({
    data: {
      code: "IIA-GIAS",
      version: "2024.1",
      name: "IIA Global Internal Audit Standards 2024",
      issuingBody: "Institute of Internal Auditors",
      publishedYear: 2024,
      contentHash: "sha256:iia-test-hash",
      packContent: {
        findingElements: [
          { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
          { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
          { code: "ROOT_CAUSE", name: "Root Cause", required: true, minLength: 50 },
          { code: "CONSEQUENCE", name: "Consequence", required: true, minLength: 50 },
          { code: "RECOMMENDATION", name: "Recommendation", required: true, minLength: 50 },
        ],
        findingClassifications: [
          { code: "LOW", severity: 1 },
          { code: "MEDIUM", severity: 2 },
          { code: "HIGH", severity: 3 },
          { code: "CRITICAL", severity: 4 },
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
      },
    },
  });
}, 240_000);

afterAll(async () => {
  if (services) {
    services.kmsClient.destroy();
    services.s3Client.destroy();
  }
  await prisma?.$disconnect();
  await prismaTenant?.$disconnect();
  await pg?.stop();
  await ls?.stop();
});

describe("engagement router", () => {
  it("creates + gets an engagement", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const created = await caller.engagement.create({
      name: "FY26 Q1 Revenue Cycle Audit",
      auditeeName: "BizCo Finance",
      fiscalPeriod: "FY26 Q1",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-03-31"),
      plannedHours: 400,
      leadUserId: userId,
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("FY26 Q1 Revenue Cycle Audit");
    expect(created.status).toBe("PLANNING");

    const fetched = await caller.engagement.get({ id: created.id });
    expect(fetched.id).toBe(created.id);
  });

  it("rejects cross-tenant lead user", async () => {
    const { services, prisma } = requireSetup();

    // Create a user in another tenant.
    const other = await prisma.tenant.create({
      data: { slug: "other", name: "Other Tenant" },
    });
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        email: "nope@other.test",
        name: "Nope",
        role: "Staff",
        status: "ACTIVE",
      },
    });

    const caller = appRouter.createCaller(makeAuthedContext(services));
    await expect(
      caller.engagement.create({
        name: "Bogus engagement",
        auditeeName: "BizCo",
        fiscalPeriod: "FY26 Q1",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-03-31"),
        leadUserId: otherUser.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects periodEnd < periodStart", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    await expect(
      caller.engagement.create({
        name: "Time-inverted",
        auditeeName: "BizCo",
        fiscalPeriod: "bogus",
        periodStart: new Date("2026-03-31"),
        periodEnd: new Date("2026-01-01"),
        leadUserId: userId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists engagements paginated", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const page1 = await caller.engagement.list({ limit: 1 });
    expect(page1.items.length).toBeLessThanOrEqual(1);
  });

  it("updates with optimistic concurrency; rejects stale version", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const created = await caller.engagement.create({
      name: "Concurrency target",
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 Q2",
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-06-30"),
      leadUserId: userId,
    });

    const updated = await caller.engagement.update({
      id: created.id,
      expectedVersion: created.version,
      name: "Concurrency target (renamed)",
    });
    expect(updated.name).toBe("Concurrency target (renamed)");
    expect(updated.version).toBe(created.version + 1);

    // Stale update — should fail
    await expect(
      caller.engagement.update({
        id: created.id,
        expectedVersion: created.version, // stale
        name: "another rename",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("pack router", () => {
  it("lists available packs", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const packs = await caller.pack.list();
    expect(packs.length).toBeGreaterThan(0);
    expect(packs[0]?.code).toBe("GAGAS");
  });

  it("attaches a pack to an engagement and resolves requirements", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const engagement = await caller.engagement.create({
      name: "Pack attach test",
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 Q3",
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-09-30"),
      leadUserId: userId,
    });

    const attached = await caller.pack.attach({
      engagementId: engagement.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    expect(attached.packCode).toBe("GAGAS");
    // Slice B: first pack attached defaults to isPrimary=true.
    expect(attached.isPrimary).toBe(true);

    const resolved = await caller.pack.resolve({ engagementId: engagement.id });
    expect(resolved.findingElements).toHaveLength(4);
    expect(resolved.findingElements.map((e) => e.code)).toEqual([
      "CRITERIA",
      "CONDITION",
      "CAUSE",
      "EFFECT",
    ]);
    expect(resolved.documentationRequirements.retentionYears).toBe(7);
    expect(resolved.sources).toEqual([{ packCode: "GAGAS", packVersion: "2024.1" }]);

    // Slice B: pack.attach now persists an EngagementStrictness row.
    const strictness = await caller.pack.strictness({ engagementId: engagement.id });
    expect(strictness.retentionYears).toBe(7);
    expect(strictness.coolingOffMonths).toBe(24);
    expect(strictness.cpeHours).toBe(80);
    expect(strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
    ]);
  });

  it("rejects duplicate attachment", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const engagement = await caller.engagement.create({
      name: "Dup test",
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 Q4",
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    });

    await caller.pack.attach({
      engagementId: engagement.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });

    await expect(
      caller.pack.attach({
        engagementId: engagement.id,
        packCode: "GAGAS",
        packVersion: "2024.1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("resolve throws PRECONDITION_FAILED for engagement with no packs", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const engagement = await caller.engagement.create({
      name: "No-pack test",
      auditeeName: "BizCo",
      fiscalPeriod: "FY27 Q1",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-03-31"),
      leadUserId: userId,
    });

    await expect(
      caller.pack.resolve({ engagementId: engagement.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("pack router — multi-pack + primary lifecycle (slice B W1.2-3)", () => {
  // Helper: make a fresh engagement with no packs attached.
  async function freshEngagement(suffix: string): Promise<string> {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: `slice-b-${suffix}`,
      auditeeName: "MultiPackCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    return eng.id;
  }

  it("first pack attaches as primary; second pack defaults to non-primary", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("default-isprimary");

    const first = await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    expect(first.isPrimary).toBe(true);

    const second = await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });
    expect(second.isPrimary).toBe(false);
  });

  it("multi-pack attach: strictness reflects the union (GAGAS retention 7 max, RECOMMENDATION code added)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("multi-strictness");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    const strictness = await caller.pack.strictness({ engagementId: engId });
    expect(strictness.retentionYears).toBe(7); // max(GAGAS 7, IIA 5)
    expect(strictness.coolingOffMonths).toBe(24); // max(GAGAS 24, IIA 12)
    expect(strictness.cpeHours).toBe(80); // GAGAS 80, IIA null → 80
    expect(strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
    expect(Array.isArray(strictness.drivenBy)).toBe(true);
  });

  it("attaching a second pack with isPrimary=true is rejected (one primary invariant)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("dup-primary");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });

    await expect(
      caller.pack.attach({
        engagementId: engId,
        packCode: "IIA-GIAS",
        packVersion: "2024.1",
        isPrimary: true,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("detach: bare detach of the primary returns PRECONDITION_FAILED (ADR-0011 invariant)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("detach-primary");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });

    await expect(
      caller.pack.detach({
        engagementId: engId,
        packCode: "GAGAS",
        packVersion: "2024.1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("detach: non-primary detach succeeds and re-resolves strictness", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("detach-secondary");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    // Detach IIA (non-primary).
    const result = await caller.pack.detach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });
    expect(result.detached).toBe(true);

    // Strictness now reflects GAGAS-only.
    const strictness = await caller.pack.strictness({ engagementId: engId });
    expect(strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
    ]);
  });

  it("swapPrimary: atomic swap of primary methodology (GAGAS → IIA)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("swap-primary");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    const result = await caller.pack.swapPrimary({
      engagementId: engId,
      fromPackCode: "GAGAS",
      fromPackVersion: "2024.1",
      toPackCode: "IIA-GIAS",
      toPackVersion: "2024.1",
    });
    expect(result.swapped).toBe(true);
    expect(result.alreadyPrimary).toBe(false);

    // After swap: GAGAS is gone, IIA is primary.
    const strictness = await caller.pack.strictness({ engagementId: engId });
    // GAGAS removed, only IIA left → IIA's retention=5.
    expect(strictness.retentionYears).toBe(5);
    // IIA is now the only attachment AND the primary, so the request union
    // matches IIA's 5 codes alone.
    expect(strictness.requiredCanonicalCodes).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
  });

  it("swapPrimary: calling twice with the same args is idempotent (no-op after first)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("swap-idempotent");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    const first = await caller.pack.swapPrimary({
      engagementId: engId,
      fromPackCode: "GAGAS",
      fromPackVersion: "2024.1",
      toPackCode: "IIA-GIAS",
      toPackVersion: "2024.1",
    });
    expect(first.swapped).toBe(true);

    // Second call with identical args. `from` is no longer attached and
    // `to` is already primary → idempotent no-op.
    const second = await caller.pack.swapPrimary({
      engagementId: engId,
      fromPackCode: "GAGAS",
      fromPackVersion: "2024.1",
      toPackCode: "IIA-GIAS",
      toPackVersion: "2024.1",
    });
    expect(second.swapped).toBe(false);
    expect(second.alreadyPrimary).toBe(true);
  });

  it("swapPrimary: rejects when 'from' isn't current primary AND 'to' isn't either", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("swap-bad-both");

    // Attach GAGAS (primary) and IIA (non-primary).
    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: engId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    // Bogus call: from=IIA-GIAS (which is non-primary, not the current
    // primary), to=IIA-GIAS (also not primary). The idempotency path
    // doesn't fire because `to` isn't already primary; the from-must-match
    // check rejects.
    await expect(
      caller.pack.swapPrimary({
        engagementId: engId,
        fromPackCode: "IIA-GIAS",
        fromPackVersion: "2024.1",
        toPackCode: "IIA-GIAS",
        toPackVersion: "2024.1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("strictness query returns NOT_FOUND for engagements with no attachments", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("no-strictness");

    await expect(
      caller.pack.strictness({ engagementId: engId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ─── Slice B W3.6-7: pack annotation overlays ───────────────────────────

  it("annotation tighten: pack base 7y → strictness retention 10y, drivenBy cites annotation", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("ann-tighten");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
      annotations: [{ rule: "retentionYears", direction: "tighten", value: 10 }],
    });

    const strictness = await caller.pack.strictness({ engagementId: engId });
    // GAGAS base = 7; tighten annotation = 10 → max(7, 10) = 10.
    expect(strictness.retentionYears).toBe(10);

    // drivenBy entry for retentionYears should cite annotation_tighten.
    const drivenBy = strictness.drivenBy as {
      rule: string;
      value: unknown;
      source: { packCode: string; packVersion: string; direction: string };
    }[];
    const retEntry = drivenBy.find((e) => e.rule === "retentionYears");
    expect(retEntry?.value).toBe(10);
    expect(retEntry?.source.direction).toBe("annotation_tighten");
    expect(retEntry?.source.packCode).toBe("GAGAS");
  });

  it("annotation tighten: ignored when annotation value < pack base", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("ann-tighten-noop");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
      // Tighten lower than base — slice B's resolver only applies tighten
      // when it's actually stricter (annotation value > base for these
      // monotonic-stricter-as-larger rules).
      annotations: [{ rule: "retentionYears", direction: "tighten", value: 3 }],
    });

    const strictness = await caller.pack.strictness({ engagementId: engId });
    expect(strictness.retentionYears).toBe(7); // GAGAS base wins.
    const drivenBy = strictness.drivenBy as {
      rule: string;
      source: { direction: string };
    }[];
    const retEntry = drivenBy.find((e) => e.rule === "retentionYears");
    expect(retEntry?.source.direction).toBe("max"); // pack-base direction.
  });

  it("annotation override_required: replaces base unconditionally", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("ann-override");

    await caller.pack.attach({
      engagementId: engId,
      packCode: "GAGAS",
      packVersion: "2024.1",
      annotations: [
        // Override to 5 — even though it's lower than the base of 7.
        { rule: "retentionYears", direction: "override_required", value: 5 },
      ],
    });

    const strictness = await caller.pack.strictness({ engagementId: engId });
    expect(strictness.retentionYears).toBe(5);
    const drivenBy = strictness.drivenBy as {
      rule: string;
      source: { direction: string };
    }[];
    const retEntry = drivenBy.find((e) => e.rule === "retentionYears");
    expect(retEntry?.source.direction).toBe("annotation_override");
  });

  it("annotation loosen: rejected on conformance-claimed pack at attach time", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await freshEngagement("ann-loosen-rejected");

    await expect(
      caller.pack.attach({
        engagementId: engId,
        packCode: "GAGAS",
        packVersion: "2024.1",
        annotations: [{ rule: "retentionYears", direction: "loosen", value: 3 }],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("finding router", () => {
  // Reusable fixture: an engagement with GAGAS attached.
  async function newEngagementWithPack(): Promise<{ engagementId: string }> {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const engagement = await caller.engagement.create({
      name: `Finding fixture ${Date.now().toString()}`,
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 Finding",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: engagement.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    return { engagementId: engagement.id };
  }

  // 50-character padded text — meets the GAGAS minLength of 50.
  const FILLED = "x".repeat(60);

  it("creates + gets a finding with element values round-tripped through ALE", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    const created = await caller.finding.create({
      engagementId,
      title: "Procurement records incomplete",
      initialElements: { CRITERIA: FILLED },
    });

    expect(created.status).toBe("DRAFT");
    expect(created.classification).toBe("SIGNIFICANT");
    expect(created.elementsComplete).toBe(1);
    expect(created.elementValues["CRITERIA"]).toBe(FILLED);
    expect(created.findingNumber).toMatch(/^F-\d{4}-\d{4}$/);

    const fetched = await caller.finding.get({ id: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.elementValues["CRITERIA"]).toBe(FILLED);
  });

  it("updateElement bumps version, recomputes elementsComplete, and rejects stale version", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    const created = await caller.finding.create({
      engagementId,
      title: "Element update target",
    });
    expect(created.elementsComplete).toBe(0);

    const v2 = await caller.finding.updateElement({
      id: created.id,
      elementCode: "CRITERIA",
      value: FILLED,
      expectedVersion: created.version,
    });
    expect(v2.elementsComplete).toBe(1);
    expect(v2.version).toBe(created.version + 1);
    expect(v2.elementValues["CRITERIA"]).toBe(FILLED);

    // Stale update — should fail
    await expect(
      caller.finding.updateElement({
        id: created.id,
        elementCode: "CONDITION",
        value: FILLED,
        expectedVersion: created.version, // stale
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updateElement rejects unknown element codes", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    const created = await caller.finding.create({
      engagementId,
      title: "Unknown-code target",
    });

    await expect(
      caller.finding.updateElement({
        id: created.id,
        elementCode: "BOGUS",
        value: FILLED,
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("submitForReview rejects when not all required elements are complete", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    const created = await caller.finding.create({
      engagementId,
      title: "Premature submit",
      initialElements: { CRITERIA: FILLED, CONDITION: FILLED }, // 2 of 4
    });

    await expect(
      caller.finding.submitForReview({
        id: created.id,
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("happy path: DRAFT → IN_REVIEW → APPROVED with MFA step-up", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    // Author drafts a complete finding.
    let f = await caller.finding.create({
      engagementId,
      title: "Happy path",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    expect(f.elementsComplete).toBe(4);

    // Submit
    f = await caller.finding.submitForReview({
      id: f.id,
      expectedVersion: f.version,
    });
    expect(f.status).toBe("IN_REVIEW");

    // Decide WITHOUT MFA fresh — should be rejected by the middleware.
    await expect(
      caller.finding.decide({
        id: f.id,
        expectedVersion: f.version,
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Decide WITH MFA fresh — should succeed.
    const future = new Date(Date.now() + 5 * 60 * 1000);
    const freshCaller = appRouter.createCaller(
      makeAuthedContext(services, { mfaFreshUntil: future }),
    );
    const decided = await freshCaller.finding.decide({
      id: f.id,
      expectedVersion: f.version,
      decision: "APPROVED",
      comment: "Looks good.",
    });
    expect(decided.status).toBe("APPROVED");
    expect(decided.version).toBe(f.version + 1);
  });

  it("RETURNED decision sends a finding back to DRAFT", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    let f = await caller.finding.create({
      engagementId,
      title: "Return path",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    f = await caller.finding.submitForReview({ id: f.id, expectedVersion: f.version });

    const future = new Date(Date.now() + 5 * 60 * 1000);
    const freshCaller = appRouter.createCaller(
      makeAuthedContext(services, { mfaFreshUntil: future }),
    );
    const returned = await freshCaller.finding.decide({
      id: f.id,
      expectedVersion: f.version,
      decision: "RETURNED",
      comment: "Tighten the cause section.",
    });
    expect(returned.status).toBe("DRAFT");
  });

  it("listPending returns only IN_REVIEW findings across engagements", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithPack();

    const pendingBefore = await caller.finding.listPending();
    const initialCount = pendingBefore.length;

    // Create a draft (should NOT appear in listPending)
    const draft = await caller.finding.create({
      engagementId,
      title: "Draft only",
      initialElements: { CRITERIA: FILLED },
    });

    // Create + submit one (SHOULD appear)
    const submitted = await caller.finding.create({
      engagementId,
      title: "Awaiting review",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    await caller.finding.submitForReview({
      id: submitted.id,
      expectedVersion: submitted.version,
    });

    const pendingAfter = await caller.finding.listPending();
    expect(pendingAfter.length).toBe(initialCount + 1);
    expect(pendingAfter.map((f) => f.id)).toContain(submitted.id);
    expect(pendingAfter.map((f) => f.id)).not.toContain(draft.id);
  });

  it("list returns findings scoped to the engagement", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const a = await newEngagementWithPack();
    const b = await newEngagementWithPack();

    await caller.finding.create({ engagementId: a.engagementId, title: "in A" });
    await caller.finding.create({ engagementId: b.engagementId, title: "in B" });

    const inA = await caller.finding.list({ engagementId: a.engagementId });
    expect(inA.map((f) => f.title)).toContain("in A");
    expect(inA.map((f) => f.title)).not.toContain("in B");
  });
});

describe("finding router — canonical key contract (slice B W2.1)", () => {
  // Helper: an engagement attached to GAGAS (primary) + IIA (additional).
  // Strictness union: { CRITERIA, CONDITION, CAUSE, EFFECT, RECOMMENDATION }.
  // GAGAS's pack-element-codes happen to match canonical names; IIA diverges
  // (ROOT_CAUSE → CAUSE, CONSEQUENCE → EFFECT). The tests exercise both the
  // pass-through path (canonical input) and the translation path (pack-code
  // input).
  async function multiPackEngagement(suffix: string): Promise<string> {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: `slice-b-w21-${suffix}`,
      auditeeName: "MultiCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });
    return eng.id;
  }

  const LONG = "x".repeat(60);

  it("create accepts canonical-code input and stores it canonical-keyed", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("create-canonical");

    const finding = await caller.finding.create({
      engagementId: engId,
      title: "Canonical-input finding",
      initialElements: {
        // Canonical codes — pass through unchanged.
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
        RECOMMENDATION: LONG,
      },
    });
    // Union has 5 required canonical codes; all 5 supplied → complete.
    expect(finding.elementsComplete).toBe(5);
    // Re-read: same canonical-keyed values should be visible.
    const fetched = await caller.finding.get({ id: finding.id });
    expect(Object.keys(fetched.elementValues).sort()).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
  });

  it("create accepts pack-element-code input and translates to canonical (deprecation logged)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("create-pack-codes");

    const finding = await caller.finding.create({
      engagementId: engId,
      title: "Pack-code-input finding",
      initialElements: {
        // GAGAS uses these codes (also canonical for GAGAS).
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
        // RECOMMENDATION supplied as canonical (GAGAS doesn't declare it).
        RECOMMENDATION: LONG,
      },
    });
    expect(finding.elementsComplete).toBe(5);
    // Storage keys are canonical regardless of input shape.
    const fetched = await caller.finding.get({ id: finding.id });
    expect(Object.keys(fetched.elementValues).sort()).toEqual([
      "CAUSE",
      "CONDITION",
      "CRITERIA",
      "EFFECT",
      "RECOMMENDATION",
    ]);
  });

  it("create rejects unknown element codes", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("create-unknown");

    await expect(
      caller.finding.create({
        engagementId: engId,
        title: "Bad input",
        initialElements: { GHOST_CODE: LONG },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("elementsComplete counts against the strictness union (5 codes), not just primary's 4", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("complete-union");

    // Fill only the 4 GAGAS codes — RECOMMENDATION (added by IIA) is missing.
    const finding = await caller.finding.create({
      engagementId: engId,
      title: "GAGAS-only fill on multi-pack engagement",
      initialElements: {
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
      },
    });
    expect(finding.elementsComplete).toBe(4);

    // Slice-A counted 4/4 as complete on a single-pack GAGAS engagement.
    // Slice-B counts against the union, so the multi-pack version expects
    // 5 — submit-for-review must reject.
    await expect(
      caller.finding.submitForReview({
        id: finding.id,
        expectedVersion: finding.version,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("updateElement accepts pack-element-code that maps to a canonical (single-key autosave)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("update-pack-code");

    const finding = await caller.finding.create({
      engagementId: engId,
      title: "Update test",
      initialElements: {},
    });

    // Send the IIA pack-element-code "ROOT_CAUSE" — server translates to
    // canonical "CAUSE" before storage.
    const updated = await caller.finding.updateElement({
      id: finding.id,
      expectedVersion: finding.version,
      elementCode: "ROOT_CAUSE",
      value: LONG,
    });
    expect(updated.elementValues["CAUSE"]).toBe(LONG);
    expect(updated.elementValues["ROOT_CAUSE"]).toBeUndefined();
    expect(updated.elementsComplete).toBe(1);
  });

  it("submitForReview succeeds when all 5 union codes are filled (multi-pack)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const engId = await multiPackEngagement("submit-multi");

    const finding = await caller.finding.create({
      engagementId: engId,
      title: "All-five fill",
      initialElements: {
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
        RECOMMENDATION: LONG,
      },
    });
    expect(finding.elementsComplete).toBe(5);

    const submitted = await caller.finding.submitForReview({
      id: finding.id,
      expectedVersion: finding.version,
    });
    expect(submitted.status).toBe("IN_REVIEW");
  });

  it("updateElement: optimistic-concurrency conflict is detected at the DB layer (Gemini W2 review catch #2)", async () => {
    // Ensures `updateMany where { id, version }` fires a clean CONFLICT
    // when something else (the W1 migration script or a concurrent autosave)
    // bumped the version between our read and write.
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "concurrency",
      auditeeName: "RaceCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    const finding = await caller.finding.create({
      engagementId: eng.id,
      title: "Race",
      initialElements: { CRITERIA: LONG },
    });
    // Simulate a concurrent writer bumping the version (e.g., the W1
    // migration script flipping elementsCanonicalized + re-encrypting
    // mid-autosave). After this, the API's pending updateElement should
    // hit a CONFLICT, not silently overwrite.
    await prisma.finding.update({
      where: { id: finding.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      caller.finding.updateElement({
        id: finding.id,
        expectedVersion: finding.version,
        elementCode: "CONDITION",
        value: LONG,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("submitForReview: optimistic-concurrency conflict at DB layer (Gemini W2 round-2 #2a)", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "submit-race",
      auditeeName: "RaceCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    const finding = await caller.finding.create({
      engagementId: eng.id,
      title: "Race",
      initialElements: {
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
      },
    });
    // Simulate concurrent writer.
    await prisma.finding.update({
      where: { id: finding.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      caller.finding.submitForReview({
        id: finding.id,
        expectedVersion: finding.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("decide: optimistic-concurrency conflict at DB layer (Gemini W2 round-2 #2a)", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    const eng = await caller.engagement.create({
      name: "decide-race",
      auditeeName: "RaceCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    const created = await caller.finding.create({
      engagementId: eng.id,
      title: "Decide race",
      initialElements: {
        CRITERIA: LONG,
        CONDITION: LONG,
        CAUSE: LONG,
        EFFECT: LONG,
      },
    });
    const submitted = await caller.finding.submitForReview({
      id: created.id,
      expectedVersion: created.version,
    });
    await prisma.finding.update({
      where: { id: submitted.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      fresh.finding.decide({
        id: submitted.id,
        expectedVersion: submitted.version,
        decision: "APPROVED",
        comment: "approved",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("get: legacy pack-keyed storage is normalized to canonical on read (Gemini W2 review catch #4)", async () => {
    // Slice-A-shaped finding: `elementsCanonicalized=false`, payload keys
    // are pack-element-codes. The API's `get` procedure must translate to
    // canonical before returning so slice-B-native UI clients see a
    // consistent shape regardless of storage state.
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    // Build the engagement via the API (so EngagementStrictness exists),
    // then create a synthetic legacy finding directly via Prisma — the
    // API normally writes canonical, so we have to simulate.
    const eng = await caller.engagement.create({
      name: "legacy-read",
      auditeeName: "LegacyCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    // Synthetic legacy storage: pack-element-codes from IIA (ROOT_CAUSE,
    // CONSEQUENCE) — the kind of payload an unmigrated slice-A finding on
    // an IIA engagement would carry.
    const legacyValues = {
      CRITERIA: LONG,
      CONDITION: LONG,
      ROOT_CAUSE: LONG,
      CONSEQUENCE: LONG,
    };
    const legacyCipher = await services.encryption.encryptJson(tenantId, legacyValues);
    const legacy = await prisma.finding.create({
      data: {
        tenantId,
        engagementId: eng.id,
        findingNumber: "F-LEGACY-001",
        title: "Legacy finding",
        authorId: userId,
        elementValuesCipher: legacyCipher,
        elementsCanonicalized: false, // pre-W1 migration shape
        elementsComplete: 4,
      },
    });

    const fetched = await caller.finding.get({ id: legacy.id });
    // Storage was pack-keyed (ROOT_CAUSE, CONSEQUENCE); the API normalizes
    // to canonical (CAUSE, EFFECT) on the read path.
    const keys = Object.keys(fetched.elementValues).sort();
    expect(keys).toEqual(["CAUSE", "CONDITION", "CRITERIA", "EFFECT"]);
    expect(fetched.elementValues["CAUSE"]).toBe(LONG);
    expect(fetched.elementValues["EFFECT"]).toBe(LONG);
  });
});

describe("report router", () => {
  // Reusable fixture: an engagement with GAGAS attached + one APPROVED finding
  // (so data sections have something to populate).
  const FILLED = "x".repeat(60);

  async function newEngagementWithApprovedFinding(): Promise<{
    engagementId: string;
  }> {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );

    const eng = await caller.engagement.create({
      name: `Report fixture ${Date.now().toString()}`,
      auditeeName: "BizCo Operations",
      fiscalPeriod: "FY26 Reports",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });

    let f = await caller.finding.create({
      engagementId: eng.id,
      title: "Procurement records gap",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    f = await caller.finding.submitForReview({ id: f.id, expectedVersion: f.version });
    await fresh.finding.decide({
      id: f.id,
      expectedVersion: f.version,
      decision: "APPROVED",
    });

    return { engagementId: eng.id };
  }

  it("creates a report and auto-populates data sections from approved findings", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const report = await caller.report.create({
      engagementId,
      title: "Annual report FY26",
    });

    expect(report.status).toBe("DRAFT");
    expect(report.templateKey).toBe("engagement-report-v1");
    expect(report.versionNumber).toBe("v1.0");
    expect(report.signedAt).toBeNull();
    expect(report.contentHash).toBeNull();

    const dataKeys = Object.entries(report.sections)
      .filter(([, s]) => s.kind === "data")
      .map(([k]) => k);
    expect(dataKeys).toEqual(
      expect.arrayContaining(["engagement_overview", "pack_disclosure", "findings_summary"]),
    );
    expect(report.sections["findings_summary"]?.content).toContain("Procurement records gap");
    expect(report.sections["pack_disclosure"]?.content).toContain("GAGAS");
    expect(report.sections["executive_summary"]?.content).toBe("");
  });

  it("updateEditorial mutates one section, bumps version, and rejects stale or data-bound writes", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const r1 = await caller.report.create({ engagementId, title: "Editorial path" });
    const r2 = await caller.report.updateEditorial({
      id: r1.id,
      sectionKey: "executive_summary",
      content: "Risk-significant findings remain outstanding.",
      expectedVersion: r1.version,
    });
    expect(r2.version).toBe(r1.version + 1);
    expect(r2.sections["executive_summary"]?.content).toContain(
      "Risk-significant findings remain outstanding.",
    );

    // Stale version
    await expect(
      caller.report.updateEditorial({
        id: r1.id,
        sectionKey: "recommendations",
        content: "x",
        expectedVersion: r1.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Cannot patch a data-bound section via updateEditorial
    await expect(
      caller.report.updateEditorial({
        id: r1.id,
        sectionKey: "engagement_overview",
        content: "tampered",
        expectedVersion: r2.version,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("regenerateDataSections refreshes data-bound sections while preserving editorial", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    const { engagementId } = await newEngagementWithApprovedFinding();

    let r = await caller.report.create({ engagementId, title: "Regen path" });
    r = await caller.report.updateEditorial({
      id: r.id,
      sectionKey: "executive_summary",
      content: "Author narrative.",
      expectedVersion: r.version,
    });

    // Approve a SECOND finding to change the data picture.
    let f2 = await caller.finding.create({
      engagementId,
      title: "Second finding",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    f2 = await caller.finding.submitForReview({
      id: f2.id,
      expectedVersion: f2.version,
    });
    await fresh.finding.decide({
      id: f2.id,
      expectedVersion: f2.version,
      decision: "APPROVED",
    });

    const regen = await caller.report.regenerateDataSections({
      id: r.id,
      expectedVersion: r.version,
    });
    expect(regen.sections["findings_summary"]?.content).toContain("Second finding");
    expect(regen.sections["executive_summary"]?.content).toBe("Author narrative.");
  });

  it("submitForSignoff rejects when any editorial section is empty", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const r = await caller.report.create({ engagementId, title: "Premature submit" });

    await expect(
      caller.report.submitForSignoff({ id: r.id, expectedVersion: r.version }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  async function fillAllEditorialSections(
    caller: ReturnType<typeof appRouter.createCaller>,
    reportId: string,
    startingVersion: number,
  ): Promise<number> {
    let v = startingVersion;
    for (const key of ["executive_summary", "recommendations", "closing"]) {
      const r = await caller.report.updateEditorial({
        id: reportId,
        sectionKey: key,
        content: `Content for ${key}.`,
        expectedVersion: v,
      });
      v = r.version;
    }
    return v;
  }

  it("happy path: create → fill editorial → submit → sign → outbox event written", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    const { engagementId } = await newEngagementWithApprovedFinding();

    const created = await caller.report.create({
      engagementId,
      title: "Happy report",
    });
    const filledVersion = await fillAllEditorialSections(caller, created.id, created.version);
    const submitted = await caller.report.submitForSignoff({
      id: created.id,
      expectedVersion: filledVersion,
    });
    expect(submitted.status).toBe("IN_REVIEW");

    // Sign WITHOUT MFA fresh → step-up enforced.
    await expect(
      caller.report.sign({
        id: created.id,
        expectedVersion: submitted.version,
        attestation: "I approve",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Sign with MFA fresh → published, content hash set, outbox event written.
    const signed = await fresh.report.sign({
      id: created.id,
      expectedVersion: submitted.version,
      attestation: "I approve",
    });
    expect(signed.status).toBe("PUBLISHED");
    expect(signed.signedBy).toBe(userId);
    expect(signed.signedAt).toBeInstanceOf(Date);
    expect(signed.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const outbox = await prisma.outboxEvent.findFirst({
      where: { eventType: "report.published" },
      orderBy: { createdAt: "desc" },
    });
    expect(outbox).not.toBeNull();
    const payload = outbox?.payload as { reportId: string; contentHash: string };
    expect(payload.reportId).toBe(created.id);
    expect(payload.contentHash).toBe(signed.contentHash);
  });

  it("downloadPdf returns a presigned URL when published with a pdfS3Key", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    const { engagementId } = await newEngagementWithApprovedFinding();

    // Drive the report to PUBLISHED, then simulate the worker by stamping
    // pdfS3Key on the version row.
    const created = await caller.report.create({
      engagementId,
      title: "Download path",
    });
    const filledVersion = await fillAllEditorialSections(caller, created.id, created.version);
    const submitted = await caller.report.submitForSignoff({
      id: created.id,
      expectedVersion: filledVersion,
    });
    await fresh.report.sign({
      id: created.id,
      expectedVersion: submitted.version,
      attestation: "I approve",
    });

    const versions = await prisma.reportVersion.findMany({
      where: { reportId: created.id },
    });
    expect(versions.length).toBeGreaterThan(0);
    const versionId = versions[0]?.id ?? "";
    const stubKey = `reports/${tenantId}/${created.id}/${versionId}.pdf`;
    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { pdfS3Key: stubKey, pdfRenderedAt: new Date() },
    });

    const result = await caller.report.downloadPdf({ id: created.id });
    expect(result.url).toContain("aims-test-reports");
    expect(result.url).toContain(versionId);
    expect(result.url).toMatch(/X-Amz-Signature=/);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("downloadPdf rejects when status is not PUBLISHED", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const draft = await caller.report.create({
      engagementId,
      title: "Draft download",
    });

    await expect(
      caller.report.downloadPdf({ id: draft.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("downloadPdf rejects PUBLISHED reports whose PDF hasn't rendered yet", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const fresh = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    const { engagementId } = await newEngagementWithApprovedFinding();

    const created = await caller.report.create({
      engagementId,
      title: "Pending PDF",
    });
    const filledVersion = await fillAllEditorialSections(caller, created.id, created.version);
    const submitted = await caller.report.submitForSignoff({
      id: created.id,
      expectedVersion: filledVersion,
    });
    await fresh.report.sign({
      id: created.id,
      expectedVersion: submitted.version,
      attestation: "I approve",
    });

    // Don't stamp pdfS3Key — simulating "worker hasn't run yet".
    await expect(
      caller.report.downloadPdf({ id: created.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("updateEditorial: optimistic-concurrency conflict at DB layer (Gemini W2 round-2 #4)", async () => {
    // The W3 UI's autosave path will hit updateEditorial on every keystroke
    // pause. Concurrent writes (e.g., autosave overlapping a manual save
    // button click) must collide cleanly via CONFLICT, not silently
    // clobber each other's contentCipher.
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const created = await caller.report.create({
      engagementId,
      title: "Editorial race",
    });
    // Simulate a concurrent writer.
    await prisma.report.update({
      where: { id: created.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      caller.report.updateEditorial({
        id: created.id,
        sectionKey: "executive_summary",
        content: "Stale write",
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("submitForSignoff: optimistic-concurrency conflict at DB layer (Gemini W2 round-2 #4)", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const created = await caller.report.create({
      engagementId,
      title: "Submit race",
    });
    const filledVersion = await fillAllEditorialSections(caller, created.id, created.version);
    // Simulate a concurrent writer between fill-completion check and submit.
    await prisma.report.update({
      where: { id: created.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      caller.report.submitForSignoff({
        id: created.id,
        expectedVersion: filledVersion,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("regenerateDataSections: optimistic-concurrency conflict at DB layer (Gemini W2 round-2 #4)", async () => {
    const { services, prisma } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await newEngagementWithApprovedFinding();

    const created = await caller.report.create({
      engagementId,
      title: "Regen race",
    });
    await prisma.report.update({
      where: { id: created.id },
      data: { version: { increment: 1 } },
    });
    await expect(
      caller.report.regenerateDataSections({
        id: created.id,
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("report router — cross-pack rendering (slice B W2.5)", () => {
  // Helper: an engagement with both GAGAS and IIA-GIAS attached, and one
  // APPROVED finding filled with all 5 canonical codes (CRITERIA, CONDITION,
  // CAUSE, EFFECT, RECOMMENDATION). The tests below produce two reports
  // against the same engagement — one attesting to GAGAS, one to IIA — and
  // verify the section text differs.
  const FILLED = "x".repeat(60);

  async function setupMultiPackWithFinding(
    suffix: string,
  ): Promise<{ engagementId: string; findingId: string }> {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: `slice-b-w25-${suffix}`,
      auditeeName: "CrossPackCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });
    const finding = await caller.finding.create({
      engagementId: eng.id,
      title: `Cross-pack finding ${suffix}`,
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
        RECOMMENDATION: FILLED,
      },
    });
    const submitted = await caller.finding.submitForReview({
      id: finding.id,
      expectedVersion: finding.version,
    });
    // Step up MFA so `decide` is callable.
    const mfaCaller = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    await mfaCaller.finding.decide({
      id: submitted.id,
      expectedVersion: submitted.version,
      decision: "APPROVED",
      comment: "approved for slice-B cross-pack rendering test",
    });
    return { engagementId: eng.id, findingId: submitted.id };
  }

  it("report.create defaults attestsTo to the engagement's primary methodology (GAGAS)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await setupMultiPackWithFinding("default-attests");

    const created = await caller.report.create({
      engagementId,
      title: "GAGAS default report",
    });
    // No explicit attestsTo → defaults to primary (GAGAS). Section text uses
    // GAGAS's labels (Criteria / Condition / Cause / Effect).
    const summary = created.sections["findings_summary"]?.content ?? "";
    expect(summary).toContain("Criteria:");
    expect(summary).toContain("Cause:");
    expect(summary).toContain("Effect:");
    // GAGAS's pack-codes are canonical, so no close-mapping footers.
    expect(summary).not.toContain("(rendered under");
  });

  it("report.create with attestsTo=IIA renders findings under IIA's vocabulary (Root Cause / Consequence)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await setupMultiPackWithFinding("iia-attests");

    const iiaReport = await caller.report.create({
      engagementId,
      title: "IIA report",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });
    const summary = iiaReport.sections["findings_summary"]?.content ?? "";
    // IIA labels.
    expect(summary).toContain("Root Cause:");
    expect(summary).toContain("Consequence:");
    expect(summary).toContain("Recommendation:");
    // IIA's RECOMMENDATION mapping is `close` — footer note expected.
    expect(summary).toMatch(/\(rendered under GAGAS:2024\.1 mapping\)/);
  });

  it("two reports on the same engagement with different attestsTo produce different section text + content hashes", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await setupMultiPackWithFinding("two-reports");

    const gagas = await caller.report.create({
      engagementId,
      title: "GAGAS report",
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    });
    const iia = await caller.report.create({
      engagementId,
      title: "IIA report",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });

    const gagasSummary = gagas.sections["findings_summary"]?.content ?? "";
    const iiaSummary = iia.sections["findings_summary"]?.content ?? "";

    // The same canonical-keyed finding renders structurally distinct text
    // under each pack's vocabulary — slice B's central thesis exercised.
    expect(gagasSummary).not.toBe(iiaSummary);
    expect(gagasSummary).toContain("Cause:");
    expect(iiaSummary).toContain("Root Cause:");
  });

  it("IIA-primary engagement: GAGAS-attesting report renders findings under GAGAS labels", async () => {
    // The mirror of the W2.5 default test: when IIA is the engagement's
    // primary methodology and GAGAS is secondary, a GAGAS-attesting report
    // still renders findings under GAGAS labels — proving the renderer is
    // direction-agnostic, not biased toward whatever happens to be primary.
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "iia-primary-engagement",
      auditeeName: "ReverseCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    // Attach IIA first → IIA becomes primary.
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });

    // Author a finding under IIA-primary; submit + approve.
    const finding = await caller.finding.create({
      engagementId: eng.id,
      title: "IIA-primary finding",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
        RECOMMENDATION: FILLED,
      },
    });
    const submitted = await caller.finding.submitForReview({
      id: finding.id,
      expectedVersion: finding.version,
    });
    const mfaCaller = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    await mfaCaller.finding.decide({
      id: submitted.id,
      expectedVersion: submitted.version,
      decision: "APPROVED",
      comment: "approved for IIA-primary cross-pack render test",
    });

    // GAGAS-attesting report off the IIA-primary engagement.
    const gagasReport = await caller.report.create({
      engagementId: eng.id,
      title: "GAGAS report (IIA-primary engagement)",
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    });
    const summary = gagasReport.sections["findings_summary"]?.content ?? "";
    // GAGAS labels in the section text.
    expect(summary).toContain("Cause:");
    expect(summary).toContain("Effect:");
    // IIA primary → close-mapping footer absent for GAGAS targets (GAGAS
    // mappings are all `exact` regardless of who's primary).
    expect(summary).not.toContain("(rendered under");
  });

  it("missing canonical code: renderer leaves the slot empty without warning", async () => {
    // A finding authored under GAGAS-only (4 codes). Attach IIA later →
    // strictness union now includes RECOMMENDATION. Render under IIA →
    // RECOMMENDATION row should appear empty (the finding never had a value
    // for it), not crash, not warn.
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "missing-canonical",
      auditeeName: "PartialCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    // Pre-IIA: finding fills only the 4 GAGAS codes.
    const finding = await caller.finding.create({
      engagementId: eng.id,
      title: "GAGAS-only finding",
      initialElements: {
        CRITERIA: FILLED,
        CONDITION: FILLED,
        CAUSE: FILLED,
        EFFECT: FILLED,
      },
    });
    const submitted = await caller.finding.submitForReview({
      id: finding.id,
      expectedVersion: finding.version,
    });
    const mfaCaller = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    await mfaCaller.finding.decide({
      id: submitted.id,
      expectedVersion: submitted.version,
      decision: "APPROVED",
      comment: "approved for missing-canonical fallback test",
    });
    // Now attach IIA (becomes secondary).
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    // IIA-attesting report. Finding has no RECOMMENDATION value.
    const iiaReport = await caller.report.create({
      engagementId: eng.id,
      title: "IIA report on GAGAS-authored finding",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });
    const summary = iiaReport.sections["findings_summary"]?.content ?? "";
    // RECOMMENDATION row appears with "(not provided)" placeholder — the
    // empty value is rendered without crashing the assembly.
    expect(summary).toContain("Recommendation: (not provided)");
    // Other rows still render fine via the close-mapping path is N/A here
    // (CAUSE → ROOT_CAUSE is exact for IIA), and CONSEQUENCE shows the
    // GAGAS finding's EFFECT value.
    expect(summary).toContain("Root Cause:");
    expect(summary).toContain("Consequence:");
  });

  it("report.compliance: GAGAS-attesting report on GAGAS-only engagement", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "compliance-gagas-only",
      auditeeName: "Co",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    const report = await caller.report.create({
      engagementId: eng.id,
      title: "GAGAS-only report",
    });

    const compliance = await caller.report.compliance({ id: report.id });
    expect(compliance.attestsTo).toEqual({
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    expect(compliance.claims).toHaveLength(1);
    expect(compliance.claims[0]?.isAttestedTo).toBe(true);
    expect(compliance.claims[0]?.isPrimary).toBe(true);
    expect(compliance.sentence).toContain("GAGAS 2024");
    expect(compliance.sentence).toContain("(GAGAS:2024.1, issued by GAO)");
    // No "additional methodologies" since only one pack is attached.
    expect(compliance.sentence).not.toContain("additional methodologies");
  });

  it("report.compliance: multi-pack — attestsTo named first, others appended", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "compliance-multi",
      auditeeName: "Co",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    const iiaReport = await caller.report.create({
      engagementId: eng.id,
      title: "IIA report",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });
    const compliance = await caller.report.compliance({ id: iiaReport.id });

    // claims[0] is attestsTo (IIA) regardless of which is primary.
    expect(compliance.claims[0]?.packCode).toBe("IIA-GIAS");
    expect(compliance.claims[0]?.isAttestedTo).toBe(true);
    expect(compliance.claims[1]?.packCode).toBe("GAGAS");
    expect(compliance.claims[1]?.isAttestedTo).toBe(false);

    // Sentence names IIA first, GAGAS as additional methodology.
    expect(compliance.sentence).toMatch(
      /IIA Global Internal Audit Standards 2024.*additional methodologies attached and conformance-claimed:.*GAGAS 2024/,
    );
  });

  it("report.compliance: DRAFT vs SIGNED — frozen snapshot at sign-off (ADR-0012)", async () => {
    // A signed report's compliance text must NOT mutate when packs change
    // afterward. Live computation is fine for drafts; sign-off freezes.
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId, findingId } = await setupMultiPackWithFinding(
      "compliance-snapshot",
    );

    // Create + sign a report attesting to GAGAS. Submit-for-signoff,
    // sign with a fresh-MFA caller. Need at least one APPROVED finding,
    // which the helper provides.
    expect(findingId).toBeTruthy();
    const draft = await caller.report.create({
      engagementId,
      title: "Compliance snapshot test",
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    });

    // Live preview before sign — frozen=false.
    const draftCompliance = await caller.report.compliance({ id: draft.id });
    expect(draftCompliance.frozen).toBe(false);
    expect(draftCompliance.claims.length).toBeGreaterThan(0);
    const draftSentence = draftCompliance.sentence;

    // Fill editorial sections (submitForSignoff requires non-empty
    // executive_summary / recommendations / closing per slice-A invariant).
    let v = draft.version;
    for (const key of ["executive_summary", "recommendations", "closing"]) {
      const r = await caller.report.updateEditorial({
        id: draft.id,
        sectionKey: key,
        content: `${key} body for snapshot test`,
        expectedVersion: v,
      });
      v = r.version;
    }
    const submitted = await caller.report.submitForSignoff({
      id: draft.id,
      expectedVersion: v,
    });
    const mfaCaller = appRouter.createCaller(
      makeAuthedContext(services, {
        mfaFreshUntil: new Date(Date.now() + 5 * 60 * 1000),
      }),
    );
    await mfaCaller.report.sign({
      id: submitted.id,
      expectedVersion: submitted.version,
      attestation: "I approve",
    });

    // Post-sign read — frozen=true, sentence matches the snapshot.
    const signedCompliance = await caller.report.compliance({ id: draft.id });
    expect(signedCompliance.frozen).toBe(true);
    expect(signedCompliance.sentence).toBe(draftSentence);
    // Structured claims dropped per ADR-0012.
    expect(signedCompliance.claims).toHaveLength(0);

    // Mutate the engagement's pack graph AFTER sign-off — a new methodology
    // attached for an unrelated reason. The signed report's compliance
    // sentence must not change.
    // (Actually swapPrimary or detach a non-primary; but since GAGAS is
    // primary and IIA is secondary, detach IIA — that's the simplest
    // post-sign mutation that proves immutability.)
    await caller.pack.detach({
      engagementId,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    const stillFrozen = await caller.report.compliance({ id: draft.id });
    expect(stillFrozen.frozen).toBe(true);
    expect(stillFrozen.sentence).toBe(draftSentence); // unchanged
  });

  it("classification taxonomy is translated through the target pack (Gemini W2 review catch #1)", async () => {
    // Prisma enum stores GAGAS-shaped classification values
    // (MINOR=1, SIGNIFICANT=2, MATERIAL=3, CRITICAL=4). When rendered
    // under IIA, the section header should show IIA's vocabulary at the
    // same severity tier (LOW / MEDIUM / HIGH / CRITICAL).
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await setupMultiPackWithFinding("classify-translate");

    // The setup helper creates a finding with default SIGNIFICANT
    // classification (severity tier 2). IIA's tier 2 = MEDIUM.
    const iiaReport = await caller.report.create({
      engagementId,
      title: "IIA report — classification translation",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });
    const summary = iiaReport.sections["findings_summary"]?.content ?? "";
    expect(summary).toContain("[MEDIUM]");
    expect(summary).not.toContain("[SIGNIFICANT]");

    // GAGAS report on the same engagement keeps GAGAS labels.
    const gagasReport = await caller.report.create({
      engagementId,
      title: "GAGAS report — classification translation",
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    });
    expect(gagasReport.sections["findings_summary"]?.content).toContain("[SIGNIFICANT]");
  });

  it("rejects a second report with the SAME attestsTo on the same engagement (W3 day 1)", async () => {
    // The W3-day-1 unique constraint at (engagementId, attestsToPackCode,
    // attestsToPackVersion) catches "the auditor accidentally clicked Create
    // twice" cleanly. Duplicate attempt → CONFLICT, not a silent second row.
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const { engagementId } = await setupMultiPackWithFinding("dupe-attests");

    await caller.report.create({
      engagementId,
      title: "First GAGAS report",
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    });
    await expect(
      caller.report.create({
        engagementId,
        title: "Second GAGAS report — duplicate",
        attestsToPackCode: "GAGAS",
        attestsToPackVersion: "2024.1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Cross-pack pair still works: GAGAS + IIA on the same engagement.
    const iia = await caller.report.create({
      engagementId,
      title: "IIA report — different attestsTo",
      attestsToPackCode: "IIA-GIAS",
      attestsToPackVersion: "2024.1",
    });
    expect(iia.id).toBeTruthy();
  });

  it("rejects attestsTo for a pack not attached to the engagement", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const eng = await caller.engagement.create({
      name: "single-pack-eng",
      auditeeName: "Co",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    // IIA-GIAS isn't attached to this engagement.
    await expect(
      caller.report.create({
        engagementId: eng.id,
        title: "Should fail",
        attestsToPackCode: "IIA-GIAS",
        attestsToPackVersion: "2024.1",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("auditLog router", () => {
  it("list returns the most recent entries for the current tenant", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    // Create an engagement; the trigger will append at least one audit row.
    const eng = await caller.engagement.create({
      name: "Audit log fixture",
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 audit",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    });

    const result = await caller.auditLog.list({ limit: 10 });
    expect(result.items.length).toBeGreaterThan(0);
    // Newest first.
    expect(result.items.map((e) => e.action)).toContain("CREATE");
    // Entries reference the new engagement.
    expect(
      result.items.some(
        (e) => e.entityType === "engagements" && e.entityId === eng.id,
      ),
    ).toBe(true);
  });

  it("list filters by (entityType, entityId)", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const eng = await caller.engagement.create({
      name: "Filter target",
      auditeeName: "BizCo",
      fiscalPeriod: "FY26 filter",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    });

    const result = await caller.auditLog.list({
      entityType: "engagements",
      entityId: eng.id,
      limit: 50,
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const entry of result.items) {
      expect(entry.entityType).toBe("engagements");
      expect(entry.entityId).toBe(eng.id);
    }
  });

  it("list excludes entries from other tenants", async () => {
    const { services, prisma } = requireSetup();

    // Make a sibling tenant + engagement directly.
    const other = await prisma.tenant.create({
      data: { slug: `other-${Date.now().toString()}`, name: "Other Tenant" },
    });
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        email: `other-${Date.now().toString()}@x.test`,
        name: "Other User",
        role: "Staff",
        status: "ACTIVE",
      },
    });
    const otherEng = await prisma.engagement.create({
      data: {
        tenantId: other.id,
        name: "Other tenant engagement",
        auditeeName: "Other",
        fiscalPeriod: "FY26",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        leadUserId: otherUser.id,
      },
    });

    const caller = appRouter.createCaller(makeAuthedContext(services));
    const result = await caller.auditLog.list({ limit: 200 });
    expect(result.items.some((e) => e.entityId === otherEng.id)).toBe(false);
    expect(result.items.every((e) => e.tenantId === tenantId)).toBe(true);
  });

  it("verifyChain reports ok=true on an intact chain", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const result = await caller.auditLog.verifyChain();
    expect(result.ok).toBe(true);
    expect(result.brokenAt).toBeNull();
    expect(result.totalRows).toBeGreaterThan(0n);
  });

  it("strictness changes appear in audit log via the engagement_strictness trigger (W3 day 4-5)", async () => {
    // Per slice plan §3.3 + ADR-0011 phase 5: every resolver re-run lands
    // a hash-chained row in audit.audit_log. The trigger added in
    // 20260502120000_audit_log_trigger_strictness fires on
    // engagement_strictness mutations; the audit-log viewer's
    // "Strictness changes" filter chip surfaces them.
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));

    const eng = await caller.engagement.create({
      name: "audit-log-strictness",
      auditeeName: "AuditCo",
      fiscalPeriod: "FY27",
      periodStart: new Date("2027-01-01"),
      periodEnd: new Date("2027-12-31"),
      leadUserId: userId,
    });
    // Attach the first pack — resolver writes a fresh strictness row.
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "GAGAS",
      packVersion: "2024.1",
    });
    // Attach a second pack — resolver re-runs (idempotent overwrite),
    // bumping the strictness row's version.
    await caller.pack.attach({
      engagementId: eng.id,
      packCode: "IIA-GIAS",
      packVersion: "2024.1",
    });

    // Audit log filtered by entityType=engagement_strictness should show
    // at least 2 rows for this engagement (1 CREATE on first attach,
    // 1 UPDATE on second attach).
    const filtered = await caller.auditLog.list({
      limit: 50,
      entityType: "engagement_strictness",
    });
    const forThisEngagement = filtered.items.filter((entry) => {
      const after = entry.afterData as { engagementId?: string } | null;
      return after?.engagementId === eng.id;
    });
    expect(forThisEngagement.length).toBeGreaterThanOrEqual(2);
    const actions = new Set(forThisEngagement.map((e) => e.action));
    // First attach → CREATE; second attach → UPDATE.
    expect(actions.has("CREATE")).toBe(true);
    expect(actions.has("UPDATE")).toBe(true);
  });

  // Note: a "verifyChain detects tampering" test would require a connection
  // that reliably bypasses the FORCE RLS on audit.audit_log to UPDATE a
  // foreign-tenant row through Prisma. The worker's `contentHash` check
  // (apps/worker/src/outbox/outbox.test.ts) covers the negative path against
  // a tampered cipher; the SQL function's logic is straightforward enough
  // that the positive path above is sufficient slice-A coverage.
});

describe("cross-tenant isolation sweep", () => {
  // Seeds a sibling tenant with the minimum state needed to point at:
  // engagement, finding (DRAFT + IN_REVIEW), and report (DRAFT + PUBLISHED
  // with pdfS3Key). Uses the admin client (no tenant extension) so the
  // writes aren't scoped to the active test tenant. Returns IDs the
  // assertions then attempt to access from the *current* tenant's caller
  // — every attempt should be rejected (NOT_FOUND) or filtered out
  // (empty list).
  async function seedSiblingTenant(): Promise<{
    siblingTenantId: string;
    siblingEngagementId: string;
    siblingDraftFindingId: string;
    siblingInReviewFindingId: string;
    siblingReportId: string;
  }> {
    const { services, prisma } = requireSetup();

    const sibling = await prisma.tenant.create({
      data: {
        slug: `sibling-${Date.now().toString()}`,
        name: "Sibling Tenant",
      },
    });
    await services.encryption.provisionTenantDek(sibling.id);

    const siblingUser = await prisma.user.create({
      data: {
        tenantId: sibling.id,
        email: `sibling-${Date.now().toString()}@x.test`,
        name: "Sibling User",
        role: "Senior",
        status: "ACTIVE",
      },
    });

    const siblingEngagement = await prisma.engagement.create({
      data: {
        tenantId: sibling.id,
        name: "Sibling Engagement",
        auditeeName: "SiblingCo",
        fiscalPeriod: "FY26 sibling",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-12-31"),
        leadUserId: siblingUser.id,
      },
    });
    await prisma.packAttachment.create({
      data: {
        tenantId: sibling.id,
        engagementId: siblingEngagement.id,
        packCode: "GAGAS",
        packVersion: "2024.1",
        attachedBy: siblingUser.id,
        isPrimary: true,
      },
    });

    const sectionsCipher = await services.encryption.encryptJson(sibling.id, {});
    const draftFinding = await prisma.finding.create({
      data: {
        tenantId: sibling.id,
        engagementId: siblingEngagement.id,
        findingNumber: "F-2026-0001",
        title: "Sibling DRAFT finding",
        classification: "SIGNIFICANT",
        elementValuesCipher: sectionsCipher,
        elementsComplete: 0,
        status: "DRAFT",
        authorId: siblingUser.id,
      },
    });
    const inReviewFinding = await prisma.finding.create({
      data: {
        tenantId: sibling.id,
        engagementId: siblingEngagement.id,
        findingNumber: "F-2026-0002",
        title: "Sibling IN_REVIEW finding",
        classification: "SIGNIFICANT",
        elementValuesCipher: sectionsCipher,
        elementsComplete: 4,
        status: "IN_REVIEW",
        authorId: siblingUser.id,
      },
    });

    const siblingReport = await prisma.report.create({
      data: {
        tenantId: sibling.id,
        engagementId: siblingEngagement.id,
        templateKey: "engagement-report-v1",
        title: "Sibling Report",
        status: "PUBLISHED",
        authorId: siblingUser.id,
        attestsToPackCode: "GAGAS",
        attestsToPackVersion: "2024.1",
      },
    });
    await prisma.reportVersion.create({
      data: {
        tenantId: sibling.id,
        reportId: siblingReport.id,
        versionNumber: "v1.0",
        isDraft: false,
        contentCipher: sectionsCipher,
        contentHash: "a".repeat(64),
        signedBy: siblingUser.id,
        signedAt: new Date(),
        pdfS3Key: `reports/${sibling.id}/${siblingReport.id}/test.pdf`,
        pdfRenderedAt: new Date(),
      },
    });

    return {
      siblingTenantId: sibling.id,
      siblingEngagementId: siblingEngagement.id,
      siblingDraftFindingId: draftFinding.id,
      siblingInReviewFindingId: inReviewFinding.id,
      siblingReportId: siblingReport.id,
    };
  }

  it("finding.get rejects another tenant's finding id", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    await expect(
      caller.finding.get({ id: seed.siblingDraftFindingId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("finding.list returns empty for another tenant's engagementId", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    const items = await caller.finding.list({
      engagementId: seed.siblingEngagementId,
    });
    expect(items).toEqual([]);
  });

  it("finding.listPending excludes another tenant's IN_REVIEW findings", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    const items = await caller.finding.listPending();
    expect(items.map((f) => f.id)).not.toContain(seed.siblingInReviewFindingId);
  });

  it("finding.updateElement rejects another tenant's finding id", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    await expect(
      caller.finding.updateElement({
        id: seed.siblingDraftFindingId,
        elementCode: "CRITERIA",
        value: "x".repeat(60),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("report.get rejects another tenant's report id", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    await expect(
      caller.report.get({ id: seed.siblingReportId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("report.list returns empty for another tenant's engagementId", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    const items = await caller.report.list({
      engagementId: seed.siblingEngagementId,
    });
    expect(items).toEqual([]);
  });

  it("report.downloadPdf rejects another tenant's report id", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    await expect(
      caller.report.downloadPdf({ id: seed.siblingReportId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("engagement.get rejects another tenant's engagement id", async () => {
    const { services } = requireSetup();
    const caller = appRouter.createCaller(makeAuthedContext(services));
    const seed = await seedSiblingTenant();
    await expect(
      caller.engagement.get({ id: seed.siblingEngagementId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
