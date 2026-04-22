# Identity, Authentication, and SSO

> User authentication, SSO integration, MFA, session management, and user lifecycle. Core infrastructure for every user action. Pairs with [`auth/`](../../auth/) architecture docs and ADR-0005 session revocation. This spec covers the user- and admin-facing features built on that foundation.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 2
**Primary personas**: All users (auth affects everyone); Sofia (configures); Ravi (platform-level)
**MVP phase**: 1.0 for OIDC SSO + email/password + TOTP + WebAuthn; SAML + full SCIM → 1.5; OAuth2 client credentials → v2.1

---

## 1. Feature overview

Identity and auth is foundational — no user action occurs without authenticated session. MVP 1.0 ships:

- **Email/password** auth for tenants without SSO
- **OIDC SSO** (Okta, Azure AD, Google Workspace)
- **MFA**: TOTP (Authenticator apps), WebAuthn/Passkeys (W3C Level 3)
- **Session management**: EdDSA JWT access tokens (15-min TTL) + opaque refresh tokens (rotated, family-tracked) per `auth/` architecture
- **Session revocation**: targeted blocklist via `blocklist_checkable` claim per ADR-0005
- **User lifecycle**: invite, activate, role change, deactivate

MVP 1.5 adds SAML 2.0 and full SCIM 2.0 provisioning. v2.1 adds OAuth2 client credentials for B2B integrators.

### 1.1 Security-first design

Per ADR-0005, session revocation is targeted (not global per-request) — normal user tokens pay no Redis latency; sensitive roles (admin, elevated access) get instant revocation via blocklist. This is documented architectural commitment; feature spec implements it.

---

## 2. User stories — Sign-in

### 2.1 US-AUTH-001 — Email/password login

```gherkin
GIVEN Priya has account on Oakfield's tenant
  AND tenant has email/password enabled
WHEN Priya visits login page
  AND enters email + password
  AND clicks Sign In
THEN credentials verified (Argon2id hash compare)
  AND if MFA enabled: TOTP / WebAuthn challenge
  AND on success: JWT + refresh token issued
  AND user redirected to home dashboard
  AND login event logged to audit trail
```

**Acceptance criteria**:
- Password hashing: Argon2id with tenant-configured parameters
- Generic error messages (no "user not found" vs. "wrong password" leak)
- Rate limiting per IP and per account
- Login event: success, failure, unusual geography flagged

### 2.2 US-AUTH-002 — Password reset

```gherkin
WHEN Priya clicks "Forgot password"
  AND enters email
THEN password reset email sent (single-use link, 1-hour expiry)
  AND link leads to password reset page
  AND new password set per tenant policy (length, complexity)
```

### 2.3 US-AUTH-003 — SSO login via OIDC

```gherkin
GIVEN Oakfield configured OIDC SSO with Okta
WHEN Priya visits login page
  AND sees "Sign in with Okta"
  AND clicks
THEN redirected to Okta
  AND authenticates there
  AND returned to AIMS with OIDC token
  AND AIMS verifies token
  AND JIT user provisioning if first-time login (with role assignment per OIDC claims or tenant mapping)
  AND standard session issued
```

**Acceptance criteria**:
- OIDC discovery via well-known endpoint
- Multiple OIDC providers supported per tenant (rare; typically one)
- JIT provisioning configurable
- Claims mapping configurable (role from IdP groups)

### 2.4 US-AUTH-004 — SAML 2.0 login (MVP 1.5)

Similar to OIDC but SAML protocol. Common for enterprise IdPs that don't offer OIDC.

---

## 3. User stories — Multi-factor authentication

### 3.1 US-AUTH-005 — User enrolls TOTP MFA

```gherkin
GIVEN Priya logs in
  AND tenant policy requires MFA for her role
WHEN she's prompted to enroll
  AND chooses TOTP
THEN QR code generated for authenticator app
  AND Priya scans with Google Authenticator / Authy
  AND enters 6-digit code to verify
  AND backup codes (10) displayed for emergency
  AND backup codes stored for Priya (encrypted)
  AND MFA marked enrolled
```

### 3.2 US-AUTH-006 — User enrolls WebAuthn/Passkey

```gherkin
GIVEN Priya has security key or device with passkey
WHEN she chooses WebAuthn
THEN WebAuthn Level 3 flow:
  - Browser prompts for security key / biometric
  - Priya registers credential
  - Credential public key stored in AIMS
  - MFA enrolled; passkey is primary authenticator going forward
```

**Acceptance criteria**:
- WebAuthn preferred over TOTP
- Support for multiple passkeys per user (backup devices)
- Yubikeys, Titan keys, Face ID / Touch ID / Windows Hello all supported

### 3.3 US-AUTH-007 — Step-up MFA for truly destructive / administrative actions only

