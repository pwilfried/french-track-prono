import { describe, expect, it } from "vitest";

import {
  canLaunchMercato,
  countedCompetitions,
  isRoundHours,
  mercatoEndsAt,
  mercatoRounds,
  newestArrival,
  opensAutomatically,
  playersAwaited,
  seasonShape,
  seasonStart,
} from "./manager-league";

describe("seasonShape", () => {
  it.each([
    [6, 4, 6, 0],
    [8, 4, 6, 2],
    [10, 6, 10, 0],
    [14, 8, 14, 0],
    [18, 10, 18, 0],
    [25, 10, 18, 7],
  ])(
    "makes %i competitions a season of %i players, %i duel and %i bonus matchdays",
    (n, players, duels, bonus) => {
      expect(seasonShape(n)).toEqual({ players, duelDays: duels, bonusDays: bonus });
    },
  );

  it.each([0, 1, 5, 6.5, Number.NaN])("refuses %d competitions", (n) => {
    expect(seasonShape(n)).toBeNull();
  });
});

const hour = 3_600_000;
const at = (h: number) => new Date(Date.parse("2027-01-10T00:00:00.000Z") + h * hour).toISOString();
const competitions = [
  { id: "c2", name: "Meeting B", startsAt: at(48) },
  { id: "c1", name: "Meeting A", startsAt: at(10) },
  { id: "c3", name: "Meeting C", startsAt: at(72) },
];

describe("countedCompetitions", () => {
  it("counts a competition starting 1 h after the mercato is over, first first", () => {
    expect(countedCompetitions(competitions, at(9)).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("leaves out a competition starting less than 1 h after the mercato is over", () => {
    expect(countedCompetitions(competitions, at(9.5)).map((c) => c.id)).toEqual(["c2", "c3"]);
  });
});

describe("mercatoEndsAt", () => {
  it("ends after as many rounds as the smallest team holds athletes", () => {
    const rounds = { firstHours: 48, longRounds: 1, nextHours: 12 };
    expect(mercatoEndsAt(at(0), rounds, 3)).toBe(at(72));
    expect(mercatoEndsAt(at(0), rounds, 0)).toBe(at(48));
  });
});

describe("seasonStart", () => {
  it("says nothing missed when the mercato is over in time", () => {
    expect(seasonStart(competitions, 2, at(0))).toEqual({
      missed: null,
      first: competitions[1],
      short: 0,
    });
  });

  it("names the first competition missed and the one the season starts with", () => {
    expect(seasonStart(competitions, 2, at(20))).toEqual({
      missed: competitions[1],
      first: competitions[0],
      short: 0,
    });
  });

  it("counts the competitions the home-and-away season lacks", () => {
    expect(seasonStart(competitions, 4, at(20)).short).toBe(4);
    expect(seasonStart(competitions, 2, at(100))).toEqual({
      missed: competitions[1],
      first: null,
      short: 2,
    });
  });
});

const league = { target: 4, members: 4, openedAt: null, startsAt: null, counted: 6 };

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

  it("refuses while too few competitions are left for the home-and-away season", () => {
    expect(canLaunchMercato({ ...league, counted: 5 }, true)).toBe(false);
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

  it("waits past the chosen time while too few competitions are left", () => {
    expect(opensAutomatically({ ...scheduled, counted: 5 }, "2027-01-02T08:00:00.000Z")).toBe(
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
