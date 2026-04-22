# AIMS v2 REST API

> Public REST API for third-party integrations, Zapier, Power BI, custom scripts.

---

## Overview

The REST API is our **external contract** for customer integrations. Key differences from internal tRPC:

| Aspect | tRPC (Internal) | REST (External) |
|--------|----------------|-----------------|
| Consumer | First-party frontend | Third-party integrations |
| Versioning | Coupled with frontend | Versioned via URL path |
| Documentation | Inferred from code | OpenAPI 3.1 spec |
| Transport | HTTP + SuperJSON | HTTP + standard JSON |
| Date format | Serialized as `Date` | ISO 8601 strings |
| Auth | Session cookie OR Bearer | API Key (Bearer) |
| Rate limits | Per user | Per API Key (stricter) |
| Stability | Internal (can change) | Public contract (stable) |

---

## Base URL

```
https://api.aims.example.com/v1
```

- EU tenants: `https://eu-api.aims.example.com/v1`
- India tenants: `https://in-api.aims.example.com/v1`

---

## Authentication

API requests use **Bearer tokens** (API keys):

```http
Authorization: Bearer aims_sk_live_01HXKZT3BY9WQZQGEVJGAXF4K...
```

### Key Types
- `aims_sk_live_...` — Secret key (full access)
- `aims_pk_live_...` — Public/publishable key (read-only, rarely used for audit data)
- `aims_sk_test_...` — Test mode key (sandbox tenant only)

### Key Lifecycle
- Created by tenant admins at `/admin/api-keys`
- Scoped: permissions can be restricted per-key (e.g., read-only, specific tenants)
- Rotatable: old key deactivates immediately; new key issued
- Auditable: every API call logged with key ID

### Scopes (Permissions Per Key)
When creating an API key, tenant admin selects scopes:
- `engagements:read`, `engagements:write`
- `findings:read`, `findings:write`, `findings:issue`
- `reports:read`, `reports:generate`
- `workpapers:read`, `workpapers:upload`
- `users:read`, `users:manage`
- `admin:*` (tenant admin capabilities)

---

## Conventions

### Endpoint Pattern
```
GET    /v1/{resource}              → List (cursor-paginated)
GET    /v1/{resource}/{id}         → Get by ID
POST   /v1/{resource}              → Create
PATCH  /v1/{resource}/{id}         → Update (partial)
DELETE /v1/{resource}/{id}         → Soft delete
POST   /v1/{resource}/{id}/action  → Custom actions (submit, approve, issue, etc.)
```

### Resource URIs
Resources use **kebab-case** plural names:
- `/v1/engagements`
- `/v1/findings`
- `/v1/corrective-actions`
- `/v1/standard-packs`

### Examples

```http
GET /v1/engagements?status=PLANNING,FIELDWORK&limit=50

GET /v1/engagements/cjld2cjxh0000qzrmn831i7rn

POST /v1/engagements
Content-Type: application/json
Idempotency-Key: 01JXKZT3BY9WQZQGEVJGAXF4K

{
  "title": "Q1 Operational Audit",
  "engagementType": "PERFORMANCE_AUDIT",
  "primaryPack": { "code": "GAGAS", "version": "2024" },
  ...
}

PATCH /v1/engagements/cjld2cjxh0000qzrmn831i7rn
Content-Type: application/json
If-Match: "5"                     ← Optimistic concurrency via ETag

{ "title": "Q1 Operational Audit - Revised" }

POST /v1/engagements/cjld2cjxh0000qzrmn831i7rn/issue
Content-Type: application/json

{
  "confirmAllChecklistsComplete": true,
  "confirmAllFindingsApproved": true,
  "issuanceNotes": "Approved by Director"
}
```

---

## Pagination

### Request
```
GET /v1/engagements?limit=50&cursor=eyJpZCI6ImM...
```

### Response
```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6ImN...",
    "hasMore": true,
    "totalCount": 427
  }
}
```

### Cursor Format
- Base64-encoded, opaque to clients
- Returned `nextCursor` → pass back as `cursor` param

---

## Filtering

Filters are query parameters. Multiple values comma-separated:
```
GET /v1/findings?status=DRAFT,UNDER_REVIEW&riskRating=CRITICAL,HIGH&engagementId=cjld...
```

Date ranges use `createdAt[gte]` and `createdAt[lte]`:
```
GET /v1/findings?createdAt[gte]=2026-01-01&createdAt[lte]=2026-12-31
```

