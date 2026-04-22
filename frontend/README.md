# AIMS v2 — Frontend Architecture & Design System

> Production-grade Next.js 15 application for a multi-tenant audit platform. Accessible, internationalized, performant, maintainable.

---

## Tech Stack (Decided)

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Framework | **Next.js 15** (App Router) | 15.x | Industry standard, RSC, great DX, excellent tooling |
| React | **React 19** | 19.x | Server Components, Actions, concurrent features |
| Language | **TypeScript** strict | 5.x | Type safety end-to-end |
| UI primitives | **Radix UI** | latest | Unstyled, accessible, composable |
| Component library | **shadcn/ui** | latest | Copy-paste components you own; no dependency lock |
| Styling | **Tailwind CSS v4** | 4.x | Utility-first, design-system friendly, native CSS |
| Forms | **React Hook Form** + **Zod** | latest | Performant, Zod schemas shared with API |
| Data fetching | **TanStack Query v5** (React Query) | 5.x | Server state cache; perfect tRPC companion |
| tRPC client | **@trpc/react-query** | v11 | Type-safe API calls end-to-end |
| Client state | **Zustand** | latest | Simpler than Redux; good for complex UI state |
| Tables | **TanStack Table v8** | 8.x | Headless, powerful, typed |
| Rich text | **TipTap v2** | 2.x | Proven in AIMS v1; collaborative editing ready |
| Charts | **Recharts** or **Tremor** | latest | Recharts carries over from v1; Tremor for dashboards |
| Date handling | **date-fns v3** | 3.x | Tree-shakable, locale-aware |
| i18n | **next-intl** | latest | Best Next.js 15 support, ICU format |
| Icons | **Lucide** | latest | Shadcn default, MIT license |
| Animation | **Framer Motion** | 11.x | For meaningful motion only (reduced-motion respected) |
| Testing | **Vitest** + **RTL** + **Playwright** | latest | Fast unit + component + E2E |
| Bundle analyzer | **@next/bundle-analyzer** | latest | Track bundle size |
| Monorepo | **Turborepo** + **pnpm** | latest | Shared packages across frontend/backend |

---

## Key Architectural Decisions

### 1. Server Components by Default
- **Server Components (RSC)** for initial page render — fast, SEO-friendly, no JS shipped for static UI
- **Client Components** only for interactivity (forms, state, effects)
- Clear file naming: `.server.tsx` vs `.client.tsx` when ambiguous
- Data fetched in Server Components; passed down as props

### 2. tRPC for All Data Operations
- **No fetch() calls scattered throughout components** — everything via tRPC hooks
- Type-safe end-to-end; compiler catches contract mismatches
- Integrates with React Query for caching, mutations, optimistic updates

### 3. Standard-Pack-Driven Dynamic Forms
- Finding forms, checklist forms, planning memo sections all rendered **from Standard Pack definitions**
- The pack defines fields; the UI renders them
- One engine handles GAGAS (4 elements), IIA (5 elements), SOX (3-6 elements), ISO (3 elements)
- See `STATE-AND-DATA.md §6`

### 4. Design Tokens Over Magic Numbers
- **All colors, spacing, typography, shadows** via design tokens
- Tenants can override primary color; inherits everything else
- Dark mode by CSS variable swap; no component changes

### 5. Accessibility Is Baseline (Not Add-On)
- **WCAG 2.1 AA compliance** from day one
- Radix UI primitives ensure keyboard nav + ARIA by default
- Automated axe-core in tests; manual screen reader testing
- See `ACCESSIBILITY.md`

### 6. i18n Ready From Day One
- Even English-only launch uses `next-intl` infrastructure
- Strings extracted; no hardcoded UI text
- Enables rapid locale additions (audit platforms sell globally)

### 7. Performance Budget Enforced
- **Core Web Vitals targets**: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Bundle size budgets per route enforced in CI
- Route-level code splitting automatic via App Router

### 8. Shadcn/ui — Copy, Customize, Own
- Components copied into our codebase (`components/ui/`)
- We own them: can customize, fork, replace without dependency fights
- Updates via `npx shadcn add button` when needed

### 9. Theming via CSS Variables
- Primary, secondary, accent, destructive, etc. → CSS vars
- Tenant sets their primary color → CSS vars updated → whole app rebranded
- Dark mode: different CSS vars; same components

### 10. Monorepo with Shared Packages
- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend
- `packages/ui` — Shared component library (optional; start in `apps/web`)
- `packages/validation` — Shared Zod schemas (used by forms + API)
- `packages/standard-packs` — Standard Pack data (imported by both)

---

## File Structure

```
frontend/
├── README.md                   ← You are here
├── ARCHITECTURE.md             ← Next.js app structure, routing, data flow
├── DESIGN-SYSTEM.md            ← Tokens, components, dark mode, tenant theming
├── STATE-AND-DATA.md           ← React Query + Zustand + forms + dynamic pack forms
├── UI-PATTERNS.md              ← Layout, tables, modals, loading, errors
├── ACCESSIBILITY.md            ← WCAG 2.1 AA compliance
├── I18N.md                     ← Internationalization strategy
├── PERFORMANCE.md              ← Web Vitals, optimization, budgets
├── TESTING.md                  ← Frontend testing strategy
└── implementation/
    ├── design-tokens.ts        ← Actual tokens (colors, spacing, typography)
    ├── tailwind.config.ts      ← Tailwind v4 config using tokens
    ├── example-page.tsx        ← Reference page showing conventions
    └── example-dynamic-form.tsx ← Pack-driven finding form (critical demo)
```

