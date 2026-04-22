# Backend Testing

> NestJS + Prisma + tRPC testing patterns. Unit tests for pure logic, integration tests against real Postgres (Testcontainers), procedure tests via the tRPC server caller.

---

## 1. Test Layout

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── engagement/
│   │   │   ├── engagement.service.ts
│   │   │   ├── engagement.service.test.ts       ← unit (pure logic)
│   │   │   ├── engagement.router.ts
│   │   │   └── engagement.router.test.ts        ← procedure tests (integration)
│   │   └── finding/ ...
│   └── common/
│       ├── rls.ts
│       └── rls.test.ts
└── test/
    ├── setup/
    │   ├── testcontainer.ts          ← Starts Postgres container
    │   ├── db.ts                     ← Prisma client + truncate helpers
    │   ├── trpc-caller.ts            ← Creates an isolated tRPC caller per test
    │   ├── session.ts                ← Fake session + tenant context
    │   └── fixtures.ts               ← Seed canonical test data
    ├── factories/
    │   ├── engagement.ts
    │   ├── finding.ts
    │   └── user.ts
    ├── integration/                  ← Cross-module integration
    │   ├── approval-workflow.test.ts
    │   └── rls-enforcement.test.ts
    └── helpers/
        ├── logs.ts                   ← Log-spy helpers
        └── time.ts                   ← Freeze + advance clock
```

---

## 2. Unit Tests — Services + Pure Logic

Services are constructor-injected (NestJS) — trivial to instantiate with fakes in unit tests:

```ts
// engagement.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngagementService } from "./engagement.service";
import { engagementFactory } from "@/test/factories/engagement";

describe("EngagementService.canTransition", () => {
  let service: EngagementService;
  let repo: any;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    service = new EngagementService(repo, /* other deps mocked */ {} as any);
  });

  it("allows DRAFT → IN_PROGRESS transition", async () => {
    const e = engagementFactory.build({ status: "DRAFT" });
    expect(service.canTransition(e, "IN_PROGRESS")).toBe(true);
  });

  it("rejects DRAFT → ISSUED directly (must go through approval)", async () => {
    const e = engagementFactory.build({ status: "DRAFT" });
    expect(service.canTransition(e, "ISSUED")).toBe(false);
  });

  it("rejects any transition out of CLOSED", async () => {
    const e = engagementFactory.build({ status: "CLOSED" });
    for (const target of ["DRAFT","IN_PROGRESS","ISSUED"] as const) {
      expect(service.canTransition(e, target)).toBe(false);
    }
  });
});
```

**Rules:**
- Unit tests never touch DB, queue, HTTP
- Every service constructor dep mocked / faked
- One behavior per test; multiple assertions OK if they verify the same behavior

---

## 3. Integration Tests — Real Postgres via Testcontainers

The critical backend test. Verifies actual SQL, transactions, constraints, RLS.

### Test setup (one-time per test file)

```ts
// apps/api/test/setup/testcontainer.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

export async function startTestDb() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_DB: "aims_test" })
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  // Apply migrations against the fresh DB.
  execSync(`pnpm prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  prisma = new PrismaClient({ datasourceUrl: url });
  return { prisma, container };
}

export async function stopTestDb() {
  await prisma.$disconnect();
  await container.stop();
}

// Fast per-test cleanup: one TRUNCATE covers tenant-scoped tables.
export async function truncateAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      engagement, finding, recommendation, corrective_action,
      report, approval, audit_event, user_tenant_membership,
      standard_pack_assignment
    RESTART IDENTITY CASCADE
  `);
}

export { prisma };
```

```ts
// apps/api/vitest.setup.ts
import { beforeAll, afterAll, afterEach } from "vitest";
import { startTestDb, stopTestDb, truncateAll } from "./test/setup/testcontainer";

