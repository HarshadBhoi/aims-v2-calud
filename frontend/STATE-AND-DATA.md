# State & Data

> Server state, client state, form state, and the Standard-Pack-driven dynamic form engine — the most important frontend subsystem.

---

## 1. State Taxonomy — Four Kinds

| Kind | Owner | Examples | Tool |
|------|-------|----------|------|
| **Server state** | Backend | Engagements, findings, users, standard packs | tRPC + TanStack Query |
| **URL state** | Router | `?status=open`, `/engagements/[id]/planning`, `?tab=findings&page=2` | `useSearchParams` + `useRouter` |
| **Form state** | Component | Fields being edited, validation, dirty tracking | React Hook Form |
| **UI state** | Client | Sidebar collapsed, modal open, selected rows, draft text | Zustand (global) or `useState` (local) |

**Rule**: if the source of truth is the database → server state. If it's "where am I in the app" → URL. If it's "what am I editing right now" → form. Everything else → UI.

### Anti-patterns to avoid
- Storing server data in Zustand (goes stale; doesn't invalidate)
- Storing URL state in React state (breaks back/forward, breaks sharing)
- Using Context for server data (use React Query)
- Duplicating state across layers (pick one owner)

---

## 2. Server State — TanStack Query + tRPC

### Client Setup (`lib/trpc/provider.tsx`)

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./client";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,             // 30s — most data stays fresh briefly
        gcTime: 5 * 60_000,            // 5min — drop from cache
        retry: (count, error) => {
          if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) return false;
          return count < 2;
        },
        refetchOnWindowFocus: true,    // audit users multi-task — pick up team changes
        refetchOnReconnect: true,
      },
      mutations: {
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    },
  }));

  const [trpcClient] = useState(() => trpc.createClient({
    links: [httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: () => ({ "x-trpc-source": "react" }),
    })],
  }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### Query Patterns

```tsx
// Basic query
const { data, isLoading, error } = trpc.engagement.list.useQuery({ status: "IN_PROGRESS" });

// With options
const { data } = trpc.engagement.getById.useQuery(
  { id },
  {
    enabled: Boolean(id),
    staleTime: 0,              // always refetch detail views (mutations change often)
    placeholderData: keepPreviousData,  // no loading flash during filter changes
  }
);

// Paginated — use keepPreviousData
const { data } = trpc.finding.list.useQuery(
  { engagementId, page, limit: 25 },
  { placeholderData: keepPreviousData }
);

// Infinite query (cursor-based)
const query = trpc.audit.log.useInfiniteQuery(
  { limit: 50 },
  { getNextPageParam: (last) => last.nextCursor }
);
```

### Mutation Patterns — Optimistic Updates

```tsx
const utils = trpc.useUtils();

const updateFinding = trpc.finding.update.useMutation({
  onMutate: async (input) => {
    await utils.finding.getById.cancel({ id: input.id });
    const prev = utils.finding.getById.getData({ id: input.id });
    utils.finding.getById.setData({ id: input.id }, (old) =>
      old ? { ...old, ...input } : old
    );
    return { prev };
  },
  onError: (err, input, ctx) => {
    if (ctx?.prev) utils.finding.getById.setData({ id: input.id }, ctx.prev);
    toast.error("Update failed — your changes were reverted");
  },
  onSettled: (_, __, input) => {
    utils.finding.getById.invalidate({ id: input.id });
    utils.finding.list.invalidate();
  },
});
```

### Query Key Hygiene
tRPC generates query keys automatically — we don't manage them manually. Use `utils.<router>.<procedure>.invalidate()` with partial inputs for pattern matching.

### Prefetching (server-side)

```tsx
// Server Component
const helpers = createServerSideHelpers({ router: appRouter, ctx, transformer: superjson });
await Promise.all([
  helpers.engagement.list.prefetch({ status: "IN_PROGRESS" }),
  helpers.user.me.prefetch(),
]);
return (
  <HydrationBoundary state={dehydrate(helpers.queryClient)}>
    <EngagementListClient />
  </HydrationBoundary>
);
```

---

## 3. URL State — nuqs (typed search params)

For filters, pagination, tabs, and anything that should be shareable/back-buttonable, use `nuqs`:

