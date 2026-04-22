# Linting, Formatting & Commit Hygiene

> ESLint flat config, Prettier for formatting, Husky + lint-staged pre-commit hooks, commitlint for messages. One source of truth; everything shared via `@aims/eslint-config` and `@aims/tsconfig` workspace packages.

---

## 1. Tool Stack

| Tool | Purpose | Scope |
|------|---------|-------|
| **TypeScript** | Type checking | Every `.ts`, `.tsx` |
| **ESLint** (flat config) | Lint rules | All source + tests |
| **Prettier** | Formatting | All source + config + markdown |
| **typescript-eslint** | TS-aware lint rules | TS files |
| **eslint-plugin-import** | Import order/cycles | All |
| **eslint-plugin-unicorn** | Modern JS best practices | All |
| **eslint-plugin-jsx-a11y** | A11y in JSX | Frontend |
| **eslint-plugin-react** + react-hooks | React rules | Frontend |
| **eslint-plugin-security** | Security rules | Server |
| **@vitest/eslint-plugin** | Test rules | Test files |
| **eslint-plugin-playwright** | E2E rules | E2E tests |
| **eslint-plugin-n** (node) | Node built-ins + ESM rules | Server |
| **eslint-plugin-i18n** (custom) | No hardcoded strings in JSX | Frontend |
| **Husky** | Git hooks | Local |
| **lint-staged** | Run tools on staged files | Local |
| **commitlint** | Conventional commit enforcement | Local + CI |
| **gitleaks** | Secret detection | Local + CI |

### Why ESLint over Biome (at least for now)
We considered **Biome** (Rust-based; bundles lint + format; fast). Chose ESLint for:
- Mature plugin ecosystem (jsx-a11y, react, security, playwright — no Biome equivalents)
- TypeScript rule depth via `typescript-eslint`
- Long-lived org memory around ESLint

Monitoring Biome; may revisit once plugin coverage matches. Prettier is non-negotiable — Biome's formatter is close but ESLint + Prettier is today's standard.

---

## 2. Workspace Config Packages

Shared configs distributed as workspace packages — no copy-paste drift.

```
packages/
├── tsconfig/
│   ├── base.json
│   ├── next.json         # extends base, Next.js-specific
│   ├── nestjs.json
│   └── library.json
├── eslint-config/
│   ├── package.json
│   ├── index.js          # base
│   ├── react.js          # + React / hooks / JSX-a11y
│   ├── nestjs.js         # + node / security / decorators
│   └── vitest.js         # + test rules
└── prettier-config/
    └── index.js          # single file; imported by every package
```

Every app / package extends these. Local overrides allowed but reviewed.

---

## 3. ESLint — Base Configuration (sketch)

Flat config in `eslint.config.js` at repo root:

```js
// eslint.config.js (repo root — composes all workspaces)
import base from "@aims/eslint-config";
import react from "@aims/eslint-config/react";
import nestjs from "@aims/eslint-config/nestjs";
import vitest from "@aims/eslint-config/vitest";
import playwright from "eslint-plugin-playwright";

export default [
  ...base,
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...react,
  },
  {
    files: ["apps/api/**/*.ts", "apps/worker/**/*.ts"],
    ...nestjs,
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.ts"],
    ...vitest,
  },
  {
    files: ["e2e/**/*.ts"],
    ...playwright.configs["flat/recommended"],
  },
  { ignores: ["dist/", ".next/", "coverage/", "**/*.generated.ts"] },
];
```

