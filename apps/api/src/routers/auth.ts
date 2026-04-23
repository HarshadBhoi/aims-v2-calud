/**
 * Auth tRPC procedures.
 *
 * All session-altering procedures use the admin client + SessionModule
 * directly — they operate outside of tenant context (or bootstrap it from
 * the request).
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { consumeBackupCode, generateBackupCodes, hashBackupCode } from "../auth/backup-codes";
import { verifyPassword } from "../auth/password";
import { SessionError } from "../auth/session-lifecycle";
import { generateTotpSecret, totpAuthUri, verifyTotp } from "../auth/totp";
import { type RequestContext } from "../context";
import { authenticatedProcedure, publicProcedure, router } from "../trpc";

// ─── Shared helpers ────────────────────────────────────────────────────────

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge: number; // seconds
};

function setSessionCookies(
  ctx: RequestContext,
  pair: { accessToken: string; refreshToken: string; expiresAt: Date },
): void {
  const { accessCookieName, refreshCookieName, cookieSecure, accessTokenTtlMs, refreshTokenTtlMs } =
    ctx.services.config;
  const common: CookieOptions = {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  };

  ctx.res.setCookie(accessCookieName, pair.accessToken, {
    ...common,
    maxAge: Math.floor(accessTokenTtlMs / 1000),
  });
  ctx.res.setCookie(refreshCookieName, pair.refreshToken, {
    ...common,
    maxAge: Math.floor(refreshTokenTtlMs / 1000),
  });
}

function clearSessionCookies(ctx: RequestContext): void {
  const { accessCookieName, refreshCookieName } = ctx.services.config;
  ctx.res.clearCookie(accessCookieName, { path: "/" });
  ctx.res.clearCookie(refreshCookieName, { path: "/" });
}

function readRefreshCookie(ctx: RequestContext): string | null {
  const cookies = (ctx.req as unknown as { cookies?: Record<string, string | undefined> })
    .cookies;
  return cookies?.[ctx.services.config.refreshCookieName] ?? null;
}

// ─── Router ────────────────────────────────────────────────────────────────

export const authRouter = router({
  // ─── signIn ──────────────────────────────────────────────────────────────
  signIn: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1).max(120),
        email: z.string().email().max(320),
        password: z.string().min(1).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await ctx.services.prisma.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
      if (!tenant) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
      }

      const user = await ctx.services.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
      });
      if (!user?.passwordHash || user.status !== "ACTIVE") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
      }

      if ((user.lockedUntil?.getTime() ?? 0) > Date.now()) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Account temporarily locked. Try again later.",
        });
      }

      const ok = await verifyPassword(user.passwordHash, input.password);
      if (!ok) {
        await ctx.services.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: { increment: 1 },
            // 5 failed attempts → 15-min lock
            lockedUntil:
              user.failedLoginCount + 1 >= 5
                ? new Date(Date.now() + 15 * 60 * 1000)
                : null,
          },
        });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
      }

      // Successful login — reset counters.
      await ctx.services.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });

      const pair = await ctx.services.sessions.createSession({
        userId: user.id,
        tenantId: tenant.id,
        // exactOptionalPropertyTypes: spread-in only when defined.
        ...(ctx.ipAddress !== undefined ? { ipAddress: ctx.ipAddress } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      });

      setSessionCookies(ctx, pair);

      // Signal whether MFA is required next.
      const mfaRow = await ctx.services.prisma.mfaSecret.findUnique({
        where: { userId: user.id },
      });
      const mfaEnrolled = Boolean(mfaRow?.verifiedAt);

      return {
        userId: user.id,
        tenantId: tenant.id,
        sessionId: pair.sessionId,
        mfaEnrolled,
        mfaRequired: mfaEnrolled, // require step-up if enrolled; enroll flow if not
      };
    }),

  // ─── refresh ─────────────────────────────────────────────────────────────
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const refreshToken = readRefreshCookie(ctx);
    if (!refreshToken) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No refresh token." });
    }

    try {
      const pair = await ctx.services.sessions.rotateSession(refreshToken);
      setSessionCookies(ctx, pair);
      return { sessionId: pair.sessionId, familyId: pair.familyId };
    } catch (err) {
      clearSessionCookies(ctx);
      if (err instanceof SessionError) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: err.code });
      }
      throw err;
    }
  }),

  // ─── signOut ─────────────────────────────────────────────────────────────
  signOut: authenticatedProcedure.mutation(async ({ ctx }) => {
    await ctx.services.sessions.revokeSession(ctx.session.sessionId, "USER_SIGNED_OUT");
    clearSessionCookies(ctx);
    return { ok: true as const };
  }),

  // ─── me ──────────────────────────────────────────────────────────────────
  me: authenticatedProcedure.query(async ({ ctx }) => {
    const user = await ctx.services.prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
      },
    });
    return user;
  }),

  // ─── mfaEnrollBegin ──────────────────────────────────────────────────────
  mfaEnrollBegin: authenticatedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.services.prisma.mfaSecret.findUnique({
      where: { userId: ctx.session.userId },
    });
    if (existing?.verifiedAt) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "MFA is already enrolled. Disable first to re-enroll.",
      });
    }

    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(10);

    const user = await ctx.services.prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.userId },
    });
    const uri = totpAuthUri(secret, user.email, ctx.services.config.jwtIssuer);

    // Pre-persist secret (unverified) — ALE-encrypted.
    const secretCipher = await ctx.services.encryption.encrypt(ctx.session.tenantId, secret);
    const backupCodesCipher = await ctx.services.encryption.encryptJson(
      ctx.session.tenantId,
      backupCodes.map(hashBackupCode),
    );

    await ctx.services.prisma.mfaSecret.upsert({
      where: { userId: ctx.session.userId },
      create: {
        tenantId: ctx.session.tenantId,
        userId: ctx.session.userId,
        secretCipher,
        backupCodesCipher,
      },
      update: {
        secretCipher,
        backupCodesCipher,
        verifiedAt: null,
      },
    });

    return {
      // The plaintext secret is shown to the user ONCE for authenticator-app setup.
      secret,
      otpauthUri: uri,
      backupCodes,
    };
  }),

  // ─── mfaEnrollVerify ─────────────────────────────────────────────────────
  mfaEnrollVerify: authenticatedProcedure
    .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.services.prisma.mfaSecret.findUnique({
        where: { userId: ctx.session.userId },
      });
      if (!row) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Start enrollment via mfaEnrollBegin first.",
        });
      }

      const secretPlaintext = (
        await ctx.services.encryption.decrypt(ctx.session.tenantId, Buffer.from(row.secretCipher))
      ).toString("utf8");

      if (!verifyTotp(secretPlaintext, input.code)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code." });
      }

      await ctx.services.prisma.mfaSecret.update({
        where: { userId: ctx.session.userId },
        data: { verifiedAt: new Date() },
      });
      await ctx.services.sessions.markMfaFresh(ctx.session.sessionId);

      return { ok: true as const };
    }),

  // ─── mfaChallenge ────────────────────────────────────────────────────────
  mfaChallenge: authenticatedProcedure
    .input(
      z.union([
        z.object({ code: z.string().length(6).regex(/^\d{6}$/) }),
        z.object({ backupCode: z.string().min(10).max(40) }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.services.prisma.mfaSecret.findUnique({
        where: { userId: ctx.session.userId },
      });
      if (!row?.verifiedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "MFA is not enrolled.",
        });
      }

      if ("code" in input) {
        const secretPlaintext = (
          await ctx.services.encryption.decrypt(
            ctx.session.tenantId,
            Buffer.from(row.secretCipher),
          )
        ).toString("utf8");
        if (!verifyTotp(secretPlaintext, input.code)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code." });
        }
      } else {
        if (!row.backupCodesCipher) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "No backup codes available." });
        }
        const hashedCodes = await ctx.services.encryption.decryptJson<string[]>(
          ctx.session.tenantId,
          Buffer.from(row.backupCodesCipher),
        );
        const result = consumeBackupCode(hashedCodes, input.backupCode);
        if (!result.valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid backup code." });
        }
        const newCipher = await ctx.services.encryption.encryptJson(
          ctx.session.tenantId,
          result.remaining,
        );
        await ctx.services.prisma.mfaSecret.update({
          where: { userId: ctx.session.userId },
          data: { backupCodesCipher: newCipher },
        });
      }

      await ctx.services.sessions.markMfaFresh(ctx.session.sessionId);
      return { ok: true as const };
    }),
});