beforeAll(async () => {
  await startTestDb();
}, 120_000);          // first-time Docker pull can take a while

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await truncateAll();
});
```

### Why Testcontainers over SQLite/mocks
- **Real PostgreSQL** — tests check Prisma generates correct SQL + RDS behaviors (UNIQUE, FK, RLS, triggers)
- **Version-matched** — `postgres:16-alpine` matches prod major version
- **Isolation** — each CI job gets its own container
- **Speed** — startup ~3–5s amortized across all tests in file (vs ~60s for a full DB provision)

### Parallelism
Vitest runs test files in parallel (multiple workers). Each worker gets its own container — no shared-DB flakiness. Set `poolOptions.threads.maxThreads = 4` to bound resource usage.

---

## 4. Procedure Tests — tRPC Server Caller

Procedure tests exercise a procedure with realistic auth + tenant + DB. They're integration tests that validate the HTTP surface.

### Helper: creating a caller per test

```ts
// apps/api/test/setup/trpc-caller.ts
import { createCallerFactory } from "@/trpc/trpc";
import { appRouter } from "@/trpc/root-router";
import type { Session } from "@/auth/session";
import { prisma } from "./testcontainer";

type MakeCallerInput = {
  userId?: string;
  tenantId: string;
  roles?: string[];
  session?: Partial<Session>;
};

const factory = createCallerFactory(appRouter);

export function makeCaller(input: MakeCallerInput) {
  const ctx = {
    prisma,
    session: {
      userId: input.userId ?? "usr_test",
      tenantId: input.tenantId,
      roles: input.roles ?? ["StaffAuditor"],
      ...input.session,
    },
    traceId: "test-trace",
    // ...additional context pieces the real request would carry
  };
  return factory(ctx);
}
```

### Example procedure test

```ts
// engagement.router.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/test/setup/testcontainer";
import { makeCaller } from "@/test/setup/trpc-caller";
import { userFactory } from "@/test/factories/user";
import { tenantFactory } from "@/test/factories/tenant";

