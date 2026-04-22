# Code Standards

> TypeScript strict. Consistent naming. Predictable patterns. Boring is a feature. These are the rules that keep the codebase navigable after 3 years and 20 engineers.

---

## 1. Language — TypeScript Only (Strict)

### Why TypeScript, and strict
- End-to-end types across frontend/backend via tRPC
- Compiler catches more bugs than unit tests
- IDE assist dramatically better than vanilla JS

### Strict mode — always on
`tsconfig.base.json` includes:
```jsonc
{
  "compilerOptions": {
    "strict": true,                             // enables all of the below
    "noUncheckedIndexedAccess": true,           // arr[i] is T | undefined
    "exactOptionalPropertyTypes": true,         // { foo?: string } ≠ { foo: undefined }
    "noImplicitOverride": true,                 // override keyword required
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,         // catch (e) is unknown, not any
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,                    // needed for SWC/esbuild compilers
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,                       // we trust our deps; speed>completeness here
    "verbatimModuleSyntax": true,               // clear import type vs import
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

Per-package `tsconfig.json` extends this; never weakens it.

### `any` is banned
Exceptions:
- Explicit `as unknown as Foo` for test mocking where we deliberately want no check
- Justified, commented use with ESLint disable: `// eslint-disable-next-line @typescript-eslint/no-explicit-any — reason`

The right escape hatch is `unknown`, not `any`. Force the consumer to narrow.

### `as` is last resort
Type assertions lie. They tell TS "I know better." Prefer:
- Type guards: `function isFoo(v: unknown): v is Foo { ... }`
- Zod parsing: `fooSchema.parse(v)` — runtime-verified assertion
- Discriminated unions + exhaustiveness check

When `as` is necessary:
- `as const` for literal narrowing — always fine
- `as T` after a schema parse — redundant but fine
- `as unknown as T` — forbidden except test mocks

---

## 2. Naming

