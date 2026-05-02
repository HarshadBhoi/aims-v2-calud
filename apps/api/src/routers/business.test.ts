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
