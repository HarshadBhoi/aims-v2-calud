/**
 * Integration tests for session lifecycle (ADR-0005).
 *
 * Spins up Postgres via Testcontainers, applies the Prisma migrations,
 * seeds a tenant+user, and exercises create/rotate/revoke + rotation
 * attack detection.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createAdminPrismaClient, type AdminPrismaClient } from "@aims/prisma-client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { generateKeyPair, type KeyLike } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyAccessToken } from "./jwt";
import { verifyPassword } from "./password";
import { SessionError, createSessionModule, type SessionModule } from "./session-lifecycle";
import { SetPasswordError, setPassword } from "./set-password";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PRISMA_CLIENT_ROOT = resolve(__dirname, "../../../../packages/prisma-client");

let container: StartedPostgreSqlContainer | undefined;
let prisma: AdminPrismaClient | undefined;
let sessionModule: SessionModule | undefined;
let publicKey: KeyLike | undefined;
let tenantId: string;
let userId: string;

function requireSetup() {
  if (!container || !prisma || !sessionModule || !publicKey) {
    throw new Error("beforeAll did not complete.");
  }
  return { container, prisma, sessionModule, publicKey };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_auth_test")
    .withUsername("test_user")
    .withPassword("test_pw")
    .start();

  const url = container.getConnectionUri();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: PRISMA_CLIENT_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  prisma = createAdminPrismaClient({ datasources: { db: { url } } });

  const keys = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  publicKey = keys.publicKey;

  sessionModule = createSessionModule({
    prisma,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    jwtIssuer: "aims-test",
  });

  const tenant = await prisma.tenant.create({
    data: { slug: "session-test", name: "Session Test Tenant" },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "alice@session-test.test",
      name: "Alice",
      role: "Senior",
    },
  });
  tenantId = tenant.id;
  userId = user.id;
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

describe("session lifecycle", () => {
  it("createSession returns a verifiable access token and an opaque refresh", async () => {
    const { sessionModule, publicKey } = requireSetup();
    const pair = await sessionModule.createSession({ userId, tenantId });

    expect(pair.accessToken.split(".")).toHaveLength(3); // JWT shape
    expect(pair.refreshToken.length).toBeGreaterThan(40); // base64url-encoded 32 bytes
    expect(pair.sessionId).toBeTruthy();
    expect(pair.familyId).toMatch(/^[0-9a-f]{32}$/);

    const claims = await verifyAccessToken(publicKey, pair.accessToken, {
      issuer: "aims-test",
    });
    expect(claims.sub).toBe(userId);
    expect(claims.tid).toBe(tenantId);
    expect(claims.sid).toBe(pair.sessionId);
  });

  it("rotateSession issues a new pair, invalidates the old refresh", async () => {
    const { sessionModule, prisma } = requireSetup();
    const first = await sessionModule.createSession({ userId, tenantId });
    const second = await sessionModule.rotateSession(first.refreshToken);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.familyId).toBe(first.familyId);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Old session is now revoked.
    const oldSession = await prisma.session.findUnique({
      where: { id: first.sessionId },
    });
    expect(oldSession?.revokedAt).not.toBeNull();

    // Old refresh is blocklisted.
    const oldTokenHash = createHash("sha256").update(first.refreshToken).digest("hex");
    const blocklisted = await sessionModule.isSessionBlocklisted(oldTokenHash);
    expect(blocklisted).toBe(true);
  });

  it("re-using an old refresh token triggers family-wide revocation", async () => {
    const { sessionModule, prisma } = requireSetup();
    const v1 = await sessionModule.createSession({ userId, tenantId });
    const v2 = await sessionModule.rotateSession(v1.refreshToken); // rotate once
    // v1 is now revoked; v2 is active. Attacker tries v1 again:
    await expect(sessionModule.rotateSession(v1.refreshToken)).rejects.toMatchObject({
      code: "ROTATION_DETECTED",
    });

    // Whole family should now be revoked.
    const remaining = await prisma.session.findMany({
      where: { familyId: v1.familyId, revokedAt: null },
    });
    expect(remaining).toHaveLength(0);

    // v2 can no longer be used either.
    await expect(sessionModule.rotateSession(v2.refreshToken)).rejects.toBeInstanceOf(
      SessionError,
    );
  });

  it("revokeSession marks the session + writes to the blocklist", async () => {
    const { sessionModule, prisma } = requireSetup();
    const pair = await sessionModule.createSession({ userId, tenantId });

    await sessionModule.revokeSession(pair.sessionId, "USER_SIGNED_OUT");

    const session = await prisma.session.findUnique({ where: { id: pair.sessionId } });
    expect(session?.revokedAt).not.toBeNull();

    await expect(sessionModule.rotateSession(pair.refreshToken)).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    });
  });

  it("revokeSession is idempotent (double-call does not throw)", async () => {
    const { sessionModule } = requireSetup();
    const pair = await sessionModule.createSession({ userId, tenantId });
    await sessionModule.revokeSession(pair.sessionId, "FIRST");
    await expect(sessionModule.revokeSession(pair.sessionId, "SECOND")).resolves.not.toThrow();
  });

  it("rejects an unknown refresh token", async () => {
    const { sessionModule } = requireSetup();
    await expect(sessionModule.rotateSession("not-a-real-token")).rejects.toMatchObject({
      code: "INVALID_REFRESH",
    });
  });

  it("markMfaFresh sets mfaFreshUntil ~15min in the future", async () => {
    const { sessionModule, prisma } = requireSetup();
    const pair = await sessionModule.createSession({ userId, tenantId });

    await sessionModule.markMfaFresh(pair.sessionId);

    const session = await prisma.session.findUniqueOrThrow({ where: { id: pair.sessionId } });
    expect(session.mfaFreshUntil).not.toBeNull();
    const windowMs = (session.mfaFreshUntil!.getTime() - Date.now()) / 1000;
    expect(windowMs).toBeGreaterThan(14 * 60); // at least 14 minutes
    expect(windowMs).toBeLessThan(16 * 60); // at most 16 minutes
  });

  it("carries mfaFreshUntil forward across rotation", async () => {
    const { sessionModule, prisma } = requireSetup();
    const first = await sessionModule.createSession({ userId, tenantId });
    await sessionModule.markMfaFresh(first.sessionId);

    const second = await sessionModule.rotateSession(first.refreshToken);
    const newSession = await prisma.session.findUniqueOrThrow({
      where: { id: second.sessionId },
    });
    expect(newSession.mfaFreshUntil).not.toBeNull();
  });
});

describe("set-password", () => {
  it("sets a password hash on an existing user", async () => {
    const { prisma } = requireSetup();

    const result = await setPassword(
      {
        tenantSlug: "session-test",
        email: "alice@session-test.test",
        plaintextPassword: "a very strong password for Alice",
      },
      { prisma },
    );

    expect(result.userId).toBe(userId);
    expect(result.tenantId).toBe(tenantId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).not.toBeNull();
    expect(user.passwordHash?.startsWith("$argon2id$")).toBe(true);
  });

  it("stored hash verifies against the original password", async () => {
    const { prisma } = requireSetup();
    const password = "another strong password for Alice";

    await setPassword(
      {
        tenantSlug: "session-test",
        email: "alice@session-test.test",
        plaintextPassword: password,
      },
      { prisma },
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) throw new Error("passwordHash not set");
    expect(await verifyPassword(user.passwordHash, password)).toBe(true);
    expect(await verifyPassword(user.passwordHash, "wrong password")).toBe(false);
  });

  it("rejects a password that is too short", async () => {
    const { prisma } = requireSetup();

    await expect(
      setPassword(
        {
          tenantSlug: "session-test",
          email: "alice@session-test.test",
          plaintextPassword: "short",
        },
        { prisma },
      ),
    ).rejects.toMatchObject({
      name: "SetPasswordError",
      code: "PASSWORD_TOO_SHORT",
    });
  });

  it("rejects unknown tenant slug", async () => {
    const { prisma } = requireSetup();

    await expect(
      setPassword(
        {
          tenantSlug: "nonexistent",
          email: "alice@session-test.test",
          plaintextPassword: "a sufficiently long password",
        },
        { prisma },
      ),
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });

  it("rejects unknown email in tenant", async () => {
    const { prisma } = requireSetup();

    await expect(
      setPassword(
        {
          tenantSlug: "session-test",
          email: "nobody@session-test.test",
          plaintextPassword: "a sufficiently long password",
        },
        { prisma },
      ),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("is an instance of SetPasswordError on typed failure", async () => {
    const { prisma } = requireSetup();
    try {
      await setPassword(
        {
          tenantSlug: "nonexistent",
          email: "x@y.test",
          plaintextPassword: "long enough password for validation",
        },
        { prisma },
      );
    } catch (err) {
      expect(err).toBeInstanceOf(SetPasswordError);
    }
  });
});
