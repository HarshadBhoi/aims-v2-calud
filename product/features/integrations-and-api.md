# Integrations and Public API

> External interfaces: REST API for third-party integrators, HMAC-signed webhooks for event delivery, SCIM for identity, CSV imports, star-schema warehouse export for BI, developer portal. Enables AIMS to bridge with customers' existing systems. Per ADR-0007, API versioning is hybrid URL-major + dated-header-minor.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 15
**Primary personas**: Jin (external API integrator), Sofia (tenant admin configuring integrations), Customer success
**MVP phase**: 1.0 for REST API + webhooks + API keys + CSV imports + warehouse export; SAML + SCIM → 1.5; OAuth2 client credentials → v2.1

---

## 1. Feature overview

Customers don't live only in AIMS. They have Workday, Snowflake, Power BI, their own data warehouses. AIMS must bridge cleanly with these systems. MVP 1.0 ships:

- **Public REST API** (`/v1/*`) per ADR-0007 hybrid versioning
- **OpenAPI 3.1 spec + developer portal**
- **Webhook delivery** (HMAC-signed, Stripe-style; transactional outbox per ADR-0004)
- **API key management** per tenant
- **CSV imports** (engagements, findings, staff, CPE) for migration
- **Star-schema warehouse export** for customer BI consumption
- **Rate limiting** per API key

MVP 1.5 adds SAML SSO + full SCIM 2.0. v2.1 adds OAuth2 client credentials. v2.2+ adds Sentry / Datadog per-tenant observability forwarding.

---

## 2. User stories — REST API

### 2.1 US-API-001 — Jin reads engagement data via REST

```gherkin
GIVEN Jin has API key from Oakfield tenant (scoped: read engagements)
WHEN Jin issues:
  GET /v1/engagements?status=active&page=1
  Authorization: Bearer <api-key>
  Api-Version: 2027-01-15
THEN response:
  - 200 OK
  - JSON body: list of engagements (page 1)
  - Pagination metadata
  - Api-Version response header echoing the version
  - Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

**Acceptance criteria**:
- API follows REST conventions + OpenAPI 3.1 spec
- URL-major versioning `/v1/` per ADR-0007
- Header-minor versioning `Api-Version: YYYY-MM-DD`
- Response shape stable per dated version (per ADR-0007 compatibility shim)
- Rate limiting per API key per endpoint category

### 2.2 US-API-002 — Jin creates a finding via REST

```gherkin
GIVEN Jin's API key has write scope: findings
WHEN Jin POSTs to /v1/engagements/{id}/findings with finding content
THEN response: 201 Created with finding object
  AND Idempotency-Key header honored (duplicate POSTs return same response)
  AND audit log captures API origin
```

**Acceptance criteria**:
- Same Zod validation as UI-originating writes (per shared `packages/validation/`)
- Idempotency keys supported
- Error responses structured per API conventions
- Permission checks identical to UI (API key's role scope enforced)

### 2.3 US-API-003 — Developer portal access

```gherkin
GIVEN Jin wants to understand AIMS's API
WHEN Jin visits developer.aims.io (or `trust.aims.io/developers`)
THEN he sees:
  - OpenAPI 3.1 spec (per dated version)
  - Interactive API explorer (Swagger UI / Redoc)
  - Sandbox endpoints
  - Webhook event catalog
  - Rate limit docs
  - Migration guides (old vs. new dated versions)
  - Changelog
```

**Acceptance criteria**:
- Developer portal fully public (no login required for docs)
- Sandbox tenant available for testing (with synthetic data)
- OpenAPI 3.1 auto-generated from Zod schemas

---

## 3. User stories — Webhooks

### 3.1 US-API-004 — Sofia configures webhook endpoint

```gherkin
GIVEN Sofia wants AIMS events in her own system
WHEN Sofia opens Tenant Settings → Webhooks
  AND adds endpoint URL
  AND selects events: finding.issued, report.issued, cap.verified
  AND receives HMAC signing secret (shown once)
  AND confirms
THEN webhook registered
WHEN matching event fires
THEN AIMS delivers POST to her endpoint with:
  - JSON body with event data
  - HMAC-SHA256 signature header (X-AIMS-Signature)
  - Event ID header
  - Idempotency key for consumer dedup
  - Timestamp header
  AND retry on delivery failure per backoff schedule
  AND DLQ after max attempts
```

**Acceptance criteria**:
- Stripe-style HMAC signing for integrity verification
- Retry schedule: 1m, 5m, 15m, 1h, 6h, 24h (6 attempts)
- DLQ accessible to Sofia for manual re-drive
- Event types documented in developer portal

### 3.2 US-API-005 — Webhook event catalog

Documented event types per MVP 1.0:
- `engagement.*` (created, updated, pack attached/detached, phase transitioned, archived)
- `finding.*` (created, submitted, approved, issued, amended)
- `report.*` (submitted, approved, issued, amended)
- `cap.*` (drafted, approved, verified, overdue, abandoned)
- `pbc.*` (request.sent, response.received, document.accepted)
- `user.*` (invited, activated, deactivated)
- `plan.*` (submitted, approved, amended)

Each event has a versioned payload schema.

---

## 4. User stories — CSV imports

### 4.1 US-API-006 — Priya imports engagements from competitor

```gherkin
GIVEN Priya migrating from TeamMate+
  AND she has a CSV of historical engagements
