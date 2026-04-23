/**
 * Session lifecycle — creation, rotation, revocation.
 *
 * Implements ADR-0005 (hybrid session revocation):
 *   - Access tokens are short-lived JWTs (verifiable offline via public key).
 *   - Refresh tokens are opaque (32 random bytes, base64url), hashed at rest
 *     as SHA-256 in Session.tokenHash.
 *   - Session family + generation tracks rotation. Reusing an old refresh
 *     token after rotation (theft signal) revokes the entire family.
 *   - SessionBlocklist caches revoked tokenHashes for fast middleware checks
 *     (O(1) Redis hit in prod; we read Postgres directly for slice simplicity).
 *
 * Uses the AdminPrismaClient — session bootstrap can't have a tenant context
 * yet (chicken-and-egg).
 */

import { createHash, randomBytes } from "node:crypto";

import { type AdminPrismaClient } from "@aims/prisma-client";
import { type KeyLike } from "jose";

import { issueAccessToken } from "./jwt";

// ─── Public API ────────────────────────────────────────────────────────────

export type CreateSessionInput = {
  readonly userId: string;
  readonly tenantId: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
};

export type SessionPair = {
  readonly accessToken: string;
  readonly refreshToken: string; // opaque, returned to client once
  readonly sessionId: string;
  readonly familyId: string;
  readonly expiresAt: Date;
};

export type SessionModuleOptions = {
  readonly prisma: AdminPrismaClient;
  readonly privateKey: KeyLike;
  readonly publicKey: KeyLike;
  readonly accessTokenTtlMs?: number; // default 15 min
  readonly refreshTokenTtlMs?: number; // default 7 days
  readonly jwtIssuer?: string; // default "aims-api"
  readonly mfaFreshnessWindowMs?: number; // default 15 min
};

export type SessionModule = {
  createSession(input: CreateSessionInput): Promise<SessionPair>;
  rotateSession(refreshToken: string): Promise<SessionPair>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  revokeSessionFamily(familyId: string, reason: string): Promise<void>;
  markMfaFresh(sessionId: string): Promise<void>;
  isSessionBlocklisted(tokenHash: string): Promise<boolean>;
};

export class SessionError extends Error {
  readonly code:
    | "INVALID_REFRESH"
    | "SESSION_EXPIRED"
    | "SESSION_REVOKED"
    | "ROTATION_DETECTED";

  constructor(
    code: SessionError["code"],
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SessionError";
    this.code = code;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────

export function createSessionModule(options: SessionModuleOptions): SessionModule {
  const { prisma, privateKey } = options;
  const accessTtl = options.accessTokenTtlMs ?? 15 * 60 * 1000;
  const refreshTtl = options.refreshTokenTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  const issuer = options.jwtIssuer ?? "aims-api";
  const mfaWindow = options.mfaFreshnessWindowMs ?? 15 * 60 * 1000;

  function generateOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  function generateFamilyId(): string {
    return randomBytes(16).toString("hex");
  }

  async function createSession(input: CreateSessionInput): Promise<SessionPair> {
    const refreshToken = generateOpaqueToken();
    const tokenHash = hashToken(refreshToken);
    const familyId = generateFamilyId();
    const expiresAt = new Date(Date.now() + refreshTtl);

    const session = await prisma.session.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash,
        familyId,
        generation: 0,
        expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    const accessToken = await issueAccessToken(
      privateKey,
      { sub: input.userId, tid: input.tenantId, sid: session.id },
      { ttlMs: accessTtl, issuer },
    );

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      familyId,
      expiresAt,
    };
  }

  async function rotateSession(refreshToken: string): Promise<SessionPair> {
    const tokenHash = hashToken(refreshToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      throw new SessionError("INVALID_REFRESH");
    }

    if (session.expiresAt < new Date()) {
      throw new SessionError("SESSION_EXPIRED");
    }

    if (session.revokedAt) {
      // Session is revoked. If the family still has active sessions, this
      // refresh-token reuse is a theft signal — revoke the whole family.
      const activeInFamily = await prisma.session.findFirst({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
      });

      if (activeInFamily) {
        await revokeSessionFamilyInternal(session.familyId, "ROTATION_REUSE_DETECTED");
        throw new SessionError("ROTATION_DETECTED");
      }

      throw new SessionError("SESSION_REVOKED");
    }

    // Mint the next generation in the family.
    const newRefreshToken = generateOpaqueToken();
    const newTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + refreshTtl);

    const newSession = await prisma.session.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        tokenHash: newTokenHash,
        familyId: session.familyId,
        generation: session.generation + 1,
        expiresAt: newExpiresAt,
        mfaFreshUntil: session.mfaFreshUntil, // carry forward
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    // Invalidate the old session + blocklist its token hash.
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await prisma.sessionBlocklist.create({
      data: {
        tokenHash: session.tokenHash,
        tenantId: session.tenantId,
        reason: "ROTATED",
        expiresAt: session.expiresAt,
      },
    });

    const accessToken = await issueAccessToken(
      privateKey,
      {
        sub: newSession.userId,
        tid: newSession.tenantId,
        sid: newSession.id,
      },
      { ttlMs: accessTtl, issuer },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: newSession.id,
      familyId: newSession.familyId,
      expiresAt: newExpiresAt,
    };
  }

  async function revokeSession(sessionId: string, reason: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.revokedAt) {
      return; // idempotent: already gone
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await prisma.sessionBlocklist.upsert({
      where: { tokenHash: session.tokenHash },
      create: {
        tokenHash: session.tokenHash,
        tenantId: session.tenantId,
        reason,
        expiresAt: session.expiresAt,
      },
      update: { reason }, // update reason if already blocklisted
    });
  }

  async function revokeSessionFamilyInternal(
    familyId: string,
    reason: string,
  ): Promise<void> {
    const active = await prisma.session.findMany({
      where: { familyId, revokedAt: null },
    });
    for (const s of active) {
      await revokeSession(s.id, reason);
    }
  }

  async function markMfaFresh(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { mfaFreshUntil: new Date(Date.now() + mfaWindow) },
    });
  }

  async function isSessionBlocklisted(tokenHash: string): Promise<boolean> {
    const row = await prisma.sessionBlocklist.findUnique({
      where: { tokenHash },
    });
    if (!row) return false;
    // Allow natural expiry — if blocklist entry expired, treat as not blocklisted.
    return row.expiresAt > new Date();
  }

  return {
    createSession,
    rotateSession,
    revokeSession,
    revokeSessionFamily: revokeSessionFamilyInternal,
    markMfaFresh,
    isSessionBlocklisted,
  };
}
