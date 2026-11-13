import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  discoverLeagues,
  leagueFamiliesIn,
  leagueSummary,
  nextLeagueCompetition,
  type DiscoverableLeague,
} from "./league-list";

const competition = (slug: string, startsOn: string, endsOn = startsOn) => ({
  slug,
  name: slug,
  startsOn,
  endsOn,
});

describe("leagueSummary", () => {
  it("sums up a league of one competition as one month", () => {
    expect(leagueSummary(["paris"], [competition("paris", "2027-06-12", "2027-06-13")])).toEqual({
      count: 1,
      start: "2027-06",
      end: "2027-06",
    });
  });

  it("spans from the first start to the last end, across two years", () => {
    const all = [
      competition("tokyo", "2027-02-01"),
      competition("doha", "2026-12-10"),
      competition("rome", "2027-03-30", "2027-04-02"),
      competition("elsewhere", "2025-01-01"),
    ];
    expect(leagueSummary(["rome", "doha", "tokyo"], all)).toEqual({
      count: 3,
      start: "2026-12",
      end: "2027-04",
    });
  });

  it("counts every competition but dates only the known ones", () => {
    expect(leagueSummary(["paris", "gone"], [competition("paris", "2027-06-12")])).toEqual({
      count: 2,
      start: "2027-06",
      end: "2027-06",
    });
  });

  it("has no period for a league without competition", () => {
    expect(leagueSummary([], [competition("paris", "2027-06-12")])).toEqual({
      count: 0,
      start: null,
      end: null,
    });
  });
});

describe("nextLeagueCompetition", () => {
  const all = [
    competition("past", "2026-09-01", "2026-09-02"),
    competition("live", "2026-11-12", "2026-11-14"),
    competition("later", "2027-03-01"),
    competition("other", "2026-11-20"),
  ];

  it("is the competition of the league under way or coming first", () => {
    expect(nextLeagueCompetition(["later", "live", "past"], all, "2026-11-13")?.slug).toBe("live");
  });

  it("is none once every competition of the league is over", () => {
    expect(nextLeagueCompetition(["past"], all, "2026-11-13")).toBeNull();
  });
});

const league = (
  name: string,
  memberCount: number,
  createdAt: string,
  families?: DiscoverableLeague["families"],
): DiscoverableLeague => ({ name, memberCount, createdAt, ...(families ? { families } : {}) });

describe("discoverLeagues", () => {
  const leagues = [
    league("Les Haies du Nord", 120, "2026-10-01T10:00:00Z", ["hurdles", "sprint"]),
    league("Club Lancers", 12, "2026-11-01T10:00:00Z", ["throws"]),
    league("Élite Testville", 199, "2026-09-01T10:00:00Z"),
    league("Les Foulées", 40, "2026-11-10T10:00:00Z"),
  ];
  const names = (list: DiscoverableLeague[]) => list.map((l) => l.name);

  it("puts the leagues with the most places left first by default", () => {
    expect(names(discoverLeagues(leagues, { query: "", family: "all", sort: "places" }))).toEqual([
      "Club Lancers",
      "Les Foulées",
      "Les Haies du Nord",
      "Élite Testville",
    ]);
  });

  it("sorts by players, the biggest first, or by creation, the latest first", () => {
    expect(names(discoverLeagues(leagues, { query: "", family: "all", sort: "players" }))).toEqual([
      "Élite Testville",
      "Les Haies du Nord",
      "Les Foulées",
      "Club Lancers",
    ]);
    expect(names(discoverLeagues(leagues, { query: "", family: "all", sort: "recent" }))).toEqual([
      "Les Foulées",
      "Club Lancers",
      "Les Haies du Nord",
      "Élite Testville",
    ]);
  });

  it("finds a league by the words of its name, without accents nor case", () => {
    expect(
      names(discoverLeagues(leagues, { query: " elite ", family: "all", sort: "places" })),
    ).toEqual(["Élite Testville"]);
    expect(
      names(discoverLeagues(leagues, { query: "les nord", family: "all", sort: "places" })),
    ).toEqual(["Les Haies du Nord"]);
  });

  it("keeps the leagues of a family, then narrows them by name", () => {
    const sprint = discoverLeagues(leagues, { query: "", family: "sprint", sort: "places" });
    expect(names(sprint)).toEqual(["Les Haies du Nord"]);
    expect(discoverLeagues(leagues, { query: "club", family: "sprint", sort: "places" })).toEqual(
      [],
    );
  });

  it("never adds a league and never depends on the order it receives", () => {
    const arbitrary = fc.array(
      fc.record({
        name: fc.string({ minLength: 1 }),
        memberCount: fc.integer({ min: 0, max: 200 }),
        createdAt: fc
          .integer({ min: Date.parse("2026-01-01"), max: Date.parse("2027-01-01") })
          .map((t) => new Date(t).toISOString()),
      }),
    );
    fc.assert(
      fc.property(
        arbitrary,
        fc.constantFrom("places", "players", "recent" as const),
        (list, sort) => {
          const shown = discoverLeagues(list, { query: "", family: "all", sort });
          const reversed = discoverLeagues([...list].reverse(), { query: "", family: "all", sort });
          expect(shown).toHaveLength(list.length);
          expect(reversed.map((l) => [l.name, l.memberCount, l.createdAt])).toEqual(
            shown.map((l) => [l.name, l.memberCount, l.createdAt]),
          );
        },
      ),
    );
  });
});

describe("leagueFamiliesIn", () => {
  it("lists the families of the leagues once each, in the order of the screen", () => {
    expect(
      leagueFamiliesIn([
        league("A", 1, "2026-01-01T00:00:00Z", ["throws", "sprint"]),
        league("B", 1, "2026-01-01T00:00:00Z"),
        league("C", 1, "2026-01-01T00:00:00Z", ["sprint"]),
      ]),
    ).toEqual(["sprint", "throws"]);
  });
});
