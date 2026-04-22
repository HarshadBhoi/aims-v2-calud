# Session Management

> Token strategy, cookie configuration, refresh token rotation, revocation, and multi-device management.

---

## 1. Token Strategy

We use a **hybrid**: opaque session cookie + stateless access JWT + refresh token.

```
┌──────────────────────────────────────────────────────────┐
│  aims_session (HTTP-only, short-lived)                  │
│    ├─ Format: JWT (EdDSA-signed)                        │
│    ├─ TTL: 15 minutes                                    │
│    ├─ Claims: sub (userId), tenantId, sessionId,        │
│    │          userRole, mfaVerified, iat, exp, jti      │
│    └─ Purpose: Stateless request authentication         │
│                                                          │
│  aims_refresh (HTTP-only, long-lived)                   │
│    ├─ Format: Opaque random (CSPRNG 32 bytes, base64url)│
│    ├─ TTL: 1 day (default) or 30 days ("Remember Me")   │
│    ├─ Storage: SHA-256 hash in sessions table          │
│    ├─ Rotation: New token on every refresh             │
│    └─ Purpose: Renew access token without re-login     │
└──────────────────────────────────────────────────────────┘
```

### Why Hybrid?
- **Access token (JWT)**: Stateless validation — no DB hit per request. Fast. Horizontally scalable.
- **Refresh token (opaque)**: Stateful — can be revoked immediately. Rotation prevents reuse.
- **Session cookie (browser)**: httpOnly prevents JS access; automatic with browser; CSRF-protected via sameSite.

### Why Not Just Session Cookies?
- Each API request would require DB lookup → slower, DB under load
- Doesn't work well for mobile apps or API clients (no cookie jar)

### Why Not Just JWTs?
- Can't revoke JWTs before expiry (unless we check a blocklist on every request, defeating statelessness)
- Leaked token valid until expiry
- Short-lived JWTs fix this, but require refresh mechanism

### Chosen: Best of Both
- Short-lived JWT access token (fast, stateless)
- Long-lived refresh token (DB-backed, revocable, rotated)

---

## 2. JWT Access Token Design

### Structure
```json
{
  "alg": "EdDSA",
  "typ": "JWT",
  "kid": "key-2026-01"         // Key ID for rotation
}
{
  "sub": "clusr_01h7m8...",    // User ID (CUID2)
  "tenantId": "cltnt_...",      // Active tenant for this session
  "sessionId": "clsess_...",    // Session (for revocation tracking)
  "role": "SENIOR_AUDITOR",     // Primary role (cached; refetched on refresh)
  "mfaVerified": true,          // Whether MFA was completed
  "mfaVerifiedAt": 1713559289,  // Unix timestamp
  "isSuperadmin": false,
  "impersonating": null,        // or { originalUserId: "..." }
  "iat": 1713559289,            // Issued at
  "exp": 1713560189,            // Expires at (15 min)
  "jti": "jwt_01hxkzt...",      // Unique token ID
  "iss": "aims.example.com",
  "aud": "aims.api"
}
```

### Signing Algorithm: EdDSA (Ed25519)
- **Fast**: 100x faster than RSA for signing
- **Small signatures**: 64 bytes vs RSA's 256+
- **Secure**: 128-bit equivalent security
- **Asymmetric**: Private key for signing, public key for verification (rotatable)

### Key Management
- **Key rotation**: Every 90 days
- **Grace period**: 30 days (both old and new keys verify during rotation)
- **Storage**: Private keys in **KMS** (AWS KMS / Azure Key Vault / HashiCorp Vault)
- **JWKS endpoint**: `/.well-known/jwks.json` for public key distribution (rarely needed — we verify internally)

### Token Size
~450 bytes base64-encoded. Small enough for cookie (4KB limit); fits comfortably.

---

## 3. Refresh Token Strategy

### Format
Random 32 bytes (256 bits), base64url encoded → 43 characters.

### Storage
- Raw token sent to client (httpOnly cookie)
- **SHA-256 hash** stored in `sessions.refreshTokenHash`
- Raw token never stored server-side
- Single DB lookup on refresh request

