# Authentication Flows

> All user-facing auth flows with sequence diagrams, state transitions, and error handling.

---

## Flow Catalog

| Flow | Document |
|------|----------|
| 1. Tenant signup (first admin) | §1 below |
| 2. Email + password login | §2 |
| 3. Login with MFA | §3 |
| 4. Passkey (WebAuthn) login | §4 |
| 5. Magic link login | §5 |
| 6. OAuth / social login | §6 |
| 7. Password reset | §7 |
| 8. Email verification | §8 |
| 9. User invitation | §9 |
| 10. MFA enrollment (TOTP) | §10 |
| 11. MFA enrollment (passkey) | §11 |
| 12. MFA disable | §12 |
| 13. SSO login (SAML) | §13 |
| 14. SSO login (OIDC) | §14 |
| 15. Tenant switch | §15 |
| 16. Session refresh | §16 |
| 17. Logout (single + all devices) | §17 |
| 18. Session revocation by admin | §18 |
| 19. Password change | §19 |
| 20. Impersonation (support) | §20 |
| 21. Step-up authentication (re-auth for sensitive ops) | §21 |

---

## 1. Tenant Signup (First Admin)

New customer creates a tenant. Self-serve for free/pro tier; sales-assisted for enterprise.

### Happy Path

```
User                Browser            Server                DB              Email Service
 │                    │                  │                    │                   │
 │ Fill signup form   │                  │                    │                   │
 │──────────────────▶ │                  │                    │                   │
 │                    │ POST /auth/signup│                    │                   │
 │                    │─────────────────▶│                    │                   │
 │                    │                  │ Validate inputs    │                   │
 │                    │                  │ Check HIBP breach  │                   │
 │                    │                  │                    │                   │
 │                    │                  │ Create Tenant      │                   │
 │                    │                  │───────────────────▶│                   │
 │                    │                  │ Create User        │                   │
 │                    │                  │───────────────────▶│                   │
 │                    │                  │ Create UserTenant  │                   │
 │                    │                  │ (role: ADMIN)      │                   │
 │                    │                  │───────────────────▶│                   │
 │                    │                  │ Create verification│                   │
 │                    │                  │  token             │                   │
 │                    │                  │───────────────────▶│                   │
 │                    │                  │                    │                   │
 │                    │                  │ Send verify email  │                   │
 │                    │                  │───────────────────────────────────────▶│
 │                    │                  │                    │                   │
 │                    │  201 + session   │                    │                   │
 │                    │◀─────────────────│                    │                   │
 │ Redirect to onboard│                  │                    │                   │
 │  (email verify     │                  │                    │                   │
 │   banner shown)    │                  │                    │                   │
 │                    │                  │                    │                   │
 │ Click verify link  │                  │                    │                   │
 │ in email           │                  │                    │                   │
 │──────────────────▶ │                  │                    │                   │
 │                    │ GET /auth/verify?│                    │                   │
 │                    │  token=...       │                    │                   │
 │                    │─────────────────▶│                    │                   │
 │                    │                  │ Verify token       │                   │
 │                    │                  │ Mark email verified│                   │
 │                    │                  │───────────────────▶│                   │
 │                    │                  │                    │                   │
 │                    │  200 + redirect  │                    │                   │
 │                    │◀─────────────────│                    │                   │
```

### Input Validation
- **Email**: valid format, not already registered, domain not on blocklist
- **Password**: min 12 chars, Argon2 pre-hash complexity check, HIBP breach check
- **Organization name**: 1-200 chars
- **Data region**: user selects (US, EU, UK, India, etc.) — **immutable after signup**
- **Terms acceptance**: must be checked
- **hCaptcha**: required for signup (bot prevention)

### State Transitions
```
User.status:       null → INVITED → ACTIVE
User.emailVerified:null → <datetime>
Tenant.status:     null → ACTIVE
UserTenant.role:   null → ADMIN
```