describe("engagement.create", () => {
  let tenant: Awaited<ReturnType<typeof tenantFactory.persist>>;
  let director: Awaited<ReturnType<typeof userFactory.persist>>;

  beforeEach(async () => {
    tenant = await tenantFactory.persist(prisma);
    director = await userFactory.persist(prisma, { tenantId: tenant.id, roles: ["Director"] });
  });

  it("creates an engagement with valid input", async () => {
    const caller = makeCaller({ userId: director.id, tenantId: tenant.id, roles: ["Director"] });

    const result = await caller.engagement.create({
      title: "FY26 IT Audit",
      type: "PERFORMANCE",
      standardPackId: "gagas-2024",
      fiscalYear: 2026,
    });

    expect(result).toMatchObject({
      id: expect.stringMatching(/^eng_/),
      title: "FY26 IT Audit",
      status: "DRAFT",
      tenantId: tenant.id,
    });
    // RLS scoping sanity: directly query DB, should find exactly this engagement.
    const row = await prisma.engagement.findUnique({ where: { id: result.id } });
    expect(row?.tenantId).toBe(tenant.id);
  });

  it("rejects create when user lacks Director role", async () => {
    const caller = makeCaller({ userId: director.id, tenantId: tenant.id, roles: ["StaffAuditor"] });

    await expect(
      caller.engagement.create({
        title: "Unauthorized",
        type: "PERFORMANCE",
        standardPackId: "gagas-2024",
        fiscalYear: 2026,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns ZodError for invalid input", async () => {
    const caller = makeCaller({ userId: director.id, tenantId: tenant.id, roles: ["Director"] });
    await expect(caller.engagement.create({ title: "" } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("auto-assigns creator as lead auditor", async () => {
    const caller = makeCaller({ userId: director.id, tenantId: tenant.id, roles: ["Director"] });
    const eng = await caller.engagement.create({
      title: "FY26 IT Audit",
      type: "PERFORMANCE",
      standardPackId: "gagas-2024",
      fiscalYear: 2026,
    });
    const team = await prisma.engagementTeam.findMany({ where: { engagementId: eng.id } });
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ userId: director.id, role: "Lead" });
  });
});
```

---

## 5. Testing RLS (Row-Level Security)

RLS is our primary tenant boundary. Tests must verify it from multiple angles.

### Pattern: direct Prisma calls with tenant context
```ts
// rls-enforcement.test.ts
import { makeCallerWithRls } from "@/test/setup/trpc-caller";

describe("RLS — tenant isolation", () => {
  it("tenant A cannot read tenant B's engagements", async () => {
    const tenantA = await tenantFactory.persist(prisma);
    const tenantB = await tenantFactory.persist(prisma);
    const eA = await engagementFactory.persist(prisma, { tenantId: tenantA.id });
    const eB = await engagementFactory.persist(prisma, { tenantId: tenantB.id });

    const callerA = makeCaller({ tenantId: tenantA.id, roles: ["Director"] });
    const list = await callerA.engagement.list({});

    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(eA.id);
    // tenantB's engagement not visible
  });

  it("direct getById with tenant B id from tenant A → NOT_FOUND", async () => {
    const tenantA = await tenantFactory.persist(prisma);
    const tenantB = await tenantFactory.persist(prisma);
    const eB = await engagementFactory.persist(prisma, { tenantId: tenantB.id });

    const callerA = makeCaller({ tenantId: tenantA.id, roles: ["Director"] });
    await expect(callerA.engagement.getById({ id: eB.id }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    // NOT "FORBIDDEN" — RLS makes the row invisible, indistinguishable from missing.
  });
});
```

### Pattern: raw SQL tests — make sure RLS policy is actually installed
```ts
it("RLS is enabled on engagement table", async () => {
  const rows = await prisma.$queryRaw<{ rowsecurity: boolean }[]>`
    SELECT relrowsecurity AS rowsecurity
    FROM pg_class
    WHERE relname = 'engagement'
  `;
  expect(rows[0].rowsecurity).toBe(true);
});
```

---

## 6. Testing Immutability + Audit Log Triggers

Database `database/functions/audit-log-triggers.sql` + `immutability-checks.sql` have their own tests.

```ts
describe("Audit log — hash chain", () => {
  it("every mutation emits an audit_event with valid hash chain", async () => {
    const tenant = await tenantFactory.persist(prisma);
    const e = await engagementFactory.persist(prisma, { tenantId: tenant.id });

    await prisma.engagement.update({
      where: { id: e.id },
      data: { title: "Updated" },
    });

    const events = await prisma.auditEvent.findMany({
      where: { entityId: e.id },
      orderBy: { createdAt: "asc" },
    });

    expect(events).toHaveLength(2);   // INSERT + UPDATE

    // Verify hash chain continuity.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].prevHash).toBe(events[i - 1].hash);
    }
  });
});
```

```ts
describe("Immutability — ISSUED findings", () => {
  it("rejects updates to ISSUED findings at DB level", async () => {
    const f = await findingFactory.persist(prisma, { status: "ISSUED", lockedAt: new Date() });
    await expect(
      prisma.finding.update({ where: { id: f.id }, data: { title: "Changed" } })
    ).rejects.toThrow(/locked_at/);
  });
});
```

---

## 7. Queue + Worker Testing (BullMQ)

Workers test in isolation + with real Redis.

### In-memory fake for unit tests
```ts
// test/setup/queue-fake.ts
export class FakeQueue {
  jobs: Array<{ name: string; data: any }> = [];
  async add(name: string, data: any) { this.jobs.push({ name, data }); return { id: "fake-1" }; }
}
```

### Real Redis for integration tests
Testcontainers' Redis module:
```ts
import { RedisContainer } from "@testcontainers/redis";
const redis = await new RedisContainer("redis:7-alpine").start();
process.env.REDIS_URL = redis.getConnectionUrl();
```

Worker processes jobs synchronously in tests via `worker.processJobs({ sync: true })` pattern, or tests assert queue state after enqueue.

### Example worker test
```ts
describe("PdfWorker.processReport", () => {
  it("generates PDF and stores to S3", async () => {
    const report = await reportFactory.persist(prisma, { status: "QUEUED" });
    const worker = new PdfWorker(prisma, fakeS3, fakePdfEngine);
    await worker.processReport({ reportId: report.id });

    expect(fakeS3.putObject).toHaveBeenCalledWith(
      expect.objectContaining({ Key: `reports/${report.id}.pdf` })
    );
    const updated = await prisma.report.findUnique({ where: { id: report.id } });
    expect(updated?.status).toBe("READY");
  });
});
```

---

## 8. Authentication & Authorization Tests

### Testing every permission path
Permission logic in `auth/PERMISSIONS.md` is central. Each procedure has a permission-matrix test:

```ts
describe("finding.approve — authorization matrix", () => {
  const roles = ["StaffAuditor", "SeniorAuditor", "Supervisor", "Director", "CAE", "QAReviewer"] as const;
  const shouldAllow: Record<typeof roles[number], boolean> = {
    StaffAuditor:  false,
    SeniorAuditor: false,
    Supervisor:    true,   // for findings in their engagement
    Director:      true,
    CAE:           true,
    QAReviewer:    false,
  };

  it.each(roles)("role %s → approve permission", async (role) => {
    const ctx = await setupApprovalScenario({ approverRole: role });
    const caller = makeCaller({ userId: ctx.approver.id, tenantId: ctx.tenant.id, roles: [role] });

    const promise = caller.finding.approve({ id: ctx.finding.id });

    if (shouldAllow[role]) {
      await expect(promise).resolves.toMatchObject({ status: "APPROVED" });
    } else {
      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
```

### Session edge cases
- Expired session → `UNAUTHORIZED`
- MFA required but not satisfied → `UNAUTHORIZED` with `code: MFA_REQUIRED`
- Revoked refresh token → `UNAUTHORIZED`
- Cross-tenant session token → `UNAUTHORIZED`

Each has a dedicated test (can't unit-test this cleanly; needs integration).

---

## 9. Error Handling Tests

Every expected error path has a test. Examples:

- Duplicate creation → `CONFLICT` with the right field in message
- Invalid input → `BAD_REQUEST` with zod-formatted issues
- Missing record → `NOT_FOUND`
- Stale optimistic-concurrency write → `CONFLICT` with `retry: true` flag
- External service down → `BAD_GATEWAY` (not 500)

Wrap 3rd-party calls in test-friendly retry/timeout patterns:
```ts
it("returns BAD_GATEWAY when Stripe times out", async () => {
  fakeStripe.customers.create.mockRejectedValue(new TimeoutError());
  await expect(caller.billing.createCustomer({...})).rejects.toMatchObject({ code: "BAD_GATEWAY" });
});
```

---

## 10. Transaction Tests

Prisma interactive transactions are tricky — test both success and rollback paths.

```ts
describe("finding.submitForApproval — transactional", () => {
  it("rolls back all writes if approval-chain creation fails", async () => {
    const f = await findingFactory.persist(prisma, { status: "DRAFT" });
    vi.spyOn(approvalChainService, "create").mockRejectedValueOnce(new Error("simulated"));

    await expect(caller.finding.submitForApproval({ id: f.id })).rejects.toThrow();

    const after = await prisma.finding.findUnique({ where: { id: f.id } });
    expect(after?.status).toBe("DRAFT");   // unchanged
    expect(await prisma.auditEvent.findMany({ where: { entityId: f.id, action: "SUBMIT" } })).toHaveLength(0);
  });
});
```

---

## 11. External Service Tests

### Strategy: fakes for integration, mocks at unit boundary

| External | Unit tests | Integration tests |
|----------|-----------|-------------------|
| Stripe | Mock `stripe.customers.create` | Fake Stripe-compatible in-memory impl |
| SendGrid | Mock `sgMail.send` | Fake that stores sent emails for inspection |
| S3 | Mock `s3.putObject` | MinIO container (S3-compatible) |
| OpenAI | Mock | Fake returning fixed responses |
| IdP (SAML/OIDC) | Mock token validate | Against test-IdP container |

### Fake S3 via MinIO
```ts
import { MinioContainer } from "@testcontainers/minio";
const minio = await new MinioContainer().start();
process.env.S3_ENDPOINT = minio.getConnectionUrl();
process.env.S3_ACCESS_KEY = minio.getAccessKey();
```

Real S3 SDK, test-grade S3 backend. Catches bucket-policy, signed-URL, multipart bugs.

---

## 12. Multi-Tenant Scenario Helpers

Reduce boilerplate across tests:

```ts
// test/helpers/scenarios.ts
export async function setupApprovalScenario(opts: {
  approverRole: Role;
  findingStatus?: FindingStatus;
}) {
  const tenant = await tenantFactory.persist(prisma);
  const author = await userFactory.persist(prisma, { tenantId: tenant.id, roles: ["StaffAuditor"] });
  const approver = await userFactory.persist(prisma, { tenantId: tenant.id, roles: [opts.approverRole] });
  const engagement = await engagementFactory.persist(prisma, {
    tenantId: tenant.id,
    teamMembers: [{ userId: author.id, role: "Auditor" }, { userId: approver.id, role: "Supervisor" }],
  });
  const finding = await findingFactory.persist(prisma, {
    tenantId: tenant.id,
    engagementId: engagement.id,
    createdBy: author.id,
    status: opts.findingStatus ?? "SUBMITTED",
  });
  return { tenant, author, approver, engagement, finding };
}
```

Tests that use this are 3 lines long; scenario is reusable + consistent.

---

## 13. Logging + Telemetry in Tests

### Never assert on log output
Logs are for humans; tests are brittle if they match strings. Instead:
- Assert on structured log **events** via a log-spy (wrapper around Pino `child` logger)
- Or assert on **metric counters** (`meter.getCounter("foo").valueOf()`)

```ts
it("increments finding-created counter", async () => {
  const before = metrics.counter("aims.findings.created.total").get();
  await caller.finding.create({...});
  const after = metrics.counter("aims.findings.created.total").get();
  expect(after - before).toBe(1);
});
```

### Silence noise
Default test setup sets log level to `error` — no info noise in test output. Tests that need to assert on warn/error do so via log-spy.

---

## 14. Flaky Test Mitigation

Backend tests can flake from:

- **Time**: freeze with `vi.setSystemTime`
- **Randomness**: Faker with fixed seed
- **Concurrency**: test concurrent writes with explicit ordering, not `setTimeout`
- **Container startup races**: use `waitStrategy` (Testcontainers)
- **DB cleanup races**: `afterEach` truncate must wait (awaited)
- **Redis shared state**: each test file gets its own Redis DB or flushes before

Any test known to be flaky is labeled `@flaky` with a bug link. CI quarantines it (runs but doesn't fail build) until fixed.

---

## 15. Test Performance Tips

- **Reuse containers** — Testcontainers per test-file, not per test
- **Truncate, don't drop + recreate** — 10× faster
- **Parallel files, serial within** — Vitest default
- **Lazy factory persistence** — `build()` for unit tests (in-memory), `persist()` for integration (DB hit)
- **`Promise.all` parallel setup** — when independent
- **Don't hit DB for assertions you can make from the tRPC response**

### CI time budget
Full backend test suite: **< 8 min in CI** on warm cache. If it grows, shard by module.

---

## 16. What NOT To Do

- ❌ Mock Prisma and call it "integration"
- ❌ `expect(logs).toContain("...")` — brittle
- ❌ Share state between tests (global `beforeAll` that persists a record, multiple tests rely on it)
- ❌ `setTimeout` for timing-sensitive tests — use deterministic clock + waitFor
- ❌ Test private methods via `(service as any).privateFn()` — test via public surface
- ❌ Keep `.only` or `.skip` in committed code — CI has a rule that blocks this
- ❌ Use real external APIs in PR tests (Stripe, SendGrid) — too slow, flaky, costs money
- ❌ One test that sets up 5 users, creates 3 engagements, then asserts 10 things — split it

---

## 17. Coverage Tooling

Vitest `--coverage` with `v8` (native, faster than `istanbul`):

```js
// vitest.config.ts
coverage: {
  provider: "v8",
  reporter: ["text", "html", "json-summary", "lcov"],
  exclude: [
    "**/*.test.ts",
    "**/*.d.ts",
    "**/node_modules/**",
    "**/dist/**",
    "**/migrations/**",                // DB migrations tested separately
    "**/generated/**",                  // Prisma client, tRPC client
  ],
  thresholds: {
    lines: 85,
    branches: 80,
    functions: 85,
    statements: 85,
  },
}
```

Codecov uploads from CI; PR comment shows diff coverage. No regression allowed.

---

## 18. Checklist — Before Merging Backend Change

- [ ] Unit tests for any new pure logic
- [ ] Integration tests for new procedure or service
- [ ] RLS test when touching multi-tenant schema
- [ ] Permission matrix test when changing authorization
- [ ] Migration test when adding migration
- [ ] Test names describe behavior
- [ ] No `.only` / `.skip` committed
- [ ] Coverage did not regress
- [ ] CI green on real-DB integration job

---

## 19. Related Documents

- `TESTING-STRATEGY.md` — cross-stack philosophy
- `CONTRACT-TESTING.md` — API contract testing
- `../api/` — tRPC router + procedure conventions
- `../database/` — schema + RLS + migrations
- `../frontend/TESTING.md` — frontend counterpart
