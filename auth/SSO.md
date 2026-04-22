# Enterprise SSO

> SAML 2.0, OpenID Connect (OIDC), SCIM 2.0 for enterprise identity federation.

---

## Why SSO Matters

- **Enterprise buyer requirement**: Fortune 500 customers demand SSO
- **Security**: Central IdP enforces password policies, MFA, disables ex-employees immediately
- **Compliance**: SOC 2 auditors expect SSO for privileged access
- **UX**: Users don't juggle yet another password
- **Revenue**: Enterprise tier differentiation; common to gate SSO behind premium plans

---

## Protocols Supported

| Protocol | Use Case | Typical IdPs |
|----------|----------|--------------|
| **SAML 2.0** | Legacy enterprise IdPs | Okta, Azure AD, ADFS, OneLogin, Ping, Shibboleth |
| **OIDC** (OpenID Connect) | Modern cloud IdPs | Okta, Azure AD, Auth0, Google Workspace |
| **SCIM 2.0** | User provisioning | Okta, Azure AD, Workday |

---

## 1. SAML 2.0

### Terminology
- **SP** (Service Provider): AIMS (us)
- **IdP** (Identity Provider): Customer's identity system
- **EntityID**: Unique identifier (URL)
- **ACS** (Assertion Consumer Service): Our endpoint that receives SAML responses
- **SLO** (Single Logout): Endpoint for coordinated logout

### Our SP Configuration (Per Tenant)
Each tenant gets:
- **EntityID**: `https://app.aims.example.com/saml/{tenantId}`
- **ACS URL**: `https://app.aims.example.com/auth/saml/{tenantId}/acs`
- **SLO URL**: `https://app.aims.example.com/auth/saml/{tenantId}/slo`
- **Metadata URL**: `https://app.aims.example.com/auth/saml/{tenantId}/metadata.xml`
- **Signing certificate** (ours): Public cert exposed via metadata; private key in KMS

### Tenant Admin Setup Flow

```
1. Tenant admin: Settings → SSO → Configure SAML

2. Download our metadata XML, upload to their IdP:
   OR copy:
   - EntityID
   - ACS URL
   - SLO URL
   - Our signing certificate (PEM)

3. Admin configures their IdP:
   - Create SAML app for "AIMS"
   - Map attributes:
     - NameID = user's email
     - email = user.email
     - firstName, lastName, displayName
     - groups or role (optional)
   - Assign users/groups to the app
   - Download their metadata OR extract:
     - IdP EntityID
     - IdP SSO URL
     - IdP signing certificate

4. Back in AIMS: paste IdP metadata URL OR upload XML
   OR fill fields manually

5. Configure attribute mapping (see below)

6. Add email domains: "acme.com, acme-corp.com"
7. Click "Verify domain" (DNS TXT record check)

8. Test: "Send test SAML request"
   - AIMS sends AuthnRequest to IdP
   - IdP responds with assertion
   - AIMS validates & shows success

9. Enable SSO: toggle ON
   - Optional: enforce SSO (disable password login for users with matching email)
```

### Attribute Mapping

```json
{
  "attributes": {
    "email": "email",                     // SAML attribute name → AIMS field
    "name": "displayName",
    "firstName": "givenName",
    "lastName": "surname",
    "role": "aimsRole",                   // If IdP sends role
    "department": "department",
    "phone": "mobilePhone"
  },
  "groupToRoleMap": {
    "aims-admins": "ADMIN",
    "aims-directors": "DIRECTOR",
    "aims-auditors": "SENIOR_AUDITOR"
  }
}
```

### SAML Request Flow

```
Browser ───▶ app.aims.com/login
            User enters: jane@acme.com

Server:
  1. Check: acme.com in sso_configurations.emailDomains
  2. If yes → generate SAML AuthnRequest:

<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    ID="_abc123" Version="2.0"
    IssueInstant="2026-04-19T10:32:11Z"
    Destination="https://idp.acme.com/sso"
    AssertionConsumerServiceURL="https://app.aims.com/auth/saml/tnt_acme/acs"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>https://app.aims.com/saml/tnt_acme</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>
  <samlp:RequestedAuthnContext Comparison="minimum">
    <saml:AuthnContextClassRef>
      urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
    </saml:AuthnContextClassRef>
  </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>

  3. Sign request (SHA-256 with our private key)
  4. Base64-encode + deflate
  5. Redirect browser:
     https://idp.acme.com/sso?SAMLRequest=<encoded>&RelayState=/dashboard
  6. Store request ID in Redis (for InResponseTo check, 10-min TTL)
```