### Base rules (highlights)
```js
export default [
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
      "import": importPlugin,
      "unicorn": unicornPlugin,
    },
    rules: {
      // TypeScript — strict
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/strict-boolean-expressions": ["error", {
        allowString: false, allowNumber: false, allowNullableObject: false,
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
        "ts-ignore": true,           // banned outright
        "ts-nocheck": true,
        "ts-check": false,
      }],

      // Imports
      "import/order": ["error", {
        "groups": [
          "builtin", "external", "internal", "parent", "sibling", "index", "object", "type"
        ],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true },
      }],
      "import/no-default-export": "error",        // named exports only (except pages)
      "import/no-cycle": ["error", { maxDepth: 10 }],
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",

      // Formatting / general
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "multi-line"],
      "prefer-const": "error",
      "object-shorthand": "error",
      "no-var": "error",

      // Unicorn
      "unicorn/no-null": "off",                       // null has meaning (DB)
      "unicorn/prefer-module": "error",
      "unicorn/prefer-node-protocol": "error",        // `import "node:fs"` not `"fs"`
      "unicorn/prefer-top-level-await": "error",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-array-for-each": "off",             // for/each is fine
      "unicorn/prevent-abbreviations": "off",         // too opinionated

      // Custom patterns
      "no-restricted-imports": ["error", {
        paths: [
          { name: "lodash", message: "Use lodash-es with named imports." },
          { name: "moment", message: "Use date-fns." },
          { name: "axios", message: "Use global fetch / tRPC." },
        ],
      }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^\\d{3}-\\d{2}-\\d{4}$/]",
          message: "Never hardcode SSN-like patterns.",
        },
        {
          selector: "CallExpression[callee.name='Math.random']",
          message: "Math.random() is not cryptographically secure. Use crypto.getRandomValues().",
        },
      ],
    },
  },
];
```

### React overrides
```js
// packages/eslint-config/react.js
export default {
  plugins: {
    "react": reactPlugin,
    "react-hooks": reactHooksPlugin,
    "jsx-a11y": jsxA11yPlugin,
    "@next/next": nextPlugin,
  },
  rules: {
    // React
    "react/jsx-no-target-blank": "error",
    "react/jsx-key": "error",
    "react/no-array-index-key": "error",
    "react/no-unstable-nested-components": "error",
    "react/self-closing-comp": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",

    // Next.js
    "@next/next/no-img-element": "error",
    "@next/next/no-html-link-for-pages": "error",

    // Accessibility (baseline — full checks in ACCESSIBILITY.md)
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-autofocus": "warn",
    "jsx-a11y/no-static-element-interactions": "error",
    "jsx-a11y/label-has-associated-control": "error",
  },
};
```

### Custom rules (ours)
`packages/eslint-plugin-aims/` — custom org-specific rules:

- `no-hardcoded-user-strings` — flags literal strings in JSX that are not inside `t()`
- `require-tenant-scope` — detects Prisma queries missing `tenantId` (heuristic)
- `no-skip-test` — detects `test.skip`, `it.only` (blocked committed)
- `standard-pack-field-naming` — custom domain rule

Maintained alongside standards changes.

---

## 4. Prettier Configuration

Single config, workspace-shared:

```js
// packages/prettier-config/index.js
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  embeddedLanguageFormatting: "auto",
  plugins: ["prettier-plugin-tailwindcss"],         // sorts Tailwind classes
};
```

Every package `package.json` references:
```json
{ "prettier": "@aims/prettier-config" }
```

### Prettier vs ESLint boundary
- **Prettier** — formatting (whitespace, quotes, line wrap)
- **ESLint** — code quality (logic, patterns, imports)
- `eslint-config-prettier` disables ESLint rules Prettier handles
- Never let them fight

---

## 5. TypeScript Configuration

`packages/tsconfig/base.json` (see `CODE-STANDARDS.md §1` for flags). Plus:

```jsonc
{
  "extends": "@tsconfig/strictest/tsconfig.json",   // community baseline we build on
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo",
    "composite": true,                               // project references enabled
    "paths": {
      "@/*": ["./src/*"],
      "@validation/*": ["../../packages/validation/src/*"],
      "@standard-packs/*": ["../../packages/standard-packs/src/*"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

### Project references for fast builds
Monorepo uses TS project references for incremental builds — only changed packages rebuild.

### `tsc --noEmit` as type check
Build = bundler (Next, esbuild); type check = separate `tsc` step. Both run in CI.

---

## 6. Pre-Commit Hooks — Husky + lint-staged

### Husky setup
```
.husky/
├── pre-commit
├── commit-msg
└── pre-push
```

### `pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec lint-staged
pnpm exec gitleaks protect --staged --no-banner
```

### `lint-staged` config
```json
{
  "*.{ts,tsx}": [
    "pnpm prettier --write",
    "pnpm eslint --fix --max-warnings=0",
    "pnpm typecheck:affected"
  ],
  "*.{js,mjs,cjs}": [
    "pnpm prettier --write",
    "pnpm eslint --fix --max-warnings=0"
  ],
  "*.{json,md,yml,yaml}": [
    "pnpm prettier --write"
  ],
  "*.{tf,tfvars}": [
    "tofu fmt",
    "tfsec --minimum-severity HIGH"
  ]
}
```

### `commit-msg`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec commitlint --edit "$1"
```

