# Frontend Architecture

> Next.js 15 App Router architecture: routing, rendering boundaries, data flow, middleware, error handling.

---

## 1. Rendering Model — Server-First

Next.js 15 + React 19 give us four rendering contexts. We use each deliberately.

| Context | When | Where data is fetched | JS shipped to client |
|---------|------|----------------------|---------------------|
| **Server Component (RSC)** — default | Any component that doesn't need state, effects, or browser APIs | Server (via tRPC server caller) | None |
| **Client Component** (`"use client"`) | Forms, interactive UI, hooks | Client (via tRPC React Query hooks) | Component + deps |
| **Server Action** (`"use server"`) | Mutations invoked from Client Components without a separate endpoint | Server | Function reference only |
| **Route Handler** (`route.ts`) | REST endpoints, webhooks, file uploads, auth callbacks | Server | None |

### Decision Rule
Start every component as a Server Component. Add `"use client"` only when you hit one of:
- `useState`, `useReducer`, `useEffect`, `useRef` on a DOM node
- Event handlers (`onClick`, `onChange`, form handlers)
- Browser-only APIs (`window`, `localStorage`, `IntersectionObserver`)
- React Context that needs to be consumed by a hook
- Third-party libraries that use any of the above (Radix, Framer Motion, TanStack Query hooks)

### "Use client" Placement — Push It Down
Mark the smallest possible component as client. A page can be a Server Component that renders a Client Component for just the interactive part:

```tsx
// app/(app)/engagements/[id]/page.tsx — Server Component
export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const engagement = await trpc.engagement.getById({ id });  // server caller
  return (
    <>
      <EngagementHeader engagement={engagement} />          {/* Server */}
      <EngagementTabs engagementId={id} />                  {/* Client — needs state */}
    </>
  );
}
```

### Composition Rule
Server Components can import and render Client Components (they pass through as props). Client Components **cannot** import Server Components directly — but they can accept Server Components as `children` or props. Use this to keep server-rendered content inside client shells.

---

## 2. App Router — Route Groups & Layouts

### Three Route Groups (parenthesized — no URL segment)

| Group | Purpose | Layout concerns |
|-------|---------|-----------------|
| `(public)` | Marketing, docs, landing, status page | No auth, minimal chrome, indexable |
| `(auth)` | Login, signup, MFA, password reset, accept-invite | No app shell, logo + card layout, noindex |
| `(app)` | Authenticated application | Full app shell (sidebar, topbar, command palette), auth required |

Route groups let us give each section a distinct layout without affecting URLs.

### Layout Hierarchy

```
app/layout.tsx                          ← Root (html, body, providers, fonts, theme)
├── (public)/layout.tsx                 ← Public chrome (marketing nav)
├── (auth)/layout.tsx                   ← Centered auth card
└── (app)/layout.tsx                    ← App shell (sidebar + topbar)
    └── engagements/[id]/layout.tsx     ← Tab nav inside engagement detail
```

Only the root layout defines `<html>` and `<body>`. All other layouts are pure wrappers around `children`.

### Root Layout Responsibilities
- `<html lang>` set from `next-intl` locale detection
- Global providers: `ThemeProvider`, `TRPCProvider`, `QueryClientProvider`, `NextIntlClientProvider`, `Toaster`
- Global CSS + fonts (next/font with `display: "swap"`, preload, subset)
- `<Toaster />` / `<Sonner />` for notifications
- No business logic — providers only

### App Shell Layout (`(app)/layout.tsx`)
- Server Component (reads session from cookies)
- Redirects to `/login` if unauthenticated (via `redirect()` from `next/navigation`)
- Fetches current user + tenant context once, passes to `AppShellClient` which hydrates Zustand
- Renders `<Sidebar />` + `<Topbar />` + `<main>{children}</main>` + `<CommandPalette />`
- Sets `<html data-theme>` attribute from tenant branding

---

## 3. Dynamic Routes, Params & Search Params

Next.js 15 changed params/searchParams to **async** (Promise). Always `await`:

```tsx
// app/(app)/engagements/[id]/page.tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  // ...
}
```

### Parallel Routes — use sparingly
Only for genuine split layouts (e.g., a dashboard with independently-loading panels). Do not use as a substitute for conditional rendering.

### Intercepting Routes
Used for modal overlays that keep the URL shareable (e.g., `(.)findings/[id]` intercepts to show finding detail as a modal from the list view while deep links go to the full page). Reserve for flows where the modal-vs-page distinction is real UX.

---

## 4. Data Fetching — Three Lanes

### Lane A: Server Components (default for initial load)
Use the tRPC **server caller** — no HTTP round-trip, direct function call:

