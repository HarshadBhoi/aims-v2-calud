# Testing Strategy

> Cross-stack testing philosophy: what kinds of tests, in what proportion, at what cost, with what target confidence. The testing *policy* that frontend/backend/infra test docs inherit from.

---

## 1. The Testing Pyramid, Honestly

Purist pyramids (80/15/5 unit/integration/E2E) are misleading for modern apps with strong types + contract boundaries. Our actual distribution, by **dollar-value of bug-catching**:

```
                   ┌──────────────┐
                   │  E2E / Smoke │  ~5%    Rare, expensive, catches the
                   │  (Playwright)│         multi-service workflow bugs
                   └──────────────┘
                 ┌──────────────────┐
                 │  Contract Tests  │  ~5%   API ↔ UI contract (tRPC auto
                 │  (schema + RTL)  │        gives us a lot; this catches drift)
                 └──────────────────┘
              ┌────────────────────────┐
              │  Integration Tests     │  ~25%   DB ↔ Service ↔ Procedure
              │  (Vitest + Testcontainers)│     Catches wiring + query bugs
              └────────────────────────┘
          ┌──────────────────────────────┐
          │   Component Tests (frontend) │  ~20%  UI state × interaction
          │   (Vitest + RTL + MSW)       │        Catches render + a11y bugs
          └──────────────────────────────┘
      ┌────────────────────────────────────┐
          │     Unit Tests                 │  ~40%  Pure logic, utils, schemas,
          │     (Vitest)                   │        dynamic-form engine, permissions
          └────────────────────────────────┘
    ┌────────────────────────────────────────┐
    │   Static + Types + Lint (continuous)   │   continuous   TypeScript strict,
    │   ESLint, TS strict, Zod, tfsec, ZAP   │                ESLint, Semgrep,
    └────────────────────────────────────────┘                lint-quality wins a lot
```

The pyramid shape matters less than the ratio of **bugs caught** to **test maintenance cost**. TypeScript strict + Zod dramatically reduce the need for "did my function handle null?" unit tests.

---

## 2. Types of Tests We Write

| Type | Purpose | Runner | Lives in |
|------|---------|--------|----------|
| **Static analysis** | TypeScript errors, lint violations, cyclic deps | `tsc`, ESLint, Semgrep | CI |
| **Unit** | Pure function correctness | Vitest | Next to source |
| **Component (frontend)** | UI render + interaction behavior | Vitest + Testing Library + MSW | Next to component |
| **Integration (backend)** | Service + DB + procedure wired together | Vitest + Testcontainers + Prisma | `apps/api/test/integration/` |
| **Contract** | API contract matches consumer assumptions | Vitest + Zod + tRPC | `packages/validation/test/` + per-app |
| **E2E** | User-facing workflows across services | Playwright | `e2e/` |
| **Visual regression** | UI pixel diffs | Chromatic or Playwright snapshots | Storybook / `e2e/` |
| **Accessibility** | WCAG 2.1 AA violations | axe-core in Vitest + Playwright | Alongside component + E2E tests |
| **Performance** | Load/soak/spike tests | k6 | `load-tests/` |
| **Security** | SAST/DAST/dep vuln | Semgrep, CodeQL, Snyk, ZAP | CI + scheduled |
| **Chaos** | System resilience under failure injection | Chaos Mesh, custom | staging only |
| **Migration / data** | DB migration safety + correctness | Vitest + real DB | With each migration |
| **Smoke (post-deploy)** | "Is prod actually serving?" | Playwright | Post-deploy step |

---

## 3. What We Test vs What We Skip

### We test
- All business logic (finding workflows, approval chains, pack-driven forms, RLS scoping)
- Every Zod schema (edge cases of required/optional/coerce)
- Every API procedure (happy path + main error paths)
- Every custom hook with non-trivial logic
- UI state transitions + form submission flows
- Critical user workflows end-to-end (login, create engagement, approve finding, generate report)
- Migrations (safety + correctness)
- Infrastructure changes (tfsec, integration tests in dev)

### We skip
- Trivial getters/setters
- Third-party library internals (trust React, Prisma, Zod)
- Generated code (tRPC client, Prisma client)
- Pure styling (visual regression covers it separately)
- Boilerplate: `layout.tsx`, `loading.tsx`, `error.tsx` templates
- One-line components that render exactly what they're told
- CLI scripts run once (migration scripts that are also their own tests)
- Exhaustive enumeration of `any` branch when the logic is `switch(enum)` — compiler ensures coverage

### We are explicit about "not tested"
A function marked `/* @untested */` with justification is legitimate for:
- Code that can only be tested in production (actual 3rd-party integration)
- Prototypes / experiments not on the customer path
- Throwaway migration code that self-verifies