### `pre-push`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec turbo run test:quick lint typecheck --affected
```

Keeps pushes fast-but-safe. Full test suite runs in CI.

### Opt-out
`--no-verify` is available but monitored; CI catches anything bypassed locally.

---

## 7. Commit Message Convention

### Conventional Commits, strictly enforced

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat` — new feature (MINOR bump)
- `fix` — bug fix (PATCH bump)
- `perf` — performance (PATCH bump)
- `refactor` — no behavior change
- `docs` — documentation only
- `test` — adding/updating tests
- `build` — build tooling
- `ci` — CI config
- `chore` — everything else (version bumps, deps, housekeeping)
- `revert` — revert prior commit

### Scope
Matches a feature area: `engagement`, `finding`, `approval`, `auth`, `infra`, `frontend`, `api`, etc. Single-word lowercase.

### Breaking changes
Append `!` after type/scope:
```
feat(api)!: rename engagement.standardPack to engagement.pack
```
Or in footer:
```
BREAKING CHANGE: approval chain now requires explicit role mapping.
```

### Subject rules (commitlint-enforced)
- Imperative mood ("add" not "added"/"adds")
- No trailing period
- Max 72 chars
- Lowercase

### Body (optional)
Explains *why*, references issue:
```
feat(finding): allow bulk approval up to 50 items

Supervisors approve dozens per fortnight. Previous 1-by-1 flow was a
30-minute drag. Bulk action with atomic DB transaction + single audit
event per batch.

Closes LIN-1234.
```

### Commitlint config
```js
// commitlint.config.js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat","fix","perf","refactor","docs","test","build","ci","chore","revert"
    ]],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "always", "lower-case"],
    "subject-full-stop": [2, "never", "."],
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [2, "always"],
  },
};
```

### PR title = merge commit message
We squash-merge. PR title becomes the one commit. Title enforced via GH Action using commitlint.

---

## 8. Formatting Non-Code Files

### Markdown
- Prettier formats `.md`
- Line length 100 (matches code)
- No trailing whitespace
- Fenced code blocks with language specified

### JSON / YAML
- Prettier
- YAML specifically: 2-space indent, no tabs
- JSON trailing commas off (invalid)

### Terraform
- `tofu fmt` (or `terraform fmt`)
- `tflint` for style

### SQL
- `pg_format` via pre-commit hook
- Raw SQL must be reviewed extra carefully (see `CODE-STANDARDS.md §15`)

### Dockerfile
- `hadolint` in CI (`hadolint-action`)

### Shell scripts
- `shfmt -i 2 -ci`
- `shellcheck` for quality

---

## 9. Editor Configuration

### `.editorconfig`
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false          # markdown trailing 2-space = line break
```

### VS Code `.vscode/extensions.json` (recommended)
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "yoavbls.pretty-ts-errors",
    "meganrogge.template-string-converter",
    "firsttris.vscode-jest-runner",
    "EditorConfig.EditorConfig"
  ]
}
```

### `.vscode/settings.json` (workspace)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "eslint.experimental.useFlatConfig": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n"
}
```

Tracked in repo so every dev gets the same setup. Individual preferences live in user settings (not workspace).

---

## 10. CI Enforcement

Every rule that fires locally also fires in CI:
- **Lint**: `pnpm turbo lint --filter=...[HEAD^1]` — fail on any error; zero warnings allowed
- **Format check**: `prettier --check` — fails on any unformatted file
- **Type check**: `pnpm turbo typecheck` — fail on any error
- **Commit lint**: GitHub Action validates PR title + commit messages
- **Dependency policy**: custom script blocks disallowed deps

Full details in `devops/CI-CD.md §2`.

---

## 11. Exception Handling

ESLint allows rule disables. We require:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Reason: third-party lib types fail — using any until v3.x release with fix.
const x: any = fetchThirdParty();
```

