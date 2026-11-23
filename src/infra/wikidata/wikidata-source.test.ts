import { describe, expect, it } from "vitest";

import { WIKIDATA_USER_AGENT, createWikidataSource } from "./wikidata-source";

type Call = { url: URL; headers: Record<string, string>; at: number };

/** A Wikidata that answers from a list, on a clock that only moves when the adapter sleeps. */
function fakeWikidata(answers: (() => Response)[]) {
  let clock = 0;
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const http = {
    now: () => clock,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    },
    fetch: (async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: new URL(String(input)),
        headers: init?.headers as Record<string, string>,
        at: clock,
      });
      const next = answers.shift();
      if (!next) throw new Error("no answer left");
      return next();
    }) as typeof fetch,
  };
  return { http, calls, sleeps };
}

const json =
  (body: unknown, init: ResponseInit = {}) =>
  () =>
    new Response(JSON.stringify(body), { status: 200, ...init });
const lagged = json(
  { error: { code: "maxlag", info: "Waiting for a server: 7 seconds lagged." } },
  { headers: { "Retry-After": "7" } },
);

describe("Wikidata adapter", () => {
  it("names the project and its repository, and asks with maxlag=5", async () => {
    const { http, calls } = fakeWikidata([json({ search: [{ id: "Q1" }, { id: "Q2" }] })]);
    const ids = await createWikidataSource(http).search("Femke Bol", "fr", 10);
    expect(ids).toEqual(["Q1", "Q2"]);
    expect(calls[0].headers["User-Agent"]).toBe(WIKIDATA_USER_AGENT);
    expect(WIKIDATA_USER_AGENT).toContain("https://github.com/pwilfried/french-track-prono");
    const params = Object.fromEntries(calls[0].url.searchParams);
    expect(params).toMatchObject({
      action: "wbsearchentities",
      search: "Femke Bol",
      language: "fr",
      limit: "10",
      maxlag: "5",
      format: "json",
    });
  });

  it("sends the requests one after the other, a second apart at least", async () => {
    const { http, calls } = fakeWikidata([json({ search: [] }), json({ search: [] })]);
    const source = createWikidataSource(http);
    await Promise.all([source.search("A", "en", 10), source.search("A", "fr", 10)]);
    expect(calls.map((c) => c.at)).toEqual([0, 1000]);
  });

  it("waits what Wikidata asks and tries again when its servers lag", async () => {
    const { http, calls, sleeps } = fakeWikidata([lagged, json({ search: [{ id: "Q9" }] })]);
    expect(await createWikidataSource(http).search("A", "en", 10)).toEqual(["Q9"]);
    expect(calls).toHaveLength(2);
    expect(sleeps).toContain(7000);
  });

  it("gives up with WIKIDATA_UNAVAILABLE when the lag lasts", async () => {
    const { http } = fakeWikidata(Array.from({ length: 6 }, () => lagged));
    await expect(createWikidataSource(http).search("A", "en", 10)).rejects.toMatchObject({
      code: "WIKIDATA_UNAVAILABLE",
    });
  });

  it("throws WIKIDATA_UNAVAILABLE on a network error or an error answer", async () => {
    const down = fakeWikidata([
      () => {
        throw new TypeError("fetch failed");
      },
    ]);
    await expect(createWikidataSource(down.http).search("A", "en", 10)).rejects.toMatchObject({
      code: "WIKIDATA_UNAVAILABLE",
    });
    const broken = fakeWikidata([json({}, { status: 500 })]);
    await expect(createWikidataSource(broken.http).getEntities(["Q1"])).rejects.toMatchObject({
      code: "WIKIDATA_UNAVAILABLE",
    });
  });

  it("reads the items by batches of 50 and leaves the missing ones out", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `Q${i + 1}`);
    const entities = (batch: string[]) =>
      Object.fromEntries(
        batch.map((id) => [id, id === "Q2" ? { id, missing: "" } : { id, claims: {} }]),
      );
    const { http, calls } = fakeWikidata([
      json({ entities: entities(ids.slice(0, 50)) }),
      json({ entities: entities(ids.slice(50)) }),
    ]);
    const read = await createWikidataSource(http).getEntities(ids);
    expect(calls.map((c) => c.url.searchParams.get("ids")?.split("|").length)).toEqual([50, 1]);
    expect(calls[0].url.searchParams.get("languages")).toBe("en|fr|mul");
    expect(read.map((e) => e.id)).toEqual(ids.filter((id) => id !== "Q2"));
  });

  it("reads a batch again without an id Wikidata does not know", async () => {
    const { http, calls } = fakeWikidata([
      json({ error: { code: "no-such-entity", id: "Q999999999999" } }),
      json({ entities: { Q34: { id: "Q34", claims: {} } } }),
    ]);
    const read = await createWikidataSource(http).getEntities(["Q999999999999", "Q34"]);
    expect(calls.map((c) => c.url.searchParams.get("ids"))).toEqual(["Q999999999999|Q34", "Q34"]);
    expect(read.map((e) => e.id)).toEqual(["Q34"]);
  });
});
