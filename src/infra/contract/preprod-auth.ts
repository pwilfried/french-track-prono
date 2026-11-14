// Pre-production only (#787): each e2e pass signs up about sixty players, and every one of them
// gets a real sign-in e-mail from the app. Supabase caps those e-mails per hour (30 by default with
// a custom SMTP); a deploy run followed by another within the hour hit the cap, and every sign-up
// then failed with AUTH_UNAVAILABLE until the hour was over. The e2e set-up raises the cap first.

/** Room for a few passes an hour (deploys plus the daily run), each signing up ~60 players. */
export const PREPROD_EMAIL_RATE_LIMIT = 500;

export type RateLimitOutcome =
  | { kind: "skipped" }
  | { kind: "kept"; current: number }
  | { kind: "raised"; from: number | null; to: number }
  | { kind: "failed"; reason: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Raises the hourly e-mail limit of the pre-production Auth (Supabase Management API) when it is
 * lower than PREPROD_EMAIL_RATE_LIMIT. Only when the run targets pre-production and the project is
 * the pre-production one (PREPROD_PROJECT_REF, set by the workflows): never production.
 */
export async function raisePreprodEmailRateLimit(
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch,
): Promise<RateLimitOutcome> {
  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!env.E2E_BASE_URL || !ref || !token || ref !== env.PREPROD_PROJECT_REF) {
    return { kind: "skipped" };
  }
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  try {
    const read = await fetcher(url, { headers });
    if (!read.ok) return { kind: "failed", reason: `read: HTTP ${read.status}` };
    const value = ((await read.json()) as { rate_limit_email_sent?: unknown })
      .rate_limit_email_sent;
    const current = typeof value === "number" ? value : null;
    if (current !== null && current >= PREPROD_EMAIL_RATE_LIMIT) return { kind: "kept", current };
    const write = await fetcher(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ rate_limit_email_sent: PREPROD_EMAIL_RATE_LIMIT }),
    });
    if (!write.ok) {
      return { kind: "failed", reason: `HTTP ${write.status} ${await write.text()}` };
    }
    return { kind: "raised", from: current, to: PREPROD_EMAIL_RATE_LIMIT };
  } catch (error) {
    return { kind: "failed", reason: String(error) };
  }
}
