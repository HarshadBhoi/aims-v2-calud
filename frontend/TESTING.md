# Frontend Testing

> Testing pyramid: many unit tests, fewer component tests, minimal E2E — but E2E covers critical audit workflows end-to-end.

---

## 1. Testing Philosophy

### The Pyramid (Approximately)

```
        ╱ E2E ╲              ~50 scenarios — golden audit workflows
       ╱───────╲
      ╱Component╲             ~400 tests — one per significant component
     ╱───────────╲
    ╱   Unit     ╲            ~1500 tests — utilities, hooks, schemas, stores
```

### Core Principles
1. **Test behavior, not implementation** — prefer testing what users see and do over internal state
2. **No snapshot tests of large trees** — brittle, opaque, encourages blind "Update Snapshot"
3. **Test the integration boundary** — where most bugs hide (form + validation + mutation)
4. **Fast feedback** — unit + component tests run in < 30s locally. E2E < 10 min in CI
5. **No flaky tests allowed** — a flaky test is a broken test. Quarantine until fixed
6. **Tests are code** — refactor them, remove dead ones, treat them with the same discipline as prod code

### Coverage Targets (not goals, guardrails)
- Lines: > 80%
- Branches: > 75%
- Critical paths (auth, approvals, finding CRUD, pack engine): > 95%

Coverage is a lagging indicator — chase behavior coverage, not line numbers.

---

## 2. Tools

| Layer | Tool | Why |
|-------|------|-----|
| Unit + component | **Vitest** | Faster than Jest, native ESM + TS, compatible API |
| DOM + user interaction | **@testing-library/react** + `user-event` v14 | User-centric queries, accessibility-aware |
| Mocking tRPC / HTTP | **MSW** (Mock Service Worker) | Same mocks for unit + E2E; intercepts at network level |
| E2E | **Playwright** | Multi-browser, fast, great DX, trace viewer |
| Accessibility | **axe-core** via `@axe-core/playwright` + `jest-axe` | Automated WCAG checks |
| Visual regression | **Chromatic** or **Playwright snapshots** | Per-component + full-page (Phase 2) |
| Performance | **Lighthouse CI** | PR-level CWV regression detection |
| Mutation | Skipped (optional) | Stryker if we invest — not Phase 1 |

---

## 3. Unit Tests

### What to Unit Test
- **Utility functions** (`formatters.ts`, `hash.ts`, `parse.ts`)
- **Zod schemas** (`packages/validation/`)
- **Zustand stores** (state transitions)
- **Custom hooks** with isolated logic (not data-fetching — those are component tests)
- **Dynamic form schema builder** (`buildDynamicSchema`)
- **Conditional field evaluator** (`evaluateConditional`)
- **Permission resolvers** client-side

### Example — Utility

```ts
// lib/formatters.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./formatters";

describe("formatCurrency", () => {
  it("formats USD with two decimals", () => {
    expect(formatCurrency(1234.5, "USD", "en-US")).toBe("$1,234.50");
  });
  it("formats EUR for de-DE", () => {
    expect(formatCurrency(1234.5, "EUR", "de-DE")).toBe("1.234,50 €");
  });
  it("handles zero", () => {
    expect(formatCurrency(0, "USD", "en-US")).toBe("$0.00");
  });
  it("handles negative", () => {
    expect(formatCurrency(-10, "USD", "en-US")).toBe("-$10.00");
  });
});
```

### Example — Zod Schema

```ts
import { findingCreateSchema } from "@validation/finding";

describe("findingCreateSchema", () => {
  it("rejects missing title", () => {
    const r = findingCreateSchema.safeParse({ severity: "HIGH" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["title"]);
  });
  it("accepts valid minimal payload", () => {
    const r = findingCreateSchema.safeParse({
      title: "Weak controls", severity: "HIGH", engagementId: "uuid",
    });
    expect(r.success).toBe(true);
  });
});
```

### Example — Zustand Store