---

## App Structure (High-Level)

```
apps/web/
├── app/
│   ├── (public)/                       # Public pages (marketing, docs)
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Landing
│   │
│   ├── (auth)/                         # Unauthenticated auth flows
│   │   ├── layout.tsx                  # Minimal layout (no app shell)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── accept-invite/page.tsx
│   │   └── mfa/page.tsx
│   │
│   ├── (app)/                          # Authenticated app
│   │   ├── layout.tsx                  # App shell (sidebar + topbar)
│   │   ├── page.tsx                    # Dashboard
│   │   │
│   │   ├── engagements/
│   │   │   ├── page.tsx                # List
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx            # Overview
│   │   │   │   ├── layout.tsx          # Tab nav
│   │   │   │   ├── planning/page.tsx
│   │   │   │   ├── fieldwork/page.tsx
│   │   │   │   ├── findings/page.tsx
│   │   │   │   ├── reports/page.tsx
│   │   │   │   └── team/page.tsx
│   │   │   └── new/page.tsx            # Create wizard
│   │   │
│   │   ├── findings/
│   │   │   ├── page.tsx                # Register (cross-engagement)
│   │   │   ├── [id]/page.tsx           # Detail
│   │   │   └── new/page.tsx
│   │   │
│   │   ├── reports/
│   │   ├── qa/
│   │   ├── staff/
│   │   ├── audit-universe/
│   │   ├── admin/
│   │   └── settings/
│   │
│   ├── api/                            # Next.js API routes (thin, mostly proxy)
│   │   ├── auth/[...]/route.ts         # Better Auth endpoints
│   │   ├── trpc/[trpc]/route.ts        # tRPC handler
│   │   └── webhooks/[...]/route.ts
│   │
│   ├── layout.tsx                      # Root layout (providers, fonts)
│   ├── globals.css                     # Tailwind + tokens
│   ├── error.tsx                       # Root error boundary
│   └── not-found.tsx                   # 404
│
├── components/
│   ├── ui/                             # Shadcn components (owned)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── app/                            # App-specific components
│   │   ├── engagement-card.tsx
│   │   ├── finding-form.tsx
│   │   └── ...
│   ├── layout/                         # Shell components
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── main-content.tsx
│   └── patterns/                       # Reusable patterns
│       ├── page-header.tsx
│       ├── data-table.tsx
│       ├── empty-state.tsx
│       └── ...
│
├── lib/
│   ├── trpc/                           # tRPC client setup
│   │   ├── client.ts
│   │   ├── provider.tsx
│   │   └── server.ts                   # For Server Components
│   ├── auth/                           # Auth utilities
│   ├── cn.ts                           # Tailwind merge utility
│   ├── formatters.ts                   # Date/number/currency
│   └── analytics.ts
│
├── hooks/
│   ├── use-permissions.ts
│   ├── use-tenant.ts
│   ├── use-current-user.ts
│   └── ...
│
├── stores/                             # Zustand stores
│   ├── ui-store.ts
│   └── draft-store.ts
│
├── messages/                           # i18n translations
│   ├── en.json
│   └── ...
│
├── styles/
│   ├── tokens.css                      # Design token CSS vars
│   └── tenant-theme.css                # Tenant color overrides
│
├── public/
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── tsconfig.json
├── package.json
└── vitest.config.ts
```

---

## Development Workflow

### Starting a new feature
1. Design UI in Figma / on paper
2. Identify shared pattern (use existing or add to `components/patterns/`)
3. Create Zod schema (if form) in `packages/validation/`
4. Add tRPC procedure (if new endpoint) in `apps/api/`
5. Build page + components in `apps/web/`
6. Add tests (component + E2E for critical flows)
7. Verify a11y (Lighthouse + manual screen reader)
8. Verify i18n (all strings extracted)
9. Code review + merge

### Running locally
```bash
pnpm install                 # Install all workspace deps
pnpm dev                     # Runs web + api in parallel
pnpm test                    # Vitest in watch mode
pnpm test:e2e                # Playwright
pnpm storybook               # Component library (optional)
pnpm build                   # Production build
pnpm analyze                 # Bundle analysis
```

---

## Progressive Enhancement

- **Works with JS disabled** (for landing page; not a hard requirement for app)
- **Progressive loading**: Server Components render first, Client Components hydrate later
- **Offline resilience**: Service worker (PWA) for critical pages in Phase 7

---

## Status

- [x] Tech stack decided
- [x] File structure defined
- [x] Key design decisions documented
- [ ] All companion docs (9 more) in this folder
- [ ] Implementation code scaffolded (Phase 1)

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — Next.js 15 app structure, routing, data flow
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — Tokens, components, theming, accessibility baseline
- [STATE-AND-DATA.md](STATE-AND-DATA.md) — State management, forms, dynamic pack forms
- [UI-PATTERNS.md](UI-PATTERNS.md) — Layouts, tables, modals, loading/error states
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — WCAG 2.1 AA
- [I18N.md](I18N.md) — Internationalization
- [PERFORMANCE.md](PERFORMANCE.md) — Web Vitals, optimization
- [TESTING.md](TESTING.md) — Testing strategy
