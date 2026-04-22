# Auth Security — Threat Model & Hardening

> STRIDE-based threat analysis specific to the auth subsystem. Mitigations and monitoring.

---

## Threat Model (STRIDE)

STRIDE: **S**poofing, **T**ampering, **R**epudiation, **I**nformation Disclosure, **D**enial of Service, **E**levation of Privilege.

### Spoofing (Pretending to be someone else)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Credential stuffing | Automated login with leaked passwords | HIBP breach check at signup/rotation, rate limiting, MFA, CAPTCHA after failures, fingerprint-based risk scoring |
| Phishing (password) | Fake login page harvests creds | Passkeys (phishing-resistant), DMARC/SPF on emails, auth notifications to users |
| Real-time phishing (AiTM) | Man-in-the-middle proxy captures MFA | Passkeys defeat AiTM (origin-bound); TOTP is vulnerable — educate users, detect via device fingerprinting |
| Session hijacking | Stolen session cookie | httpOnly+secure+sameSite=strict cookies, short access token TTL, refresh rotation detects reuse |
| Token theft (XSS) | Malicious JS steals tokens | httpOnly cookies (can't read via JS), CSP to prevent XSS, input sanitization |
| SSO assertion forgery | Forged SAML response | XML signature verification, canonicalization, replay protection (InResponseTo) |
| Impersonation abuse | Superadmin impersonates without justification | Ticket reference required, time-boxed 1hr, audit log, optional email to target |
| Email account takeover | Password reset via compromised email | MFA requirement after reset, recovery email notification |

### Tampering (Modifying data)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| JWT tampering | Modify claims without knowing signing key | EdDSA signature verification on every request |
| Session record tampering | Modify session row in DB | RLS policies + append-only audit log + hash chain |
| Password hash collision | Forged hash matches multiple passwords | Argon2id (collision-resistant PHC winner) |
| MFA bypass via DB | Direct SQL bypasses MFA check | App never skips MFA check; DB constraint on MFA-required actions |
| SAML XSW (signature wrapping) | Wrap signed assertion in unsigned envelope | Mature library with XSW mitigations, canonical XML, verify entire response |
| Token counter regression (WebAuthn) | Cloned authenticator | Counter monotonicity check |

### Repudiation (Denying actions)

| Threat | Vector | Mitigation |
|--------|--------|------------|
| User denies login | Audit log tampered | Hash-chained audit log (tamper-evident) |
| User denies approval | Forged approval records | E-signature: signed hash stored; verifiable |
| Admin denies role change | Undocumented change | `audit_log` + notification to user |
| Impersonator denies action | Blames impersonated user | `impersonated_by` field on every audit log entry |

### Information Disclosure

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Password disclosure | DB dump | Argon2id hashed (not reversible); never logged |
| TOTP secret exposure | DB dump | Encrypted with ALE + KMS key |
| Session token exposure | DB dump | SHA-256 hashed; raw tokens never stored |
| Email enumeration | Different responses for existent vs non-existent email | Constant-time login failures, silent success on password reset for unknown emails |
| User enumeration via SSO | "User not in tenant" vs "SSO failed" | Generic error messages |
| Timing attacks | Response time differences | Constant-time password verification; fixed minimum delay on failures |
| Error message information leak | Stack traces reveal internals | Generic errors in production; detailed only in logs |
| JWT info disclosure | Claims visible (base64, not encrypted) | Don't put sensitive data in JWT (PII, roles OK; SSN not) |
| Cross-tenant data leak | Bug bypasses filtering | PostgreSQL RLS at DB layer |
| API key leak | Committed to git, logged, etc. | Hashed storage, leak detection (git hooks, log scrubbing) |
| Log PII | User details in logs | Structured logging with PII redaction; `pino.redact` config |

### Denial of Service

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Brute force login | Exhaust DB / CPU via password attempts | Rate limit per email + IP + global, account lockout (exponential backoff) |
| CPU exhaustion via Argon2 | Many signup attempts | Argon2 work factor tuned; rate limit signups |
| MFA bombing | Request many TOTP challenges | Rate limit MFA challenges; no push notifications |
| SSO response flooding | Spam ACS endpoint | Rate limit per tenant SSO; validate signatures early |
| Session table flood | Create many sessions | Max concurrent sessions per user policy |
| Email spam (password reset) | Attacker triggers many reset emails | Rate limit per email; user-visible cooldown |
| SAML metadata DoS | Large/complex XML crash parser | XML size limit, entity expansion limits |
| Regular expression DoS (ReDoS) | Malicious input matches regex | Use safe regex patterns; timeout on complex matches |

### Elevation of Privilege

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Horizontal privilege escalation (cross-tenant) | Direct URL access to other tenant's data | PostgreSQL RLS enforces at DB; session tenantId claim binds context |
| Vertical privilege escalation (role elevation) | Modify JWT role claim | Signature verification prevents forgery; role loaded from DB on each refresh |
| Privilege confusion (impersonation) | Superadmin accidentally persists elevated state | Time-boxed sessions, explicit "end impersonation" required |
| SSO role mapping abuse | Add self to privileged IdP group | Tenant policy restricts which IdP groups map to ADMIN |
| Magic link → admin bypass | Magic link issued for admin account | MFA required on admin logins; magic link doesn't skip MFA |
| Invitation token abuse | Sharing invite accepts as someone else | Invitations bound to email; verify on acceptance |
| SCIM provisioning backdoor | Malicious IdP admin creates users | IdP is trusted; tenant's IdP = tenant's responsibility; audit log catches |
| Self-approval exploit | Creator approves own submission | ABAC rule: cannot approve own work |

---

## 1. Password Security

### Hashing
- **Algorithm**: Argon2id
- **Parameters**: m=64MB, t=3, p=4
- **Tuned**: Target ~500ms on production hardware
- **Reviewed**: Every 2 years; increase work factor as hardware improves

### Complexity Requirements
- **Minimum length**: 12 characters (configurable per tenant, minimum 10)
- **Maximum length**: 128 characters (prevent DoS)
- **No forced complexity** (mixed case, numbers, etc.) — length + blocklist more effective than rules
- **Blocklist**:
  - Common passwords (top 1000)
  - Variations of the service name ("AIMS2026!")
  - User's email
  - User's name parts

### Breach Check (HIBP k-anonymity)
```typescript
async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = sha1(password).toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  // Ask HIBP for all hashes starting with this prefix
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();

  // Lines like "ABCDEF...:count"
  return text.split('\n').some(line => {
    const [hashSuffix] = line.split(':');
    return hashSuffix === suffix;
  });
}
```
- Only prefix (5 chars of SHA-1) sent externally → k-anonymous
- Full hash never leaves our server
- Used at signup, password change, rotation
- Async check (doesn't block login speed)

### Storage
- `user.passwordHash` column
- Argon2id encoded: `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`
- Salt embedded in format (random per hash)

### Rotation Policy
- **Not mandatory by default** (NIST 800-63B §5.1.1.2 deprecated forced rotation)
- Tenants can enforce if compliance requires (e.g., 90-day rotation for some regulations)
- Previous passwords tracked (hashed) to prevent reuse (last 5)

### Never Do
- ❌ Don't log passwords (even if hashed) — accidental logs happen
- ❌ Don't email passwords (even reset "temporary passwords")
- ❌ Don't transmit passwords via URL params
- ❌ Don't truncate passwords before hashing

---

## 2. Rate Limiting Strategy

### Per-Endpoint Limits

| Endpoint | Limit | Scope | Lockout |
|----------|-------|-------|---------|
| POST /auth/login | 5 fails / 15 min | email | 15-min lockout, exponential backoff |
| POST /auth/login | 10 fails / 1 min | IP | 1-hour IP block |
| POST /auth/signup | 3 / hour | IP | - |
| POST /auth/password/reset | 3 / hour | email | - |
| POST /auth/password/reset | 10 / hour | IP | - |
| POST /auth/mfa/verify | 5 / 15 min | user | 15-min MFA lockout |
| POST /auth/magic-link | 3 / hour | email | - |
| POST /auth/refresh | 30 / min | user | - |
| GET /api/* (general) | 100 / min | user | - |

### Rate Limit Backing Store
**Redis** (token bucket):
```lua
-- ratelimit.lua (atomic via Redis Lua)
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, ttl)
end
return current
```

### Exponential Backoff (Per Email)
```
1st failure: no delay
5 failures in 15 min: 15-min lockout
After unlock, 5 more failures: 30-min lockout
Etc. Max 24-hour lockout
```

### CAPTCHA
- **hCaptcha** used after N failed attempts
- Recommended over reCAPTCHA for privacy (no Google)
- Visible after 3 failures; required after 5

### Global Rate Limits
Rolling 5-min window across all auth endpoints. Massive spike → security alert.

---

## 3. Account Lockout

### Triggers
- 5 consecutive failed password attempts in 15 min
- 5 consecutive failed MFA attempts in 15 min
- Detection of session replay (refresh token reuse)
- Admin-initiated (security incident response)

### User Experience
- Clear error: "Account temporarily locked. Try again at 10:45 or reset your password."
- Email notification to user: "Login attempts blocked — reset password if not you"
- Locked status visible at `/account/security`

### Auto-Unlock
After lockout period (15 min default), user can retry. Bypass via successful password reset.

### Permanent Lockout (Admin Action)
Admin can lock account indefinitely:
- User can't log in
- All sessions revoked
- Visible in admin UI
- Audit logged

---

## 4. Suspicious Activity Detection

### Risk Signals
- Login from new country/city (GeoIP)
- Login from new device fingerprint
- Login at unusual time (user's typical pattern)
- Multiple concurrent sessions from different countries
- Rapid IP changes within session
- Tor/VPN detection
- Impossible travel (LA → Tokyo in 10 minutes)

### Response
Low risk (new device, usual country):
- Allow login
- Email notification: "New device login — was this you?"

Medium risk (new country):
- Require MFA re-verification
- Email + optional SMS

High risk (impossible travel, Tor exit node):
- Block login
- Email user
- Lock account pending user action

### Risk Scoring
Basic implementation:
```typescript
function calculateRiskScore(signals: LoginSignals): number {
  let score = 0;
  if (signals.newCountry) score += 30;
  if (signals.newDevice) score += 20;
  if (signals.torExit) score += 50;
  if (signals.impossibleTravel) score += 60;
  if (signals.unusualTime) score += 10;
  return score;
}

if (score >= 80) return 'block';
if (score >= 40) return 'require_mfa';
return 'allow';
```

Sophisticated (future): ML-based user behavior baseline.

---

## 5. CSRF Protection

### Attacks Prevented
- Cross-origin form submission
- Unwanted authenticated API calls from malicious sites

### Mitigation Layers

**Primary: SameSite=Strict cookies**
- Modern browsers won't send cookies on cross-site requests
- Blocks almost all CSRF

**Secondary: CSRF tokens for state-changing ops**
- Synchronizer token pattern
- Generated per session
- Required in header for non-GET requests
- Rejected if mismatched

**Tertiary: CORS**
- Strict whitelist of allowed origins
- Credentials flag only for our domain

### Implementation
```typescript
// On login, set:
res.setHeader('Set-Cookie', `csrf_token=${token}; SameSite=Strict; Secure`);

// On mutation:
const clientToken = req.headers['x-csrf-token'];
const cookieToken = parseCookies(req.headers.cookie).csrf_token;
if (clientToken !== cookieToken) throw new TRPCError({ code: 'FORBIDDEN' });
```

### Safe HTTP Methods (GET, HEAD, OPTIONS) don't need CSRF tokens
Per HTTP spec — safe methods shouldn't change state.

---

## 6. Session Security

### Cookie Flags (Reminder)
```
HttpOnly       — Not accessible to JavaScript (XSS protection)
Secure         — Only over HTTPS
SameSite=Strict — Not sent cross-site (CSRF protection)
Path=/         — Scope to entire app
Domain=app.aims.example.com — No wildcard subdomains
```

### Session Binding
- Access token tied to session ID
- Refresh token tied to session ID
- If session revoked → both invalid
- Session revocation propagates via Redis for near-instant effect

### Session Timeout
- Idle: 30 min (access token expires)
- Absolute: 1 day (refresh token default) or 30 days (Remember Me)
- Hard cap: 30 days from initial login

### Device Limiting (Optional)
Tenant policy: max N sessions per user. Exceeded → oldest revoked.

---

## 7. JWT Security

### Common JWT Pitfalls

| Pitfall | Our Mitigation |
|---------|----------------|
| `alg: none` attack | Only accept EdDSA; explicit algorithm whitelist |
| Key confusion (HS256 ↔ RS256) | Use EdDSA exclusively; don't support multiple algs |
| Weak secrets | Asymmetric keys; private in KMS |
| Too long TTL | 15 min access token |
| Can't revoke | Short TTL + Redis blocklist for sensitive routes |
| PII in claims | Only IDs + roles in claims; no SSN, no email even |

### Our JWT Config
```typescript
import { SignJWT, jwtVerify } from 'jose';
import { readPrivateKey, readPublicKey } from './keys';

async function signJwt(payload: Claims): Promise<string> {
  const privateKey = await readPrivateKey();  // From KMS
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: CURRENT_KEY_ID })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('aims.example.com')
    .setAudience('aims.api')
    .setJti(cuid2())
    .sign(privateKey);
}

async function verifyJwt(token: string): Promise<Claims> {
  const publicKey = await readPublicKey(KID_FROM_HEADER);
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['EdDSA'],
    issuer: 'aims.example.com',
    audience: 'aims.api',
  });
  return payload as Claims;
}
```

---

## 8. MFA Security

### Specific Threats

**TOTP brute force**:
- 6-digit code → 1M combinations
- Mitigation: 5 tries per 15 min, then lockout

**TOTP phishing**:
- Real-time proxy captures code → attacker uses it
- Mitigation: Passkeys (phishing-resistant); detection via device fingerprint mismatch

**TOTP secret extraction**:
- Malware reads authenticator app storage
- Mitigation: Platform authenticators (Touch ID, Windows Hello) are TPM-backed

**WebAuthn counter rollback**:
- Cloned authenticator with old counter
- Mitigation: Strict counter monotonicity check

**Backup code phishing**:
- "Please send me your backup codes"
- Mitigation: Education; backup codes one-time-use limits damage

**MFA device loss**:
- User locked out
- Mitigation: Multiple credentials (TOTP + passkey + backup codes + security key)

---

## 9. SSO Security

### SAML Vulnerabilities (Prevented)

**Signature Wrapping (XSW)**:
- Attacker moves signed portion into unsigned envelope
- Mitigation: Canonicalize before verify; check signature covers entire response

**XML External Entity (XXE)**:
- Inject entities to read files / exfiltrate data
- Mitigation: Disable external entity expansion in XML parser

**Entity Expansion (billion laughs)**:
- Recursive entities crash parser
- Mitigation: XML size limit, expansion limit

**Replay Attack**:
- Re-submit captured SAML response
- Mitigation: InResponseTo check, assertion ID tracking in Redis, short validity window

**NameID confusion**:
- Change NameID to another user's identifier
- Mitigation: Verify NameID in signed portion; check against user_tenants mapping

### OIDC Vulnerabilities (Prevented)

**Authorization code interception**:
- Malicious proxy captures code
- Mitigation: PKCE (even for confidential clients)

**State token missing**:
- CSRF on callback endpoint
- Mitigation: Strict state verification

**Nonce missing**:
- Replay of ID tokens
- Mitigation: Generate nonce per request, verify in ID token claims

**Open redirect in redirect_uri**:
- Configured redirect bypassed
- Mitigation: Strict whitelist of redirect URIs; validate registered exactly

**Insecure audience check**:
- Token meant for another client used
- Mitigation: Verify `aud` claim matches our client_id exactly

---

## 10. Security Headers

Applied to all HTTP responses:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://app.aims.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(self)
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
```

### CSP for Auth Pages
Strict CSP especially for login/signup/reset pages (highest-value targets):
- No inline scripts
- No eval()
- No external resources except trusted CDN (if any)

### Clickjacking Prevention
`X-Frame-Options: DENY` + `frame-ancestors 'none'` in CSP prevents our pages from being framed.

---

## 11. Audit Logging

Every auth event → `audit.auth_events`:

### Events Logged
See `ARCHITECTURE.md §4` for full list. Key events:
- LOGIN_SUCCESS / LOGIN_FAILED (with reason)
- LOGOUT
- MFA_CHALLENGE / MFA_VERIFIED / MFA_FAILED
- PASSWORD_CHANGED / PASSWORD_RESET_*
- ACCOUNT_LOCKED / ACCOUNT_UNLOCKED
- SUSPICIOUS_ACTIVITY
- IMPERSONATION_STARTED / IMPERSONATION_ENDED
- SSO_LOGIN_* / SSO_JIT_PROVISIONED

### What to Capture
- User ID (if known)
- Email attempted (even if user doesn't exist — helps detect enumeration)
- IP address
- User agent
- Device fingerprint
- Geolocation (city, country from IP)
- Success/failure + reason
- MFA method (if used)
- Auth provider (password, google, saml:okta)

### What NOT to Capture
- ❌ Passwords (even hashes)
- ❌ MFA codes (even failed ones)
- ❌ Session tokens
- ❌ API keys
- ❌ Credit card numbers (PCI)

### Retention
- `auth_events`: **1 year** (security analytics window)
- `audit_log`: 7 years (SOX compliance)

### Access
- Tenant admins see their tenant's events
- Superadmins see across tenants (audited)
- SIEM integration: stream to Splunk/Datadog/Elastic

---

## 12. Monitoring & Alerting

### Real-Time Alerts

**Critical** (page on-call immediately):
- 100+ failed logins from same IP in 1 min (credential stuffing)
- 1000+ failed logins across tenant in 5 min
- Refresh token reuse detected
- Successful login from Tor exit after password reset
- Impersonation session created
- API key exfiltrated (log showing key in URL/request body)

**High** (investigate within 1 hour):
- Admin account login from new country
- SSO configuration changed
- MFA removed for privileged user
- High rate of password resets (campaign?)

**Medium** (daily review):
- Failed logins trending up
- New IPs for admin accounts
- Backup codes used
- SSO assertion signature failures

### Dashboards

**Security Operations** (Grafana):
- Login success rate
- Login failure breakdown (by reason)
- MFA adoption rate
- Active sessions (total, by tenant)
- Suspicious activity events (7-day trend)
- Geographic distribution of logins
- SSO health (per tenant, success rate)

**Per-Tenant Admin UI**:
- Last 100 auth events
- Failed logins for this tenant
- Unusual activity flags
- User security status (MFA enrolled, last login, etc.)

---

## 13. Incident Response Runbooks

### Scenario: Credential Stuffing Detected

Indicators: spike in failed logins from diverse IPs against many emails.

Response:
1. Increase rate limits (global 2x tighter for 24h)
2. Enable CAPTCHA for all logins (not just failed)
3. Alert tenants (via admin email) if their users targeted
4. Block IPs with high failure count
5. Review logs post-incident; identify any successful logins during attack → force password reset for those accounts

### Scenario: Stolen Token

Indicators: refresh token reuse, logins from impossible locations.

Response:
1. Revoke affected session + entire family
2. Force user re-authentication
3. Email user + tenant admins
4. If pattern across users → possible session storage compromise → rotate signing keys

### Scenario: Compromised Admin Account

Response:
1. Suspend admin account
2. Revoke all sessions
3. Reset password, force MFA re-enrollment
4. Review audit log for actions taken during compromise
5. Restore any damaged data from backup
6. Notify users affected by any changes

### Scenario: SSO Provider Compromise

Indicators: customer IdP breach disclosed; multiple users affected.

Response:
1. Disable SSO for affected tenant temporarily (coordinate with customer)
2. Force all users to re-authenticate (prevent stolen SSO sessions)
3. Review SSO login events during compromise window
4. Customer may need to rotate SAML signing certs / OIDC secrets

---

## 14. Penetration Testing

### Scope
- All auth flows (login, signup, password reset, MFA)
- Session management (cookie security, revocation)
- SSO (SAML XSW, OIDC token handling)
- Rate limits (can they be bypassed?)
- RBAC (privilege escalation attempts)
- Cross-tenant isolation

### Frequency
- Before initial launch
- Annually thereafter
- After any major auth change

### Providers
- Reputable firms: Trail of Bits, NCC Group, IOActive, Praetorian
- Scope-match with bug bounty platforms (HackerOne, Bugcrowd)

### Remediation SLA
- Critical: 24 hours
- High: 7 days
- Medium: 30 days
- Low: 90 days or deferred to backlog

---

## 15. Compliance Alignment

### OWASP Top 10 (2021)

| OWASP | Item | Our Mitigation |
|-------|------|----------------|
| A01 | Broken Access Control | RLS, RBAC, ABAC |
| A02 | Cryptographic Failures | Argon2id, TLS 1.3, ALE, KMS |
| A03 | Injection | Prisma parameterized queries |
| A04 | Insecure Design | Threat modeling, security review |
| A05 | Security Misconfiguration | IaC, security headers, hardened configs |
| A06 | Vulnerable Components | Dependabot, SCA scanning |
| A07 | Identification & Authentication Failures | This entire doc |
| A08 | Software and Data Integrity Failures | Signed commits, SBOM, immutability |
| A09 | Logging and Monitoring Failures | Comprehensive audit + SIEM |
| A10 | SSRF | No user-controlled URLs in outbound requests |

### NIST 800-63B (Digital Identity Guidelines)

| Assurance Level | Achieved Via |
|----------------|--------------|
| AAL1 (single factor) | Email + password |
| **AAL2** (multi-factor) | Password + TOTP/WebAuthn |
| AAL3 (hardware-bound) | Security key (YubiKey) + biometric |

Default: AAL2. Enterprise can enforce AAL3 for privileged roles.

---

## 16. Known Limitations & Roadmap

### Current Limitations
- No device trust / managed devices enforcement (MDM integration future)
- No risk-based adaptive MFA (ML-based future)
- No behavioral biometrics (keystroke dynamics, etc.)
- No step-up via biometric after login (only at login + sensitive actions)

### Security Roadmap
- Year 1: Core auth, MFA, basic SSO, solid hardening
- Year 2: Advanced risk scoring, FIDO2 hardware keys default for admins, SOC 2 Type II
- Year 3: FedRAMP Moderate, ML-based anomaly detection, hardware security module (HSM) for key signing
- Year 4: FedRAMP High, air-gapped deployment option

---

## 17. Security Reviews

### Before Shipping Any Auth Change
Checklist:
- [ ] Threat model updated
- [ ] Test coverage for new paths
- [ ] Rate limiting applied
- [ ] Audit logging added
- [ ] Metrics emitted
- [ ] Documentation updated
- [ ] Security team review
- [ ] Pen test scope review (for major changes)

### Post-Launch
- Quarterly auth security audit
- Annual third-party pen test
- Continuous bug bounty (after launch)

---

## 18. Contact for Security Issues

### Internal
- On-call: PagerDuty rotation
- Security team: security@aims.example.com (internal)

### External Bug Reports
- `security@aims.example.com` (public; responsible disclosure policy)
- Bug bounty: HackerOne / Bugcrowd

### Responsible Disclosure
- Safe harbor for good-faith researchers
- 90-day disclosure deadline (standard)
- Rewards per severity (Critical: $5k, High: $2k, Medium: $500, Low: $100)
