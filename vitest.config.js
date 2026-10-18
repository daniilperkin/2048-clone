import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.js"],
    // jsdom construction dominated the suite (94% of tracked time, ~80 s
    // across 21 files) — vmThreads reuses one jsdom per worker while
    // keeping per-file isolation.
    pool: "vmThreads",
    coverage: {
      provider: "v8",
      include: ["js/**/*.js"],
      reporter: ["text", "html"],
      // Thresholds sit just below the measured baseline so the suite cannot
      // silently regress; bump them deliberately when coverage improves.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
