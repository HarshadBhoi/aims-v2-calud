# AIMS v2 — Performance Strategy

> State-of-the-art PostgreSQL performance practices for a multi-tenant audit platform.

---

## 1. Indexing Strategy

### Principle: Index for Query Patterns, Not Tables

Every index costs write performance. Only create indexes that serve known query patterns.

### Core Indexes (Already in Prisma Schema)

| Table | Index | Query Pattern |
|-------|-------|---------------|
| `engagements` | `(tenant_id, status)` | "List active engagements for tenant" |
| `engagements` | `(tenant_id, engagement_type)` | "Filter by type" |
| `engagements` | `(tenant_id, primary_pack_code, primary_pack_version)` | "Engagements using GAGAS 2024" |
| `engagements` | `(tenant_id, created_at)` | "Recent engagements sorted" |
| `findings` | `(tenant_id, engagement_id, status)` | "Findings in this engagement" |
| `findings` | `(tenant_id, classification)` | "Material weaknesses across tenant" |
| `findings` | `(tenant_id, risk_rating)` | "High-risk findings" |
| `findings` | `(tenant_id, created_at)` | "Recent findings" |
| `corrective_actions` | `(tenant_id, status, due_date)` | "Overdue CAPs" |
| `approvals` | `(tenant_id, assigned_to_id, status)` | "My pending approvals" |
| `approvals` | `(tenant_id, status, sla_due_at)` | "Approvals approaching SLA breach" |
| `notifications` | `(tenant_id, user_id, is_read)` | "My unread notifications" |
| `time_entries` | `(tenant_id, user_id, entry_date)` | "My time this week" |

### Additional Indexes to Add (Post-Prisma)

Some indexes can't be expressed in Prisma — add via raw SQL migrations:

```sql
-- Partial indexes (only index non-deleted records)
CREATE INDEX idx_engagements_active ON public.engagements (tenant_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_findings_open ON public.findings (tenant_id, status)
  WHERE status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED') AND deleted_at IS NULL;

-- GIN indexes for JSONB search
CREATE INDEX idx_findings_element_values ON public.findings USING GIN (element_values);

CREATE INDEX idx_findings_custom_fields ON public.findings USING GIN (custom_fields);

CREATE INDEX idx_tenants_settings ON public.tenants USING GIN (settings);

CREATE INDEX idx_tenants_features ON public.tenants USING GIN (features);

-- Trigram indexes for fuzzy search
CREATE INDEX idx_engagements_title_trgm ON public.engagements USING GIN (title gin_trgm_ops);

CREATE INDEX idx_findings_title_trgm ON public.findings USING GIN (title gin_trgm_ops);

-- Covering indexes (include frequently-accessed columns)
CREATE INDEX idx_engagements_list_covering ON public.engagements
  (tenant_id, status, created_at DESC)
  INCLUDE (engagement_number, title, engagement_type, primary_pack_code);

-- Composite index for CAP overdue dashboard
CREATE INDEX idx_corrective_actions_overdue ON public.corrective_actions
  (tenant_id, due_date)
  WHERE status IN ('NOT_STARTED', 'IN_PROGRESS') AND deleted_at IS NULL;
```

### Full-Text Search via Generated tsvector Columns

```sql
-- Add generated tsvector column to findings
ALTER TABLE public.findings
  ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(element_values->>'CRITERIA', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(element_values->>'CONDITION', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(element_values->>'CAUSE', '')), 'C') ||
    setweight(to_tsvector('english', coalesce(element_values->>'EFFECT', '')), 'C')
  ) STORED;

CREATE INDEX idx_findings_search ON public.findings USING GIN (search_vector);

-- Query:
-- SELECT * FROM findings
-- WHERE search_vector @@ websearch_to_tsquery('english', 'segregation of duties')
-- ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', 'segregation of duties')) DESC;
```

Apply similarly to: `engagements`, `recommendations`, `reports`, `workpapers`.

---

