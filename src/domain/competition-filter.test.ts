import { describe, expect, it } from "vitest";

import type { CompetitionScope, CompetitionVenue } from "./competition";
import {
  competitionLevels,
  competitionStatus,
  filterCompetitions,
  isFiltered,
  NO_FILTER,
  parseCompetitionFilter,
} from "./competition-filter";

const TODAY = "2027-03-06";

const competition = (
  slug: string,
  startsOn: string,
  endsOn: string,
  scope: CompetitionScope,
  venue: CompetitionVenue,
  level: string | null,
) => ({ slug, startsOn, endsOn, scope, venue, level });

const list = [
  competition("france-elite-salle", "2027-02-20", "2027-02-21", "france", "indoor", "championnat"),
  competition("france-elite", "2027-07-24", "2027-07-26", "france", "outdoor", "championnat"),
  competition("europe-salle", "2027-03-05", "2027-03-07", "international", "indoor", "championnat"),
  competition(
    "lievin",
    "2027-02-12",
    "2027-02-12",
    "international",
    "indoor",
    "world-indoor-tour-gold",
  ),
  competition(
    "meeting-de-paris",
    "2027-06-10",
    "2027-06-10",
    "international",
    "outdoor",
    "diamond-league",
  ),
  competition("meeting-regional", "2027-05-01", "2027-05-01", "france", "outdoor", null),
];
const slugs = (filter: Parameters<typeof filterCompetitions>[1]) =>
  filterCompetitions(list, filter, TODAY).map((c) => c.slug);

describe("competitionStatus", () => {
  it("is coming before the first day, live until the last day included, past after", () => {
    const c = { startsOn: "2027-03-05", endsOn: "2027-03-07" };
    expect(competitionStatus(c, "2027-03-04")).toBe("coming");
    expect(competitionStatus(c, "2027-03-05")).toBe("live");
    expect(competitionStatus(c, "2027-03-07")).toBe("live");
    expect(competitionStatus(c, "2027-03-08")).toBe("past");
  });
});

describe("filterCompetitions", () => {
  it("keeps every competition without a filter", () => {
    expect(slugs(NO_FILTER)).toHaveLength(list.length);
  });

  it("keeps only the French indoor championships when « France » and « Salle » are combined", () => {
    expect(slugs({ ...NO_FILTER, scope: "france", venue: "indoor" })).toEqual([
      "france-elite-salle",
    ]);
  });

  it("keeps the competitions of one level", () => {
    expect(slugs({ ...NO_FILTER, level: "diamond-league" })).toEqual(["meeting-de-paris"]);
  });

  it("keeps the competitions coming, under way or over", () => {
    expect(slugs({ ...NO_FILTER, status: "live" })).toEqual(["europe-salle"]);
    expect(slugs({ ...NO_FILTER, status: "past" })).toEqual(["france-elite-salle", "lievin"]);
    expect(slugs({ ...NO_FILTER, status: "coming" })).toEqual([
      "france-elite",
      "meeting-de-paris",
      "meeting-regional",
    ]);
  });

  it("combines the four filters", () => {
    expect(
      slugs({ scope: "international", venue: "indoor", level: "championnat", status: "live" }),
    ).toEqual(["europe-salle"]);
  });

  it("returns an empty list when nothing matches, or when there is no competition", () => {
    expect(slugs({ ...NO_FILTER, scope: "france", level: "diamond-league" })).toEqual([]);
    expect(filterCompetitions([], { ...NO_FILTER, venue: "indoor" }, TODAY)).toEqual([]);
  });
});

describe("competitionLevels", () => {
  it("lists the levels present once, the known ones first, then the others by name", () => {
    expect(
      competitionLevels([
        ...list,
        competition(
          "ct-gold",
          "2027-05-20",
          "2027-05-20",
          "international",
          "outdoor",
          "continental-tour-gold",
        ),
      ]),
    ).toEqual(["championnat", "diamond-league", "world-indoor-tour-gold", "continental-tour-gold"]);
  });

  it("is empty without any level", () => {
    expect(competitionLevels([])).toEqual([]);
  });
});

describe("parseCompetitionFilter", () => {
  it("reads the filters of the address", () => {
    expect(
      parseCompetitionFilter(
        { portee: "france", lieu: "indoor", niveau: "championnat", statut: "coming" },
        ["championnat"],
      ),
    ).toEqual({ scope: "france", venue: "indoor", level: "championnat", status: "coming" });
  });

  it("ignores unknown values and levels absent from the list", () => {
    expect(
      parseCompetitionFilter({ portee: "monde", lieu: "plage", niveau: "jo", statut: "soon" }, [
        "championnat",
      ]),
    ).toEqual(NO_FILTER);
  });

  it("is filtered as soon as one filter is set", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, status: "past" })).toBe(true);
  });
});
