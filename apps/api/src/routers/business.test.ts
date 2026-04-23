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

function makeAuthedContext(services: Services): RequestContext {
  const req = { ip: "127.0.0.1", headers: { "user-agent": "vitest/business" }, cookies: {} };
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
    userId,
    tenantId,
    mfaFreshUntil: null,
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
    .withEnvironment({ SERVICES: "kms", AWS_DEFAULT_REGION: "us-east-1" })
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
    kmsMasterKeyAlias: masterKeyArn,
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
      },
    },
  });
}, 240_000);

afterAll(async () => {
  if (services) {
    services.kmsClient.destroy();
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
