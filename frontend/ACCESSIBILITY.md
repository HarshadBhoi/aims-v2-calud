# Accessibility

> WCAG 2.1 AA compliance from day one. Government audit tools are used by employees under ADA/Section 508/EN 301 549. Accessibility is a legal requirement, not a nicety.

---

## 1. Compliance Target

| Standard | Level | Why |
|----------|-------|-----|
| **WCAG 2.1** | **AA** | Legal baseline (ADA, Section 508, EN 301 549, AODA) |
| **WCAG 2.2** | Best-effort on new success criteria | Published 2023; some criteria not yet required |
| **Section 508** | Compliant | Federal customers (GAO, state audit offices) |
| **ARIA 1.2** | Follow spec | Via Radix primitives |
| **EN 301 549** | Compliant | EU government customers |

### Formal Accessibility Conformance Report (ACR)
Published as **VPAT 2.5** once the app reaches GA. Updated with every major release. Available to customers on request.

---

## 2. Four Principles (POUR) — How We Meet Each

### 2.1 Perceivable
Information and UI must be perceivable by all users, including those using assistive tech.

| Requirement | How |
|-------------|-----|
| Text alternatives for non-text | Every icon has `aria-label` or adjacent text. Avatars have `alt`. Charts have `<details>` with data table |
| Captions / transcripts | Videos (if any) include captions (WebVTT). Audio content has transcript |
| Content adaptable (no layout break on resize/zoom) | Up to 200% zoom without horizontal scroll; responsive down to 320px width |
| Distinguishable (contrast, spacing, color not sole signal) | Contrast 4.5:1 body / 3:1 large; severity has icon + color + label |

### 2.2 Operable
UI must be operable — not just with a mouse.

| Requirement | How |
|-------------|-----|
| Keyboard accessible (everything) | All interactive elements reachable by Tab. Radix handles focus trapping in modals |
| Enough time | No time limits in the app. Session timeout has warning + extend (see `auth/`) |
| No seizures | No flashing content > 3× per second |
| Navigable | Skip link to main, headings hierarchical, focus visible, page titles descriptive |
| Input modalities (touch, voice, ...) | Tap targets ≥ 44×44px on touch |

### 2.3 Understandable
UI and information must be understandable.

| Requirement | How |
|-------------|-----|
| Readable | `<html lang>` set, abbreviations expanded on first use, reading level plain |
| Predictable | Navigation consistent, form submission explicit, no unexpected context change |
| Input assistance | Labels on all inputs, error messages clear, validation non-punitive |

### 2.4 Robust
Content must be compatible with assistive tech.

| Requirement | How |
|-------------|-----|
| Valid HTML | No duplicate IDs, ARIA states valid, landmark roles proper |
| Name, Role, Value programmatically determinable | Radix primitives; custom components audited |
| Status messages | `aria-live` regions for async status (toasts, form saved) |

---

## 3. Keyboard Navigation

### Global Rules
- **Every interactive element is tabbable** (`button`, `a`, `input`, `select`, `textarea`, and anything with `role="button"` + `tabIndex={0}`)
- **Never `tabindex > 0`** — disrupts natural tab order
- **Tab order matches visual order** — left-to-right, top-to-bottom
- **Skip link** at page top: "Skip to main content" — visible on focus, hidden otherwise
- **Focus never lost** — after modal close, focus returns to trigger (Radix handles). After delete, focus moves to next item or empty state

### Standard Keys
| Key | Behavior |
|-----|----------|
| `Tab` / `Shift+Tab` | Move focus forward/back |
| `Enter` / `Space` | Activate button, select option |
| `Esc` | Close modal/popover/menu |
| `Arrow keys` | Navigate within composite widgets (menus, tabs, radio groups, date picker, tables) |
| `Home` / `End` | Jump to first/last in lists |
| `Page Up/Down` | In date picker: month navigation |

### App-Specific Shortcuts
See `UI-PATTERNS.md §2`. All shortcuts:
- Displayed in `⌘/` help modal
- Never conflict with standard browser/OS shortcuts
- Documented in tooltip (`title` or `aria-keyshortcuts`)