`@untested` shows up in linter reports; we review quarterly.

---

## 4. Coverage Targets (Not Goals, Guardrails)

Coverage is a symptom, not a goal. Still, it's a useful guardrail. Per module:

| Module | Lines | Branches | Notes |
|--------|-------|----------|-------|
| `packages/validation` | > 95% | > 90% | Schema edge cases easy to test |
| `apps/api/src/services/` | > 85% | > 80% | Business logic |
| `apps/api/src/trpc/` | > 90% | > 85% | Procedure correctness critical |
| `apps/web/components/app/` | > 80% | > 75% | Domain components |
| `apps/web/components/ui/` | > 70% | — | Shadcn-derived; test behavior, not styling |
| `apps/web/lib/` | > 90% | > 85% | Pure utilities |
| `packages/standard-packs` | > 95% | — | Data, not code — tested via schema |
| Overall | > 80% | > 75% | |

Coverage **thresholds are enforced in CI** — dropping below on a PR fails the build. Coverage **going up is not celebrated** — high coverage of trivial code is no achievement.

---

## 5. Test Cost Management

Tests have a cost: authoring time, maintenance when code changes, CI wall time, flakiness risk. We budget explicitly.

### Time budgets (local + CI)
| Phase | Budget | Regression response |
|-------|--------|---------------------|
| Pre-commit hooks | < 30 s | Refactor hook; move work to CI |
| Local test watch (affected) | < 5 s feedback | Profile + optimize slowest tests |
| Full local `pnpm test` | < 2 min | Parallelize; find N² loops in tests |
| CI lint + typecheck | < 3 min | Cache; reduce scope |
| CI unit + component | < 6 min | Shard |
| CI build + bundle | < 5 min | Cache |
| CI E2E smoke | < 5 min | Reduce scope; move to nightly |
| **CI total (PR)** | **< 12 min** | **Hard ceiling** |

### Flaky tests: zero tolerance
- Flaky test = red flag, not a nuisance
- Retry-on-failure in CI is limited to **known-flaky** tests (whitelisted with bug link + owner)
- Retry count max 1; >1 = block-list until fixed
- Quarterly review: top-5 flakiest tests either fixed or deleted

### The "too expensive to maintain" test
If a test has been updated > 3 times in a quarter without finding a bug, ask:
- Is it testing behavior or implementation?
- Is the underlying code changing for a good reason?
- Would we write this test today?

If "no" to the last — delete it. Tests are not sacred.

---

## 6. Test Data Strategy

### Factories everywhere
Every domain entity has a factory in `test/factories/` — deterministic, override-able, Faker-based:

```ts
export const engagementFactory = {
  build: (overrides: Partial<Engagement> = {}): Engagement => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    type: "PERFORMANCE",
    status: "IN_PROGRESS",
    standardPackId: "gagas-2024",
    fiscalYear: 2026,
    createdAt: faker.date.recent(),
    _can: { edit: true, delete: true, approve: false },
    ...overrides,
  }),
  buildList: (n: number, overrides = {}) =>
    Array.from({ length: n }, () => engagementFactory.build(overrides)),
};
```

Factories compose: `findingFactory` accepts an optional `engagement` to link up properly.

### Fixtures for integration + E2E
- `packages/fixtures/` contains seed data used by dev, preview, and integration tests
- One "canonical tenant" fixture with realistic cross-entity relationships
- Fixtures versioned; breaking changes to fixture shape require co-updated tests

### No real customer data in tests
Ever. See `devops/ENVIRONMENTS.md §5`.

### Deterministic randomness
```ts
import { faker } from "@faker-js/faker";
faker.seed(12345);   // same output every run
```

---

## 7. Test Isolation

### Every test is independent
- No shared mutable state between tests
- `beforeEach` resets state; `afterEach` cleans up
- No test order dependence (CI randomizes order periodically to catch order-dependence)

### Parallelism
- Vitest runs tests in parallel by default (per file, multi-process)
- Integration tests: each gets its own Postgres schema (or Testcontainers instance)
- E2E tests: each gets its own tenant (or per-test-file tenant with serial tests inside)

### Time + randomness
- Freeze time with `vi.setSystemTime(new Date("2026-04-19T14:30:00Z"))` where time matters
- Deterministic IDs via `vi.spyOn(crypto, "randomUUID").mockReturnValue("...")` — only where the ID value is asserted
- Never rely on "now" or random in assertions

---

## 8. Integration Tests — Real Database

Unit tests with mocked Prisma give false confidence. We use **Testcontainers** for real-DB integration tests:

