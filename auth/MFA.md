# Multi-Factor Authentication (MFA)

> TOTP, WebAuthn/passkeys, backup codes. No SMS MFA (SIM-swap attack surface).

---

## MFA Methods Supported

| Method | Type | Phishing-Resistant | User-Friendly | Recovery |
|--------|------|--------------------|--------------:|----------|
| **Passkey (WebAuthn)** | Possession + biometric | ✅ | ✅ High (Touch ID, Face ID) | Sync via Apple/Google |
| **TOTP** (Google Auth, Authy, 1P) | Possession | ❌ (phishable) | 🟡 Medium (type 6 digits) | Backup codes |
| **Security Key** (YubiKey) | Possession | ✅ | 🟡 Medium (carry the key) | Multiple keys |
| **Backup Codes** | Knowledge | ❌ | ❌ Low (emergency only) | N/A |
| ~~SMS~~ | Possession (weak) | ❌ | ✅ | N/A — **NOT SUPPORTED** |

### Why No SMS
SIM swap attacks are common and SMS is unencrypted. Audit data demands stronger MFA. NIST 800-63B deprecated SMS as of 2017.

---

## 1. TOTP (Time-Based One-Time Password)

Standard: **RFC 6238**. Compatible with Google Authenticator, Authy, 1Password, Microsoft Authenticator, Duo, etc.

### Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | HMAC-SHA1 (RFC 6238 default; compatible with all authenticators) |
| Digits | 6 |
| Period | 30 seconds |
| Secret length | 160 bits (20 bytes) |
| Encoding | Base32 |

### Enrollment Flow

```
1. User requests MFA enrollment
2. Server generates:
   - Secret: random 20 bytes
   - Base32 encoded (e.g., "JBSWY3DPEHPK3PXP")
   - Encrypted with ALE before storage
3. Server stores pending credential (disabled=true)
4. Server generates otpauth URI:
   otpauth://totp/AIMS:jane%40acme.com?secret=JBSWY3...&issuer=AIMS&digits=6&period=30
5. Browser renders QR code client-side (privacy — secret never leaves client after initial load)
6. User scans with authenticator app
7. User enters current 6-digit code
8. Server verifies code (with ±1 window for clock drift = 30s tolerance)
9. If valid: mark credential enabled, generate 10 backup codes
10. Display backup codes ONE TIME (user must save)
11. Log MFA_ENROLLED event
```

### Verification Flow

```typescript
function verifyTotp(secret: string, userCode: string, window = 1): boolean {
  const now = Math.floor(Date.now() / 1000);
  const step = 30;

  for (let i = -window; i <= window; i++) {
    const t = Math.floor(now / step) + i;
    const expected = generateTotp(secret, t);
    if (constantTimeEquals(userCode, expected)) {
      // Rate limit: store (userId, t) in Redis for 30s to prevent reuse
      const usedKey = `totp_used:${userId}:${t}`;
      if (await redis.exists(usedKey)) return false;
      await redis.setex(usedKey, 60, '1');
      return true;
    }
  }
  return false;
}

function generateTotp(secret: string, timeStep: number): string {
  const secretBytes = base32Decode(secret);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigInt64(0, BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', secretBytes);
  hmac.update(Buffer.from(counter));
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) |
               ((digest[offset + 1] & 0xff) << 16) |
               ((digest[offset + 2] & 0xff) << 8) |
               (digest[offset + 3] & 0xff);

  return (code % 10 ** 6).toString().padStart(6, '0');
}
```

### Secret Storage

Secrets are **encrypted** with ALE before DB storage:
```sql
UPDATE mfa_credentials
SET totp_secret = pgp_sym_encrypt(?, current_setting('app.field_encryption_key'))
WHERE id = ?;
```

On verification, decrypt:
```sql
SELECT pgp_sym_decrypt(totp_secret::bytea, current_setting('app.field_encryption_key')) AS secret
FROM mfa_credentials
WHERE id = ?;
```

Encryption key rotated annually via KMS envelope encryption.

### Anti-Replay Protection

Each verified code stored in Redis with 60s TTL. Re-submission rejected.

### Clock Drift Tolerance

Allow ±1 time step (30s) to handle clock skew between server and device.

---

## 2. WebAuthn (Passkeys)

Standard: **W3C WebAuthn Level 3** (2024). Supported by all modern browsers, OS password managers, hardware keys.

### Types of Passkeys

| Type | Storage | Sync | Use Case |
|------|---------|------|----------|
| **Platform (synced)** | Device keychain | iCloud/Google/1P | Default for most users |
| **Platform (device-bound)** | TPM / Secure Enclave | No | High-security preference |
| **Roaming (hardware key)** | YubiKey, Titan, etc. | No | Enterprise / high-security |

