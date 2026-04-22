# AIMS v2 — Identity & Authentication Subsystem

> Production-grade auth for a multi-tenant SaaS. Covers authentication (who), session management (state), MFA, SSO, authorization (what you can do), and security hardening.

---

## Strategic Decision: Build vs Buy

### Options Evaluated

| Option | Pros | Cons |
|--------|------|------|
| **Auth0** | Mature, SOC 2, enterprise SSO, passkeys, extensive docs | $$$, vendor lock-in, data residency limited, feature bloat |
| **Clerk** | Great DX, modern UI components, passkeys | Relatively new, $$$, limited enterprise SSO tiers |
| **Supabase Auth** | Free, simple | Lacks enterprise features, PostgreSQL-coupled |
| **AWS Cognito** | Cheap, managed, AWS-native | Poor DX, limited customization, dated UX |
| **Keycloak** (self-hosted) | Open source, feature-rich, enterprise-ready | Operational burden, Java-heavy, complex |
| **Zitadel** (self-hosted) | Modern, SaaS-aware, good architecture | Smaller ecosystem |
| **Ory Kratos + Hydra** | Composable, pluggable, no vendor lock-in | Complex, steep learning curve |
| **Better Auth** (library) | TypeScript-native, pluggable, self-hosted, modern | Newer project, smaller ecosystem |
| **Build from scratch** | Full control, no lock-in | 6-12 months of work, easy to get wrong |

### Chosen Approach: **Better Auth + Custom Extensions**

**Rationale**:
- **TypeScript-first** — matches our stack end-to-end
- **Self-hosted** — data residency requirements demand this for government/EU clients
- **Pluggable** — adapt to our needs without forking
- **Modern primitives** — passkeys, magic links, social OAuth, MFA built-in
- **No vendor lock-in** — own the auth layer
- **Open source** — auditable, no rug-pull risk

**What we'll build on top of Better Auth**:
- Multi-tenant organization model (Better Auth has org plugin; we customize)
- Enterprise SAML/OIDC SSO adapter (Better Auth SAML plugin + SCIM)
- Fine-grained permissions (RBAC + ABAC) — our own permission engine
- Impersonation with audit trail
- Tenant-aware rate limiting
- Compliance-grade audit logging (integrate with our `audit_log`)
- Password breach detection (HIBP integration)
- Risk-based auth (suspicious location/device detection)

### Why Not Auth0/Clerk
- **Vendor lock-in**: auth is foundational; rewriting mid-scale is painful
- **Data residency**: EU/India/government customers demand in-region data storage
- **Cost at scale**: $5-20/user/month adds up fast at enterprise scale
- **Customization limits**: Audit-specific flows (independence attestations at login time?) need flexibility

### Why Not Self-Hosted Keycloak
- **Operational overhead** is significant for a small team
- **Java stack** doesn't match our TypeScript-heavy team
- **Overkill** for our needs — Keycloak is optimized for complex federation scenarios we don't need

### Fallback Plan
If Better Auth maturity becomes a blocker, migrate to **Zitadel** (similar philosophy, more mature product). Auth patterns we design here are portable.

---

## File Structure

```
auth/
├── README.md                     ← You are here
├── ARCHITECTURE.md               ← Complete auth system design
├── FLOWS.md                      ← All user flows (login, signup, MFA, reset, etc.)
├── SESSION-MANAGEMENT.md         ← JWT strategy, cookies, revocation
├── MFA.md                        ← TOTP + WebAuthn/passkeys + backup codes
├── SSO.md                        ← SAML 2.0, OIDC, SCIM provisioning
├── PERMISSIONS.md                ← RBAC + ABAC model, permission catalog
├── SECURITY.md                   ← Threats, mitigations, hardening
├── flows/
│   ├── signup.md                 ← Tenant creation + first user
│   ├── login.md                  ← Email/password/OAuth login
│   ├── mfa-enrollment.md
│   ├── mfa-verify.md
│   ├── password-reset.md
│   ├── email-verification.md
│   ├── invitation.md             ← Invite users to tenant
│   ├── sso-setup.md
│   ├── impersonation.md
│   └── session-revocation.md
└── implementation/
    ├── auth.router.ts            ← tRPC auth router
    ├── schemas/
    │   └── auth.schemas.ts       ← Zod schemas
    ├── jwt.ts                    ← JWT creation/verification helpers
    ├── password.ts               ← Hash, verify, policy, breach check
    ├── mfa.ts                    ← TOTP, WebAuthn helpers
    ├── session.ts                ← Session creation, refresh, revocation
    └── permissions.ts            ← Permission evaluation engine
```

---

## Key Design Decisions

### 1. Session Tokens: Opaque Session Cookies + JWT Access Tokens
- **Session cookie** (httpOnly, secure, sameSite=strict) for browser requests
- **JWT access token** for API requests (stateless, short-lived)
- **Refresh token** (rotation-enabled) for long sessions

### 2. Password Hashing: Argon2id
- Industry best practice (Argon2 won the Password Hashing Competition)
- Memory-hard (GPU-resistant)
- Configurable work factor (increase as hardware improves)

