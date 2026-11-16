/**
 * Requests one Supabase client sends at the same time. A page that adds up the whole season
 * (`/profil`) asks one query per competition and per read: hundreds at once, which the API's
 * connection pool could not serve, so some reads failed and their blocks vanished (#763).
 */
export const MAX_PARALLEL_REQUESTS = 8;

/** Pause before the one retry of a read whose `fetch` threw ("fetch failed", #1020). */
export const RETRY_DELAY_MS = 200;

/** Reads are safe to send twice; writes (POST, PATCH, DELETE, RPC calls) never are. */
const RETRIED_METHODS = new Set(["GET", "HEAD"]);

/**
 * A fetch that keeps at most `max` requests in flight and queues the others in order. A request
 * that fails (thrown, or a 5xx answer) is logged with its status and path, never its query
 * (it carries ids), so the server log tells why a read was unavailable. A read whose `fetch`
 * throws (a network error, not an HTTP answer) is sent once more after `retryDelayMs`, keeping
 * its place among the `max`.
 */
export function limitedFetch(
  max = MAX_PARALLEL_REQUESTS,
  base: typeof fetch = fetch,
  retryDelayMs = RETRY_DELAY_MS,
): typeof fetch {
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
      const response = await sendWithRetry(input, init);
      if (response.status >= 500) console.error(`supabase request failed: ${response.status} ${pathOf(input)}`);
      return response;
    } finally {
      release();
    }
  };

  async function sendWithRetry(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
    try {
      return await base(input, init);
    } catch (error) {
      if (!isRetried(input, init, error)) {
        console.error(`supabase request failed: ${messageOf(error)} ${pathOf(input)}`);
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    try {
      const response = await base(input, init);
      console.error(`supabase request retried: ok ${pathOf(input)}`);
      return response;
    } catch (error) {
      console.error(`supabase request retried: ${messageOf(error)} ${pathOf(input)}`);
      throw error;
    }
  }
}

function isRetried(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1], error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return false;
  if (init?.signal?.aborted) return false;
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  return RETRIED_METHODS.has(method.toUpperCase());
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "error";
}

function pathOf(input: Parameters<typeof fetch>[0]): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url).pathname;
  } catch {
    return "?";
  }
}