```tsx
// lib/trpc/server.ts
import { createServerCaller } from "@/server/trpc";
export const trpc = createServerCaller();

// Usage in any Server Component
const data = await trpc.engagement.list({ status: "IN_PROGRESS" });
```

Benefits: faster TTFB, no waterfall, no client JS for the fetch, respects cookies automatically.

### Lane B: Client Components (interactivity, re-fetching, mutations)
Use `@trpc/react-query` hooks:

```tsx
"use client";
const { data, isLoading } = trpc.engagement.list.useQuery({ status: "IN_PROGRESS" });
const mutate = trpc.engagement.update.useMutation({
  onSuccess: () => utils.engagement.list.invalidate(),
});
```

### Lane C: Server Actions (progressive-enhancement forms)
For forms that should work without JS (rare — auth forms only):

```tsx
// actions/login.ts
"use server";
export async function loginAction(formData: FormData) {
  const parsed = loginSchema.parse(Object.fromEntries(formData));
  // ... set cookie, redirect
}
```

Prefer tRPC mutations for everything else (better error surfacing, typed responses, optimistic updates).

### Hydration Pattern — Prefetch on Server, Consume on Client
For pages where the initial view is static but becomes interactive:

```tsx
// page.tsx (Server)
const helpers = createServerSideHelpers({ ... });
await helpers.engagement.list.prefetch({ status: "IN_PROGRESS" });
return <HydrationBoundary state={dehydrate(helpers.queryClient)}>
  <EngagementListClient />
</HydrationBoundary>;
```

Client component gets the data instantly from the hydrated cache, no loading flash.

---

## 5. Caching Strategy

Next.js 15 defaults to **no caching** (changed from 14). We opt in explicitly.

| Layer | Policy | Override |
|-------|--------|----------|
| **`fetch()` in Server Components** | No cache by default | `{ next: { revalidate: 60 } }` or `{ cache: "force-cache" }` for truly static data (standard packs, reference data) |
| **tRPC server caller** | Per-procedure `cacheControl` metadata; default no-cache | Standard pack queries cache 1 hour; tenant data never cached |
| **React Query (client)** | `staleTime: 30s`, `gcTime: 5min` for lists; `staleTime: 0` for detail views | Per-query override |
| **Full Route Cache** | Disabled by default (dynamic rendering) | Static pages (marketing) use `export const dynamic = "force-static"` |
| **Router Cache (client)** | 30s for dynamic segments, 5min for static | Invalidated on mutation via `router.refresh()` |

### Cache Invalidation
- After mutation: `utils.engagement.list.invalidate()` (React Query) + `router.refresh()` (Next.js Router Cache)
- Server-side tag-based: `revalidateTag("engagement:123")` from Server Actions
- Never cache tenant-scoped data across tenant boundaries — cache keys must include `tenantId`

---

## 6. Middleware — `middleware.ts`

Runs on **every request** before the route handler. Keep it cheap.

```ts
// middleware.ts
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)$).*)",
  ],
};

export async function middleware(req: NextRequest) {
  // 1. i18n: detect locale, rewrite or set cookie
  // 2. Auth: check session cookie existence (no DB call — validation happens in route)
  // 3. Tenant: resolve subdomain/path → tenant slug → set header for downstream
  // 4. Security headers: CSP nonce, HSTS, X-Frame-Options
  // 5. Rate limiting: check Redis (via Upstash Edge-compatible client)
}
```

**Rules for middleware:**
- No database calls (session *existence* only; validation happens later)
- No heavy computation (runs on every asset if matcher is loose)
- Edge runtime compatible (no Node APIs)
- Errors here break the whole app — wrap in try/catch, log, let through

---

## 7. Error Handling — Three Boundaries

| File | Scope | When triggered |
|------|-------|----------------|
| `app/error.tsx` | Root — catches anything not caught below | Unhandled errors anywhere |
| `app/(app)/error.tsx` | Authenticated app | Errors in `(app)` routes (preserves shell) |
| `app/(app)/engagements/[id]/error.tsx` | Specific segment | Errors in engagement detail routes (preserves tab nav) |
| `app/not-found.tsx` | 404 | `notFound()` call or unmatched route |
| `app/global-error.tsx` | Fallback when root error.tsx itself errors | Replaces `<html>` — must render full document |

Error boundaries are **Client Components** (required). They receive `error` + `reset` props. Report to Sentry via `useEffect`, offer retry button.

### Not-Found Handling
Server Components call `notFound()` from `next/navigation` when a resource doesn't exist. This triggers the nearest `not-found.tsx`.

```tsx
const engagement = await trpc.engagement.getById({ id }).catch(() => null);
if (!engagement) notFound();
```

### Mutation Errors
Surface in the UI via toast + inline field errors. Never let a tRPC mutation error bubble to `error.tsx` — catch in `onError` and show a `<FormAlert>`.

