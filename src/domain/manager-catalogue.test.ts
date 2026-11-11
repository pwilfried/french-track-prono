import { describe, expect, it } from "vitest";

import { viewList } from "./list-view";
import {
  inCatalogueFilter,
  matchesCatalogueSearch,
  type CatalogueAthlete,
  type CatalogueFilter,
} from "./manager-catalogue";

const athlete = (name: string, change: Partial<CatalogueAthlete> = {}): CatalogueAthlete => ({
  athleteId: name,
  slug: name,
  name,
  countryCode: "FRA",
  sex: "F",
  discipline: "100 m",
  family: "sprint",
  pb: "11.01",
  sb: "11.20",
  price: 10,
  available: true,
  ...change,
});

const catalogue = [
  athlete("Zoé Lancer", { family: "throws", discipline: "Lancer du poids", countryCode: "BEL" }),
  athlete("Élodie Sprint"),
  athlete("Marc Haies", {
    sex: "M",
    family: "hurdles",
    discipline: "110 m haies",
    available: false,
  }),
];

const names = (query: string, filter: CatalogueFilter) =>
  viewList(catalogue, {
    query,
    matches: matchesCatalogueSearch,
    filter: (a) => inCatalogueFilter(a, filter),
    pageSize: 50,
  }).rows.map((a) => a.name);

const none: CatalogueFilter = { sex: null, family: null, availableOnly: false };

describe("the mercato catalogue", () => {
  it("finds an athlete by name without accents, by country or by discipline", () => {
    expect(names("elodie", none)).toEqual(["Élodie Sprint"]);
    expect(names("bel", none)).toEqual(["Zoé Lancer"]);
    expect(names("haies", none)).toEqual(["Marc Haies"]);
  });

  it("filters by sex, family and availability", () => {
    expect(names("", { ...none, sex: "M" })).toEqual(["Marc Haies"]);
    expect(names("", { ...none, family: "throws" })).toEqual(["Zoé Lancer"]);
    expect(names("", { ...none, availableOnly: true })).toEqual(["Zoé Lancer", "Élodie Sprint"]);
  });
});
