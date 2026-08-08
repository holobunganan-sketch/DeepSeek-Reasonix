import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e-report" }]],
  snapshotDir: "./e2e/snapshots",
  use: {
    baseURL: "http://localhost:34115",
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npx vite --port 34115",
    port: 34115,
    reuseExistingServer: true,
  },
  snapshotPathTemplate: "e2e/snapshots/{testFileName}/{arg}{ext}",
});
