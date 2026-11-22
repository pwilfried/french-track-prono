import { describe, expect, it } from "vitest";

import { viewList } from "./list-view";
import {
  inCatalogueFilter,
  matchesCatalogueSearch,
  catalogueDisciplines,
  compareCatalogue,
  missesCatalogueForMainDiscipline,
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

const none: CatalogueFilter = {
  sex: null,
  family: null,
  discipline: null,
  availableOnly: false,
  maxPrice: null,
  onlyIds: null,
};

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

  it("filters by Manager family: hurdlers are sprinters", () => {
    expect(names("", { ...none, family: "sprint" })).toEqual(["Élodie Sprint", "Marc Haies"]);
  });
});

describe("the catalogue sort and the new filters (#1087)", () => {
  const priced = [
    athlete("Bea", { price: 20 }),
    athlete("Ada", { price: 20, discipline: "200 m" }),
    athlete("Cléo", { price: 35 }),
    athlete("Dan", { price: 5, sex: "M", family: "throws", discipline: "Disque" }),
  ];
  const order = (sort: Parameters<typeof compareCatalogue>[0]) =>
    [...priced].sort(compareCatalogue(sort)).map((a) => a.name);

  it("sorts by price, dearest first, equal prices by name", () => {
    expect(order("price_desc")).toEqual(["Cléo", "Ada", "Bea", "Dan"]);
  });

  it("sorts by price, cheapest first, or by name", () => {
    expect(order("price_asc")).toEqual(["Dan", "Ada", "Bea", "Cléo"]);
    expect(order("name")).toEqual(["Ada", "Bea", "Cléo", "Dan"]);
  });

  it("keeps the athletes within the budget, at the price itself included", () => {
    const within = priced.filter((a) => inCatalogueFilter(a, { ...none, maxPrice: 20 }));
    expect(within.map((a) => a.name)).toEqual(["Bea", "Ada", "Dan"]);
  });

  it("keeps the athletes of one discipline", () => {
    const f = { ...none, family: "sprint" as const, discipline: "200 m" };
    expect(priced.filter((a) => inCatalogueFilter(a, f)).map((a) => a.name)).toEqual(["Ada"]);
  });

  it("keeps only the athletes of the player's bids", () => {
    const f = { ...none, onlyIds: new Set(["Cléo", "Dan"]) };
    expect(priced.filter((a) => inCatalogueFilter(a, f)).map((a) => a.name)).toEqual([
      "Cléo",
      "Dan",
    ]);
  });

  it("lists the disciplines of a family once each", () => {
    expect(catalogueDisciplines(priced, "sprint")).toEqual(["100 m", "200 m"]);
    expect(catalogueDisciplines(priced, "jumps")).toEqual([]);
  });
});

describe("missesCatalogueForMainDiscipline", () => {
  it("flags an athlete with a price but no main discipline", () => {
    expect(missesCatalogueForMainDiscipline({ managerPrice: 12, mainDiscipline: null })).toBe(true);
  });

  it("does not flag an athlete with a price and a main discipline", () => {
    expect(missesCatalogueForMainDiscipline({ managerPrice: 12, mainDiscipline: "100 m" })).toBe(
      false,
    );
  });

  it("does not flag an athlete without a price, kept out of the catalogue on purpose", () => {
    expect(missesCatalogueForMainDiscipline({ managerPrice: null, mainDiscipline: null })).toBe(
      false,
    );
  });
});