WHEN she opens Tenant Settings → Data Imports → Engagements
  AND uploads CSV
  AND maps columns (AIMS field ← customer column)
  AND previews first 10 rows
  AND confirms
THEN engagements imported in background job (per ADR-0004 worker)
  AND status visible in import dashboard
  AND errors per-row (if any) reported
  AND rollback available within 24 hours
```

**Acceptance criteria**:
- Template CSVs downloadable for each entity type
- Column mapping UI (customer's column → AIMS field)
- Validation before commit (dry-run)
- Background processing with progress
- Error reporting per row
- Rollback capability

### 4.2 US-API-007 — CSV imports for other entity types

Similar pattern for: findings, staff, CPE records, audit universe entities, annual plans.

### 4.3 US-API-008 — Scheduled imports (MVP 1.5)

Customers with periodic data (e.g., daily staff directory sync) can schedule recurring imports.

---

## 5. User stories — Warehouse export

### 5.1 US-API-009 — Sofia configures warehouse export via flat-file drop to S3

```gherkin
GIVEN Oakfield wants AIMS data in Snowflake for BI
WHEN Sofia configures Warehouse Export
  AND selects format: flat-file dump
  AND provides destination: S3 bucket (tenant-controlled)
  AND selects entities: engagements, findings, CAPs, staff, CPE
  AND schedules: nightly dump at 2 AM
  AND confirms
THEN export configured
  AND initial full export fires
  AND subsequent nightly full or delta dumps (tenant configurable)
  AND star schema produced in flat files (Parquet or CSV):
    - Fact files: finding_fact.parquet, engagement_fact.parquet, cap_fact.parquet
    - Dimension files: date_dim.parquet, pack_dim.parquet, user_dim.parquet, entity_dim.parquet
  AND written to customer's S3 bucket
  AND customer's data engineering team picks up from S3 (Fivetran, Airbyte, custom pipeline, Snowflake Snowpipe, etc.)
```

**Acceptance criteria — scope correction**:

**MVP 1.0 does NOT ship native connectors to Snowflake, BigQuery, Redshift, Databricks with real-time CDC.** That was over-ambitious in the original spec. Maintaining four native warehouse connectors with reliable CDC is an entire startup's worth of engineering — it's exactly why companies like Fivetran and Airbyte exist.

**MVP 1.0 ships instead**:

- **REST API** (already specified in §2) — customers can query any entity programmatically; most mature data-engineering pipelines handle this pattern well
- **Nightly flat-file dump to customer's S3 bucket**:
  - Star-schema organized (fact + dimension files)
  - Parquet format (preferred — compressed, typed, BI-tool-friendly) or CSV (for simpler consumers)
  - Full snapshot or delta dump (tenant configurable)
  - Tenant provides S3 bucket; AIMS authenticated via IAM role cross-account trust
  - Customer's data pipeline (Fivetran, Airbyte, AWS DMS, Snowflake Snowpipe, custom) loads from S3 into their warehouse
- **Power BI / Tableau / Looker templates** (MVP 1.5) that consume the star-schema flat files directly or after load into a warehouse
- **Schema documentation** — published schema spec for the star-schema dump; evolution handled via schema versioning

**What we don't ship**:
- Native Snowflake connector (Fivetran does this well; customers already use Fivetran)
- Real-time CDC (customers' data engineering teams handle this if they need it)
- Bespoke warehouse-specific ETL logic

**Rationale**: customers with warehouse needs have data-engineering teams that already solve the "get data from SaaS into warehouse" problem for dozens of other tools. Our job is to produce clean structured exports; their job is to land them. Respecting this boundary keeps our engineering focus on audit-specific differentiators rather than reinventing data integration.

- Tenant-isolated (export scoped per ADR-0002)
- Schema versioning: customer notified of schema changes with migration guide

### 5.2 US-API-010 — Power BI templates (MVP 1.5)

Pre-built Power BI templates that work with the star schema:
- Engagement progress dashboard
- Finding trends
- CAP compliance
- CPE compliance
- Custom data source supported

---

## 6. User stories — API key management

### 6.1 US-API-011 — Sofia creates API key for Jin

```gherkin
GIVEN Jin needs API access
WHEN Sofia opens Tenant Settings → API Keys → Create
  AND specifies:
    - Key name: "Jin Risk Intelligence Integration"
    - Scopes: read engagements, read findings, read reports
    - Expiration: 12 months (renewable)
  AND clicks Create
THEN API key generated (shown once, then hidden)
  AND Sofia copies and shares with Jin securely
  AND key appears in API Keys list (last 4 chars visible; never the full key)