```ts
// apps/api/test/setup.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer;
export let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = container.getConnectionUri();

  // Run migrations against the freshly-started DB.
  await execAsync("pnpm prisma migrate deploy");

  prisma = new PrismaClient();
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});

afterEach(async () => {
  // Fast cleanup: truncate all tenant-scoped tables.
  await prisma.$executeRaw`TRUNCATE engagement, finding, ... CASCADE`;
});
```

Every PR runs integration tests. ~60s startup, but startup amortized across all tests in the file.

### When real DB > mocked
- Query correctness (joins, groupings, subqueries)
- Transaction semantics
- RLS policy correctness (critical for multi-tenant)
- Migration compatibility
- Index usage (query planner stable in tests)

### When mocked Prisma is fine
- Pure service logic tests where DB behavior is tangential
- Error path testing (inject a `P2002` unique violation without creating real duplicate)
- Happy path testing of layers above the repository

---

## 9. Consumer-Driven Contract Testing

Full detail in `CONTRACT-TESTING.md`. Summary:

Since we own both client + server + share Zod schemas via `packages/validation/`, **the contract is the Zod schema**. We:

1. Type-check both sides against the schema — TS compiler is the first contract test
2. Runtime-validate at the API boundary — Zod parses all inputs
3. Snapshot schema versions in `schema-snapshots/` — any breaking change requires explicit version bump + RFC
4. Consumer tests: frontend has integration tests that hit a real API (staging) nightly, verifying contracts

---

## 10. E2E Test Discipline

E2E tests are expensive to maintain. Scope them:

### What E2E catches
- User workflows across services (login → engagement → finding → approval → report)
- Session + auth + permission propagation
- Cross-service race conditions
- Real browser quirks (Safari vs Chrome)
- Post-deploy sanity ("is this thing actually working right now?")

### What E2E does NOT catch
- Every edge case — too expensive at E2E level
- Validation logic — that's a unit test
- Rendering of every UI state — that's a component test

### E2E test catalog (~50 scenarios)
Roughly partitioned:
- 15× authentication / session (login, MFA, SSO, logout, session expiry)
- 20× core audit workflows (engagement CRUD, finding CRUD, approval chain, report generation)
- 8× admin / configuration (tenant admin, user mgmt, role assignments)
- 5× cross-cutting (i18n, theme, a11y, mobile, keyboard-only)
- 2× data export / GDPR
- Catalog reviewed quarterly — prune or update to match real user journeys

---

## 11. Test Naming

Test names describe behavior, not implementation:

```ts
// ✅ Behavior
it("rejects an engagement submission when title is empty");
it("notifies approvers after submission");
it("returns 403 when a staff auditor attempts to approve");

// ❌ Implementation
it("calls handleSubmit with empty title");
it("invokes notifyApprovers");
it("checks isAdmin before approving");
```

### Structure: `describe` = noun; `it` = verb phrase
```ts
describe("Engagement creation", () => {
  it("creates an engagement with required fields", ...);
  it("rejects an engagement without a title", ...);
  it("assigns the creator as lead auditor by default", ...);
});
```

Naming conventions enforced in review, not lint (too much variation in valid English).

---

## 12. Writing Tests — The Three-Act Structure

Every test is:

```ts
it("reassigns a finding to a new auditor", async () => {
  // ARRANGE — set up the world
  const { engagement, finding, oldAuditor, newAuditor } = await setupFindingScenario();

  // ACT — the one thing under test
  const result = await trpc.finding.reassign.mutate({
    findingId: finding.id,
    toUserId: newAuditor.id,
  });

  // ASSERT — verify the expected effect
  expect(result.assignedTo.id).toBe(newAuditor.id);
  expect(await getAuditLogEntries(finding.id)).toContainEqual(
    expect.objectContaining({ action: "REASSIGNED", from: oldAuditor.id, to: newAuditor.id })
  );
});
```

One act per test. Multiple assertions OK if they all verify the same act's effect. Multi-step tests → split them.

---

## 13. Mocking Discipline

### Mock external systems, not our own code
- External: 3rd-party APIs (Stripe, SendGrid, OpenAI), email sends, file uploads to S3
- Our own: never mock our services from other services; use real or testcontainer

### MSW (Mock Service Worker) for HTTP
- Used in component/unit tests to mock tRPC/HTTP responses
- Same handlers usable in dev (`pnpm dev:mock`) — reduces handler drift
- Handlers in `test/mocks/handlers.ts`; override per test when needed

### Fakes over mocks
A "fake" is a simpler working implementation (in-memory queue, in-memory cache). A "mock" is a function spy that returns fixed values. We prefer fakes — they catch more bugs and are less brittle.