### SAML Response Handling

```
IdP ───▶ POST /auth/saml/tnt_acme/acs
         Body: SAMLResponse=<base64>&RelayState=/dashboard

Server:
  1. Decode SAML response (base64 → XML)
  2. Verify signature (against IdP's cert)
  3. Canonicalize XML first (C14N) to prevent XSW attacks
  4. Verify:
     - Status: urn:oasis:names:tc:SAML:2.0:status:Success
     - InResponseTo: matches request we sent (Redis lookup)
     - NotBefore / NotOnOrAfter: within valid window
     - Audience: matches our EntityID
     - Recipient: matches our ACS URL
  5. Extract NameID + attributes
  6. Apply attribute mapping
  7. Look up user by email:
     - Found: log them in, update attributes if changed
     - Not found + JIT enabled: create User + UserTenant with mapped role
     - Not found + JIT disabled: error "Contact your admin for access"
  8. Create session
  9. Log SSO_LOGIN_SUCCESS
  10. Redirect to RelayState (original URL)
```

### Signature Verification (Critical)

SAML XML Signature is complex. Key vulnerabilities:
- **Signature wrapping (XSW)**: Attacker wraps signed portion in unsigned envelope
- **Comment injection**: `<email>foo@evil.com<!-- -->@good.com</email>`
- **Namespace injection**: Duplicate/override XML namespaces

### Mitigations
- Use battle-tested library (`samlify`, `passport-saml`, or `@node-saml/node-saml`)
- Canonicalize **before** signature verification
- Check signature covers entire response (not just parts)
- Disable DTD processing (XXE prevention)
- Validate XML against schema before parsing

### Recommended Library: `@node-saml/node-saml`
```typescript
import { SAML } from '@node-saml/node-saml';

const saml = new SAML({
  entryPoint: tenant.ssoConfiguration.samlSsoUrl,
  issuer: `https://app.aims.com/saml/${tenantId}`,
  callbackUrl: `https://app.aims.com/auth/saml/${tenantId}/acs`,
  cert: tenant.ssoConfiguration.samlX509Cert,
  signatureAlgorithm: 'sha256',
  audience: `https://app.aims.com/saml/${tenantId}`,
  // Security hardening:
  wantAssertionsSigned: true,
  disableRequestedAuthnContext: false,
  forceAuthn: false,
});

// Generate request
const url = await saml.getAuthorizeUrlAsync(relayState, host, options);

// Verify response
const { profile } = await saml.validatePostResponseAsync(body);
```

### Single Logout (SLO)

User logs out in AIMS:
1. Revoke our session
2. Send SAML LogoutRequest to IdP
3. IdP terminates session there too
4. IdP sends LogoutResponse to us
5. Close the loop

**Caveat**: SLO is optional and fragile. Many IdPs have incomplete implementations. If SLO fails, we still log out locally.

### IdP-Initiated SSO

User clicks AIMS bookmark in IdP portal → IdP posts SAML response directly to ACS without our AuthnRequest.

**Security concern**: No InResponseTo check possible → vulnerable to replay.

**Our stance**: Support IdP-initiated but with additional guards:
- Short assertion validity window (5 min)
- Anti-replay via assertionID tracking (Redis, 10-min TTL)
- Recommended: SP-initiated preferred, advertised in docs

---

## 2. OpenID Connect (OIDC)

Modern protocol. Simpler than SAML. JSON-based. Built on OAuth 2.0.

### Our Configuration (Per Tenant)

- **Client ID**: Generated per tenant (shown to admin to paste in IdP)
- **Client Secret**: Generated per tenant (encrypted via ALE)
- **Redirect URI**: `https://app.aims.example.com/auth/oidc/{tenantId}/callback`
- **Scopes requested**: `openid email profile`

### Tenant Admin Setup Flow

```
1. Settings → SSO → Configure OIDC

2. Admin creates OIDC app in IdP (Okta, Azure AD, etc.):
   - App type: Web application
   - Redirect URI: (paste from AIMS)
   - Scopes: openid, email, profile (and any custom scopes)

3. IdP gives admin:
   - Issuer URL: https://{idp}/
   - Client ID
   - Client Secret

4. Admin enters in AIMS:
   - Issuer URL
   - Client ID
   - Client Secret
   - (Optional) Attribute mapping

5. AIMS fetches discovery document:
   GET {issuer}/.well-known/openid-configuration
   - Finds authorization_endpoint, token_endpoint, jwks_uri
   - Caches for 1 hour

6. Test + Enable
```

### OIDC Authentication Flow

