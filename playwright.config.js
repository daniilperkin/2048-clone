import { defineConfig } from "@playwright/test";

/**
 * Browser smoke suite. jsdom cannot catch layout, timing or real-browser
 * API regressions — the 4-second view-transition deadlock proved that — so
 * this suite exercises the served multi-file build in Chromium.
 */
export default defineConfig({
  testDir: "test/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:8090",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx serve . -l 8090",
    url: "http://127.0.0.1:8090",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