### Enrollment (Registration)

```typescript
// Server-side: generate creation options
const options = {
  challenge: randomBytes(32),                // CSPRNG; stored in Redis, 5-min TTL
  rp: {
    id: 'aims.example.com',
    name: 'AIMS',
  },
  user: {
    id: encodeUserId(user.id),               // 64-byte user handle
    name: user.email,
    displayName: user.name,
  },
  pubKeyCredParams: [
    { type: 'public-key', alg: -8 },         // EdDSA (Ed25519)
    { type: 'public-key', alg: -7 },         // ES256 (ECDSA P-256)
    { type: 'public-key', alg: -257 },       // RS256 (RSA SHA-256)
  ],
  authenticatorSelection: {
    userVerification: 'preferred',           // Prefer biometric/PIN; fall back to 'presence'
    residentKey: 'preferred',                // Enable discoverable credentials for UX
    authenticatorAttachment: undefined,      // Allow any (platform or cross-platform)
  },
  attestation: 'none',                       // Privacy-respecting; we don't need manufacturer verification
  excludeCredentials: user.existingCredentials.map(c => ({
    type: 'public-key',
    id: c.credentialId,
  })),
  timeout: 60000,
};

// Client: navigator.credentials.create(options)
// User interacts with authenticator (Touch ID, Face ID, security key press)

// Server-side: verify registration
async function verifyRegistration(credential, storedChallenge) {
  const { id, rawId, response, type } = credential;

  // Parse attestationObject and clientDataJSON
  const clientData = JSON.parse(atob(response.clientDataJSON));
  const attestation = parseAttestation(response.attestationObject);

  // Verify challenge matches
  if (clientData.challenge !== storedChallenge) throw new Error('Challenge mismatch');
  // Verify origin
  if (clientData.origin !== 'https://app.aims.example.com') throw new Error('Bad origin');
  // Verify type
  if (clientData.type !== 'webauthn.create') throw new Error('Bad type');
  // Verify RP ID hash
  if (!compareBuffers(attestation.authData.rpIdHash, sha256('aims.example.com'))) {
    throw new Error('RP ID mismatch');
  }
  // Verify flags: UV (user verified) set
  if ((attestation.authData.flags & 0x04) === 0) throw new Error('User verification required');

  // Store credential
  await prisma.mfaCredential.create({
    data: {
      userId: user.id,
      type: 'WEBAUTHN',
      credentialId: credential.id,
      publicKey: attestation.authData.attestedCredentialData.publicKey,
      counter: attestation.authData.signCount,
      transports: response.transports,
      aaguid: attestation.authData.attestedCredentialData.aaguid,
      backupEligible: !!(attestation.authData.flags & 0x08),
      backupState: !!(attestation.authData.flags & 0x10),
      nickname: userProvidedNickname,
    },
  });
}
```

### Authentication (Login)

```typescript
// Server-side: generate request options
const options = {
  challenge: randomBytes(32),
  rpId: 'aims.example.com',
  allowCredentials: userProvided
    ? user.credentials.map(c => ({
        type: 'public-key',
        id: c.credentialId,
        transports: c.transports,
      }))
    : [],    // Empty = discoverable credentials (passwordless)
  userVerification: 'preferred',
  timeout: 60000,
};

// Client: navigator.credentials.get(options)

// Server-side: verify authentication
async function verifyAuth(assertion, storedChallenge, storedCredential) {
  const { id, response } = assertion;

  const clientData = JSON.parse(atob(response.clientDataJSON));
  if (clientData.challenge !== storedChallenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== 'https://app.aims.example.com') throw new Error('Bad origin');
  if (clientData.type !== 'webauthn.get') throw new Error('Bad type');

  // Reconstruct signed data
  const authData = base64decode(response.authenticatorData);
  const clientDataHash = sha256(response.clientDataJSON);
  const signedData = Buffer.concat([authData, clientDataHash]);

  // Verify signature with stored public key
  const sigValid = verifySignature(
    storedCredential.publicKey,
    signedData,
    response.signature,
  );
  if (!sigValid) throw new Error('Signature invalid');

  // Verify counter increased (clone detection)
  const newCounter = parseCounter(authData);
  if (newCounter !== 0 && newCounter <= storedCredential.counter) {
    // Possible cloned authenticator
    throw new Error('Counter regression detected');
  }
  await prisma.mfaCredential.update({
    where: { id: storedCredential.id },
    data: { counter: newCounter, lastUsedAt: new Date() },
  });

  // Verify user presence (UP flag) at minimum
  if ((authData[32] & 0x01) === 0) throw new Error('User presence required');
}
```