### Errors
| Scenario | Code | HTTP | User Message |
|----------|------|------|--------------|
| Email already exists | `CONFLICT` | 409 | "Email already in use. Log in or reset password." |
| Password in HIBP breach | `BUSINESS_RULE_VIOLATION` | 422 | "This password has been found in data breaches. Please choose a different one." |
| Disposable email domain | `BUSINESS_RULE_VIOLATION` | 422 | "Disposable email addresses are not allowed." |
| Captcha failed | `BAD_REQUEST` | 400 | "Captcha verification failed. Please try again." |
| Rate limited (signup) | `TOO_MANY_REQUESTS` | 429 | "Too many signups from this IP. Try again later." |

### Security Considerations
- **Rate limit**: 3 signups per IP per hour
- **Bot prevention**: hCaptcha + domain validation
- **Tenant slug**: Auto-generated from org name; user can customize post-signup
- **Default data region**: Inferred from IP geolocation; user can override
- **Email on file**: `tenants.primary_contact_email` set to first admin's email

### Session Behavior
Signup creates a session immediately (don't force login right after). User is logged in with `emailVerified = false`. Some actions (billing, adding users) are blocked until verification.

---

## 2. Email + Password Login

### Happy Path (No MFA)

```
User         Browser            Server              DB              Redis
 │             │                  │                  │                │
 │ Enter creds │                  │                  │                │
 │───────────▶ │                  │                  │                │
 │             │ POST /auth/login │                  │                │
 │             │─────────────────▶│                  │                │
 │             │                  │ Rate limit check │                │
 │             │                  │─────────────────────────────────▶ │
 │             │                  │                  │                │
 │             │                  │ Lookup user      │                │
 │             │                  │─────────────────▶│                │
 │             │                  │ Verify password  │                │
 │             │                  │  (Argon2id)      │                │
 │             │                  │                  │                │
 │             │                  │ Check account    │                │
 │             │                  │  status (not     │                │
 │             │                  │  locked)         │                │
 │             │                  │                  │                │
 │             │                  │ Check MFA        │                │
 │             │                  │  enrolled?       │                │
 │             │                  │─────────────────▶│                │
 │             │                  │  NO              │                │
 │             │                  │                  │                │
 │             │                  │ Create session   │                │
 │             │                  │ Issue tokens     │                │
 │             │                  │                  │                │
 │             │                  │ Log AuthEvent    │                │
 │             │                  │ (LOGIN_SUCCESS)  │                │
 │             │                  │                  │                │
 │             │ 200 + Set-Cookie │                  │                │
 │             │◀─────────────────│                  │                │
 │ Dashboard   │                  │                  │                │
 │◀──────────── │                  │                  │                │
```

### Inputs
```json
POST /auth/login
{
  "email": "jane@example.com",
  "password": "••••••••••••••••",
  "tenantSlug": "acme",               // Optional: for users with multiple tenants
  "rememberMe": true                   // Extends refresh token lifetime to 30d vs 1d
}
```

### Output (No MFA)
```json
{
  "user": { "id": "...", "email": "...", "name": "..." },
  "tenant": { "id": "...", "name": "...", "slug": "..." },
  "mfaRequired": false
}
```
Cookies set: `aims_session`, `aims_refresh`

### Output (MFA Required)
```json
{
  "mfaRequired": true,
  "mfaToken": "mfa_01HXKZT3...",
  "mfaTokenExpiresAt": "2026-04-19T10:37:00Z",
  "mfaMethods": [
    { "type": "WEBAUTHN", "id": "...", "nickname": "MacBook Pro" },
    { "type": "TOTP", "id": "...", "nickname": "Authy" }
  ]
}
```
No session cookie yet — must complete MFA.

### Rate Limiting
- **Per email**: 5 failures in 15 min → account lockout (15 min, exponential backoff)
- **Per IP**: 10 failures in 1 min → temporary IP block
- **Global**: Suspicious spike triggers monitoring alert (possible credential stuffing)

### Lockout Behavior
When account locked:
```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account temporarily locked due to too many failed login attempts.",
    "details": { "unlockAt": "2026-04-19T10:45:00Z" }
  }
}
```
Email sent to user alerting to attempted logins.

### Errors
| Scenario | Code | HTTP |
|----------|------|------|
| Invalid credentials | `UNAUTHORIZED` | 401 |
| Account not verified | `FORBIDDEN` | 403 |
| Account locked | `FORBIDDEN` | 403 |
| Account deactivated | `FORBIDDEN` | 403 |
| Tenant suspended | `FORBIDDEN` | 403 |
| SSO required for this email domain | `FORBIDDEN` | 403 → redirect to SSO |
| Rate limited | `TOO_MANY_REQUESTS` | 429 |

### Security Notes
- **Constant-time response**: login failures return same error regardless of reason (prevents email enumeration)
- **Password verification delay**: minimum 500ms response time on failure (prevents timing attacks)
- **Breach detection**: if email domain matches a tenant's SSO config, force SSO (prevents bypass)
- **Device fingerprint**: captured for risk scoring (new device → email alert)

---

## 3. Login with MFA

Continues from Flow 2 when `mfaRequired = true`.

```
[Continuation from Flow 2]

Browser shows MFA challenge UI (TOTP input or WebAuthn prompt)
  │
  ▼
User selects MFA method
  │
  ▼
POST /auth/mfa/verify
  │
Body: {
  mfaToken: "mfa_01HXKZT3...",
  method: "TOTP" | "WEBAUTHN" | "BACKUP_CODE",
  // For TOTP:
  code: "123456",
  // For WEBAUTHN:
  credentialId: "...",
  authenticatorData: "...",
  clientDataJSON: "...",
  signature: "...",
  // For BACKUP_CODE:
  backupCode: "xxxx-xxxx-xxxx"
}
  │
  ▼
Server:
  1. Validate mfaToken (not expired, not used)
  2. Load associated credentials check
  3. Verify MFA challenge (per method)
  4. Mark mfaToken as used (one-shot)
  5. Create session with mfaVerifiedAt timestamp
  6. Log AuthEvent (MFA_VERIFIED)
  │
  ▼
200 + Set-Cookie: aims_session, aims_refresh
```

### Fallback: Backup Codes
If user loses their MFA device (lost phone, broken YubiKey), they can use a backup code. Each code is:
- One-time use
- 16 characters (e.g., `abcd-1234-efgh-5678`)
- Stored as Argon2id hashes
- Generated in sets of 10 at MFA enrollment
- Re-generated on demand (old ones invalidated)

After using backup code, user is prompted to re-enroll MFA.

---

## 4. Passkey (WebAuthn) Login

Passkeys allow **passwordless** login — user authenticates with platform authenticator (Touch ID, Face ID, Windows Hello, YubiKey).

### Flow

```
Browser                  Server                        Authenticator
  │                        │                              │
  │ GET /auth/passkey/     │                              │
  │   options              │                              │
  │───────────────────────▶│                              │
  │                        │ Generate PublicKeyCredential │
  │                        │   RequestOptions             │
  │                        │  • challenge (random, stored │
  │                        │     in Redis)                │
  │                        │  • rpId: "aims.example.com"  │
  │                        │  • allowCredentials: []      │
  │                        │    (discoverable creds)      │
  │ 200 options            │                              │
  │◀───────────────────────│                              │
  │                        │                              │
  │ navigator.credentials. │                              │
  │   get(options)         │                              │
  │───────────────────────────────────────────────────────▶│
  │                        │                              │
  │                        │    User presents biometric /│
  │                        │    inserts key / taps phone │
  │                        │                              │
  │ PublicKeyCredential    │                              │
  │◀───────────────────────────────────────────────────────│
  │                        │                              │
  │ POST /auth/passkey/    │                              │
  │   verify               │                              │
  │───────────────────────▶│                              │
  │                        │ Verify:                      │
  │                        │  • challenge matches         │
  │                        │  • signature valid           │
  │                        │  • counter increased         │
  │                        │  • rpIdHash matches          │
  │                        │  • userHandle maps to user   │
  │                        │                              │
  │                        │ Create session (marks MFA    │
  │                        │   satisfied because WebAuthn │
  │                        │   is inherently multi-factor)│
  │                        │                              │
  │ 200 + cookies          │                              │
  │◀───────────────────────│                              │
```

### Why Passkeys > Password
- **Phishing-resistant**: Signed to specific origin (rpId)
- **No shared secret**: Private key never leaves authenticator
- **No password to forget/reset**
- **Multi-device sync** (Apple, Google, 1Password sync passkeys)

### Backward Compatibility
If user has both password and passkey, either works. Over time, we can auto-upgrade (prompt to enroll passkey after successful password login).

---

## 5. Magic Link Login

Email-based passwordless login. Good for users who rarely log in.

```
User ───▶ POST /auth/magic-link
              body: { email }

Server:
  1. Rate limit check (3 per email per hour)
  2. Look up user (if not found, still send "check your email" — prevents enum)
  3. Generate magic link token (32 bytes, base64url)
  4. Store hash + expiry (15 min) in Redis or DB
  5. Send email with link: https://app.aims.com/auth/magic?token=...

User ───▶ Clicks link in email
              GET /auth/magic?token=...

Server:
  1. Look up token (must exist, not expired, not used)
  2. Mark token used (one-shot)
  3. Determine if MFA needed (same rules as password login)
  4. If MFA enrolled → return mfaToken, enter MFA flow
  5. If not → create session, redirect to dashboard
```

### Security
- Token valid for **15 minutes** only
- One-use
- Invalidates on password change / MFA change
- Rate-limited per email
- Audit logged

---

## 6. OAuth / Social Login

Google and Microsoft supported (Phase 2). Apple later if needed.

### Flow (Google example)
```
User ───▶ Click "Sign in with Google"

Browser redirects to /auth/oauth/google
  │
Server:
  1. Generate state token (CSRF protection)
  2. Store state in cookie or Redis
  3. Redirect to Google OAuth consent:
     https://accounts.google.com/o/oauth2/v2/auth?
       client_id=...&
       redirect_uri=https://app.aims.com/auth/oauth/google/callback&
       response_type=code&
       scope=openid email profile&
       state=...

User consents in Google
  │
Google redirects to callback
  │
  ▼
/auth/oauth/google/callback?code=...&state=...
  │
Server:
  1. Verify state (matches cookie)
  2. Exchange code for tokens (server-to-server, with client_secret)
  3. Fetch user info from Google
  4. Check if user exists:
     - Yes: link Google identity if not already, log in
     - No: prompt to complete signup or decline
  5. Create session
```

### Account Linking
Users can link multiple auth methods to one account:
- Primary: email + password
- Linked: Google, Microsoft, passkeys
- Each auth method records which account it belongs to

### Security
- **PKCE (Proof Key for Code Exchange)** used even for server-side flow
- Client secret **never** sent to browser
- State token prevents CSRF
- Nonce validates ID token

---

## 7. Password Reset

```
User ───▶ Click "Forgot Password" → Enter email

POST /auth/password-reset/request
  body: { email }

Server:
  1. Rate limit (3 requests per email per hour)
  2. Look up user (if not found, SILENTLY succeed — prevents enum)
  3. Generate reset token (32 bytes, base64url)
  4. Store SHA-256 hash in password_reset_tokens with 1-hour expiry
  5. Invalidate any existing reset tokens for this user
  6. Send email with link: https://app.aims.com/auth/reset?token=...

User ───▶ Clicks reset link

GET /auth/reset?token=... → Password reset form

User enters new password

POST /auth/password-reset/complete
  body: { token, newPassword }

Server:
  1. Look up token by hash
  2. Verify not expired, not used
  3. Validate new password (complexity, HIBP breach check)
  4. Hash new password (Argon2id)
  5. Update user.passwordHash
  6. Mark token as used
  7. REVOKE ALL SESSIONS for this user (security response to password reset)
  8. Send confirmation email
  9. Log AuthEvent (PASSWORD_RESET_COMPLETED)
  10. If MFA enrolled, require MFA verification before creating new session

User must log in fresh with new password.
```

### MFA Protection Against Reset Hijack
If attacker gains access to user's email:
- Password reset alone is **not** enough to take over account
- MFA must be provided after password reset (same as normal login)
- If attacker also has MFA, user has bigger problems — recommend passkeys

---

## 8. Email Verification

Triggered at signup and when user changes email.

```
Server sends email:
  "Click here to verify: https://app.aims.com/auth/verify?token=..."

Token: 32 bytes, base64url, expires in 7 days

GET /auth/verify?token=...

Server:
  1. Look up token hash
  2. Verify not expired, not used
  3. Mark user.emailVerifiedAt = now()
  4. Log AuthEvent (EMAIL_VERIFIED)
  5. Redirect to /onboarding (or wherever user was)
```

### Re-send Verification
User can request new verification email (rate-limited: 3 per hour).

### Features Gated Until Verified
- Billing changes
- Inviting other users
- SSO configuration
- API key creation

---

## 9. User Invitation

Admin invites a user to join the tenant.

```
Admin UI ───▶ POST /api/users/invite
              body: { email, role, permissions? }

Server:
  1. Check admin permission
  2. Verify email not already in tenant
  3. Create UserInvitation record
  4. Generate invitation token (32 bytes, hash stored)
  5. Expires in 14 days
  6. Send email:
     Subject: "You've been invited to {tenant.name} on AIMS"
     Body: "{admin.name} invited you as {role}. Accept: https://app.aims.com/invite?token=..."

Invitee ───▶ Clicks link

GET /invite?token=...

Server:
  1. Validate token
  2. Show acceptance form:
     - If user exists (same email elsewhere): "Accept invitation" — link to existing account
     - If new user: "Create account" form

POST /api/auth/accept-invitation
  body: { token, password?, mfaEnroll? }  // password only if new user

Server:
  1. Validate token
  2. Create User if new OR link existing
  3. Create UserTenant with role
  4. Mark invitation accepted
  5. If new user: require email verification (email already "verified" via invite acceptance)
  6. Create session for invited tenant
  7. Log AuthEvent (INVITATION_ACCEPTED)
```

### Bulk Invitations (Enterprise)
Admins can upload CSV of `(email, role)` tuples. Each gets individual invitation (rate-limited sending).

### Revoking Invitations
Admin can revoke pending invitations (before acceptance). Post-acceptance → deactivate user.

---

## 10. MFA Enrollment (TOTP)

```
User ───▶ Settings → Security → Enable TOTP

GET /api/auth/mfa/totp/enroll/start

Server:
  1. Generate TOTP secret (160 bits, base32 encoded)
  2. Store encrypted in mfa_credentials (disabled=true until verified)
  3. Generate provisioning URI:
     otpauth://totp/AIMS:jane@example.com?secret=...&issuer=AIMS
  4. Generate QR code image (server-side or client-side)
  5. Return { secret, qrCodeDataUri, mfaCredentialId }

User ───▶ Scans QR in authenticator app

User enters current TOTP code

POST /api/auth/mfa/totp/enroll/verify
  body: { mfaCredentialId, code }

Server:
  1. Load credential (disabled)
  2. Verify TOTP code against stored secret
  3. Mark credential enabled (disabled=false)
  4. Generate 10 backup codes (Argon2id hashed)
  5. Return backup codes (ONE TIME display)
  6. Log AuthEvent (MFA_ENROLLED)

Server also emails user:
  "TOTP enabled on your account at {time}. Wasn't you? {link}"
```

### Multiple TOTP Devices
Users can enroll multiple TOTP credentials (primary phone + backup tablet, etc.).

---

## 11. MFA Enrollment (Passkey)

```
User ───▶ Settings → Security → Add passkey

POST /api/auth/passkey/enroll/options

Server:
  1. Generate PublicKeyCredentialCreationOptions:
     • challenge
     • rp: { id: "aims.example.com", name: "AIMS" }
     • user: { id, name: email, displayName }
     • pubKeyCredParams: [ -7 (ES256), -8 (EdDSA), -257 (RS256) ]
     • authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" }
     • attestation: "none"   (privacy; we don't need attestation for internal use)
  2. Store challenge in Redis (expires 5 min)
  3. Return options

Browser ───▶ navigator.credentials.create(options)

User interacts with authenticator (Touch ID, key press, etc.)

Browser ───▶ POST /api/auth/passkey/enroll/complete
                body: PublicKeyCredential

Server:
  1. Verify challenge matches (Redis)
  2. Parse attestation object
  3. Store public key, credential ID, counter
  4. Prompt user for nickname ("MacBook Pro Touch ID")
  5. Log AuthEvent (MFA_ENROLLED, method: WEBAUTHN)
  6. Send confirmation email
```

### Cross-Device Sync (Apple/Google/1Password)
User's passkeys sync across devices via their iCloud Keychain / Google Password Manager / 1Password. No per-device enrollment needed for synced passkeys.

### Non-Syncing Passkeys (Security Keys)
YubiKey and similar hardware keys don't sync — users enroll each key separately. Common in enterprise.

---

## 12. MFA Disable

**Critical flow** — must require strong re-auth.

```
User ───▶ Settings → Security → Remove MFA method

Check: If last remaining MFA method AND tenant requires MFA → BLOCK with error

Else:
POST /api/auth/mfa/remove
  body: { mfaCredentialId, reason? }

Server requires STEP-UP AUTH:
  - Must have current password
  - Must verify another MFA method (if any remaining)
  - Must be logged in < 5 min ago
  - If conditions not met → redirect to step-up flow

On success:
  1. Mark credential disabled
  2. Log AuthEvent (MFA_REMOVED)
  3. Send email notification to user
  4. Send email to tenant admins (if enforcement policy active)
```

### Emergency MFA Reset (Lost All Devices)
User contacts tenant admin. Admin can reset MFA for user:
1. Admin action in /admin/users/{id}/reset-mfa
2. User receives email notification
3. User forced through MFA re-enrollment on next login
4. Logged as MFA_REMOVED + MFA_ADMIN_RESET event

Platform support can reset MFA for tenant admins (last resort; heavily audited).

---

## 13. SSO Login (SAML)

Enterprise tenant has configured SAML with their IdP (e.g., Okta).

```
User ───▶ app.aims.com/login

User enters email: jane@acme.com

Server:
  1. Check acme.com in any tenant's ssoConfiguration.emailDomains (verified)
  2. If found AND SSO enabled → redirect to SSO
  3. Construct SAML AuthnRequest:
     • Issuer: app.aims.com
     • Destination: {customer IdP SSO URL}
     • AssertionConsumerServiceURL: https://app.aims.com/auth/saml/acs
     • RequestedAuthnContext: urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
  4. Sign request (our private key)
  5. Redirect browser to IdP with SAMLRequest param

User authenticates on IdP (including IdP's own MFA)

IdP redirects to our ACS (Assertion Consumer Service):
  POST /auth/saml/acs
  SAMLResponse=<base64 XML>

Server:
  1. Parse SAMLResponse
  2. Verify signature (against tenant's configured X509 cert)
  3. Verify NotBefore/NotOnOrAfter timestamps
  4. Verify Audience matches our EntityID
  5. Verify InResponseTo matches a request we sent
  6. Extract attributes (email, name, groups)
  7. Apply attribute mapping (configured per tenant)
  8. Find or JIT-provision user:
     - Look up user by email
     - If not exists AND JIT enabled → create User + UserTenant
     - Role from attribute mapping or ssoConfig.defaultRole
  9. If tenant policy enforceMfaViaSso=true → skip our MFA (IdP handles)
  10. Create session
  11. Log AuthEvent (SSO_LOGIN_SUCCESS)
  12. Redirect to dashboard
```

### Security Considerations
- **Signature verification** on every assertion (defense against XML injection)
- **XML canonicalization** and signature validation (prevent XSW — Signature Wrapping)
- **Replay protection** via InResponseTo tracking (Redis, 5-min TTL)
- **Assertion encryption** optional (supported for highly sensitive tenants)
- **IdP-initiated SSO** supported but discouraged (prone to replay)

---

## 14. SSO Login (OIDC)

```
User enters email → domain matches OIDC tenant

Server:
  1. Redirect to OIDC authorization endpoint:
     https://{idp}/authorize?
       client_id=...&
       redirect_uri=https://app.aims.com/auth/oidc/callback&
       response_type=code&
       scope=openid email profile&
       state=<csrf>&
       nonce=<anti-replay>&
       code_challenge=<PKCE>&
       code_challenge_method=S256

User authenticates on IdP

IdP redirects:
  /auth/oidc/callback?code=...&state=...

Server:
  1. Verify state matches
  2. Exchange code for tokens (server-to-server):
     POST {idp}/token
     Body: grant_type=authorization_code, code, redirect_uri, client_id, client_secret, code_verifier
  3. Receive { access_token, id_token, refresh_token? }
  4. Verify id_token:
     - Signature (JWKS lookup)
     - iss matches IdP issuer
     - aud includes our client_id
     - exp not passed
     - nonce matches
  5. Extract claims (email, name, ...)
  6. JIT provision or load user
  7. Create session
```

### Why PKCE Even for Server-Side
Defense in depth. Protects against authorization code interception if client_secret leaks.

---

## 15. Tenant Switch

User belongs to multiple tenants; switches active tenant.

```
User ───▶ Topbar → Tenant dropdown → Select "Acme Corp"

POST /api/auth/switch-tenant
  body: { tenantId }

Server:
  1. Verify user has active UserTenant for target tenant
  2. Check target tenant is active (not suspended)
  3. REVOKE current session
  4. CREATE new session with new tenantId
  5. Issue new cookies
  6. Redirect to target tenant's default page

(Current session is revoked; no cross-tenant data leakage)
```

### Why New Session?
- Tenant-specific MFA policies may differ
- Permission set differs
- Audit trail shows distinct sessions per tenant
- Simpler authorization (one tenant per session)

---

## 16. Session Refresh

See `SESSION-MANAGEMENT.md` §3 for full details.

Quick version:
```
Access token expired (15 min) → Client receives 401
  │
  ▼
Client ───▶ POST /auth/refresh
              Cookie: aims_refresh=<refresh token>

Server:
  1. Verify refresh token (hash lookup in sessions table)
  2. Check not revoked
  3. Check session not expired
  4. Rotate tokens:
     • Revoke old refresh token
     • Issue new access + refresh tokens
     • Link via same refreshTokenFamily
  5. Detect reuse: if old refresh token is used again → attack; revoke entire family
  6. Update session.lastUsedAt
  │
  ▼
Client retries original request with new token.
```

### Refresh Token Rotation
Each refresh use issues a new refresh token. The old one is one-time-use. If we see a used token come back, we know it was stolen → revoke entire family.

---

## 17. Logout

### Single Device
```
User ───▶ Click Logout

POST /auth/logout

Server:
  1. Revoke current session (mark revokedAt, revokedReason='logout')
  2. Clear cookies
  3. Log AuthEvent (LOGOUT)
```

### All Devices
```
Settings → Security → "Log out all other devices"

POST /auth/logout-all

Server:
  1. Revoke ALL sessions for this user (except current optionally)
  2. Notify user via email
  3. Log AuthEvent (LOGOUT, reason='logout_all')
```

---

## 18. Session Revocation (Admin)

Tenant admin can force-logout any user in their tenant.

```
Admin UI ───▶ /admin/users/{id} → Force logout

POST /api/admin/users/:id/revoke-sessions

Server:
  1. Verify admin permission
  2. Revoke all user's sessions (any tenant? or just this tenant?)
     • Policy decision: Only revoke sessions for THIS tenant, not cross-tenant
  3. Log AuthEvent (SESSION_REVOKED, reason='admin_revoked')
  4. Email user
```

### Platform Admin Scope
Superadmin can revoke any session for security reasons (suspected breach). Heavily audited.

---

## 19. Password Change

Logged-in user changes password.

```
Settings → Security → Change password

POST /auth/password/change
  body: { currentPassword, newPassword }

Server:
  1. Verify currentPassword (slow, Argon2)
  2. Verify newPassword policy + HIBP breach check
  3. Hash newPassword (Argon2id)
  4. Update user.passwordHash
  5. REVOKE ALL SESSIONS except current (user is actively using this one)
  6. Log AuthEvent (PASSWORD_CHANGED)
  7. Email user
```

### Why Revoke Other Sessions?
Compromised sessions don't survive password change. User must re-login on other devices.

---

## 20. Impersonation (Support)

Platform support impersonates a tenant user to debug issues.

```
Platform admin UI ───▶ Tenant → Users → Impersonate

Requirements to impersonate:
  - Superadmin role
  - Active support ticket (reference required)
  - Written justification
  - Time-boxed: max 1 hour
  - Target user email notification (optional, per tenant policy)

POST /api/platform/impersonate
  body: { tenantId, userId, ticketRef, justification }

Server:
  1. Verify superadmin + MFA within last 5 min (step-up)
  2. Record IMPERSONATION_STARTED event with all context
  3. Create special session:
     session.userId = target user
     session.impersonatorUserId = superadmin
     session.expiresAt = now + 1 hour (hard cap)
  4. Issue cookies to platform admin's browser
  5. Admin now browses as target user

Every action taken:
  - audit_log.user_id = target user
  - audit_log.impersonated_by = superadmin
  - Changes visible to target tenant
  - Change emails go to target user (optional: suppress during impersonation)

End impersonation:
POST /api/platform/impersonate/end
  Server: revoke impersonation session, log IMPERSONATION_ENDED
```

### Visual Indicator
Platform admin's UI shows red banner: "Impersonating jane@acme.com — End session."

### Limitations
- Cannot:
  - Change user's password
  - Modify MFA
  - Delete the target user's account
  - Perform billing operations
- Can:
  - View all tenant data as the user sees it
  - Create/update records to reproduce bugs

---

## 21. Step-Up Authentication

For sensitive operations, require recent authentication even if session is active.

### Actions Requiring Step-Up
- Changing password
- Enrolling/removing MFA
- Downloading all data (GDPR export)
- Creating API keys
- Inviting users (high-privilege)
- Enabling SSO
- Closing the tenant
- Superadmin: impersonation, pack publishing

### Flow
```
User performs sensitive action

Server: Check session.mfaVerifiedAt > now - 5 min
  If yes: proceed
  If no:  return 403 with code=STEP_UP_REQUIRED

Client: Show MFA modal ("Please verify to continue")
  User provides MFA (TOTP, passkey, etc.)
  Session.mfaVerifiedAt = now
  Client retries original action
```

### Why Step-Up vs Frequent MFA
- Balances security with UX (don't ask for MFA on every action)
- Sensitive actions get protection
- Other actions use standard session

---

## Complete Flow Status Matrix

| Flow | Documented | Implementation Ready |
|------|-----------|---------------------|
| 1. Signup | ✅ | ✅ |
| 2. Login | ✅ | ✅ |
| 3. MFA verify | ✅ | ✅ |
| 4. Passkey | ✅ | ✅ |
| 5. Magic link | ✅ | ✅ |
| 6. OAuth | ✅ | Optional (Phase 2) |
| 7. Password reset | ✅ | ✅ |
| 8. Email verify | ✅ | ✅ |
| 9. Invitation | ✅ | ✅ |
| 10. MFA enroll TOTP | ✅ | ✅ |
| 11. MFA enroll passkey | ✅ | ✅ |
| 12. MFA disable | ✅ | ✅ |
| 13. SAML SSO | ✅ | Phase 2 |
| 14. OIDC SSO | ✅ | Phase 2 |
| 15. Tenant switch | ✅ | ✅ |
| 16. Session refresh | ✅ | ✅ |
| 17. Logout | ✅ | ✅ |
| 18. Admin revoke | ✅ | ✅ |
| 19. Password change | ✅ | ✅ |
| 20. Impersonation | ✅ | Phase 3 |
| 21. Step-up | ✅ | ✅ |
