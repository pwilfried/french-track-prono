import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  getManagerMatchday,
  getManagerStandings,
  type ManagerSeasonData,
  type ManagerSeasonRepository,
} from "./manager-championship";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";

const participant = (userId: string, number: number) => ({
  userId,
  pseudo: `Joueur ${userId}`,
  bib: { number, color: "blue" as const },
});

/**
 * A league of four players (zoe signed in): matchdays 1 to 6 head-to-heads on competitions c1 to
 * c6, matchday 7 a bonus one on c7. Matchday 1 is scored: zoe 900 – 700 max, ali 650 – 650 bea.
 */
function world(options: { scores?: ManagerSeasonData["scores"]; started?: boolean } = {}) {
  const league = {
    id: "L",
    name: "Ligue des copains",
    participants: [
      participant("zoe", 7),
      participant("max", 12),
      participant("ali", 3),
      participant("bea", 99),
    ],
  } as ManagerLeagueFile;
  const managerLeagues: Pick<ManagerLeagueRepository, "find"> = {
    find: async (id) => (id === "L" ? league : null),
  };
  const round = (r: number, home: string, away: string) => ({ round: r, home, away });
  const data: ManagerSeasonData = {
    matchdays: [
      ...[1, 2, 3, 4, 5, 6].map((r) => ({
        round: r,
        competitionId: `c${r}`,
        competitionName: `Meeting ${r}`,
        bonus: false,
      })),
      { round: 7, competitionId: "c7", competitionName: "Meeting 7", bonus: true },
    ],
    fixtures: [
      round(1, "ali", "bea"),
      round(1, "zoe", "max"),
      round(2, "bea", "zoe"),
      round(2, "max", "ali"),
      round(3, "zoe", "ali"),
      round(3, "bea", "max"),
    ],
    scores: options.scores ?? [
      { competitionId: "c1", userId: "zoe", total: 900 },
      { competitionId: "c1", userId: "max", total: 700 },
      { competitionId: "c1", userId: "ali", total: 650 },
      { competitionId: "c1", userId: "bea", total: 650 },
      // A bonus matchday brings Manager points, never championship points.
      { competitionId: "c7", userId: "max", total: 5000 },
    ],
  };
  const season: ManagerSeasonRepository = {
    season: async () =>
      options.started === false ? { matchdays: [], fixtures: [], scores: [] } : data,
  };
  return { managerLeagues, season, userId: "zoe" };
}

describe("getManagerMatchday", () => {
  it("shows a scored matchday with each head-to-head result, the player's first", async () => {
    // Given matchday 1 is scored
    // When zoe opens it
    const view = await getManagerMatchday(world()).execute({ leagueId: "L", round: 1 });

    // Then she sees her win first, then the draw
    expect(view).toMatchObject({
      leagueName: "Ligue des copains",
      round: 1,
      competitionName: "Meeting 1",
      state: "played",
      leg: "first",
    });
    expect(
      view.duels.map((d) => [
        d.home.userId,
        d.away.userId,
        d.homeScore,
        d.awayScore,
        d.result,
        d.mine,
      ]),
    ).toEqual([
      ["zoe", "max", 900, 700, "home", true],
      ["ali", "bea", 650, 650, "draw", false],
    ]);
  });

  it("opens the first matchday not played yet when no round is asked", async () => {
    const view = await getManagerMatchday(world()).execute({ leagueId: "L" });

    expect(view.round).toBe(2);
    expect(view.state).toBe("upcoming");
    expect(view.duels.map((d) => [d.home.pseudo, d.homeScore, d.result])).toEqual([
      ["Joueur bea", null, null],
      ["Joueur max", null, null],
    ]);
  });

  it("lists every matchday with its state, the bonus one apart", async () => {
    const view = await getManagerMatchday(world()).execute({ leagueId: "L" });

    expect(view.matchdays.map((m) => m.state)).toEqual([
      "played",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "bonus",
    ]);
  });

  it("tells the return leg from the first one", async () => {
    const view = await getManagerMatchday(world()).execute({ leagueId: "L", round: 4 });
    expect(view.leg).toBe("return");
  });

  it("shows a bonus matchday without any head-to-head", async () => {
    const view = await getManagerMatchday(world()).execute({ leagueId: "L", round: 7 });

    expect(view).toMatchObject({ state: "bonus", leg: null, duels: [] });
  });

  it("refuses a matchday the schedule does not have", async () => {
    await expect(getManagerMatchday(world()).execute({ leagueId: "L", round: 9 })).rejects.toEqual(
      new UseCaseError("MATCHDAY_NOT_FOUND"),
    );
  });

  it("says the championship has not started before the schedule is drawn", async () => {
    await expect(
      getManagerMatchday(world({ started: false })).execute({ leagueId: "L" }),
    ).rejects.toEqual(new UseCaseError("MANAGER_SEASON_NOT_STARTED"));
  });

  it("refuses a league the player is not in", async () => {
    await expect(getManagerMatchday(world()).execute({ leagueId: "X" })).rejects.toEqual(
      new UseCaseError("LEAGUE_NOT_FOUND"),
    );
  });
});

describe("getManagerStandings", () => {
  it("ranks on points, wins, difference, then points scored, bonus matchday aside", async () => {
    // Given matchday 1 is scored and max scored 5000 on the bonus matchday
    // When zoe opens the standings
    const view = await getManagerStandings(world()).execute({ leagueId: "L" });

    // Then zoe leads with 3 points, the draw gives 1 each, max has 0
    expect(
      view.rows.map((r) => [
        r.participant.pseudo,
        r.rank,
        r.wins,
        r.draws,
        r.losses,
        r.difference,
        r.points,
        r.mine,
      ]),
    ).toEqual([
      ["Joueur zoe", 1, 1, 0, 0, 200, 3, true],
      ["Joueur ali", 2, 0, 1, 0, 0, 1, false],
      ["Joueur bea", 2, 0, 1, 0, 0, 1, false],
      ["Joueur max", 4, 0, 0, 1, -200, 0, false],
    ]);
  });

  it("gives the player's next head-to-head, at home or away", async () => {
    const view = await getManagerStandings(world()).execute({ leagueId: "L" });

    expect(view.next).toMatchObject({
      round: 2,
      competitionName: "Meeting 2",
      opponent: { userId: "bea" },
      home: false,
    });
  });

  it("lists every participant at zero before the season starts", async () => {
    const view = await getManagerStandings(world({ started: false })).execute({ leagueId: "L" });

    expect(view.started).toBe(false);
    expect(view.next).toBeNull();
    expect(view.rows.map((r) => [r.rank, r.points])).toEqual([
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ]);
  });
});