```tsx
import { useQueryState, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";

const [tab, setTab] = useQueryState(
  "tab",
  parseAsStringEnum(["overview", "planning", "fieldwork", "findings"]).withDefault("overview")
);
const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
```

### Why nuqs over raw `useSearchParams`
- Type-safe parsing and serialization
- Default values handled
- Batched updates (single router push for multiple changes)
- SSR-compatible

### URL State Rules
- **Filters, sorts, pagination, tabs → URL** (shareable, back-button works)
- **Currently-editing form data → component state** (not URL)
- **Modal open/closed → URL if the modal is a "page"** (shareable), otherwise component state
- **Never put secrets or PII in URL params**

---

## 4. Client State — Zustand

### When to Use Zustand (vs `useState`)
- State shared across non-parent-child components (sidebar, toasts, command palette)
- State that must survive component unmount
- State with multiple consumers in different parts of the tree

### When to Use `useState` / `useReducer`
- State local to one component or tight parent-child group
- Form field values (use React Hook Form instead)
- Anything that could live in URL (put it in URL)

### Store Pattern — Slices

```ts
// stores/ui-store.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  recentEngagements: string[];
  addRecentEngagement: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

        commandPaletteOpen: false,
        openCommandPalette: () => set({ commandPaletteOpen: true }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),

        recentEngagements: [],
        addRecentEngagement: (id) => set((s) => ({
          recentEngagements: [id, ...s.recentEngagements.filter((x) => x !== id)].slice(0, 10),
        })),
      }),
      {
        name: "aims-ui",
        partialize: (s) => ({
          sidebarCollapsed: s.sidebarCollapsed,
          recentEngagements: s.recentEngagements,
        }),
      }
    ),
    { name: "UIStore" }
  )
);
```

### Selector Discipline
Always select the smallest slice needed — avoid re-rendering on unrelated changes:

```tsx
// ✅ Only re-renders when sidebarCollapsed changes
const collapsed = useUIStore((s) => s.sidebarCollapsed);

// ❌ Re-renders on every store change
const { sidebarCollapsed, toggleSidebar } = useUIStore();
```

Use `useShallow` from `zustand/shallow` for multi-field selections.

### Our Planned Stores
| Store | Purpose |
|-------|---------|
| `ui-store.ts` | Sidebar state, command palette, recent items, theme |
| `draft-store.ts` | In-progress form drafts (auto-save to localStorage) |
| `selection-store.ts` | Multi-select state for bulk operations |
| `filter-preset-store.ts` | Saved filter presets (user-scoped) |

---

## 5. Form State — React Hook Form + Zod

### Base Pattern

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { engagementCreateSchema, EngagementCreate } from "@validation/engagement";

