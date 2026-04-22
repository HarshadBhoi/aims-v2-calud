# AIMS v2 API Conventions

> Consistent patterns across all endpoints. Follow these when adding new routers.

---

## 1. Procedure Naming

### Verbs (queries)
- `list` — paginated list (preferred over `getAll`)
- `get` — fetch by ID
- `getBy<Field>` — fetch by other unique field (e.g., `getBySlug`)
- `search` — full-text / fuzzy search
- `count` — just return a count
- `stats` — aggregate metrics

### Verbs (mutations)
- `create` — new resource
- `update` — partial update (PATCH-like)
- `replace` — full replacement (PUT-like; rare)
- `delete` — soft delete (sets `deletedAt`)
- `restore` — undo soft delete
- `archive` — move to archive (different from delete)
- `submit` — transition to review
- `approve` / `reject` / `recall` / `delegate` — workflow actions
- `issue` / `publish` — final lock
- `clone` — duplicate resource

### Examples
```typescript
engagementRouter = router({
  list: ...,
  get: ...,
  getByNumber: ...,
  create: ...,
  update: ...,
  delete: ...,
  clone: ...,
  submit: ...,
  issue: ...,
  stats: ...,
});
```

---

## 2. Input Validation (Zod)

### Every procedure has a Zod input schema
Even if empty, explicit `z.object({})` beats implicit `undefined`.

### Shared schemas in `schemas/` directory
```typescript
// schemas/common.schemas.ts
export const CuidSchema = z.string().cuid2();
export const VersionSchema = z.number().int().nonnegative();
export const PaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
```

### Compose schemas
```typescript
export const UpdateEngagementInput = BaseEngagementFieldsSchema
  .partial()  // all fields optional for update
  .extend({
    id: CuidSchema,
    version: VersionSchema,  // required for optimistic concurrency
  });
```

### Validation order
1. Zod validates structure/types (reject at middleware)
2. Service layer validates business rules (reject with `BUSINESS_RULE_VIOLATION`)
3. Database validates via check constraints (safety net)

---

## 3. Output Shape

### Queries return data directly
```typescript
// GOOD
get: authedProcedure.input(GetEngagementInput).query(...)
  → Returns Engagement object directly

// AVOID (over-wrapping)
get: authedProcedure...
  → { data: Engagement, status: 'ok' }  // No
```

### List queries return paginated envelope
```typescript
// ALWAYS:
{
  items: Engagement[],
  nextCursor: string | null,
  hasMore: boolean,
  // Optional aggregates for dashboards
  totalCount?: number,    // Only include if cheap to compute
}
```

### Mutations return the full updated resource
```typescript
// Client gets everything it needs to update UI without re-fetching
update: ...
  → Returns full Engagement object (including new _version)
```

---

## 4. Pagination

### Cursor-based, always
```typescript
const ListInput = z.object({
  cursor: z.string().optional(),        // Opaque token from previous response
  limit: z.number().int().min(1).max(200).default(50),
  filters: z.object({ ... }).optional(),
  sort: SortSchema.optional(),
});

// Implementation
const items = await prisma.engagement.findMany({
  where: buildWhereClause(filters, tenantId),
  orderBy: [{ [sort.field]: sort.direction }, { id: 'asc' }],  // tie-breaker
  cursor: cursor ? decodeCursor(cursor) : undefined,
  skip: cursor ? 1 : 0,  // Skip the cursor item itself
  take: limit + 1,       // +1 to check hasMore
});

const hasMore = items.length > limit;
const results = hasMore ? items.slice(0, -1) : items;
const nextCursor = hasMore ? encodeCursor(results[results.length - 1]) : null;

return { items: results, nextCursor, hasMore };
```

### Cursor encoding helpers
```typescript
function encodeCursor(item: { id: string; createdAt: Date }): string {
  return btoa(JSON.stringify({ id: item.id, createdAt: item.createdAt.toISOString() }));
}
function decodeCursor(cursor: string): { id: string; createdAt: Date } | undefined {
  try {
    const { id, createdAt } = JSON.parse(atob(cursor));
    return { id, createdAt: new Date(createdAt) };
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid cursor' });
  }
}
```

---

## 5. Filtering

