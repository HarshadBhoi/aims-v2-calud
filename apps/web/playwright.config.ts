import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for slice A's end-to-end journey test.
 *
 * Assumes the dev stack is up:
 *   pnpm infra:up
 *   pnpm --filter @aims/prisma-client db:migrate:deploy
 *   pnpm --filter @aims/api dev      # http://localhost:3001
 *   pnpm --filter @aims/web dev      # http://localhost:3000
 *   pnpm --filter @aims/worker dev   # SQS poller + outbox publisher
 *
 * The global-setup script wipes business tables and seeds a fresh tenant +
 * user + MFA + GAGAS pack so each test run starts deterministic. We don't
 * use Playwright's built-in `webServer` — the four-process stack is too
 * stateful for Playwright's port-poll model, and `pnpm dev` is what the
 * developer is already running anyway.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // Slice A's journey is deeply ordered — sign-in writes a session cookie
  // which subsequent pages read; the worker drains a queue we mutate. Run
  // serially with one worker.
  fullyParallel: false,
  workers: 1,
  retries: 0,

  timeout: 120_000, // includes worker poll wait for PDF render

  reporter: [["list"]],

  use: {
    baseURL: process.env["AIMS_E2E_WEB_URL"] ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
