import { describe, expect, it } from "vitest";

import { readWikidataAthlete } from "./wikidata-athlete";
import type { WikidataEntity, WikidataSnak, WikidataStatement } from "./wikidata-match";

const ENTITY = "http://www.wikidata.org/entity/";
const POLE_VAULT = "Q185027";
const HIGH_JUMP = "Q165704";
const SHOT_PUT = "Q180935";
const MILE_RUN = "Q1129233";

const itemSnak = (id: string): WikidataSnak => ({
  snaktype: "value",
  datavalue: { type: "wikibase-entityid", value: { id } },
});
const time = (date: string, precision = 11): WikidataSnak => ({
  snaktype: "value",
  datavalue: { type: "time", value: { time: `+${date}T00:00:00Z`, precision } },
});

function mark(
  value: string,
  unit: string,
  discipline: string,
  options: { rank?: WikidataStatement["rank"]; P585?: string; P580?: string; P276?: string } = {},
): WikidataStatement {
  return {
    rank: options.rank ?? "normal",
    mainsnak: {
      snaktype: "value",
      datavalue: { type: "quantity", value: { amount: value, unit: `${ENTITY}${unit}` } },
    },
    qualifiers: {
      P2416: [itemSnak(discipline)],
      ...(options.P585 ? { P585: [time(options.P585)] } : {}),
      ...(options.P580 ? { P580: [time(options.P580)] } : {}),
      ...(options.P276 ? { P276: [itemSnak(options.P276)] } : {}),
    },
  };
}

const METRE = "Q11573";

describe("readWikidataAthlete", () => {
  it("keeps the best mark of a record progression (Duplantis)", () => {
    const duplantis: WikidataEntity = {
      id: "Q20740797",
      claims: {
        P2415: [
          mark("+6.20", METRE, POLE_VAULT, { P580: "2022-03-20", P276: "Q1" }),
          mark("+6.25", METRE, POLE_VAULT, { P580: "2024-08-05", P276: "Q2" }),
          mark("+6.21", METRE, POLE_VAULT, { P580: "2022-07-24", P276: "Q3" }),
        ],
      },
    };
    expect(readWikidataAthlete(duplantis).personalBests).toEqual([
      { discipline: "Saut à la perche", mark: 6.25, date: "2024-08-05", venueId: "Q2" },
    ]);
  });

  it("takes the preferred statement when there is one", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: {
        P2415: [
          mark("+6.30", METRE, POLE_VAULT, { rank: "preferred" }),
          mark("+6.31", METRE, POLE_VAULT),
          mark("+6.40", METRE, POLE_VAULT, { rank: "deprecated" }),
        ],
      },
    };
    expect(readWikidataAthlete(entity).personalBests.map((b) => b.mark)).toEqual([6.3]);
  });

  it("keeps a mark without a date", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: { P2415: [mark("+2.04", METRE, HIGH_JUMP)] },
    };
    expect(readWikidataAthlete(entity).personalBests).toEqual([
      { discipline: "Saut en hauteur", mark: 2.04, date: null, venueId: null },
    ]);
  });

  it("prefers the point in time over the start time", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: {
        P2415: [mark("+2.04", METRE, HIGH_JUMP, { P585: "2025-06-01", P580: "2024-01-01" })],
      },
    };
    expect(readWikidataAthlete(entity).personalBests[0].date).toBe("2025-06-01");
  });

  it("keeps the lowest time of a race, and brings minutes and centimetres to our units", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: {
        P2415: [
          mark("+9.95", "Q11574", "Q164761"),
          mark("+9.86", "Q11574", "Q164761"),
          mark("+3.5", "Q7727", "Q191691"),
          mark("+2236", "Q174728", SHOT_PUT),
          mark("+8125", "Q3393320", "Q184654"),
        ],
      },
    };
    expect(readWikidataAthlete(entity).personalBests.map((b) => [b.discipline, b.mark])).toEqual([
      ["100 m", 9.86],
      ["1500 m", 210],
      ["Lancer du poids", 22.36],
      ["Décathlon", 8125],
    ]);
  });

  it("skips a discipline we do not have and a unit that does not fit", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: {
        P2415: [mark("+3.43", "Q7727", MILE_RUN), mark("+9.86", METRE, "Q164761")],
      },
    };
    expect(readWikidataAthlete(entity).personalBests).toEqual([]);
  });

  it("reads the birth date, the French article first and the known disciplines", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: {
        P569: [{ rank: "normal", mainsnak: time("1999-11-10") }],
        P2416: [
          { rank: "normal", mainsnak: itemSnak(POLE_VAULT) },
          { rank: "normal", mainsnak: itemSnak(MILE_RUN) },
        ],
      },
      sitelinks: { enwiki: { title: "Some One" }, frwiki: { title: "Some One (athlète)" } },
    };
    expect(readWikidataAthlete(entity)).toEqual({
      id: "Q1",
      birthDate: "1999-11-10",
      wikipediaUrl: "https://fr.wikipedia.org/wiki/Some_One_(athl%C3%A8te)",
      disciplines: ["Saut à la perche"],
      personalBests: [],
    });
  });

  it("falls back on the English article, and gives no day for a birth year only", () => {
    const entity: WikidataEntity = {
      id: "Q1",
      claims: { P569: [{ rank: "normal", mainsnak: time("1999-00-00", 9) }] },
      sitelinks: { enwiki: { title: "Some One" } },
    };
    const read = readWikidataAthlete(entity);
    expect(read.birthDate).toBeNull();
    expect(read.wikipediaUrl).toBe("https://en.wikipedia.org/wiki/Some_One");
  });

  it("reads nothing from an empty item", () => {
    expect(readWikidataAthlete({ id: "Q1" })).toEqual({
      id: "Q1",
      birthDate: null,
      wikipediaUrl: null,
      disciplines: [],
      personalBests: [],
    });
  });
});
