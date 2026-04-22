# Performance

> Core Web Vitals targets, bundle budgets, optimization patterns, and CI enforcement. Performance is a feature — especially for data-dense enterprise apps on corporate laptops.

---

## 1. Performance Targets

### Core Web Vitals (Google's Field Metrics)

| Metric | Target | Stretch | Why |
|--------|--------|---------|-----|
| **LCP** (Largest Contentful Paint) | < 2.5s | < 1.8s | User sees primary content quickly |
| **INP** (Interaction to Next Paint) | < 200ms | < 100ms | App feels responsive on click/keystroke |
| **CLS** (Cumulative Layout Shift) | < 0.1 | < 0.05 | No jumping content |
| **TTFB** (Time to First Byte) | < 800ms | < 400ms | Server responds fast |
| **FCP** (First Contentful Paint) | < 1.8s | < 1.0s | Something visible early |

### Our Additional Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Initial JS (compressed)** | < 170KB per route | Webpack bundle analyzer |
| **Initial JS (compressed, dashboard)** | < 220KB | (charts justify more) |
| **Total page weight** | < 1MB first load | Lighthouse |
| **Time to Interactive (TTI)** | < 3.5s on 4G Fast | Lighthouse CI |
| **Route change (client nav)** | < 200ms | Perf monitoring |
| **Table render (1000 rows)** | < 500ms | Virtualized via TanStack Virtual |
| **Form submission feedback** | < 100ms (optimistic) | React Query optimistic updates |

