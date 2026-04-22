# UI Patterns

> Reusable layout, table, modal, loading, error, empty, and workflow patterns. The repeating shapes that make the app feel coherent.

---

## 1. Page Layouts — Four Templates

Every page in `(app)/` uses one of four layout templates. No free-form layouts.

### 1.1 List Page
Primary use: engagement list, finding register, report list, staff directory.

```
┌─ PageHeader ────────────────────────────────────────────┐
│  Breadcrumb                                             │
│  Title                              [Filter] [+ New]    │
│  Description                                            │
├─────────────────────────────────────────────────────────┤
│  StatCards (optional) — 2-4 KPI tiles                   │
├─────────────────────────────────────────────────────────┤
│  FilterBar — search + status chips + advanced           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DataTable or CardGrid                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Pagination                                             │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Detail Page (with tabs)
Primary use: engagement detail, finding detail, report detail.

```
┌─ PageHeader ────────────────────────────────────────────┐
│  Breadcrumb                                             │
│  Title [StatusBadge]              [Actions ▾] [Approve] │
│  Metadata (author, dates, severity)                     │
├─ TabNav (URL-synced) ───────────────────────────────────┤
│  Overview │ Planning │ Fieldwork │ Findings │ Reports   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tab content (scrolls independently)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Form Page (wizard or single-page)
Primary use: new engagement, new finding, new report.

```
┌─ PageHeader ────────────────────────────────────────────┐
│  Breadcrumb > Cancel                                    │
│  Title                                                  │
│  Description                                            │
├─────────────────────────────────────────────────────────┤
│  Progress indicator (wizard only)                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Form content (max-w-2xl for single-column forms)       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Sticky footer: [Cancel] ────────── [Save draft] [Next] │
└─────────────────────────────────────────────────────────┘
```

### 1.4 Dashboard Page
Primary use: home dashboard, executive summary, tenant admin overview.

```
┌─ PageHeader ────────────────────────────────────────────┐
│  Title (no breadcrumb — root page)   [Date range ▾]     │
├─────────────────────────────────────────────────────────┤
│  StatCards (4 across at xl)                             │
├─────────────────────────────────────────────────────────┤
│  Main chart (full-width)                                │
├────────────────────┬────────────────────────────────────┤
│  Secondary chart   │  Activity feed / recent items      │
├────────────────────┴────────────────────────────────────┤
│  Data table (top findings, pending approvals, etc.)     │
└─────────────────────────────────────────────────────────┘
```

### Layout Component API

```tsx
// components/patterns/page-layout.tsx
<PageLayout
  header={<PageHeader title="Engagements" breadcrumb={[...]} actions={<NewButton />} />}
  filters={<FilterBar />}              // optional
  stats={<StatCards />}                // optional
>
  <EngagementTable />
</PageLayout>
```

---

## 2. App Shell

### Components
- **`<Sidebar>`** — collapsible, persists in `ui-store`. 240px expanded, 64px collapsed
- **`<Topbar>`** — 56px, contains: tenant switcher, search trigger, notifications, user menu
- **`<MainContent>`** — scrollable region for page content
- **`<CommandPalette>`** — ⌘K / Ctrl+K triggered, renders over everything

### Sidebar Navigation
Two-tier:
- **Sections** (always visible): Dashboard, Engagements, Findings, Reports, QA, Admin
- **Sub-nav** within section: appears in sidebar when section is active (e.g., Engagements > List, Create, Planning Memos)

Active route determined by pathname matching. Icons + labels when expanded; icons + tooltip when collapsed.

### Keyboard Shortcuts (Global)
| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘/` | Show all shortcuts |
| `g e` | Go to engagements |
| `g f` | Go to findings |
| `g d` | Go to dashboard |
| `n e` | New engagement |
| `n f` | New finding |
| `[` / `]` | Prev/next tab within detail page |
| `?` | Show context help |

Registered via `useHotkeys` hook. Scoped to routes where they apply.

---

## 3. Tables — TanStack Table v8

### The DataTable Pattern

```tsx
<DataTable
  columns={columns}
  data={data}
  loading={isLoading}
  onRowClick={(row) => router.push(`/engagements/${row.id}`)}
  pagination={{ page, pageSize, total, onPageChange: setPage }}
  sorting={{ sort, onSortChange: setSort }}
  selection={{ selectedIds, onSelectionChange: setSelectedIds }}
  emptyState={<EmptyState ... />}
