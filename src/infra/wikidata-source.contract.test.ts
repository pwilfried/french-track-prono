import { describe, it } from "vitest";

import { DUPLANTIS, SWEDEN, wikidataSourceContract } from "./contract/wikidata-source.contract";
import { createInMemoryWikidataSource, createWikidataSource } from "./index";
import { WIKIDATA_API, WIKIDATA_MAXLAG, WIKIDATA_USER_AGENT } from "./wikidata/wikidata-source";
import type { WikidataStatement } from "@/domain/wikidata-match";

const item = (id: string): WikidataStatement => ({
  rank: "normal",
  mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id } } },
});

wikidataSourceContract("in-memory fake", () =>
  createInMemoryWikidataSource([
    {
      id: DUPLANTIS,
      labels: { en: { value: "Armand Duplantis" }, fr: { value: "Armand Duplantis" } },
      aliases: { en: [{ value: "Mondo Duplantis" }] },
      claims: {
        P31: [item("Q5")],
        P641: [item("Q542")],
        P21: [item("Q6581097")],
        P1532: [item(SWEDEN)],
        P27: [item(SWEDEN), item("Q30")],
        P2416: [item("Q185027")],
        P569: [
          {
            rank: "normal",
            mainsnak: {
              snaktype: "value",
              datavalue: { type: "time", value: { time: "+1999-11-10T00:00:00Z", precision: 11 } },
            },
          },
        ],
      },
      sitelinks: { frwiki: { title: "Armand Duplantis" }, enwiki: { title: "Armand Duplantis" } },
    },
    {
      id: SWEDEN,
      labels: { en: { value: "Sweden" } },
      claims: {
        P984: [
          {
            rank: "normal",
            mainsnak: { snaktype: "value", datavalue: { type: "string", value: "SWE" } },
          },
        ],
      },
    },
  ]),
);

// The real adapter runs only when Wikidata answers without lag: skipped without network, and
// when its servers lag (the adapter would wait, and the test would time out).
async function wikidataState(): Promise<"ready" | "offline" | "lagged"> {
  try {
    const response = await fetch(
      `${WIKIDATA_API}?action=query&meta=siteinfo&format=json&maxlag=${WIKIDATA_MAXLAG}`,
      { headers: { "User-Agent": WIKIDATA_USER_AGENT }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return response.status === 503 ? "lagged" : "offline";
    const answer = (await response.json()) as { error?: { code?: string } };
    return answer.error?.code === "maxlag" ? "lagged" : "ready";
  } catch {
    return "offline";
  }
}

const state = await wikidataState();
if (state === "ready") {
  wikidataSourceContract("Wikidata", () => createWikidataSource());
} else {
  describe("Wikidata source", () => {
    const why = state === "lagged" ? "Wikidata's servers lag" : "Wikidata does not answer";
    it.skip(`is skipped: ${why}`, () => {});
  });
}