```ts
import { useUIStore } from "./ui-store";

describe("UIStore", () => {
  beforeEach(() => useUIStore.setState({ sidebarCollapsed: false }));

  it("toggles sidebar", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });
  it("persists recent engagements, max 10", () => {
    const { addRecentEngagement } = useUIStore.getState();
    for (let i = 0; i < 12; i++) addRecentEngagement(`e-${i}`);
    expect(useUIStore.getState().recentEngagements).toHaveLength(10);
    expect(useUIStore.getState().recentEngagements[0]).toBe("e-11");
  });
});
```

---

## 4. Component Tests

### What to Test
- **Component renders correctly** with various prop combinations
- **User interactions** produce expected behavior
- **Accessibility** — query via `getByRole`, `getByLabelText` (implicit a11y check)
- **Conditional rendering** — loading, error, empty, success states
- **Form submission** — fill, submit, mutation called with right payload

### What NOT to Test
- Implementation details (internal state, exact HTML structure)
- Third-party library behavior (we trust Radix)
- Styling (that's for visual regression)
- Static content (no test for "Heading says 'Hello'")

### Pattern — Component Test Setup

```tsx
// components/app/engagement-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EngagementCard } from "./engagement-card";
import { TestProviders } from "@/test/test-providers";

function renderCard(props = {}) {
  const engagement = {
    id: "eng-1", title: "FY26 IT Audit", status: "IN_PROGRESS",
    _can: { edit: true, delete: false }, ...props,
  };
  return render(<EngagementCard engagement={engagement} />, { wrapper: TestProviders });
}

describe("EngagementCard", () => {
  it("renders title and status badge", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: /FY26 IT Audit/i })).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });
  it("shows Edit action when user has permission", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });
  it("hides Edit action without permission", () => {
    renderCard({ _can: { edit: false, delete: false } });
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
  it("navigates on card click", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("article"));
    expect(mockRouter.push).toHaveBeenCalledWith("/engagements/eng-1");
  });
});
```

### TestProviders Wrapper
Wraps component in all providers (theme, tRPC, QueryClient, next-intl, router):

```tsx
// test/test-providers.tsx
export function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <TRPCProvider client={testTrpcClient}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider messages={testMessages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </TRPCProvider>
  );
}
```

### Query Priority (Testing Library)
Queries in preference order (accessibility-aligned):
1. `getByRole` (button, heading, textbox, link)
2. `getByLabelText` (form fields)
3. `getByPlaceholderText` (fallback for inputs)
4. `getByText` (visible text)
5. `getByTestId` (last resort — implementation detail)

**Never use `container.querySelector`** — breaks on a11y-friendly refactors.

### Testing Forms

```tsx
it("submits form with valid data", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<EngagementForm onSubmit={onSubmit} />, { wrapper: TestProviders });

  await user.type(screen.getByLabelText(/title/i), "FY26 IT Audit");
  await user.selectOptions(screen.getByLabelText(/type/i), "PERFORMANCE");
  await user.click(screen.getByRole("button", { name: /create/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: "FY26 IT Audit", type: "PERFORMANCE",
    }));
  });
});

it("shows validation error on empty title", async () => {
  const user = userEvent.setup();
  render(<EngagementForm onSubmit={vi.fn()} />, { wrapper: TestProviders });
  await user.click(screen.getByRole("button", { name: /create/i }));
  expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
});
```

### Testing React Query Hooks
Use MSW to mock network, render hook in `TestProviders`:

```ts
it("fetches engagement list", async () => {
  server.use(http.get("/api/trpc/engagement.list", () =>
    HttpResponse.json({ result: { data: [{ id: "e-1", title: "FY26" }] } })
  ));
  const { result } = renderHook(() => trpc.engagement.list.useQuery({}), {
    wrapper: TestProviders,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(1);
});
```

---

## 5. Dynamic Form Engine Tests (Critical!)

The dynamic form engine is the most reusable, highest-risk component. Test extensively:

```tsx
describe("DynamicFormEngine", () => {
  it("renders fields from GAGAS finding elements", () => {
    const fields = gagasPack.findingElements;
    render(<DynamicFormEngine fields={fields} onSubmit={vi.fn()} />, { wrapper: TestProviders });
    expect(screen.getByLabelText(/criteria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/condition/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cause/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/effect/i)).toBeInTheDocument();
  });

  it("renders 5 elements for IIA GIAS finding", () => {
    const fields = iiaGiasPack.findingElements;
    render(<DynamicFormEngine fields={fields} onSubmit={vi.fn()} />, { wrapper: TestProviders });
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DynamicFormEngine fields={[
      { code: "criteria", label: "Criteria", type: "rich-text", required: true },
    ]} onSubmit={onSubmit} />, { wrapper: TestProviders });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/criteria is required/i)).toBeInTheDocument();
  });

  it("shows conditional fields based on other field values", async () => {
    const user = userEvent.setup();
    render(<DynamicFormEngine fields={[
      { code: "hasImpact", type: "switch", label: "Has impact" },
      { code: "details", type: "rich-text", label: "Details",
        conditional: { field: "hasImpact", op: "eq", value: true } },
    ]} onSubmit={vi.fn()} />, { wrapper: TestProviders });

    expect(screen.queryByLabelText(/details/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/has impact/i));
    expect(await screen.findByLabelText(/details/i)).toBeInTheDocument();
  });
});
```

---

## 6. MSW — Mocking tRPC / Fetch

### Setup

```ts
// test/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/trpc/engagement.list", () => HttpResponse.json({
    result: { data: { items: [/* ... */], totalCount: 3 } }
  })),

  http.post("/api/trpc/engagement.create", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      result: { data: { id: "new-id", ...body.input } }
    });
  }),
];

// test/setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";
export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override per Test
```ts
it("handles 403", async () => {
  server.use(http.get("/api/trpc/engagement.list", () =>
    HttpResponse.json({ error: { httpStatus: 403, message: "Forbidden" } }, { status: 403 })
  ));
  // ... test that UI shows permission error
});
```

### Same Handlers for E2E (Dev Mocks)
MSW handlers double as dev mocks when backend is unavailable — run `pnpm dev:mock` to start frontend with mocked API. One source of truth for mock data.

---

## 7. Accessibility Testing

### Unit / Component — `jest-axe`
```ts
import { axe } from "jest-axe";
import { toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

it("has no a11y violations", async () => {
  const { container } = render(<EngagementCard engagement={mock} />, { wrapper: TestProviders });
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

Run on every significant component. Test passes only with zero violations.

### E2E — `@axe-core/playwright`
```ts
import AxeBuilder from "@axe-core/playwright";

test("dashboard is accessible", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

Run on every key page in E2E suite.

---

## 8. End-to-End Tests (Playwright)

### Scope
~50 E2E scenarios covering **critical audit workflows**. Not exhaustive — focused on flows that span multiple pages and would be expensive to catch in production.

### Priority List

| Workflow | Why |
|----------|-----|
| Login + MFA | Entry point; auth regression catastrophic |
| Create engagement (wizard) | Most common action |
| Add finding with 4-element GAGAS form | Core audit workflow |
| Add finding with 5-element IIA GIAS form | Pack-driven form must work across standards |
| Approve finding through full chain | Approval logic complex |
| Generate PDF report | Multi-step; previous pain point |
| Upload work paper with drag-drop | File upload has failed modes |
| Bulk reassign findings | Bulk ops hard to test at unit level |
| Switch tenant (multi-tenant user) | RLS boundary verification |
| Invite user + accept invite | Two sessions, two users |
| Password reset full flow | Email → reset → login |
| Standard pack switch on engagement | Pack changes propagate correctly |
| Keyboard-only full engagement creation | A11y end-to-end |
| Mobile finding review (read-only) | Responsive verification |
| Dark mode full workflow | Theme system |
| Localization (fr-FR login + engagement) | i18n end-to-end |

### Structure

```ts
// e2e/engagement-create.spec.ts
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Engagement creation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "director@acme.test");
  });

  test("creates a performance engagement via wizard", async ({ page }) => {
    await page.goto("/engagements");
    await page.getByRole("button", { name: "New engagement" }).click();

    await page.getByLabel("Title").fill("FY26 IT General Controls Audit");
    await page.getByLabel("Type").selectOption("PERFORMANCE");
    await page.getByLabel("Standard pack").selectOption({ label: "GAGAS 2024" });
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2 — scope
    await page.getByLabel("Objectives").fill("Evaluate effectiveness of ITGCs");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3 — team
    await page.getByLabel("Lead auditor").fill("Alice");
    await page.getByRole("option", { name: "Alice Admin" }).click();
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page).toHaveURL(/\/engagements\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "FY26 IT General Controls Audit" })).toBeVisible();
  });
});
```

### Playwright Configuration
- Run against Chromium, Firefox, WebKit (smoke on all, full on Chromium)
- Parallel workers (CPU count)
- Retry failed tests once in CI
- Traces on failure (auto-opened in GitHub Actions UI)
- Video on failure
- Screenshot on failure

### Test Data
- Each E2E run seeds a fresh tenant via API or fixtures
- Tests tear down their own data (or use isolated tenants)
- Never rely on persistent state between tests
- Fixtures in `e2e/fixtures/` — reusable sample engagements, findings, users

### Auth in E2E
```ts
// helpers/auth.ts — reuse session across tests in same worker
export async function loginAs(page: Page, email: string) {
  await page.context().storageState({ path: `.auth/${email}.json` });
}
```

Storage state captured once per user role, reused across tests — avoids repeating login ceremony.

---

## 9. Visual Regression (Phase 2)

### Per-Component (Chromatic)
Storybook stories captured as baseline images. PR shows pixel diffs on any UI change. Reviewer approves or blocks.

### Full-Page (Playwright)
```ts
test("engagement list visual", async ({ page }) => {
  await page.goto("/engagements");
  await expect(page).toHaveScreenshot("engagement-list.png", {
    maxDiffPixels: 100,
  });
});
```

Captures in light + dark + mobile viewport. Snapshot updates require explicit review.

### When to Skip
- Content that changes legitimately (timestamps, user names) — mask via `page.locator().screenshot({ mask: [...] })`
- Animations — wait for `prefers-reduced-motion` or disable via test config
- Charts with random data — seed deterministic values

---

## 10. Performance Testing — Lighthouse CI

### Config

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000",
        "http://localhost:3000/engagements",
        "http://localhost:3000/findings",
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
```

