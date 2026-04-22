# AIMS v2 API Architecture

> Design decisions with rationale.

---

## Decision 1: tRPC + REST (Hybrid), Not GraphQL

### Options Considered
1. **GraphQL**: Popular, flexible
2. **tRPC only**: Max type safety for TS teams
3. **REST only**: Universal but requires OpenAPI sync
4. **Hybrid (tRPC + REST)**: Type-safe internal + documented external ← **CHOSEN**

### Why Hybrid
- **tRPC** gives the internal frontend perfect type safety at zero runtime cost. No DTOs, no serialization mismatch, no manual OpenAPI sync. Refactoring on the server propagates instantly to the frontend TypeScript.
- **REST** is non-negotiable for enterprise customers. They want Zapier, Power BI, custom scripts, and well-documented public APIs. GraphQL has worse tooling for these integrations.
- **GraphQL's main advantage** (flexible queries, reduce over-fetching) is less relevant when the frontend is 100% controlled by us. We know exactly what data each screen needs; we can expose that as tRPC procedures.

### Trade-off Accepted
- Two routers to maintain (tRPC internal + REST external)
- Mitigated by: both call the **same service layer**, so business logic is written once

---

## Decision 2: Service Layer Separation

### Pattern
```
tRPC router  ──▶┐
                ├──▶ Service layer ──▶ Prisma + Domain logic
REST router  ──▶┘
```

- Routers are **thin**: validate input → call service → return result
- Services encapsulate business rules, transaction management, event emission
- Services are testable without HTTP
- Services are reusable by CLI tools, background jobs, seed scripts

### Example
```typescript
// tRPC adapter (thin)
engagementRouter.create = authedProcedure
  .input(CreateEngagementSchema)
  .mutation(async ({ input, ctx }) => {
    return engagementService.create(ctx.tenantId, ctx.userId, input);
  });

// Service (fat, reusable)
export const engagementService = {
  async create(tenantId: string, userId: string, input: CreateEngagementInput) {
    // Validate business rules
    // Check permissions beyond RBAC
    // Start transaction
    // Create engagement, team members, first phase, initial audit log
    // Emit events (approval, notification, webhook)
    // Return created engagement
  },
};
```

---

## Decision 3: tRPC v11 with SuperJSON

### Why v11
- Streaming responses (for large result sets)
- Better client-side cache control
- Improved error handling
- Better subscription support (for SSE)

### Why SuperJSON
- JSON can't represent `Date`, `Decimal`, `BigInt`, `Map`, `Set`
- Manual conversion is error-prone
- SuperJSON handles transparently (client ↔ server)
- Cost: 2-5% serialization overhead (acceptable)

---

## Decision 4: Cursor-Based Pagination

### Why Not Offset?
- Offset pagination is O(n) — slower as pages deepen
- Inconsistent results when data changes between pages
- Can't efficiently paginate beyond a few thousand rows

### Cursor Pattern
```typescript
// Request
{ limit: 50, cursor: "eyJpZCI6IjEyMyJ9" }

// Response
{
  items: [...],
  nextCursor: "eyJpZCI6IjE3MyJ9" | null,  // null = end of results
  hasMore: boolean
}
```

### Cursor Format
- Base64-encoded JSON of the sort key of the last returned item
- e.g., `{ id: "clxxx...", createdAt: "2026-04-19T..." }`
- Opaque to clients (clients never parse cursors)

### Filter + Sort + Paginate Contract
```typescript
const ListEngagementsInput = z.object({
  filters: z.object({
    status: z.array(EngagementStatusSchema).optional(),
    type: z.array(EngagementTypeSchema).optional(),
    search: z.string().optional(),
    createdAfter: z.string().datetime().optional(),
  }).optional(),
  sort: z.object({
    field: z.enum(['createdAt', 'updatedAt', 'title', 'plannedStartDate']),
    direction: z.enum(['asc', 'desc']),
  }).default({ field: 'createdAt', direction: 'desc' }),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
```

---

## Decision 5: Idempotency Keys (RFC 9456)

### Pattern
```http
POST /api/engagements
Idempotency-Key: 01JXKHZT3BY9WQZQGEVJGAXF4K
Content-Type: application/json
...
```