## 2. Table Partitioning

### audit_log — Monthly Partitions

The `audit_log` table will grow to hundreds of millions of rows. Partition by month for:
- **Query performance**: Most queries are recent-data, which targets one small partition
- **Maintenance**: Drop old partitions cheaply (vs DELETE of millions of rows)
- **Archival**: Export entire partition to cold storage before dropping

```sql
-- Parent table (from Prisma but adjusted)
CREATE TABLE audit.audit_log (
  id TEXT,
  tenant_id TEXT,
  action audit.AuditLogAction NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  user_id TEXT,
  user_email TEXT,
  session_id TEXT,
  impersonated_by TEXT,
  ip_address INET,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  changes_summary TEXT,
  previous_hash TEXT,
  content_hash TEXT NOT NULL,
  chain_position BIGSERIAL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, logged_at)
) PARTITION BY RANGE (logged_at);

-- Pre-create partitions for current + next 12 months
-- (Automated via fn_create_monthly_partitions)
```

### workflow_events — Monthly Partitions
Same strategy as audit_log.

### time_entries — Quarterly Partitions (Optional)
Time entries grow fast. For very large tenants, partition by quarter (`entry_date`).

### Key Considerations
- **Partition pruning**: PostgreSQL automatically skips irrelevant partitions IF the query filters on the partition key
- **Foreign keys**: Cannot reference partitioned tables directly; use composite FK on (id, logged_at)
- **Unique constraints**: Must include the partition key

---

## 3. Connection Pooling

### pgBouncer Configuration

For production, use **pgBouncer** in session or transaction mode:

```ini
[databases]
aims_prod = host=pg.internal dbname=aims port=5432 auth_user=pgbouncer_auth

[pgbouncer]
listen_port = 6432
pool_mode = transaction        # Transaction-mode for best concurrency
max_client_conn = 10000        # Clients
default_pool_size = 20         # Server connections per (user, database)
reserve_pool_size = 5
server_idle_timeout = 600
query_timeout = 60
server_lifetime = 3600
```

**Why transaction mode?** Prisma doesn't use session features like `LISTEN/NOTIFY` or advisory locks that require session mode. Transaction mode allows 1 server connection to serve many clients.

**Caveat**: Transaction mode is incompatible with session-scoped `SET` statements. We use `SET LOCAL` inside transactions for tenant context — this works.

### Prisma Connection String

```
DATABASE_URL="postgresql://aims_app:password@pgbouncer.internal:6432/aims_prod?pgbouncer=true&connection_limit=20"
```

The `pgbouncer=true` flag tells Prisma to disable prepared statements (required for transaction-mode pooling).

---

## 4. Materialized Views for Analytics

Dashboards and reports hit **materialized views**, not live tables. Refresh nightly (or on-demand for critical views).

### Example: `mv_engagement_summary`

```sql
CREATE MATERIALIZED VIEW public.mv_engagement_summary AS
SELECT
  tenant_id,
  status,
  engagement_type,
  primary_pack_code,
  COUNT(*) AS engagement_count,
  SUM(CASE WHEN actual_start_date IS NOT NULL THEN 1 ELSE 0 END) AS started_count,
  AVG(EXTRACT(EPOCH FROM (actual_end_date - actual_start_date)) / 86400) AS avg_duration_days,
  SUM(budgeted_hours) AS total_budgeted_hours,
  SUM(actual_hours) AS total_actual_hours
FROM public.engagements
WHERE deleted_at IS NULL
GROUP BY tenant_id, status, engagement_type, primary_pack_code;

CREATE UNIQUE INDEX ON public.mv_engagement_summary (tenant_id, status, engagement_type, primary_pack_code);
CREATE INDEX ON public.mv_engagement_summary (tenant_id);

-- Refresh schedule (via pg_cron)
SELECT cron.schedule('mv-engagement-summary', '15 2 * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_engagement_summary; $$);
```

### Other Key Materialized Views

