# Auth Architecture

> Complete system design for identity and authentication.

---

## System Context

```
┌──────────────┐     ┌───────────────────────────────────────┐
│   Browser    │     │         AIMS v2 Backend              │
│   (Next.js)  │     │                                      │
│              │     │   ┌──────────────────────────────┐  │
│  ┌────────┐  │     │   │   Auth Subsystem             │  │
│  │ React  │◀─┼─────┼──▶│   • Login/Logout             │  │
│  │ App    │  │     │   │   • Session mgmt             │  │
│  └────────┘  │     │   │   • MFA / WebAuthn           │  │
│              │     │   │   • Password/token          │  │
│  (Session    │     │   └────────┬─────────────────────┘  │
│   cookie)    │     │            │                        │
└──────────────┘     │   ┌────────┴─────────────────────┐  │
                     │   │   Permission Engine          │  │
┌──────────────┐     │   │   • RBAC evaluation          │  │
│ External IdP │     │   │   • ABAC policies            │  │
│ (Okta, AAD,  │◀────┼──▶│   • Decision caching (Redis) │  │
│  ADFS, etc.) │ SAML│   └────────┬─────────────────────┘  │
└──────────────┘     │            │                        │
                     │   ┌────────┴─────────────────────┐  │
                     │   │   tRPC / REST Routers        │  │
                     │   │   (use ctx.auth from context)│  │
                     │   └────────┬─────────────────────┘  │
                     │            │                        │
                     │   ┌────────┴─────────────────────┐  │
                     │   │   PostgreSQL (RLS)           │  │
                     │   │   • users, user_tenants      │  │
                     │   │   • sessions                 │  │
                     │   │   • mfa_credentials          │  │
                     │   │   • passkey_credentials      │  │
                     │   │   • sso_configurations       │  │
                     │   └──────────────────────────────┘  │
                     └───────────────────────────────────────┘
```

---

## Entity Model (Additions to Prisma Schema)

The database schema in `database/schema.prisma` already has `User`, `UserTenant`, and `Tenant` models. We need to add auth-specific entities:

### Session Table
```prisma
model Session {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId          String    // Current active tenant for this session

  // Token management
  refreshTokenHash  String    @unique  // SHA-256 of refresh token (never store plaintext)
  refreshTokenFamily String   // For refresh token rotation family tracking

  // Lifecycle
  createdAt         DateTime  @default(now()) @db.Timestamptz(6)
  lastUsedAt        DateTime  @default(now()) @db.Timestamptz(6)
  expiresAt         DateTime  @db.Timestamptz(6)
  revokedAt         DateTime? @db.Timestamptz(6)
  revokedReason     String?   // 'logout', 'password_reset', 'suspicious', 'admin_revoked'

  // Client metadata
  ipAddress         String?   @db.Inet
  userAgent         String?
  deviceFingerprint String?
  location          Json?     // GeoIP (city, country) for "new location" alerts

  // MFA state (for session)
  mfaVerifiedAt     DateTime? @db.Timestamptz(6)
  mfaMethod         String?   // 'totp', 'webauthn', 'backup_code'

  // Impersonation
  impersonatorUserId String? // If superadmin impersonating

  @@index([userId, revokedAt])
  @@index([tenantId])
  @@index([expiresAt])
  @@index([refreshTokenFamily])
  @@map("sessions")
  @@schema("public")
}
```

### MFA Credentials
```prisma
model MfaCredential {
  id                String    @id @default(cuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  type              MfaType   // TOTP | WEBAUTHN | BACKUP_CODES

  // TOTP
  totpSecret        String?   // Encrypted via ALE
  totpIssuer        String?   @default("AIMS")

  // WebAuthn (multiple credentials per user)
  credentialId      String?   @unique @db.Text
  publicKey         String?   @db.Text  // Base64
  counter           BigInt?
  transports        String[]  // 'usb', 'nfc', 'ble', 'internal', 'hybrid'
  aaguid            String?   // Authenticator model identifier
  attestationType   String?
  backupEligible    Boolean?  // Per WebAuthn L3
  backupState       Boolean?  // Per WebAuthn L3

  // Backup codes (stored as hashes)
  backupCodes       String[]  // Array of Argon2id hashes

  // Metadata
  nickname          String?   // User-friendly name ("My iPhone", "YubiKey 5")
  enrolledAt        DateTime  @default(now()) @db.Timestamptz(6)
  lastUsedAt        DateTime? @db.Timestamptz(6)
  disabled          Boolean   @default(false)

  @@index([userId, type])
  @@map("mfa_credentials")
  @@schema("public")
}

enum MfaType {
  TOTP
  WEBAUTHN
  BACKUP_CODES
  @@schema("public")
}
```

