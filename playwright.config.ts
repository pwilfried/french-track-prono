import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the Next.js build against a local Supabase (see docs/SETUP.md), or the
 * pre-production site after each of its deploys (E2E_TARGET=preprod and E2E_BASE_URL, #695): no
 * local server then. The global teardown deletes what the run made (e2e/teardown.ts).
 * No retry: a failing test is fixed or removed, never run again until it passes.
 */
const preprod = process.env.E2E_TARGET === "preprod";
if (preprod && !process.env.E2E_BASE_URL)
  throw new Error("E2E_BASE_URL is needed in pre-production");
const baseURL = preprod ? process.env.E2E_BASE_URL! : "http://localhost:3000";
/**
 * Lets the tests expire the app's cache of public data after a change made in SQL (#693): the
 * server started below gets the same secret (see src/infra/contract/database.ts). In
 * pre-production, the secret is the one of the Vercel project, given by preprod.yml.
 */
if (preprod) process.env.PUBLIC_CACHE_FLUSH_URL ??= baseURL;
else process.env.PUBLIC_CACHE_FLUSH_SECRET ??= "e2e-public-cache";

export default defineConfig({
  testDir: "e2e",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  globalTeardown: "./e2e/teardown.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the sign-in link of the local Supabase points to localhost.
    baseURL,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  webServer: preprod
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