Rules:
- Must include reason
- Must be narrowest scope (`-next-line` or `-line`, never whole file)
- No blanket `/* eslint-disable */` at file top
- Reviewer must approve

Recurring disables → refactor the code OR reconsider the rule.

### `@ts-expect-error` over `@ts-ignore`
Use `@ts-expect-error` with reason. It's self-healing — if the error goes away, TS flags it for removal:
```ts
// @ts-expect-error — until openapi-ts v2 generates proper types
const x: string = lib.returnsNever();
```

---

## 12. Tool Version Pinning

- Node: exact version in `.nvmrc` + `package.json` `engines` + `packageManager`
- pnpm: `packageManager: "pnpm@9.12.0"` (exact) in root `package.json`; corepack enforces
- TS, ESLint, Prettier, Vitest: exact versions in deps (no `^`)
- Upgrades: done in dedicated PRs with full CI verification

Version drift across engineers is a frequent source of "works on my machine" — banned.

---

## 13. Monorepo Tooling

### pnpm workspaces
- `pnpm-workspace.yaml` declares workspace packages
- `pnpm --filter=<package> <cmd>` scopes commands
- `pnpm install` at root installs everything, dedupes via its content-addressed store

### Turborepo
- `turbo.json` defines pipeline with `dependsOn`
- Local + remote cache (self-hosted S3; see `devops/CI-CD.md §4`)
- `turbo run build test lint --affected` — only affected packages
- `turbo run dev --parallel` — all dev servers simultaneously

---

## 14. Diff Hygiene

### Pre-merge linting is mandatory; big reformats are forbidden
- No PR can include both "feature change + format 10,000 lines"
- Reformats always their own PR, titled `chore: reformat <scope>`
- Makes review focused; git history readable

### `.gitattributes`
```
*         text=auto eol=lf
*.png     binary
*.jpg     binary
*.pdf     binary
pnpm-lock.yaml    -diff merge=ours    # don't diff; always regenerate
```

### `.gitignore`
- `node_modules/`
- `.next/`, `dist/`, `coverage/`, `.turbo/`
- `.env.local`, `*.env`, `.env.*.local`
- Local-only files (.DS_Store, IDE cache)

Never commit: generated code, build artifacts, local env files.

---

## 15. Generated Code

Some code is generated (Prisma client, tRPC client, OpenAPI client). Rules:
- Lives in `generated/` subdirectory
- Excluded from ESLint (`ignores` pattern)
- Excluded from coverage
- Regenerated in CI; mismatch between committed + regenerated = fail
- Never edited by hand

---

## 16. Developer Experience Targets

| Target | Measurement |
|--------|-------------|
| `pnpm install` (warm) | < 30 s |
| `pnpm install` (cold) | < 3 min |
| `pnpm dev` startup | < 15 s |
| `pnpm lint` on one file | < 2 s |
| `pnpm test:watch` feedback | < 2 s on small change |
| pre-commit hook | < 30 s |
| `pnpm typecheck` (full, cached) | < 20 s |

If any of these regress, we invest. Dev-loop speed is a hidden productivity multiplier.

---

## 17. What We Don't Do

- **Per-team formatting/lint config** — workspace package is source of truth
- **Silent auto-fix in CI** — fail with clear error; humans fix then push
- **Weekly "we'll fix lint warnings later" drift** — zero-warnings policy
- **Disable rules without justification**
- **Commit `.DS_Store` / IDE files** — `.gitignore` covers
- **`--no-verify` as habit** — emergency escape only
- **Mixing tabs and spaces** (duh)
- **EditorConfig violations** (CI fails)

---

## 18. Related Documents

- `CODE-STANDARDS.md` — the standards these tools enforce
- `REVIEW.md` — human-level review beyond lint
- `../devops/CI-CD.md` — how these run in CI
- `TECH-DEBT.md` — managing exceptions over time
- `implementation/eslint.config.js` — full example config (in implementation folder)
