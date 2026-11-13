import { describe, expect, it } from "vitest";

import type { ManagerSeasonData, ManagerSeasonRepository } from "./manager-championship";
import { getManagerHome } from "./manager-home";
import type { ManagerLeague, ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";
import type { LineupCompetition, ManagerLineupRepository } from "./manager-lineup";

const NOW = "2026-11-13T12:00:00.000Z";
const DAY = 24 * 3600 * 1000;
const inDays = (n: number) => new Date(Date.parse(NOW) + n * DAY).toISOString();

const participant = (userId: string, number: number) => ({
  userId,
  pseudo: `Joueur ${userId}`,
  bib: { number, color: "blue" as const },
});

const competition = (n: number, lockInDays: number, lineup: string[] | null = null) =>
  ({
    competitionId: `c${n}`,
    slug: `meeting-${n}`,
    name: `Meeting ${n}`,
    startsOn: inDays(lockInDays).slice(0, 10),
    lockAt: inDays(lockInDays),
    entered: [],
    lineup,
  }) satisfies LineupCompetition;

/**
 * Zoe (signed in) and max in « Ligue des copains »; once the mercato is closed, matchdays 1 and 2
 * are head-to-heads on c1 and c2, matchday 3 a bonus one on c3.
 */
function world(
  options: {
    leagues?: ManagerLeague[];
    openedAt?: string | null;
    started?: boolean;
    scores?: ManagerSeasonData["scores"];
    lineups?: LineupCompetition[];
  } = {},
) {
  const league = {
    id: "L",
    name: "Ligue des copains",
    memberCount: 2,
    target: 4,
    mercato: { openedAt: options.openedAt === undefined ? inDays(-3) : options.openedAt },
    participants: [participant("zoe", 7), participant("max", 12)],
  } as ManagerLeagueFile;
  const managerLeagues: Pick<ManagerLeagueRepository, "listMine" | "find"> = {
    listMine: async () => options.leagues ?? [league],
    find: async (id) => (id === "L" ? league : null),
  };
  const data: ManagerSeasonData = {
    matchdays: [
      { round: 1, competitionId: "c1", competitionName: "Meeting 1", bonus: false },
      { round: 2, competitionId: "c2", competitionName: "Meeting 2", bonus: false },
      { round: 3, competitionId: "c3", competitionName: "Meeting 3", bonus: true },
    ],
    fixtures: [
      { round: 1, home: "zoe", away: "max" },
      { round: 2, home: "max", away: "zoe" },
    ],
    scores: options.scores ?? [],
  };
  const season: ManagerSeasonRepository = {
    season: async () => (options.started ? data : { matchdays: [], fixtures: [], scores: [] }),
  };
  const lineups: Pick<ManagerLineupRepository, "mine"> = {
    mine: async () => options.lineups ?? [competition(1, 2), competition(2, 9), competition(3, 16)],
  };
  return { managerLeagues, season, lineups, userId: "zoe" };
}

const zoeWinsMatchday1 = [
  { competitionId: "c1", userId: "zoe", total: 900 },
  { competitionId: "c1", userId: "max", total: 700 },
];

describe("getManagerHome", () => {
  it("has no season for a player without a Manager league", async () => {
    // Given zoe is in no Manager league
    // When she opens the Manager tab
    const home = await getManagerHome(world({ leagues: [] })).execute({ now: NOW });

    // Then there is no season to show
    expect(home).toBeNull();
  });

  it("stays on the league step while the mercato waits for its players", async () => {
    const home = await getManagerHome(world({ openedAt: null })).execute({ now: NOW });

    expect(home).toMatchObject({
      leagueId: "L",
      leagueName: "Ligue des copains",
      players: 2,
      step: "league",
      round: null,
      standing: null,
      next: null,
    });
  });

  it("sends the player to the mercato while it is open", async () => {
    const home = await getManagerHome(world()).execute({ now: NOW });

    expect(home?.step).toBe("mercato");
  });

  it("asks to line up the team for the next competition, with its lock time", async () => {
    // Given the mercato is closed and matchday 1 is coming, no lineup yet
    // When zoe opens the Manager tab
    const home = await getManagerHome(world({ started: true })).execute({ now: NOW });

    // Then she lines up her team before matchday 1, against max at home
    expect(home).toMatchObject({
      step: "lineup",
      round: { current: 1, total: 3 },
      standing: { rank: 1, points: 0, wins: 0, draws: 0, losses: 0, difference: 0 },
      lineup: { slug: "meeting-1", lockAt: inDays(2) },
      lastPoints: null,
    });
    expect(home?.next).toMatchObject({
      round: 1,
      home: true,
      me: { userId: "zoe" },
      opponent: { userId: "max" },
    });
  });

  it("waits for the points once the lineup is validated", async () => {
    const home = await getManagerHome(
      world({ started: true, lineups: [competition(1, 2, ["a1"]), competition(2, 9)] }),
    ).execute({ now: NOW });

    expect(home?.step).toBe("points");
  });

  it("shows the place, the record and the last points after a scored matchday", async () => {
    // Given zoe won matchday 1, 900 – 700, and has lined up for matchday 2
    const home = await getManagerHome(
      world({
        started: true,
        scores: zoeWinsMatchday1,
        lineups: [competition(1, -5, ["a1"]), competition(2, 2, ["a1"]), competition(3, 9)],
      }),
    ).execute({ now: NOW });

    // Then she leads with 3 points and +200, matchday 2 away to max
    expect(home).toMatchObject({
      step: "points",
      round: { current: 2, total: 3 },
      standing: { rank: 1, points: 3, wins: 1, draws: 0, losses: 0, difference: 200 },
      next: { round: 2, home: false, opponent: { userId: "max" } },
      lastPoints: "meeting-1",
    });
  });

  it("crowns the season once every matchday is scored", async () => {
    const home = await getManagerHome(
      world({
        started: true,
        scores: [
          ...zoeWinsMatchday1,
          { competitionId: "c2", userId: "zoe", total: 500 },
          { competitionId: "c2", userId: "max", total: 600 },
          { competitionId: "c3", userId: "max", total: 100 },
        ],
        lineups: [competition(1, -9, ["a1"]), competition(2, -5, ["a1"]), competition(3, -2)],
      }),
    ).execute({ now: NOW });

    expect(home).toMatchObject({
      step: "champion",
      round: { current: 3, total: 3 },
      next: null,
      lineup: null,
      lastPoints: "meeting-3",
    });
  });
});
