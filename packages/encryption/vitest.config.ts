import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 180_000, // LocalStack startup on cold image pull
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