### Password Reset Tokens
```prisma
model PasswordResetToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  tokenHash   String    @unique  // SHA-256 of the token (never store raw)
  expiresAt   DateTime  @db.Timestamptz(6)
  usedAt      DateTime? @db.Timestamptz(6)
  ipAddress   String?   @db.Inet

  createdAt   DateTime  @default(now()) @db.Timestamptz(6)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
  @@schema("public")
}
```

### Email Verification Tokens
Similar shape to password reset, separate table for lifecycle clarity.

### User Invitations
```prisma
model UserInvitation {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  email          String
  role           String
  permissions    Json?      // Optional role overrides

  invitedById    String
  invitedAt      DateTime  @default(now()) @db.Timestamptz(6)

  tokenHash      String    @unique
  expiresAt      DateTime  @db.Timestamptz(6)
  acceptedAt     DateTime? @db.Timestamptz(6)
  acceptedByUserId String? // Set when invitation accepted

  revokedAt      DateTime? @db.Timestamptz(6)
  revokedBy      String?

  @@unique([tenantId, email])
  @@index([tokenHash])
  @@index([expiresAt])
  @@map("user_invitations")
  @@schema("public")
}
```

### SSO Configuration
```prisma
model SsoConfiguration {
  id                 String    @id @default(cuid())
  tenantId           String
  tenant             Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  protocol           SsoProtocol  // SAML | OIDC
  name               String        // "Corporate Okta", "Azure AD"

  // Domain verification (tenant owns these email domains)
  emailDomains       String[]     // ["acme.com", "acme-corp.com"]
  domainsVerifiedAt  DateTime?    @db.Timestamptz(6)

  // Behavior
  enabled            Boolean      @default(false)
  jitProvisioning    Boolean      @default(true)
  defaultRole        String?      // Role for auto-provisioned users
  enforceMfaViaSso   Boolean      @default(false)
  autoLockLocalAuth  Boolean      @default(false)  // Disable email+password for SSO users

  // SAML-specific
  samlMetadataUrl    String?
  samlMetadataXml    String?      @db.Text
  samlEntityId       String?
  samlSsoUrl         String?
  samlX509Cert       String?      @db.Text
  samlSignRequests   Boolean?     @default(true)
  samlSignatureAlg   String?      @default("rsa-sha256")

  // OIDC-specific
  oidcIssuer         String?
  oidcClientId       String?
  oidcClientSecret   String?      // Encrypted via ALE
  oidcScopes         String[]     @default(["openid", "email", "profile"])

  // Attribute mapping (configurable per customer)
  attributeMapping   Json         @default("{}") // e.g., { email: "mail", name: "displayName", ... }

  // SCIM (provisioning)
  scimEnabled        Boolean      @default(false)
  scimToken          String?      // Bearer token (encrypted; shown once)
  scimEndpointUrl    String?      // /api/scim/v2/{tenant}/Users etc.

  createdAt          DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt          DateTime     @updatedAt @db.Timestamptz(6)

  @@index([tenantId])
  @@map("sso_configurations")
  @@schema("public")
}

enum SsoProtocol {
  SAML
  OIDC
  @@schema("public")
}
```

### Auth Event Log
Distinct from general `audit_log` — higher volume, specific schema for security analytics.

