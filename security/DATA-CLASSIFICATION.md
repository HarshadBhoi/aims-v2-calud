# Data Classification + Handling

> Five classes of data. Handling rules per class. Where each class may live, how it's encrypted, who can access it, how long it's kept, and how it's disposed. The single most-referenced policy in day-to-day engineering.

---

## 1. Why Classify Data

Different data carries different risk. "Our login wallpaper color" and "an auditor's notes on findings for a Fortune 500 client" both live in the same repo if we don't distinguish. Classification tells us:

- Where the data may live (which environments, regions, storage classes)
- Who may access it (which roles, which vendors)
- How it must be protected (encryption, logging, audit)
- How long it is retained + how it is destroyed
- What regulatory regime applies
- What happens when there's a breach

Without classification, policies are generic; with classification, they're targeted.

---

## 2. The Five Classes

Ordered from least to most sensitive:

| Class | Short name | Examples |
|-------|-----------|----------|
| **Public** | `public` | Marketing content, published docs, press releases |
| **Internal** | `internal` | Internal engineering docs, design discussions, roadmap |
| **Confidential** | `confidential` | Customer engagement data, findings, reports, user-generated content |
| **Restricted** | `restricted` | Credentials, encryption keys, auth tokens, secrets |
| **Regulated** | `regulated` | PHI (HIPAA), PII subject to GDPR/CCPA, financial data subject to SOX/FINRA retention |

Data defaults to **Internal** unless explicitly classified higher. Never default to Public.

---

## 3. Class 1 — Public

### Definition
Data intentionally released to the public. Unauthorized disclosure is harmless (or the point).

### Examples
- Marketing website content, blog posts
- Release notes (customer-friendly)
- Public API documentation
- Open-source code we publish
- Press releases
- Public job listings
- Logos + brand assets

### Handling
- **Storage**: any approved location (GitHub public, S3 public bucket with CloudFront, Google Docs, Notion public share)
- **Encryption**: in transit (TLS); at rest not required for integrity, but often inherent
- **Access**: open
- **Retention**: indefinite
- **Destruction**: redirect / takedown when obsolete; no secure-erase required

### Controls
- Brand + messaging review before publication
- Legal review if contractual commitments made
- No customer data ever in Public by mistake

---

## 4. Class 2 — Internal

### Definition
Data meant for employees, contractors, and approved partners. Unauthorized external disclosure is embarrassing but not catastrophic.

### Examples
- Internal engineering docs, design decisions, ADRs (non-public)
- Product roadmap + internal planning
- Organizational charts
- Internal training material
- Runbooks + operational docs (not customer-specific)
- Team-level dashboards
- Internal meeting notes
- Most Slack messages + Jira tickets

### Handling
- **Storage**: company-issued systems (GitHub private repos, Notion workspace, Google Workspace, Slack workspace, AWS accounts we control)
- **Encryption**: TLS in transit; at rest on services that support it (most SaaS do by default)
- **Access**: employees + contractors with need-to-know; SSO-required
- **Retention**: per type (most 3–7 years; some indefinite)
- **Destruction**: standard deletion; no certificate needed
- **Sharing**: internal-only; external only with NDA + Legal review

### Controls
- SSO on all systems
- No public shares (Google Docs, Notion) — enforced via DLP where possible
- Employee laptops encrypted (FileVault / BitLocker)

---

## 5. Class 3 — Confidential

### Definition
Customer data and company-sensitive information. Disclosure damages customer trust, competitive position, or legal position. The class containing **most of what AIMS exists to hold**.

### Examples
- Customer engagement records, findings, recommendations
- Customer work papers, uploaded files
- Customer reports (draft + published)
- Customer user lists + team structures
- Financial projections (internal)
- Unpublished M&A, personnel changes, etc.
- Source code (proprietary)
- Pen test detailed findings
- Employee performance data
- Customer billing details

### Handling
- **Storage**:
  - Customer engagement data: only in production (prod DB, prod S3); sanitized subset in staging; never in dev
  - Source code: in GitHub private repos
  - Business confidential: Google Workspace, Notion, with access controls
- **Encryption**:
  - At rest: required everywhere (KMS-managed; see `devops/SECRETS.md §3`)
  - In transit: TLS 1.3
  - Field-level encryption for selected fields (Phase 2+; see `database/`)
- **Access**:
  - Application access: enforced by RLS + RBAC/ABAC (see `auth/PERMISSIONS.md`)
  - Infrastructure access to this data: Just-in-Time (JIT), 1-hour max, dual approval (see `devops/INFRASTRUCTURE.md §9`)
  - Audit: every access logged (AuditEvent table; see `database/`)