### Discoverable Credentials (Passwordless)

With `residentKey: 'preferred'`, passkeys are "discoverable" — the server doesn't need to know the user in advance. Click "Log in with passkey" → authenticator prompts user to choose → user handle sent back → server looks up user.

This enables **true passwordless**: no username/email input needed.

### Library Choice

**SimpleWebAuthn** (Node.js) — excellent server + browser helpers. Handles WebAuthn protocol parsing correctly.

```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
```

---

## 3. Security Keys (Hardware-Only)

Subset of WebAuthn. Enrolled as type=WEBAUTHN with `authenticatorAttachment: 'cross-platform'`.

Examples:
- YubiKey 5 (USB-A, USB-C, NFC, Lightning)
- Google Titan
- SoloKeys (open hardware)

### Enterprise Use Case
Government, financial, defense customers may require hardware keys for sensitive roles (Audit Director, QA Reviewer). Configurable via tenant policy.

### Multiple Keys
Users can enroll multiple keys (primary + backup). Common pattern: one key at home, one in office.

---

## 4. Backup Codes

When TOTP/passkey lost, backup codes provide recovery.

### Format
- 10 codes per set
- Each code: 16 characters, format `xxxx-xxxx-xxxx` (3 groups of 4 base32)
- Random (CSPRNG)
- Displayed ONE TIME at enrollment (or regeneration)

### Storage
Each code **hashed** with Argon2id before DB storage:
```sql
-- backup_codes is String[] in mfa_credentials
-- Each element is argon2id hash of one code
```

### Verification
```typescript
async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const credentials = await prisma.mfaCredential.findMany({
    where: { userId, type: 'BACKUP_CODES', disabled: false },
  });

  for (const cred of credentials) {
    for (let i = 0; i < cred.backupCodes.length; i++) {
      if (await argon2.verify(cred.backupCodes[i], code)) {
        // Remove used code (one-time use)
        const remaining = [...cred.backupCodes];
        remaining.splice(i, 1);
        await prisma.mfaCredential.update({
          where: { id: cred.id },
          data: { backupCodes: remaining, lastUsedAt: new Date() },
        });

        // If fewer than 3 codes remain, prompt user to regenerate
        if (remaining.length < 3) {
          await notifyUser(userId, 'backup_codes_low');
        }

        return true;
      }
    }
  }
  return false;
}
```

### Regeneration
User can regenerate at any time (invalidates all old codes). Requires fresh MFA verification to prevent lockout.

---

## 5. MFA Enforcement Policies

### Per-Tenant Policy
Tenant admin configures:
- **None**: MFA optional (default for free tier)
- **Required for all**: All users must enroll within 7 days of tenant activation
- **Required for roles**: Specific roles (ADMIN, DIRECTOR) must have MFA
- **Required for SSO skip**: If user authenticates via SSO, skip our MFA (IdP handles)

### Enforcement Behavior

**Grace period**: New user has 7 days (configurable) to enroll MFA before being blocked.

**After grace period, blocked user**:
```json
{
  "error": {
    "code": "MFA_ENROLLMENT_REQUIRED",
    "message": "Your tenant requires MFA. Please enroll within 7 days.",
    "details": { "graceEndsAt": "2026-04-26T00:00:00Z", "enrollUrl": "/account/security/mfa" }
  }
}
```

UI redirects to enrollment flow.

### MFA Required for Specific Actions

Even if tenant doesn't enforce MFA generally, some actions require it:
- Changing password
- Enrolling/removing MFA (naturally)
- Downloading GDPR export
- Creating API keys
- Closing tenant
- Impersonation (superadmin)

See FLOWS.md §21 (step-up auth).

---

## 6. Trusted Devices (Optional)

"Don't ask for MFA on this device for 30 days" option.

### Implementation
- Cookie: `aims_device_trust=<token>`
- Bound to (userId, deviceFingerprint, tenantId)
- Server-side record:
  ```prisma
  model TrustedDevice {
    id         String @id @default(cuid())
    userId     String
    tenantId   String
    fingerprint String
    trustedAt  DateTime @default(now())
    expiresAt  DateTime
    lastUsedAt DateTime @default(now())
    ...
  }
  ```
- On login, check trusted device → skip MFA if valid

### Caveats
- Not available for sensitive actions (always require fresh MFA)
- User can revoke from Settings → Security → Trusted Devices
- Tenant can disable the feature

### Controversial
Some security experts discourage this. We make it **opt-in per user** with clear messaging about trade-offs.

---

## 7. Account Recovery (Last Resort)

User loses all MFA methods AND backup codes. What now?

