import { describe, expect, it } from "vitest";

import type { CompetitionScope } from "./competition";
import { competitionGroups, searchCompetitions } from "./competition-search";

const competition = (
  slug: string,
  startsOn: string,
  scope: CompetitionScope = "international",
  city: string | null = null,
) => ({ slug, name: slug.replace(/-/g, " "), city, scope, startsOn, endsOn: startsOn });

describe("searchCompetitions", () => {
  const list = [
    competition("meeting-de-paris", "2027-06-10", "international", "Paris"),
    competition("championnats-de-france-elite", "2027-07-24", "france", "Angers"),
    competition("golden-gala", "2027-06-04", "international", "Rome"),
  ];

  it("finds a competition by a word of its name, whatever the case and accents", () => {
    expect(searchCompetitions(list, "ÉLITE", "all").map((c) => c.slug)).toEqual([
      "championnats-de-france-elite",
    ]);
  });

  it("finds a competition by its city", () => {
    expect(searchCompetitions(list, "rom", "all").map((c) => c.slug)).toEqual(["golden-gala"]);
  });

  it("keeps the competitions of one kind", () => {
    expect(searchCompetitions(list, "", "france").map((c) => c.slug)).toEqual([
      "championnats-de-france-elite",
    ]);
    expect(searchCompetitions(list, " ", "international")).toHaveLength(2);
  });
});

describe("competitionGroups", () => {
  const list = [
    competition("july", "2027-07-24"),
    competition("june-b", "2027-06-10"),
    competition("mine", "2027-08-01"),
    competition("june-a", "2027-06-04"),
    competition("past-old", "2026-05-01"),
    competition("past-recent", "2026-09-11"),
  ];

  it("puts my leagues' competitions first, then the coming ones by month, then the past ones", () => {
    const groups = competitionGroups(list, ["mine", "past-recent"], "2027-01-01");

    expect(groups.map((g) => [g.kind, g.month, g.competitions.map((c) => c.slug)])).toEqual([
      ["mine", null, ["mine"]],
      ["month", "2027-06", ["june-a", "june-b"]],
      ["month", "2027-07", ["july"]],
      ["past", null, ["past-recent", "past-old"]],
    ]);
  });

  it("has no empty group", () => {
    expect(competitionGroups([competition("a", "2027-06-04")], [], "2027-01-01")).toEqual([
      { kind: "month", month: "2027-06", competitions: [competition("a", "2027-06-04")] },
    ]);
  });
});