```prisma
model AuthEvent {
  id              String    @id @default(cuid())
  tenantId        String?   // Null for failed logins before tenant resolution
  userId          String?

  eventType       AuthEventType
  success         Boolean

  // Context
  email           String?   // Email attempted (for LOGIN_FAILED)
  ipAddress       String?   @db.Inet
  userAgent       String?
  deviceFingerprint String?
  geolocation     Json?

  // Additional metadata
  failureReason   String?   // 'invalid_password', 'mfa_failed', 'locked', etc.
  mfaMethod       String?   // If MFA was used
  authProvider    String?   // 'password', 'google_oauth', 'saml:okta', etc.

  sessionId       String?   // If session created

  loggedAt        DateTime  @default(now()) @db.Timestamptz(6)

  @@index([userId, loggedAt])
  @@index([tenantId, eventType, loggedAt])
  @@index([email, loggedAt])  // For brute force detection
  @@index([ipAddress, loggedAt])
  @@map("auth_events")
  @@schema("audit")
}

enum AuthEventType {
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  SESSION_REFRESHED
  SESSION_REVOKED
  MFA_ENROLLED
  MFA_CHALLENGE
  MFA_VERIFIED
  MFA_FAILED
  MFA_REMOVED
  PASSWORD_CHANGED
  PASSWORD_RESET_REQUESTED
  PASSWORD_RESET_COMPLETED
  EMAIL_VERIFIED
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
  SUSPICIOUS_ACTIVITY
  IMPERSONATION_STARTED
  IMPERSONATION_ENDED
  INVITATION_SENT
  INVITATION_ACCEPTED
  INVITATION_REVOKED
  SSO_LOGIN_SUCCESS
  SSO_LOGIN_FAILED
  SSO_JIT_PROVISIONED
  DEVICE_TRUST_GRANTED
  @@schema("audit")
}
```

---

## Request Lifecycle

### 1. Unauthenticated Request
```
Browser ────► GET /api/health
              ├─ No auth cookie
              ├─ tRPC middleware: auth resolves to null
              ├─ publicProcedure executes
              └─ Response
```

### 2. Authenticated Request (Session Cookie)
```
Browser ────► GET /api/engagements
              ├─ Cookie: aims_session=<JWT or opaque>
              ├─ tRPC middleware: context.ts resolves auth
              │   ├─ Verify JWT signature + expiry
              │   ├─ Load user_tenant (check active)
              │   ├─ Load permissions (role-based + overrides, cached)
              │   └─ Build AuthContext
              ├─ tenantContext middleware: SET LOCAL app.current_tenant_id
              ├─ authRequired middleware: passes (auth present)
              ├─ rateLimitCheck: OK
              ├─ Procedure executes with ctx.auth
              └─ Response
```

### 3. Session Expiry → Auto-Refresh
```
Browser ────► GET /api/engagements
              ├─ Cookie: aims_session (access token expired)
              ├─ Middleware: 401 UNAUTHENTICATED
              │
Browser ◄──── 401
      │
      ▼
Browser ────► POST /api/auth/refresh
              ├─ Cookie: aims_refresh=<refresh token>
              ├─ Verify refresh token (DB lookup by hash)
              ├─ Rotate: issue new access + refresh tokens
              ├─ Revoke old refresh token
              └─ Set-Cookie: aims_session=..., aims_refresh=...
      │
      ▼
Browser ────► GET /api/engagements (retry)
              └─ Succeeds
```

If refresh fails (revoked, expired) → redirect to login.

### 4. MFA-Required Login
```
Browser ────► POST /api/auth/login
              └─ Body: { email, password }
              
Server checks credentials OK + MFA enrolled
              
Server ────► 200 { mfaRequired: true, mfaToken: "mfa_challenge_xxx" }
              └─ mfaToken is short-lived (5 min) and bound to credentials check
      │
      ▼
Browser ────► POST /api/auth/mfa/verify
              └─ Body: { mfaToken, method: "totp" | "webauthn", code: "123456" }
              
Server verifies MFA, creates full session
              
Server ────► 200 { user, tenant }
              └─ Set-Cookie: aims_session, aims_refresh
```

---

## Cryptographic Primitives

| Purpose | Algorithm | Parameters |
|---------|-----------|-----------|
| Password hashing | **Argon2id** | m=64MB, t=3, p=4 (adjust as hardware improves) |
| Token hashing (reset, invite) | **SHA-256** | Store digest, never plaintext |
| JWT signing | **EdDSA (Ed25519)** | Asymmetric; public key verification |
| Session ID | **CSPRNG** | 32 bytes, base64url encoded |
| TOTP | **HMAC-SHA1** | 30-sec window, 6-digit code (per RFC 6238) |
| WebAuthn | **ES256 / EdDSA / RS256** | Per authenticator |
| Data encryption (at rest) | **AES-256-GCM** | Via ALE / KMS |
| Password breach check | **k-anonymity hash** | First 5 chars of SHA-1 to HIBP API |
| Signed hash (e-signatures) | **SHA-256** | With user session context |

