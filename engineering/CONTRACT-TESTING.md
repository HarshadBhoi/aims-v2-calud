# Contract Testing

> The contract between client and server is the Zod schema shared via `packages/validation/`. We test that both sides honor it, evolve it safely, and catch consumer-visible breaks before release.

---

## 1. Why Contract Tests When We Own Both Sides?

Even when client and server are the same team, contract drift happens:
- Refactor changes a procedure's return shape; forget to update a consumer
- Rename a field on one side but not the other
- Add a required input field without realizing mobile client still ships old schema
- External integrators (webhooks, REST API consumers) depend on stable contract

**Contract tests prevent silent breaks across:**
- Frontend ↔ API (tRPC)
- Webhook consumers ↔ our event schemas
- External REST API ↔ OpenAPI spec
- SDK clients (Phase 2) ↔ typed bindings

TypeScript catches a lot. Runtime validation catches the rest.

---

## 2. The Contract Surface

| Contract | Source of truth | Enforcement |
|----------|-----------------|-------------|
| **tRPC procedures** | Zod schemas in `packages/validation/` | Compile-time (TS) + runtime (zod parse on server) |
| **REST API** | `api/rest/openapi.yaml` | Generated client + validator middleware |
| **Webhooks** | `api/webhooks/events.md` + Zod event schemas | HMAC-signed + schema validated |
| **Standard packs** | `data-model/standard-pack-schema.json` | JSON Schema validator on publish |
| **Event bus** (Phase 2) | AsyncAPI spec | Per-event schema validation |

Every contract lives in `packages/validation/` (or is extracted from there) — no duplication.

---

## 3. Layered Defense

### Layer 1: TypeScript (compile-time)
tRPC's end-to-end type inference means a frontend call to `trpc.engagement.create.mutate(...)` is typed against the server's Zod input schema. Rename a field → build breaks. Free.

### Layer 2: Zod runtime parse
Every tRPC input is `.parse()`-ed before handler runs. An untyped external caller sending garbage → rejected with structured `BAD_REQUEST`. Never an uncaught exception.

### Layer 3: Schema snapshot tests
We persist a JSON-Schema snapshot of every procedure's input + output. CI compares current vs snapshot; diffs require explicit version decision.

### Layer 4: Consumer-side tests
Frontend has tests that hit a mock server (MSW) returning schema-compliant data. Consumer asserts it can render / process every non-optional field.

### Layer 5: Nightly integration ping
Staging frontend runs a contract check against staging backend nightly — if schemas drift between deployed versions, alert.

---

## 4. Zod → JSON Schema Snapshots

```ts
// scripts/generate-schema-snapshot.ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { appRouter } from "@/trpc/root-router";
import fs from "node:fs/promises";

const procedures = appRouter._def.procedures;
const snapshot: Record<string, { input: unknown; output: unknown }> = {};

for (const [path, def] of Object.entries(procedures)) {
  snapshot[path] = {
    input:  def._def.inputs[0] ? zodToJsonSchema(def._def.inputs[0]) : null,
    output: def._def.output   ? zodToJsonSchema(def._def.output)   : null,
  };
}

await fs.writeFile(
  "packages/validation/schema-snapshots/latest.json",
  JSON.stringify(snapshot, null, 2)
);
```

### CI snapshot check
```bash
pnpm schema:generate
git diff --exit-code packages/validation/schema-snapshots/latest.json || {
  echo "Contract changed. Either:"
  echo " - Update snapshot if the change is intentional + safe"
  echo " - Split the change into a safe migration (expand-contract)"
  exit 1
}
```

Any schema change forces the author to explicitly update the snapshot file, which reviewers can diff.

---

## 5. Semantic Versioning of Contracts

### Breaking vs non-breaking

| Change | Breaking? | Migration required |
|--------|-----------|---------------------|
| Add optional input field | No | None |
| Add required input field without default | **Yes** | Bump + deprecation window |
| Add field to output | No | None |
| Remove output field | **Yes** | Bump + deprecation window |
| Rename field | **Yes** | Use alias temporarily; phase old name |
| Narrow input type (`string` → `string.email()`) | **Yes** | Bump + validation soft-fail window |
| Widen input type (`literal("A")` → `enum(["A","B"])`) | No | None |
| Remove procedure | **Yes** | Deprecate first |
| Add procedure | No | None |
| Change default value | **Yes** | Document; likely bump |
| Change error code for existing error | **Yes** | Bump; clients may switch on codes |

### Bumping the contract
When a breaking change is unavoidable:

1. Introduce new version alongside old (`engagement.createV2` alongside `engagement.create`)
2. Deprecate old with `@deprecated` JSDoc + header in response
3. Metrics track old-version usage; contact known consumers
4. Remove old after deprecation window:
   - Internal (frontend-only): 2 sprints
   - External (REST / webhook consumers): 6 months notice

