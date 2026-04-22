# AIMS v2 Database — State-of-the-Art Design

> PostgreSQL 16+ with Prisma 5, designed for multi-tenant SaaS + on-premises deployment, multi-standard audit compliance, and long-term data integrity.

---

## Architecture Principles

### 1. Multi-Tenancy via Two-Layer Tenant Isolation

Tenant isolation is enforced in **two layers**: a Prisma Client Extension (application-layer, *primary*) injects `tenantId` into every WHERE clause, and RLS policies (database-layer, *defence-in-depth*) double-check the injection. Both must pass; a failure in either is a bug; both existing is the belt-and-suspenders. See [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md) for the full decision record.

- **Primary enforcement (app-layer)**: Prisma Client Extension at `packages/prisma-client/` reads `tenantId` from the authenticated tRPC context and injects `WHERE tenantId = $1` into every query. Unit-testable without spinning up Postgres.
- **Defence-in-depth (DB-layer)**: each transaction issues `SET LOCAL app.current_tenant = $1`; RLS policies on every tenant-scoped table verify via `current_setting('app.current_tenant')`. Catches raw-SQL paths, ORM regressions, and future developer mistakes.
- **Connection-pool discipline is load-bearing** — naïve session-scoped `SET` leaks across pooled connections. See [POOLING.md](POOLING.md) for the rulebook (transaction-scoped `SET LOCAL` only; GUC reset on checkout; transaction wrapper verification).
- Superadmin bypass requires an elevated database role (not the default `aims_app`), and every cross-tenant query under that role is logged to the audit trail.

RLS-as-sole-isolation was an earlier plan and is explicitly rejected — see [ADR-0002](../references/adr/0002-tenant-isolation-two-layer.md) Option A for why.

### 2. Versioned Standard Packs (Immutable Once Published)
Standard Packs are stored with version tracking. Once a pack is `status = EFFECTIVE` or `TRANSITIONING`, its content cannot be modified — only superseded by a new version.

- `standard_packs` table with `code + version` primary key
- `pack_content` stored as JSONB (the full StandardPack from data-model)
- `check_pack_immutable()` trigger prevents UPDATE on published packs

### 3. Immutable Audit Records
Once a finding/report is **ISSUED**, it cannot be modified. Required by GAGAS, SOX, ISO for evidence integrity.

- Status-based check constraints: `CHECK (status != 'ISSUED' OR locked_at IS NOT NULL)`
- Post-issuance changes require new "amendment" record, not UPDATE
- Trigger `prevent_issued_update()` raises exception if row with `locked_at NOT NULL` is modified

### 4. Bitemporal Data for Findings
Findings have two time dimensions:
- **Valid time**: When the finding was true in the real world (fieldwork period)
- **Transaction time**: When the finding was recorded in the system

This allows "what did this finding look like on March 15?" queries — critical for legal/regulatory audit.

### 5. Event Sourcing for Workflows
Workflow state is derived from an append-only `workflow_events` table. Current state is a materialized view. This gives:
- Full history replay
- Point-in-time state reconstruction
- Tamper-evident workflow trail

### 6. Hash-Chained Audit Log
Every mutation is logged with a `previous_hash` + current row hash. If any log row is tampered with, the chain breaks and can be detected. Uses SHA-256.

### 7. Field-Level Encryption via Application-Layer Encryption (ALE)

PII and sensitive fields are encrypted at the **application layer** using AWS KMS-wrapped per-tenant Data Encryption Keys — Postgres only ever sees ciphertext. See [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md) for the full decision record.

- **Helper module**: `packages/encryption/` — shared across the Fastify request path and the NestJS worker tier. Every encrypted field runs through this module; no raw KMS calls in feature code.
- **Encryption modes**:
  - *Randomized encryption* (AES-GCM per-tenant DEK) for fields never queried by value — narratives, notes, whistleblower identities.
  - *Deterministic encryption* (per-tenant keys) for fields requiring equality search — email lookups, SSN matching.
  - *Blind indexes* (HMAC-with-per-tenant-secret stored alongside ciphertext) for search-without-reversibility patterns.