### Always use typed Zod discriminated unions
```typescript
const FindingFilters = z.object({
  status: z.array(FindingStatusEnum).optional(),
  engagementId: CuidSchema.optional(),
  classification: z.array(z.string()).optional(),
  riskRating: z.array(RiskRatingEnum).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  search: z.string().min(2).max(200).optional(),  // full-text
  isRepeat: z.boolean().optional(),
  hasQuestionedCosts: z.boolean().optional(),
});
```

### Filter combinations
- Multiple filter fields are **AND** (intersection)
- Array values within a field are **IN** (union)
- `search` uses PostgreSQL full-text search (tsvector)

### Implementation pattern
```typescript
function buildFindingWhere(filters: FindingFilters, tenantId: string): Prisma.FindingWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(filters.status?.length && { status: { in: filters.status } }),
    ...(filters.engagementId && { engagementId: filters.engagementId }),
    ...(filters.classification?.length && { classification: { in: filters.classification } }),
    ...(filters.riskRating?.length && { riskRating: { in: filters.riskRating } }),
    ...(filters.createdAfter && { createdAt: { gte: new Date(filters.createdAfter) } }),
    ...(filters.createdBefore && { createdAt: { lte: new Date(filters.createdBefore) } }),
    ...(filters.search && {
      searchVector: { search: filters.search },  // tsvector match
    }),
    ...(filters.hasQuestionedCosts && {
      OR: [
        { questionedCostsKnown: { gt: 0 } },
        { questionedCostsLikely: { gt: 0 } },
      ],
    }),
  };
}
```

---

## 6. Sorting

### Typed sort parameters
```typescript
const EngagementSortField = z.enum([
  'createdAt',
  'updatedAt',
  'title',
  'engagementNumber',
  'plannedStartDate',
  'status',
]);

const SortSchema = z.object({
  field: EngagementSortField,
  direction: z.enum(['asc', 'desc']),
});
```

### Default sort
- Most lists: `createdAt DESC` (newest first)
- Approvals: `slaDueAt ASC` (most urgent first)
- CAP aging: `dueDate ASC` (most overdue first)

### Tie-breaker
Always include `id` as secondary sort to ensure deterministic pagination:
```typescript
orderBy: [{ [sort.field]: sort.direction }, { id: 'asc' }]
```

---

## 7. Idempotency

### Mutations accept `Idempotency-Key` header
```typescript
const idempotencyMiddleware = middleware(async ({ ctx, next, type }) => {
  if (type !== 'mutation') return next();

  const key = ctx.req?.headers['idempotency-key'];
  if (!key) return next();

  const existing = await ctx.prisma.idempotencyKey.findUnique({
    where: { key },
  });

  if (existing) {
    // Verify same tenant+user
    if (existing.tenantId !== ctx.tenantId || existing.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    // Return stored response
    return existing.responseBody;
  }

  const result = await next();

  // Store response for 24h
  await ctx.prisma.idempotencyKey.create({
    data: {
      key,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      endpoint: ctx.path,
      responseStatus: 200,
      responseBody: result,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return result;
});
```

### Client SDK generates keys automatically
```typescript
// Client-side tRPC wrapper
function withIdempotency<T>(fn: () => Promise<T>): Promise<T> {
  const key = ulid();  // ULID = lexicographically-sortable UUID
  return fn({ headers: { 'Idempotency-Key': key } });
}
```

---

## 8. Optimistic Concurrency

### Update mutations require `version` field
```typescript
const UpdateInput = z.object({
  id: CuidSchema,
  version: z.number().int(),
  // ...fields to update
});

const updated = await prisma.engagement.updateMany({
  where: { id: input.id, tenantId: ctx.tenantId, _version: input.version },
  data: { ...updates },
});

if (updated.count === 0) {
  // Either not found or version mismatch — disambiguate
  const current = await prisma.engagement.findFirst({
    where: { id: input.id, tenantId: ctx.tenantId },
  });
  if (!current) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Record has been modified. Please reload and try again.',
    cause: { currentVersion: current._version, attemptedVersion: input.version },
  });
}
```

---

## 9. Soft Delete

### `delete` mutations set `deletedAt`, not remove row
```typescript
delete: authedProcedure
  .input(z.object({ id: CuidSchema, version: VersionSchema }))
  .mutation(async ({ input, ctx }) => {
    return prisma.engagement.update({
      where: { id: input.id, tenantId: ctx.tenantId, _version: input.version },
      data: { deletedAt: new Date(), deletedBy: ctx.userId },
    });
  });
```

