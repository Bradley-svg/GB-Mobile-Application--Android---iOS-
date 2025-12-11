import { defineConfig } from "@playwright/test";

const baseURL = process.env.WEB_E2E_BASE_URL || process.env.WEB_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  workers: 1,
  retries: 1,
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
});
