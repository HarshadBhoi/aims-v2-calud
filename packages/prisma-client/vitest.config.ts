import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // Testcontainers starts a Postgres container on first run — slow.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run sequentially to avoid container/port contention.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
