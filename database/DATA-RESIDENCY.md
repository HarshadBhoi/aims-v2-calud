# AIMS v2 — Data Residency & Compliance Strategy

> Multi-region deployment with tenant-controlled data residency to meet GDPR, data sovereignty, FedRAMP, and government regulations.
>
> This doc covers the *database-layer* residency concerns — tenant-to-region binding, per-region Postgres/S3 deployment, cross-region DR within same compliance tier, `Tenant.dataRegion` enum, and on-premises considerations. For the full **regional deployment silo architecture** (separate EKS clusters, independent auth services, DNS routing, no global control plane), see [ADR-0006](../references/adr/0006-regional-deployment-silos.md) and [security/DATA-RESIDENCY.md](../security/DATA-RESIDENCY.md).
>
> The launch sequence per ADR-0006 is narrower than the full region list here: **us-east-2** at launch, **eu-central-1** when the first EU tenant signs, **govcloud-us-west** when the federal pipeline justifies. Additional regions in the table below are aspirational — they come online when tenant demand justifies standing up the full silo.

---

## 1. Data Residency Requirements by Region

| Region | Driver | Strictness |
|--------|--------|------------|
| **EU** | GDPR Article 44 (data transfers), Schrems II | Strict — data must remain in EU |
| **UK** | UK GDPR, post-Brexit DPA | Strict — similar to EU |
| **India** | DPDP Act 2023 | Strict for sensitive personal data |
| **Canada** | PIPEDA, provincial laws (Quebec Law 25) | Strict |
| **Australia** | Privacy Act 1988 | Moderate |
| **US Federal** | FedRAMP, FISMA | Strict — US-only for federal agencies |
| **US State/Local** | Various state laws | Variable |
| **On-Premises** | Government security clearance, legal hold | Total — customer-managed |

---

## 2. Region Deployment Model

### Infrastructure per Region

```
┌────────────────────────────────────────────┐
│   Region: us-east-1 (AWS example)          │
│                                            │
│  ┌──────────────┐   ┌──────────────┐      │
│  │ API instance │──▶│ Postgres 16  │      │
│  │ (Node.js)    │   │ Primary      │      │
│  └──────┬───────┘   └──────┬───────┘      │
│         │                   │              │
│         │ S3 bucket (region-local)         │
│         ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐      │
│  │ S3 (us-east) │   │ Read Replica │      │
│  └──────────────┘   └──────────────┘      │
│                                            │
└────────────────────────────────────────────┘
         │
         │ Cross-region logical replication
         │ ONLY for DR (disaster recovery)
         │ To same-compliance-tier region
         ▼
┌────────────────────────────────────────────┐
│   Region: us-west-2 (DR)                   │
│   ...                                      │
└────────────────────────────────────────────┘
```

### Region List (Aligned with Tenant.dataRegion Enum)

| Region Code | Location | Primary For |
|-------------|----------|-------------|
| `US_EAST` | AWS us-east-1 | US commercial, default |
| `US_WEST` | AWS us-west-2 | US DR for US_EAST |
| `EU_CENTRAL` | AWS eu-central-1 (Frankfurt) | EU commercial + German government |
| `EU_WEST` | AWS eu-west-1 (Ireland) | EU DR, EU-West commercial |
| `UK` | AWS eu-west-2 (London) | UK commercial + government |
| `INDIA` | AWS ap-south-1 (Mumbai) | India (DPDP Act compliance) |
| `ASIA_PACIFIC` | AWS ap-southeast-2 (Sydney) | Australia + APAC |
| `CANADA` | AWS ca-central-1 (Montreal) | Canada |
| `AUSTRALIA` | AWS ap-southeast-2 | Same as APAC |
| `ON_PREMISES` | Customer data center | Government / high-security clients |

---

## 3. Tenant Assignment to Region

### At Signup
```typescript
interface TenantSignupInput {
  name: string;
  legalName: string;
  // Data region MUST be chosen at signup; cannot be changed easily
  dataRegion: DataRegion;
  // Reason for the region (audited)
  dataRegionReason?: string;
}
```

### Region-Specific Infrastructure Routing
- **DNS**: `app.aims.com` routes based on user's tenant region
  - `eu.app.aims.com` → EU infrastructure
  - `us.app.aims.com` → US infrastructure
  - `in.app.aims.com` → India infrastructure
- **Authentication**: User session tokens include region claim; cross-region requests denied

### Tenant Data Cannot Cross Regions
- Enforced at infrastructure level (separate databases, separate S3 buckets)
- DR is within same compliance tier (e.g., US_EAST primary → US_WEST DR, both US-based)

---

