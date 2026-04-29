import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 240_000,
    include: ["src/**/*.test.ts"],
  },
});
