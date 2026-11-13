import { describe, expect, it } from "vitest";

import { managerStandings } from "@/domain/manager-championship";
import type { ManagerHonours } from "@/domain/manager-honours";

import { UseCaseError } from "./errors";
import {
  getManagerSeasonEnd,
  getMyManagerHonours,
  type ManagerHonoursRepository,
} from "./manager-honours";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";

const participant = (userId: string, number: number) => ({
  userId,
  pseudo: `Joueur ${userId}`,
  bib: { number, color: "blue" as const },
});

const duel = (round: number, home: string, away: string, homeScore: number, awayScore: number) => ({
  round,
  home,
  away,
  homeScore,
  awayScore,
});

/**
 * Two leagues of zoe's: « Ligue des copains » is over (zoe champion ahead of max), « Ligue du
 * club » is over too (zoe second), « Ligue en cours » still plays.
 */
function world(userId = "zoe") {
  const leagues: Record<string, ManagerLeagueFile> = {
    L: {
      id: "L",
      name: "Ligue des copains",
      participants: [participant("zoe", 7), participant("max", 12)],
    } as ManagerLeagueFile,
    P: {
      id: "P",
      name: "Ligue en cours",
      participants: [participant("zoe", 7)],
    } as ManagerLeagueFile,
  };
  const managerLeagues: Pick<ManagerLeagueRepository, "find"> = {
    find: async (id) => leagues[id] ?? null,
  };
  const copains = [duel(1, "zoe", "max", 900, 700), duel(2, "max", "zoe", 650, 650)];
  const club = [duel(1, "zoe", "ana", 100, 300), duel(2, "ana", "zoe", 300, 100)];
  const honours: ManagerHonours[] = [
    {
      leagueId: "L",
      leagueName: "Ligue des copains",
      endedAt: "2026-06-01T20:00:00.000Z",
      championId: "zoe",
      standings: managerStandings(["zoe", "max"], copains),
      duels: copains,
      players: [
        { userId: "zoe", managerPoints: 3200, bestAthlete: { name: "Athlète A", points: 1400 } },
        { userId: "max", managerPoints: 2100, bestAthlete: null },
      ],
    },
    {
      leagueId: "C",
      leagueName: "Ligue du club",
      endedAt: "2026-09-01T20:00:00.000Z",
      championId: "ana",
      standings: managerStandings(["zoe", "ana"], club),
      duels: club,
      players: [],
    },
  ];
  // As the database: a player reads the honours of their leagues only.
  const visible = honours.filter((h) => h.standings.some((r) => r.userId === userId));
  const repository: ManagerHonoursRepository = {
    find: async (leagueId) => visible.find((h) => h.leagueId === leagueId) ?? null,
    mine: async () => visible,
  };
  return { managerLeagues, honours: repository, userId };
}

describe("getManagerSeasonEnd", () => {
  it("crowns the first of the frozen standings and gives the champion their season", async () => {
    // Given the season of « Ligue des copains » is over
    // When zoe opens the end of the season
    const view = await getManagerSeasonEnd(world()).execute({ leagueId: "L" });

    // Then she is champion, first of the final standings, with her figures and her rival's record
    expect(view.ended).toBe(true);
    expect(view.champion).toMatchObject({ userId: "zoe", pseudo: "Joueur zoe" });
    expect(
      view.rows.map((r) => [r.participant.pseudo, r.rank, r.points, r.champion, r.mine]),
    ).toEqual([
      ["Joueur zoe", 1, 4, true, true],
      ["Joueur max", 2, 1, false, false],
    ]);
    expect(view.review).toMatchObject({
      champion: true,
      rank: 1,
      players: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      managerPoints: 3200,
      bestAthlete: { name: "Athlète A", points: 1400 },
      rival: { userId: "max", wins: 1, draws: 1, losses: 0, participant: { pseudo: "Joueur max" } },
    });
  });

  it("gives another participant their final place", async () => {
    const view = await getManagerSeasonEnd(world("max")).execute({ leagueId: "L" });

    expect(view.review).toMatchObject({ champion: false, rank: 2, managerPoints: 2100 });
    expect(view.review?.rival).toMatchObject({ userId: "zoe", wins: 0, draws: 1, losses: 1 });
  });

  it("freezes nothing while the season still plays", async () => {
    const view = await getManagerSeasonEnd(world()).execute({ leagueId: "P" });

    expect(view).toEqual({
      leagueName: "Ligue en cours",
      ended: false,
      endedAt: null,
      champion: null,
      rows: [],
      review: null,
    });
  });

  it("refuses a league the player is not in", async () => {
    await expect(getManagerSeasonEnd(world()).execute({ leagueId: "X" })).rejects.toEqual(
      new UseCaseError("LEAGUE_NOT_FOUND"),
    );
  });
});

describe("getMyManagerHonours", () => {
  it("lists every finished season of the player, latest first, with their place", async () => {
    expect(await getMyManagerHonours(world()).execute()).toEqual([
      {
        leagueId: "C",
        leagueName: "Ligue du club",
        endedAt: "2026-09-01T20:00:00.000Z",
        rank: 2,
        players: 2,
        champion: false,
      },
      {
        leagueId: "L",
        leagueName: "Ligue des copains",
        endedAt: "2026-06-01T20:00:00.000Z",
        rank: 1,
        players: 2,
        champion: true,
      },
    ]);
  });

  it("is empty for a player who never finished a season", async () => {
    expect(await getMyManagerHonours(world("bob")).execute()).toEqual([]);
  });
});