### All queries exclude soft-deleted by default
```typescript
// Query helper
function activeOnly<T extends { deletedAt: Date | null }>(where: T) {
  return { ...where, deletedAt: null };
}
```

### Explicit `includeDeleted` parameter for admin/audit views
```typescript
const ListInput = z.object({
  // ...
  includeDeleted: z.boolean().default(false),
});
```

---

## 10. Error Handling

### Use typed errors
```typescript
// DO NOT
throw new Error('Not found');

// DO
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Engagement not found',
  cause: { id: input.id },  // Structured details
});
```

### Error code taxonomy
See `ERRORS.md` for full list.

### Error responses are typed
```typescript
type ErrorResponse = {
  error: {
    code: AppErrorCode;
    message: string;
    details?: unknown;
    retryAfter?: number;  // For rate limits
    requestId: string;
  };
};
```

---

## 11. Logging

### Every procedure logs context
```typescript
const loggingMiddleware = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const requestId = ctx.req?.headers['x-request-id'] ?? ulid();

  ctx.logger = ctx.logger.child({
    request_id: requestId,
    path,
    type,
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
  });

  try {
    const result = await next();
    ctx.logger.info({ duration_ms: Date.now() - start }, 'Request completed');
    return result;
  } catch (err) {
    ctx.logger.error({ err, duration_ms: Date.now() - start }, 'Request failed');
    throw err;
  }
});
```

### Log levels
- `fatal` — service unable to continue (DB connection lost permanently)
- `error` — request failed (5xx, unexpected exceptions)
- `warn` — unexpected but recoverable (rate limit hit, cache miss beyond threshold)
- `info` — normal operations (request completed, job started)
- `debug` — detailed (verbose; only in development)
- `trace` — hyper-detailed (disabled in production)

---

## 12. RBAC (Role-Based Access Control)

### Declarative permissions via middleware
```typescript
const requireRole = (...roles: Role[]) =>
  middleware(async ({ ctx, next }) => {
    if (!roles.includes(ctx.userRole)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: `Requires one of: ${roles.join(', ')}`,
      });
    }
    return next();
  });

const requirePermission = (permission: Permission) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.permissions.has(permission)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: `Requires permission: ${permission}`,
      });
    }
    return next();
  });

// Usage
engagementRouter.create = authedProcedure
  .use(requirePermission('engagement:create'))
  .input(...)
  .mutation(...);

engagementRouter.delete = authedProcedure
  .use(requireRole('ADMIN', 'DIRECTOR'))  // Only admins + directors
  .input(...)
  .mutation(...);
```

### Row-level permissions
Beyond RBAC, some operations require checking relationship (e.g., "user is on this engagement's team"):
```typescript
const requireEngagementAccess = middleware(async ({ ctx, next, input }) => {
  const engagementId = input.engagementId ?? input.id;
  const member = await ctx.prisma.engagementTeamMember.findFirst({
    where: { engagementId, userId: ctx.userId, removedAt: null },
  });
  if (!member && !ctx.permissions.has('engagement:view_all')) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx: { ...ctx, teamRole: member?.role } });
});
```

---

## 13. Immutability Checks

### For status-gated mutations
```typescript
update: authedProcedure
  .input(UpdateFindingInput)
  .mutation(async ({ input, ctx }) => {
    const current = await ctx.prisma.finding.findUniqueOrThrow({
      where: { id: input.id, tenantId: ctx.tenantId },
    });

    if (current.lockedAt) {
      throw new TRPCError({
        code: 'LOCKED',
        message: `Finding is locked (issued on ${current.lockedAt.toISOString()}). Create an amendment instead.`,
      });
    }

    // ...proceed with update
  });
```

### Status transition validation
```typescript
function canTransition(from: FindingStatus, to: FindingStatus): boolean {
  const allowed: Record<FindingStatus, FindingStatus[]> = {
    DRAFT: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['DRAFT', 'APPROVED'],
    APPROVED: ['COMMUNICATED', 'DRAFT'],
    COMMUNICATED: ['ISSUED'],
    ISSUED: [],  // Terminal
    CLOSED: ['REOPENED'],
    REOPENED: ['UNDER_REVIEW'],
    WITHDRAWN: [],  // Terminal
  };
  return allowed[from]?.includes(to) ?? false;
}
```

