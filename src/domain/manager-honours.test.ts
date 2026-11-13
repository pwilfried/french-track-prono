import { describe, expect, it } from "vitest";

import { managerStandings, type SeasonMatchday } from "./manager-championship";
import {
  headToHead,
  mainRival,
  seasonOver,
  seasonReview,
  type ManagerHonours,
} from "./manager-honours";

const day = (round: number, competitionId: string | null, bonus = false): SeasonMatchday => ({
  round,
  competitionId,
  bonus,
});
const duel = (round: number, home: string, away: string, homeScore: number, awayScore: number) => ({
  round,
  home,
  away,
  homeScore,
  awayScore,
});

describe("seasonOver", () => {
  const matchdays = [day(1, "c1"), day(2, "c2"), day(3, "c3", true)];

  it("is not over while the bonus matchday is still to be scored", () => {
    expect(seasonOver(matchdays, new Set(["c1", "c2"]))).toBe(false);
  });

  it("ends once every matchday of the schedule is scored, bonus matchdays included", () => {
    expect(seasonOver(matchdays, new Set(["c1", "c2", "c3"]))).toBe(true);
  });

  it("does not wait for a matchday without competition: it is not played", () => {
    expect(seasonOver([day(1, "c1"), day(2, null)], new Set(["c1"]))).toBe(true);
  });

  it("never ends a season that has not started or has nothing to play", () => {
    expect(seasonOver([], new Set())).toBe(false);
    expect(seasonOver([day(1, null)], new Set())).toBe(false);
  });
});

describe("mainRival", () => {
  const standings = managerStandings(["ana", "bob", "cyd"], []);

  it("is the player just ahead in the final standings", () => {
    expect(mainRival("cyd", standings)).toBe("bob");
    expect(mainRival("bob", standings)).toBe("ana");
  });

  it("is the second for the champion", () => {
    expect(mainRival("ana", standings)).toBe("bob");
  });

  it("is nobody for a player outside the standings or alone", () => {
    expect(mainRival("max", standings)).toBeNull();
    expect(mainRival("ana", managerStandings(["ana"], []))).toBeNull();
  });
});

describe("headToHead", () => {
  it("counts the player's wins, draws and defeats against one opponent, at home and away", () => {
    const duels = [
      duel(1, "ana", "bob", 900, 700),
      duel(2, "cyd", "ana", 500, 400),
      duel(4, "bob", "ana", 650, 650),
    ];

    expect(headToHead("ana", "bob", duels)).toEqual({ wins: 1, draws: 1, losses: 0 });
    expect(headToHead("bob", "ana", duels)).toEqual({ wins: 0, draws: 1, losses: 1 });
    expect(headToHead("ana", "cyd", duels)).toEqual({ wins: 0, draws: 0, losses: 1 });
  });
});

describe("seasonReview", () => {
  const duels = [
    duel(1, "ana", "bob", 900, 700),
    duel(2, "bob", "ana", 800, 700),
    duel(1, "cyd", "dan", 100, 100),
    duel(2, "dan", "cyd", 200, 200),
  ];
  const honours: ManagerHonours = {
    leagueId: "L",
    leagueName: "Ligue des copains",
    endedAt: "2026-11-13T10:00:00.000Z",
    championId: "ana",
    standings: managerStandings(["ana", "bob", "cyd", "dan"], duels),
    duels,
    players: [
      { userId: "ana", managerPoints: 2500, bestAthlete: { name: "Athlète A", points: 1200 } },
      { userId: "bob", managerPoints: 1500, bestAthlete: null },
    ],
  };

  it("gives the champion their place, record, Manager points, best athlete and rival", () => {
    expect(seasonReview("ana", honours)).toEqual({
      rank: 1,
      position: 1,
      players: 4,
      champion: true,
      wins: 1,
      draws: 0,
      losses: 1,
      managerPoints: 2500,
      bestAthlete: { name: "Athlète A", points: 1200 },
      rival: { userId: "bob", wins: 1, draws: 0, losses: 1 },
    });
  });

  it("gives another player their final place, shared on a full tie, never the title", () => {
    expect(seasonReview("dan", honours)).toEqual({
      rank: 3,
      position: 4,
      players: 4,
      champion: false,
      wins: 0,
      draws: 2,
      losses: 0,
      managerPoints: 0,
      bestAthlete: null,
      rival: { userId: "cyd", wins: 0, draws: 2, losses: 0 },
    });
  });

  it("has nothing for a player outside the standings", () => {
    expect(seasonReview("max", honours)).toBeNull();
  });
});
