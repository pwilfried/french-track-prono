import { afterEach, describe, expect, it, vi } from "vitest";

import { limitedFetch } from "./limited-fetch";

/** A fetch whose answers the test releases one by one. */
function controlledFetch() {
  const pending: (() => void)[] = [];
  let inFlight = 0;
  let peak = 0;
  const base = (async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise<void>((resolve) => pending.push(resolve));
    inFlight--;
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  return { base, pending, peak: () => peak };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("limitedFetch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps at most the given number of requests in flight and serves them all", async () => {
    const { base, pending, peak } = controlledFetch();
    const limited = limitedFetch(2, base);

    const all = Promise.all(Array.from({ length: 5 }, () => limited("http://db.test/rest/v1/x")));
    for (let served = 0; served < 5; served++) {
      await tick();
      pending.shift()?.();
    }

    expect((await all).map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(peak()).toBe(2);
  });

  it("logs a server error with its path but not its query", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const limited = limitedFetch(2, (async () => new Response("", { status: 504 })) as typeof fetch);

    const response = await limited("http://db.test/rest/v1/predictions?user_id=eq.secret");

    expect(response.status).toBe(504);
    expect(log).toHaveBeenCalledWith("supabase request failed: 504 /rest/v1/predictions");
  });

  it("logs a request that throws, lets the error through and frees its place", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const limited = limitedFetch(1, (async () => {
      calls++;
      if (calls === 1) throw new Error("fetch failed");
      return new Response("[]", { status: 200 });
    }) as typeof fetch);

    await expect(limited("http://db.test/rest/v1/events")).rejects.toThrow("fetch failed");
    expect((await limited("http://db.test/rest/v1/events")).status).toBe(200);
    expect(log).toHaveBeenCalledWith("supabase request failed: fetch failed /rest/v1/events");
  });
});