### Identifiers
| Thing | Convention | Example |
|-------|-----------|---------|
| Variables, functions | `camelCase` | `createEngagement`, `isApproved` |
| React components | `PascalCase` | `EngagementCard`, `FindingForm` |
| Types, interfaces, classes | `PascalCase` | `Engagement`, `type Severity` |
| Enums | `PascalCase` (name), `SCREAMING_SNAKE_CASE` (members) | `EngagementStatus.IN_PROGRESS` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_ATTACHMENT_SIZE_BYTES` |
| Module-scoped singletons | `camelCase` | `logger`, `db`, `queue` |
| File names (TS, utilities) | `kebab-case.ts` | `format-currency.ts` |
| File names (React components) | `kebab-case.tsx` | `engagement-card.tsx` |
| Test files | Co-located `*.test.ts` | `format-currency.test.ts` |
| Directory names | `kebab-case` | `components/engagement-detail/` |

### Acronyms in PascalCase
Short acronyms (2–3 letters): keep all caps. Longer: title-case.
- ✅ `URLParser`, `HTMLElement`, `PDFService`
- ❌ `UrlParser`, `HtmlElement`, `PdfService`

This matches JS/DOM conventions (`XMLHttpRequest`, `HTMLDivElement`).

### Boolean names
Always a predicate phrase:
- ✅ `isActive`, `hasPermission`, `canApprove`, `shouldRetry`
- ❌ `active`, `permission`, `approve`

### Function names
Verb phrase describing what it does:
- ✅ `createEngagement`, `findApprover`, `validatePack`
- ❌ `engagement` (noun), `approvalCheck` (nouny; should be `checkApproval`)

### Domain vocabulary — standardized
AIMS has a glossary (see `docs/05-glossary.md`). Use it consistently:

| Term | Meaning | NOT |
|------|---------|-----|
| Engagement | A single audit project | Job, Audit, Project |
| Finding | A GAGAS/IIA/ISO-style conclusion | Issue, Observation, Bug |
| Observation | Field note that may or may not become a finding | Note, Remark |
| Recommendation | A suggested action to fix a finding's cause | Suggestion, Advisory |
| Corrective Action Plan (CAP) | Auditee response to a recommendation | Plan, Fix |
| Work Paper | Evidence document | Doc, Attachment |
| Approval chain | The sequence of approvers | Workflow, Review |
| Standard Pack | A methodology definition (GAGAS, IIA, etc.) | Framework, Standard |
| Tenant | A customer organization | Company, Customer, Org |

Slang or synonyms for these in code review → blocked. Consistency beats cleverness.

### Regulatory terminology — use current terms, not legacy ones

Audit regulation renames itself more often than engineers expect. Using the old term marks you as out of date with practitioners. Current-vs-legacy pairs we enforce:

| Current (use) | Legacy (reject in new code + docs) | Effective |
|---|---|---|
| **ALN** — Assistance Listing Number | CFDA — Catalog of Federal Domestic Assistance | Renamed 2020; CFDA numerically identical but terminology changed |
| **IIA GIAS 2024** — Global Internal Audit Standards | IIA IPPF 2017 — International Professional Practices Framework | Effective January 9, 2025; entirely new structure (5 Domains / 15 Principles / 52 Standards), not just a version bump |
| **ISO 27001:2022** — 93 controls in 4 themes | ISO 27001:2013 — 114 controls in 14 domains | Transition deadline October 31, 2025 (past) |
| **NIST CSF 2.0** — 6 functions (added GOVERN) | NIST CSF 1.1 — 5 functions | Published February 2024 |
| **Uniform Guidance $1M Single Audit threshold** | Uniform Guidance $750k threshold | Effective for FY ending Sep 30, 2025 and after |
| **GAGAS 2024** (Yellow Book) | GAGAS 2018 | Effective for financial audits for periods beginning on or after December 15, 2025 |

Reviewer should reject PRs (code, docs, or example packs) that use the legacy term without a specific historical-context justification. Legacy terms are fine when explicitly discussing prior-version behavior (e.g., migration docs, changelogs); not fine in forward-looking material.

Drift is real: the GAGAS 2024 revision renamed "Quality Control" to "Quality Management" aligning with AICPA SQMS 1. When standards rename, we update vocabulary in all new material within the same sprint.

---

## 3. File Organization

### Module layout — feature-first, not type-first

```
src/
├── features/
│   ├── engagements/
│   │   ├── engagement.service.ts
│   │   ├── engagement.service.test.ts
│   │   ├── engagement.router.ts
│   │   ├── engagement.schemas.ts
│   │   ├── engagement.types.ts
│   │   └── index.ts                  # public surface of this feature
│   ├── findings/
│   └── approvals/
├── common/
│   ├── db.ts
│   ├── cache.ts
│   ├── errors.ts
│   └── logger.ts
└── config/
    └── env.ts
