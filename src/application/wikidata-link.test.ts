import { describe, expect, it } from "vitest";

import type { WikidataEntity, WikidataStatement } from "@/domain/wikidata-match";

import { findWikidataMatch, type WikidataSource } from "./wikidata-link";

const item = (id: string): WikidataStatement => ({
  rank: "normal",
  mainsnak: { snaktype: "value", datavalue: { type: "wikibase-entityid", value: { id } } },
});
const code = (value: string): WikidataStatement => ({
  rank: "normal",
  mainsnak: { snaktype: "value", datavalue: { type: "string", value } },
});

const runner = (id: string, label: string, country: string): WikidataEntity => ({
  id,
  labels: { en: { value: label } },
  claims: {
    P31: [item("Q5")],
    P641: [item("Q542")],
    P21: [item("Q6581097")],
    P27: [item(country)],
  },
});

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeWikidata(
  hits: Record<string, string[]>,
  entities: WikidataEntity[],
): WikidataSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async search(name, language, limit) {
      calls.push(`search ${language} ${limit}`);
      return (hits[language] ?? []).slice(0, limit);
    },
    async getEntities(ids) {
      calls.push(`read ${ids.join(",")}`);
      return entities.filter((entity) => ids.includes(entity.id));
    },
  };
}

const HUNGARY: WikidataEntity = { id: "Q28", claims: { P984: [code("HUN")] } };

describe("findWikidataMatch", () => {
  it("links an athlete found by the English then the French search, with its country", async () => {
    // Given one Hungarian sprinter found by both searches
    const wikidata = fakeWikidata({ en: ["Q1"], fr: ["Q1"] }, [
      runner("Q1", "Attila Molnár", "Q28"),
      HUNGARY,
    ]);

    // When we look for our athlete
    const match = await findWikidataMatch({ wikidata }).execute({
      name: "Attila Molnar",
      countryCode: "HUN",
      gender: "M",
    });

    // Then he is linked, after two searches of 10, one read of the item and one of its country
    expect(match).toMatchObject({ status: "linked", id: "Q1" });
    expect(match.candidates.map((c) => c.id)).toEqual(["Q1"]);
    expect(wikidata.calls).toEqual(["search en 10", "search fr 10", "read Q1", "read Q28"]);
  });

  it("gives the admin the two namesakes to choose from", async () => {
    // Given two Hungarian sprinters of the same name, and a footballer
    const wikidata = fakeWikidata({ en: ["Q1", "Q3"], fr: ["Q2"] }, [
      runner("Q1", "Attila Molnár", "Q28"),
      runner("Q2", "Attila Molnár", "Q28"),
      { ...runner("Q3", "Attila Molnár", "Q28"), claims: { P31: [item("Q5")] } },
      HUNGARY,
    ]);

    // When we look for our athlete
    const match = await findWikidataMatch({ wikidata }).execute({
      name: "Attila Molnár",
      countryCode: "HUN",
      gender: "M",
    });

    // Then the admin sees the two sprinters, never the footballer
    expect(match).toMatchObject({ status: "to_review", candidateIds: ["Q1", "Q2"] });
    expect(match.candidates.map((c) => c.id)).toEqual(["Q1", "Q2"]);
  });

  it("asks nothing more when the searches found nothing", async () => {
    const wikidata = fakeWikidata({}, []);
    const match = await findWikidataMatch({ wikidata }).execute({
      name: "Nobody",
      countryCode: "FRA",
      gender: "F",
    });
    expect(match).toEqual({ status: "to_review", candidateIds: [], candidates: [] });
    expect(wikidata.calls).toEqual(["search en 10", "search fr 10"]);
  });
});