```gherkin
GIVEN Priya is signed in with an authenticated session
WHEN she performs a TRULY destructive or administrative action:
  - Export all tenant data
  - Delete tenant / initiate offboarding
  - Invoke break-glass access (platform admin)
  - Bulk-delete or bulk-archive findings/engagements
  - Revoke all sessions for another user (admin action)
  - Modify tenant-level security config (SSO, IP allowlist, revocation policy)
  - Reset MFA on another user's behalf
THEN step-up MFA prompt appears
  AND she re-authenticates with her current MFA factor
  AND action proceeds
```

**Acceptance criteria — scope deliberately narrow**:

Step-up MFA is reserved for a **small set of truly destructive/administrative actions**, NOT for routine approval flows like report signing or finding approval.

**Actions that DO require step-up MFA**:
- Destructive operations (delete tenant, bulk delete, full data export)
- Platform admin elevation (break-glass, cross-tenant support mode)
- Security-config changes (SSO setup, IP allowlist, tenant revocation policy)
- User-impacting admin operations (reset MFA on behalf of another, force session revocation across tenant)

**Actions that do NOT require step-up MFA** (despite being "important"):
- Report signing — standard authenticated session + typed attestation is sufficient. GAGAS and IIA do not require cryptographic re-authentication per approval; a normal authenticated session with an audit trail satisfies evidentiary requirements.
- Finding approval — ditto
- Approving annual plan — ditto
- Issuing reports — the audit trail captures Marcus's identity + session + timestamp, which is the evidentiary artifact peer reviewers expect
- CAP approval — ditto

**Why this matters**: CAEs sign dozens of reports per quarter. Requiring YubiKey re-authentication for each approval produces MFA fatigue and workarounds (leaving YubiKey plugged in, sharing hardware factors, etc.) — net security decreases. The electronic-signature equivalent for GAGAS/IIA is established legal territory; clicking "Approve" in an authenticated session with an audit trail is the accepted standard.

**CFR Part 11 carve-out (future)**: if AIMS ever targets FDA Life Sciences (21 CFR Part 11) or similar regulated industries requiring cryptographic re-authentication per signature, step-up MFA scope would expand. MVP 1.0 target markets (government audit, CPA firms) do not require this.

