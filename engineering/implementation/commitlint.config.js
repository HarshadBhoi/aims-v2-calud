// REFERENCE IMPLEMENTATION — commitlint config (repo root).
//
// Conventional Commits with AIMS-specific scope enforcement.
// Runs via husky commit-msg hook + on every PR via GH Action on PR title.

export default {
  extends: ["@commitlint/config-conventional"],

  rules: {
    // Types — our allowed set.
    "type-enum": [2, "always", [
      "feat",       // new feature
      "fix",        // bug fix
      "perf",       // performance
      "refactor",   // no behavior change
      "docs",       // documentation only
      "test",       // adding/updating tests
      "build",      // build system / tooling / deps
      "ci",         // CI config
      "chore",      // misc (version bumps, housekeeping)
      "revert",     // revert a prior commit
    ]],

    // Scope (optional, but if present must be one of our recognized scopes).
    "scope-enum": [1, "always", [
      // Product areas
      "engagement", "finding", "recommendation", "cap",
      "approval", "report", "universe", "staff", "qa",
      "planning", "prcm", "fieldwork", "workpaper",
      "auth", "billing", "tenant", "admin",

      // Cross-cutting
      "api", "web", "worker", "mobile",
      "db", "cache", "queue", "search",
      "infra", "ci", "deploy", "secrets", "observability",
      "ui", "forms", "i18n", "a11y",

      // Data + packs
      "pack", "schema", "validation",

      // Tooling
      "eslint", "prettier", "tsconfig", "husky", "turbo",

      // Repo-level
      "deps", "release", "docs",
    ]],

    // Format.
    "type-case":       [2, "always", "lower-case"],
    "scope-case":      [2, "always", "lower-case"],
    "subject-case":    [2, "always", "lower-case"],
    "subject-empty":   [2, "never"],
    "subject-full-stop":[2, "never", "."],
    "subject-max-length":[2, "always", 72],
    "body-max-line-length":[2, "always", 100],
    "footer-leading-blank":[2, "always"],

    // Header.
    "header-max-length":[2, "always", 100],

    // Types must be followed by colon + space.
    "type-empty":      [2, "never"],
  },

  // Ignore bot commits (Release Please, Dependabot), which have their own formats.
  ignores: [
    (message) => message.startsWith("chore(main): release"),
    (message) => message.startsWith("chore(deps):"),
    (message) => message.startsWith("build(deps):"),
    (message) => message.startsWith("Revert \""),
  ],

  // Help URL shown on failure.
  helpUrl: "https://github.com/acme-aims/aims-v2/blob/main/engineering/LINTING-FORMATTING.md#7-commit-message-convention",
};