### Rotation Pattern
```
Initial login:
  Session created with:
    refreshTokenFamily: "fam_01hxkzt..."   (UUID)
    refreshTokenHash: sha256(token_1)
  Client receives token_1.

Refresh #1:
  Client POST /auth/refresh with token_1 (as cookie)
  Server:
    1. Look up session by sha256(token_1)
    2. Verify not expired, not revoked
    3. Generate token_2
    4. UPDATE session SET refreshTokenHash = sha256(token_2), lastUsedAt = now()
    5. Issue new access token + token_2 cookie
  Client receives token_2; token_1 is invalid.

Refresh #2:
  Client POST /auth/refresh with token_2
  [same as above]

Compromise detection:
  Attacker obtained token_1 somehow.
  Attacker POST /auth/refresh with token_1
  Server: sha256(token_1) not found in active sessions
           → It was already rotated → REUSE DETECTED
  Server:
    - Revoke entire refresh token family (all sessions with same family)
    - Log SUSPICIOUS_ACTIVITY
    - Email user: "Possible compromise — all sessions revoked, please log in"
```

### Why Family Tracking?
If we just revoke the specific token, attacker's next refresh still works (they got the new token). Family tracking closes this loophole.

### Reuse Window (Tolerance)
If tokens rotated within 30 seconds, second use of old token is tolerated (account for network races). This must be carefully bounded to avoid becoming an exploit window.

---

## 4. Cookie Configuration

```
Set-Cookie: aims_session=eyJ...; \
  HttpOnly; \
  Secure; \
  SameSite=Strict; \
  Path=/; \
  Max-Age=900; \
  Domain=app.aims.example.com

Set-Cookie: aims_refresh=abc...; \
  HttpOnly; \
  Secure; \
  SameSite=Strict; \
  Path=/api/auth/refresh; \
  Max-Age=86400
```

### Flags Explained

| Flag | Why |
|------|-----|
| `HttpOnly` | Prevents JavaScript access (protects from XSS) |
| `Secure` | Only sent over HTTPS (no plaintext transmission) |
| `SameSite=Strict` | Prevents CSRF for sensitive cookies (also blocks cross-site links) |
| `Path=/` (session) | Sent to all API routes |
| `Path=/api/auth/refresh` (refresh) | Only sent to refresh endpoint (reduces exposure) |
| `Domain=app.aims...` | Scoped to app subdomain only |
| `Max-Age=900` | 15-min expiry aligned with JWT exp |

### Cookie vs Header

**Browser (first-party)**: Cookies (automatic, HttpOnly safer than localStorage)
**Mobile apps**: Bearer headers (no cookie jar)
**External API**: Bearer with API keys (see `rest/README.md`)

---

## 5. Session Lifecycle

### Session Creation (Login)
```typescript
async function createSession({
  userId, tenantId, userAgent, ipAddress, deviceFingerprint,
  mfaVerified, rememberMe,
}): Promise<{ accessToken, refreshToken, session }> {

  const sessionId = cuid2();
  const refreshToken = generateSecureToken(32);     // 32 bytes
  const refreshTokenFamily = cuid2();
  const refreshTokenHash = sha256(refreshToken);

  const refreshTtl = rememberMe ? 30 * 86400 : 1 * 86400;  // 30d or 1d
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      tenantId,
      refreshTokenHash,
      refreshTokenFamily,
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
      userAgent, ipAddress, deviceFingerprint,
      mfaVerifiedAt: mfaVerified ? new Date() : null,
      mfaMethod: mfaVerified ? '...' : null,
    },
  });

  const accessToken = await signJwt({
    sub: userId,
    tenantId,
    sessionId,
    role: await resolveUserRole(userId, tenantId),
    mfaVerified,
    mfaVerifiedAt: session.mfaVerifiedAt?.getTime() / 1000,
  }, '15m');

  return { accessToken, refreshToken, session };
}
```