```
User: "Log in with Acme SSO"

Server:
  1. Generate state (CSRF protection), nonce (replay protection), PKCE code_verifier
  2. Store state + nonce + code_verifier in Redis (10-min TTL)
  3. Redirect browser:
     https://idp.acme.com/authorize?
       client_id={ours}&
       redirect_uri=https://app.aims.com/auth/oidc/tnt_acme/callback&
       response_type=code&
       scope=openid+email+profile&
       state={state}&
       nonce={nonce}&
       code_challenge={sha256(code_verifier)}&
       code_challenge_method=S256

User authenticates on IdP (with their MFA etc.)

IdP redirects:
  /auth/oidc/tnt_acme/callback?code={auth_code}&state={state}

Server:
  1. Verify state (CSRF check)
  2. Exchange code for tokens (server-to-server):
     POST {idp}/token
     Body:
       grant_type=authorization_code
       code={auth_code}
       redirect_uri=...
       client_id={ours}
       client_secret={ours}
       code_verifier={ours, from Redis}

  3. Receive:
     {
       "access_token": "...",
       "id_token": "...",       // JWT
       "refresh_token": "...",
       "token_type": "Bearer",
       "expires_in": 3600
     }

  4. Verify id_token:
     - Signature (JWKS lookup, cached)
     - iss: matches IdP issuer
     - aud: matches our client_id
     - exp: not passed
     - iat: recent
     - nonce: matches what we stored

  5. Extract claims (sub, email, name, etc.)

  6. Optional: call /userinfo endpoint for additional claims:
     GET {idp}/userinfo
     Authorization: Bearer {access_token}

  7. Find or JIT-provision user (same logic as SAML)

  8. Create session
```

### Why PKCE for Confidential Clients?

PKCE was designed for public clients (mobile apps) but is now recommended for **all** OAuth 2.0 flows (OAuth 2.1 draft). Defense-in-depth: even if client_secret leaks, attackers can't redeem stolen auth codes.

### Recommended Library: `openid-client`
```typescript
import { Issuer } from 'openid-client';

const issuer = await Issuer.discover(tenant.oidcIssuer);
const client = new issuer.Client({
  client_id: tenant.oidcClientId,
  client_secret: await decrypt(tenant.oidcClientSecret),
  redirect_uris: [`https://app.aims.com/auth/oidc/${tenantId}/callback`],
  response_types: ['code'],
});

// Generate authorization URL
const codeVerifier = openidClient.generators.codeVerifier();
const codeChallenge = openidClient.generators.codeChallenge(codeVerifier);
const nonce = openidClient.generators.nonce();
const state = openidClient.generators.state();

const authUrl = client.authorizationUrl({
  scope: 'openid email profile',
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  state,
  nonce,
});

// Handle callback
const params = client.callbackParams(req);
const tokenSet = await client.callback(redirectUri, params, {
  state: storedState,
  nonce: storedNonce,
  code_verifier: storedCodeVerifier,
});
```

---

## 3. SCIM 2.0 (Provisioning)

SCIM = System for Cross-Domain Identity Management. Standard protocol for user lifecycle automation.

### What SCIM Enables
- **Auto-provision**: IdP creates user in AIMS when added to group
- **Auto-update**: Changes in IdP reflect in AIMS (name, role, email)
- **Auto-deprovision**: User removed from IdP → deactivated in AIMS (critical for security!)

### Our SCIM Endpoint

Per-tenant SCIM base URL:
```
https://app.aims.example.com/api/scim/v2/{tenantId}
```

### Authentication
- Bearer token (generated per tenant, encrypted server-side)
- Rotate every 90 days (admin can regenerate)

### Endpoints Implemented (SCIM 2.0 Core)

| Endpoint | Purpose | Methods |
|----------|---------|---------|
| `/Users` | List/search users | GET, POST |
| `/Users/{id}` | Get/update/delete user | GET, PUT, PATCH, DELETE |
| `/Groups` | List/search groups | GET, POST |
| `/Groups/{id}` | Get/update/delete group | GET, PUT, PATCH, DELETE |
| `/Schemas` | Schema discovery | GET |
| `/ResourceTypes` | Resource type discovery | GET |
| `/ServiceProviderConfig` | Capabilities | GET |

### SCIM User Resource

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "clusr_01h7m8...",
  "externalId": "okta_00u123abc",
  "userName": "jane@acme.com",
  "name": {
    "givenName": "Jane",
    "familyName": "Doe",
    "formatted": "Jane Doe"
  },
  "emails": [
    {
      "value": "jane@acme.com",
      "primary": true
    }
  ],
  "active": true,
  "groups": [
    {
      "value": "engineering",
      "display": "Engineering"
    }
  ],
  "meta": {
    "resourceType": "User",
    "created": "2026-04-19T10:32:11Z",
    "lastModified": "2026-04-19T10:32:11Z",
    "location": "https://app.aims.com/api/scim/v2/tnt_acme/Users/clusr_..."
  }
}
```

