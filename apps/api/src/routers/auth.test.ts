/**
 * Integration tests for the auth router.
 *
 * Spins up Postgres + LocalStack KMS via Testcontainers, applies migrations,
 * seeds a tenant/user, then drives sign-in / refresh / MFA through the tRPC
 * router by directly invoking the createCaller — no HTTP in this suite (that's
 * a future e2e test). Cookies are simulated via mock req/res objects.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
import { createAdminPrismaClient, type AdminPrismaClient } from "@aims/prisma-client";
import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { generateKeyPair } from "jose";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword } from "../auth/password";
import { createSessionModule, type SessionModule } from "../auth/session-lifecycle";
import { generateTotpCode } from "../auth/totp";
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
let kmsClient: KMSClient | undefined;
let services: Services | undefined;
let sessionModule: SessionModule | undefined;
let tenantId: string;
let userId: string;
const PASSWORD = "a sufficiently strong password for auth tests";

function requireSetup() {
  if (!services || !sessionModule || !prisma) {
    throw new Error("beforeAll did not complete");
  }
  return { services, sessionModule, prisma };
}

// ─── Cookie-aware mock req/res ─────────────────────────────────────────────

function makeCookieJar() {
  const cookies = new Map<string, string>();
  return {
    get(name: string): string | undefined {
      return cookies.get(name);
    },
    set(name: string, value: string): void {
      cookies.set(name, value);
    },
    clear(name: string): void {
      cookies.delete(name);
    },
    all(): Record<string, string> {
      return Object.fromEntries(cookies);
    },
  };
}

type CookieJar = ReturnType<typeof makeCookieJar>;

function makeMockContext(
  services: Services,
  jar: CookieJar,
  session: AuthenticatedSession | null = null,
): RequestContext {
  // Build just enough of FastifyRequest / FastifyReply to satisfy the router's
  // cookie-reading / cookie-writing helpers.
  const req = {
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest/auth-test" },
    cookies: jar.all(),
  };
  const res = {
    setCookie(name: string, value: string) {
      jar.set(name, value);
      return res;
    },
    clearCookie(name: string) {
      jar.clear(name);
      return res;
    },
  };
  return {
    services,
    req: req as unknown as RequestContext["req"],
    res: res as unknown as RequestContext["res"],
    session,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  pg = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_auth_router_test")
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

  kmsClient = new KMSClient({
    endpoint: kmsEndpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const createKeyResult = await kmsClient.send(
    new CreateKeyCommand({ Description: "auth router test master KEK" }),
  );
  if (!createKeyResult.KeyMetadata?.Arn) {
    throw new Error("LocalStack KMS did not return a key ARN.");
  }
  const masterKeyArn = createKeyResult.KeyMetadata.Arn;

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
    devKeyPath: "/tmp/does-not-matter",
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
    kmsClient,
    encryption,
    sessions: sessionModule,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
  };

  // Seed one tenant + one user with password set, provision DEK.
  const tenant = await prisma.tenant.create({
    data: { slug: "authtest", name: "Auth Test Tenant" },
  });
  tenantId = tenant.id;
  await encryption.provisionTenantDek(tenantId);

  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: "alice@authtest.test",
      name: "Alice",
      role: "Senior",
      status: "ACTIVE",
      passwordHash,
    },
  });
  userId = user.id;
}, 240_000);

afterAll(async () => {
  if (services) {
    services.kmsClient.destroy();
  }
  await prisma?.$disconnect();
  await pg?.stop();
  await ls?.stop();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("auth router", () => {
  describe("signIn", () => {
    it("issues cookies and returns user/tenant on correct creds", async () => {
      const { services } = requireSetup();
      const jar = makeCookieJar();
      const caller = appRouter.createCaller(makeMockContext(services, jar));

      const result = await caller.auth.signIn({
        tenantSlug: "authtest",
        email: "alice@authtest.test",
        password: PASSWORD,
      });

      expect(result.userId).toBe(userId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.mfaEnrolled).toBe(false);
      expect(jar.get("aims_access")).toBeTruthy();
      expect(jar.get("aims_refresh")).toBeTruthy();
    });

    it("rejects wrong password and increments failed count", async () => {
      const { services, prisma } = requireSetup();
      const jar = makeCookieJar();
      const caller = appRouter.createCaller(makeMockContext(services, jar));

      const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      await expect(
        caller.auth.signIn({
          tenantSlug: "authtest",
          email: "alice@authtest.test",
          password: "wrong password which is long enough",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

      const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(after.failedLoginCount).toBeGreaterThan(before.failedLoginCount);

      // Reset for subsequent tests.
      await prisma.user.update({
        where: { id: userId },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });

    it("rejects unknown tenant as invalid credentials", async () => {
      const { services } = requireSetup();
      const caller = appRouter.createCaller(makeMockContext(services, makeCookieJar()));

      await expect(
        caller.auth.signIn({
          tenantSlug: "nonexistent",
          email: "alice@authtest.test",
          password: PASSWORD,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("me (authenticated)", () => {
    it("throws UNAUTHORIZED without a session", async () => {
      const { services } = requireSetup();
      const caller = appRouter.createCaller(makeMockContext(services, makeCookieJar()));
      await expect(caller.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("returns the current user when a session is present", async () => {
      const { services } = requireSetup();
      const session: AuthenticatedSession = {
        sessionId: "irrelevant",
        userId,
        tenantId,
        mfaFreshUntil: null,
      };
      const caller = appRouter.createCaller(
        makeMockContext(services, makeCookieJar(), session),
      );
      const me = await caller.auth.me();
      expect(me.id).toBe(userId);
      expect(me.email).toBe("alice@authtest.test");
    });
  });

  describe("signOut", () => {
    it("revokes the session and clears cookies", async () => {
      const { services, sessionModule, prisma } = requireSetup();
      const pair = await sessionModule.createSession({ userId, tenantId });
      const session: AuthenticatedSession = {
        sessionId: pair.sessionId,
        userId,
        tenantId,
        mfaFreshUntil: null,
      };
      const jar = makeCookieJar();
      jar.set("aims_access", pair.accessToken);
      jar.set("aims_refresh", pair.refreshToken);

      const caller = appRouter.createCaller(makeMockContext(services, jar, session));

      await caller.auth.signOut();

      const after = await prisma.session.findUniqueOrThrow({ where: { id: pair.sessionId } });
      expect(after.revokedAt).not.toBeNull();
      expect(jar.get("aims_access")).toBeUndefined();
      expect(jar.get("aims_refresh")).toBeUndefined();
    });
  });

  describe("MFA enroll + verify + challenge", () => {
    it("enrolls MFA, verifies a generated TOTP, then passes a challenge", async () => {
      const { services, sessionModule, prisma } = requireSetup();

      // Fresh session for this test.
      const pair = await sessionModule.createSession({ userId, tenantId });
      const session: AuthenticatedSession = {
        sessionId: pair.sessionId,
        userId,
        tenantId,
        mfaFreshUntil: null,
      };
      const caller = appRouter.createCaller(
        makeMockContext(services, makeCookieJar(), session),
      );

      // Begin enrollment.
      const begin = await caller.auth.mfaEnrollBegin();
      expect(begin.secret).toBeTruthy();
      expect(begin.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
      expect(begin.backupCodes).toHaveLength(10);

      // Verify with a computed TOTP.
      const code = generateTotpCode(begin.secret);
      await expect(caller.auth.mfaEnrollVerify({ code })).resolves.toEqual({ ok: true });

      const row = await prisma.mfaSecret.findUniqueOrThrow({ where: { userId } });
      expect(row.verifiedAt).not.toBeNull();

      // Session mfaFreshUntil should be set.
      const updatedSession = await prisma.session.findUniqueOrThrow({
        where: { id: pair.sessionId },
      });
      expect(updatedSession.mfaFreshUntil).not.toBeNull();

      // Clear mfaFreshUntil to simulate the window expiring, then challenge with TOTP.
      await prisma.session.update({
        where: { id: pair.sessionId },
        data: { mfaFreshUntil: null },
      });

      const nextCode = generateTotpCode(begin.secret);
      await expect(caller.auth.mfaChallenge({ code: nextCode })).resolves.toEqual({ ok: true });

      // Try a backup code from the original set — should also succeed.
      await prisma.session.update({
        where: { id: pair.sessionId },
        data: { mfaFreshUntil: null },
      });
      const [firstBackup] = begin.backupCodes;
      if (!firstBackup) throw new Error("no backup code");
      await expect(
        caller.auth.mfaChallenge({ backupCode: firstBackup }),
      ).resolves.toEqual({ ok: true });

      // Re-use of the same backup code should fail (consumed).
      await prisma.session.update({
        where: { id: pair.sessionId },
        data: { mfaFreshUntil: null },
      });
      await expect(
        caller.auth.mfaChallenge({ backupCode: firstBackup }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