- **Key hierarchy**: AWS KMS CMK (one per tenant) wraps a Data Encryption Key (DEK); API service unwraps DEK in-process and caches for the request lifetime (5-min TTL for long-running workers).
- **Rotation**: DEK rotation per [security/ROTATION.md](../security/ROTATION.md). KMS CMK rotation is a metadata operation (rewrap DEK), not a data operation, for the common case.

`pgcrypto` is **not** used for queryable or PII fields. It requires symmetric keys in Postgres memory space, which leaks via query logs, `pg_stat_statements`, memory dumps, and replication streams. See [ADR-0001 §Alternatives](../references/adr/0001-ale-replaces-pgcrypto.md) for the full rejection rationale.

### 8. Time-Based Partitioning
Large append-heavy tables partitioned by month:
- `audit_log` (partition by `logged_at` monthly)
- `workflow_events` (partition by `event_time` monthly)
- `file_access_log` (partition by `accessed_at` monthly)

Drop old partitions after retention period (7 years for audit-critical).

### 9. Generated Columns for Search
`tsvector` generated columns for full-text search without application code. PostgreSQL handles the indexing automatically.

### 10. Materialized Views for Analytics
Dashboard queries hit pre-computed materialized views refreshed nightly (or on-demand). Prevents expensive aggregations on live transactional tables.

### 11. Optimistic Concurrency Control
Every mutable record has a `version INTEGER` column incremented on update. Clients must send the expected version; mismatch = 409 Conflict.

### 12. Soft Delete with Archival
`deleted_at TIMESTAMPTZ` on most tables. After retention period, archived to cold storage (S3) and hard-deleted from primary. Audit log always retains the deletion event.

### 13. Idempotency Keys
Mutation endpoints accept `idempotency_key` header. Stored in `idempotency_keys` table with 24h TTL. Repeated requests return original response.

### 14. Database Roles & Principle of Least Privilege
- `aims_app` — application user (RLS-restricted, no DDL, no superadmin)
- `aims_migration` — schema changes only (CI/CD)
- `aims_readonly` — reporting/BI access (no writes, RLS applied)
- `aims_superadmin` — platform operators (RLS bypass for support operations)

### 15. Logical Replication for DR
Primary region replicates to disaster-recovery region via logical replication. Read replicas in same region for reporting workloads.

---

## File Structure

```
database/
├── README.md                      ← You are here
├── ERD.md                         ← Entity relationship diagram
├── PERFORMANCE.md                 ← Indexing, partitioning, caching strategy
├── POOLING.md                     ← Connection-pool discipline (ADR-0002)
├── DATA-RESIDENCY.md              ← DB-level residency notes (see security/DATA-RESIDENCY.md for the silo architecture)
├── schema.prisma                  ← Prisma schema (primary definition)
├── migrations/
│   └── 20260501000000_initial/
│       └── migration.sql          ← Generated by `prisma migrate`
├── policies/
│   ├── rls-policies.sql           ← Row-Level Security policies (defence-in-depth; see ADR-0002)
│   └── roles.sql                  ← Database roles and grants
├── functions/
│   ├── tenant-context.sql         ← Tenant context functions
│   ├── audit-log-triggers.sql     ← Audit trail + hash chain
│   ├── immutability-checks.sql    ← Post-issuance lock
│   ├── generated-columns.sql      ← tsvector for search
│   └── partition-management.sql   ← Automatic partition creation
└── views/
    └── materialized-views.sql     ← Dashboard/report views
```

Note: the Prisma Client Extension that injects `tenantId` into every WHERE clause (primary tenant-isolation layer per ADR-0002) lives in `packages/prisma-client/`, not in this folder. The encryption helper module (ALE via KMS per ADR-0001) lives in `packages/encryption/`. Both are shared between the Fastify request path and the NestJS worker tier.

---