```sql
-- Finding trends (by month, risk, type)
CREATE MATERIALIZED VIEW public.mv_finding_trends AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS month,
  classification_scheme,
  classification,
  risk_rating,
  COUNT(*) AS finding_count,
  SUM(questioned_costs_known) AS total_questioned_costs
FROM public.findings
WHERE deleted_at IS NULL
GROUP BY tenant_id, DATE_TRUNC('month', created_at), classification_scheme, classification, risk_rating;

-- CAP aging pipeline
CREATE MATERIALIZED VIEW public.mv_cap_aging AS
SELECT
  tenant_id,
  status,
  CASE
    WHEN due_date IS NULL THEN 'No Due Date'
    WHEN due_date > CURRENT_DATE THEN 'On Track'
    WHEN due_date > CURRENT_DATE - INTERVAL '30 days' THEN '0-30 Days Overdue'
    WHEN due_date > CURRENT_DATE - INTERVAL '60 days' THEN '31-60 Days Overdue'
    WHEN due_date > CURRENT_DATE - INTERVAL '90 days' THEN '61-90 Days Overdue'
    ELSE '90+ Days Overdue'
  END AS aging_bucket,
  COUNT(*) AS cap_count
FROM public.corrective_actions
WHERE deleted_at IS NULL
GROUP BY tenant_id, status, aging_bucket;

-- Team utilization
CREATE MATERIALIZED VIEW public.mv_team_utilization AS
SELECT
  t.tenant_id,
  t.user_id,
  DATE_TRUNC('month', t.entry_date) AS month,
  t.category,
  SUM(t.hours) AS total_hours,
  COUNT(DISTINCT t.engagement_id) AS engagement_count
FROM public.time_entries t
WHERE t.deleted_at IS NULL AND t.status = 'APPROVED'
GROUP BY t.tenant_id, t.user_id, DATE_TRUNC('month', t.entry_date), t.category;
```

### Refresh Strategy
- **Concurrent refresh**: `REFRESH MATERIALIZED VIEW CONCURRENTLY` — no table lock, but requires unique index
- **Incremental materialization** (PostgreSQL 18+): Evaluate `pg_ivm` extension for incremental view maintenance
- **Triggered refresh**: For finding-level views, refresh on finding approval events

---

## 5. Query Optimization Patterns

### Use EXPLAIN ANALYZE
Every feature that introduces a new query pattern should have its plan verified:
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ... FROM findings WHERE ...;
```

### Common Pitfalls to Avoid

**1. N+1 Queries from Prisma**
Always use `include` or `select` to join related data in a single query:
```typescript
// BAD — N+1
const engagements = await prisma.engagement.findMany({ where: { tenantId } });
for (const e of engagements) {
  const findings = await prisma.finding.findMany({ where: { engagementId: e.id } });
}

