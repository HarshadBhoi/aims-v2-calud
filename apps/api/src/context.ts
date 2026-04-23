/**
 * tRPC request context.
 *
 * Each HTTP request builds a fresh context from:
 *   - the Services singleton (db, encryption, sessions, config)
 *   - the incoming request (cookies, headers, ip, user-agent)
 *   - the authenticated session, if a valid access-token cookie is present
 *
 * `session` is null for unauthenticated requests. Authenticated procedures
 * narrow it via a middleware that throws UNAUTHORIZED if null.
 */

import { type FastifyReply, type FastifyRequest } from "fastify";

import { verifyAccessToken } from "./auth/jwt";
import { type Services } from "./services";

export type AuthenticatedSession = {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly mfaFreshUntil: Date | null;
};

export type RequestContext = {
  readonly services: Services;
  readonly req: FastifyRequest;
  readonly res: FastifyReply;
  readonly session: AuthenticatedSession | null;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
};

/**
 * Builds a per-request tRPC context. Attempts to resolve the session from
 * the access-token cookie; if verification fails or the session is revoked,
 * sets `session = null` (unauthenticated).
 */
export async function createContext(
  services: Services,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<RequestContext> {
  const session = await resolveSession(services, req);
  return {
    services,
    req,
    res,
    session,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

async function resolveSession(
  services: Services,
  req: FastifyRequest,
): Promise<AuthenticatedSession | null> {
  const accessToken = readCookie(req, services.config.accessCookieName);
  if (!accessToken) return null;

  let claims;
  try {
    claims = await verifyAccessToken(services.publicKey, accessToken, {
      issuer: services.config.jwtIssuer,
    });
  } catch {
    return null; // expired, bad signature, wrong issuer — all treated as unauthenticated
  }

  // Confirm the session still exists and isn't revoked. JWT's exp covers
  // the 15-min window; this catches revocations during that window.
  const session = await services.prisma.session.findUnique({
    where: { id: claims.sid },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    tenantId: session.tenantId,
    mfaFreshUntil: session.mfaFreshUntil,
  };
}

function readCookie(req: FastifyRequest, name: string): string | undefined {
  // @fastify/cookie decorates `req.cookies` with { [name]: value }. Older
  // Fastify type defs don't include this by default, so we narrow via a
  // structural type guard rather than an unsafe cast.
  const asRec = req as unknown as { cookies?: Record<string, string | undefined> };
  if (!asRec.cookies) return undefined;
  return asRec.cookies[name];
}
