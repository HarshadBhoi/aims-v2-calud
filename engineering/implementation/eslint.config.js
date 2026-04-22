// REFERENCE IMPLEMENTATION — Shared ESLint flat config for AIMS v2.
//
// Exported from packages/eslint-config/ as three entrypoints:
//   "@aims/eslint-config"          → base (every package)
//   "@aims/eslint-config/react"    → + React/Next/a11y rules
//   "@aims/eslint-config/nestjs"   → + Node/security rules
//   "@aims/eslint-config/vitest"   → + test rules
//
// Root apps compose them in their own eslint.config.js — see the example at
// the bottom of this file.

// ─────────────────────────────────────────────────────────────────────────────
// packages/eslint-config/index.js   (base)
// ─────────────────────────────────────────────────────────────────────────────

import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";
import nPlugin from "eslint-plugin-n";

export const base = [
  // Global ignores — runs before everything.
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/*.generated.ts",
      "**/*.d.ts",
    ],
  },

  // TypeScript-recommended.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,                    // enables type-aware rules
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "import":             importPlugin,
      "unicorn":            unicornPlugin,
      "n":                  nPlugin,
    },

    rules: {
      // ─── TypeScript strictness ────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
      }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
        "ts-check": false,
        minimumDescriptionLength: 10,
      }],
      "@typescript-eslint/explicit-module-boundary-types": "off",   // inference is enough
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],

      // ─── Imports ──────────────────────────────────────────────────────────
      "import/order": ["error", {
        groups: [
          "builtin", "external", "internal",
          "parent", "sibling", "index",
          "object", "type",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
        pathGroups: [
          { pattern: "@/**",            group: "internal", position: "before" },
          { pattern: "@validation/**",  group: "internal", position: "before" },
          { pattern: "@standard-packs/**", group: "internal", position: "before" },
        ],
      }],
      "import/no-default-export": "error",      // exceptions overridden per-package for pages
      "import/no-cycle":          ["error", { maxDepth: 10 }],
      "import/no-self-import":    "error",
      "import/no-useless-path-segments": "error",
      "import/no-duplicates":     "error",

      // ─── Unicorn — modern JS idioms ───────────────────────────────────────
      "unicorn/no-null":                     "off",    // null has meaning (DB NULL)
      "unicorn/prefer-module":               "error",
      "unicorn/prefer-node-protocol":        "error",
      "unicorn/prefer-top-level-await":      "error",
      "unicorn/filename-case":               ["error", { case: "kebabCase" }],
      "unicorn/no-array-for-each":           "off",
      "unicorn/prevent-abbreviations":       "off",    // too opinionated
      "unicorn/prefer-string-starts-ends-with": "error",
      "unicorn/prefer-regexp-test":          "error",

      // ─── General correctness / safety ────────────────────────────────────
      "no-console":        ["error", { allow: ["warn", "error"] }],
      "no-debugger":       "error",
      "no-alert":          "error",
      "no-eval":           "error",
      "no-new-func":       "error",
      "no-implied-eval":   "error",
      "no-return-await":   "off",                       // superseded by @typescript-eslint/return-await
      "eqeqeq":            ["error", "always", { null: "ignore" }],
      "curly":             ["error", "multi-line"],
      "prefer-const":      "error",
      "object-shorthand":  "error",
      "no-var":            "error",
      "no-param-reassign": ["error", { props: true }],

      // ─── AIMS-specific banned patterns ───────────────────────────────────
      "no-restricted-imports": ["error", {
        paths: [
          { name: "lodash",                message: "Use lodash-es with named imports." },
          { name: "moment",                message: "Use date-fns." },
          { name: "axios",                 message: "Use the global fetch API or tRPC client." },
          { name: "react-router",          message: "We use next/navigation — App Router." },
          { name: "react-router-dom",      message: "We use next/navigation — App Router." },
        ],
        patterns: [
          { group: ["lodash/*"], message: "Use lodash-es with named imports." },
        ],
      }],

      "no-restricted-syntax": ["error",
        {
          selector: "CallExpression[callee.name='Math.random']",
          message: "Math.random() is not cryptographically secure. Use crypto.getRandomValues() or crypto.randomUUID().",
        },
        {
          selector: "TSEnumDeclaration:not([const=true])",
          message: "Use const enums or `as const` objects — plain enums have runtime overhead.",
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Access env vars via @/config/env (zod-validated) — not process.env directly.",
        },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// packages/eslint-config/react.js
// ─────────────────────────────────────────────────────────────────────────────

import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";

export const react = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react":       reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y":    jsxA11yPlugin,
      "@next/next":  nextPlugin,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React core
      "react/jsx-no-target-blank":            "error",
      "react/jsx-key":                        "error",
      "react/no-array-index-key":             "error",
      "react/no-unstable-nested-components":  "error",
      "react/self-closing-comp":              "error",
      "react/jsx-no-useless-fragment":        "error",
      "react/no-danger":                      "warn",
      "react/no-danger-with-children":        "error",
      "react/jsx-pascal-case":                "error",
      "react/prop-types":                     "off",   // we use TypeScript
      "react/react-in-jsx-scope":             "off",   // Next.js + new JSX transform

      // Hooks
      "react-hooks/rules-of-hooks":           "error",
      "react-hooks/exhaustive-deps":          "error",

      // Next.js
      "@next/next/no-img-element":            "error",
      "@next/next/no-html-link-for-pages":    "error",
      "@next/next/no-sync-scripts":           "error",

      // A11y baseline (frontend/ACCESSIBILITY.md has fuller policy)
      "jsx-a11y/alt-text":                    "error",
      "jsx-a11y/anchor-is-valid":             "error",
      "jsx-a11y/click-events-have-key-events":"error",
      "jsx-a11y/no-autofocus":                "warn",
      "jsx-a11y/no-static-element-interactions":"error",
      "jsx-a11y/label-has-associated-control":"error",
      "jsx-a11y/role-has-required-aria-props":"error",
      "jsx-a11y/role-supports-aria-props":    "error",
    },
  },

  // Page files allow default exports (Next.js requires).
  {
    files: ["apps/web/app/**/page.tsx", "apps/web/app/**/layout.tsx",
            "apps/web/app/**/loading.tsx", "apps/web/app/**/error.tsx",
            "apps/web/app/**/not-found.tsx", "apps/web/app/**/route.ts",
            "apps/web/app/**/default.tsx", "apps/web/middleware.ts"],
    rules: {
      "import/no-default-export": "off",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// packages/eslint-config/nestjs.js
// ─────────────────────────────────────────────────────────────────────────────

import securityPlugin from "eslint-plugin-security";

export const nestjs = [
  {
    files: ["apps/api/**/*.ts", "apps/worker/**/*.ts"],
    plugins: {
      "security": securityPlugin,
    },
    rules: {
      // Node
      "n/no-process-exit":                "error",
      "n/no-deprecated-api":              "error",
      "n/no-extraneous-import":           "error",
      "n/no-missing-import":              "off",    // TS handles this
      "n/no-unpublished-import":          "off",

      // Security (server-side critical)
      "security/detect-eval-with-expression":     "error",
      "security/detect-non-literal-fs-filename":  "error",
      "security/detect-non-literal-require":      "error",
      "security/detect-child-process":            "error",
      "security/detect-object-injection":         "warn",
      "security/detect-pseudoRandomBytes":        "error",
      "security/detect-unsafe-regex":             "error",
      "security/detect-buffer-noassert":          "error",

      // Default exports OK for NestJS modules (framework convention)
      "import/no-default-export":                 "off",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// packages/eslint-config/vitest.js
// ─────────────────────────────────────────────────────────────────────────────

import vitestPlugin from "@vitest/eslint-plugin";

export const vitest = [
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.ts", "**/test/**/*.tsx"],
    plugins: {
      "vitest": vitestPlugin,
    },
    rules: {
      // Tests can use defaults / reveal, relax some rules.
      "@typescript-eslint/no-explicit-any":            "off",
      "@typescript-eslint/no-unsafe-assignment":       "off",
      "@typescript-eslint/no-unsafe-member-access":    "off",
      "@typescript-eslint/no-unsafe-call":             "off",
      "@typescript-eslint/no-non-null-assertion":      "off",
      "@typescript-eslint/unbound-method":             "off",
      "no-console":                                    "off",

      // Test-specific.
      "vitest/no-focused-tests":                       "error",   // blocks test.only / it.only in main
      "vitest/no-disabled-tests":                      "warn",    // warns on test.skip / it.skip
      "vitest/consistent-test-it":                     ["error", { fn: "it" }],
      "vitest/expect-expect":                          "error",
      "vitest/no-identical-title":                     "error",
      "vitest/prefer-to-have-length":                  "error",
      "vitest/prefer-to-be":                           "error",
      "vitest/valid-expect":                           "error",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// packages/eslint-config/package.json
// ─────────────────────────────────────────────────────────────────────────────
// {
//   "name": "@aims/eslint-config",
//   "version": "0.1.0",
//   "type": "module",
//   "exports": {
//     ".":        "./index.js",
//     "./react":  "./react.js",
//     "./nestjs": "./nestjs.js",
//     "./vitest": "./vitest.js"
//   },
//   "peerDependencies": {
//     "eslint":                      "^9.0.0",
//     "typescript":                  "^5.5.0",
//     "typescript-eslint":           "^8.0.0",
//     "eslint-plugin-import":        "^2.29.0",
//     "eslint-plugin-unicorn":       "^52.0.0"
//   }
// }

// ─────────────────────────────────────────────────────────────────────────────
// apps/web/eslint.config.js   (example composition)
// ─────────────────────────────────────────────────────────────────────────────

import { base, react, vitest } from "@aims/eslint-config";

export default [
  ...base,
  ...react,
  ...vitest,
  // Local overrides (if any) go here.
  {
    rules: {
      // example: relax a rule for a specific area
    },
  },
];
