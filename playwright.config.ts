import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the Next.js build against a local Supabase (see docs/SETUP.md).
 * No retry: a failing test is fixed or removed, never run again until it passes.
 */
/**
 * Lets the tests expire the app's cache of public data after a change made in SQL (#693): the
 * server started below gets the same secret (see src/infra/contract/database.ts).
 */
process.env.PUBLIC_CACHE_FLUSH_SECRET ??= "e2e-public-cache";

/**
 * E2E_BASE_URL: a deployed site to test (pre-production, #636), instead of the local build started
 * below. Signing in and SQL there need the helpers of #695.
 */
const deployed = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the sign-in link of the local Supabase points to localhost.
    baseURL: deployed ?? "http://localhost:3000",
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: deployed
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