**Step-up session parameters**:
- Configurable per tenant which actions trigger step-up (can add more actions, but default minimal set)
- Step-up session lifetime: 10 minutes (subsequent same-category action within 10 min doesn't re-prompt)
- Audit log captures step-up MFA events with elevated visibility

---

## 4. User stories — Session management

### 4.1 US-AUTH-008 — User views active sessions

```gherkin
GIVEN Priya wants to see her active sessions
WHEN she opens Account → Security → Sessions
THEN she sees:
  - Current session (this browser)
  - Other active sessions (device, location, last active)
  - Option to revoke individual session
  - Option to revoke all other sessions
```

### 4.2 US-AUTH-009 — Admin revokes user session

```gherkin
GIVEN Sofia wants to revoke a compromised session
  OR a terminated employee's session
WHEN Sofia opens user in admin console
  AND clicks "Revoke all sessions"
THEN user's tokens added to blocklist (per ADR-0005)
  AND next API request with old token fails
  AND audit log entry with reason
  AND if user was currently logged in, they're forced to re-authenticate
```

**Acceptance criteria**:
- Revocation propagates via Redis blocklist per ADR-0005
- For `blocklist_checkable: true` tokens (sensitive roles), immediate revocation (sub-5-second)
- For other tokens: 15-minute natural expiry + refresh-family invalidation

### 4.3 US-AUTH-010 — Refresh token rotation

```gherkin
GIVEN Priya's access token expires (15 min)
  AND her refresh token is still valid
WHEN frontend detects expiry
  AND calls refresh endpoint
THEN new access + refresh tokens issued
  AND old refresh token invalidated (rotation)
  AND family-tracking: if someone tries to reuse old refresh, entire family invalidated (security)
  AND session continues transparently
```

---

## 5. User stories — User lifecycle

### 5.1 US-AUTH-011 — Sofia invites new user

```gherkin
GIVEN Sofia wants to add new auditor
WHEN she opens Users → Invite
  AND enters email, name, role (Staff Auditor, AIC, CAE, etc.)
  AND selects initial permissions
THEN invitation email sent with magic-link activation
  AND user pending until they activate
  AND if tenant has SSO, user may also need to be in IdP directory
```

### 5.2 US-AUTH-012 — User activates account

```gherkin
WHEN new user clicks activation link
  AND sets password (or goes through SSO flow)
  AND sets up MFA per policy
THEN account active
  AND initial dashboard shown
```

### 5.3 US-AUTH-013 — Sofia deactivates user

```gherkin
GIVEN user leaves firm
WHEN Sofia deactivates
THEN user's sessions revoked (per §4.2)
  AND user cannot log in
  AND user's work preserved (historical integrity)
  AND audit trail captures deactivation
```

### 5.4 US-AUTH-014 — Role change

```gherkin
WHEN Sofia changes Anjali from Staff Auditor to Senior Auditor
THEN permissions updated
  AND access to additional engagements possible
  AND audit log captures role change
  AND Anjali notified
```

---

## 6. User stories — SCIM provisioning (MVP 1.5)

### 6.1 US-AUTH-015 — SCIM sync from Okta

```gherkin
GIVEN Sofia configures SCIM endpoint in Okta
  AND assigns AIMS app to specific Okta groups
WHEN Okta provisions user
  AND pushes SCIM event to AIMS
THEN user auto-created in AIMS with role mapped from Okta groups
WHEN user removed from Okta
THEN SCIM deprovision event
  AND AIMS user deactivated automatically
  AND session revoked
```

**Acceptance criteria (MVP 1.5)**:
- SCIM 2.0 endpoint per RFC 7644
- Token-based authentication
- Full lifecycle: create, update, deactivate
- Group / role mapping configurable

---

## 7. Edge cases

### 7.1 SSO outage

If IdP is unavailable, users with email/password fallback can still login (if enabled). Emergency break-glass for tenant admin.

### 7.2 MFA device lost

User contacts Sofia → Sofia can reset MFA via admin console (with audit log) → user re-enrolls.

### 7.3 Credential stuffing attack

Rate limiting + CAPTCHA + IP blocking + account lockout after N failures.

### 7.4 Concurrent session from new geography

Anomaly detection flag; optional step-up MFA; security notification.

### 7.5 API access for integrators

API keys (MVP) and OAuth2 client credentials (v2.1) per `features/integrations-and-api.md`. Same session infrastructure reused.

---

## 8. Data model

- `User` — per-tenant
- `Session` — active session tracking
- `RefreshTokenFamily` — rotation lineage
- `MFAEnrollment` — per-user MFA setup
- `SSOProvider` — per-tenant SSO config
- `UserAudit` — lifecycle events
- `SessionBlocklist` — Redis blocklist per ADR-0005

---

## 9. API endpoints

```typescript
auth.login(input: LoginInput): Session
auth.ssoLogin(input: SSOLoginInput): Session
auth.refreshToken(input: RefreshInput): Tokens
auth.logout(input: {}): void
auth.revokeSession(input: {sessionId}): void
auth.enrollMFA(input: MFAType): MFAEnrollment
auth.verifyMFA(input: VerificationInput): MFAResult

user.invite(input: InviteInput): User
user.activate(input: ActivationInput): User
user.deactivate(input: {userId, reason}): User
user.changeRole(input: {userId, newRole}): User
user.listSessions(input: {userId}): Session[]

sso.configure(input: SSOConfigInput): SSOProvider  // Sofia only
```

Plus `/scim/v2/` SCIM 2.0 endpoint (MVP 1.5).

---

## 10. Permissions

| Role | Login | Invite users | Configure SSO | Deactivate | Revoke sessions |
|---|---|---|---|---|---|
| Any user | ✅ | ❌ | ❌ | ❌ | Own sessions only |
| Sofia (Tenant Admin) | ✅ | ✅ | ✅ | ✅ | All users |
| Ravi (Platform Admin) | ✅ | ✅ (support) | ✅ (support) | ✅ (support) | All users (time-bounded) |

---

## 11. Observability

- `auth.login.count` / `.failure.count`
- `auth.mfa.enrollment.count`
- `auth.sso.login.count`
- `auth.session.revoked.count`
- `auth.blocklist.hit.count` (per ADR-0005)
- `auth.jwt.minting.duration`

---

## 12. Performance

- Login p99 < 2s (including MFA challenge)
- Token refresh p99 < 500ms
- SSO redirect round-trip < 3s

---

## 13. Compliance

- SOC 2 CC6 Logical Access
- ISO 27001 A.9
- HIPAA §164.308(a)(3) termination procedures
- Per ADR-0005 session revocation meets SOC 2 CC6.3, ISO 27001 A.9.2.6, HIPAA termination

---

## 14. Dependencies

- `auth/` architecture docs
- ADR-0005 session revocation
- `features/tenant-onboarding-and-admin.md` — tenant + user setup
- Notifications module for email-based auth flows

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 2
- [`auth/README.md`](../../auth/README.md) — auth architecture
- [`references/adr/0005-session-revocation-hybrid.md`](../../references/adr/0005-session-revocation-hybrid.md)
- [`auth/REVOCATION-POLICY.md`](../../auth/REVOCATION-POLICY.md) — roles matrix

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§3.3 US-AUTH-007 — step-up MFA scope**: reviewer correctly flagged that requiring step-up MFA for report signing would produce MFA fatigue. CAEs sign dozens of reports per quarter; YubiKey-every-time produces workarounds (hardware left plugged in, factor sharing) that decrease security. Fix: step-up MFA scope narrowed to truly destructive / administrative actions only (tenant deletion, bulk data operations, platform admin break-glass, security config changes, user-impacting admin actions). Report signing and finding approval use standard authenticated session with typed attestation — satisfies GAGAS/IIA electronic signature requirements. CFR Part 11 carve-out (Life Sciences) reserved for future if AIMS expands to that market.

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
