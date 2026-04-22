# Design System

> Design tokens, component library, dark mode, tenant theming. Tailwind v4 + CSS variables + Shadcn/ui.

---

## 1. Design Token Hierarchy — Three Tiers

Tokens flow in one direction: **reference → system → component**.

```
┌────────────────────────────┐
│  TIER 1 — Reference        │  Raw values (slate-50, slate-100, ..., 12px, 16px)
│  "blue-500: #3b82f6"        │  Never used directly in components
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  TIER 2 — System (Semantic)│  Role-based tokens (primary, background, border)
│  "--primary: var(--blue-600)" │  These are what components reference
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  TIER 3 — Component        │  Per-component overrides (button-primary-bg)
│  "--btn-primary-bg: var(--primary)" │  Usually just aliases; override when needed
└────────────────────────────┘
```

### Why Three Tiers?
- **Reference** tokens change when we rebrand the *raw palette* (rare)
- **System** tokens change when we reassign *roles* (e.g., make the accent color the new primary — common during tenant onboarding)
- **Component** tokens let one component diverge (e.g., destructive button stays red even when primary changes)

Tenants override Tier 2. Dark mode overrides Tier 2. Components reference Tier 2.

---

## 2. Color System

### Reference Palette (Tier 1)
12 neutral steps + 10 semantic ramps (each 12 steps: 50, 100, 200, ..., 950 + 11-step Radix-style for dark).

| Ramp | Purpose |
|------|---------|
| `neutral` | UI chrome, text, borders (Slate — cool gray) |
| `brand` | Default tenant primary (AIMS navy — override per tenant) |
| `blue` | Informational, links |
| `green` | Success, approved, passed, compliant |
| `amber` | Warning, pending, in-review |
| `red` | Destructive, rejected, failing, non-compliant |
| `violet` | QA, peer review, independence |
| `orange` | Findings, observations |
| `cyan` | Recommendations, CAPs |
| `rose` | Critical/high severity findings |

### Semantic Tokens (Tier 2) — CSS Variables
Defined in `styles/tokens.css` as CSS custom properties on `:root`. Dark mode overrides on `[data-theme="dark"]`.

```css
:root {
  /* Surfaces */
  --background:         hsl(0 0% 100%);          /* page background */
  --foreground:         hsl(222 47% 11%);        /* primary text */
  --card:               hsl(0 0% 100%);          /* card surface */
  --card-foreground:    hsl(222 47% 11%);
  --popover:            hsl(0 0% 100%);
  --popover-foreground: hsl(222 47% 11%);

  /* Brand */
  --primary:            hsl(217 91% 30%);        /* AIMS navy — tenant override */
  --primary-foreground: hsl(0 0% 100%);
  --secondary:          hsl(210 40% 96%);
  --secondary-foreground: hsl(222 47% 11%);

  /* States */
  --muted:              hsl(210 40% 96%);        /* subtle surfaces (disabled, filters) */
  --muted-foreground:   hsl(215 16% 47%);        /* secondary text */
  --accent:             hsl(210 40% 96%);        /* hover state */
  --accent-foreground:  hsl(222 47% 11%);

  /* Semantic */
  --success:            hsl(142 71% 45%);
  --success-foreground: hsl(0 0% 100%);
  --warning:            hsl(38 92% 50%);
  --warning-foreground: hsl(0 0% 100%);
  --destructive:        hsl(0 84% 60%);
  --destructive-foreground: hsl(0 0% 100%);
  --info:               hsl(199 89% 48%);
  --info-foreground:    hsl(0 0% 100%);

  /* Chrome */
  --border:             hsl(214 32% 91%);
  --input:              hsl(214 32% 91%);
  --ring:               hsl(217 91% 30%);        /* focus ring — matches primary */

  /* Audit domain colors (non-brand — never overridden by tenant) */
  --severity-critical:  hsl(0 84% 45%);
  --severity-high:      hsl(14 90% 53%);
  --severity-medium:    hsl(38 92% 50%);
  --severity-low:       hsl(199 89% 48%);
  --severity-info:      hsl(215 16% 47%);

  --status-draft:       hsl(215 16% 47%);
  --status-submitted:   hsl(199 89% 48%);
  --status-approved:    hsl(142 71% 45%);
  --status-issued:      hsl(217 91% 30%);
  --status-rejected:    hsl(0 84% 60%);
  --status-closed:      hsl(215 20% 35%);
}

[data-theme="dark"] {
  --background:         hsl(222 47% 6%);
  --foreground:         hsl(210 40% 98%);
  --card:               hsl(222 47% 9%);
  --card-foreground:    hsl(210 40% 98%);
  --primary:            hsl(217 91% 60%);        /* lighter in dark */
  --primary-foreground: hsl(222 47% 11%);
  --border:             hsl(217 33% 17%);
  --ring:               hsl(217 91% 60%);
  /* ... (full dark palette) */
}
```