```

**Acceptance criteria**:
- Scopes enforce permissions (read vs. write; entity types)
- Expiration required (no indefinite keys)
- Rotate-at-will supported
- Audit log for key creation, rotation, revocation

### 6.2 US-API-012 — OAuth2 client credentials (v2.1)

For B2B server-to-server OAuth 2.0 flow. Deferred per [`04-mvp-scope.md §4`](../04-mvp-scope.md).

---

## 7. User stories — Rate limiting

### 7.1 US-API-013 — Jin hits rate limit

```gherkin
GIVEN Jin's key has limit 1000 requests/hour
WHEN Jin exceeds
THEN HTTP 429 Too Many Requests
  AND Retry-After: <seconds>
  AND X-RateLimit-Reset: <timestamp>
  AND Jin can back off and retry
```

**Acceptance criteria**:
- Per-key rate limits (tenant-configurable, default 1000/hour)
- Endpoint-category limits (read 1000/hour, write 100/hour)
- 429 response with Retry-After
- Rate limit headers on all responses

---

## 8. Edge cases

### 8.1 Webhook endpoint down

Deliveries queue up; exponential backoff retries; after 6 failures → DLQ.

### 8.2 API key compromised

Sofia revokes; audit log shows usage before revocation.

### 8.3 Import failure mid-batch

Partial imports tracked; rollback reverts entire import.

### 8.4 Schema evolution on warehouse export

Schema changes propagate; customer BI scripts may break — changelog notifies.

---

## 9. Data model

- `ApiKey` — per-tenant
- `Webhook` — per-tenant subscription
- `WebhookDelivery` — per-attempt
- `CSVImport` — per-import batch
- `WarehouseExportConfig` — per-tenant destination
- `WarehouseExportSync` — per-sync run

---

## 10. API endpoints

```typescript
// For integrators — see /v1/* in OpenAPI spec

// For tenant admin
apiKey.create(input: APIKeyInput): APIKey (secret shown once)
apiKey.list(input: {}): APIKey[]
apiKey.rotate(input: {keyId}): APIKey
apiKey.revoke(input: {keyId}): void

webhook.create(input: WebhookInput): Webhook
webhook.list(input: {}): Webhook[]
webhook.testDelivery(input: {webhookId, sampleEvent}): DeliveryResult

csvImport.upload(input: UploadInput): ImportJob
csvImport.getStatus(input: {jobId}): ImportStatus
csvImport.rollback(input: {jobId}): void

warehouseExport.configure(input: ExportConfig): ExportConfig
warehouseExport.triggerSync(input: {configId}): SyncJob
warehouseExport.getSchema(input: {}): Schema
```

---

## 11. Permissions

| Role | Create API key | Configure webhook | Import CSV | Configure warehouse |
|---|---|---|---|---|
| Sofia (Tenant Admin) | ✅ | ✅ | ✅ | ✅ |
| Marcus (CAE) | ⚠️ (with Sofia's approval) | ⚠️ | ✅ | ❌ |
| Priya (AIC) | ❌ | ❌ | ✅ (engagement-scoped only) | ❌ |

---

## 12. Observability

- `api.request.count` / `.duration` (per endpoint, per API key)
- `api.rate_limit.exceeded.count`
- `webhook.delivery.count` / `.failure.count`
- `csv.import.count` / `.row_count`
- `warehouse.export.sync.count` / `.duration`

---

## 13. Performance

- API response p99 < 500ms (read); < 1s (write)
- Webhook delivery latency: median < 5s; p99 < 30s
- CSV import: 10K rows in < 5 minutes
- Warehouse sync: full tenant in < 1 hour

---

## 14. Compliance

- API authentication: OIDC + OAuth2 + API keys all support MFA at session level
- ALL writes via API audited per ADR audit log
- Data exports compliant with tenant's data-residency (per `docs/06 §4.8` regional silos)

---

## 15. Dependencies

- Public API surface (tRPC → REST) per `docs/04-architecture-tour.md`
- Webhook outbox dispatcher per ADR-0004
- Identity + auth (API key auth middleware)
- All feature modules (source of events + entities)

---

## 16. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 15
- [`references/adr/0007-api-versioning-hybrid.md`](../../references/adr/0007-api-versioning-hybrid.md)
- [`references/adr/0004-sqs-for-worker-queuing.md`](../../references/adr/0004-sqs-for-worker-queuing.md) — webhook outbox
- [`docs/06-design-decisions.md §3.9`](../../docs/06-design-decisions.md)

---

## 17. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§5.1 US-API-009 — warehouse export scope simplification**: reviewer correctly flagged that maintaining native CDC connectors to Snowflake + BigQuery + Redshift + Databricks is "an entire startup's worth of work (it's why Fivetran exists)." Fix: dropped native warehouse connectors. MVP 1.0 ships star-schema flat-file dump (Parquet preferred, CSV alternative) to customer's S3 bucket with tenant IAM role cross-account trust. Customer's data engineering team (or Fivetran/Airbyte/Snowpipe) loads from S3 into their warehouse. Focuses AIMS engineering on audit-specific differentiators rather than reinventing data-integration pipelines.

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