## 4. GDPR Compliance Specifics

### Article 15 — Right of Access
```sql
-- Provide user's data export
SELECT row_to_json(u) FROM users u WHERE id = ?;
SELECT row_to_json(e) FROM engagements e WHERE created_by_id = ?;
-- ... etc.
```

### Article 17 — Right to Erasure ("Right to be Forgotten")

Challenge: Audit data retention typically required for 7+ years by law (SOX, GAGAS). Cannot fully erase.

**Approach**: Anonymization rather than deletion.

```sql
CREATE OR REPLACE FUNCTION public.fn_anonymize_user(p_user_id TEXT)
RETURNS VOID AS $$
DECLARE
  anon_hash TEXT;
BEGIN
  anon_hash := 'anonymized-' || encode(sha256(p_user_id::BYTEA), 'hex');

  -- Replace PII but retain structural data for audit trail
  UPDATE public.users SET
    email = anon_hash || '@anonymized.local',
    name = 'Anonymized User',
    display_name = NULL,
    phone = NULL,
    avatar_url = NULL,
    title = NULL,
    department = NULL,
    password_hash = NULL,
    mfa_secret = NULL,
    deleted_at = CURRENT_TIMESTAMP,
    status = 'DELETED'
  WHERE id = p_user_id;

  -- Audit log entries reference user via email; snapshot is preserved
  -- But we update user_email to anonymized form in recent logs
  UPDATE audit.audit_log SET user_email = anon_hash || '@anonymized.local'
  WHERE user_id = p_user_id AND logged_at > CURRENT_TIMESTAMP - INTERVAL '90 days';

  -- Log the anonymization itself
  INSERT INTO audit.audit_log (
    id, tenant_id, action, entity_type, entity_id, logged_at
  ) VALUES (
    encode(gen_random_bytes(16), 'hex'),
    NULL,
    'SOFT_DELETE',
    'user',
    p_user_id,
    CURRENT_TIMESTAMP
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Article 20 — Data Portability
Provide data export in machine-readable format (JSON) via API endpoint `/api/users/me/export`.

### Article 28 — Data Processing Agreements
Required between AIMS (processor) and customer (controller). Template DPA should cover:
- Subject matter and duration of processing
- Nature and purpose of processing
- Types of personal data + categories of data subjects
- Controller's obligations
- Sub-processor policy (AWS, Stripe, etc. — documented)
- Security measures (TLS, encryption, access controls, logging)
- Assistance obligations
- Breach notification (72 hours)
- Audit rights

### Article 30 — Records of Processing Activities (RoPA)
Maintain internal RoPA documenting:
- Categories of data subjects (auditors, auditees, etc.)
- Categories of personal data (name, email, IP, audit actions)
- Purposes of processing (audit management, compliance)
- Recipients (cloud providers, sub-processors)
- Data retention periods
- Security measures

### Article 32 — Security of Processing
- TLS 1.3 in transit
- AES-256 encryption at rest (PostgreSQL TDE, S3 SSE)
- Access logging (audit_log captures every access)
- MFA for users
- Regular penetration testing
- Incident response plan

### Article 33/34 — Breach Notification
- Detection via Sentry error monitoring + database anomaly detection
- 72-hour notification to supervisory authority
- Notification to affected users if high risk

---

## 5. FedRAMP Readiness

For U.S. federal government tenants. Requirements are extensive; key DB-level requirements:

### FedRAMP High / Moderate Baseline
| Control | Implementation |
|---------|----------------|
| AC-2 Account Management | User lifecycle, automated deprovisioning |
| AC-3 Access Enforcement | RLS + RBAC |
| AC-6 Least Privilege | aims_app role, scoped permissions |
| AU-2 Event Logging | audit_log captures all events |
| AU-3 Content of Audit Records | user, action, entity, timestamp, IP |
| AU-6 Audit Review, Analysis | Audit log tools + SIEM integration |
| AU-9 Protection of Audit Info | Append-only, hash chain, RBAC |
| CP-9 System Backup | Daily backup + WAL archiving |
| IA-2 Identification and Authentication | MFA, password policy |
| SC-8 Transmission Confidentiality | TLS 1.3 |
| SC-13 Cryptographic Protection | AES-256 at rest (RDS KMS), Application-Layer Encryption (AES-GCM, per-tenant DEKs via KMS) per ADR-0001 |
| SC-28 Protection at Rest | PostgreSQL TDE |

### FedRAMP Authorization Process
1. **FedRAMP Ready** designation (self-attestation)
2. **Sponsorship** by a federal agency
3. **3PAO assessment** (Third-Party Assessment Organization)
4. **JAB authorization** or **Agency ATO** (Authority to Operate)
5. **Continuous monitoring** (monthly vulnerability scans, annual assessment)

Timeline: 12-24 months for FedRAMP High.

### StateRAMP for US State Government
Similar to FedRAMP but state-level. Required for many state audit agencies.

---

## 6. India DPDP Act 2023 Compliance

Digital Personal Data Protection Act (India).

### Key Requirements
- **Data Fiduciary** obligations (AIMS as processor)
- **Significant Data Fiduciary** additional obligations if above thresholds
- **Data Protection Officer** (DPO) appointment for SDFs
- **Consent manager** integration
- **Cross-border transfer** restrictions (localization requirements)
- **Breach notification** to Data Protection Board

### Implementation
- India-hosted infrastructure (ap-south-1)
- Data Protection Officer (DPO) contact on tenant admin page
- Consent management UI for data subject requests
- Audit log with "consent provided" metadata

---

## 7. Data Retention by Regulation

Implemented via `tenants.retention_years` and automated archival jobs.

| Regulation | Retention | Notes |
|------------|-----------|-------|
| **SOX §802** | 7 years | Audit workpapers minimum |
| **GAGAS** | 3-7 years | Varies by state; 7 years recommended |
| **Uniform Guidance** | 3 years from report | Federal awards |
| **HIPAA** | 6 years | From creation or last effective date |
| **GDPR** | "No longer than necessary" | Subject to specified purpose |
| **IRS** | 3-7 years | Depending on document type |
| **State audit laws** | Variable | Typically 5-7 years |

### Retention Enforcement
```sql
-- Configured per tenant
ALTER TABLE public.tenants
  ADD CONSTRAINT chk_retention_minimum_sox
  CHECK (retention_years >= 7);  -- For SOX-compliant tenants

