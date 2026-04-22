# AIMS v2 API Error Model

> Consistent error taxonomy across tRPC and REST. Every error has a stable `code`, a human-readable `message`, and structured `details`.

---

## Error Response Shape

### tRPC
```typescript
{
  error: {
    code: "CONFLICT",                        // Typed AppErrorCode
    message: "Record has been modified...",  // Human-readable
    data: {                                  // tRPC error data envelope
      httpStatus: 409,
      path: "engagement.update",
      stack: "...",                          // Only in dev
      cause: {                               // Structured details
        currentVersion: 5,
        attemptedVersion: 3,
      },
    },
  }
}
```

### REST
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Record has been modified...",
    "details": {
      "currentVersion": 5,
      "attemptedVersion": 3
    },
    "request_id": "01JXKHZT3BY9WQZQGEVJGAXF4K"
  }
}
```

---

## Error Codes

### 400-range (Client Errors)

| Code | HTTP Status | Meaning | Example |
|------|-------------|---------|---------|
| `BAD_REQUEST` | 400 | Generic bad input (last resort) | Malformed JSON |
| `VALIDATION_FAILED` | 400 | Zod validation failed | Missing required field |
| `UNAUTHENTICATED` | 401 | No valid session | Missing/expired token |
| `UNAUTHORIZED` | 403 | Authenticated but lacks permission | Viewer tried to create engagement |
| `FORBIDDEN` | 403 | Permanently disallowed | Cross-tenant access attempt |
| `NOT_FOUND` | 404 | Resource does not exist or not visible to user | Engagement ID not in tenant |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP method | PUT on a query endpoint |
| `CONFLICT` | 409 | State conflict (version mismatch or unique constraint) | Optimistic concurrency failure |
| `LOCKED` | 423 | Resource immutable | Finding already ISSUED |
| `UNPROCESSABLE_ENTITY` | 422 | Syntactically valid but semantically invalid | Invalid state transition |
| `STATE_TRANSITION_INVALID` | 422 | Status change not allowed | DRAFT → ISSUED skipping steps |
| `BUSINESS_RULE_VIOLATION` | 422 | Violates audit business rule | CPE requirement not met |
| `IDEMPOTENCY_KEY_CONFLICT` | 422 | Same key, different payload | Idempotency collision |
| `PAYMENT_REQUIRED` | 402 | Tier doesn't include this feature | Free tier hitting Enterprise feature |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded | 101st login attempt in 60s |
| `PAYLOAD_TOO_LARGE` | 413 | Body/upload too large | 60MB file (50MB limit) |

### 500-range (Server Errors)

| Code | HTTP Status | Meaning | Example |
|------|-------------|---------|---------|
| `INTERNAL_ERROR` | 500 | Unexpected exception | Unhandled error |
| `NOT_IMPLEMENTED` | 501 | Feature not implemented yet | Placeholder endpoint |
| `BAD_GATEWAY` | 502 | Downstream service failed | Auth provider unreachable |
| `SERVICE_UNAVAILABLE` | 503 | System overloaded or maintenance | Circuit breaker open |
| `GATEWAY_TIMEOUT` | 504 | Downstream took too long | S3 timeout |
| `DATABASE_ERROR` | 500 | DB connection or query failed | Lost connection to Postgres |

---

## When to Use Which Code

### `VALIDATION_FAILED` vs `BUSINESS_RULE_VIOLATION`

**VALIDATION_FAILED** (400): Input doesn't match schema
- Required field missing
- String too long
- Invalid email format
- Wrong enum value

**BUSINESS_RULE_VIOLATION** (422): Input is valid but violates rules
- "Cannot create engagement: CPE requirements not met"
- "Cannot submit finding: missing required Criteria element"
- "Cannot approve: you created this finding (conflict of interest)"

### `UNAUTHORIZED` vs `FORBIDDEN`

**UNAUTHORIZED** (403): User has some access but not this specific thing
- Viewer role tries admin action
- Could be granted via role/permission change

**FORBIDDEN** (403): Permanent no
- Cross-tenant attempt (should never happen; indicates attack)
- Action permanently impossible (e.g., tenant is SUSPENDED)

### `CONFLICT` vs `LOCKED`

**CONFLICT** (409): Transient — retry after refresh
- Optimistic concurrency version mismatch
- Unique constraint violation

**LOCKED** (423): Permanent — record is frozen
- Finding is ISSUED (locked_at set)
- Report is published
- Independence declaration signed

### `NOT_FOUND` Security Consideration

**DO NOT** leak whether a resource exists but belongs to another tenant. Always return `NOT_FOUND` if it's not visible to the user, even if it technically exists.

```typescript
// GOOD
const engagement = await prisma.engagement.findFirst({
  where: { id, tenantId: ctx.tenantId },  // Tenant-scoped
});
if (!engagement) throw new TRPCError({ code: 'NOT_FOUND' });

