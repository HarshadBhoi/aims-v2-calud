# Secrets & Encryption

> Every secret has a lifecycle: create → distribute → rotate → revoke. AWS KMS + Secrets Manager + external-secrets operator. Zero plaintext in Git. Automated rotation where possible.

---

## 1. Guiding Principles

1. **No secrets in Git. Ever.** Enforced by gitleaks pre-commit + CI + pre-receive hook. Breach → immediate revocation runbook.
2. **No long-lived credentials.** Everything is either short-lived (STS tokens) or rotatable (DB passwords, API keys).
3. **Least-privilege access.** Each secret scoped to a specific IAM role; not "all secrets read".
4. **Rotation by default.** Automated where service supports it; scheduled runbook where it doesn't.
5. **Full audit trail.** Every secret access logged; unusual patterns alerted.
6. **Envelope encryption.** Customer data encrypted with per-tenant data key, data key encrypted with KMS CMK.
7. **Break-glass exists and is audited.** Worst case has a procedure; procedure is logged and reviewed.

---

## 2. Secret Taxonomy

| Class | Examples | Storage | Rotation |
|-------|----------|---------|----------|
| **AWS infrastructure** | DB password, Redis AUTH, S3 access keys | Secrets Manager w/ rotation Lambda | Automatic every 30d |
| **3rd-party API keys** | Stripe, SendGrid, OpenAI, Snyk | Secrets Manager | Manual + calendar; quarterly |
| **Signing keys** | JWT (EdDSA), webhook HMAC, cosign | Secrets Manager (key) + KMS (operations) | Yearly with overlap |
| **Tenant encryption keys** | Per-tenant data key (envelope-wrapped) | KMS CMK + DB (wrapped) | Annual unless compromise |
| **TLS certificates** | *.aims.io, tenant custom domains | ACM (auto) + cert-manager (Let's Encrypt) | Automatic (ACM); 60d (LE) |
| **Session / refresh tokens** | User JWT, refresh tokens | Redis (session), DB (refresh) | Short-lived; rotated on use |
| **OIDC / SAML signing keys** | For tenant SSO | Secrets Manager | Rotated yearly, coordinated w/ IdP |
| **Database connection strings** | postgres://... | Secrets Manager (structured secret) | Together with DB password |
| **Human credentials** | Engineer SSO, prod JIT | IAM Identity Center | SSO-managed; JIT tokens < 1h |
| **Break-glass** | Root recovery, DR master key | Offline (hardware) + two-person seal | Annually tested |

---

## 3. AWS KMS Customer Master Keys (CMKs)

### Key Catalog

| Alias | Purpose | Multi-region? | Rotation |
|-------|---------|---------------|----------|
| `aims-rds-{env}` | RDS volume encryption | Yes (prod) | Annual (KMS auto) |
| `aims-s3-{env}` | S3 SSE-KMS | Yes (prod) | Annual |
| `aims-ebs-{env}` | EBS volumes (k8s PVs, nodes) | Yes (prod) | Annual |
| `aims-secrets-{env}` | Secrets Manager encryption | Yes (prod) | Annual |
| `aims-tf-state` | Terraform state bucket | Yes | Annual |
| `aims-audit-log-{env}` | Audit log table + S3 mirror | Yes | Annual + generational (new key yearly, old kept for decrypt) |
| `aims-tenant-{tenantId}` | Per-tenant envelope (Phase 2) | Yes | Tenant-controlled |
| `aims-jwt-signing-{env}` | JWT EdDSA keys | Yes | Yearly with 90d overlap |

### Key Policies (principle of least privilege)
Each CMK policy scoped to the specific service that needs it:

```jsonc
// aims-rds-prod CMK policy (abbreviated)
{
  "Statement": [
    // Allow administrators to manage
    { "Effect": "Allow", "Principal": { "AWS": "arn:aws:iam::...:role/KmsAdmin" },
      "Action": "kms:*", "Resource": "*" },
    // Allow RDS service
    { "Effect": "Allow", "Principal": { "Service": "rds.amazonaws.com" },
      "Action": ["kms:Encrypt","kms:Decrypt","kms:ReEncrypt*","kms:GenerateDataKey*","kms:DescribeKey"],
      "Resource": "*" },
    // Allow app role to decrypt data from RDS exports if needed
    { "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::...:role/aims-api-prod" },
      "Action": ["kms:Decrypt","kms:DescribeKey"], "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "rds.us-east-1.amazonaws.com" } }
    }
  ]
}
```

### CMK Operations
- **Automatic rotation ON** (KMS generates new backing key yearly; old keys retained for decrypt)
- **Multi-region keys** for replicated resources (cross-region S3, RDS cross-region read replicas)
- **Key deletion** only via 30-day pending window (never immediate)
- **Key usage monitored**: CloudTrail events for unusual `Decrypt` patterns → Security team alert

---

## 4. AWS Secrets Manager

### Secret Naming
```
/aims/{env}/{service}/{name}
```

Examples:
- `/aims/production/api/db-credentials` (structured: host, port, user, pass, dbname)
- `/aims/production/api/stripe-api-key`
- `/aims/production/api/sendgrid-api-key`
- `/aims/production/worker/openai-api-key`
- `/aims/production/platform/jwt-signing-key-current` + `/aims/production/platform/jwt-signing-key-previous`

### Secret Versioning
- Secrets Manager retains last N versions automatically
- `AWSCURRENT` and `AWSPREVIOUS` labels
- For rotation: new version created as `AWSPENDING` → tested → flipped to `AWSCURRENT`

### Automated Rotation (RDS Example)
1. Lambda rotation function (AWS-provided template) runs on schedule
2. Step 1 `createSecret`: generate new password, store as `AWSPENDING`
3. Step 2 `setSecret`: `ALTER ROLE app_user WITH PASSWORD 'new_pw'`
4. Step 3 `testSecret`: open test connection with new password
5. Step 4 `finishSecret`: flip `AWSPENDING` → `AWSCURRENT`
6. Apps re-read secret at next refresh interval (30 min via external-secrets)

### Access Pattern
Apps **never call Secrets Manager API directly**. `external-secrets` operator:

```yaml
# k8s manifest: api's secret materialized from SM
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata: { name: api-secrets, namespace: aims }
spec:
  refreshInterval: 30m
  secretStoreRef: { name: aws-secrets, kind: ClusterSecretStore }
  target: { name: api-secrets, creationPolicy: Owner }
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: /aims/production/api/db-credentials
        property: connection_string
    - secretKey: STRIPE_API_KEY
      remoteRef:
        key: /aims/production/api/stripe-api-key
    - secretKey: SENDGRID_API_KEY
      remoteRef:
        key: /aims/production/api/sendgrid-api-key
```

`external-secrets` auth via IRSA — no credentials on the cluster side.

### Parameter Store (SecureString) — Alternative
Used for:
- Non-secret config that should be versioned + auditable (feature flag defaults, rate limits)
- Cheaper than Secrets Manager ($0 vs $0.40/secret/month)
- No built-in rotation (use only for things that don't rotate)

Examples:
- `/aims/{env}/platform/rate-limits` (JSON)
- `/aims/{env}/platform/allowed-cors-origins`
- `/aims/{env}/platform/feature-flags/default-state` (falls back; LaunchDarkly overrides at runtime)

---

## 5. Secret Loading Order (in app)

```
1. Baked-in defaults            (dev-safe, never prod values)
     ↓ overridden by
2. ConfigMap env vars           (non-secret config from Git)
     ↓ overridden by
3. Secret env vars               (from external-secrets / Secrets Manager)
     ↓ refreshed by
4. Runtime feature flag client   (OpenFeature; for dynamic flags)
```

### Startup Check
Before accepting traffic, the app validates all secrets exist + decrypts successfully. Any missing = startup failure (readinessProbe fails, pod cycles).

```ts
// At bootstrap
const env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SIGNING_KEY: z.string().min(32),
  SENDGRID_API_KEY: z.string(),
  // ...
}).parse(process.env);
```

---

## 6. Key Rotation Runbooks

### JWT Signing Key Rotation
Our tokens use EdDSA. Rotation needs overlap (active tokens must stay valid during rollover).

**Procedure** (runbook: `rotate-jwt-key.md`):
1. Generate new key pair offline (ceremony via HSM or KMS)
2. Store private key in Secrets Manager: `/aims/prod/platform/jwt-signing-key-next`
3. Store public key in JWKS endpoint (`/.well-known/jwks.json`) as additional key — tokens signed by *either* pass verification
4. Deploy app with this state. Wait 24h (JWKS clients cache up to 12h).
5. Flip roles: `next` → `current`, `current` → `previous`. Redeploy. All *new* tokens signed by new key.
6. Wait for max session lifetime (7 days for refresh tokens).
7. Remove `previous` key from JWKS and Secrets Manager.

Total elapsed: ~10 days. Runs yearly and on suspected compromise.

### Database Password Rotation
Automated by Secrets Manager Lambda (see §4). Zero-downtime because:
- PostgreSQL accepts both old and new password during transition (app reads new, reconnects)
- Connection pooler (PgBouncer or RDS Proxy) softens the reconnect

### Third-Party API Key Rotation
Manual, quarterly, tracked in a calendar:
1. Generate new key in vendor dashboard
2. Store in Secrets Manager new version as `AWSPENDING`
3. Test via canary pod
4. Flip to `AWSCURRENT`
5. Revoke old key in vendor dashboard
6. Post confirmation in `#security`

### Certificate Rotation
- ACM: 100% automatic (AWS-managed)
- cert-manager Let's Encrypt: 100% automatic at ~60-day mark
- Tenant-uploaded certs: reminded 30 days before expiry via email + in-app notice

### Compromise Response
If a secret is suspected compromised (accidental commit, disclosed in log, employee departure, etc.):
1. **Revoke** the secret immediately (rotate now, don't schedule)
2. **Audit**: CloudTrail for access since suspected exposure; look for unauthorized use
3. **Investigate**: scope of exposure — was it used? What did it access?
4. **Notify**: Security team; customers if their data touched
5. **Postmortem** with root cause
6. **Patch** the process that leaked

---

## 7. Envelope Encryption (Per-Tenant, Phase 2)

### Model
Customer data at rest in DB is encrypted with a **per-tenant data key**. The tenant data key is itself encrypted (wrapped) by a KMS CMK. This is envelope encryption.

```
Plaintext data   ─► AES-256-GCM ─► Ciphertext stored in DB
                       ▲
                 data key (DEK)
                       ▲
                  generated per-tenant, then wrapped:
                       ▼
               KMS CMK `aims-tenant-{tenantId}` encrypts DEK
                       ▼
           Encrypted DEK stored in `tenant.wrapped_key` column
```

### Why
- **Tenant key revocation**: If a tenant offboards + wants data destroyed, we delete their CMK → all their DEKs become unrecoverable → cryptographic erasure
- **Customer-managed keys (CMK-BYOK)**: Enterprise tenants can bring their own KMS CMK (AWS cross-account or CloudHSM) — we never hold their key
- **Regulatory compliance**: Demonstrates tenant-level isolation at crypto boundary

### Performance
- DEK cached in pod memory per tenant (decrypt once, cache for request lifetime)
- No DEK round-trip per row; just per tenant per session
- KMS throttling a concern at scale → use KMS Multi-Region keys + increase RPS quota

### Fields Encrypted
Not everything — only sensitive user data:
- Rich-text finding content
- User-uploaded attachment metadata (filenames, descriptions)
- Free-text comments
- Custom tenant-specific fields flagged sensitive

Index-required fields (IDs, enums) remain plaintext for query performance.

---

## 8. Secrets In CI/CD

### GitHub Actions Secrets (repo level)
Strictly limited to:
- `AWS_ACCOUNT_ID` (not secret but convenient)
- `CODECOV_TOKEN`, `SENTRY_AUTH_TOKEN`, `SNYK_TOKEN`
- `SLACK_WEBHOOK_DEPLOY`
- `TURBO_TOKEN`

### No AWS Access Keys in CI
OIDC → STS → short-lived token (15 min lifespan). Role trust policy restricts to specific repo + branch/tag.

### No Prod Secrets in CI
CI deploys but doesn't run prod. Prod pods fetch secrets themselves via IRSA + external-secrets. CI never sees a prod password.

### Secret Detection (every commit)
- **gitleaks** pre-commit hook (husky) — catches most secrets locally
- **gitleaks** in CI — catches what slipped past local
- **GitHub Secret Scanning** (platform-level) — catches after push; partners auto-revoke known key formats
- **TruffleHog / dogfood scanner** scheduled monthly — deep history scan

---

## 9. Secrets In Logs

See `OBSERVABILITY.md §4` — Pino redact rules. Additionally:
- otel-collector `attributes` processor drops any key matching `*password*`, `*secret*`, `*key*`, `*token*`
- Regex processor drops obvious patterns (credit card, SSN, JWT)
- Audit: quarterly sampling of production logs by Security team → any leak → incident

---

## 10. Secrets In Errors (Sentry)

- `beforeSend` hook in Sentry SDK strips:
  - Request body fields matching sensitive keys
  - Headers: `Authorization`, `Cookie`, `X-Api-Key`
  - Environment variables
  - Query params: `token=`, `api_key=`
- Stack traces kept (useful); surrounding context scrubbed

---

## 11. Break-Glass

### Scenarios
- AWS root account compromise (org-level security)
- SSO IdP down — no one can log in to apps/AWS
- KMS CMK accidentally scheduled for deletion
- Critical prod issue, normal approval chain unavailable

### Break-Glass Keys
Root passwords + MFA devices stored **offline** in:
- Physical safe (primary office)
- Separate physical safe (secondary office, different city)
- Encrypted file on offline hardware (1Password Business escrow)

### Break-Glass Procedure
1. Two-person rule: `BreakGlass-Initiate` + `BreakGlass-Approve` from different people
2. Reason logged in Slack incident channel (even if system is down — log after)
3. Use → audit every action
4. Post-break-glass: mandatory Security review within 24h
5. Rotate all broken-glass secrets immediately after use
6. Postmortem within 5 business days

---

## 12. Tenant SSO Integration — SAML / OIDC Certificates

Each tenant-provided IdP uses signed metadata + certificates:

### SAML IdP Certificates
- Tenant uploads IdP signing cert during SSO setup
- We verify every SAML response signature
- Rotation: tenant notifies 30 days before cert expiry; we accept overlap (both old + new certs valid during window)
- Expiry alerts to tenant admin email 60, 30, 7 days before

### Our SP Signing Key
- Used to sign SAML authn requests to tenant's IdP
- Stored in Secrets Manager, rotated yearly with coordination (tenant updates our new cert in their IdP)

### OIDC Client Secrets
- Per-tenant OIDC client credentials in Secrets Manager (`/aims/prod/sso/tenant-{id}/oidc-secret`)
- Rotated yearly + on tenant request

---

## 13. Auditability

Every secret access logged:
- Secrets Manager API calls → CloudTrail → log archive (7y retention)
- KMS usage → CloudTrail
- JIT role assumptions → CloudTrail
- Anomaly detection: CloudWatch metrics alarm on high `Decrypt` rate per principal

Compliance evidence drawn from these logs for:
- SOC 2 CC6.1 (logical access)
- ISO 27001 A.9 (access control)
- FedRAMP AC-2, AC-3, AU-2

---

## 14. Secrets Manager Cost Control

Secrets Manager costs $0.40/secret/month + $0.05/10k API calls. At scale:
- Use Parameter Store SecureString for non-rotating config ($0 base; $0.05 per 10k "advanced parameter" calls)
- Cache aggressively in pod memory (avoid re-fetch)
- external-secrets refresh interval 30 min, not 30 seconds

---

## 15. Customer-Managed Encryption Keys (Phase 3, Enterprise Tier)

Enterprise customers can provide their own KMS CMK (via AWS cross-account grant). We:
- Never hold the key material
- Every data access requires a call to customer's CMK — performance impact
- Revoke grant → instant cryptographic lockout for their data (data still exists but unreadable)
- Additional compliance positioning (some gov customers require CMEK)

Mechanism: envelope encryption where the wrapping CMK is in the customer's AWS account, referenced via grant.

---

## 16. What We Don't Do

- **No secrets in environment variables of CI workflows** (use OIDC + runtime fetch)
- **No SSH keys as shared credentials** (SSM Session Manager only)
- **No "encrypt with the same CMK for everything"** — separate CMKs per data class
- **No disabled key rotation** on CMKs
- **No manual editing** of Secrets Manager secrets in prod (go through runbook + change process)
- **No client-side-only encryption** for customer data (server must participate to meet audit requirements)
- **No proprietary homegrown crypto** (use KMS, libsodium, node:crypto — never DIY)
- **No hardcoded salts/IVs** (generated fresh per operation)
- **No `Math.random()` for security** (always `crypto.randomBytes` / `crypto.randomUUID`)

---

## 17. Related Documents

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — KMS + Secrets Manager provisioning
- [`CONTAINERS.md`](CONTAINERS.md) — external-secrets operator, IRSA
- [`CI-CD.md`](CI-CD.md) — OIDC to AWS, gitleaks
- [`../auth/SECURITY.md`](../auth/SECURITY.md) — auth secrets detail (JWT signing, session)
- [`RUNBOOKS.md`](RUNBOOKS.md) — rotation procedures