/>
```

### Column Definition Pattern

```tsx
const columns: ColumnDef<Finding>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link href={`/findings/${row.original.id}`} className="font-medium hover:underline">
        {row.original.title}
      </Link>
    ),
    size: 400,
    enableSorting: true,
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <SeverityBadge value={row.original.severity} />,
    size: 120,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge value={row.original.status} />,
    size: 120,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => <RelativeTime date={row.original.createdAt} />,
    size: 120,
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActionsMenu row={row.original} />,
    size: 64,
  },
];
```

### Table Features
- **Server-side pagination, sorting, filtering** — never fetch all data
- **Column resizing** — user preference persisted in `ui-store`
- **Column visibility toggle** — available via column menu
- **Row selection** — checkbox column, "select all", "select all across pages"
- **Bulk actions** — appear in a floating bar when rows selected
- **Virtualization** — `useVirtualizer` when `data.length > 100`
- **Sticky header** — `sticky top-0 bg-background`
- **Row hover** — subtle `hover:bg-accent/50`
- **Clickable rows** — navigate on row click; cursor pointer; right-aligned overflow menu
- **Empty state** — replace entire body with `<EmptyState>` when no data

### Dense Mode
For audit log viewing, offer a density toggle — compact (32px rows), normal (40px), relaxed (56px). Preference persisted per-user.

### Mobile: Card Fallback
Below `md` breakpoint, tables reflow as cards. Column order becomes vertical field stack. Primary column becomes card title.

---

## 4. Filter Bar

### Pattern

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 Search...  │  [Status ▾]  [Severity ▾]  [Period ▾]  [+ More] │
│                                                        [Clear all]│
└──────────────────────────────────────────────────────────────────┘
```

### Components
- **Search input** — icon on left, clear (X) on right when text present. Debounced 300ms
- **Quick filters** — dropdown per filter, shows chips when active
- **More filters** — popover with less-common filters (created-by, engagement, tags)
- **Active filter chips** — shown below bar as removable pills
- **Clear all** — right-aligned, only shown when filters active
- **Save preset** — dropdown: save current filter combo as named preset

### Filter State Lives in URL
All filter state → nuqs query params. Page is fully shareable/bookmarkable. Back button restores previous filter state.

---

## 5. Modals & Dialogs

### Four Variants

| Variant | Trigger | Dismissible | Use |
|---------|---------|-------------|-----|
| **Dialog** | Inline action | Esc, click outside, X | Simple confirmations, short forms |
| **AlertDialog** | Destructive action | Only action buttons | "Are you sure you want to delete?" |
| **Sheet** | Side panel | Esc, click outside, X | Secondary context, filters, details |
| **FullScreenDialog** | Complex action | Only action buttons | Long forms (10+ fields), multi-step |

### Rules
- **Never nest modals** — close one before opening another (or use steps within one modal)
- **Destructive actions → AlertDialog** — never a regular Dialog for delete/approve/reject
- **Never dismiss on outside click for forms with data** — risk of data loss. Confirm or disable
- **Initial focus**: primary action button (or first input in a form)
- **Return focus** to trigger element on close (Radix handles this)
- **Max width**: `max-w-md` for alert, `max-w-lg` for dialog, `max-w-2xl` for form, full for sheet

### Confirm Pattern

```tsx
<ConfirmDialog
  title="Reject this finding?"
  description="This will send it back to the author with your comments. They'll need to revise and resubmit."
  confirmLabel="Reject"
  confirmVariant="destructive"
  onConfirm={async () => { await reject.mutateAsync({ id, comments }); }}
>
  <Textarea placeholder="Comments (required)" required />
</ConfirmDialog>
```

---

## 6. Toasts / Notifications

Using **Sonner** (Shadcn default).

### Placement
Top-right on desktop, top-center on mobile. Stacks vertically. Max 3 visible; older ones collapse.

### Types
| Type | Duration | Dismissible |
|------|----------|-------------|
| Success | 4s | Auto + manual |
| Info | 5s | Auto + manual |
| Warning | 6s | Auto + manual |
| Error | Persistent | Manual only |
| Loading | Until resolved | No |

### Usage

```tsx
import { toast } from "sonner";

toast.success("Finding created");
toast.error("Update failed", { description: err.message });
toast.promise(mutation.mutateAsync(data), {
  loading: "Submitting for approval...",
  success: "Submitted",
  error: (e) => `Failed: ${e.message}`,
});
```