Runs against PR preview deployment. Fails PR if any route regresses below threshold.

---

## 11. Bundle Size Tests

CI step fails if any route bundle exceeds budget:

```js
// scripts/check-bundles.js
const budgets = require("./bundle-budgets.json");
const stats = require("../.next/build-manifest.json");

for (const [route, budget] of Object.entries(budgets)) {
  const size = computeRouteSize(stats, route);
  if (size > budget) {
    console.error(`${route}: ${size}KB > ${budget}KB`);
    process.exit(1);
  }
}
```

Updated whenever intentional bundle growth is justified (new feature + owner approval).

---

## 12. CI Pipeline

### On Every PR
1. `pnpm typecheck` — TypeScript strict, zero errors
2. `pnpm lint` — ESLint zero errors, warnings OK locally but not in strict mode
3. `pnpm test` — Vitest unit + component, fail on first regression
4. `pnpm test:a11y` — axe-core pass
5. `pnpm build` — production build must succeed
6. `pnpm check:bundles` — bundle budgets
7. `pnpm test:e2e:smoke` — 5-minute smoke subset of E2E
8. `lhci autorun` — Lighthouse CI

### Nightly
1. Full E2E suite (all ~50 scenarios × 3 browsers)
2. Full visual regression
3. Full Lighthouse on all routes
4. Dependency vulnerability scan (`pnpm audit`, Snyk)