Full-text search:
```
GET /v1/findings?search=segregation+of+duties
```

---

## Sorting

```
GET /v1/engagements?sort=createdAt:desc
GET /v1/engagements?sort=title:asc
```

Default sort is `createdAt:desc`.

---

## Versioning Policy

### Path-Based Versioning
- `/v1/engagements` — current stable
- `/v2/engagements` — when introduced, both v1 and v2 run in parallel

### Stability Commitment
- **v1** supported for at least **12 months** after v2 released
- **Deprecation header** added 6 months before sunset:
  ```
  Deprecation: true
  Sunset: Wed, 01 Jan 2027 00:00:00 GMT
  Link: </v2/engagements>; rel="successor-version"
  ```

### Non-Breaking Changes (no version bump)
- New optional query parameters
- New response fields
- New endpoints
- New enum values (clients must ignore unknown values gracefully)
- Additional headers

### Breaking Changes (require version bump)
- Removing fields
- Renaming fields
- Changing field types
- Removing enum values
- Changing validation rules that would reject previously-valid input

---

## Idempotency

All `POST`, `PUT`, `PATCH` endpoints accept `Idempotency-Key` header:

```http
POST /v1/engagements
Idempotency-Key: 01HXKZT3BY9WQZQGEVJGAXF4K
```

- Key format: ULID (26 chars) or UUID v4
- Scope: per API key
- TTL: 24 hours
- Repeat same request with same key → original response

See `/api/CONVENTIONS.md` for details.

---

## Optimistic Concurrency

Updates use HTTP **ETags** (alternative to request body `version` field):

```http
GET /v1/engagements/cjld...
→ 200 OK
  ETag: "5"
  ...

PATCH /v1/engagements/cjld...
  If-Match: "5"                    ← Send ETag from previous GET
  ...
→ 200 OK if version matches, 412 Precondition Failed if not
```

---

## Rate Limits

### Default Limits
| Plan | Requests/min | Daily limit |
|------|--------------|-------------|
| Free | 60 | 10,000 |
| Professional | 300 | 100,000 |
| Enterprise | Custom | Custom |

### Response Headers
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1713559289
Retry-After: 42                   (only on 429)
```

### Per-Endpoint Limits
Expensive operations are further limited:
- `POST /v1/reports/{id}/generate-pdf` → 5/min
- `POST /v1/exports` → 3/min
- Upload endpoints → 10/min

---

## Error Responses

See `/api/ERRORS.md` for full taxonomy.

Standard error format:
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Record has been modified",
    "details": {
      "currentVersion": 5,
      "attemptedVersion": 3
    },
    "request_id": "01JXKZT3BY9WQZQGEVJGAXF4K"
  }
}
```

---

## Webhooks

Instead of polling, subscribe to events. See `/api/webhooks/events.md`.

Quick example:
```json
POST /v1/webhooks
{
  "url": "https://yourapp.example.com/aims-webhooks",
  "events": ["finding.issued", "cap.overdue", "report.published"],
  "secret": "whsec_..."
}
```

Your endpoint receives:
```json
{
  "id": "evt_01HXKZT3BY9...",
  "type": "finding.issued",
  "tenant_id": "...",
  "occurred_at": "2026-04-19T10:32:11Z",
  "data": { ... finding payload ... }
}
```
With signature header: `X-AIMS-Signature: t=...,v1=...`

---

## SDKs (Planned)

Official SDKs for popular languages:

| Language | Package | Status |
|----------|---------|--------|
| JavaScript/TypeScript | `@aims/sdk` | Planned |
| Python | `aims-sdk` | Planned |
| Go | `github.com/aims/sdk-go` | Planned |
| Ruby | `aims` gem | Planned |

Auto-generated from OpenAPI spec using Fern or openapi-generator.

---

## Testing (Sandbox)

- Test mode keys: `aims_sk_test_*`
- Test mode tenant: separate database, data isolated from production
- Rate limits: identical to production
- No real emails/webhooks sent (configurable)

---

## Implementation Status

- [x] OpenAPI 3.1 skeleton (`openapi.yaml`)
- [x] Core endpoints documented (engagements, findings, approvals, packs)
- [ ] Full endpoint coverage (all resources from Prisma schema)
- [ ] Auto-generated SDKs
- [ ] Interactive API explorer (Redoc/Swagger UI)
- [ ] Postman collection
- [ ] Integration tests

See `openapi.yaml` for the current spec.
