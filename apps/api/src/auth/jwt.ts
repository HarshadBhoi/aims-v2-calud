/**
 * EdDSA (Ed25519) JWT signing + verification via `jose`.
 *
 * Access tokens are short-lived (15 min by default) and carry minimal
 * claims: subject (userId), tid (tenantId), sid (sessionId). Refresh
 * tokens are opaque (not JWT) — see session-lifecycle.ts.
 *
 * Keys are passed in as CryptoKey instances. For dev, generate at startup
 * (see dev-keys.ts). For prod, KMS-managed asymmetric keys (deferred).
 */

import { SignJWT, jwtVerify, type KeyLike } from "jose";

export type AccessTokenClaims = {
  /** User id (subject). */
  readonly sub: string;
  /** Tenant id. */
  readonly tid: string;
  /** Session id (for server-side blocklist checks). */
  readonly sid: string;
};

export type SignedAccessToken = AccessTokenClaims & {
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
};

/**
 * Signs an access-token JWT. `ttlMs` defaults to 15 minutes.
 */
export async function issueAccessToken(
  privateKey: KeyLike,
  claims: AccessTokenClaims,
  options: { ttlMs?: number; issuer: string },
): Promise<string> {
  const ttlMs = options.ttlMs ?? 15 * 60 * 1000;
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuer(options.issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(ttlMs / 1000))
    .sign(privateKey);
}

/**
 * Verifies an access-token JWT. Throws if invalid, expired, or issued by a
 * different issuer. Returns the decoded claims.
 */
export async function verifyAccessToken(
  publicKey: KeyLike,
  token: string,
  options: { issuer: string },
): Promise<SignedAccessToken> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: options.issuer,
    algorithms: ["EdDSA"],
  });

  // jose returns JWTPayload; we narrow to our SignedAccessToken shape.
  const sub = payload.sub;
  const tid = payload["tid"];
  const sid = payload["sid"];
  const iat = payload.iat;
  const exp = payload.exp;
  const iss = payload.iss;

  if (typeof sub !== "string" || typeof tid !== "string" || typeof sid !== "string") {
    throw new Error("Access token missing required sub/tid/sid claims");
  }
  if (typeof iat !== "number" || typeof exp !== "number" || typeof iss !== "string") {
    throw new Error("Access token missing required iat/exp/iss claims");
  }

  return { sub, tid, sid, iat, exp, iss };
}