### Create User (POST /Users)

```http
POST /api/scim/v2/tnt_acme/Users
Authorization: Bearer {scim_token}
Content-Type: application/scim+json

{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "jane@acme.com",
  "name": {
    "givenName": "Jane",
    "familyName": "Doe"
  },
  "emails": [{ "value": "jane@acme.com", "primary": true }],
  "active": true,
  "externalId": "okta_00u123abc"
}

→ 201 Created
{
  "id": "clusr_...",
  ... (full resource)
}
```

### Deactivate User (PATCH /Users/{id})

```http
PATCH /api/scim/v2/tnt_acme/Users/clusr_...
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [
    { "op": "replace", "path": "active", "value": false }
  ]
}

Server action:
- Set UserTenant.suspendedAt = now
- Revoke all user sessions for this tenant
- User can no longer log in to this tenant
- If user has other tenants, can still access those
```

### Group Operations

Groups map to AIMS roles. E.g., "aims-admins" group → ADMIN role.

Adding user to group:
```http
PATCH /Groups/{groupId}
{
  "Operations": [
    { "op": "add", "path": "members", "value": [{ "value": "clusr_..." }] }
  ]
}

Server action:
- Update user's role based on group mapping
- Log ROLE_CHANGED audit event
```

### Filtering (GET /Users?filter=)

SCIM supports rich filters. We support common ones:
- `filter=userName eq "jane@acme.com"`
- `filter=active eq true`
- `filter=meta.lastModified gt "2026-01-01T00:00:00Z"`
- `filter=emails.value co "@acme.com"` (contains)

### Rate Limiting SCIM
- 1000 req/min per SCIM token
- IdPs do bulk operations; higher limits than user-facing API

### Testing SCIM
- Recommend `okta-scim-tester` for conformance tests
- Microsoft has their own SCIM validator

---

## 4. Just-In-Time (JIT) Provisioning

When a user authenticates via SSO but doesn't yet exist in AIMS:

**With JIT enabled** (default):
- Auto-create User record (email, name from IdP)
- Auto-create UserTenant with role from:
  1. Attribute mapping (if IdP provides role)
  2. Group-to-role map (if IdP provides groups)
  3. `ssoConfiguration.defaultRole` (fallback)
- User logs in immediately

**With JIT disabled** (enterprise opt-out):
- Show error: "Contact your administrator"
- Send notification to tenant admin
- Admin must manually invite user

### Default Role Considerations
- Conservative: VIEWER (least privilege)
- Convenient: STAFF_AUDITOR
- Tenant admin decides; default VIEWER recommended

---

## 5. Enforcement & Fallback

### Tenant Policy Options

**Policy A: Mixed** (default)
- SSO available for users in SSO email domain
- Password login still available as fallback
- Risk: SSO bypass if password is weak/compromised

**Policy B: SSO Enforced for Domain**
- Users with email @acme.com **must** use SSO
- Password login returns error: "Your organization requires SSO login"
- Recommended for mature enterprise tenants

**Policy C: SSO Only for Role**
- ADMIN users must use SSO; others can use password
- Useful during migration

### Break Glass
- If SSO is broken (IdP down), tenant admin can temporarily disable SSO enforcement
- Requires admin MFA verification
- Audit-logged
- Time-boxed (auto-re-enable after 24 hours)

---

## 6. Domain Verification

Tenants claim email domains for SSO routing. We verify they actually own the domain.

### Methods

**DNS TXT Record** (recommended):
```
_aims-verification.acme.com TXT "aims-verify=tnt_acme_01hxkz..."
```
AIMS periodically re-checks. Removal doesn't auto-revoke (just requires re-verify for new operations).

**Email Verification** (backup):
```
Send verification link to admin@acme.com (or postmaster@, hostmaster@)
```

**Manual** (enterprise contracts):
Sales/support verifies during onboarding call.

### Why Verify
Without verification, a malicious tenant could claim `gmail.com` → all Gmail users would SSO into the attacker's tenant.

---

## 7. Multi-Tenant SSO Considerations

### One User, Multiple Tenants via SSO
Jane works for Acme Corp (SSO via Okta) and consults for Beta LLC (SSO via Azure AD).
- Same email across both? Problem: which SSO to use?
- **Solution**: Ask user on login which tenant to access
- Or: Tenant selector in UI before SSO redirect