---

## 8. Loading States — Streaming + Suspense

Next.js 15 streams HTML. Use `loading.tsx` and `<Suspense>` to stream progressively.

### `loading.tsx` Convention
Each segment can define a `loading.tsx` that renders while the page's data fetches. Always a skeleton that matches the final layout — never a spinner.

```tsx
// app/(app)/engagements/loading.tsx
export default function Loading() {
  return <EngagementListSkeleton />;
}
```

### Granular Suspense
Inside a page, wrap slow sub-trees in `<Suspense>` with a skeleton fallback. Fast parts render immediately; slow parts stream in:

```tsx
<EngagementHeader engagement={engagement} />   {/* fast */}
<Suspense fallback={<FindingsListSkeleton />}>
  <FindingsList engagementId={id} />           {/* slow — streams */}
</Suspense>
```

### Skeleton Quality Rule
Skeletons must match final dimensions (height, width, gap, count). A skeleton that collapses on load causes CLS. Use the same component with `data-loading` state when possible.

---

## 9. Auth Integration — Session at the Edge

See `auth/ARCHITECTURE.md` for the full auth subsystem. Frontend touch points:

| Where | What |
|-------|------|
| `middleware.ts` | Check session cookie exists; redirect unauthenticated `(app)` routes to `/login?next=<url>` |
| `(app)/layout.tsx` (Server) | Validate session, fetch current user + tenant, pass to Client via provider |
| `lib/auth/session.ts` | `getServerSession()` helper for Server Components / Route Handlers |
| `hooks/use-current-user.ts` | Client-side — reads from provider (not a new fetch) |
| `app/api/auth/[...]/route.ts` | Better Auth endpoints (login, logout, callback, refresh) |

Session is a **JWT (EdDSA, 15 min)** + **opaque refresh token** in HttpOnly cookies. The access token is read server-side via `cookies()`. Client Components never see the JWT directly — they get the user object from context.

---

## 10. Multi-Tenancy in the Frontend

Tenant resolution happens in three places:

1. **Middleware** — maps subdomain (`acme.aims.io`) or path (`/t/acme/...`) to tenant slug, sets `x-tenant-slug` header
2. **`(app)/layout.tsx`** — server-side resolves slug → tenant record, passes down
3. **`TenantProvider` (Client)** — makes tenant available via `useTenant()` hook

All tRPC calls automatically include `tenantId` from the session context (server) or the context provider (client). Never pass tenantId explicitly in component code — the middleware/procedure enforces it.

### Theme Resolution
`(app)/layout.tsx` reads `tenant.theme.primaryColor` and sets `<html style={{ "--primary": color }}>`. CSS variables cascade to all components. Dark mode is a separate `data-theme="dark"` attribute toggled by user preference.

---

## 11. Project Structure — Import Paths

TypeScript path aliases (configured in `tsconfig.json`):

```json
{
  "paths": {
    "@/*": ["./apps/web/*"],
    "@/components/*": ["./apps/web/components/*"],
    "@/lib/*": ["./apps/web/lib/*"],
    "@/hooks/*": ["./apps/web/hooks/*"],
    "@/stores/*": ["./apps/web/stores/*"],
    "@validation/*": ["./packages/validation/*"],
    "@standard-packs/*": ["./packages/standard-packs/*"],
    "@ui/*": ["./packages/ui/*"]
  }
}
```

### Import Ordering (enforced via ESLint)
1. React / Next
2. External packages
3. `@/` workspace imports
4. Relative imports (`./`, `../`)
5. Types (`import type`)
6. Styles (`./styles.module.css`)

---

## 12. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌──────────────┐                                                │
│  │ Client Comp. │ ──── tRPC hook (useQuery/useMutation) ────┐   │
│  └──────────────┘                                             │   │
│         ▲                                                     │   │
│         │ props                                               │   │
└─────────┼─────────────────────────────────────────────────────┼───┘
          │                                                     │
┌─────────┴─────────────────────────────────────────────────────┼───┐
│  Next.js Server (RSC)                                         │   │
│  ┌──────────────┐                                             │   │
│  │ Server Comp. │ ─── tRPC server caller (direct fn call) ───┤   │
│  └──────────────┘                                             ▼   │
│         ▲                                                         │
│         │ rendered HTML/RSC payload                               │
│  ┌──────┴───────┐     ┌──────────────┐     ┌──────────────┐       │
│  │  middleware  │ ──▶ │   layout     │ ──▶ │    page      │       │
│  │ (auth+tenant)│     │ (app shell)  │     │  (content)   │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
└───────────────────────────────────────────────────────────────────┘
          │                                                     │
          │ session cookie                                      │ tRPC/HTTP
          ▼                                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  NestJS API (separate service)                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐           │
