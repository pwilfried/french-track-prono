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

  it("retries a read once after a network failure and logs that the retry worked", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, calls } = failingFetch(1);
    const limited = limitedFetch(1, base, 0);

    const response = await limited("http://db.test/rest/v1/events?id=eq.secret");

    expect(response.status).toBe(200);
    expect(calls()).toBe(2);
    expect(log).toHaveBeenCalledWith("supabase request retried: ok /rest/v1/events");
  });

  it("gives up after two network failures, lets the error through and frees its place", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, calls } = failingFetch(2);
    const limited = limitedFetch(1, base, 0);

    await expect(limited("http://db.test/rest/v1/events?id=eq.secret", { method: "HEAD" })).rejects.toThrow(
      "fetch failed",
    );
    expect(calls()).toBe(2);
    expect(log).toHaveBeenCalledWith("supabase request retried: fetch failed /rest/v1/events");
    expect((await limited("http://db.test/rest/v1/events")).status).toBe(200);
  });

  it.each(["POST", "PATCH", "DELETE"])("never retries a %s write", async (method) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, calls } = failingFetch(1);
    const limited = limitedFetch(1, base, 0);

    await expect(limited("http://db.test/rest/v1/rpc/save", { method })).rejects.toThrow("fetch failed");
    expect(calls()).toBe(1);
    expect(log).toHaveBeenCalledWith("supabase request failed: fetch failed /rest/v1/rpc/save");
  });

  it("never retries a write given as a Request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, calls } = failingFetch(1);
    const limited = limitedFetch(1, base, 0);

    await expect(limited(new Request("http://db.test/rest/v1/predictions", { method: "POST" }))).rejects.toThrow();
    expect(calls()).toBe(1);
  });

  it("never retries a received HTTP answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const limited = limitedFetch(1, (async () => (calls++, new Response("", { status: 503 }))) as typeof fetch, 0);

    expect((await limited("http://db.test/rest/v1/events")).status).toBe(503);
    expect(calls).toBe(1);
  });

  it("keeps the request's place in the queue while it retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: string[] = [];
    const limited = limitedFetch(1, (async (input: string) => {
      calls.push(new URL(input).pathname);
      await tick();
      if (calls.length === 1) throw new TypeError("fetch failed");
      return new Response("[]", { status: 200 });
    }) as typeof fetch, 5);

    const statuses = await Promise.all([limited("http://db.test/rest/v1/a"), limited("http://db.test/rest/v1/b")]);

    expect(statuses.map((r) => r.status)).toEqual([200, 200]);
    expect(calls).toEqual(["/rest/v1/a", "/rest/v1/a", "/rest/v1/b"]);
  });
});

/** A fetch that throws a network error the first `failures` times, then answers 200. */
function failingFetch(failures: number) {
  let calls = 0;
  const base = (async () => {
    calls++;
    if (calls <= failures) throw new TypeError("fetch failed");
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  return { base, calls: () => calls };
}