### 3. MFA: TOTP + Passkeys (WebAuthn)
- **TOTP** as baseline (Google Authenticator, 1Password, Authy)
- **Passkeys (WebAuthn)** as preferred — phishing-resistant, passwordless future
- **Backup codes** as recovery mechanism
- **No SMS MFA** — SIM-swap attacks make it insecure for audit data

### 4. Tenant Model: Organizations, Not Subdomains
- Single domain (`app.aims.com`) with tenant resolution via JWT claim
- Simpler than subdomain-per-tenant (no DNS provisioning, no certificate management)
- Users can belong to multiple tenants (org switcher in UI)

### 5. Enterprise Auth: SAML 2.0 + OIDC + SCIM
- **SAML 2.0** for legacy enterprise IdPs (Okta, ADFS, OneLogin)
- **OIDC** for modern IdPs (Okta, Azure AD)
- **SCIM 2.0** for automated user provisioning/deprovisioning
- Per-tenant configuration (each customer has their own IdP)

### 6. Authorization: RBAC + ABAC Hybrid
- **RBAC** for coarse-grained permissions (role → permissions)
- **ABAC** for row-level access (e.g., "user on this engagement's team")
- Policies evaluated per request via permission engine
- Cached in Redis for hot paths

### 7. Impersonation: Support-Only, Heavily Audited
- Only platform superadmins can impersonate tenant users
- Requires support ticket reference + business justification
- Time-boxed (max 1 hour, auto-expires)
- Every action during impersonation logged with `impersonated_by` field
- Customer notified (optional) or post-hoc via audit log access

---

## Compliance Alignment

| Requirement | How Addressed |
|-------------|---------------|
| **GDPR Art. 32** (security of processing) | Argon2 hashing, MFA, rate limiting, session timeout, encrypted at rest |
| **SOC 2 CC6.1** (logical access) | RBAC, RLS, least privilege, session controls |
| **SOC 2 CC6.6** (authentication) | MFA, password policy, lockout |
| **SOC 2 CC6.7** (auth for sensitive resources) | Re-auth for high-risk actions (payment, admin, data export) |
| **NIST 800-63B** | Level 2 identity assurance (AAL2 via MFA) |
| **HIPAA §164.312(d)** | Unique user IDs, emergency access, auto-logoff, encryption |
| **21 CFR Part 11** | E-signatures via session-bound signed hashes |
| **PCI DSS 8.x** | (Via Stripe — we don't handle card data directly) |

---

## Threat Model Summary

Full threat model in `SECURITY.md`. Top threats addressed:

| Threat | Mitigation |
|--------|------------|
| Credential stuffing | Rate limiting, HIBP breach check, MFA, CAPTCHA after failures |
| Phishing | Passkeys (phishing-resistant), email notifications for logins |
| Session hijacking | httpOnly+secure+sameSite cookies, short TTLs, IP binding (optional) |
| Privilege escalation | RLS at DB layer, permission checks in middleware, no client-trusted role |
| Tenant isolation breach | RLS + session vars + tests; impossible via app bugs alone |
| Password reuse | HIBP breach check at signup and rotation |
| Insider threat | Impersonation audited, least privilege, separation of duties for ops |
| Token theft | Short-lived access tokens, refresh token rotation, revocation on anomaly |
| MFA bypass | Backup codes hashed, MFA required for password reset, device trust |
| Account takeover | Email notification for logins from new device, security questions (optional) |

---

## Implementation Phases

| Phase | Scope | Week |
|-------|-------|------|
| **P1: Baseline auth** | Email/password, sessions, email verification, password reset | 1-2 |
| **P2: MFA** | TOTP enrollment + verification, backup codes | 3 |
| **P3: Passkeys** | WebAuthn enrollment + authentication | 4 |
| **P4: OAuth / social** | Google, Microsoft (optional) | 4 |
| **P5: Organizations & invitations** | Tenant model, invite flow, role assignment | 5 |
| **P6: Permissions engine** | RBAC + ABAC evaluation, caching | 5-6 |
| **P7: SAML SSO** | Per-tenant SAML configuration, JIT provisioning | 7-8 |
| **P8: OIDC + SCIM** | OIDC federation, SCIM provisioning | 8-9 |
| **P9: Advanced security** | HIBP, risk-based auth, impersonation | 10 |
| **P10: Compliance polish** | Audit logging completeness, SOC 2 evidence | 11-12 |

Total: ~12 weeks for full enterprise-grade auth.

---

## Metrics to Track

- Authentication success rate (target >99.5%)
- MFA enrollment rate (target >60% of active users)
- Passkey adoption rate (track as signal)
- Password reset rate (high = UX issue)
- Failed login rate by reason (credential, MFA, locked)
- Time to authenticate (p50, p99)
- Session duration distribution
- SSO login share (for enterprise customers)
- Brute force attempts blocked
- Breach-detected password rejections

---

## Status

- [x] Strategy + build-vs-buy decision
- [x] File structure
- [x] Key design decisions
- [ ] Complete architecture document
- [ ] All flow documentation
- [ ] Implementation skeletons

See individual docs in this folder for details.