### Color Usage Rules
- **Never use reference tokens directly in components** (no `bg-blue-500`). Always semantic (`bg-primary`).
- **Audit domain colors are fixed** — critical is always red, passed is always green, regardless of tenant brand
- **Text/background contrast must meet WCAG AA**: 4.5:1 for normal text, 3:1 for large text. Verified per ramp via Lighthouse + axe
- **One accent per screen** — avoid rainbow UIs. Use neutrals as the base, accent for emphasis only

---

## 3. Typography

### Fonts (via `next/font`)
```ts
import { Inter, JetBrains_Mono } from "next/font/google";

export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
```

Applied once in root layout: `<html className={`${fontSans.variable} ${fontMono.variable}`}>`. Tailwind picks up via config.

### Type Scale (Tier 2 tokens)
Based on a 1.125 ratio (minor second) — calm, dense, appropriate for data-heavy UIs.

| Token | Size | Line height | Use |
|-------|------|-------------|-----|
| `text-xs` | 12px | 16px | Metadata, timestamps, captions |
| `text-sm` | 14px | 20px | **Default body text, form labels, table cells** |
| `text-base` | 16px | 24px | Paragraph content, card body |
| `text-lg` | 18px | 28px | Card titles, subsection headings |
| `text-xl` | 20px | 28px | Page section headings (H3) |
| `text-2xl` | 24px | 32px | Page headings (H2) |
| `text-3xl` | 30px | 36px | Page titles (H1) |
| `text-4xl` | 36px | 40px | Dashboard hero KPIs |

### Type Rules
- **Default is `text-sm`** for dense audit UIs — enterprise users have a lot on screen
- **Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold). No other weights
- **Line length**: limit to 65ch for reading content; not enforced on table cells or form fields
- **Never use `italic` for emphasis** — use `font-medium` or a color highlight
- Numerical data uses `tabular-nums` for alignment in tables

---

## 4. Spacing & Layout

### Spacing Scale
Tailwind defaults (4px increments): `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24`.

### Common Spacing Patterns
| Pattern | Spacing | Example |
|---------|---------|---------|
| Inline gap (inside a row) | `gap-2` (8px) | Icon + text |
| Related elements | `gap-3` (12px) | Form field + helper text |
| Form field stack | `gap-4` (16px) | Between input fields |
| Card padding | `p-6` (24px) | Card inner padding |
| Section spacing | `gap-8` (32px) | Between major page sections |
| Page padding | `p-6 lg:p-8` | Main content padding |

### Border Radius
| Token | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 2px | Badges, pills |
| `rounded-md` | 6px | **Default — buttons, inputs, cards** |
| `rounded-lg` | 8px | Larger cards, modals |
| `rounded-xl` | 12px | Heroes, feature cards |
| `rounded-full` | 9999px | Avatars, chips |

CSS variable: `--radius: 0.5rem;` — Shadcn components derive from this. Tenants can soften (0.25rem) or sharpen (0.125rem) via theme override.

### Shadows
| Token | Use |
|-------|-----|
| `shadow-xs` | Subtle elevation (form fields on focus) |
| `shadow-sm` | Cards at rest |
| `shadow-md` | Popovers, dropdowns |
| `shadow-lg` | Modals, floating toolbars |
| `shadow-xl` | Command palette |

