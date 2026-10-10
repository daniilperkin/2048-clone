import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.js"],
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