### Focus Visible
Every focusable element has a visible focus indicator:
```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  border-radius: calc(var(--radius) + 2px);
}
```

Never `outline: none` without replacement. `focus-visible:` prefix (not `focus:`) — avoids ring on mouse click.

### Tab Traps (Modals)
Radix Dialog/Popover traps focus automatically. When writing custom modals:
- Focus first focusable element on open
- Tab cycles within modal (never escapes to page behind)
- Esc or X returns focus to trigger

---

## 4. Screen Reader Support

### Landmark Regions
```tsx
<body>
  <a href="#main" className="sr-only focus:not-sr-only">Skip to main content</a>
  <header><nav aria-label="Main">...</nav></header>
  <aside aria-label="Secondary"><nav aria-label="Section">...</nav></aside>
  <main id="main">...</main>
  <footer>...</footer>
</body>
```

One `<main>` per page. Multiple `<nav>` elements distinguished by `aria-label`.

### Headings
- One `<h1>` per page — the page title
- Hierarchical: don't skip levels (no `<h2>` followed by `<h4>`)
- Use for structure, not styling (style via Tailwind classes on appropriate element)

### Live Regions
For dynamic content announcements:
```tsx
<div role="status" aria-live="polite" className="sr-only">
  {formSaved && "Form saved"}
</div>
```

| Politeness | Use |
|-----------|-----|
| `polite` | Saved confirmations, non-urgent updates |
| `assertive` | Errors, critical alerts (use sparingly — interrupts) |
| `off` (default) | Static content |

Sonner toasts use `role="status"` for info/success, `role="alert"` for errors.

### Form Labels
Every input has one of:
- `<label htmlFor={id}>` — preferred, clickable
- `aria-label` — when visual label isn't appropriate
- `aria-labelledby` — when label is another element

Placeholder is NEVER a label substitute. Helper text via `aria-describedby`.

### Error Messages
```tsx
<FormField>
  <FormLabel htmlFor="title">Title</FormLabel>
  <FormControl>
    <Input id="title" aria-invalid={hasError} aria-describedby={hasError ? "title-error" : undefined} />
  </FormControl>
  {hasError && <FormMessage id="title-error">Title is required</FormMessage>}
</FormField>
```

On submit with errors: focus moves to first error field, scroll into view, screen reader announces error.

### Icon-Only Buttons
```tsx
<Button aria-label="Delete finding">
  <TrashIcon aria-hidden="true" />
</Button>
```

Icon always `aria-hidden` (decorative). Button gets label.

### Decorative vs Meaningful Images
- Decorative: `alt=""` (empty, not missing)
- Meaningful: `alt="description"` (what it conveys, not what it is)
- Complex (charts): short `alt` + longer description via `aria-describedby` or `<details>`

---

## 5. Color & Contrast

### Minimums
| Context | Contrast |
|---------|----------|
| Body text (< 18px or < 14px bold) | **4.5:1** |
| Large text (≥ 18px or ≥ 14px bold) | **3:1** |
| UI components (buttons, inputs, borders) | **3:1** against adjacent colors |
| Focus indicators | **3:1** against background |
| Graphical objects (icons conveying info) | **3:1** |

Enforced via:
- Design tokens audited in Chromatic (every token combo)
- axe-core runs against every page in CI
- Manual review for edge cases (hover states, disabled states)

### Color Is Never Alone
Severity, status, validation state — all pair color with icon + text. A colorblind user must get the same information.

Examples:
- ✅ Severity badge: red + `<AlertIcon>` + "Critical"
- ❌ Red dot alone to indicate error
- ✅ Required field: `*` + text `(required)` + `aria-required="true"`
- ❌ Red asterisk alone

### Dark Mode Contrast
Dark mode tokens audited separately. Dark-on-dark often fails; test both themes.

---

## 6. Forms

### Label Everything
Every control — input, select, checkbox, radio, switch, slider — has a programmatic label.