Dark mode uses **lighter shadows** (less contrast works better on dark surfaces) and/or **border highlights** instead.

---

## 5. Breakpoints

Tailwind defaults — mobile-first.

| Breakpoint | Width | Target |
|-----------|-------|--------|
| (base) | 0px+ | Mobile (though app is desktop-first — mobile is read-only review use case) |
| `sm` | 640px+ | Large phone, small tablet |
| `md` | 768px+ | Tablet |
| `lg` | 1024px+ | **Primary target — desktop** |
| `xl` | 1280px+ | Wide desktop |
| `2xl` | 1536px+ | Ultra-wide (dashboards) |

The audit app is **desktop-first**. Mobile is a read-only / approval workflow experience. We do not hide desktop functionality on mobile — we reflow and simplify dense tables into cards.

---

## 6. Motion & Animation

### Principles
- Motion communicates state change, not decoration
- Respect `prefers-reduced-motion` — disable all non-essential motion via `@media (prefers-reduced-motion: reduce)` and Framer Motion's `useReducedMotion()`
- Duration scale: **fast (120ms), normal (200ms), slow (320ms)**. Nothing longer than 320ms in UI.
- Easing: `ease-out` for entrance, `ease-in` for exit, `ease-in-out` for position changes

### Motion Tokens
```css
--duration-fast:   120ms;
--duration-normal: 200ms;
--duration-slow:   320ms;
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:         cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out:     cubic-bezier(0.83, 0, 0.17, 1);
```