// BAD (leaks existence)
const engagement = await prisma.engagement.findUnique({ where: { id } });
if (engagement && engagement.tenantId !== ctx.tenantId) {
  throw new TRPCError({ code: 'FORBIDDEN' });  // Leaks existence!
}
```

---

## Retry Semantics

### Retryable Errors (client should back off + retry)
- `TOO_MANY_REQUESTS` (429) — Use `Retry-After` header
- `SERVICE_UNAVAILABLE` (503) — Exponential backoff
- `GATEWAY_TIMEOUT` (504) — Retry with idempotency key
- `INTERNAL_ERROR` (500) — Sometimes (use idempotency key)

### Non-Retryable Errors (retrying won't help)
- `VALIDATION_FAILED` — Fix input first
- `UNAUTHENTICATED` — Re-authenticate
- `UNAUTHORIZED` / `FORBIDDEN` — User lacks permission
- `NOT_FOUND` — Resource genuinely doesn't exist
- `CONFLICT` — Must refresh and merge first
- `LOCKED` — Resource is permanently immutable
- `BUSINESS_RULE_VIOLATION` — Fix business state first
- `IDEMPOTENCY_KEY_CONFLICT` — Bug in client (shouldn't happen)

### Retry-After Header
For `429` and `503`, include `Retry-After` header:
```
Retry-After: 60              # Seconds
Retry-After: Wed, 21 Oct 2026 07:28:00 GMT  # HTTP date
```

---

## Error Details Schema

### For `VALIDATION_FAILED`
```typescript
{
  code: "VALIDATION_FAILED",
  message: "Invalid input",
  details: {
    issues: [
      {
        path: ["title"],
        code: "too_small",
        message: "String must contain at least 3 character(s)",
        minimum: 3,
      },
      {
        path: ["team", 0, "role"],
        code: "invalid_enum_value",
        message: "Invalid enum value",
        options: ["LEAD_AUDITOR", "STAFF_AUDITOR", "REVIEWER"],
      },
    ]
  }
}
```

### For `CONFLICT` (Optimistic Concurrency)
```typescript
{
  code: "CONFLICT",
  message: "Record has been modified since you loaded it",
  details: {
    resourceType: "engagement",
    resourceId: "clxyz...",
    currentVersion: 5,
    attemptedVersion: 3,
    modifiedBy: "user_abc",
    modifiedAt: "2026-04-19T10:32:11Z",
  }
}
```

### For `STATE_TRANSITION_INVALID`
```typescript
{
  code: "STATE_TRANSITION_INVALID",
  message: "Cannot transition from ISSUED to DRAFT",
  details: {
    resourceType: "finding",
    resourceId: "clxyz...",
    currentStatus: "ISSUED",
    attemptedStatus: "DRAFT",
    allowedTransitions: [],  // Empty = terminal state
    suggestion: "Create an amendment or reopen via REOPENED status",
  }
}
```

### For `TOO_MANY_REQUESTS`
```typescript
{
  code: "TOO_MANY_REQUESTS",
  message: "Rate limit exceeded",
  details: {
    limit: 100,
    window: "1m",
    retryAfterSeconds: 45,
    scope: "user:clxyz_01h...",  // Per-user bucket
  }
}
```

### For `BUSINESS_RULE_VIOLATION`
```typescript
{
  code: "BUSINESS_RULE_VIOLATION",
  message: "Cannot create engagement: team member CPE requirements not met",
  details: {
    rule: "GAGAS_CPE_REQUIREMENT",
    reference: "§4.16",  // Standard reference
    violations: [
      {
        userId: "user_abc",
        userName: "Jane Doe",
        requirement: "80 hours per 2-year period",
        current: 45,
        missing: 35,
      }
    ],
  }
}
```

---

## Error Propagation

### Service Layer → API Layer
```typescript
// Service throws typed AppError
export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Router middleware converts AppError → TRPCError
const errorMiddleware = middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    if (err instanceof AppError) {
      throw new TRPCError({
        code: mapAppCodeToTrpcCode(err.code),  // See mapping below
        message: err.message,
        cause: err.details,
      });
    }
    throw err;  // Unhandled errors → INTERNAL_ERROR by tRPC default
  }
});
```

### AppCode → TRPCCode Mapping
tRPC has its own limited error code enum. Map our richer codes to the appropriate tRPC code, preserving the original in `data.code`:

| AppErrorCode | tRPC Code | HTTP Status |
|--------------|-----------|-------------|
| `VALIDATION_FAILED` | `BAD_REQUEST` | 400 |
| `UNAUTHENTICATED` | `UNAUTHORIZED` | 401 |
| `UNAUTHORIZED` | `FORBIDDEN` | 403 |
| `FORBIDDEN` | `FORBIDDEN` | 403 |
| `NOT_FOUND` | `NOT_FOUND` | 404 |
| `CONFLICT` | `CONFLICT` | 409 |
| `LOCKED` | `CONFLICT` (tRPC lacks 423) | 423 |
| `STATE_TRANSITION_INVALID` | `BAD_REQUEST` | 422 |
| `BUSINESS_RULE_VIOLATION` | `BAD_REQUEST` | 422 |
| `TOO_MANY_REQUESTS` | `TOO_MANY_REQUESTS` | 429 |
| `PAYLOAD_TOO_LARGE` | `PAYLOAD_TOO_LARGE` | 413 |
| `INTERNAL_ERROR` | `INTERNAL_SERVER_ERROR` | 500 |
| `SERVICE_UNAVAILABLE` | `INTERNAL_SERVER_ERROR` | 503 |

---

## Logging Errors

### Always log with context
```typescript
logger.error({
  err,
  error_code: err.code,
  request_id: ctx.requestId,
  tenant_id: ctx.tenantId,
  user_id: ctx.userId,
  path: ctx.path,
}, 'Request failed');
```

### Don't log sensitive data
- Passwords, tokens, MFA codes → redact before logging
- PII (names, emails) → include tenant_id/user_id instead for traceability
- Health data, financial data → redact or summarize

### Alert on anomalies
- Spike in `INTERNAL_ERROR` → PagerDuty
- Spike in `UNAUTHENTICATED` → Security team (potential attack)
- Spike in `TOO_MANY_REQUESTS` → Review rate limits
- Any `DATABASE_ERROR` → On-call

---

## Summary

| Situation | Error Code | Notes |
|-----------|-----------|-------|
| Missing/invalid input | `VALIDATION_FAILED` | Zod issues |
| No session | `UNAUTHENTICATED` | Redirect to login |
| Session but no permission | `UNAUTHORIZED` | Show "contact admin" |
| Cross-tenant attempt | `FORBIDDEN` | Log as security event |
| Resource doesn't exist | `NOT_FOUND` | Never leak existence |
| Edit conflict | `CONFLICT` | Client re-reads + merges |
| Resource is locked | `LOCKED` | Show "create amendment" |
| Invalid state transition | `STATE_TRANSITION_INVALID` | Include allowed transitions |
| Business rule | `BUSINESS_RULE_VIOLATION` | Include rule + reference |
| Rate limit | `TOO_MANY_REQUESTS` | Include `Retry-After` |
| Unexpected error | `INTERNAL_ERROR` | Log + alert |