---

## 14. Audit Logging

### Service layer emits audit events (not routers)
```typescript
// In service
async function createEngagement(tenantId: string, userId: string, input: CreateEngagementInput) {
  return prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.create({ ... });

    // Audit log emitted by DB trigger (see database/functions/audit-log-triggers.sql)
    // But service layer can add additional context:
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CREATE',
        entityType: 'engagement',
        entityId: engagement.id,
        changesSummary: `Created engagement "${engagement.title}"`,
      },
    });

    return engagement;
  });
}
```

### DB triggers catch everything
The `audit.fn_log_change()` trigger (see `database/functions/audit-log-triggers.sql`) automatically logs all mutations. Explicit service-layer calls add human-readable summaries.

---

## 15. Background Job Triggers

### Pattern: mutation returns job ID, client polls or subscribes
```typescript
reports.generatePdf = authedProcedure
  .input(z.object({ reportId: CuidSchema, version: VersionSchema }))
  .mutation(async ({ input, ctx }) => {
    const report = await ctx.prisma.report.findUniqueOrThrow({
      where: { id: input.reportId, tenantId: ctx.tenantId },
    });

    const job = await ctx.queues.pdf.add('generate-report-pdf', {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      reportId: report.id,
    });

    return { jobId: job.id, estimatedMs: 30_000 };
  });

reports.getJobStatus = authedProcedure
  .input(z.object({ jobId: z.string() }))
  .query(async ({ input, ctx }) => {
    const job = await ctx.queues.pdf.getJob(input.jobId);
    if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

    return {
      status: await job.getState(),  // 'waiting' | 'active' | 'completed' | 'failed'
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  });
```

---

## 16. File Uploads (Pre-Signed URLs)

### Pattern: Client uploads directly to S3, then registers metadata
```typescript
// Step 1: Client requests upload URL
files.requestUpload = authedProcedure
  .input(z.object({
    filename: z.string().max(255),
    contentType: z.string(),
    sizeBytes: z.number().int().max(50_000_000),  // 50MB limit
    category: FileCategoryEnum,
  }))
  .mutation(async ({ input, ctx }) => {
    const key = `${ctx.tenantId}/${input.category}/${ulid()}/${sanitize(input.filename)}`;
    const presignedUrl = await s3.getSignedUrl('putObject', {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      Expires: 300,  // 5 minutes
    });

    return {
      uploadUrl: presignedUrl,
      storageKey: key,
      expiresAt: new Date(Date.now() + 300_000),
    };
  });

// Step 2: Client uploads to S3 directly
// PUT {uploadUrl} with binary body

// Step 3: Client registers metadata
files.registerUpload = authedProcedure
  .input(z.object({
    storageKey: z.string(),
    originalFilename: z.string(),
    contentType: z.string(),
    sizeBytes: z.number().int(),
    fileHash: z.string().regex(/^[a-f0-9]{64}$/),  // SHA-256
    category: FileCategoryEnum,
    linkedEntityType: z.string().optional(),
    linkedEntityId: CuidSchema.optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // Verify object actually exists in S3
    await s3.headObject({ Bucket, Key: input.storageKey });

    return ctx.prisma.file.create({
      data: {
        tenantId: ctx.tenantId,
        uploadedById: ctx.userId,
        ...input,
      },
    });
  });
```

### Why Pre-Signed URLs?
- Binary data never hits our API (API doesn't become upload bottleneck)
- Direct S3 uploads scale naturally
- Our API still gates **what** can be uploaded (content-type, size, category)

---

## Summary Checklist for New Routers

When adding a new tRPC router, verify:
- [ ] Zod input schema for every procedure
- [ ] Output types inferred from Prisma (no manual DTOs)
- [ ] Auth middleware applied by default
- [ ] RBAC middleware on mutations where appropriate
- [ ] Tenant context automatically applied via middleware
- [ ] List procedures use cursor pagination
- [ ] Mutations accept idempotency keys
- [ ] Updates accept and verify `version` field
- [ ] Soft delete pattern (no hard deletes)
- [ ] Immutability checks for locked records
- [ ] Errors use `TRPCError` with typed codes
- [ ] Logging middleware captures request context
- [ ] Audit trail captured (DB trigger + optional service-layer summary)
- [ ] Unit tests for service layer
- [ ] Integration tests covering happy path + common errors