```

Not:
```
src/
├── services/           ❌ every service in one folder = no cohesion
├── controllers/
├── types/
└── schemas/
```

Co-locate everything about a feature in its folder. When you delete the feature, one folder goes.

### Module boundaries
Features export only what others need. Export barrel in `index.ts`:
```ts
// features/engagements/index.ts
export { EngagementService } from "./engagement.service";
export { engagementRouter } from "./engagement.router";
export type { Engagement, EngagementCreate } from "./engagement.types";
// NOT exported: internal helpers, repo layer, DB-specific code
```

Importing an un-exported symbol is a code smell — either promote to the public API (with review) or refactor the caller.

### File length — soft limit 400 lines
Long files usually do multiple things. Refactor when you hit ~400 lines. Exceptions: `*.schemas.ts` with many related Zod schemas, router files with many procedures (but consider splitting the router).

---

## 4. TypeScript Patterns

### Prefer type aliases over interfaces
We pick one — type aliases:
```ts
type User = { id: string; email: string };     // ✅
interface User { id: string; email: string }   // ❌ (we don't use interfaces)
```

Why: type aliases handle unions, tuples, conditionals; interfaces only object shapes. One tool is easier to teach. Consistency > minor ergonomics.

Exception: declaration merging (rare; only for augmenting 3rd-party types).

### Discriminated unions for state
Represent state by shape, not boolean flags:
```ts
// ✅
type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// ❌
type LoadState<T> = {
  isLoading: boolean;
  isError: boolean;
  data?: T;
  error?: Error;
};
```

Compiler enforces correct access (`state.data` only exists when `status: "success"`).

### Exhaustiveness checks
`switch` on a union — compiler proves all cases handled:
```ts
function label(status: EngagementStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "IN_PROGRESS": return "In progress";
    case "ISSUED": return "Issued";
    case "CLOSED": return "Closed";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

### Zod as the primary validator
All runtime validation goes through Zod. Type is inferred from schema:
```ts
export const engagementCreateSchema = z.object({
  title: z.string().min(1).max(240),
  type: z.enum(["PERFORMANCE", "FINANCIAL", "COMPLIANCE"]),
  fiscalYear: z.number().int().min(2000).max(2100),
  standardPackId: z.string().regex(/^pack_/),
});
export type EngagementCreate = z.infer<typeof engagementCreateSchema>;
```

Never hand-write a type for something that has a Zod schema — the schema is the truth.

### Branded types for IDs
Prevent ID mix-ups at compile time:
```ts
type EngagementId = string & { __brand: "EngagementId" };
type UserId       = string & { __brand: "UserId" };

// someone trying to pass a UserId where EngagementId expected → TS error
```

Via helper:
```ts
const brand = <B extends string>(s: string): string & { __brand: B } => s as any;
```

Used in critical boundaries (router inputs, DB primary keys).

### Readonly by default for internal data
Immutable signals intent. Mutable needs justification:
```ts
type EngagementView = {
  readonly id: string;
  readonly title: string;
  readonly team: readonly TeamMember[];
};
```

For state management (Zustand, RHF), mutability is intrinsic — don't force readonly there.

---

## 5. Error Handling

### Two kinds of errors
- **Expected (business)** — user did something that's not allowed, input was invalid, resource conflicts
  - Returned as typed errors (tRPC `TRPCError` with code)
  - UI shows actionable message
- **Unexpected (technical)** — bug, infrastructure failure, 3rd-party outage
  - Thrown; caught at boundary
  - UI shows generic "something went wrong"; Sentry captures; on-call investigates

### Error hierarchy (backend)
```ts
// common/errors.ts
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = errorCodeToHttpStatus(code);
    this.details = details;
  }
}

export class NotFoundError extends DomainError { ... }
export class ValidationError extends DomainError { ... }
export class ConflictError extends DomainError { ... }
export class PermissionError extends DomainError { ... }
```

Handlers throw domain errors; tRPC middleware translates to `TRPCError` with stable `code`.

### Never throw strings / plain objects
```ts
// ❌
throw "not allowed";
throw { message: "not allowed" };

// ✅
throw new PermissionError("ENGAGEMENT_NOT_EDITABLE", "Engagement is locked");
```

### Never swallow errors
```ts
// ❌
try { await doThing(); } catch {}

// ✅
try { await doThing(); }
catch (err) {
  logger.error({ err }, "Failed to do thing");
  throw err;                 // re-throw, or translate to domain error
}
```

Rare exception: intentionally ignoring cleanup errors during teardown — commented.

### No string-matching on error messages
Error messages are for humans. Use `code` / `instanceof` for behavior:
```ts
// ❌
if (err.message.includes("unique constraint")) ...

// ✅
if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") ...
```

---

## 6. Asynchrony

### Always `await` or return promises
Dangling promises are silent bugs. ESLint rule catches most; code review catches rest.

```ts
// ❌ dangling
async function handle() {
  doSomethingAsync();      // promise lost
  return "ok";
}

// ✅
async function handle() {
  await doSomethingAsync();
  return "ok";
}
```

Fire-and-forget is explicit via `void`:
```ts
void sendAnalyticsEvent(event);  // opt out of awaiting, clearly
```

### Parallel independent awaits
```ts
// ❌ serial (slow)
const user = await getUser();
const tenant = await getTenant();

// ✅ parallel
const [user, tenant] = await Promise.all([getUser(), getTenant()]);
```

### Error handling in parallel
`Promise.all` rejects on first rejection. If you need partial success:
```ts
const results = await Promise.allSettled([...]);
const successes = results.filter(r => r.status === "fulfilled").map(r => r.value);
const failures  = results.filter(r => r.status === "rejected").map(r => r.reason);
```

### No callback APIs internally
Wrap callback APIs in promises at boundaries. Use `async`/`await` throughout.

---

## 7. Functions

### Max parameters = 3; prefer options object
```ts
// ❌
function createEngagement(title, type, year, pack, lead, team, start, end) { ... }

// ✅
function createEngagement(input: {
  title: string;
  type: EngagementType;
  fiscalYear: number;
  standardPackId: string;
  leadUserId: string;
  team?: TeamMemberInput[];
  startDate?: Date;
  endDate?: Date;
}): Promise<Engagement> { ... }
```

Forces named arguments at call sites; order-agnostic; easy to extend.

### Pure functions when possible
- No side effects (no DB write, no network, no log)
- Deterministic (same input → same output)
- Easy to test; composable; memoizable

Keep side-effectful code at the edges; pure core.

### Function length — soft limit 40 lines
If a function can't fit on screen, it's usually doing two things. Split.

Exceptions: data transformations with explicit shape mapping (each line obvious).

### Early returns preferred
```ts
// ✅
function approve(finding: Finding, user: User): Result {
  if (finding.status !== "SUBMITTED") return { ok: false, code: "WRONG_STATUS" };
  if (!user.canApprove(finding)) return { ok: false, code: "FORBIDDEN" };
  if (finding.locked) return { ok: false, code: "LOCKED" };
  // main logic
}
```

Not `else if` chains. Not nested ternaries.

---

## 8. Null / Undefined

### `undefined` means "not set"; `null` means "explicitly absent"
In practice we rarely use `null` in our own code. DB NULLs come back as `null` via Prisma; we handle that at the boundary.

### Prefer optional fields
```ts
type Finding = { assignedTo?: UserId };   // present or not
```

Not:
```ts
type Finding = { assignedTo: UserId | null };   // avoid if possible
```

Exception: when "explicitly cleared" is semantically different from "never set" (rare).

### Never default-with-silent-fallback
```ts
// ❌
const pageSize = config.pageSize || 25;    // treats 0 as missing

// ✅
const pageSize = config.pageSize ?? 25;    // null/undefined only
```

### No `!` non-null assertion
```ts
// ❌
const name = user.name!;

// ✅
if (!user.name) throw new Error(`User ${user.id} has no name`);
const name = user.name;
```

Assertions say "trust me"; we'd rather verify. Exceptions only in tests (`expect()` narrowing).

---

## 9. Imports

### Order (ESLint enforced)
1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`react`, `@prisma/client`)
3. Workspace packages (`@validation/*`, `@standard-packs/*`)
4. Absolute internal (`@/lib/`, `@/components/`)
5. Relative imports (`./utils`, `../types`)
6. Type-only imports grouped with their section, flagged with `import type`
7. Styles (`./styles.module.css`)