export function EngagementForm() {
  const form = useForm<EngagementCreate>({
    resolver: zodResolver(engagementCreateSchema),
    defaultValues: {
      title: "",
      type: "PERFORMANCE",
      fiscalYear: getCurrentFY(),
      standardPackId: "",
    },
    mode: "onBlur",                    // validate on blur, revalidate on change after first submit
  });

  const utils = trpc.useUtils();
  const create = trpc.engagement.create.useMutation({
    onSuccess: (data) => {
      utils.engagement.list.invalidate();
      router.push(`/engagements/${data.id}`);
    },
  });

  const onSubmit = form.handleSubmit((data) => create.mutate(data));

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... */}
      </form>
    </Form>
  );
}
```

### Schema Sharing — `packages/validation/`
Zod schemas live in `packages/validation/` and are consumed by:
- **Frontend forms** (as `zodResolver`)
- **tRPC input validation** (as procedure input schemas)
- **Server actions** (for progressive-enhancement forms)
- **Standard pack validators** (for field definitions)

One schema = one source of truth. No drift between client-side validation and API contract.

### Validation Strategy
- **Client-side**: `mode: "onBlur"` — feels responsive, no noise while typing
- **After submit**: `reValidateMode: "onChange"` — immediate feedback when correcting errors
- **Server-side**: always re-validate. Client validation is UX; server is security
- **Server errors → field errors**: tRPC errors with a `path` map to `form.setError(path, { message })`

### Auto-Save Drafts (long forms)
```tsx
const values = form.watch();
useDebouncedCallback(
  () => draftStore.saveDraft(formId, values),
  2000,
  [values]
);
```

Drafts in Zustand + localStorage. Cleared on successful submit.

### Form Arrays (dynamic fields)
Use `useFieldArray` for repeatable sections (e.g., recommendations under a finding):

```tsx
const { fields, append, remove, move } = useFieldArray({
  control: form.control,
  name: "recommendations",
});
```

---

## 6. Dynamic Forms from Standard Packs — THE KEY ENGINE

**This is the most important pattern in the app.** Finding forms, checklist forms, planning memo sections — all rendered **from Standard Pack definitions**, not hardcoded.

### Why Dynamic?
A GAGAS finding has **4 elements** (Criteria, Condition, Cause, Effect). An IIA GIAS finding has **5 elements** (add Recommendation). A SOX finding has **3-6** depending on control type. ISO 19011 has **3** (Nonconformity/Observation/OFI).

We cannot hardcode 4+ finding forms — that's exactly the code duplication we're avoiding. Instead: the pack defines fields; the engine renders them.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Standard Pack (JSON data — packages/standard-packs/)          │
│  findingElements: [                                            │
│    { code: "criteria", label: "Criteria", type: "rich-text",   │
│      required: true, helpText: "The standard against which..." },
│    { code: "condition", label: "Condition", type: "rich-text", ... },
│    { code: "cause", ... },                                     │
│    { code: "effect", ... },                                    │
│  ]                                                             │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  DynamicFormEngine (components/patterns/dynamic-form-engine.tsx)│
│  1. Read pack.findingElements                                  │
│  2. Build Zod schema dynamically                               │
│  3. Render fields via FieldRegistry                            │
│  4. Submit: save to elementValues JSONB on finding             │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  Finding record                                                │
│  { id, packId, elementValues: {                                │
│      criteria: "<p>Per GAGAS §5.12...</p>",                    │
│      condition: "<p>We observed...</p>",                       │
│      cause: "<p>...</p>",                                      │
│      effect: "<p>...</p>"                                      │
│  }}                                                            │
└────────────────────────────────────────────────────────────────┘
```

### Field Types Registry (`components/patterns/field-registry.tsx`)

```tsx
type FieldDefinition = {
  code: string;               // stable key (e.g., "criteria")
  label: string;              // display (i18n-keyed)
  helpText?: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  validation?: ValidationRules;
  options?: Option[];         // for select/radio/multi-select
  conditional?: Conditional;  // show-if expressions
  layout?: { cols?: 1 | 2 | 3 | "full"; order?: number };
};

type FieldType =
  | "text"              // short text input
  | "textarea"          // multi-line plain text
  | "rich-text"         // TipTap editor
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "date-range"
  | "select"            // single-choice dropdown
  | "multi-select"
  | "radio-group"
  | "checkbox"
  | "checkbox-group"
  | "switch"
  | "file-upload"       // single file
  | "file-upload-multi"
  | "user-picker"       // people
  | "reference"         // lookup to another entity (findings, risks, etc.)
  | "rating"            // 1-5 or traffic light
  | "severity"          // Critical/High/Medium/Low
  | "section"           // visual grouping, not a field
  | "divider"
  | "custom";           // escape hatch — renderer injected by pack

// Registry maps type → component
export const FieldRegistry: Record<FieldType, React.FC<FieldProps>> = {
  "text": TextField,
  "rich-text": RichTextField,
  "date": DateField,
  // ...
};
```

### Dynamic Schema Builder

```ts
// lib/dynamic-form/build-schema.ts
export function buildDynamicSchema(fields: FieldDefinition[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let schema = baseSchemaForType(field.type);        // z.string() for text, z.number() for number, etc.

    if (field.validation?.minLength) schema = schema.min(field.validation.minLength);
    if (field.validation?.maxLength) schema = schema.max(field.validation.maxLength);
    if (field.validation?.pattern) schema = schema.regex(new RegExp(field.validation.pattern));
    if (field.validation?.custom) schema = schema.refine(...);

    if (!field.required) schema = schema.optional();

    shape[field.code] = schema;
  }

  return z.object(shape);
}
```

### DynamicFormEngine Component