## PostgreSQL Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram for fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- Combined btree+GIN indexes
CREATE EXTENSION IF NOT EXISTS "pg_cron";       -- Scheduled jobs (refresh views, archive)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance
```

`pgcrypto` is intentionally *not* in this list. Field-level encryption happens at the application layer via `packages/encryption/` (per [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md)) to keep symmetric keys out of Postgres memory space.

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Table names | `snake_case`, plural | `engagements`, `finding_elements` |
| Column names | `snake_case` | `created_at`, `tenant_id` |
| Primary keys | `id` (CUID2) | `id TEXT PRIMARY KEY` |
| Foreign keys | `{table_singular}_id` | `engagement_id`, `user_id` |
| Timestamps | `..._at` (timestamptz) | `created_at`, `deleted_at`, `locked_at` |
| Booleans | `is_...` or `has_...` | `is_active`, `has_findings` |
| Enum types | `snake_case_enum` | `engagement_status_enum` |
| Indexes | `idx_{table}_{cols}` | `idx_engagements_tenant_status` |
| Constraints | `chk_{table}_{rule}` | `chk_engagements_date_order` |
| Triggers | `trg_{table}_{action}` | `trg_findings_audit_log` |
| Functions | `fn_{purpose}` | `fn_get_current_tenant_id` |

---

## Key Technology Choices

| Choice | What | Why |
|--------|------|-----|
| **PostgreSQL 16+** | Core database | ACID, JSONB, RLS, partitioning, full-text search, mature |
| **Prisma 5** | ORM + migrations | Type-safe, good DX, handles migrations well |
| **CUID2** | Primary keys | Collision-resistant, URL-safe, sortable, non-sequential (privacy) |
| **TIMESTAMPTZ** | All timestamps | Always UTC storage, client-timezone aware |
| **JSONB** | Standard pack configs, custom fields | Schema flexibility, PostgreSQL-native query |
| **Native Enums** | Status, role, action fields | Type-safe, disk-efficient |
| **AWS KMS + ALE** | Field-level encryption | Per-tenant DEKs via envelope encryption; keys never in Postgres memory (ADR-0001) |
| **pg_cron** | Scheduled jobs | Partition management, view refresh, archival |

---

## Why NOT Alternatives

### Why NOT MySQL/MariaDB?
- No native RLS (requires app-layer enforcement)
- JSON support less mature than JSONB
- Row-level locks less granular
- Fewer index types (no partial indexes, no GIN for JSON)

### Why NOT DynamoDB/NoSQL?
- Audit data is highly relational (engagements → findings → recommendations → CAPs)
- Complex queries across standards need SQL
- Strong consistency required (audit integrity)
- On-prem deployment option needed (government clients)

### Why NOT Microsoft SQL Server?
- Licensing cost significant for SaaS
- Less popular in modern cloud-native architectures
- Weaker JSON support than PostgreSQL JSONB
- Vendor lock-in concerns

### Why NOT MongoDB?
- Audit records are fundamentally tabular and relational
- Joins are natural in this domain
- Transaction support weaker than PostgreSQL
- Schema flexibility we need is met by PostgreSQL JSONB

---

## Compliance Considerations Baked In

| Requirement | Approach |
|-------------|----------|
| **SOX §802** 7-year retention | Partitioned audit tables; `retention_class` column |
| **HIPAA** encryption at rest | RDS storage encryption (AWS KMS) for at-rest; Application-Layer Encryption (ALE) via `packages/encryption/` for field-level PHI (see ADR-0001) |
| **GDPR Article 17** right to erasure | `anonymize_user()` function; audit log retains hash only |
| **CSRD** data integrity | Hash chain audit log; immutable issued findings |
| **21 CFR Part 11** e-signatures | `signed_hash` column on finding/report approval records |
| **Data residency (EU/US/IN)** | Tenant `data_region` column; infra deployed per region |
| **FedRAMP** (future) | NIST 800-53 controls mapped to DB config |

---

## State-of-the-Art Features Summary

1. Two-layer tenant isolation (Prisma Client Extension primary + RLS defence-in-depth, per ADR-0002)
2. Bitemporal data model for findings
3. Event sourcing for workflows
4. Hash-chained audit log (tamper evidence)
5. Immutability enforcement for issued records
6. Field-level encryption via Application-Layer Encryption (ALE) with per-tenant KMS-wrapped DEKs (ADR-0001)
7. Time-based table partitioning
8. Generated tsvector columns for search
9. Materialized views for analytics
10. Optimistic concurrency (version columns)
11. Soft delete + archival lifecycle
12. Idempotency keys for safe retries
13. Logical replication for DR
14. Least-privilege database roles
15. Automated partition management via pg_cron