Blank line between groups. Auto-sorted by `eslint-plugin-import`.

### `import type` always when type-only
```ts
import type { User } from "./types";
```

Required by `verbatimModuleSyntax`. Helps bundler tree-shake.

### No wildcard imports
```ts
// ❌
import * as lodash from "lodash-es";

// ✅
import { debounce } from "lodash-es";
```

Better tree-shake, clearer intent.

### Path aliases
Workspace paths (`@/`, `@validation/`) defined in `tsconfig.base.json`. Relative imports only for same-folder siblings.

---

## 10. Comments & Documentation

### Comments explain *why*, not *what*
Code shows what. Comments explain reasoning, constraints, or trade-offs:

```ts
// ❌ restates the code
// Increment counter
counter++;

// ✅ explains the why
// Retry up to 3× — S3 returns 503 during failover even for idempotent writes.
// Exceeding 3 hits CloudFront's 30s timeout; we surface a user-visible error instead.
await retry(upload, { times: 3 });
```

### JSDoc for public APIs
Every exported function/class has JSDoc:
```ts
/**
 * Advances the approval workflow for a finding.
 *
 * - Requires the caller to be the current approver in the chain.
 * - Fails if the finding is not in `SUBMITTED` or `IN_REVIEW` state.
 * - Emits `ApprovalDecisionEvent` on success.
 *
 * @throws {PermissionError} if caller is not authorized to approve.
 * @throws {ConflictError} if finding is in a terminal state.
 */
export async function approveFinding(...) { ... }
```