### Required Fields
```tsx
<FormLabel>
  Title <span aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</FormLabel>
<Input required aria-required="true" />
```

### Grouped Controls
```tsx
<fieldset>
  <legend>Severity</legend>
  <RadioGroup>
    <RadioItem value="critical" id="sev-critical" />
    <label htmlFor="sev-critical">Critical</label>
    {/* ... */}
  </RadioGroup>
</fieldset>
```

### Error Summary
Long forms on submit surface an error summary at top:
```tsx
<div role="alert" aria-labelledby="errors-heading">
  <h2 id="errors-heading">4 errors</h2>
  <ul>
    <li><a href="#title">Title is required</a></li>
    {/* ... */}
  </ul>
</div>
```

Clicking a link scrolls to and focuses the field.

### Autofill
Respect browser autofill via `autocomplete` attributes on common fields (name, email, org, etc.). Speeds up form filling for all users, critical for motor-disabled users.

---

## 7. Tables

### Accessible Table Structure
```tsx
<table>
  <caption>Findings for engagement FY26-IT-01</caption>
  <thead>
    <tr>
      <th scope="col">Title</th>
      <th scope="col">Severity</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Weak access controls</th>
      <td><SeverityBadge value="HIGH" /></td>
      <td><StatusBadge value="IN_REVIEW" /></td>
    </tr>
  </tbody>
</table>
```

### Sortable Columns
```tsx
<th scope="col" aria-sort={sortBy === "severity" ? sortDir : "none"}>
  <button onClick={() => sort("severity")}>
    Severity <SortIcon />
  </button>
</th>
```

### Row Selection
```tsx
<td>
  <Checkbox
    aria-label={`Select ${row.title}`}
    checked={isSelected}
    onCheckedChange={toggle}
  />
</td>
```

### Bulk Action Bar
When rows selected, bar appears with `role="region" aria-label="Bulk actions"`. Announce count via live region: "3 findings selected".

---

## 8. Dynamic Content

### Loading States
Skeletons have `aria-busy="true"` on container, screen readers announce when loaded.

```tsx
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? <Skeleton /> : <Data />}
</div>
```

### Route Changes (SPA)
After router navigation, announce the new page:
```tsx
// After route change
announce(`Navigated to ${pageTitle}`);
// Implementation: set text in a persistent live region
```

Next.js App Router: hook into pathname change, update live region.

### Infinite Scroll
Provide "Load more" button as keyboard alternative to scroll trigger. Announce new items loaded.

---

## 9. Custom Widgets (ARIA Authoring Practices)

When a Radix primitive doesn't exist for our need, follow [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).

### Composite widgets we build
- **Combobox** (searchable select) — follow APG combobox pattern
- **Tree** (for hierarchical finding taxonomy) — follow APG treeview
- **Grid** (spreadsheet-like cells in audit tests) — follow APG data grid

### Rule
Never invent ARIA patterns. If it's not in APG, it's probably not accessible. Either use a standard pattern or don't build the widget.

---

## 10. Motion & Animation

### Respect `prefers-reduced-motion`
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Framer Motion:
```tsx
const shouldReduceMotion = useReducedMotion();
<motion.div animate={shouldReduceMotion ? {} : { scale: 1.05 }} />
```

### No Parallax, No Autoplay
- No background video autoplay
- No parallax scrolling effects (vestibular triggers)
- No infinite animations (spinners allowed but must be dismissible)

---

## 11. Touch & Mobile

### Target Size
- Minimum **44×44px** tap target (WCAG 2.5.5 AAA — we adopt as baseline)
- Spacing ≥ 8px between adjacent targets
- Enforce via design tokens (`size-11` = 44px minimum for icon buttons)

### Gestures
- Every gesture has a keyboard/tap equivalent (drag-drop has buttons; pinch-zoom is optional)
- No multi-finger gestures required (single-finger operable)

---

## 12. Testing Strategy