-- Files tagged with retention class
-- files.retention_class determines archive/delete timing
```

### Archival Pipeline
1. Records with `deleted_at > retention_years` are **archived to cold storage** (S3 Glacier, Azure Archive, etc.)
2. Primary records **hard-deleted** after archival
3. **Audit log always retains deletion event** (for accountability)

### Legal Holds
- `files.retention_class = 'LEGAL_HOLD'` bypasses archival
- Applied manually by admins
- Removed only with documented authorization

---

## 8. Encryption Strategy

### At Rest
- **Database**: AWS RDS / Azure Postgres with TDE (Transparent Data Encryption) using AES-256
- **S3**: Server-Side Encryption (SSE-KMS) with customer-managed keys
- **Backups**: Encrypted with same keys

### In Transit
- TLS 1.3 (minimum TLS 1.2) for all connections
- Database connections via SSL/TLS (verify-full mode)
- API calls TLS only (HSTS enforced)

### Field-Level Encryption — Application-Layer Encryption (ALE)

Sensitive PII is encrypted in the **application service** before Prisma ever sees the plaintext — Postgres only ever stores ciphertext. See [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md) for the full decision.

- Helper module: `packages/encryption/` (shared across Fastify request path and NestJS worker tier)
- Per-tenant Data Encryption Key (DEK) wrapped by AWS KMS (envelope encryption)
- Randomized encryption (AES-GCM) for non-queryable fields; deterministic encryption for equality-queryable fields; blind indexes (HMAC-with-per-tenant-secret) for search-without-reversibility
- Rotation runbook: see [security/ROTATION.md](../security/ROTATION.md)

`pgcrypto` is intentionally **not** used. It requires symmetric keys in Postgres memory space, which leaks via query logs, `pg_stat_statements`, memory dumps, and replication streams.

### Key Management
- **AWS KMS** for managing Customer-Managed Keys (CMKs) per tenant
- Per-tenant CMK wraps a Data Encryption Key (DEK) that the application unwraps in-process
- **Automated DEK rotation** per [security/ROTATION.md](../security/ROTATION.md)
- Keys **never enter Postgres memory** — the DEK is unwrapped inside the API service, encryption/decryption happens in-process, ciphertext goes to the DB

---

## 9. On-Premises Deployment

Required for:
- Government agencies with strict data residency
- Financial institutions with regulatory requirements
- Customers who cannot use public cloud

### Packaging
- **Docker Compose** for small deployments
- **Kubernetes Helm chart** for production
- **Air-gapped deployment** supported (no internet)

### Components
```yaml
services:
  aims-api:
    image: aims/api:v2.0
  aims-web:
    image: aims/web:v2.0
  postgres:
    image: postgres:16
    # Customer-managed storage
  redis:
    image: redis:7
  minio:
    image: minio/minio
    # S3-compatible local storage