### Pre-Release
1. Manual accessibility pass (NVDA/VoiceOver on key flows)
2. Manual localization spot-check (fr-FR, de-DE)
3. Load test (k6 against API — out of scope for this doc)

---

## 13. Test File Layout

```
apps/web/
├── components/
│   └── app/
│       ├── engagement-card.tsx
│       └── engagement-card.test.tsx    ← co-located
├── lib/
│   ├── formatters.ts
│   └── formatters.test.ts
├── hooks/
│   ├── use-permissions.ts
│   └── use-permissions.test.ts
└── test/
    ├── setup.ts                        ← Vitest global setup
    ├── test-providers.tsx              ← Provider wrapper
    ├── mocks/
    │   ├── handlers.ts                 ← MSW handlers
    │   └── data.ts                     ← mock data fixtures
    └── utils.tsx                       ← test helpers

e2e/
├── helpers/
│   ├── auth.ts
│   └── fixtures.ts
├── fixtures/
│   └── sample-engagement.json
├── engagement-create.spec.ts
├── finding-approval.spec.ts
└── playwright.config.ts
```

---

## 14. Flakiness Prevention

### Hard Rules
- **No `setTimeout`** in tests — always use `waitFor` / `findBy*` / `toBeVisible` (Playwright)
- **No ordering dependencies** — `beforeEach` reset state
- **No shared state across tests** — seed fresh per test
- **No real network calls in unit/component** — MSW always
- **Deterministic dates** — freeze time via `vi.setSystemTime()`
- **Deterministic IDs** — mock `crypto.randomUUID()` in unit tests
- **Retry only on known network flakes** — never mask real bugs with retries