```tsx
// components/patterns/dynamic-form-engine.tsx
interface Props {
  fields: FieldDefinition[];
  defaultValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}

export function DynamicFormEngine({ fields, defaultValues, onSubmit, readOnly }: Props) {
  const schema = useMemo(() => buildDynamicSchema(fields), [fields]);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  // Handle conditional visibility
  const values = form.watch();
  const visibleFields = fields.filter((f) =>
    !f.conditional || evaluateConditional(f.conditional, values)
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-12 gap-6">
        {visibleFields.map((field) => {
          const Component = FieldRegistry[field.type];
          const cols = field.layout?.cols ?? "full";
          const colSpan = cols === 1 ? "col-span-4" : cols === 2 ? "col-span-6" : "col-span-12";

          return (
            <div key={field.code} className={colSpan}>
              <Component field={field} control={form.control} readOnly={readOnly} />
            </div>
          );
        })}
      </form>
    </Form>
  );
}
```

### Conditional Fields

```ts
// Field definition
{
  code: "regulatoryImpactDetails",
  type: "rich-text",
  conditional: { field: "hasRegulatoryImpact", op: "eq", value: true },
}

// Expression evaluator
function evaluateConditional(cond: Conditional, values: Record<string, unknown>): boolean {
  const actual = values[cond.field];
  switch (cond.op) {
    case "eq":  return actual === cond.value;
    case "neq": return actual !== cond.value;
    case "in":  return Array.isArray(cond.value) && cond.value.includes(actual);
    case "gt":  return typeof actual === "number" && actual > (cond.value as number);
    case "truthy": return Boolean(actual);
  }
}
```

### Where DynamicFormEngine Is Used

| Use case | Source | Fields count |
|----------|--------|--------------|
| Finding elements (GAGAS/IIA/SOX/ISO) | `pack.findingElements` | 3-6 |
| Planning memo sections | `pack.planningMemoSections` | 14-20 |
| QA checklist items | `pack.qaChecklist` | 20-60+ |
| Work program steps | `pack.workProgramTemplate.steps` | variable |
| Recommendation fields | `pack.recommendationElements` | 3-5 |
| Independence declaration | `pack.independenceChecklist` | 10-15 |
| Engagement intake form | `pack.engagementIntake` | 10-20 |

One engine. Seven+ use cases. Zero hardcoded forms beyond the auth/admin layer.

### What's Still Hardcoded
The **frame** around dynamic forms (save button, navigation, breadcrumbs, approval buttons) is hardcoded. Only the *content fields* are dynamic. This split is deliberate — the workflow is the same across standards; the substance differs.

---

## 7. Form Array Pattern (Dynamic Lists)

When a field is a repeating structure (e.g., "list of affected controls"):

```tsx
const { fields, append, remove } = useFieldArray({ control, name: "affectedControls" });

return (
  <div className="space-y-3">
    {fields.map((f, i) => (
      <div key={f.id} className="flex gap-2">
        <FormField
          control={control}
          name={`affectedControls.${i}.controlId`}
          render={({ field }) => <ControlPicker {...field} />}
        />
        <Button variant="ghost" size="icon" onClick={() => remove(i)}>
          <TrashIcon />
        </Button>
      </div>
    ))}
    <Button variant="outline" onClick={() => append({ controlId: "" })}>
      <PlusIcon /> Add control
    </Button>
  </div>
);
```

