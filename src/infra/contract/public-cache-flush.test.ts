import { describe, expect, it } from "vitest";

import { flushPublicCacheAndWait } from "./public-cache-flush";

const target = "https://preprod.example.test/api/public-cache";
const noWait = async () => {};

/** An app whose probe keeps its old value for `lag` reads after the flush, as on Vercel. */
function app(lag: number, flushStatus = 204) {
  let generation = 0;
  let readsSinceFlush = Number.POSITIVE_INFINITY;
  const calls: string[] = [];
  const fetcher = async (_url: string, init?: RequestInit) => {
    calls.push(init?.method ?? "GET");
    if (init?.method === "POST") {
      readsSinceFlush = 0;
      return new Response(null, { status: flushStatus });
    }
    if (readsSinceFlush++ === lag) generation++;
    return new Response(`generation-${generation}`);
  };
  return { fetcher, calls };
}

describe("flushPublicCacheAndWait", () => {
  it("waits until the probe shows the cache expired, not just for the flush answer", async () => {
    const { fetcher, calls } = app(3);

    const outcome = await flushPublicCacheAndWait(target, {}, fetcher, noWait);

    expect(outcome).toEqual({ kind: "flushed" });
    expect(calls).toEqual(["GET", "POST", "GET", "GET", "GET", "GET"]);
  });

  it("waits until every tag has expired, not just the first one", async () => {
    // One probe per tag, one line each; on Vercel the tags of a flush expire one after another.
    let expired: number | undefined;
    const calls: string[] = [];
    const fetcher = async (_url: string, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      if (init?.method === "POST") {
        expired = 0;
        return new Response(null, { status: 204 });
      }
      const lines = ["competitions", "events", "disciplines", "scale"].map((tag, index) =>
        expired !== undefined && index < expired ? `${tag}-new` : `${tag}-old`,
      );
      if (expired !== undefined) expired++;
      return new Response(lines.join("\n"));
    };

    const outcome = await flushPublicCacheAndWait(target, {}, fetcher, noWait);

    expect(outcome).toEqual({ kind: "flushed" });
    expect(calls).toEqual(["GET", "POST", "GET", "GET", "GET", "GET", "GET"]);
  });

  it("fails when the cache never expires", async () => {
    const { fetcher } = app(Number.POSITIVE_INFINITY);

    const outcome = await flushPublicCacheAndWait(target, {}, fetcher, noWait, 5);

    expect(outcome).toEqual({ kind: "failed", reason: "the cache had not expired after 5 probes" });
  });

  it("fails when the app refuses the flush, as with a secret that is not the app's", async () => {
    const { fetcher } = app(0, 404);

    const outcome = await flushPublicCacheAndWait(target, {}, fetcher, noWait);

    expect(outcome).toEqual({ kind: "failed", reason: "flush: HTTP 404" });
  });

  it("does nothing when the app is not up", async () => {
    const refused = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    };

    expect(await flushPublicCacheAndWait(target, {}, refused, noWait)).toEqual({ kind: "absent" });
  });
});