### Flaky Test Response
1. Tag `.flaky` — quarantine, still run but don't fail CI
2. Open bug in backlog to fix within 1 week
3. If unfixed after 2 weeks, remove — broken tests are worse than none

---

## 15. Test Data Management

### Factories (Faker-based)
```ts
// test/factories/engagement.ts
export const engagementFactory = {
  build: (overrides = {}) => ({
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    status: "IN_PROGRESS",
    type: "PERFORMANCE",
    createdAt: faker.date.recent(),
    _can: { edit: true, delete: true, approve: false },
    ...overrides,
  }),
  buildList: (n: number, overrides = {}) =>
    Array.from({ length: n }, () => engagementFactory.build(overrides)),
};
```

Reusable, consistent test data. Never hardcode entity objects inline in multiple tests.

### Deterministic Faker
```ts
faker.seed(12345);  // same output every run
```

---

## 16. What We Don't Test (Intentionally)

- **Styling** (except visual regression): Tailwind classes don't need tests
- **Third-party library internals**: Trust Radix, React Query, Zod
- **Generated code**: tRPC client, Prisma client — trust the generator
- **Trivial components**: A `<PageHeader>` that takes `{title, description}` and renders them doesn't need a test
- **Scaffolding**: `layout.tsx`, `loading.tsx`, `error.tsx` boilerplate
- **Storybook stories**: Stories ARE the test in visual regression; don't test them separately

---

## 17. Reviewing Tests in PRs

Reviewers check:
- [ ] New feature has tests at appropriate level (unit for logic, component for UI, E2E for workflow)
- [ ] Test names describe behavior ("submits form with valid data"), not implementation ("calls onSubmit")
- [ ] No snapshot changes without screenshot attached
- [ ] No increase in `.flaky` tests
- [ ] No new MSW handlers without test using them
- [ ] Accessibility tests for new UI components

---

## 18. Related Documents

- `ARCHITECTURE.md` — what's Server vs Client (affects test boundaries)
- `STATE-AND-DATA.md` — forms, queries, stores — all have test patterns here
- `ACCESSIBILITY.md` — axe-core integration, a11y standards
- `PERFORMANCE.md` — Lighthouse CI, bundle budgets
- `../api/` — backend testing (separate doc)
