// Expires the app's cache of public data after a change made in SQL by the end-to-end tests (#693),
// and waits until the expiry has landed (#814). On Vercel, a Route Handler answers before its
// `revalidateTag` runs (Next.js hands it to `waitUntil`), so the page loaded right after the flush
// could still read the old list: in pre-production, a competition made by a test was missing from
// the league form. The app exposes one probe per public tag, a line each (`tag=value`): once every
// line has changed, every tag has expired. Each tag expires on its own (#840): waiting for the
// first one only let « events » expire later and drop a list cached in between. No import, no
// syntax beyond erasable types: Node runs this file as it is, in the child process that keeps
// `sql()` synchronous (src/infra/contract/database.ts).

export type FlushOutcome =
  { kind: "flushed" } | { kind: "absent" } | { kind: "failed"; reason: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export async function flushPublicCacheAndWait(
  target: string,
  headers: Record<string, string>,
  fetcher: Fetcher = fetch,
  wait: (ms: number) => Promise<unknown> = (ms) => new Promise((done) => setTimeout(done, ms)),
  attempts = 40,
): Promise<FlushOutcome> {
  const probe = async () => {
    const response = await fetcher(target, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`probe: HTTP ${response.status}`);
    return response.text();
  };
  let before: string;
  try {
    before = await probe();
  } catch (error) {
    // The app is not up (a Vitest contract test, a set-up before the server): nothing is cached.
    if (isUnreachable(error)) return { kind: "absent" };
    return { kind: "failed", reason: String(error) };
  }
  try {
    const flush = await fetcher(target, { method: "POST", headers });
    if (flush.status !== 204) return { kind: "failed", reason: `flush: HTTP ${flush.status}` };
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (allChanged(before, await probe())) return { kind: "flushed" };
      await wait(250);
    }
    return { kind: "failed", reason: `the cache had not expired after ${attempts} probes` };
  } catch (error) {
    return { kind: "failed", reason: String(error) };
  }
}

/** Every line of the probe differs from the one read before the flush. */
function allChanged(before: string, now: string): boolean {
  const old = before.split("\n");
  return now.split("\n").every((line, n) => line !== old[n]);
}

function isUnreachable(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } } | null)?.cause;
  return cause?.code === "ECONNREFUSED";
}