### SSO for Platform Admins
Platform superadmins typically use our own IdP (not customer IdPs).
- Separate SSO config for internal admin panel
- Can also be standard password + MFA for employees

---

## 8. Testing SSO

### SAML Test Suite
- Okta: Create dev account, use as test IdP
- `samltool.com` for debugging requests/responses
- Local SimpleSAMLphp instance for isolated testing

### OIDC Test Suite
- `openid.net/certification/testing/` conformance tests
- Auth0 as test IdP (free tier)

### Integration Testing
- Each supported IdP should have automated integration tests
- Common IdPs to test: Okta, Azure AD, ADFS, Google Workspace, OneLogin

---

## 9. Common SSO Issues & Debugging

| Issue | Cause | Fix |
|-------|-------|-----|
| Clock skew (NotBefore failure) | Server clocks differ | NTP sync; allow ±5 min |
| Signature verification failure | Cert mismatch | Re-upload correct cert |
| XSW attack attempt | Misconfigured library | Use maintained lib with XSW mitigations |
| Attribute mapping wrong | Missing attribute | Show what IdP sent; admin maps |
| User gets wrong role | Group mapping incomplete | Review role map |
| Session not created after SSO | RelayState issue | Always use RelayState or default route |
| IdP-initiated SSO fails | No InResponseTo | Support IdP-initiated with replay protection |

---

## 10. Admin UI for SSO

Tenant admins need:
- **SSO configuration form** (SAML fields, OIDC fields, attribute mapping)
- **Test connection** button
- **View logs** (last 100 SSO login attempts with success/fail reasons)
- **Enforcement policy** toggles
- **SCIM token** rotation (show once)
- **Domain verification** status
- **Disable SSO** (with warning — users can't log in until re-enabled or domain re-verified)

---

## 11. SSO Event Logging

All SSO activity → `audit.auth_events`:
- `SSO_LOGIN_SUCCESS`
- `SSO_LOGIN_FAILED` (with reason: signature, expired, unknown user, etc.)
- `SSO_JIT_PROVISIONED` (new user auto-created)
- `SSO_ATTRIBUTE_MAPPED` (role updated based on IdP attributes)
- `SCIM_USER_CREATED`
- `SCIM_USER_UPDATED`
- `SCIM_USER_DEACTIVATED`
- `SSO_CONFIG_CHANGED`

Admins can view these in tenant SSO log panel.

---

## 12. Compliance Considerations

### SAML + FIPS 140-2
Government tenants may require FIPS-compliant crypto. Use SHA-256 minimum; avoid SHA-1. Certificates use NIST P-256 curves.

### OIDC + FAPI
Financial-grade API (FAPI) is an OIDC profile for high-security scenarios (banking). Support in roadmap if needed for banking audit clients.

### SCIM + GDPR
SCIM deprovisioning is the mechanism for Article 17 (right to erasure) in enterprise — IdP admin removes user → AIMS auto-deactivates.

---

## 13. Implementation Roadmap

### Phase 1: Foundation (MVP)
- Basic SAML 2.0 support
- Okta + Azure AD tested
- Manual user provisioning (no SCIM)
- JIT provisioning opt-in

### Phase 2: OIDC
- OIDC support with PKCE
- Google Workspace + Okta OIDC tested

### Phase 3: SCIM
- SCIM 2.0 basic endpoints
- User + Group management
- Okta SCIM conformance certified

### Phase 4: Advanced
- SLO (Single Logout)
- IdP-initiated SSO
- Custom attribute mappings
- Group-to-role mapping UI
- Domain verification via DNS

### Phase 5: Polish
- More IdP presets (ADFS, OneLogin, Ping, JumpCloud)
- FAPI profile for financial tenants
- SSO analytics dashboard

---

## 14. Library Recommendations

| Protocol | Library | Notes |
|----------|---------|-------|
| SAML | `@node-saml/node-saml` | Active fork, good XSW protections |
| OIDC | `openid-client` | Mature, OAuth 2.1 ready |
| SCIM | Custom (thin on top of Express) | Most SCIM libs are stale |

---

## 15. What We DON'T Support (Yet)

- **WS-Federation** (Microsoft legacy, largely superseded by SAML)
- **LDAP direct** (use LDAP via IdP that supports SAML/OIDC)
- **Active Directory direct** (use ADFS → SAML)
- **Kerberos** (in-house network auth, not relevant for SaaS)
- **CAS** (Central Authentication Service, academic)

Can add if strong customer demand.
