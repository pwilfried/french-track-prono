import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the Next.js build against a local Supabase (see docs/SETUP.md).
 * No retry: a failing test is fixed or removed, never run again until it passes.
 */
export default defineConfig({
  testDir: "e2e",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the sign-in link of the local Supabase points to localhost.
    baseURL: "http://localhost:3000",
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