### Rules
- **Success toasts for quick actions** (save, delete, duplicate)
- **Inline feedback for form validation** — never toast a field error
- **Errors with actionable info** — include a description, never just "Something went wrong"
- **No toast for expected state changes** — don't toast "Tab switched"
- **Accessibility**: Sonner uses `role="status"` / `role="alert"` appropriately

---

## 7. Loading States — Skeletons

### Principle
Match the shape of the final content. A skeleton that collapses on load causes layout shift.

### Skeleton Hierarchy
| Level | Use |
|-------|-----|
| **Full-page skeleton** (`loading.tsx`) | Initial route load before any data |
| **Region skeleton** (`<Suspense fallback>`) | Slow subsection inside otherwise-loaded page |
| **Row/card skeleton** | Inside a table/grid while data refetches |
| **Inline skeleton** | Single field (e.g., current user avatar while loading) |

### Never Spinners For Content
Spinners are for action confirmation (submitting, deleting), not content loading. Always use a skeleton for content.

### Skeleton Component

```tsx
// components/ui/skeleton.tsx
<div className="animate-pulse rounded-md bg-muted" style={{ width, height }} />
```

Per-feature skeletons (`EngagementCardSkeleton`, `FindingRowSkeleton`) compose from base `<Skeleton>`.

---

## 8. Empty States

### Three Variants

**Empty (first time)** — user has never created this type
```
┌─────────────────────────────────────┐
│                                     │
│      [friendly illustration]        │
│                                     │
│      No findings yet                │
│      Findings document issues       │
│      discovered during fieldwork.   │
│                                     │
│      [+ Create your first finding]  │
│      [Learn more →]                 │
└─────────────────────────────────────┘
```

**Empty (filtered)** — has data, but current filters show nothing
```
┌─────────────────────────────────────┐
│      No findings match these        │
│      filters.                       │
│      [Clear filters]                │
└─────────────────────────────────────┘
```

**Empty (permission)** — user cannot create
```
┌─────────────────────────────────────┐
│      No findings visible to you.    │
│      Contact your Audit Director    │
│      to be assigned to an           │
│      engagement.                    │
└─────────────────────────────────────┘
```

Component:
```tsx
<EmptyState
  icon={<FindingsIcon />}
  title="No findings yet"
  description="Findings document issues discovered during fieldwork."
  action={{ label: "Create your first finding", href: "/findings/new" }}
  secondaryAction={{ label: "Learn more", href: "/docs/findings" }}
/>
```

---

## 9. Error States

### Three Variants

| Where | Component | Recovery |
|-------|-----------|----------|
| **Page-level crash** | `error.tsx` error boundary | "Try again" (reset) + "Go home" |
| **Section-level** | Inline `<ErrorState>` card | Retry button wired to React Query |
| **Field-level** | Form field error message | Fix input, resubmit |

### ErrorState Component

```tsx
<ErrorState
  title="Couldn't load findings"
  description="Check your connection and try again."
  error={error}          // dev-only detail shown if NODE_ENV === "development"
  onRetry={() => refetch()}
/>
```

### Error Messages That Help
- Say what broke: "Couldn't load findings"
- Say why if known: "Your session expired"
- Say what to do: "Sign in again" (with action button)
- Never: "Error 500", "Something went wrong", "An error occurred"

---

## 10. Status & Severity Badges

### StatusBadge
Maps entity status → color + label. One source of truth for all statuses across domain.

```tsx
<StatusBadge value="IN_REVIEW" />       // amber "In review"
<StatusBadge value="APPROVED" />        // green "Approved"
<StatusBadge value="ISSUED" />          // navy "Issued"
```

### SeverityBadge
```tsx
<SeverityBadge value="CRITICAL" />      // deep red with alert icon
<SeverityBadge value="HIGH" />          // orange with up-arrow icon
<SeverityBadge value="MEDIUM" />        // amber with warning icon
<SeverityBadge value="LOW" />           // blue with info icon
```

Both use icon + color + label (never color alone — a11y).

---

## 11. Approval Workflow UI

Audit apps live and die by approval workflows. This pattern appears in 5+ places.

### Approval Panel (right rail or top card)

```
┌─ Approval chain ─────────────────────────────┐
│  ● Author                Alice       ✓ Signed│
│  │                       Apr 10, 2026        │
│  ●─ Senior Auditor       Bob         ✓ Signed│
│  │                       Apr 12, 2026        │
│  ●─ Supervisor           Carol       ⏳ Pending│
│  │                       You                 │
│  ○─ Director             Dan                 │
│  ○─ CAE                  Eve                 │
│                                              │
│  [Approve] [Request changes] [Delegate]      │
└──────────────────────────────────────────────┘
```