│  │ tRPC router  │──▶│   service    │──▶│    Prisma    │──▶ DB    │
│  └──────────────┘   └──────────────┘   └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. Environment & Config

### Three Environment Tiers

| Tier | Purpose | Data |
|------|---------|------|
| `.env.local` | Developer machine | Personal secrets, never committed |
| `.env.development` / `.env.staging` / `.env.production` | Tier defaults | Committed, non-secret |
| Runtime secrets | Injected by hosting (Vercel/AWS) | Never in repo |

### Typed Env Validation
At boot, validate all `process.env` vars against a Zod schema (`lib/env.ts`). Fail fast on missing/malformed values — never ship with a runtime KeyError.

```ts
// lib/env.ts
export const env = envSchema.parse(process.env);
// Usage: import { env } from "@/lib/env"; env.DATABASE_URL
```

Split into `serverEnv` and `clientEnv` (NEXT_PUBLIC_*). Client env never leaks server secrets.

---

## 14. Route-Level Code Splitting (Automatic)

Next.js App Router splits by route automatically. We enhance it:

- `dynamic(() => import("./HeavyChart"), { ssr: false })` — defer heavy client-only widgets
- Standard packs loaded per-engagement (not all at once) via dynamic imports
- Chart libraries, TipTap editor, PDF renderer — all lazy-loaded
- Admin routes completely separate bundle (rarely visited)

See `PERFORMANCE.md` for budgets.

---

## 15. Static Assets

| Folder | Purpose |
|--------|---------|
| `public/` | Served as-is at root (`/logo.svg`, `/favicon.ico`) |
| `public/locales/` | i18n fallback JSON (runtime) |
| `public/pack-schemas/` | Published standard pack JSON schemas (versioned) |
| `next/font` | Self-hosted Google fonts with subset + preload (Inter, JetBrains Mono) |
| `next/image` | All images go through `<Image>` — auto WebP/AVIF, responsive sizes |

Never hotlink external images. Never use `<img>` in app code (enforced via ESLint rule `@next/next/no-img-element`).

---

## 16. Monorepo Layout (Turborepo + pnpm)

```
aims-v2-platform/
├── apps/
│   ├── web/                    # Next.js 15 frontend (this doc)
│   └── api/                    # NestJS backend (see api/)
├── packages/
│   ├── validation/             # Zod schemas (shared by forms + tRPC)
│   ├── standard-packs/         # Pack definitions (shared)
│   ├── ui/                     # (Optional Phase 2) shared component library
│   ├── tsconfig/               # Base tsconfig.json
│   └── eslint-config/          # Shared ESLint + Prettier
├── turbo.json                  # Pipeline: build, lint, test, typecheck
├── pnpm-workspace.yaml
└── package.json
```

### Turbo Pipeline (`turbo.json`)
- `build` depends on `^build` (upstream packages build first)
- `lint`, `typecheck`, `test` run in parallel, cached per package
- CI: `turbo run build lint typecheck test --filter=[HEAD^1]` — only affected packages

### Shared Package Discipline
- `packages/validation` — no side effects, no runtime dependencies beyond Zod
- `packages/standard-packs` — pure data; TypeScript types generated from JSON schema
- Never import from `apps/*` into `packages/*` (one-way dependency)

---

## 17. What We Explicitly Do *Not* Do

- **No Redux / MobX / Jotai** — Zustand for UI state, React Query for server state. Two tools is enough.
- **No Context for server data** — tRPC + React Query is the server-state layer. Context is for truly cross-cutting UI state only (theme, locale, current user).
- **No CSS-in-JS runtime** (styled-components, Emotion) — Tailwind + CSS vars. Zero runtime cost.
- **No custom webpack config** unless absolutely required — Turbopack (Next 15) or default webpack only.
- **No Pages Router** — App Router everywhere. No `pages/` directory exists.
- **No `getServerSideProps` / `getStaticProps`** — legacy Pages Router APIs. Use Server Components.
- **No client-side routing library** (react-router, tanstack-router) — use `next/link` and `useRouter` from `next/navigation`.
- **No `window.fetch` scattered through components** — all server calls go through tRPC.

---

## 18. Related Documents

- `README.md` — tech stack, file structure
- `DESIGN-SYSTEM.md` — tokens, theming, components
- `STATE-AND-DATA.md` — React Query config, Zustand stores, form patterns, dynamic pack forms
- `UI-PATTERNS.md` — layout patterns, tables, modals, empty states
- `PERFORMANCE.md` — Core Web Vitals, bundle budgets
- `../auth/ARCHITECTURE.md` — auth subsystem this frontend integrates with
- `../api/ARCHITECTURE.md` — backend tRPC architecture (counterpart to this doc)