### When to Use Framer Motion
- Page transitions (only if meaningful — usually we don't)
- Modal / drawer enter/exit
- Stagger animations on data tables (load-in)
- Drag & drop reordering

### When to Use CSS Transitions
- Button hover / active
- Input focus ring
- Accordion expand/collapse
- Toast slide-in

Default to CSS. Escalate to Framer only when CSS can't express the motion.

---

## 7. Dark Mode

### Implementation — Class/Attribute Strategy
`<html data-theme="light|dark">` attribute toggled by `next-themes`. CSS variables swap; components don't change.

```tsx
// app/layout.tsx
<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

### Dark Mode Rules
- **Every component must render correctly in both modes** — verified in Storybook / visual regression tests
- **No hardcoded colors** — always use semantic tokens. `bg-card text-card-foreground`, never `bg-white text-slate-900`
- **Dark surfaces are not pure black** — `hsl(222 47% 6%)` base. Pure black loses depth
- **Borders in dark mode are subtle** — often replaced with shadow or inner highlight
- **Shadows in dark mode are softer** — or use `ring-1 ring-white/10` instead
- **Images may need `dark:brightness-90`** for brand assets that look too bright

### System Preference Respected
Default `system` theme respects OS preference. User can override via settings. Stored in cookie (SSR-safe).

---

## 8. Tenant Theming

Each tenant can set:

| Token | Default | Constraint |
|-------|---------|------------|
| `primary` (hue) | AIMS navy | Any HSL — contrast validated against `primary-foreground` |
| `radius` | 0.5rem | 0, 0.25rem, 0.5rem (predefined options) |
| Logo | AIMS logo | SVG, max 40px height, monochrome or dual-color |
| Favicon | AIMS icon | Auto-generated from logo |

**What tenants cannot override**: semantic audit colors (severity, status), typography, spacing, motion. Keeping audit UX consistent across tenants is a feature — auditors moving between clients shouldn't relearn the interface.

### Theme Delivery
1. Tenant data loaded in `(app)/layout.tsx` (Server Component)
2. Primary HSL injected via inline `<style>` tag: `<style>:root { --primary: ${hsl}; --ring: ${hsl}; }</style>`
3. Logo URL passed to `<Sidebar>` component
4. No FOUC — inlined in initial HTML response

### Validated on Save
When a tenant admin changes the primary color, the server validates:
- Contrast ratio ≥ 4.5:1 against white (for `primary-foreground: white`)
- Contrast ratio ≥ 3:1 against page background
- If fails, reject with suggestion ("try a darker variant")

---

## 9. Iconography

### Library — Lucide
- MIT license, tree-shakable (per-icon imports)
- Consistent 24px grid, 2px stroke
- 1400+ icons covering our needs

### Icon Rules
- **Size**: default 16px (`size-4`) for inline, 20px (`size-5`) for buttons, 24px (`size-6`) for headers
- **Stroke width**: 2 (default) — do not mix with 1.5 or 1 icons
- **Color**: inherit from parent (`currentColor`), never explicit color unless semantic
- **Always include `aria-label`** when icon is the only content (`<button aria-label="Delete"><TrashIcon /></button>`)
- **Never convey information by icon alone** — pair with text or ensure `aria-label` describes the action

### Icon Catalog (domain-specific)
Maintain a small wrapper `components/ui/icon.tsx` that maps audit concepts to Lucide icons for consistency:

```tsx
export const AuditIcons = {
  engagement: Briefcase,
  finding: AlertTriangle,
  recommendation: Lightbulb,
  correctiveAction: CheckSquare,
  workpaper: FileText,
  approval: CheckCircle2,
  reject: XCircle,
  delegate: ArrowRightLeft,
  // ... one source of truth
};
```

---

## 10. Component Library — Shadcn/ui

### Philosophy
Shadcn is **not a dependency**. Components are copied into `components/ui/` — we own them, we style them, we extend them.

### Base Components (from Shadcn)
Installed via `npx shadcn add <component>`:

`accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, checkbox, collapsible, command, context-menu, dialog, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip`

### Our Additions (`components/ui/`)
Extensions we build on top:

| Component | Purpose |
|-----------|---------|
| `date-picker.tsx` | Calendar + input combo, supports range, locale-aware |
| `date-range-picker.tsx` | Two-month calendar, fiscal year presets |
| `combobox.tsx` | Searchable select (wraps `command` + `popover`) |
| `multi-select.tsx` | Checkbox list in popover |
| `rich-text-editor.tsx` | TipTap wrapper with our toolbar |
| `file-upload.tsx` | Drag-drop dropzone with progress |
| `data-table.tsx` | TanStack Table wrapper — see `UI-PATTERNS.md` |
| `virtual-list.tsx` | TanStack Virtual wrapper for 1000+ item lists |
| `code-block.tsx` | Shiki syntax highlighting |
| `color-picker.tsx` | Tenant theme color selection |

### Pattern Components (`components/patterns/`)
Higher-order compositions specific to our domain:

| Component | Purpose |
|-----------|---------|
| `page-header.tsx` | Title + breadcrumb + actions (right-aligned) |
| `page-tabs.tsx` | Tab nav with URL sync |
| `empty-state.tsx` | Illustration + title + description + CTA |
| `error-state.tsx` | Inline error card with retry |
| `stat-card.tsx` | KPI tile with trend indicator |
| `status-badge.tsx` | Domain status → color mapping |
| `severity-badge.tsx` | Critical/High/Medium/Low with icon |
| `user-badge.tsx` | Avatar + name + role (for assignees) |
| `approval-timeline.tsx` | Vertical stepper showing approval chain |
| `finding-elements.tsx` | Dynamic renderer for 3-5 element findings |
| `confirm-dialog.tsx` | Destructive action confirmation |

### Component API Conventions

```tsx
// Every component exports: Component + ComponentProps
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => { ... }
);
Button.displayName = "Button";
```

- **`ref` forwarding** on every interactive component
- **`className` merge via `cn()`** — never override, always compose (`cn("base classes", className)`)
- **`asChild` prop** (via Radix Slot) for rendering as a different element without losing behavior
- **Variants via `cva` (class-variance-authority)** — type-safe variant props
- **No prop drilling of style** — consumers style via className, never via color props

---

## 11. Variants (`cva` pattern)

```tsx
// components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 py-2",
        lg: "h-10 px-8",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

