import { describe, expect, it } from "vitest";

import fc from "fast-check";

import {
  canLaunchMercato,
  fitsMembers,
  hasEnoughCompetitions,
  isRoundHours,
  MANAGER_LEAGUE_MAX,
  MANAGER_LEAGUE_MIN,
  MIN_SEASON_COMPETITIONS,
  mercatoRounds,
  newestArrival,
  opensAutomatically,
  plannedMercatoEnd,
  playersAwaited,
  seasonCompetitions,
  seasonFormat,
  seasonStart,
} from "./manager-league";

describe("seasonFormat", () => {
  it.each([
    [6, { players: 4, duelDays: 6, bonusDays: 0 }],
    [7, { players: 4, duelDays: 6, bonusDays: 1 }],
    [8, { players: 4, duelDays: 6, bonusDays: 2 }],
    [10, { players: 6, duelDays: 10, bonusDays: 0 }],
    [14, { players: 8, duelDays: 14, bonusDays: 0 }],
    [18, { players: 10, duelDays: 18, bonusDays: 0 }],
    [25, { players: 10, duelDays: 18, bonusDays: 7 }],
  ])("derives the players of %i competitions", (competitions, format) => {
    expect(seasonFormat(competitions)).toEqual(format);
  });

  it("spans the league sizes, from the minimum of competitions to the cap", () => {
    expect(seasonFormat(MIN_SEASON_COMPETITIONS)?.players).toBe(MANAGER_LEAGUE_MIN);
    expect(seasonFormat(100)?.players).toBe(MANAGER_LEAGUE_MAX);
  });

  it.each([0, 1, 5])("refuses %i competitions, fewer than 6", (competitions) => {
    expect(seasonFormat(competitions)).toBeNull();
  });

  it("always gives an even count from 4 to 10 whose home-and-away fits the competitions", () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 60 }), (competitions) => {
        const format = seasonFormat(competitions)!;
        expect(format.players % 2).toBe(0);
        expect(format.players).toBeGreaterThanOrEqual(4);
        expect(format.players).toBeLessThanOrEqual(10);
        expect(format.duelDays).toBe(2 * (format.players - 1));
        expect(format.duelDays + format.bonusDays).toBe(competitions);
        // Exact: two more players would not fit, unless 10 is reached.
        if (format.players < 10) expect(2 * (format.players + 1)).toBeGreaterThan(competitions);
      }),
    );
  });
});

describe("fitsMembers", () => {
  it("accepts competitions whose player count is not under the players already in", () => {
    expect(fitsMembers(6, 4)).toBe(true);
    expect(fitsMembers(10, 6)).toBe(true);
  });

  it("refuses fewer than 6 competitions, or a player count under the players already in", () => {
    expect(fitsMembers(5, 1)).toBe(false);
    expect(fitsMembers(8, 5)).toBe(false);
  });
});

const league = { target: 4, members: 4, openedAt: null, startsAt: null };

describe("canLaunchMercato", () => {
  it("lets the creator launch once the players are all in", () => {
    expect(canLaunchMercato(league, true)).toBe(true);
  });

  it("does not let another participant launch", () => {
    expect(canLaunchMercato(league, false)).toBe(false);
  });

  it("waits while players are missing", () => {
    expect(canLaunchMercato({ ...league, members: 3 }, true)).toBe(false);
    expect(playersAwaited({ ...league, members: 3 })).toBe(1);
  });

  it("does not launch a mercato twice", () => {
    expect(canLaunchMercato({ ...league, openedAt: "2027-01-01T08:00:00Z" }, true)).toBe(false);
  });
});

describe("opensAutomatically", () => {
  const scheduled = { ...league, startsAt: "2027-01-01T08:00:00.000Z" };

  it("opens at the chosen time when the players are all in", () => {
    expect(opensAutomatically(scheduled, "2027-01-01T08:00:00.000Z")).toBe(true);
    expect(opensAutomatically(scheduled, "2027-01-02T08:00:00.000Z")).toBe(true);
  });

  it("does not open before the chosen time", () => {
    expect(opensAutomatically(scheduled, "2027-01-01T07:59:00.000Z")).toBe(false);
  });

  it("waits past the chosen time while players are missing", () => {
    expect(opensAutomatically({ ...scheduled, members: 3 }, "2027-01-02T08:00:00.000Z")).toBe(
      false,
    );
  });

  it("does not open without a chosen time, nor twice", () => {
    expect(opensAutomatically(league, "2027-01-02T08:00:00.000Z")).toBe(false);
    expect(
      opensAutomatically(
        { ...scheduled, openedAt: "2027-01-01T08:00:00.000Z" },
        "2027-01-02T08:00:00.000Z",
      ),
    ).toBe(false);
  });
});

