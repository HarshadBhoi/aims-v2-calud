/**
 * Tailwind CSS v4 configuration for AIMS v2.
 *
 * Tailwind v4 shifts most configuration into CSS-first via @theme directives in
 * `globals.css`. This file remains for:
 *   - `content` paths (scan for class names)
 *   - `darkMode` strategy (attribute-based so we can use `data-theme`)
 *   - Tailwind plugins
 *   - Safelist for dynamic classes (rare)
 *
 * Token values live in:
 *   - `implementation/design-tokens.ts` (TypeScript — consumed by charts/motion)
 *   - `apps/web/styles/tokens.css` (CSS variables — consumed by components)
 *
 * The two are kept in sync by a codegen script (`scripts/sync-tokens.ts`)
 * that reads `design-tokens.ts` and emits `tokens.css`.
 */

import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import containerQueries from "@tailwindcss/container-queries";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    // workspace packages that render JSX
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],

  // Attribute-based dark mode lets us gate with [data-theme="dark"].
  darkMode: ["class", "[data-theme='dark']"],

  theme: {
    // Container defaults — centered with responsive padding.
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },

    // Extend (not replace) the default scales. Defaults are sensible.
    extend: {
      colors: {
        // All colors resolve to CSS variables — so tenant theming works.
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Audit domain — non-brand, not tenant-overridable.
        severity: {
          critical: "hsl(var(--severity-critical))",
          high:     "hsl(var(--severity-high))",
          medium:   "hsl(var(--severity-medium))",
          low:      "hsl(var(--severity-low))",
          info:     "hsl(var(--severity-info))",
        },
        status: {
          draft:     "hsl(var(--status-draft))",
          submitted: "hsl(var(--status-submitted))",
          inreview:  "hsl(var(--status-inreview))",
          approved:  "hsl(var(--status-approved))",
          rejected:  "hsl(var(--status-rejected))",
          issued:    "hsl(var(--status-issued))",
          closed:    "hsl(var(--status-closed))",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Cascadia Code", "Source Code Pro", "monospace"],
      },

      // Typography scale from design tokens.
      fontSize: {
        xs:   ["0.75rem",  { lineHeight: "1rem" }],
        sm:   ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem",     { lineHeight: "1.5rem" }],
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
        "2xl":["1.5rem",   { lineHeight: "2rem" }],
        "3xl":["1.875rem", { lineHeight: "2.25rem" }],
        "4xl":["2.25rem",  { lineHeight: "2.5rem" }],
      },

      // Z-index named layers.
      zIndex: {
        dropdown: "10",
        sticky:   "20",
        banner:   "30",
        overlay:  "40",
        modal:    "50",
        popover:  "60",
        toast:    "70",
        tooltip:  "80",
        command:  "90",
      },

      // Motion.
      transitionDuration: {
        fast:   "120ms",
        normal: "200ms",
        slow:   "320ms",
      },
      transitionTimingFunction: {
        "ease-out":    "cubic-bezier(0.16, 1, 0.3, 1)",
        "ease-in":     "cubic-bezier(0.7, 0, 0.84, 0)",
        "ease-in-out": "cubic-bezier(0.83, 0, 0.17, 1)",
      },

      // Key animations that Shadcn primitives rely on.
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to:   { opacity: "0" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down":   "accordion-down 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up":     "accordion-up 200ms cubic-bezier(0.7, 0, 0.84, 0)",
        "collapsible-down": "collapsible-down 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "collapsible-up":   "collapsible-up 200ms cubic-bezier(0.7, 0, 0.84, 0)",
        "fade-in":          "fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-out":         "fade-out 120ms cubic-bezier(0.7, 0, 0.84, 0)",
        "slide-in-right":   "slide-in-from-right 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },

  plugins: [
    animate,              // Shadcn-compatible animation utilities.
    containerQueries,     // @container queries for component-level responsiveness.
    typography,           // Prose styles for rich text (TipTap output).
  ],

  // Do not safelist arbitrary classes — tenants use CSS variables, not classes.
  // Add here ONLY if a class is constructed dynamically from runtime data.
  safelist: [],

  // Tailwind v4 is future-compatible; no `future` flags needed.
  future: {},
} satisfies Config;