**We never hot-swap a breaking change** without this dance. Exception: vulnerabilities — emergency breaking changes with immediate consumer notification.

---

## 6. Consumer-Side Contract Tests (Frontend)

Frontend tests that specifically protect against contract drift:

```ts
// apps/web/contract-tests/engagement-list.contract.test.ts
import { describe, it, expect } from "vitest";
import { trpc } from "@/lib/trpc/client";
import { TestProviders } from "@/test/test-providers";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "@/test/setup";
import { http, HttpResponse } from "msw";
import snapshot from "@validation/schema-snapshots/latest.json";
import Ajv from "ajv";

const ajv = new Ajv({ strict: false });

describe("Contract: engagement.list", () => {
  it("our consumer code works with the documented contract", async () => {
    // Build a fixture that matches the SNAPSHOT output schema.
    const outputSchema = snapshot["engagement.list"].output;
    const valid = ajv.validate(outputSchema, FIXTURE_ENGAGEMENT_LIST);
    expect(valid).toBe(true);

    // Mock MSW to return that fixture.
    server.use(http.get("/api/trpc/engagement.list", () =>
      HttpResponse.json({ result: { data: FIXTURE_ENGAGEMENT_LIST } })
    ));

    const { result } = renderHook(() => trpc.engagement.list.useQuery({}), {
      wrapper: TestProviders,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Assert consumer reads every field we claim to read.
    expect(result.current.data?.items[0].title).toBeDefined();
    expect(result.current.data?.items[0].status).toBeDefined();
    // ... all fields the UI actually uses
  });
});
```

If the server schema changes, the snapshot changes, the fixture validates against new schema, and the test still passes — iff the consumer is updated to match.

---

## 7. Provider-Side Contract Tests (API)

API has tests that parse a canonical output **against** the snapshot, ensuring the implementation matches what the schema promises:

```ts
// apps/api/contract-tests/engagement-list.contract.test.ts
import { makeCaller } from "@/test/setup/trpc-caller";
import snapshot from "@validation/schema-snapshots/latest.json";
import Ajv from "ajv";

const ajv = new Ajv({ strict: false });

it("engagement.list output conforms to the snapshot schema", async () => {
  const { tenant } = await setupTenantWithEngagements(prisma, 3);
  const caller = makeCaller({ tenantId: tenant.id, roles: ["Director"] });

  const result = await caller.engagement.list({});

  const validate = ajv.compile(snapshot["engagement.list"].output);
  const isValid = validate(result);
  if (!isValid) {
    console.error(validate.errors);
    expect.fail("Output does not conform to contract schema");
  }
});
```

Runs in CI. If code changes break the contract output, this fails fast.

---

## 8. OpenAPI Contract Tests (External REST API)

REST endpoints are a public contract — external tenants integrate. We test from both sides:

### Server-side: response matches OpenAPI
- OpenAPI middleware (e.g., `express-openapi-validator` or NestJS equivalent) validates every response at runtime in `staging` and `dev`, logging drift
- In test env, it throws — contract violations are test failures

### Client-side: generate + type-check SDK
```bash
pnpm openapi-typescript api/rest/openapi.yaml -o packages/sdk/src/types.ts
```

Regenerated on every OpenAPI change; CI fails if `packages/sdk` doesn't build.

### Schemathesis (Phase 2)
Property-based API testing tool consumes OpenAPI → generates thousands of requests per endpoint → asserts responses match schema. Catches edge cases the test suite missed. Nightly job, not per-PR.

---

## 9. Webhook Contract Testing

We emit webhooks for external consumers (Stripe-style). Each event has a Zod schema:

```ts
// packages/validation/src/webhooks/engagement-created.ts
export const engagementCreatedEventSchema = z.object({
  event: z.literal("engagement.created"),
  id:    z.string().regex(/^evt_/),
  created_at: z.string().datetime(),
  data: z.object({
    id: z.string(),
    title: z.string(),
    tenant_id: z.string(),
    created_by: z.string(),
  }),
});
export type EngagementCreatedEvent = z.infer<typeof engagementCreatedEventSchema>;
```

### Tests
- Every emitter test parses the emitted event through the schema — crashes if drift
- Sample payloads in `api/webhooks/examples/` — published to customer docs
- Contract snapshot covers every event schema — same CI check

### Consumer contract (for us as consumer of external webhooks: Stripe, etc.)
- We validate incoming Stripe webhooks against `stripe-node`'s types
- Sample payloads captured from Stripe test mode → tests replay them
- Stripe version pinned (`apiVersion: "2025-01-15"`); upgrades are explicit PRs

---

## 10. Pact / Pact Broker (Phase 2)

Pact is a consumer-driven contract testing framework. We defer until:
- We ship public SDKs for multiple languages (Python, Java)
- We integrate with 3rd-party partners who need us to honor a contract
- We have multiple independently-deployed services (microservices)

Until then, snapshot + schema tests give most of the value with less overhead.

---