### Session Refresh
```typescript
async function refreshSession(refreshToken: string): Promise<{ accessToken, refreshToken }> {
  const hash = sha256(refreshToken);

  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hash, revokedAt: null },
    include: { user: true },
  });

  if (!session) {
    // Reuse detection: was this token ever valid?
    const rotated = await prisma.session.findFirst({
      where: { refreshTokenFamily: { in: /* any family with this hash in history */ } },
    });
    if (rotated) {
      // REUSE DETECTED — revoke family
      await revokeFamily(rotated.refreshTokenFamily);
      await logSuspiciousActivity(rotated.userId);
      throw new Error('Session revoked — possible compromise');
    }
    throw new Error('Invalid refresh token');
  }

  if (session.expiresAt < new Date()) {
    throw new Error('Session expired');
  }

  // Rotate
  const newRefreshToken = generateSecureToken(32);
  const newHash = sha256(newRefreshToken);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      lastUsedAt: new Date(),
    },
  });

  const newAccessToken = await signJwt({
    sub: session.userId,
    tenantId: session.tenantId,
    sessionId: session.id,
    role: await resolveUserRole(session.userId, session.tenantId),
    mfaVerified: !!session.mfaVerifiedAt,
  }, '15m');

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

### Session Revocation
```typescript
async function revokeSession(sessionId: string, reason: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
  // Note: JWT access token remains valid until expiry (max 15 min)
  // For critical revocations (compromise), clients should re-auth anyway
}

async function revokeAllSessionsForUser(userId: string, reason: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId && { id: { not: exceptSessionId } }),
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
}

async function revokeFamily(family: string) {
  await prisma.session.updateMany({
    where: { refreshTokenFamily: family, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'suspicious' },
  });
}
```

---

## 6. JWT Revocation — short-TTL + targeted Redis blocklist

**Problem**: JWTs are stateless. A revoked session's JWT still validates until exp (up to 15 min). For a fired admin or a credential-compromise response, 15 minutes is within SOC 2 CC6.3's "timely" interpretation but not "instant."

**Design**: per [ADR-0005](../references/adr/0005-session-revocation-hybrid.md), we use a *targeted* Redis blocklist keyed by a claim on the JWT itself, not a route-sensitivity decision. Normal-user traffic pays no blocklist latency. Tokens minted for sensitive roles or during active incidents get instant revocation via Redis.

### Solutions Considered

| Option | Latency | Revocation | Why rejected / chosen |
|---|---|---|---|
| A. Blocklist check on every request | Redis GET on every API call | Instant | ✗ Redis-on-every-request latency; ubiquitous dependency |
| B. Short-TTL only, no blocklist | Zero | Up to 15 min | ✗ Acceptable for SOC 2 "timely" but uncomfortable for fired admins |
| C. Full opaque sessions (no JWT) | Session store on every request | Instant | ✗ Loses JWT benefits; higher baseline latency |
| D. **Targeted blocklist via `blocklist_checkable` claim** | Zero for most requests, Redis GET only for flagged tokens | Instant for flagged; 15 min otherwise | ✓ **Chosen** — [ADR-0005](../references/adr/0005-session-revocation-hybrid.md) |

### Chosen: Targeted blocklist via `blocklist_checkable` claim

Every JWT carries a `blocklist_checkable: boolean` claim, set at mint time based on the user's role + current security context. The auth middleware branches:

- `blocklist_checkable: false` (normal users, default) — signature verification only. No Redis hit. No per-request latency cost.
- `blocklist_checkable: true` (admins, elevated-access sessions, tokens minted during an active incident) — signature verification *and* Redis blocklist GET (sub-2ms, DEK-cached). If the token's `jti` is in the blocklist, reject with 401.

```typescript
// Token mint (at login or session refresh):
const blocklistCheckable = shouldCheckBlocklist(user, activeSecurityEvents);
// See auth/REVOCATION-POLICY.md for the full matrix of roles/scenarios.

const token = await signJWT({
  sub: user.id,
  tenant: user.tenantId,
  role: user.role,
  jti: generateJti(),
  blocklist_checkable: blocklistCheckable,
  exp: Math.floor(Date.now() / 1000) + 900,  // 15 min
});
```

```typescript
// Auth middleware:
const claims = await verifyJWT(token);

if (claims.blocklist_checkable) {
  const revoked = await redis.exists(`revoked:jti:${claims.jti}`);
  if (revoked) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token revoked' });
  }
}