// GOOD — single query with JOIN
const engagements = await prisma.engagement.findMany({
  where: { tenantId },
  include: { findings: true },
});
```

**2. Missing Composite Indexes**
If you query `WHERE tenant_id = ? AND status = ?`, the index must be `(tenant_id, status)`, NOT two separate indexes.

**3. JSONB Without GIN Index**
Queries like `WHERE element_values @> '{"CRITERIA": "..."}'` require a GIN index to avoid sequential scan.

**4. ORDER BY on Non-Indexed Column**
If you sort by `updated_at`, ensure there's an index. Otherwise sorting large result sets is slow.

### Leverage PostgreSQL-Native Features

**CTEs for complex logic:**
```sql
WITH recent_findings AS (
  SELECT * FROM findings
  WHERE tenant_id = $1
    AND created_at > CURRENT_DATE - INTERVAL '30 days'
),
findings_by_risk AS (
  SELECT risk_rating, COUNT(*) FROM recent_findings GROUP BY risk_rating
)
SELECT * FROM findings_by_risk;
```

**Window functions for pagination:**
```sql
SELECT *, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_num
FROM findings
WHERE tenant_id = $1
LIMIT 50 OFFSET 0;
```

Better: use cursor-based pagination for large datasets:
```sql
SELECT * FROM findings
WHERE tenant_id = $1 AND created_at < $last_seen_created_at
ORDER BY created_at DESC
LIMIT 50;
```

---

## 6. Caching Strategy

### Redis Caching Layers

| Data | TTL | Invalidation |
|------|-----|--------------|
| User session | 30 min | On logout; on role change |
| Tenant settings | 5 min | On settings update |
| Standard Pack content | 1 hour | On pack version change |
| Permission lookups | 5 min | On role change |
| Dashboard data | Materialized view TTL | On refresh |
| Engagement list (per user) | 2 min | On engagement mutation |

### Cache Keys
```
tenant:{tenantId}:settings
tenant:{tenantId}:user:{userId}:permissions
pack:{code}:{version}
engagement:{engagementId}  (all data)
```

### Cache Invalidation
Application-level invalidation on mutations. Use **Redis pub/sub** for cross-instance invalidation.

---

## 7. Read Replicas

### Strategy
- **Write queries**: Primary only
- **Read queries**: Read replica (with eventual consistency)
- **Reporting/analytics**: Dedicated read replica with longer replication lag tolerance

### Prisma Configuration
```typescript
const prisma = new PrismaClient({
  datasources: { db: { url: PRIMARY_DB_URL } }
});

const prismaReadonly = new PrismaClient({
  datasources: { db: { url: READ_REPLICA_URL } }
});

// Route based on operation
function getPrismaClient(operation: 'read' | 'write') {
  return operation === 'read' ? prismaReadonly : prisma;
}
```

### Caveats
- Read replicas have **replication lag** (usually < 1 second; can be seconds under load)
- After writes, subsequent reads within the same user session should go to primary (read-your-writes consistency)
- Use primary for:
  - Transactional reads (part of a write transaction)
  - Post-mutation confirmation queries
  - Authentication flows

---

## 8. Query Timeouts & Circuit Breakers

### Statement Timeouts (per Role)
Already configured in `policies/roles.sql`:
- `aims_app`: 30 seconds
- `aims_readonly`: 5 minutes
- `aims_migration`: 30 minutes

### Application-Level Timeouts
```typescript
// Prisma query timeout
await prisma.$queryRaw`SET LOCAL statement_timeout = '5s'`;
const result = await prisma.finding.findMany({ ... });
```

### Circuit Breakers
Use a circuit breaker library (e.g., `opossum` for Node.js) to fail fast when DB is unresponsive:
- 3 failures in 10s → open circuit → fail immediately for 30s → half-open test

---

## 9. Bulk Operations

### Batch Inserts with `COPY`
For data migrations or bulk imports, use PostgreSQL `COPY` (10-100x faster than individual inserts):
```typescript
await prisma.$executeRawUnsafe(`
  COPY public.findings (id, tenant_id, engagement_id, ...)
  FROM STDIN WITH (FORMAT CSV)
`);
```

### Batch Updates
```sql
UPDATE public.corrective_actions SET status = 'OVERDUE'
WHERE tenant_id = $1
  AND status IN ('NOT_STARTED', 'IN_PROGRESS')
  AND due_date < CURRENT_DATE;