### What never to mock
- `Date.now()` without `vi.setSystemTime` (use official API)
- Console — suppress via test setup instead
- `fetch` — use MSW
- Random — seed Faker instead

---

## 14. Testing Asynchronous Code

### Always await
`await` every async operation in tests. Unhandled promises in tests are silent failures.

```ts
// ✅
await expect(trpc.finding.create.mutate(input)).rejects.toThrow("Forbidden");

// ❌
expect(trpc.finding.create.mutate(input)).rejects.toThrow("Forbidden");   // will pass even if the promise resolves
```

### Wait, don't sleep
```ts
// ✅
await vi.waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());

// ❌
await new Promise((r) => setTimeout(r, 1000));  // flaky + slow
```

### Promises with explicit ordering
For races and coordination, use Deferred/`p-defer`:
```ts
const pending = pDefer();
someAsync().then(pending.resolve);
// ... do stuff ...
await pending.promise;
```

---

## 15. Property-Based Testing (fast-check)

For functions with large input domains (parsers, sort, encode/decode), property tests catch what examples miss:

```ts
import fc from "fast-check";

test("findingIdCodec round-trips arbitrary UUIDs", () => {
  fc.assert(
    fc.property(fc.uuid(), (uuid) => {
      const encoded = encode(uuid);
      const decoded = decode(encoded);
      expect(decoded).toBe(uuid);
    }),
    { numRuns: 1000 }
  );
});
```

Used where applicable; not everywhere.

---

## 16. Snapshot Tests — Sparingly

Snapshots are acceptable for:
- Stable, tightly-controlled output (generated PDF table of contents, CLI help text)
- Schema JSON output where we want explicit diff on any change
- Large but stable HTML (email templates)

Snapshots are banned for:
- Component render trees (brittle; use explicit `getByRole` assertions)
- Large API response bodies (tests property of interest, not all)

Every snapshot update is reviewed: "did the change in snapshot reflect intended behavior?"

---

## 17. Migrations Are Tests Too

Every migration in `database/migrations/` has:
- **Forward test**: apply migration, schema looks as expected
- **Backward test** (for reversible migrations): rollback works
- **Data migration test**: if data transform included, asserts values transformed correctly
- **Concurrency test** (for Concurrent indexes): simulates concurrent writes during migration

Migrations shipped without tests are not merged.

---

## 18. Performance Tests ≠ Perf Gates

Performance testing (`PERFORMANCE-TESTING.md`) is **not** a regression gate for every PR (too slow + noisy). It runs:
- Nightly on `main` — regressions reported
- Before each release — gates deploy
- On perf-sensitive PRs (`perf:` prefix) — author-triggered

Performance **budgets** (bundle size, Lighthouse score) DO run on every PR — those are cheap.

---

## 19. Security Tests (Summary)

Full detail in `SECURITY-TESTING.md`. Summary:
- **SAST** (Semgrep, CodeQL) — every PR
- **SCA** (Snyk, Dependabot, pnpm audit) — every PR
- **Secrets scan** (gitleaks) — every PR
- **DAST** (OWASP ZAP) — weekly against staging
- **Pen test** (external firm) — annually + per major release
- **Bug bounty** (Phase 3) — continuous

---

## 20. Testing in Review

Reviewers check:
- [ ] New or changed behavior has tests at appropriate level
- [ ] Tests name behavior, not implementation
- [ ] No `.skip` or `.only` committed
- [ ] No increase in flaky tests
- [ ] Coverage didn't regress
- [ ] Integration tests exercise the DB where relevant
- [ ] Accessibility tests for new UI
- [ ] E2E updated only when workflow shape changed

`REVIEW.md` has the full checklist.

---

## 21. When We Waive Testing

Legitimate exceptions, with justification in PR:
- Truly experimental prototypes on explicit feature flag, tagged `experimental`
- Hotfix where delay costs more than untested risk (rare; postmortem required)
- Generated code (regenerated from canonical source; source is tested)

**Not legitimate**:
- "We'll add tests later" (we won't)
- "It's a small change" (small changes break things)
- "The reviewer said it's OK" (reviewers don't waive standards)

---

## 22. Related Documents

- `BACKEND-TESTING.md` — NestJS + Prisma + tRPC patterns
- `CONTRACT-TESTING.md` — API contract + schema evolution
- `PERFORMANCE-TESTING.md` — k6, load, soak
- `SECURITY-TESTING.md` — SAST/DAST/pentest/bounty
- `QUALITY-GATES.md` — what must pass to merge
- `../frontend/TESTING.md` — frontend-specific test runners + patterns
- `../devops/CI-CD.md` — where these tests execute in pipelines