// Proceed with authenticated request.
```

```typescript
// On revocation (admin-initiated session kill, security incident, forced global logout):
// A NestJS worker reads revocation events from SQS and populates the blocklist.
await redis.setex(
  `revoked:jti:${jti}`,
  remainingTtl,  // == original JWT exp - now(); auto-evicts when JWT would have expired naturally
  '1'
);
```

### Which tokens are `blocklist_checkable`?

See **[auth/REVOCATION-POLICY.md](REVOCATION-POLICY.md)** for the full matrix. Summary:

- **Admin roles** — platform admin, tenant admin, CAE
- **Audit-platform-sensitive privileges** — cross-tenant reporting, user management, financial-data access
- **Active incident** — tokens issued within 15 minutes of a global or tenant-scoped security event
- **Elevated-access sessions** — on-call engineers during a shift, auditors during final-issuance windows

Normal user tokens are not `blocklist_checkable`. They rely on the 15-minute TTL for natural revocation — this satisfies SOC 2 CC6.3, ISO 27001 A.9.2.6, and HIPAA §164.308(a)(3)(ii)(C) in standard interpretations.

### Revocation propagation flow

1. Admin clicks "terminate user session" in the admin console
2. API writes a `session.revoke_requested` event to the outbox
3. NestJS revocation worker reads the outbox event, enumerates the user's active `jti` values from the `user_active_tokens` Redis set, adds each to the blocklist with appropriate TTL
4. Next request from the user bearing any of those tokens (if `blocklist_checkable: true`) is rejected in the auth middleware

From revocation request to effective denial: typically under 5 seconds end-to-end.

### Special Case: Password Change / MFA Change

Revoke all of the user's active tokens by enumerating `user_active_tokens:{userId}` and adding every `jti` to the blocklist. Also invalidate the refresh-token family so next refresh fails.

Applied to every user token regardless of `blocklist_checkable` — password changes are security-significant; we accept the Redis check on next request for these users. Token TTL ≤15 min bounds the blocklist entries' lifetime.

---

## 7. Multi-Device Management

Users can see all active sessions and revoke individually.

### Self-Service UI
`/account/security/sessions`:
```
Active Sessions (4)

Current device                             [Current]
  Safari on macOS · 192.168.1.5
  Created 2 hours ago · Last used just now

iPhone 15 Pro                              [Revoke]
  Safari on iOS · 192.168.1.10
  Created 3 days ago · Last used 2 hours ago

Windows laptop                             [Revoke]
  Chrome on Windows · 172.16.0.5
  Created 7 days ago · Last used 1 day ago

Unknown device — Mumbai, India             [Revoke!]
  Chrome on Windows · 103.xxx.xxx.xxx
  Created 10 minutes ago · Last used 10 minutes ago

[ Log out all other devices ]
```

### Risk Indicators
UI highlights suspicious sessions:
- **New location** (different country than usual)
- **New device** (fingerprint not seen before)
- **Long idle** (last used 7+ days ago)

Users can click "Revoke" for any session or "Log out all other devices" button.

---

## 8. Remember Me

Checkbox at login extends refresh token lifetime:
- Default: 1 day
- Remember Me: 30 days

Stored in JWT claim? No — in session record. Refresh tokens always honor the session's `expiresAt`.

**Compliance note**: For regulated industries, may want to disable Remember Me (tenant policy). E.g., SOX-regulated tenants may require daily re-auth.

---

## 9. Session Extension on Activity

If user is actively using the app, should sessions extend?

### Option A: Fixed Expiry (No Extension)
- Session expires at `createdAt + ttl`
- Even active users get kicked out at the limit
- Simpler, more secure

### Option B: Sliding Window (Refresh Extends)
- Each refresh extends expiry: `lastUsedAt + ttl`
- Active users stay logged in indefinitely
- More user-friendly

### Chosen: **Option B (Sliding)** with **Hard Cap**

- Refresh extends `expiresAt` by session TTL from `lastUsedAt`
- BUT hard cap at **30 days from initial login** (SOX-friendly)
- After 30 days, user must re-authenticate even if active

Configurable per tenant policy.

---

## 10. Concurrent Session Limits

### Per User
Default: unlimited concurrent sessions.

### Per Tenant (optional policy)
Admins can configure:
- `max_sessions_per_user = 10` (revoke oldest when exceeded)
- `max_sessions_per_role.ADMIN = 3` (tighter for privileged roles)

Useful for security-conscious tenants.

---

## 11. Session Storage: PostgreSQL vs Redis

We store sessions in **PostgreSQL** (sessions table), not Redis.

### Why PostgreSQL?
- Durable (survives Redis eviction)
- Source of truth
- Rich querying (list by user, by tenant, analytics)
- ACID (rotation is consistent)
- RLS applies naturally

### Redis for Caching
- Revocation blocklist (short TTL, fast check)
- Rate limit counters
- MFA challenge tokens (5-min TTL)

Don't store auth state only in Redis (if Redis down, everyone logs out).

---

## 12. IP Address Binding (Optional)

Binding a session to an IP prevents token theft... unless attacker is on same network.

### When to Enable
- **High-security tenants** (government, financial) can opt in
- **Default: off** (mobile users change IPs frequently)

### Implementation
```typescript
// On session create:
session.allowedIpMask = '/24';  // First 3 octets