```

Batch via CTEs for complex updates:
```sql
WITH overdue_caps AS (
  SELECT id FROM corrective_actions
  WHERE tenant_id = $1 AND ...
  FOR UPDATE SKIP LOCKED
  LIMIT 1000
)
UPDATE corrective_actions SET overdue_at = CURRENT_TIMESTAMP
FROM overdue_caps
WHERE corrective_actions.id = overdue_caps.id;
```

---

## 10. Monitoring

### Key Metrics to Track

| Metric | Tool | Threshold |
|--------|------|-----------|
| Slow queries (> 1s) | pg_stat_statements | Alert if new pattern |
| Connection pool saturation | pgBouncer stats | Alert > 80% |
| Replication lag | `pg_stat_replication` | Alert > 5s |
| Index bloat | `pgstattuple` | Alert > 30% |
| Cache hit ratio | `pg_stat_database` | Alert < 99% |
| Transaction duration | `pg_stat_activity` | Alert > 1 min (long txn) |
| Locks waiting | `pg_locks` | Alert if > 10s |
| Disk usage per table | `pg_total_relation_size` | Alert > 80% quota |

### pg_stat_statements
```sql
SELECT
  queryid,
  calls,
  total_exec_time / 1000 AS total_sec,
  mean_exec_time AS mean_ms,
  rows,
  100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_ratio
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Grafana Dashboards
- PostgreSQL exporter: scrape `pg_stat_*` views
- pgBouncer exporter: pool saturation, client connections
- Query performance: slow query log → Loki → Grafana

---

## 11. Performance SLOs

Target service level objectives:

| Operation | p50 | p99 | Max |
|-----------|-----|-----|-----|
| Login | 200ms | 500ms | 2s |
| Load engagement detail | 300ms | 1s | 3s |
| List engagements (50) | 200ms | 800ms | 2s |
| Create finding | 500ms | 1.5s | 3s |
| Run report (simple) | 1s | 5s | 10s |
| Generate PDF (complex) | 5s | 30s | 60s |
| Global search | 500ms | 2s | 5s |
| Dashboard load | 1s | 3s | 5s |

Performance tests (via k6) should verify these SLOs under realistic load (e.g., 1000 concurrent users per tenant).

---

## 12. Scaling Strategy

### Vertical Scaling (First)
- Start with Postgres 16 on managed service (AWS RDS, Azure Postgres, Google Cloud SQL)
- 16 vCPU / 64 GB RAM for small-medium tenants
- Scale up as needed — vertical is simpler than horizontal

### Horizontal Scaling (Later)
- **Read replicas** for read-heavy workloads (reports, dashboards)
- **Logical partitioning**: Consider database-per-tenant for enterprise tier
- **Citus extension**: Distributed Postgres for very large tenants
- **Sharding** (last resort): Split by `tenant_id` hash if single DB becomes bottleneck

### When to Shard
- Write throughput > 10k writes/sec
- Data size > 10TB
- Multi-region requirements (data residency)

Most SaaS audit platforms don't need sharding until tens of thousands of tenants.

---

## 13. Vacuum & Autovacuum Tuning

For audit-heavy workloads:
```sql
-- Tune autovacuum to be more aggressive for high-churn tables
ALTER TABLE public.audit_log SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.time_entries SET (
  autovacuum_vacuum_scale_factor = 0.05
);

ALTER TABLE public.notifications SET (
  autovacuum_vacuum_scale_factor = 0.1
);
```

Monitor `pg_stat_user_tables` for vacuum lag.

---

## 14. Backup & PITR

- **Daily full backup** via pg_basebackup or managed service snapshots
- **Continuous WAL archiving** for point-in-time recovery (PITR)
- **Cross-region backup replication** for DR
- **Tested restore procedures** monthly
- **Backup encryption** at rest

For managed services (RDS, Azure), these are typically built-in. Verify RPO (Recovery Point Objective) meets SLA — for audit data, typically < 5 minutes.

---

## Summary of Performance Wins

| Technique | Impact |
|-----------|--------|
| Proper composite indexes | 10-100x query speedup |
| Partitioning audit_log | 10-100x on historical queries; cheap archival |
| Materialized views | 100-1000x on dashboards |
| GIN on JSONB | Enable efficient JSONB search |
| Full-text tsvector | Proper search vs LIKE '%...%' |
| Read replicas | Offload 70-90% of query load |
| pgBouncer | 10-50x effective connection limit |
| Query timeouts | Prevent cascading failures |
| Prisma `include` | Eliminate N+1 queries |
| Cursor pagination | Scale to millions of rows |