### Device / Network Assumptions
- **Primary**: desktop Chrome, 8GB RAM, corporate wifi (~50Mbps)
- **Secondary**: laptop, 16GB RAM, home wifi
- **Measure against**: 4G Fast (Lighthouse throttling), 1.6Mbps down, 750Kbps up, 150ms RTT
- **Not optimizing for**: 3G or slower (enterprise customers don't have this baseline)

---

## 2. Bundle Budgets (Per Route)

Enforced in CI via `@next/bundle-analyzer` + custom threshold script.

| Route type | Budget (gzipped) |
|-----------|------------------|
| `(auth)/*` (login, etc.) | 80 KB |
| `(app)/` (dashboard) | 220 KB |
| `(app)/engagements` (list) | 180 KB |
| `(app)/engagements/[id]` (detail) | 200 KB |
| `(app)/findings/[id]` (detail with rich text) | 250 KB |
| `(app)/reports/[id]` (heavy — PDF preview) | 300 KB |
| `(app)/admin/*` | 200 KB |
| Shared vendor chunk | 140 KB |

**If a route exceeds budget**: CI fails. Fix before merging. No "just this once" exceptions — budgets only work if enforced.

### What Counts
- All JS (app + vendor + React + Next)
- All CSS (Tailwind purged)
- Fonts counted separately (not in JS budget)
- Images not counted (served via `<Image>`)

---

## 3. Bundling Strategy

### Route-Level Splitting (Automatic)
Next.js App Router splits automatically per route. Shared code hoists to common chunks.

### Dynamic Imports — Heavy Libraries
Lazy-load anything > 50KB that's not needed on initial render:

```tsx
// Heavy chart library — only load when dashboard route is active
const RechartsBar = dynamic(() => import("@/components/charts/recharts-bar"), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});

// Rich text editor — only load when opening finding detail in edit mode
const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), {
  loading: () => <EditorSkeleton />,
});

// PDF preview — only load when user clicks "Preview PDF"
const PDFPreview = dynamic(() => import("@/components/pdf-preview"), {
  loading: () => <Skeleton className="h-[800px]" />,
});
```

### Libraries to Lazy-Load
- `@tiptap/*` and all extensions (~80KB gzipped)
- `recharts` / `tremor` (~60-80KB)
- `framer-motion` (~35KB — only for routes that use it)
- `react-pdf` / PDF renderers (~150KB+)
- `@tanstack/react-virtual` (~5KB — eager OK, but only import where used)
- `date-fns` locale data (import specific locale, not all)
- `shiki` for code highlighting (~200KB — rarely used in audit UI; lazy)

### Tree-Shaking Discipline
- Always `import { X } from "lodash-es"` never `import _ from "lodash"` (we don't use lodash anyway)
- Radix imports specific primitives: `@radix-ui/react-dialog` not `@radix-ui/react`
- Lucide icons via named imports only: `import { User } from "lucide-react"`
- `date-fns` per-function: `import { format } from "date-fns"` (supports tree-shake)
- Avoid `import * as X` patterns

### ESLint Rules
- `import/no-default-export` for non-page files (default exports hurt tree-shaking)
- Custom rule: flag `import * as` except in whitelist

---

## 4. Server Components — Less JS

Server Components ship **zero JavaScript to the client** for their own rendering. We exploit this:

- Static content (page headers, metadata, labels) → Server Component
- Data fetching → Server Component (no client-side `useEffect` for initial data)
- Interactive widgets → Client Component (minimal, focused)

### Push "use client" Down
See `ARCHITECTURE.md §1`. The smaller the Client Component tree, the less JS ships.

### Example: Engagement Detail
```tsx
// page.tsx (Server Component) — ships no JS itself
<EngagementHeader engagement={engagement} />   {/* Server — pure display */}
<EngagementMetrics engagement={engagement} />  {/* Server */}
<EngagementTabs engagementId={id}>             {/* Client — URL-synced tabs */}
  <OverviewTab />                              {/* Server Component inside Client shell */}
</EngagementTabs>
```

The interactive tab nav is ~3KB. The tab content is Server Components — zero extra JS per tab.

---

## 5. Fonts

### Self-Hosted via `next/font`
```ts
import { Inter } from "next/font/google";
export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});
```

Benefits:
- No CLS from font swap (optional-metrics adjusted)
- No third-party fetch (privacy + speed)
- Subsetted to needed characters
- Auto-preload

### Font Loading Rules
- Max 2 font families (sans + mono)
- Max 4 weights per family (400, 500, 600, 700)
- `display: swap` with size-adjust metrics to avoid layout shift
- Preload only the primary font

### Variable Fonts
Inter variable font = one file for all weights. Smaller than loading 4 separate weights. Use when supported by library.

---

## 6. Images

### Always Use `next/image`
```tsx
import Image from "next/image";
<Image src="/logo.svg" alt="AIMS" width={120} height={32} priority />
```

### Rules
- Always specify `width` and `height` (prevents CLS)
- `priority` only for above-the-fold LCP images
- `alt` required (decorative: `alt=""`)
- Formats auto-negotiated (AVIF → WebP → original)
- Lazy by default; `loading="eager"` rare

### Responsive Images
```tsx
<Image src="/hero.jpg" alt="..." sizes="(max-width: 768px) 100vw, 50vw" fill />
```

### No External Image Hosts
All images served from our domain (or our CDN). Never hotlink. External = cache issues + privacy + reliability.

---

## 7. CSS Performance

### Tailwind v4 Advantages
- JIT (just-in-time) compilation — only used classes emitted
- Output typically < 15KB gzipped for a full app
- No runtime CSS-in-JS cost
- CSS variables enable theming without rebuilding

### Avoid
- Inline styles (prevents caching, larger HTML)
- Runtime style computation in React render
- Large global CSS files (everything in Tailwind or per-component)
- `@apply` overuse (defeats JIT purpose)

---

## 8. Data Fetching Performance

### Parallel Fetches
```tsx
// ❌ Serial — slow
const user = await trpc.user.me();
const engagement = await trpc.engagement.getById({ id });
const findings = await trpc.finding.list({ engagementId: id });

// ✅ Parallel — fast
const [user, engagement, findings] = await Promise.all([
  trpc.user.me(),
  trpc.engagement.getById({ id }),
  trpc.finding.list({ engagementId: id }),
]);
```

### tRPC Batching
`httpBatchLink` automatically batches multiple client calls within ~10ms into one HTTP request. Up to 10 concurrent queries become 1 round trip.

### Streaming
`<Suspense>` boundaries let fast parts render while slow parts fetch:

```tsx
<EngagementHeader engagement={engagement} />  {/* fast — rendered immediately */}
<Suspense fallback={<FindingsListSkeleton />}>
  <FindingsList engagementId={id} />          {/* slow — streams in */}
</Suspense>
```

### React Query Cache
- `staleTime: 30_000` — same data requested twice within 30s = cache hit
- Prefetch on hover for list → detail nav (perceived instant navigation)

### Prefetch on Hover
```tsx
<Link
  href={`/engagements/${id}`}
  onMouseEnter={() => utils.engagement.getById.prefetch({ id })}
>
  {title}
</Link>
```

Next.js also prefetches routes on hover automatically (JS + data). Combined with our tRPC prefetch = near-instant navigation.

---

## 9. Rendering Optimizations

### Don't Over-Memoize
`React.memo`, `useMemo`, `useCallback` — apply only when measured to help. Default React is fast; memoization has its own cost (equality checks, extra memory). Never premature.

**When to memoize:**
- Expensive pure computation in render (array of 10k items transformed)
- Component re-renders frequently with same props (profiled, not guessed)
- Passing callbacks to memoized children

**When NOT to memoize:**
- Every component by default
- Simple transforms
- One-time calculations
- Props that change every render anyway

### Virtualize Long Lists
Any list > 100 items → `@tanstack/react-virtual`:

```tsx
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 10,
});
```

Renders only visible rows + overscan. 10,000 rows = ~20 DOM nodes.

### Defer Non-Critical Updates
```tsx
const deferredQuery = useDeferredValue(query);
const results = expensiveFilter(data, deferredQuery);
```

React 19 concurrent features let search input stay responsive while heavy filter runs in background.

### Transition API
Use `startTransition` for non-urgent state updates (filter changes, sort changes):
```tsx
startTransition(() => setFilter(newFilter));
```

---

## 10. Caching Layers

| Layer | What | Lifetime |
|-------|------|----------|
| **CDN** (Cloudflare / Vercel Edge) | Static assets, public pages | 1 year (immutable with hash) |
| **Next.js Full Route Cache** | Static pages (marketing) | Build time |
| **Next.js Data Cache** (fetch cache) | Server-side data fetches | Per-tag or revalidate interval |
| **React Query** (client) | Client-side query results | 30s stale, 5min gc |
| **Browser HTTP cache** | Images, fonts, manifest | Per Cache-Control headers |

### Cache Keys Include Tenant
Every cache key includes `tenantId` — never leak data across tenants. Both server-side (fetch cache tags like `tenant:${tenantId}:engagement:${id}`) and client-side (implicit via tRPC context).

### Cache Invalidation on Mutation
- Server mutation → `revalidateTag(\`tenant:${tenantId}:engagement\`)` invalidates server cache
- React Query → `utils.engagement.list.invalidate()` invalidates client cache
- Next.js Router Cache → `router.refresh()` fetches fresh RSC

---

## 11. Network Optimization

### HTTP/2 and HTTP/3
Enabled on production. Multiplexed streams — multiple requests share a connection, no head-of-line blocking.

### Compression
- Brotli (preferred) or gzip on all text responses
- Configured at CDN / edge level
- Pre-compressed static assets in build (`br` + `gz` variants)

### Preload Critical Resources
```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preconnect" href="https://api.aims.io" />
<link rel="dns-prefetch" href="https://cdn.aims.io" />
```

Managed via `next/font` and Next.js Head.

### API Payload Size
- tRPC response uses SuperJSON — slightly larger than raw JSON but preserves types
- Avoid sending fields the client doesn't need (explicit `select` in tRPC procedures)
- Paginate everything (never return > 1000 items)
- Don't return binary data in JSON (use presigned S3 URLs for attachments)

---

## 12. Monitoring — Real User Metrics

### Production Web Vitals
Collect via Next.js built-in `reportWebVitals`:

```ts
// app/layout.tsx
export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Send to analytics (Vercel, Datadog, Sentry Performance)
  analytics.track("web-vital", {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    label: metric.label,
    route: window.location.pathname,
  });
}
```

### Tools
| Tool | Purpose |
|------|---------|
| **Vercel Analytics** (if hosting on Vercel) | Core Web Vitals in prod, per-route |
| **Sentry Performance** | Trace individual slow transactions, error correlation |
| **Datadog RUM** | Advanced — session replay, user journeys |
| **Lighthouse CI** | PR-level regression detection (synthetic, every PR) |

### Alert Thresholds
- LCP p75 > 3s → page team
- INP p75 > 300ms → page team
- JS bundle > budget + 10% → CI fails
- Error rate > 0.5% → page oncall

---

## 13. Performance Budget Enforcement (CI)

### Lighthouse CI
Runs on every PR against preview deployment:
- 10+ representative routes
- Fails PR if any page Performance score < 85
- Posts summary as PR comment

### Bundle Size Check
```bash
pnpm analyze && node scripts/check-bundles.js
```

Script reads Next.js build output, compares against `bundle-budgets.json`, fails if over.

### Typescript Build Time
Budget: < 60s on CI. Slowness usually means cyclic deps or over-generic types.

---

## 14. Optimization Playbook — When Perf Regresses

### Step 1: Measure
Never optimize without data. Tools:
- Chrome DevTools Performance tab
- React DevTools Profiler
- Lighthouse
- Web Vitals browser extension

### Step 2: Identify Bottleneck
- LCP slow? → image, font, or render-blocking JS
- INP slow? → long task on main thread (expensive render or JS work)
- CLS high? → missing dimensions, async layout
- Bundle large? → heavy dep or non-lazy import

### Step 3: Apply Fix
Common fixes in order of preference:
1. Remove the dependency / feature
2. Lazy-load it
3. Server-render it instead
4. Virtualize / paginate
5. Memoize hot path
6. Debounce / throttle updates
7. Web Worker for heavy computation (rare)

### Step 4: Verify
Measure again. Bundle size report. Lighthouse score. Regression test to prevent recurrence.

---

## 15. Anti-Patterns We Avoid

- **Barrel exports** (`index.ts` re-exporting everything) — breaks tree-shaking
- **Large Context values** — re-renders entire tree on any change
- **Inline object/array literals** in JSX (`style={{}}`) — creates new reference every render
- **Non-memoized expensive computation in render body**
- **Big libraries for small needs** (lodash, moment) — use native / date-fns
- **Blocking JS** before `<main>` content
- **Un-paginated tables** — 10,000 rows = browser locked
- **N+1 queries** — fetch one engagement, then fire 50 requests for findings. Use `include` in Prisma / procedure-level joins
- **Client-side filtering of large datasets** — server should filter and paginate

---

## 16. Progressive Enhancement

### Works Without JavaScript?
- **Marketing / public pages**: yes (static, crawlable)
- **Login**: yes (form submits via POST; Server Action)
- **App chrome**: minimally — route navigation works, but rich interactivity requires JS
- **Full app**: no — we rely on JS for tRPC, React Query, interactive forms. Not a goal to be fully functional without JS

### Slow JS Loading
- Skeleton UI appears while JS loads (React hydration)
- Never show a blank page between HTML and hydration
- Never block interactions on third-party scripts

---

## 17. Mobile Performance

Though desktop-first, mobile must not be broken:

- Same bundle (no separate mobile build)
- Tap targets ≥ 44px
- Viewport meta set correctly
- No 300ms tap delay (handled by default)
- Images sized appropriately (`sizes` attribute)

---

## 18. Service Worker / PWA (Phase 7+)

Not in Phase 1. Later we add:
- Offline-read for recent engagements
- Background sync for comment submissions
- Push notifications for approvals (where permitted)

Via **Serwist** (next-pwa successor) — strict caching strategies per route.

---

## 19. Related Documents

- `ARCHITECTURE.md` — Server Components, Suspense, streaming
- `STATE-AND-DATA.md` — React Query caching, optimistic updates
- `TESTING.md` — Lighthouse CI, bundle size checks
- `UI-PATTERNS.md` — virtualized tables, pagination