// On validation:
if (!ipInRange(request.ip, session.ipAddress, session.allowedIpMask)) {
  revokeSession(session.id, 'ip_mismatch');
  throw new TRPCError({ code: 'UNAUTHORIZED' });
}
```

### Alternative: Device Fingerprint Binding
Less restrictive than IP. Binds session to device fingerprint (user agent + canvas hash + fonts + timezone). Still bypassable by sophisticated attackers.

---

## 13. Background Session Cleanup

### Daily Job
```sql
DELETE FROM sessions
WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '90 days';

DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '90 days';
```

### Audit Trail Retained
Deleting session rows doesn't delete `audit.auth_events` — those have their own 7-year retention.

### Via pg_cron
```sql
SELECT cron.schedule('session-cleanup', '0 3 * * *',
  $$ DELETE FROM sessions WHERE ... $$);
```

---

## 14. Analytics & Monitoring

### Metrics to Track
- Active sessions count (per tenant)
- Session creation rate
- Session revocation rate (by reason)
- Refresh token usage rate
- Suspicious activity flags (reuse detection, anomalies)
- Average session duration
- Remember-me opt-in rate

### Alerts
- Spike in refresh token reuse → possible token theft campaign
- Unusual geographic distribution → credential stuffing
- Mass logouts → potential incident

---

## 15. Session Data in tRPC Context

From `api/trpc/context.ts`, every authenticated request has:
```typescript
ctx.auth = {
  userId: string,
  tenantId: string,
  sessionId: string,
  userRole: string,
  permissions: Set<string>,
  mfaVerified: boolean,
  isSuperadmin: boolean,
  impersonating?: { originalUserId: string },
};
```

Middleware sets this from verified JWT. No DB lookup per request (unless checking revocation list in Redis).

---

## 16. Migration from Legacy Auth (Future)

If we ever migrate from Better Auth to something else (Zitadel, custom), the migration plan:

1. **Dual-running period**: Both auth systems active
2. **Issue tokens from new system**, accept tokens from either
3. **Migrate user data** (users, sessions, MFA credentials)
4. **Grace period**: Users gradually re-authenticate on new system
5. **Deprecate old system**

Keeping session logic behind a service interface makes this possible.

---

## Summary

| Aspect | Choice |
|--------|--------|
| Access token format | JWT (EdDSA-signed, 15 min) |
| Refresh token format | Opaque random (32 bytes) |
| Refresh token storage | SHA-256 hash in DB |
| Rotation | Every refresh, with family tracking |
| Cookies | HttpOnly, Secure, SameSite=Strict |
| Key rotation | 90 days with 30-day grace |
| Revocation | Short TTL (15 min) + targeted Redis blocklist via `blocklist_checkable` JWT claim (ADR-0005; see REVOCATION-POLICY.md) |
| Sessions DB | PostgreSQL |
| Max lifetime | 30 days (configurable per tenant) |
| Remember Me | Extends refresh TTL to 30 days |
| Multi-device | Full support + management UI |
| Step-up | Re-verify MFA for sensitive actions |
| IP binding | Optional (per tenant) |
| Cleanup | Daily pg_cron |
