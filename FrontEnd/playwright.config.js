import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30000,
  reporter: "list",
  outputDir: ".admin-audit.local/test-results",
  use: { baseURL: process.env.ADMIN_TEST_URL || "http://127.0.0.1:4179", channel: process.env.ADMIN_TEST_CHANNEL || "chrome", headless: true, viewport: { width: 1440, height: 1000 }, serviceWorkers: "block", actionTimeout: 8000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "node scripts/admin-audit-server.mjs dist 4179", url: "http://127.0.0.1:4179", reuseExistingServer: !process.env.CI },
});
