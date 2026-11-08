import { describe, expect, it } from "vitest";

import { isValidStartList, MAX_START_LIST, searchAthletes, sortByDiscipline } from "./start-list";

const athletes = [
  { id: "1", name: "Julien Alfred" },
  { id: "2", name: "Marie-Josée Ta Lou-Smith" },
  { id: "3", name: "Sha'Carri Richardson" },
  { id: "4", name: "Gina Mariam Bass Bittaye" },
  { id: "5", name: "Brittany Broderick" },
];

describe("searchAthletes", () => {
  it("keeps the whole list, in order, without a query", () => {
    expect(searchAthletes(athletes, "  ").map((a) => a.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("puts a name that starts with the query first: ric finds Richardson first", () => {
    expect(searchAthletes(athletes, "ric").map((a) => a.id)).toEqual(["3", "5"]);
  });

  it("ignores accents and case", () => {
    expect(searchAthletes(athletes, "JOSEE").map((a) => a.id)).toEqual(["2"]);
    expect(searchAthletes(athletes, "josée").map((a) => a.id)).toEqual(["2"]);
  });

  it("finds nobody when nothing matches", () => {
    expect(searchAthletes(athletes, "zzz")).toEqual([]);
  });
});

describe("isValidStartList", () => {
  const list = (...ids: string[]) => ids.map((athleteId) => ({ athleteId }));

  it("accepts one to 24 different athletes", () => {
    expect(isValidStartList(list("a"))).toBe(true);
    expect(
      isValidStartList(list(...Array.from({ length: MAX_START_LIST }, (_, i) => `a${i}`))),
    ).toBe(true);
  });

  it("refuses an empty list, more than 24 athletes, a duplicate or a blank id", () => {
    expect(isValidStartList([])).toBe(false);
    expect(isValidStartList(list(...Array.from({ length: 25 }, (_, i) => `a${i}`)))).toBe(false);
    expect(isValidStartList(list("a", "b", "a"))).toBe(false);
    expect(isValidStartList(list("a", ""))).toBe(false);
  });
});

describe("sortByDiscipline", () => {
  it("puts the athletes whose main discipline it is first, then the others who run it, then the rest", () => {
    const sorted = sortByDiscipline([
      { name: "Zoé", fit: "other" as const },
      { name: "Anna", fit: "discipline" as const },
      { name: "Bea", fit: "primary" as const },
      { name: "Cleo", fit: "primary" as const },
    ]);

    expect(sorted.map((a) => a.name)).toEqual(["Bea", "Cleo", "Anna", "Zoé"]);
  });
});
