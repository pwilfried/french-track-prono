import { describe, expect, it } from "vitest";

import {
  CHAMPIONSHIP_LEVEL,
  filterCompetitions,
  groupByMonth,
  levelsOf,
  pickableFromDays,
  NO_FILTERS,
  quickSelections,
  type PickableCompetition,
} from "./season-picker";

let next = 0;
const competition = (overrides: Partial<PickableCompetition> = {}): PickableCompetition => ({
  id: `c${++next}`,
  name: `Meeting ${next}`,
  firstEventAt: "2027-06-10T17:00:00.000Z",
  city: null,
  scope: "international",
  venue: "outdoor",
  level: null,
  ...overrides,
});

describe("quickSelections", () => {
  it("offers the whole season, the indoor season, one per level then the major championships", () => {
    const list = [
      competition({ id: "dl1", level: "diamond-league" }),
      competition({ id: "dl2", level: "diamond-league" }),
      competition({ id: "wit", level: "world-indoor-tour-gold", venue: "indoor" }),
      competition({ id: "world", level: CHAMPIONSHIP_LEVEL }),
      competition({ id: "fr", level: CHAMPIONSHIP_LEVEL, scope: "france", venue: "indoor" }),
      competition({ id: "other" }),
    ];
    expect(quickSelections(list)).toEqual([
      { kind: "season", ids: ["dl1", "dl2", "wit", "world", "fr", "other"] },
      { kind: "indoor", ids: ["wit", "fr"] },
      { kind: "level", level: "diamond-league", ids: ["dl1", "dl2"] },
      { kind: "level", level: "world-indoor-tour-gold", ids: ["wit"] },
      { kind: "majors", ids: ["world"] },
    ]);
  });

  it("puts the levels with most competitions first, then in alphabetical order", () => {
    const list = [
      competition({ level: "silver" }),
      competition({ level: "gold" }),
      competition({ level: "bronze" }),
      competition({ level: "gold" }),
    ];
    expect(
      quickSelections(list)
        .filter((s) => s.kind === "level")
        .map((s) => (s.kind === "level" ? s.level : "")),
    ).toEqual(["gold", "bronze", "silver"]);
  });

  it("leaves out the selections without any competition", () => {
    expect(quickSelections([competition()])).toEqual([{ kind: "season", ids: [`c${next}`] }]);
    expect(quickSelections([])).toEqual([]);
  });
});

describe("levelsOf", () => {
  it("lists the levels present once, championships included, most frequent first", () => {
    const list = [
      competition({ level: CHAMPIONSHIP_LEVEL }),
      competition({ level: "diamond-league" }),
      competition({ level: "diamond-league" }),
      competition(),
    ];
    expect(levelsOf(list)).toEqual(["diamond-league", CHAMPIONSHIP_LEVEL]);
  });
});

describe("filterCompetitions", () => {
  const oslo = competition({ name: "Bislett Games", city: "Oslo", level: "diamond-league" });
  const lievin = competition({
    name: "Meeting Hauts-de-France Pas-de-Calais",
    city: "Liévin",
    venue: "indoor",
    level: "world-indoor-tour-gold",
  });
  const france = competition({
    name: "Championnats de France Élite",
    city: "Albi",
    scope: "france",
    level: CHAMPIONSHIP_LEVEL,
  });
  const list = [oslo, lievin, france];
  const ids = (found: PickableCompetition[]) => found.map((c) => c.id);

  it("keeps everything without a filter", () => {
    expect(ids(filterCompetitions(list, NO_FILTERS, new Set()))).toEqual(ids(list));
  });

  it("searches the name and the city, whatever the case and the accents", () => {
    const search = (query: string) =>
      ids(filterCompetitions(list, { ...NO_FILTERS, query }, new Set()));
    expect(search("lievin")).toEqual([lievin.id]);
    expect(search("  ELITE ")).toEqual([france.id]);
    expect(search("bislett")).toEqual([oslo.id]);
    expect(search("berlin")).toEqual([]);
  });

  it("combines the scope, the venue and the level", () => {
    const filter = (filters: Partial<typeof NO_FILTERS>) =>
      ids(filterCompetitions(list, { ...NO_FILTERS, ...filters }, new Set()));
    expect(filter({ scope: "france" })).toEqual([france.id]);
    expect(filter({ scope: "international", venue: "outdoor" })).toEqual([oslo.id]);
    expect(filter({ venue: "indoor", level: "diamond-league" })).toEqual([]);
    expect(filter({ level: "world-indoor-tour-gold" })).toEqual([lievin.id]);
  });

  it("shows only the ticked competitions when asked", () => {
    const chosen = new Set([france.id, oslo.id]);
    expect(ids(filterCompetitions(list, { ...NO_FILTERS, onlyChosen: true }, chosen))).toEqual([
      oslo.id,
      france.id,
    ]);
    expect(
      ids(filterCompetitions(list, { ...NO_FILTERS, onlyChosen: true, query: "albi" }, chosen)),
    ).toEqual([france.id]);
  });
});

describe("groupByMonth", () => {
  it("groups the competitions by month in Paris time, first month first", () => {
    const jan = competition({ firstEventAt: "2027-01-20T18:00:00.000Z" });
    // 31 March 23:30 UTC is already 1 April in Paris.
    const april = competition({ firstEventAt: "2027-03-31T23:30:00.000Z" });
    const feb = competition({ firstEventAt: "2027-02-05T18:00:00.000Z" });
    const jan2 = competition({ firstEventAt: "2027-01-02T18:00:00.000Z" });
    expect(groupByMonth([jan, april, feb, jan2])).toEqual([
      { month: "2027-01", competitions: [jan2, jan] },
      { month: "2027-02", competitions: [feb] },
      { month: "2027-04", competitions: [april] },
    ]);
  });

  it("has no month without competitions", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("pickableFromDays", () => {
  it("picks a competition by its slug, on the day it starts in Paris time", () => {
    const picked = pickableFromDays({
      slug: "meeting-de-paris-2027",
      name: "Meeting de Paris",
      startsOn: "2027-06-01",
      city: "Paris",
      scope: "international",
      venue: "outdoor",
      level: "diamond-league",
    });
    expect(picked).toEqual({
      id: "meeting-de-paris-2027",
      name: "Meeting de Paris",
      firstEventAt: "2027-06-01T12:00:00.000Z",
      city: "Paris",
      scope: "international",
      venue: "outdoor",
      level: "diamond-league",
    });
    expect(groupByMonth([picked])[0]!.month).toBe("2027-06");
  });
});
