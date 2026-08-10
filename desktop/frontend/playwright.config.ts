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
    actionTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "windows-minimum-760x480",
      use: { ...devices["Desktop Chrome"], viewport: { width: 760, height: 480 } },
    },
    {
      name: "windows-compact-1024x640",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 640 } },
    },
    {
      name: "windows-default-1240x720",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1240, height: 720 } },
    },
    {
      name: "windows-large-1440x900",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npx vite --port 34115",
    port: 34115,
    reuseExistingServer: true,
  },
  snapshotPathTemplate: "e2e/snapshots/{testFileName}/{arg}{ext}",
});