Keyed on `f.id` (RHF's internal id), never on index — prevents list-reorder bugs.

---

## 8. Real-Time Updates (Phase 6+)

For collaborative editing (multiple auditors on one engagement):

| Feature | Mechanism |
|---------|-----------|
| Presence (who's viewing) | Server-Sent Events (SSE) → Zustand presence store |
| Notifications | SSE → toast + sidebar badge |
| Approval status updates | SSE → React Query cache invalidation |
| Collaborative rich text | TipTap + Y.js over WebSocket (Phase 7) |

Not WebSockets for everything — SSE is simpler, works through proxies, and fits our use case (server → client notifications).

---

## 9. Draft & Autosave Strategy

### Three Levels of Drafts

| Level | Scope | Storage | Lifetime |
|-------|-------|---------|----------|
| **Field-level autosave** | Single field (rich text editor) | Component state, debounced | Until form closes |
| **Form-level draft** | Whole form in progress | Zustand + localStorage | Until submit or explicit discard |
| **Server-side draft** | Entity-level (e.g., finding with `status: DRAFT`) | Database | Until submitted for review |

### Auto-Save UX Rules
- Show "Saving..." indicator briefly on autosave
- Show "Saved" with timestamp when idle
- Never block typing during autosave — fire and forget
- On navigation away from unsaved form: confirm dialog
- On page reload: restore from localStorage, offer "resume" or "discard"

---

## 10. Search & Filter Composition

For list views with many filters (engagement list, finding register):

```tsx
// URL params drive filters
const [filters, setFilters] = useFilterParams({
  status: parseAsArrayOf(parseAsString).withDefault([]),
  severity: parseAsArrayOf(parseAsString).withDefault([]),
  q: parseAsString.withDefault(""),
  dateFrom: parseAsIsoDateTime,
  dateTo: parseAsIsoDateTime,
  page: parseAsInteger.withDefault(1),
  sort: parseAsString.withDefault("createdAt:desc"),
});

// Query derived from URL
const { data } = trpc.finding.list.useQuery(filters, { placeholderData: keepPreviousData });

// Debounced search
const [searchInput, setSearchInput] = useState(filters.q);
const debouncedQ = useDebouncedValue(searchInput, 300);
useEffect(() => setFilters({ q: debouncedQ, page: 1 }), [debouncedQ]);
```

### Saved Filter Presets
Users can save a filter combination as a named preset ("My open high findings") — stored in `filter-preset-store.ts` + persisted server-side for cross-device access.

---

## 11. Permission-Aware UI

Permissions decorated at the query level:

```tsx
// Server returns decorated entity
type Finding = {
  id: string;
  // ... data fields
  _can: {
    edit: boolean;
    approve: boolean;
    reject: boolean;
    delete: boolean;
  };
};

// UI checks on _can
<Button disabled={!finding._can.approve} onClick={approve}>Approve</Button>
{finding._can.edit && <Button>Edit</Button>}
```

Never evaluate permissions in the UI — the server decides, the UI renders. Prevents permission drift between client and server.

For bulk permissions (list views), server returns `_can` per row. For expensive checks, lazy-load on hover/focus of action menu.

---

## 12. Error Handling in Data Flows

| Error type | Where caught | UI |
|------------|--------------|-----|
| Network failure | React Query retry + `error` state | Inline retry card with `<ErrorState>` |
| 401 Unauthorized | TRPC link interceptor | Redirect to login |
| 403 Forbidden | Procedure level | Inline "you don't have permission" card |
| 404 Not Found | Server Component `notFound()` | `not-found.tsx` |
| 409 Conflict (optimistic lock) | Mutation `onError` | Modal: "Someone else updated this — reload?" |
| 422 Validation | Mutation `onError` | Field-level errors via `form.setError()` |
| 500 Server error | Error boundary | `error.tsx` + Sentry report |

---

## 13. Performance Considerations

- **Batch requests**: `httpBatchLink` batches tRPC calls within a ~10ms window — pays off when a page makes 3+ queries
- **Prefetch on hover**: for list → detail navigation, prefetch on link hover via `utils.engagement.getById.prefetch({ id })` in `onMouseEnter`
- **Virtualize large lists**: TanStack Virtual for any list > 100 items (audit log, finding register in large engagements)
- **Defer expensive computations**: `useDeferredValue` for search input → filter derivation
- **Memoize derived data**: `useMemo` only for actually expensive transforms; don't default to memoization

---

## 14. Testing State Logic

| What | Tool | Pattern |
|------|------|---------|
| Zod schema validation | Vitest | Unit tests per schema |
| Zustand stores | Vitest + `@testing-library/react` | Create store per test, assert state transitions |
| React Query hooks | Vitest + `@testing-library/react` + MSW | Mock tRPC responses, assert loading/error/success |
| Form submission | RTL `userEvent` | Fill fields, submit, assert mutation called with correct payload |
| Dynamic form engine | RTL | Feed varied `FieldDefinition[]`, assert correct fields render + validate |

See `TESTING.md` for full strategy.

---

## 15. Related Documents

- `README.md` — tech stack
- `ARCHITECTURE.md` — rendering model, data fetching lanes
- `UI-PATTERNS.md` — how list/detail/form patterns wire state
- `../data-model/standard-pack-schema.ts` — pack schema that drives dynamic forms
- `../api/trpc/` — tRPC routers the client consumes
- `implementation/example-dynamic-form.tsx` — reference implementation