Internal helpers don't need JSDoc unless their purpose is non-obvious.

### `// TODO` — not accumulative
TODOs are fine short-term. They get stale. Rules:
- Format: `// TODO(@author or issue-id): what + why`
- No TODO older than 90 days in `main` — linter warns; reviewer's judgement call
- "Nice to have" belongs in issue tracker, not code

### `// FIXME` / `// XXX` / `// HACK`
Same rules as TODO but escalated severity. `// HACK` warrants a linked issue explaining the debt.

---

## 11. Classes vs Functions

### Default: functions
Prefer functions + closures:
```ts
// ✅
export function createEngagementService(deps: Deps) {
  return {
    create: async (input: EngagementCreate) => { ... },
    list:   async (filter: ListFilter) => { ... },
  };
}
```

### Classes when warranted
- NestJS modules (framework requires)
- Stateful long-lived objects (connection pools, cache managers)
- Hierarchy via `extends` (use sparingly)

### No mixins, no decorators outside framework use
Decorators where NestJS needs them (`@Injectable`, `@Module`) — fine. Elsewhere — no.

### `private` fields with `#`
```ts
class CacheManager {
  #store = new Map<string, unknown>();       // true private (runtime-enforced)

  get(k: string) { return this.#store.get(k); }
}
```

TS `private` is compile-time only; `#` is actually private at runtime. Preferred.

---

## 12. Logging

See `devops/OBSERVABILITY.md §4` for full standards. Code-level:

### Structured only
```ts
// ❌
logger.info(`User ${userId} created engagement ${engagementId}`);

// ✅
logger.info({ userId, engagementId }, "engagement created");
```

### Log at boundaries, not everywhere
- Request enter + exit (middleware) — automatic
- Unexpected errors — automatic (global handler)
- Business events ("engagement created", "approval granted") — explicit

Don't log intermediate variable values. If needed, use debug level + feature flag.

### Log levels
- `error` / `fatal`: genuine error; fires Sentry
- `warn`: recoverable; action may be needed
- `info`: normal business events
- `debug`: diagnostics, disabled in prod
- `trace`: rarely used

---

## 13. Dependencies

### Minimal surface area
Every dep is a supply chain liability. Before adding:
- Does it replace > 100 lines we'd write? (otherwise, write it)
- Is it actively maintained?
- Permissive license (MIT/Apache-2.0 preferred)?
- Acceptable CVE history?
- Tree-shake-friendly (ESM, named exports)?
- Alternative stdlib / existing dep?

PR adding a dep explains these in the description.

### Pinned versions
- Production dependencies: exact versions (no `^` ranges) to reduce drift
- Dev dependencies: `^` ranges acceptable
- Lockfile (`pnpm-lock.yaml`) is the truth

### Version upgrades
Via Dependabot (see `SECURITY-TESTING.md §3`). Grouped weekly. Major versions always manual.

### Banned patterns
- Left-pad-tier micro-packages (1-line utilities)
- Anything with < 3 months of age for critical paths (maturity risk)
- Anything with a single maintainer for critical paths (bus factor)
- Forks of popular packages (why? audit before adopting)

---

## 14. Vetting 3rd-Party Code

Before adopting a new dep, lead reviewer:
- [ ] License in allowlist
- [ ] No known high CVEs
- [ ] Maintained (commit within 6 months)
- [ ] Transitive deps also acceptable (run `pnpm why`)
- [ ] Bundle size impact acceptable
- [ ] Supports our Node + TS versions

