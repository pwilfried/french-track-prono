/**
 * Requests one Supabase client sends at the same time. A page that adds up the whole season
 * (`/profil`) asks one query per competition and per read: hundreds at once, which the API's
 * connection pool could not serve, so some reads failed and their blocks vanished (#763).
 */
export const MAX_PARALLEL_REQUESTS = 8;

/**
 * A fetch that keeps at most `max` requests in flight and queues the others in order. A request
 * that fails (thrown, or a 5xx answer) is logged with its status and path, never its query
 * (it carries ids), so the server log tells why a read was unavailable.
 */
export function limitedFetch(max = MAX_PARALLEL_REQUESTS, base: typeof fetch = fetch): typeof fetch {
  let running = 0;
  const waiting: (() => void)[] = [];
  const acquire = () =>
    running < max
      ? (running++, Promise.resolve())
      : new Promise<void>((resolve) => waiting.push(resolve));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
  return async (input, init) => {
    await acquire();
    try {
      const response = await base(input, init);
      if (response.status >= 500) console.error(`supabase request failed: ${response.status} ${pathOf(input)}`);
      return response;
    } catch (error) {
      console.error(`supabase request failed: ${error instanceof Error ? error.message : "error"} ${pathOf(input)}`);
      throw error;
    } finally {
      release();
    }
  };
}

function pathOf(input: Parameters<typeof fetch>[0]): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url).pathname;
  } catch {
    return "?";
  }
}