### Why EdDSA for JWT (Not HS256/RS256)
- **EdDSA (Ed25519)**: Fast, small signatures (64 bytes), secure
- **HS256** (symmetric): Requires shared secret everywhere that verifies; harder to rotate
- **RS256** (RSA): Larger signatures, slower, equivalent security to EdDSA

### Why Argon2id (Not bcrypt)
- Memory-hard (GPU/ASIC-resistant); bcrypt is only CPU-hard
- OWASP recommendation (as of 2024)
- Won the Password Hashing Competition (2015)

---

## Tenant Resolution

When a user logs in:

1. **Single tenant membership**: Tenant resolved automatically
2. **Multiple tenants**: User presented with tenant switcher OR uses default tenant
3. **SSO via verified domain**: Tenant resolved by email domain (acme.com → Acme tenant)
4. **Invitation**: Tenant specified in invitation token

Current tenant stored in:
- JWT `tenantId` claim (access token)
- Session table `tenantId` field

Switching tenants = new session (security best practice).

---

## Multi-Tenant User Considerations

A user can belong to multiple tenants (consultant serving multiple clients, platform admin, etc.):
- Email is globally unique (one user account per email)
- User ↔ Tenant is many-to-many via `user_tenants`
- Per-tenant role and permission overrides
- User profile is shared across tenants (name, avatar, preferences)
- Audit trail uses `userId` + `tenantId` pair

**Security consideration**: A user's password rotation applies globally. Tenant admins cannot force password changes for users in other tenants.

---

## Integration Points

### With Database (RLS)
Auth middleware sets PostgreSQL session vars on every authenticated request:
```sql
SET LOCAL app.current_tenant_id = '...';
SET LOCAL app.current_user_id   = '...';
SET LOCAL app.is_superadmin     = 'true'|'false';
```

### With API (tRPC context)
`ctx.auth` populated by auth middleware (see `api/trpc/context.ts`). Includes:
- userId, tenantId, sessionId
- userRole, permissions (Set)
- mfaVerified, isSuperadmin
- impersonating? { originalUserId }

### With Audit Log
Auth events flow to both:
- `audit.auth_events` — auth-specific, high volume
- `audit.audit_log` — general audit trail (for ROLE_CHANGED, impersonation, etc.)

### With Notifications
Auth security events trigger notifications:
- New device login → email notification
- Password changed → email notification
- MFA enrolled/removed → email notification
- Suspicious activity → email + optional SMS

### With Webhooks
Outbound events for tenant admin monitoring:
- `user.invited`, `user.joined`, `user.role_changed`, `user.deactivated`
- `sso.login_failed` (if enterprise tenant wants monitoring)

---

## Scalability Considerations

- **Stateless access tokens (JWT)** — no DB hit on every request
- **Refresh token rotation** — blast radius of leaked token is one usage
- **Session table pruning** — background job removes expired sessions nightly
- **Permission caching** — Redis cache per user (invalidated on role change)
- **Rate limiting** — Redis-backed token bucket, scales horizontally
- **SSO metadata caching** — per-tenant IdP metadata cached 5min
- **MFA challenge tokens** — short-lived (5 min), stored in Redis (not DB)

---

## Admin Operations

### Platform Admin (Superadmin)
Can:
- Impersonate any user (heavily audited)
- Reset any user's MFA (emergency)
- Force logout any session
- View auth events across tenants
- Manage tenant SSO configuration (optional; usually tenant admin)

### Tenant Admin
Can:
- Invite / remove users
- Change user roles
- Configure MFA enforcement (require for all, specific roles, optional)
- Configure SSO (SAML / OIDC)
- View auth events for their tenant
- Force logout users within their tenant

### User (Self-Service)
Can:
- Change password
- Manage MFA methods (enroll/remove TOTP, passkeys, backup codes)
- View active sessions + revoke
- View login history
- Download personal data (GDPR)
- Request account deletion (GDPR)

---

## Next: See Detailed Documents

- [FLOWS.md](FLOWS.md) — User-facing flows
- [SESSION-MANAGEMENT.md](SESSION-MANAGEMENT.md) — JWT + refresh + revocation
- [MFA.md](MFA.md) — TOTP + passkeys
- [SSO.md](SSO.md) — SAML + OIDC + SCIM
- [PERMISSIONS.md](PERMISSIONS.md) — RBAC + ABAC
- [SECURITY.md](SECURITY.md) — Threat model + mitigations