Extra scrutiny for:
- Crypto libraries (we use node:crypto, @noble/*, argon2 — established only)
- Parsers (attack surface: JSON, YAML, XML, URL, PDF)
- Anything that fetches during install

---

## 15. Security Hygiene (Code Level)

### No user input in shell commands
```ts
// ❌
execSync(`curl ${userUrl}`);

// ✅
await fetch(validatedUrl);   // or execa with array args
```

### No `eval`, no `new Function`
Never. ESLint blocks.

### No string-based SQL
Always Prisma / parameterized. Raw SQL only with reviewer approval + parameterization.

### No regex from user input without timeout
```ts
import { safeRegex } from "@/common/regex";
const re = safeRegex(pattern);     // bounded backtracking, throws if unsafe
```

### No dangerouslySetInnerHTML with unsanitized content
Rich text sanitized via DOMPurify (on write; see `frontend/UI-PATTERNS.md §17`).

---

## 16. Concurrency Patterns

### Idempotency keys for mutating operations
Every write endpoint that might be retried accepts an optional `idempotencyKey`. Server uses Redis lookup to dedupe.

### Optimistic concurrency
DB writes include `_version`; update where version matches; on mismatch, server returns `CONFLICT` so UI can reconcile.

### Distributed locks
- Redis-based `SETNX` for workflow-advance operations
- Short TTL (5–30s) with owner token
- Release explicit; expiry is the safety net

---

## 17. Testing Hooks In Code

### Dependency injection
Pure-function DI for easy test mocking:
```ts
export async function approveFinding(
  input: ApproveInput,
  ctx: { prisma: PrismaClient; logger: Logger; events: EventBus }
) { ... }
```

Tests inject fakes.

### No `process.env` access deep in code
Reads `process.env` only in `config/env.ts` (once, validated). Everywhere else receives values via config object.

### No `new Date()` in hot paths
Inject a `clock` dependency or use `@/common/clock`:
```ts
export function isExpired(token: Token, clock = realClock): boolean {
  return token.expiresAt.getTime() < clock.now();
}
```

Tests pass a fake clock.

---

## 18. React Patterns (Frontend-Specific)

### Functional components only
No class components. Hooks for state, effects, refs.

### Component co-location
```
engagement-card/
├── engagement-card.tsx
├── engagement-card.test.tsx
├── engagement-card.stories.tsx   # optional
└── index.ts
```

### Props — named, typed, destructured
```tsx
type EngagementCardProps = {
  engagement: EngagementSummary;
  onClick?: (id: EngagementId) => void;
  className?: string;
};

export function EngagementCard({ engagement, onClick, className }: EngagementCardProps) {
  ...
}
```

No positional props beyond `children`.

### Hooks rules (reinforced)
- No conditional hooks
- Custom hook names start with `use`
- Hook dependencies: honest `useEffect` deps, not stale closures
- Extract logic to `use*` for reuse + testability

### Keyed lists
Always use stable IDs; never array index as key (except genuinely static lists).

### No business logic in JSX
Extract to hooks / helpers. JSX should be declarative.

---

## 19. Backend Patterns (NestJS + tRPC)

### Module per feature
One NestJS module per feature, one tRPC sub-router per feature, paired.

### Service layer for business logic
- Router: translates tRPC input → service call → tRPC output
- Service: business rules, workflow, policy
- Repository (if abstracted): Prisma queries

Keep services thin when no business logic exists ("pass-through" is fine).

### Always validate input at the boundary
tRPC's Zod input schema validates on every call. Never trust input downstream.

### Transactions
Use Prisma interactive transactions (`$transaction`) for multi-step writes. Release connections promptly.

---

## 20. What We Don't Do

- **No implicit globals** — everything scoped
- **No singleton patterns for business logic** — use DI
- **No God objects** (500-line service class)
- **No abstract base classes** except where NestJS requires
- **No reflection / metaprogramming** outside framework use
- **No type-coerce equality (`==`)** — always `===`
- **No `void` return type if function throws** — express as `never` or `Promise<never>`
- **No polymorphic JS arrays** (`any[]`)
- **No Array methods that silently ignore undefined**
- **No magic strings** — use enums or const objects

---

## 21. Style Conflicts With External Libraries

Sometimes a framework dictates a style that conflicts:
- NestJS: decorators, classes, DI containers (accepted)
- Prisma: method chaining style (accepted)
- tRPC: builder chaining (accepted)
- React: JSX (accepted)

Follow the framework's conventions *within* framework code. Apply our standards outside.

---

## 22. Related Documents

- `LINTING-FORMATTING.md` — tools that enforce these standards
- `REVIEW.md` — how these are checked in PRs
- `TESTING-STRATEGY.md` — how we verify code
- `../api/CONVENTIONS.md` — API-specific naming + patterns
- `../frontend/STATE-AND-DATA.md` — frontend-specific state patterns