### Components
- `<ApprovalTimeline>` — vertical stepper showing chain
- `<ApprovalPanel>` — actions available to current user (permission-aware)
- `<ApprovalComments>` — thread of comments on each stage
- `<ApprovalDelegate>` — dialog to delegate to another approver

### Action Rules
- **Approve** — one-click primary action, requires confirm if comments empty and policy requires them
- **Request changes** — requires comments (textarea in dialog)
- **Reject** — AlertDialog, requires comments, warns "this will end the approval chain"
- **Delegate** — user picker, requires reason comment
- **Recall** — available only to author, only if no one has approved yet

---

## 12. Breadcrumbs

### Rules
- Every `(app)` page has breadcrumbs (except dashboard home)
- Max 4 segments; collapse middle with "..." popover
- Last segment is current page (not a link)
- Use entity titles, not IDs: "Engagements > FY26 IT Audit > Findings > Weak access controls"
- Truncate long titles with ellipsis + tooltip

```tsx
<Breadcrumb items={[
  { label: "Engagements", href: "/engagements" },
  { label: engagement.title, href: `/engagements/${id}` },
  { label: "Findings", href: `/engagements/${id}/findings` },
  { label: finding.title },         // no href — current page
]} />
```

---

## 13. Pagination

### Rules
- Server-side for all lists
- Default `pageSize = 25`; user can change (10, 25, 50, 100)
- "Showing 26-50 of 347" context label
- Disable prev/next at boundaries (don't hide)
- Jump-to-page input for > 10 pages
- URL-synced (`?page=2&pageSize=25`)

### Infinite Scroll Exception
Audit log and activity feed use infinite scroll (cursor-based). Everything else uses numbered pagination (better for navigation, bookmarking, and QA review).

---

## 14. Command Palette (`⌘K`)

### Sections (in order)
1. **Suggestions** — context-aware (e.g., "Go to current engagement")
2. **Recent** — last 5 viewed entities
3. **Search results** — fuzzy match across engagements, findings, reports, people
4. **Navigation** — all app sections
5. **Actions** — "New engagement", "New finding", "Toggle theme"
6. **Help** — "Keyboard shortcuts", "Documentation"

### Implementation
- Uses Shadcn `<Command>` primitive (cmdk under the hood)
- Searches via tRPC `search.global` — debounced 150ms
- Results virtualized if > 50
- Keyboard: ↑↓ to navigate, ↵ to select, Esc to close

---

## 15. Notifications Panel

Triggered from topbar bell icon. Sheet from the right.

### Notification Types
- **Assignments**: "Alice assigned you to engagement FY26-IT-01"
- **Approvals**: "Finding X is waiting for your review"
- **Mentions**: "Bob mentioned you in a comment on Finding X"
- **Due dates**: "Engagement Y fieldwork due in 3 days"
- **System**: "Your QA review is now available"

### UX
- Unread count badge on bell
- Grouped by date (Today, Yesterday, Earlier)
- Click → navigate to item + mark read
- "Mark all as read" action
- Filter by type
- Real-time updates via SSE

---

## 16. Forms — Composition Patterns

### Single-Column (most forms)
Max 640px wide. Labels above fields. Helper text below. Error text replaces helper on error.

### Two-Column (dense forms)
For forms with many short fields (dates, codes, enumerations). `grid grid-cols-1 md:grid-cols-2 gap-4`.

### Sectioned (long forms — planning memo, QA checklist)
Accordion sections, each with "Save draft" at the end. Jump-to-section via left-rail table of contents.

### Wizard (intake forms, new engagement)
Sequential steps with progress indicator. "Back" + "Next" buttons. "Save draft" always available. Each step validates before advancing.

### Inline-Edit Pattern
For single-field edits in detail views (title, description): click to edit in place, Escape to cancel, Enter or blur to save. Show saving indicator briefly.

---

## 17. Rich Text Editor

### TipTap v2 — same as AIMS v1
Preserved from v1 for consistency. Toolbar:

- **Formatting**: bold, italic, underline, strikethrough
- **Headings**: H2, H3, H4 (no H1 — page owns that)
- **Lists**: bullet, ordered, task
- **Block**: blockquote, code block
- **Link**: with URL validation
- **Table**: insert 3×3, add/remove rows/cols
- **Image**: upload or paste
- **Undo/Redo**
- **Read-only mode**: no toolbar; renders clean content

### Security
- HTML sanitized on submit via DOMPurify
- Links rel="noopener noreferrer" automatic
- No iframe, no script, no style attributes in stored HTML
- Max length enforced server-side (e.g., 50 000 chars per rich-text field)

### Size & Performance
- Bundle: ~80KB gzipped (lazy-loaded per-route)
- Do not render 100+ TipTap instances on one page — use read-only mode for lists

---

## 18. File Upload

### Drag-drop Zone (`<FileUpload>`)

```tsx
<FileUpload
  accept={["application/pdf", ".docx", ".xlsx", "image/*"]}
  maxSize={50 * 1024 * 1024}     // 50MB
  maxFiles={10}
  onUpload={handleUpload}
/>
```

### Upload Flow (Presigned URL Pattern)
1. Client calls `trpc.upload.createPresigned({ filename, size, contentType })` → gets presigned S3 URL + upload ID
2. Client uploads directly to S3 (bypasses our API — fast, no bandwidth cost)
3. Client calls `trpc.upload.finalize({ uploadId })` → links file to entity
4. Progress tracked via XHR upload events

### UX
- Drag state: dashed border + highlight
- Per-file progress bar
- Thumbnail preview for images/PDFs (client-side)
- Virus scan indicator (async — ClamAV on backend)
- Retry on failure, cancel in progress

---

## 19. Date / Time Handling

### Display
- Dates: `Apr 19, 2026` (locale-sensitive via `date-fns/locale`)
- Relative: `2 hours ago`, `in 3 days` (via `formatDistanceToNow`)
- Hover reveals absolute timestamp with timezone
- In tables: relative by default, absolute on hover

### Input
- Date picker: `<DatePicker>` — locale-aware, FY presets for fiscal fields
- Date range: `<DateRangePicker>` — two-month calendar, common presets
- Time rarely needed — audit dates are typically day-precision

### Timezone Rules
- Store UTC server-side always
- Display in user's timezone (`user.timezone` from profile)
- For audit evidence, always show UTC + local ("2026-04-19 14:30 UTC (10:30 EDT)")
- Never parse dates with `Date` constructor — use `parseISO` from date-fns

---

## 20. Charts & Visualizations

### Library Choice
- **Recharts** — default (carried from v1)
- **Tremor** — for pre-built dashboard cards (optional)
- **d3** — only for custom bespoke visualizations (risk heatmaps, org charts)

### Chart Rules
- Every chart has a title, axis labels, legend
- Empty state: "No data for this period"
- Loading: skeleton that matches chart dimensions
- Accessible data table alternative — `<details>` with `<table>` of same data
- Tooltips on hover (keyboard-accessible via focus)
- Responsive: use `<ResponsiveContainer>`, never fixed pixel widths

### Common Charts in AIMS v2
- Findings by severity (pie / donut) — dashboard
- Engagement progress over time (line) — dashboard
- Audit plan completion (stacked bar by fiscal month) — dashboard
- Risk heatmap (likelihood × impact) — audit universe
- CPE hours accrued (gauge) — staff profile
- Time spent by engagement (horizontal bar) — timesheets

---

## 21. Print & PDF Surfaces

Some surfaces need a print-friendly view (findings register, approval history, engagement summary).

### Pattern
- Dedicated `/print/<route>` pages with print-only CSS
- `@media print { ... }` hides chrome (sidebar, topbar, action buttons)
- Page breaks: `break-before-page` class on major section boundaries
- Landscape for tables > 6 columns

### PDF Generation
- Server-side via Puppeteer or PDFKit (see `api/services/pdf/`)
- Client triggers download, server renders, streams back
- Long-running PDFs: queued via BullMQ, notify when ready

---

## 22. Copy Tone

- **Direct, not verbose**: "Delete finding?" not "Do you want to delete this finding from the system?"
- **Active voice**: "Send for approval" not "Finding will be sent for approval"
- **No jargon for end users**: "Approve" not "Advance workflow state"
- **Consistent terminology**: always "finding" (never "issue", "observation" — those are distinct entities)
- **Sentence case for labels/buttons**: "New engagement" not "New Engagement"
- **Title case for page titles only**: "Audit Planning Memo"

Strings are keys in `messages/en.json` — copy owners can change text without code changes.

---

## 23. Related Documents

- `DESIGN-SYSTEM.md` — tokens referenced by these patterns
- `STATE-AND-DATA.md` — how state wires into these components
- `ACCESSIBILITY.md` — keyboard + ARIA expectations
- `I18N.md` — localization of strings in patterns