### Path 1: Another Admin Resets
Tenant admin can reset user's MFA via admin panel:
```
/admin/users/{id}/reset-mfa
```
- Requires admin's MFA verification
- Sends email to user
- User forced through MFA re-enrollment on next login
- Logged as MFA_RESET_BY_ADMIN

### Path 2: Platform Support
If the user IS the sole tenant admin:
1. User contacts support
2. Support verifies identity (video call, KYC, gov ID)
3. Support creates recovery ticket
4. Superadmin resets MFA (heavily audited)
5. User re-enrolls on next login

### Path 3: Account Recovery via Email (Disabled by Default)
Standard SaaS pattern: email link bypasses MFA.

**We DON'T enable this by default** for audit platform. Audit data is high-value; account takeover via compromised email is a known attack. Tenants can opt in if they accept the risk.

---

## 8. Enrollment UX

### Enrollment Priority Prompt

First time user logs in post-signup:
```
┌──────────────────────────────────────────┐
│ Secure your account                      │
│                                          │
│ [ Set up passkey (recommended) ]         │
│ [ Set up authenticator app (TOTP) ]      │
│ [ Set up security key ]                  │
│                                          │
│ [ Remind me in 7 days ]                  │
└──────────────────────────────────────────┘
```

### Passkey Setup Flow
```
1. Click "Set up passkey"
2. Browser prompts biometric/security key
3. Nickname prompt ("MacBook Pro Touch ID")
4. Confirmation + backup codes offered
5. Done
```

Total time: 30 seconds.

### TOTP Setup Flow
```
1. Click "Set up authenticator app"
2. QR code displayed + manual entry key
3. User scans with app
4. Enter 6-digit code
5. Backup codes shown (save them!)
6. Done
```

Total time: 2-3 minutes.

---

## 9. MFA Metrics to Track

- **Enrollment rate**: % of active users with MFA enrolled
- **Passkey adoption**: % of MFA users with passkeys
- **TOTP adoption**: % with TOTP
- **Hardware key adoption**: % with security keys
- **Multi-method adoption**: % with 2+ methods
- **Backup code usage**: frequency (high = people losing devices)
- **MFA bypass attempts**: failed MFA challenges per login
- **Time to complete MFA**: p50, p99

---

## 10. Known Attacks & Mitigations

| Attack | Mitigation |
|--------|-----------|
| **Credential stuffing** | MFA blocks even with correct password |
| **Phishing (password + TOTP)** | Passkeys are phishing-resistant (bound to origin) |
| **Real-time phishing (AiTM)** | Passkeys defeat this; TOTP is vulnerable |
| **SIM swap** | We don't support SMS |
| **MFA fatigue** | No push notifications; user initiates challenge |
| **TOTP brute force** | Rate limit 5 attempts per 15 min |
| **Secret extraction from device** | TPM-backed storage (WebAuthn); TOTP less protected |
| **Cloned TOTP secret** | Detectable via backup codes replay (minor) |
| **Counter regression (cloned authenticator)** | WebAuthn counter check |
| **Replay of recorded codes** | Anti-replay via used-code cache |
| **Social engineering MFA reset** | Admin approval + email notifications |
| **Keylogger captures TOTP** | Still need secret; attacker needs live access |
| **Malware on device** | Platform-level concern; passkeys in Secure Enclave help |

---

## 11. Library Recommendations

| Need | Library | Why |
|------|---------|-----|
| TOTP | `otplib` (Node.js) or custom | Well-tested; RFC 6238 compliant |
| WebAuthn server | `@simplewebauthn/server` | Maintained, SimpleWebAuthn has helpers |
| WebAuthn client | `@simplewebauthn/browser` | Matches server lib |
| QR codes | `qrcode` (Node.js) or client-side | Client-side better for privacy |
| Argon2 | `argon2` (Node.js native) | Native bindings, fast |
| CSPRNG | `crypto.randomBytes` (Node.js) | Built-in, secure |

---

## 12. Implementation Checklist

- [ ] TOTP enrollment + verification
- [ ] WebAuthn passkey enrollment + authentication
- [ ] Backup codes generation + verification (Argon2 hashed)
- [ ] MFA enforcement policy (tenant-configurable)
- [ ] MFA removal flow (with step-up re-auth)
- [ ] Tenant admin MFA reset for users
- [ ] Superadmin MFA reset for tenant admins (audited)
- [ ] Grace period enforcement for new users
- [ ] Email notifications for MFA events
- [ ] Trusted device support (optional, opt-in)
- [ ] Metrics + alerting for bypass attempts
- [ ] UI for managing MFA methods (list, add, remove, nickname)
- [ ] Dark mode support
- [ ] Mobile browser compatibility (iOS Safari, Android Chrome)
