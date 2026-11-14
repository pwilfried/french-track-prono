import { type FullConfig, request } from "@playwright/test";

import { vercelBypassHeaders } from "../src/infra/contract/database";

/**
 * Global set-up of the runs against pre-production behind Vercel Authentication (#692): one
 * request with VERCEL_AUTOMATION_BYPASS_SECRET makes Vercel set its bypass cookie, saved to the
 * storageState file of playwright.config.ts, so every context of the run (browser.newContext()
 * included) starts with it. The secret goes to the pre-production site only, never as a header of
 * the browser's requests to Supabase. Does nothing without the secret (local runs, CI of the PRs).
 */
export default async function saveVercelBypassCookie(config: FullConfig): Promise<void> {
  const headers = vercelBypassHeaders();
  const { baseURL, storageState } = config.projects[0]?.use ?? {};
  if (!Object.keys(headers).length || !baseURL || typeof storageState !== "string") return;
  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: { ...headers, "x-vercel-set-bypass-cookie": "true" },
  });
  try {
    const response = await context.get("/", { maxRedirects: 0 });
    const { cookies } = await context.storageState({ path: storageState });
    if (cookies.length) return;
    // No cookie while the site answers: Vercel Authentication is not on yet, the run goes on.
    if (response.ok()) {
      console.warn(`Vercel set no bypass cookie on ${baseURL}: is Vercel Authentication off?`);
      return;
    }
    throw new Error(
      `Vercel set no bypass cookie on ${baseURL} (HTTP ${response.status()}): check VERCEL_AUTOMATION_BYPASS_SECRET`,
    );
  } finally {
    await context.dispose();
  }
}