## 11. Schema Evolution — The Expand → Migrate → Contract Pattern

Mirrors `CI-CD.md §6` for databases but applied to contracts:

### Phase 1: Expand
- Add new fields as optional
- Add new procedures alongside old
- Dual-write/read: server accepts both old and new shape

### Phase 2: Migrate
- Client updated to use new fields/procedures
- Dashboards track consumers on old shape
- Deprecation warnings logged when old used
- External-facing: publish deprecation notice

### Phase 3: Contract
- Remove old fields/procedures once metrics show no usage
- Snapshot updated to reflect new-only
- Migration complete

**Hard rule**: never combine phases. Three PRs. Always.

---

## 12. Standard Pack Contract

Standard packs (`data-model/standard-pack-schema.json`) are a contract between AIMS and pack authors (including tenants who write custom packs).

### Enforcement
- Every published pack runs through JSON Schema validator on ingestion
- Invalid packs rejected at upload with actionable error messages
- Schema versioned; packs declare which schema version they target
- Migration utility to upgrade old-version packs to current schema

### Testing (pack authors' side)
Pack authors get:
- VS Code schema association for autocomplete + validation
- CLI: `aims pack validate ./my-pack.json` → same validation as server
- Test fixtures: `aims pack test ./my-pack.json` spins up dynamic-form engine locally and renders every finding element

---

## 13. GraphQL (Not Used)

We chose tRPC over GraphQL. Had we used GraphQL, contract testing would instead lean on:
- `graphql-schema-linter` for breaking changes
- Apollo schema registry + checks

tRPC gives us equivalent via snapshots + TypeScript. Noted for posterity if we ever revisit.

---

## 14. Backward Compatibility Testing

For REST + webhooks (external), we test N-1 and N-2 versions remain serviceable:

```ts
describe("Backward compat: v1.0.x REST API", () => {
  it("accepts legacy POST /engagements shape (no standardPackId)", async () => {
    const resp = await fetch(`${baseUrl}/engagements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "API-Version": "1.0" },
      body: JSON.stringify({ title: "Legacy shape", fiscalYear: 2026 }),
    });
    expect(resp.status).toBe(201);
    // Server should assign default pack when omitted in v1.0.
  });
});
```

Defaults and fallbacks documented in the deprecation plan. Removed only when external consumers have migrated (confirmed by metrics).

---

## 15. API Response Stability

Beyond structural contract: **behavior** stability. Tests lock in:

- Specific error codes for specific errors (e.g., duplicate finding → `CONFLICT`, not `BAD_REQUEST`)
- Pagination semantics (cursor opaque but stable; page-size defaults)
- Ordering defaults (e.g., `engagement.list` sorted by `createdAt DESC` by default)
- Null vs missing semantics (JSON: `null` is explicit; `undefined` means field omitted — our convention: omit optionals)

Consumers rely on these. Tests document them.

---

## 16. Error Contract

Errors are part of the contract. Every error has:
- **`code`** — stable machine-readable identifier (`ENGAGEMENT_LOCKED`, not `error_42`)
- **`httpStatus`** — for REST mapping
- **`message`** — human-readable; can change between versions
- **`details`** — structured; stable keys

Codes are enumerated in `api/ERRORS.md`. Tests assert codes; messages only loosely checked.

```ts
await expect(caller.engagement.update({ id, ... })).rejects.toMatchObject({
  code: "CONFLICT",
  data: { cause: "ENGAGEMENT_LOCKED" },
});
```

New error codes added with same "expand-contract" discipline as schemas.

---

## 17. Developer Experience

Contract tests should be helpful, not a wall:

- Failing contract test prints **what changed** in human-readable form ("Field `engagement.severity` added to output — is this intentional?")
- Snapshot diff uses semantic formatting (not raw JSON diff)
- CLI helper: `pnpm contract:update engagement.list` regenerates just that procedure's snapshot with confirmation
- `CHANGELOG.md` entry required for every snapshot diff in prod-visible procedures

---

## 18. What We Don't Do

- ❌ Hand-written API docs separate from the schema
- ❌ Silent drift (config allowing responses to not match schema in prod)
- ❌ "We'll update consumers when it breaks" — deprecation windows, no exceptions
- ❌ Shared TypeScript types imported everywhere without a Zod schema (TS-only = no runtime validation)
- ❌ Breaking change + immediate delete ("consumer was internal, I fixed it") — same discipline regardless

---

## 19. Related Documents

- `TESTING-STRATEGY.md` — where contract tests fit
- `BACKEND-TESTING.md` — server-side snapshot conformance
- `../frontend/STATE-AND-DATA.md` — consumer perspective
- `../api/CONVENTIONS.md` — procedure naming + error codes
- `../api/ERRORS.md` — error code catalog
- `../api/rest/openapi.yaml` — REST contract
- `../api/webhooks/events.md` — webhook contract
- `../data-model/standard-pack-schema.json` — pack contract
