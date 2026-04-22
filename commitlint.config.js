// Conventional Commits with AIMS-specific scopes.
// See engineering/LINTING-FORMATTING.md §7 for full rationale.

export default {
  extends: ["@commitlint/config-conventional"],

  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],

    "scope-enum": [
      1,
      "always",
      [
        // Product areas
        "engagement", "finding", "recommendation", "cap",
        "approval", "report", "universe", "staff", "qa",
        "planning", "prcm", "fieldwork", "workpaper", "pbc",
        "auth", "billing", "tenant", "admin",

        // Cross-cutting
        "api", "web", "worker", "mobile",
        "db", "cache", "queue", "search",
        "infra", "ci", "deploy", "secrets", "observability",
        "ui", "forms", "i18n", "a11y",

        // Data + packs
        "pack", "schema", "validation", "encryption",

        // Tooling
        "eslint", "prettier", "tsconfig", "husky", "turbo",

        // Repo-level
        "deps", "release", "docs", "monorepo",
      ],
    ],

    "type-case": [2, "always", "lower-case"],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [2, "always"],
    "header-max-length": [2, "always", 100],
    "type-empty": [2, "never"],
  },

  ignores: [
    (message) => message.startsWith("chore(main): release"),
    (message) => message.startsWith("chore(deps):"),
    (message) => message.startsWith("build(deps):"),
    (message) => message.startsWith('Revert "'),
    (message) => message.startsWith("Initial"),
  ],
};
