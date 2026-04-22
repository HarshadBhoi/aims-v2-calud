// Flat ESLint config for the AIMS v2 monorepo root.
// Applies rules by file path pattern — single config file for the whole repo.

import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";
import nPlugin from "eslint-plugin-n";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import securityPlugin from "eslint-plugin-security";
import vitestPlugin from "@vitest/eslint-plugin";

export default [
  // ─── Global ignores ──────────────────────────────────────────────────
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/*.generated.ts",
      "**/*.d.ts",
      "aims-v2-platform/**", // if backup remnants ever reappear
    ],
  },

  // ─── Base: TypeScript strict, everywhere ─────────────────────────────
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
      unicorn: unicornPlugin,
      n: nPlugin,
    },

    rules: {
      // TypeScript strictness
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // Imports
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-default-export": "error",
      "import/no-cycle": ["error", { maxDepth: 10 }],
      "import/no-self-import": "error",
      "import/no-duplicates": "error",

      // Unicorn
      "unicorn/no-null": "off",
      "unicorn/prefer-module": "error",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/prevent-abbreviations": "off",

      // Correctness / safety
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-eval": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "prefer-const": "error",
      "no-var": "error",
      "no-param-reassign": ["error", { props: true }],

      // AIMS-specific banned patterns
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "lodash", message: "Use lodash-es with named imports." },
            { name: "moment", message: "Use date-fns." },
            { name: "axios", message: "Use the global fetch API or tRPC client." },
          ],
          patterns: [
            { group: ["lodash/*"], message: "Use lodash-es with named imports." },
          ],
        },
      ],

      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "Math.random() is not cryptographically secure. Use crypto.getRandomValues() or crypto.randomUUID().",
        },
        {
          selector: "TSEnumDeclaration:not([const=true])",
          message: "Use const enums or `as const` objects — plain enums have runtime overhead.",
        },
      ],
    },
  },

  // ─── React/Next.js: apps/web ─────────────────────────────────────────
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      "@next/next": nextPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react/jsx-no-target-blank": "error",
      "react/jsx-key": "error",
      "react/no-array-index-key": "error",
      "react/self-closing-comp": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-html-link-for-pages": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
    },
  },

  // Next.js file-convention exports (page/layout/etc. must default-export)
  {
    files: [
      "apps/web/app/**/page.tsx",
      "apps/web/app/**/layout.tsx",
      "apps/web/app/**/loading.tsx",
      "apps/web/app/**/error.tsx",
      "apps/web/app/**/not-found.tsx",
      "apps/web/app/**/route.ts",
      "apps/web/app/**/default.tsx",
      "apps/web/middleware.ts",
      "apps/web/next.config.*",
      "apps/web/tailwind.config.*",
      "apps/web/postcss.config.*",
    ],
    rules: { "import/no-default-export": "off" },
  },

  // ─── Server: apps/api + apps/worker ──────────────────────────────────
  {
    files: ["apps/api/**/*.ts", "apps/worker/**/*.ts"],
    plugins: { security: securityPlugin },
    rules: {
      "n/no-process-exit": "error",
      "n/no-deprecated-api": "error",
      "n/no-missing-import": "off",
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-child-process": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
      "import/no-default-export": "off", // NestJS modules + bootstrap files
    },
  },

  // ─── Tests ───────────────────────────────────────────────────────────
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.{ts,tsx}"],
    plugins: { vitest: vitestPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": "off",
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/consistent-test-it": ["error", { fn: "it" }],
      "vitest/expect-expect": "error",
      "vitest/valid-expect": "error",
    },
  },

  // ─── Config files (eslint/prettier/etc.) ─────────────────────────────
  {
    files: ["*.config.{js,ts,mjs}", "*.config.*.{js,ts,mjs}"],
    rules: {
      "import/no-default-export": "off",
    },
  },
];