### Automated
- **axe-core** — integrated into Vitest + Playwright. Every page + component tested. Zero violations required to merge
- **Lighthouse** — CI runs on key pages. Accessibility score ≥ 95 (100 preferred)
- **Storybook a11y addon** — flags issues at component level (Phase 2)
- **ESLint plugins** — `eslint-plugin-jsx-a11y` for static analysis

### Manual
- **Keyboard-only pass** — tester completes top 10 flows without mouse
- **Screen reader pass** — NVDA (Windows), VoiceOver (Mac), JAWS (enterprise) — critical flows every release
- **Zoom pass** — 200% zoom, 400% zoom (reflow), no horizontal scroll
- **Reduced motion pass** — toggle OS setting, verify no critical animations
- **Color contrast pass** — both light + dark themes, all severity/status combinations

### User Testing
- Quarterly sessions with users who use assistive tech (recruited via Fable, Applause, or similar)
- Include at least one blind, one low-vision, one motor-impaired user
- Findings filed as P1 bugs

---

## 13. Content Accessibility

### Plain Language
- Sentence length: aim for < 20 words
- Avoid jargon where possible; define on first use
- Acronyms expanded first use: "Corrective Action Plan (CAP)"
- Reading level: aim for grade 8-10 for user-facing copy

### Document Accessibility
Generated PDFs must be tagged:
- Text content extractable (not image scans)
- Reading order correct
- Headings marked as headings (bookmarks)
- Tables with proper header cells
- Alt text on images/charts
- Language declared

Via PDFKit with structure tree — see `api/services/pdf/`.

---

## 14. Internationalization & Accessibility

- `<html lang>` set to current locale
- RTL locales (Arabic, Hebrew) mirror layout via `dir="rtl"`
- Date/number/currency formats per locale
- Screen reader pronunciations correct per language

See `I18N.md`.

---

## 15. What Radix Gives Us Free

Radix UI primitives implement all of the following correctly:

- Dialog: focus trap, scroll lock, Esc to close, focus return, `role="dialog"` + `aria-labelledby`
- Popover: focus, Esc, outside click, positioning
- Dropdown Menu: arrow key nav, typeahead, `role="menu"` + `role="menuitem"`
- Tabs: arrow nav, `role="tablist"` + `role="tab"` + `role="tabpanel"`, `aria-selected`, `aria-controls`
- Select: arrow nav, type-ahead, `aria-activedescendant` pattern
- Checkbox / Radio / Switch: `role`, keyboard, `aria-checked`
- Slider: arrow keys, Home/End, `role="slider"`, `aria-valuenow`
- Tooltip: hover + focus triggers, `role="tooltip"`, `aria-describedby`
- Toast: `role="status"` / `role="alert"`, proper announcing

**Consequence**: we don't reinvent these wheels. If we need a custom interactive widget not covered by Radix, we follow APG patterns meticulously.

---

## 16. Accessibility Governance

### Definition of Done
A feature is not "done" until:
1. Keyboard-operable (tested manually)
2. Screen reader tested (at least NVDA or VoiceOver)
3. axe-core passes (automated)
4. Contrast verified in both themes
5. Tab order correct and focus visible
6. No `outline: none` without replacement
7. All form errors associated with fields via `aria-describedby`

### Review Checklist in PR Template
```
### Accessibility
- [ ] Keyboard-operable (all interactive elements reachable by Tab)
- [ ] Screen reader verbalization checked (NVDA/VoiceOver)
- [ ] axe-core passes (`pnpm test:a11y`)
- [ ] Contrast verified in light + dark
- [ ] Focus indicators visible
- [ ] Form errors associated with fields
- [ ] No new violations in Lighthouse
```

### Escalation
Accessibility regressions are **P1 bugs** (not P2/P3). Fix before other feature work. Not negotiable.

---

## 17. Related Documents

- `DESIGN-SYSTEM.md` — contrast tokens, focus rings
- `UI-PATTERNS.md` — layout patterns with a11y baked in
- `I18N.md` — lang, dir, locale-specific a11y
- `TESTING.md` — axe-core + Playwright a11y test strategy
