import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the Next.js build against a local Supabase (see docs/SETUP.md), or a deployed
 * site when E2E_BASE_URL is set (pre-production, after each deploy and every morning: #695, #636):
 * no local server then, and SQL and sign-in codes go through the pre-production APIs (onPreprod).
 * The global teardown deletes what the run made (e2e/teardown.ts).
 * No retry: a failing test is fixed or removed, never run again until it passes.
 */
const deployed = process.env.E2E_BASE_URL;
const baseURL = deployed ?? "http://localhost:3000";
/**
 * Lets the tests expire the app's cache of public data after a change made in SQL (#693): the
 * server started below gets the same secret (see src/infra/contract/database.ts). In
 * pre-production, the secret is the one of the Vercel project, given by the workflow.
 */
if (deployed) process.env.PUBLIC_CACHE_FLUSH_URL ??= baseURL;
else process.env.PUBLIC_CACHE_FLUSH_SECRET ??= "e2e-public-cache";

/**
 * The app under test plays pre-production for the demo sign-in (#637, e2e/demo-login.spec.ts);
 * the switch is off in production, which a unit test covers (src/app/demo-login.test.ts).
 */
process.env.PREPROD_DEMO_LOGIN ??= "1";

/**
 * Pre-production behind Vercel Authentication (#692): with VERCEL_AUTOMATION_BYPASS_SECRET, the
 * global set-up saves Vercel's bypass cookie here and every context starts with it
 * (e2e/vercel-bypass.ts). Without the secret, nothing changes.
 */
const bypassState = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? join(tmpdir(), "french-track-e2e-vercel-bypass.json")
  : undefined;

export default defineConfig({
  testDir: "e2e",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  // Against pre-production: Vercel's bypass cookie, the hourly e-mail cap raised
  // (e2e/preprod-auth.ts), then the events opened (e2e/preprod-events.ts).
  globalSetup: ["./e2e/vercel-bypass.ts", "./e2e/preprod-auth.ts", "./e2e/preprod-events.ts"],
  globalTeardown: "./e2e/teardown.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the sign-in link of the local Supabase points to localhost.
    baseURL,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    storageState: bypassState,
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