- **Retention**:
  - Customer data: per contract + tenant settings (default 7 years; configurable)
  - Company confidential: 7 years typical (financial records), varies
- **Destruction**:
  - Tenant offboarding: 30-day soft delete → cryptographic erasure (destroy per-tenant KMS key)
  - Certification of destruction available on customer request
- **Sharing externally**:
  - With customer (their own data): via the product, auth-gated
  - With partners / vendors: contract-required; DPA in place; subprocessor notice to customers

### Controls
- Multi-tenant isolation via Postgres RLS (primary boundary)
- Per-tenant KMS keys (Phase 2)
- Separate IAM roles for prod DB access (break-glass)
- 100% audit logging of customer data access
- Regular access reviews (quarterly)
- Masked logs (no raw Confidential in logs)
- DLP on outbound email (block attachments with customer data classification tags — Phase 3)

---

## 6. Class 4 — Restricted

### Definition
Data whose disclosure would compromise systems, accounts, or other security boundaries. Access to Restricted data is rare and privileged.

### Examples
- Database passwords
- API keys (ours + customers' stored by us)
- JWT / refresh token signing keys
- KMS keys themselves (as opposed to data encrypted by them)
- TLS private certificates
- Root AWS credentials
- MFA seed secrets (server-side if stored)
- Code signing keys
- WebAuthn credentials (if stored server-side)
- Incident response forensic artifacts
- Backup encryption keys

### Handling
- **Storage**:
  - AWS Secrets Manager / Parameter Store SecureString (runtime)
  - KMS CMK (keys encrypting keys)
  - Break-glass: offline in a physical safe (root credentials, disaster-recovery keys)
  - **Never** in code, logs, tickets, email, chat
- **Encryption**:
  - At rest: always KMS-encrypted
  - In transit: TLS 1.3 mutual where applicable
  - Envelope encryption for highest-sensitivity (data key wrapped by CMK)
- **Access**:
  - Runtime: pods via IRSA + external-secrets (see `devops/SECRETS.md §5`)
  - Human: extremely limited; CISO + key engineer; all accesses CloudTrailed + alerted
- **Retention**:
  - As long as in use; rotate per `devops/SECRETS.md §6` schedule
  - Previous versions kept for decryption window (90 days for JWT; 30 days for DB password via Secrets Manager)
- **Destruction**:
  - Key: schedule KMS deletion with 30-day pending window
  - Secret: Secrets Manager "schedule for deletion" (minimum 7 days)
- **Sharing**:
  - Never via any channel. Shared only through the secret-management system itself.

### Controls
- No plaintext anywhere in repo (gitleaks)
- Detection: gitleaks pre-commit + CI; GitHub partner scanning; monthly deep scan
- Rotation: automated where supported; manual with calendar reminders elsewhere
- Access audit: CloudTrail; weekly review of unusual patterns
- Break-glass: two-person rule
- Compromise response: automatic revocation + re-issue per runbook

---

## 7. Class 5 — Regulated

### Definition
Data subject to specific regulatory regimes that impose obligations beyond general Confidential handling.

### Sub-classes

| Sub-class | Regime | Triggered when |
|-----------|--------|----------------|
| **PII (EU/UK)** | GDPR, UK GDPR | EU/UK natural person identifiable |
| **PII (US states)** | CCPA/CPRA, VA CDPA, CO CPA, CT CTDPA, UT CPA, and growing | Resident of applicable state |
| **PHI** | HIPAA | Personally identifiable health information |
| **Cardholder data** | PCI DSS | Payment card numbers (we don't handle — payment processor does) |
| **Financial records subject to retention** | SOX, FINRA 17a-4 | Customer is SEC-registered / broker-dealer |
| **CJI (Criminal Justice Information)** | CJIS | Law enforcement customers (unlikely scope for AIMS) |
| **CUI** | NIST 800-171 / CMMC | US federal contractor customers (FedRAMP Phase 6) |

### Handling — General
- **Storage**:
  - Per regulatory requirements (e.g., GDPR: EU region for EU-resident PII; HIPAA: BAA with all subprocessors; SOX: 7-year immutable retention)
  - Tagged with sub-class in DB for policy enforcement
- **Encryption**:
  - All Confidential-level controls
  - PLUS additional for some (HIPAA: PHI field-level encryption recommended; CJI: separate enclave)
- **Access**:
  - Minimum necessary (HIPAA); purpose-bound (GDPR)
  - Separate audit trail required for PHI
  - Regional restrictions (GDPR Art. 44 — no transfers to non-adequate jurisdictions without SCC/BCR)
- **Retention**:
  - Per regulation (HIPAA: 6 years; GDPR: as short as possible; SOX: 7 years immutable)
  - Deletion rights per regulation (GDPR Art. 17)
- **Destruction**:
  - Documented destruction certificates
  - Cryptographic erasure acceptable if keys destroyed
- **Sharing**:
  - Subprocessor agreements required (Art. 28 GDPR; BAA for HIPAA)
  - Customer-facing: published subprocessor list with notification on change

### Handling — Specifics per sub-class
See:
- [`PRIVACY.md`](PRIVACY.md) for GDPR, CCPA, CPRA, other US state laws
- [`HIPAA.md`](HIPAA.md) for PHI
- [`../database/DATA-RESIDENCY.md`](../database/DATA-RESIDENCY.md) for data residency / sovereignty mechanics

### Controls
All Confidential-class controls, plus:
- Data residency enforcement (region-locked tenants)
- Data Subject Request (DSR) handling within statutory timeframes
- DPA + BAA signed with every subprocessor
- Legal review before any subprocessor addition
- Breach notification readiness (72h GDPR; state-varying US)
- Specific audit log retention (6 years for HIPAA)
- Regulatory change monitoring

---

## 8. Classification Table — Where Can It Live?

| Class → | Public | Internal | Confidential | Restricted | Regulated |
|---------|:------:|:--------:|:------------:|:----------:|:---------:|
| **Production** (customer envs) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Staging** (synthetic + sanitized) | ✅ | ✅ | ✅ (sanitized) | Test-only creds | ❌ |
| **Dev** (fixtures only) | ✅ | ✅ | Fixtures only | Dev creds | ❌ |
| **Preview** (PR envs) | ✅ | ✅ | Fixtures only | Dev creds | ❌ |
| **Local** (engineer laptop) | ✅ | ✅ | Never | Personal dev | ❌ |
| **CI runners** | ✅ | ✅ | ❌ (read via OIDC) | ❌ | ❌ |
| **Notion / wiki** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Slack** | ✅ | ✅ (workspace) | ❌ (except incident channels, time-bound) | ❌ | ❌ |
| **Personal cloud drives** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Email attachments (outbound)** | ✅ | Review | ❌ | ❌ | ❌ |
| **Print** | ✅ | With judgment | ❌ | ❌ | ❌ |
| **Mobile devices (unmanaged)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Third-party SaaS (new)** | Review | Review | DPA + assessment required | Never | Explicit regulatory review |

---

## 9. Applying Classification — In Code + Docs

### In code
- Zod schemas and Prisma models can carry `@classification` JSDoc tag
- Pino logger has redaction rules per class (`devops/OBSERVABILITY.md §4`)
- Database columns containing regulated data flagged in migration metadata

### In docs
- Markdown frontmatter: `classification: confidential`
- Files classified Restricted / Regulated never in docs — these are code + runtime only
- Notion pages: "Restricted" label; auto-shares removed

### In infrastructure
- S3 bucket tag `Classification: Confidential|Restricted|Regulated`
- IAM policies reference tags (no cross-class bucket access)
- KMS key naming includes class (`aims-prod-confidential-*`, `aims-prod-regulated-phi-*`)

### In tickets / support
- Linear + support tools: classification label per ticket
- Customer-data tickets never contain PII in the description (IDs only)

---

## 10. Data Flow + Classification

Every new feature must trace the data flow + note highest class at each hop. Example:

```
User uploads work paper (PDF)
    Class: Confidential (might contain Regulated content — PHI if healthcare audit)
    │
    ▼
Next.js upload → presigned S3 URL
    In transit: TLS
    Storage: S3 with KMS-encrypted (aims-prod-attachments-cmk)
    │
    ▼
Metadata written to Postgres
    Row-level secured by tenantId
    │
    ▼
Worker scans for viruses (ClamAV)
    Reads: Confidential; no logging of content
    │
    ▼
User downloads via presigned URL
    Short-lived (1h); audit-logged
```

Architecture review flags any step where class isn't clearly handled.

---

## 11. Labeling Sensitive Fields in the Database

Selected fields marked in Prisma schema:
```prisma
model Finding {
  id             String   @id
  tenantId       String
  title          String
  elementValues  Json              /// @classification confidential
  createdBy      String
  createdAt      DateTime
  // ...
}

model UserProfile {
  id             String   @id
  email          String            /// @classification regulated-pii
  ssn            String?           /// @classification regulated-pii-sensitive @encrypted
  dob            DateTime?         /// @classification regulated-pii @encrypted
  // ...
}
```

Tooling parses these tags to:
- Generate redaction rules for logs
- Apply field-level encryption at ORM layer (Phase 2)
- Produce data-map for DPA / GDPR Art. 30 ROPA

---

## 12. Handling Rules Summary

### Transmission
| Class | In-transit encryption |
|-------|-----------------------|
| Public | TLS recommended |
| Internal | TLS required |
| Confidential | TLS 1.3 required; certificate pinning for critical paths |
| Restricted | TLS 1.3 + application-layer encryption for high-value (e.g., key material in payloads) |
| Regulated | TLS 1.3 + contractual / regulatory specifics (e.g., HIPAA) |

### At-rest encryption
| Class | Requirement |
|-------|-------------|
| Public | Optional |
| Internal | SaaS default acceptable |
| Confidential | KMS-managed (our CMK) |
| Restricted | KMS-managed + envelope + rotation |
| Regulated | KMS-managed + regulation-specific (e.g., BYOK for some enterprise) |

### Access logging
| Class | Requirement |
|-------|-------------|
| Public | No |
| Internal | Best-effort (SSO logs sufficient) |
| Confidential | Every access logged, retained ≥ 1 year |
| Restricted | Every access logged + alerted on anomaly; retained 7 years |
| Regulated | Access + purpose logged; retention per regulation (HIPAA: 6y; SOX: 7y) |

### Retention defaults
| Class | Default |
|-------|---------|
| Public | Indefinite |
| Internal | 7 years unless shorter justified |
| Confidential | Contract-specified; default 7 years |
| Restricted | Operational lifetime; keys rotated per schedule |
| Regulated | Per regulation; sometimes longer (SOX 7y minimum) |

### Disposal
| Class | Method |
|-------|--------|
| Public | Standard deletion |
| Internal | Standard deletion |
| Confidential | Soft-delete → hard-delete with backups-expire OR cryptographic erasure |
| Restricted | Crypto-erase + key destruction + audit log retained |
| Regulated | Per regulation (HIPAA: "render unreadable"; GDPR: "without undue delay") + certificate on request |

---

## 13. Data Subject Requests (DSR)

Full process in `PRIVACY.md`. Classification shows up in DSR:

- Customer asks: "What data do you have on me?" → query by classification tag + export
- Customer asks: "Delete me." → soft-delete → hard-delete after retention; issue certificate
- Regulator audits: "Show us the ROPA (records of processing activities)." → generated from classification + processing purpose metadata

Automation target: DSR responded to within regulatory window (GDPR: 30 days; CCPA: 45 days).

---

## 14. Training + Awareness

Data classification is covered in:
- Day-1 onboarding
- Annual refresher
- Role-specific training (engineers, support, sales)
- Incident reviews (classification errors are a common root cause)

Quiz questions (illustrative):
- "Customer emailed you a screenshot with their SSN visible. What class? What do you do?"
- "Colleague posted a customer ID in `#general`. What's the severity? How do you respond?"
- "You're debugging prod and need to see a finding's content. What's the process?"

---

## 15. Enforcement

### Automated
- Gitleaks (Restricted in repo)
- Pino redaction rules (Confidential / Regulated in logs)
- S3 bucket tagging + IAM (Class-based access)
- DLP on email (Phase 3+)
- Data discovery scans (Phase 3+): detects unclassified files in wrong places

### Manual
- Code review checklist includes classification check
- Architecture review requires data-flow diagram with classification
- Quarterly scan: sample Notion / Slack / Drive for unlabeled Confidential content

### Violations
- Accidental: coaching + fix; logged
- Pattern: additional training; manager conversation
- Willful: HR action per AUP

---

## 16. Cross-References

Every classification reference in other docs should use consistent terminology:

- Code JSDoc: `@classification confidential` (matches this doc)
- Markdown frontmatter: `classification: confidential` (matches)
- Auditor questions: match these class names (don't invent new ones)

Synchronization enforced via PR review.

---

## 17. Related Documents

- [`POLICIES.md`](POLICIES.md) — policy catalog
- [`PRIVACY.md`](PRIVACY.md) — Regulated sub-class detail (GDPR, CCPA)
- [`HIPAA.md`](HIPAA.md) — Regulated sub-class detail (PHI)
- [`../devops/SECRETS.md`](../devops/SECRETS.md) — Restricted class storage
- [`../devops/OBSERVABILITY.md`](../devops/OBSERVABILITY.md) — log redaction by class
- [`../database/DATA-RESIDENCY.md`](../database/DATA-RESIDENCY.md) — region enforcement for Regulated
- [`../database/`](../database/) — field-level encryption, RLS
- `implementation/policies/data-classification.md` — the policy document itself