### Variant Rules
- Variants express **intent**, not appearance (`destructive`, not `red`)
- Keep variants orthogonal — `variant` and `size` don't interact
- No more than ~6 variants per component — more means extract a new component

---

## 12. Z-Index System

One source of truth (in `tokens.css`):

```css
--z-dropdown:   10;
--z-sticky:     20;
--z-banner:     30;
--z-overlay:    40;
--z-modal:      50;
--z-popover:    60;
--z-toast:      70;
--z-tooltip:    80;
--z-command:    90;  /* command palette always on top */
```

Never use raw z-index values in components. Always via token class or CSS variable.

---

## 13. Audit Domain Tokens (Non-Brand)

These are **not** tenant-themeable. They're part of the audit UX vocabulary and must stay consistent.

### Severity Colors
```css
--severity-critical:  hsl(0 84% 45%);    /* deep red */
--severity-high:      hsl(14 90% 53%);   /* orange-red */
--severity-medium:    hsl(38 92% 50%);   /* amber */
--severity-low:       hsl(199 89% 48%);  /* blue */
--severity-info:      hsl(215 16% 47%);  /* gray */
```

### Status Colors
```css
--status-draft:       hsl(215 16% 47%);  /* gray */
--status-submitted:   hsl(199 89% 48%);  /* blue */
--status-inreview:    hsl(38 92% 50%);   /* amber */
--status-approved:    hsl(142 71% 45%);  /* green */
--status-rejected:    hsl(0 84% 60%);    /* red */
--status-issued:      hsl(217 91% 30%);  /* brand navy — final state */
--status-closed:      hsl(215 20% 35%);  /* dark gray */
```

### Standard-Family Colors
Each standard pack has a subtle accent to help users identify which standard they're working in:

```css
--pack-gagas:   hsl(217 91% 30%);  /* navy */
--pack-iia:     hsl(262 83% 58%);  /* purple */
--pack-sox:     hsl(0 84% 45%);    /* red */
--pack-iso:     hsl(142 71% 45%);  /* green */
--pack-cobit:   hsl(199 89% 48%);  /* cyan */
--pack-issai:   hsl(38 92% 50%);   /* amber */
```

Used in pack picker and breadcrumb accent only — never as primary UI color.

---

## 14. Accessibility Baseline

See `ACCESSIBILITY.md` for full policy. Design-system level rules:

- **All interactive elements have visible focus ring**: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Minimum tap target**: 44x44px on touch (Radix handles this; check custom components)
- **Color is never the only signal** — pair with icon, text, or position (severity badge has icon + color + label)
- **Minimum contrast 4.5:1** for body, 3:1 for large text and UI chrome
- **Radix UI primitives** provide keyboard nav + ARIA by default — don't reinvent

---

## 15. Storybook (Optional, Phase 2)

If we adopt Storybook:
- One story per Shadcn component (states: default, hover, focus, disabled, error)
- One story per pattern component (with realistic data)
- Automated a11y checks via `@storybook/addon-a11y`
- Visual regression via Chromatic or Lost-Pixel

Phase 1 skips Storybook — focus on shipping the app. Add when component library stabilizes (5+ devs).

---

## 16. Illustration & Imagery

- **Empty states** use custom SVG illustrations (commissioned or Undraw). Monochromatic with `currentColor` strokes so they theme correctly
- **No stock photos** in app chrome — this is an enterprise tool, not marketing
- **Avatars**: user uploads or initials-based fallback (colored background derived from user ID hash)
- **Dashboard charts**: never decorative. Every chart conveys data

---

## 17. Implementation Files (see `implementation/`)

- `design-tokens.ts` — TypeScript export of all tokens (for Framer Motion, charts, etc.)
- `tailwind.config.ts` — Tailwind v4 config mapping tokens to utilities
- `globals.css` — CSS variable definitions (light + dark)

---

## 18. Related Documents

- `README.md` — tech stack
- `ARCHITECTURE.md` — app structure
- `UI-PATTERNS.md` — how components compose into patterns
- `ACCESSIBILITY.md` — full a11y policy
- `I18N.md` — RTL considerations for design tokens
