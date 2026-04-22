/**
 * AIMS v2 — Design Tokens (TypeScript export)
 *
 * Single source of truth for all design decisions. The CSS variables in
 * `globals.css` mirror these values. When consuming tokens in non-CSS contexts
 * (Framer Motion, Recharts, canvas-based illustrations), import from here.
 *
 * Three tiers:
 *   reference → semantic → component
 *
 * Components should only ever consume `semantic` tokens via Tailwind classes.
 * Charts / motion utilities may import this file directly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — REFERENCE (raw palette)
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  // Neutrals (Slate — cool gray)
  neutral: {
    50:  "hsl(210 40% 98%)",
    100: "hsl(210 40% 96%)",
    200: "hsl(214 32% 91%)",
    300: "hsl(213 27% 84%)",
    400: "hsl(215 20% 65%)",
    500: "hsl(215 16% 47%)",
    600: "hsl(215 19% 35%)",
    700: "hsl(215 25% 27%)",
    800: "hsl(217 33% 17%)",
    900: "hsl(222 47% 11%)",
    950: "hsl(222 47% 6%)",
  },
  // Brand — AIMS navy (tenant-overridable)
  brand: {
    50:  "hsl(214 100% 97%)",
    100: "hsl(214 95% 93%)",
    200: "hsl(213 97% 87%)",
    300: "hsl(212 96% 78%)",
    400: "hsl(213 94% 68%)",
    500: "hsl(217 91% 60%)",
    600: "hsl(217 91% 50%)",
    700: "hsl(217 91% 40%)",
    800: "hsl(217 91% 30%)",   // default primary
    900: "hsl(217 91% 22%)",
    950: "hsl(217 91% 15%)",
  },
  blue: {
    500: "hsl(199 89% 48%)", 600: "hsl(199 89% 38%)",
  },
  green: {
    500: "hsl(142 71% 45%)", 600: "hsl(142 71% 36%)",
  },
  amber: {
    500: "hsl(38 92% 50%)", 600: "hsl(38 92% 40%)",
  },
  red: {
    500: "hsl(0 84% 60%)", 600: "hsl(0 84% 45%)",
  },
  orange: {
    500: "hsl(14 90% 53%)",
  },
  violet: {
    500: "hsl(262 83% 58%)",
  },
  cyan: {
    500: "hsl(188 86% 53%)",
  },
  rose: {
    500: "hsl(346 77% 50%)",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — SEMANTIC (role-based; these are what components use)
// ─────────────────────────────────────────────────────────────────────────────

export const semantic = {
  light: {
    background:           "hsl(0 0% 100%)",
    foreground:           palette.neutral[900],
    card:                 "hsl(0 0% 100%)",
    cardForeground:       palette.neutral[900],
    popover:              "hsl(0 0% 100%)",
    popoverForeground:    palette.neutral[900],

    primary:              palette.brand[800],
    primaryForeground:    "hsl(0 0% 100%)",
    secondary:            palette.neutral[100],
    secondaryForeground:  palette.neutral[900],

    muted:                palette.neutral[100],
    mutedForeground:      palette.neutral[500],
    accent:               palette.neutral[100],
    accentForeground:     palette.neutral[900],

    success:              palette.green[500],
    successForeground:    "hsl(0 0% 100%)",
    warning:              palette.amber[500],
    warningForeground:    "hsl(0 0% 100%)",
    destructive:          palette.red[500],
    destructiveForeground:"hsl(0 0% 100%)",
    info:                 palette.blue[500],
    infoForeground:       "hsl(0 0% 100%)",

    border:               palette.neutral[200],
    input:                palette.neutral[200],
    ring:                 palette.brand[800],
  },
  dark: {
    background:           palette.neutral[950],
    foreground:           palette.neutral[50],
    card:                 palette.neutral[900],
    cardForeground:       palette.neutral[50],
    popover:              palette.neutral[900],
    popoverForeground:    palette.neutral[50],

    primary:              palette.brand[500],
    primaryForeground:    palette.neutral[900],
    secondary:            palette.neutral[800],
    secondaryForeground:  palette.neutral[50],

    muted:                palette.neutral[800],
    mutedForeground:      palette.neutral[400],
    accent:               palette.neutral[800],
    accentForeground:     palette.neutral[50],

    success:              palette.green[500],
    successForeground:    palette.neutral[950],
    warning:              palette.amber[500],
    warningForeground:    palette.neutral[950],
    destructive:          palette.red[500],
    destructiveForeground:"hsl(0 0% 100%)",
    info:                 palette.blue[500],
    infoForeground:       palette.neutral[950],

    border:               palette.neutral[800],
    input:                palette.neutral[800],
    ring:                 palette.brand[500],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT DOMAIN — NON-BRAND (never tenant-overridable)
// ─────────────────────────────────────────────────────────────────────────────

export const severity = {
  critical: { color: palette.red[600],    label: "Critical" },
  high:     { color: palette.orange[500], label: "High" },
  medium:   { color: palette.amber[500],  label: "Medium" },
  low:      { color: palette.blue[500],   label: "Low" },
  info:     { color: palette.neutral[500],label: "Informational" },
} as const;

export const status = {
  draft:     { color: palette.neutral[500], label: "Draft" },
  submitted: { color: palette.blue[500],    label: "Submitted" },
  inReview:  { color: palette.amber[500],   label: "In review" },
  approved:  { color: palette.green[500],   label: "Approved" },
  rejected:  { color: palette.red[500],     label: "Rejected" },
  issued:    { color: palette.brand[800],   label: "Issued" },
  closed:    { color: palette.neutral[600], label: "Closed" },
} as const;

export const standardPackAccent = {
  gagas: palette.brand[800],
  iia:   palette.violet[500],
  sox:   palette.red[600],
  iso:   palette.green[500],
  cobit: palette.cyan[500],
  issai: palette.amber[500],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: "var(--font-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "var(--font-mono), ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
  },
  fontSize: {
    xs:   { size: "0.75rem",  line: "1rem" },      // 12/16
    sm:   { size: "0.875rem", line: "1.25rem" },   // 14/20  — default body
    base: { size: "1rem",     line: "1.5rem" },    // 16/24
    lg:   { size: "1.125rem", line: "1.75rem" },   // 18/28
    xl:   { size: "1.25rem",  line: "1.75rem" },   // 20/28
    "2xl":{ size: "1.5rem",   line: "2rem" },      // 24/32
    "3xl":{ size: "1.875rem", line: "2.25rem" },   // 30/36
    "4xl":{ size: "2.25rem",  line: "2.5rem" },    // 36/40
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPACING & LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

export const radius = {
  none: "0",
  sm: "0.125rem",
  md: "0.375rem",
  lg: "0.5rem",      // default — matches --radius
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const;

export const shadow = {
  xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTION
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    fast: 120,      // ms
    normal: 200,
    slow: 320,
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1] as const,          // cubic-bezier
    easeIn:  [0.7, 0, 0.84, 0] as const,
    easeInOut: [0.83, 0, 0.17, 1] as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BREAKPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",      // primary target
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Z-INDEX
// ─────────────────────────────────────────────────────────────────────────────

export const zIndex = {
  dropdown: 10,
  sticky: 20,
  banner: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  command: 90,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = keyof typeof severity;
export type Status = keyof typeof status;
export type StandardPack = keyof typeof standardPackAccent;

// Convenience: complete token object for non-CSS contexts.
export const tokens = {
  palette,
  semantic,
  severity,
  status,
  standardPackAccent,
  typography,
  spacing,
  radius,
  shadow,
  motion,
  breakpoints,
  zIndex,
} as const;

export default tokens;