```

### License Management
- On-premises uses **license files** signed with AIMS private key
- Verified daily by API
- No callbacks / telemetry (except opt-in)

---

## 10. Cross-Border Transfer Restrictions

### Prohibited Transfers
- EU tenant data → US (without SCCs or equivalent)
- India tenant data → Outside India (without explicit consent + DPDP compliance)
- US Federal → Non-US (without FedRAMP authorization)

### Allowed Transfers
- **DR replication**: Same compliance tier only (e.g., EU primary → EU DR)
- **User access**: Users can access their tenant from anywhere (data stays in region)
- **Support**: Platform operators access via region-specific bastion hosts

### Enforcement
- Infrastructure: Separate clusters per region
- Network: VPC isolation; no cross-region DB peering for tenant data
- Application: Region claim in auth token; requests routed to correct region

---

## 11. Audit Trail for Compliance

Every data access, modification, and export is logged:

| Event | Table | Retention |
|-------|-------|-----------|
| User login | `audit.audit_log` (action=LOGIN) | 7 years |
| Failed login | `audit.audit_log` (action=LOGIN_FAILED) | 7 years |
| Data access | Optional: `audit.data_access_log` | Per regulation |
| Data export | `audit.audit_log` (action=DATA_EXPORTED) | 7 years |
| Permission change | `audit.audit_log` (action=ROLE_CHANGED) | 7 years |
| Encryption key rotation | `audit.audit_log` (action=ENCRYPTION_KEY_ROTATED) | Permanent |

### Compliance Reporting
- **Quarterly**: Access review reports (who accessed what)
- **Annually**: Complete audit trail export for regulators
- **On-demand**: For incident response or DPA audits

---

## 12. Sub-Processor Management

Per GDPR Article 28, all sub-processors must be disclosed and customer-approved.

### Core Sub-Processors

| Sub-Processor | Purpose | Location |
|---------------|---------|----------|
| AWS / Azure / GCP | Infrastructure | Per tenant region |
| Stripe | Billing | US (Stripe-managed SCCs) |
| Resend / SendGrid | Transactional email | Multi-region |
| Sentry | Error monitoring | EU or US |
| Cloudflare | DDoS, CDN | Global |
| Auth0 / Better Auth | Authentication | Per region |

### Customer Notification
- New sub-processors notified 30 days in advance
- Customers can object with right to terminate
- Sub-processor list maintained at `aims.com/trust/subprocessors`

---

## 13. Incident Response

### Breach Response Playbook
1. **Detect** — Anomaly detection, error spike, user report
2. **Contain** — Disable affected accounts, rotate keys, isolate compromised systems
3. **Assess** — Scope of breach, data affected, users impacted
4. **Notify** —
   - Internal: Security team, legal, executives (within 1 hour)
   - Regulators: Per jurisdiction (GDPR: 72 hours)
   - Customers: Per contract (typically 24-72 hours)
   - Users: If high risk, direct notification
5. **Remediate** — Patch vulnerabilities, restore data if needed
6. **Post-mortem** — Document, learn, improve

### Breach Notification Timelines
| Jurisdiction | Timeline |
|--------------|----------|
| GDPR (EU) | 72 hours to supervisory authority |
| CCPA (California) | "Without unreasonable delay" |
| HIPAA | 60 days to affected individuals; HHS |
| SEC (for listed customers) | Disclosed per Form 8-K rules |
| State laws | 30-90 days typically |

---

## 14. Compliance Certifications Roadmap

Target certifications (post-MVP):

| Year | Certification | Effort |
|------|---------------|--------|
| Year 1 | SOC 2 Type I | 6 months |
| Year 2 | SOC 2 Type II, ISO 27001 | 9-12 months each |
| Year 2 | GDPR DPA templates | Ongoing |
| Year 3 | HIPAA BAA ready | 6 months |
| Year 3 | FedRAMP Moderate Ready | 12-18 months |
| Year 4 | FedRAMP Moderate Authorized | 12-24 months |

---

## Summary

AIMS v2 is designed with **data residency, privacy, and compliance baked into the architecture**:

1. ✅ Multi-region infrastructure (EU, US, UK, India, Canada, Australia)
2. ✅ Tenant-controlled data region at signup (immutable thereafter)
3. ✅ Cross-border data transfers prevented by infrastructure isolation
4. ✅ Field-level encryption for sensitive PII
5. ✅ 7-year retention with automated archival
6. ✅ Tamper-evident audit trail (hash chain)
7. ✅ Anonymization for GDPR right-to-erasure
8. ✅ On-premises option for highest-security tenants
9. ✅ Sub-processor transparency
10. ✅ Breach detection + rapid notification procedures