### Server Behavior
1. Receive request → check `idempotency_keys` table for this key
2. **If found**: return stored response (same status + body)
3. **If not found**: process request, store response, return to client
4. Keys expire after 24 hours
5. Scoped by tenant_id + user_id (keys can't collide across tenants)

### Why RFC 9456 Format
- IETF draft standard (2024)
- 26-character ULID-style keys (sortable, 128 bits, URL-safe)
- Recommends 24h TTL, scoped per user

### Which Endpoints?
- All **mutations** that can have side effects (create, update, delete, approve)
- Not needed for read queries (they're idempotent by nature)

---

## Decision 6: Optimistic Concurrency Control

### Problem
Two users edit the same record; last write wins silently → data loss.

### Solution: `version` Field
Every mutable record has `_version: number` (incremented on UPDATE via DB trigger).

### API Contract
```typescript
// Update mutation requires current version
const UpdateEngagementInput = z.object({
  id: z.string().cuid2(),
  version: z.number().int(),  // Required — current version client has
  // ...other fields
});
```

### Server Check
```typescript
const updated = await prisma.engagement.updateMany({
  where: { id: input.id, _version: input.version },
  data: { ...input, _version: { increment: 1 } }
});
if (updated.count === 0) {
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Record has been modified. Please reload.',
  });
}
```

### Frontend Handling
```typescript
try {
  await engagement.update({ id, version, title: newTitle });
} catch (err) {
  if (err.code === 'CONFLICT') {
    await refreshEngagement();
    showMergeDialog();
  }
}
```

---

## Decision 7: Tenant Context via RLS

### Pattern
Every request sets PostgreSQL session variables before queries run. RLS policies use these to filter automatically.

### Implementation in tRPC middleware
```typescript
const tenantContext = middleware(async ({ ctx, next }) => {
  // Tenant + user already resolved from JWT in auth middleware
  await ctx.prisma.$executeRawUnsafe(`
    SET LOCAL app.current_tenant_id = '${ctx.tenantId}';
    SET LOCAL app.current_user_id = '${ctx.userId}';
    SET LOCAL app.is_superadmin = '${ctx.isSuperadmin ? 'true' : 'false'}';
  `);
  return next({ ctx });
});
```

### Benefit
- Application code doesn't filter by tenant — PostgreSQL does it automatically
- Impossible to leak cross-tenant data even with buggy queries
- Works identically for tRPC, REST, background jobs

### Caveat
- Uses `SET LOCAL` (transaction-scoped), compatible with PgBouncer transaction mode
- Must wrap every operation in a transaction (Prisma does this by default for mutations)

---

## Decision 8: Error Taxonomy

### Typed Error Codes
```typescript
type AppErrorCode =
  // 400-range
  | 'BAD_REQUEST'                // Generic validation failure
  | 'VALIDATION_FAILED'          // Zod validation
  | 'CONFLICT'                   // Version mismatch or unique constraint
  | 'IDEMPOTENCY_KEY_CONFLICT'   // Same key, different payload
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  // 401-403
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'               // Has session but not this permission
  | 'FORBIDDEN'                  // Permanent no (e.g., cross-tenant attempt)
  // 404
  | 'NOT_FOUND'
  // 409-range
  | 'LOCKED'                     // Resource locked (e.g., issued finding)
  | 'STATE_TRANSITION_INVALID'   // e.g., can't go from ISSUED to DRAFT
  // 422
  | 'BUSINESS_RULE_VIOLATION'    // e.g., CPE requirements not met
  // 500-range
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'        // Downstream (S3, email) failed
  | 'DATABASE_ERROR';
```

See `ERRORS.md` for HTTP status mapping.

---

## Decision 9: Real-Time via Server-Sent Events (SSE)

### Why Not WebSockets?
- Overkill for one-way server→client updates (our main use case)
- More complex (handshake, ping/pong, reconnection logic)
- Worse compatibility with CDNs and corporate proxies
- Stateful on server (harder to scale)

### SSE Advantages
- HTTP-native (works through proxies, CDNs, firewalls)
- Auto-reconnect built into the spec
- Event IDs for resuming after disconnect
- No framing protocol; just plain HTTP streaming

### Use Cases
- **Approval queue**: Notify reviewer of new pending approvals
- **Collaborative editing**: Live updates when co-editing a finding
- **Long-running operations**: PDF generation progress, bulk imports
- **Dashboard data**: Live KPI updates

### SSE Endpoint Pattern
```
GET /api/stream/engagement/:id
Accept: text/event-stream

Server streams:
event: finding_added
id: 01JXKHZT3BY9...
data: {"findingId": "...", "title": "..."}

event: approval_requested
id: 01JXKHZT3BY9...
data: {"approvalId": "...", ...}
```

### When WebSockets?
- If bidirectional commanding becomes necessary (rare for audit platform)
- Current design: all commands via tRPC/REST (HTTP POST); only events via SSE

---

## Decision 10: Webhooks for Customer Integrations

### Outbound Event Pattern
Tenants can configure webhook URLs to receive events when things happen in AIMS:
- Finding created/updated/issued
- CAP becomes overdue
- Report issued
- User invited

### Signature Verification
```
X-AIMS-Signature: t=1713559289,v1=5257a869e7ecebeda32affa62cdc...
X-AIMS-Event-Id: 01JXKHZT3BY9...
```
Per Stripe-style HMAC-SHA256 (timestamp + body, concatenated).

### Retry & DLQ
- Initial attempt → retry at 1min, 5min, 30min, 2hr, 6hr, 24hr
- After 24h with all retries failing → dead letter; notify tenant admin
- Tenant can replay failed webhooks via admin UI

See `webhooks/events.md` for full catalog.

---

## Decision 11: Rate Limiting

### Strategy: Token Bucket per User + per Tenant
- Default: 100 req/min per user, 1000 req/min per tenant (Professional tier)
- Enterprise tier: Custom limits
- External API: Stricter (20 req/min per API key)
- Auth endpoints: Very strict (5 req/min to prevent brute force)

### Implementation
- Redis-backed (atomic INCR + EXPIRE)
- Return `429 Too Many Requests` with `Retry-After` header
- Include `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers in responses

### Per-Endpoint Limits
Some endpoints have stricter limits:
- `auth.login`: 5/min
- `files.upload`: 10/min
- `reports.generatePdf`: 5/min (expensive operation)
- `search.globalSearch`: 30/min

---

## Decision 12: API Versioning — hybrid URL majors + dated header minors

**Canonical record: [ADR-0007](../references/adr/0007-api-versioning-hybrid.md).**

### Strategy

**tRPC (internal)**: Not versioned. We own both sides; Zod snapshot tests in CI catch breaking changes at build time. Frontend and backend deploy together.

**REST (public)**: hybrid scheme — URL-based majors + dated header-based minors, following the Stripe pattern.

- **URL-based major versions** for hard breaking changes — `/v1/engagements`, `/v2/engagements`. Majors happen rarely (target: every 2-3 years at most) and represent semantically different endpoints, fundamentally different request/response shapes, contracts we cannot transparently migrate.
- **Dated header-based minor versions** within a major — `Api-Version: 2026-04-20` request header. Each dated version is a frozen snapshot of the response shape and semantics as of that date. Additive changes (new fields, new optional parameters, new resource subsets) ship as new dated versions without forcing integrators to change URLs.
- Integrators who don't send `Api-Version` receive the *oldest active version within the major* (conservative default — stable behaviour regardless of when they built against the API).

### Compatibility layer

A per-dated-version rendering shim lives in `api/requests/rest/versioning/`. One file per dated version; each takes the current data model and produces the response shape as it existed at the integrator's pinned date. Snapshot tests exercise every dated version against every endpoint.

### Deprecation policy

When a dated version is deprecated:

- Responses include `Deprecation: true` and `Sunset: <ISO-date>` headers per RFC 8594
- Minimum 18-month support window from "deprecated" announcement to "removed"
- Aged-out versions return `410 Gone` with a migration-guide URL
- OpenAPI spec is published per dated version; deprecated versions remain accessible for reference

### Non-Breaking Changes (cut new dated minor)

- Add new fields, new endpoints, new enum values → new `Api-Version` date; old date's shim continues to render the old shape
- Document in the changelog keyed by date
- Integrators automatically opt-in when they bump their `Api-Version` header

### Breaking Changes (cut new URL major)

- Remove fields, rename fields, change types, remove enum values → URL major bump (`/v1/` → `/v2/`)
- Announce 18 months in advance via Deprecation headers and trust-center update
- Migration guide published per-endpoint

---

## Decision 13: Observability

### Logs
- **Pino** for structured JSON logging
- Every log line includes: `request_id`, `tenant_id`, `user_id`, `trace_id`
- Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- Ship to Loki/Cloudwatch/Datadog

### Traces
- **OpenTelemetry** for distributed tracing
- Spans for: HTTP request, DB query, S3 operation, external API call, job execution
- Exemplars link logs to traces

### Metrics
- **Prometheus** + prom-client
- Counters: `http_requests_total`, `auth_failures_total`, `audit_log_writes_total`
- Histograms: `http_request_duration_seconds`, `db_query_duration_seconds`
- Gauges: `active_sessions`, `pending_approvals_count`

### Dashboards
- **Grafana** pre-built for operators
- SLO dashboards (per team)
- Error budget tracking
- Incident response runbooks linked from dashboards

---

## Decision 14: Background Jobs via AWS SQS + EventBridge Scheduler

**Canonical record: [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md).**

Background jobs run on NestJS workers in `api/workers/` consuming from AWS SQS. Scheduled jobs are dispatched by Amazon EventBridge Scheduler to SQS (not from in-worker `@nestjs/schedule`). `@nestjs/bull` / BullMQ / Redis is *not* used for queue infrastructure.

### Pattern

```typescript
// tRPC returns job ID immediately; enqueues to SQS
reports.generatePdf = authedProcedure
  .input(GeneratePdfInput)
  .mutation(async ({ input, ctx }) => {
    const jobId = generateJobId();

    // Write heavy payload to S3 first; SQS message carries only the pointer
    const payloadUri = await s3.putObject({
      Bucket: env.JOB_PAYLOAD_BUCKET,
      Key: `jobs/${jobId}.json`,
      Body: JSON.stringify({ reportId: input.reportId, options: input.options }),
      ServerSideEncryption: 'aws:kms',
    });

    // Enqueue to SQS (payload is pointer + metadata, under 256 KB)
    await sqs.sendMessage({
      QueueUrl: env.DOC_GEN_QUEUE_URL,
      MessageBody: JSON.stringify({
        jobId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        payloadUri,
        idempotencyKey: ctx.idempotencyKey,
      }),
      MessageAttributes: {
        tenantId: { DataType: 'String', StringValue: ctx.tenantId },
        traceparent: { DataType: 'String', StringValue: ctx.traceparent },
      },
    });

    return { jobId, estimatedMs: 30000 };
  });

// Client polls (job state stored in a dedicated jobs table keyed by jobId)
reports.getJobStatus = authedProcedure
  .input(z.object({ jobId: z.string() }))
  .query(async ({ input, ctx }) => {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    return { status: job.status, progress: job.progress, resultUri: job.resultUri, error: job.error };
  });
```

### Queues (per-tier, per-workload)

All queues follow the naming convention in [devops/QUEUE-CONVENTIONS.md](../devops/QUEUE-CONVENTIONS.md): `<environment>-<domain>-<purpose>`.

| Queue | Type | Purpose |
|---|---|---|
| `<env>-doc-gen` | Standard | PDF/DOCX report generation |
| `<env>-email` | Standard | Transactional email dispatch |
| `<env>-webhook-delivery` | FIFO (per `aggregate_id`) | Outbound webhooks with per-aggregate ordering |
| `<env>-export-csv` | Standard | Bulk data export |
| `<env>-import-csv` | Standard | Bulk data import |
| `<env>-archival` | Standard | Monthly audit log archival |
| `<env>-outbox-dispatch` | FIFO (per `aggregate_id`) | Transactional outbox → side effects |
| `<env>-scim-sync` | FIFO (per `tenant_id`) | Per-tenant SCIM user-directory sync |
| `<env>-revocation` | Standard | Populate session blocklist (ADR-0005) |

All queues have a corresponding DLQ (`<queue-name>-dlq`) with a 5-attempt redrive policy and CloudWatch alarms on DLQ depth.

### Scheduled jobs via EventBridge Scheduler

Cron-style jobs (CAP-overdue reminders, CPE due dates, monthly archival, audit-integrity checks) are not scheduled by `@nestjs/schedule` running in-worker. EventBridge Scheduler rules are defined in Terraform and dispatch to the appropriate SQS queue. Benefits: schedules are visible in the AWS console, modifiable via IaC without code deploys, and logged in CloudWatch.

### Worker Infrastructure

- NestJS worker processes in `api/workers/` (separate container image from the request path)
- IRSA-scoped IAM role grants `sqs:ReceiveMessage` / `sqs:DeleteMessage` / `sqs:ChangeMessageVisibility` on the specific queues it consumes from
- OpenTelemetry spans on every `ReceiveMessage` → `DeleteMessage`, correlated with the originating request via the `traceparent` message attribute
- Observability via CloudWatch (queue depth, DLQ depth, message age) + Sentry (worker errors) + Tempo (trace propagation)
- No BullBoard equivalent; a lightweight internal "SQS inspector" UI provides queue-state debugging post-launch if engineer requests accumulate

---

## Decision 15: Security Headers

### For all REST responses
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### For tRPC
- CORS strictly limited to our frontend domains
- CSRF protection via double-submit cookie or SameSite=Strict
- Response-Type validation (reject text/html where only JSON expected)

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 1. Protocol | tRPC + REST hybrid | Type safety + universal integration |
| 2. Architecture | Thin routers + fat services | Testability, reusability |
| 3. tRPC version | v11 + SuperJSON | Streaming, type safety, Date/Decimal support |
| 4. Pagination | Cursor-based | Scale to millions of rows |
| 5. Idempotency | RFC 9456 keys | Safe retries |
| 6. Concurrency | Optimistic with version field | No silent data loss |
| 7. Tenant scoping | PostgreSQL RLS via session vars | DB-enforced isolation |
| 8. Errors | Typed error codes | Predictable client handling |
| 9. Real-time | Server-Sent Events | Simpler than WebSockets |
| 10. Outbound events | Signed webhooks | Customer integrations |
| 11. Rate limits | Token bucket per user+tenant | Fair usage, abuse prevention |
| 12. Versioning | Path-based for REST, none for tRPC | Internal coupling, external stability |
| 13. Observability | OTel + Pino + Prometheus | Industry standard |
| 14. Background jobs | BullMQ | Reliable, scalable, well-documented |
| 15. Security headers | OWASP recommended set | Defense in depth |