const at = (iso: string) => ({ firstEventAt: iso });

describe("seasonCompetitions", () => {
  const end = "2027-03-01T18:00:00.000Z";

  it("counts a competition whose first event is at least 1 hour after the end of the mercato", () => {
    expect(seasonCompetitions([at("2027-03-01T19:00:00.000Z")], end)).toHaveLength(1);
  });

  it("does not count a competition that starts less than 1 hour after the mercato", () => {
    expect(seasonCompetitions([at("2027-03-01T18:59:00.000Z")], end)).toEqual([]);
    expect(seasonCompetitions([at("2027-02-28T18:00:00.000Z")], end)).toEqual([]);
  });

  it("keeps the counted competitions first one first", () => {
    const later = at("2027-05-01T18:00:00.000Z");
    const sooner = at("2027-04-01T18:00:00.000Z");
    expect(seasonCompetitions([later, at("2027-03-01T18:30:00.000Z"), sooner], end)).toEqual([
      sooner,
      later,
    ]);
  });
});

describe("seasonStart", () => {
  const end = "2027-03-01T18:00:00.000Z";
  const missed = { ...at("2027-03-01T18:30:00.000Z"), name: "missed" };
  const next = { ...at("2027-04-01T18:00:00.000Z"), name: "next" };

  it("names the first competition the mercato misses and the one the season starts with", () => {
    expect(seasonStart([next, missed], end)).toEqual({ missed, first: next });
  });

  it("misses nothing when the mercato ends in time", () => {
    expect(seasonStart([next], end)).toEqual({ missed: null, first: next });
  });

  it("has no first competition when the mercato misses them all", () => {
    expect(seasonStart([missed], end)).toEqual({ missed, first: null });
  });
});

describe("hasEnoughCompetitions", () => {
  it("lets 4 players launch with 6 competitions counted, not 5", () => {
    expect(hasEnoughCompetitions(4, 6)).toBe(true);
    expect(hasEnoughCompetitions(4, 5)).toBe(false);
  });

  it("asks 18 competitions of 10 players", () => {
    expect(hasEnoughCompetitions(10, 18)).toBe(true);
    expect(hasEnoughCompetitions(10, 17)).toBe(false);
  });
});

describe("plannedMercatoEnd", () => {
  it("ends after the 3 planned rounds of the league", () => {
    expect(
      plannedMercatoEnd("2027-01-01T08:00:00.000Z", {
        firstHours: 48,
        longRounds: 1,
        nextHours: 12,
      }),
    ).toBe("2027-01-04T08:00:00.000Z");
  });
});

describe("mercatoRounds", () => {
  const frenchTrack = { firstHours: 24, longRounds: 1, nextHours: 24 };

  it("follows the French Track rules in automatic mode", () => {
    expect(mercatoRounds({ mode: "auto" }, frenchTrack)).toEqual(frenchTrack);
  });

  it("takes the creator's first and next durations in custom mode", () => {
    expect(mercatoRounds({ mode: "custom", firstHours: 48, nextHours: 12 }, frenchTrack)).toEqual({
      firstHours: 48,
      longRounds: 1,
      nextHours: 12,
    });
  });

  it.each([12, 24, 48, 72])("offers rounds of %i hours", (h) => {
    expect(isRoundHours(h)).toBe(true);
  });

  it.each([0, 6, 36, 96])("refuses rounds of %i hours", (h) => {
    expect(isRoundHours(h)).toBe(false);
  });
});

describe("newestArrival", () => {
  it("is nobody while the creator is alone in the league", () => {
    expect(newestArrival(["creator"])).toBeNull();
  });

  it("is the participant who joined last", () => {
    expect(newestArrival(["creator", "first", "last"])).toBe("last");
  });
});
