import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import type { AthleteScore } from "@/domain/manager-score";

import { UseCaseError } from "./errors";
import type { ManagerSeasonData, ManagerSeasonRepository } from "./manager-championship";
import { getManagerDuel, type DuelScore, type ManagerDuelRepository } from "./manager-duel";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";

const participant = (userId: string, number: number) => ({
  userId,
  pseudo: `Joueur ${userId}`,
  bib: { number, color: "blue" as const },
});

/** A stored line: what an athlete brought, the bonuses within the total. */
const line = (
  athleteId: string,
  total: number,
  bonusPoints = 0,
  over: Partial<AthleteScore> = {},
): AthleteScore => ({
  athleteId,
  discipline: "100 m",
  mark: "11.00",
  status: "ok",
  points: total - bonusPoints,
  bonuses: bonusPoints > 0 ? [{ bonus: "first", points: bonusPoints }] : [],
  bonusPoints,
  total,
  ...over,
});

const athlete = (athleteId: string, family: CatalogueAthlete["family"]): CatalogueAthlete => ({
  athleteId,
  slug: athleteId,
  name: `Athlète ${athleteId.toUpperCase()}`,
  countryCode: "FRA",
  sex: "F",
  discipline: family === "sprint" ? "100 m" : "800 m",
  family,
  pb: null,
  sb: null,
  price: 10,
  available: false,
});

/**
 * A league of three players (zoe signed in, ali a member outside the head-to-head): a stadium of
 * one place per family. Matchday 1 on c1 (locked, scored): zoe at home against max.
 * Matchday 2 on c2: not locked yet. Matchday 3 on c3: a bonus one.
 */
function world(
  options: { userId?: string; scores?: DuelScore[]; locked?: string[]; member?: boolean } = {},
) {
  const league = {
    id: "L",
    name: "Ligue des copains",
    rules: { lineup: { max: 4, perFamily: 1, bench: 0 }, tablesDivisor: 10 },
    participants: [participant("zoe", 7), participant("max", 12), participant("ali", 3)],
  } as unknown as ManagerLeagueFile;
  const managerLeagues: Pick<ManagerLeagueRepository, "find"> = {
    find: async (id) => (id === "L" ? league : null),
  };
  const data: ManagerSeasonData = {
    matchdays: [1, 2, 3].map((r) => ({
      round: r,
      competitionId: `c${r}`,
      competitionName: `Meeting ${r}`,
      bonus: r === 3,
    })),
    fixtures: [
      { round: 1, home: "zoe", away: "max" },
      { round: 2, home: "max", away: "zoe" },
    ],
    scores: [],
  };
  const season: ManagerSeasonRepository = { season: async () => data };
  const locked = new Set(options.locked ?? ["c1"]);
  // zoe lined up her middle-distance runner first: each still sits on the place of their family.
  const lineups = [
    { userId: "zoe", athleteIds: ["z2", "z1"] },
    { userId: "max", athleteIds: ["m1"] },
  ];
  const duels: ManagerDuelRepository = {
    lineups: async (_, competitionId) =>
      options.member === false
        ? "not_member"
        : locked.has(competitionId)
          ? {
              locked: true,
              // max did not line up for matchday 2.
              lineups: competitionId === "c1" ? lineups : lineups.slice(0, 1),
            }
          : { locked: false, lineups: [] },
    scores: async (_, competitionId) =>
      competitionId === "c1"
        ? (options.scores ?? [
            {
              userId: "zoe",
              total: 1130,
              athletes: [line("z1", 1100, 20), line("z2", 0, 0, { mark: null, status: "dnf" })],
            },
            {
              userId: "max",
              total: 950,
              athletes: [line("m1", 938)],
            },
          ])
        : [],
  };
  const catalogue = {
    list: async () => [
      athlete("z1", "sprint"),
      athlete("z2", "middle"),
      athlete("m1", "sprint"),
      athlete("m2", "middle"),
      athlete("z3", "middle"),
    ],
  };
  return {
    managerLeagues,
    season,
    duels,
    catalogue,
    userId: options.userId ?? "zoe",
  };
}

describe("getManagerDuel", () => {
  it("shows both lineups on the stadium with each athlete's points, the player at the bottom", async () => {
    // Given matchday 1 is locked and scored, zoe 1130 – 950 max
    // When zoe opens her head-to-head
    const view = await getManagerDuel(world()).execute({ leagueId: "L", round: 1, home: "zoe" });

    // Then she sees max at the top, herself at the bottom, every athlete on their place
    expect(view).toMatchObject({
      leagueName: "Ligue des copains",
      round: 1,
      competitionName: "Meeting 1",
      leg: "first",
      divisor: 10,
      locked: true,
      mine: true,
      places: ["sprint", "distance", "jumps", "throws"],
      outcome: { outcome: "win", points: 3 },
      result: "home",
    });
    expect(view.top).toMatchObject({
      participant: { userId: "max" },
      home: false,
      score: 950,
      linedUp: true,
    });
    expect(view.bottom).toMatchObject({
      participant: { userId: "zoe" },
      home: true,
      score: 1130,
    });
    expect(view.bottom.cards.map((c) => c && [c.athleteId, c.points, c.bonus])).toEqual([
      ["z1", 1100, 20],
      ["z2", 0, 0],
      null,
      null,
    ]);
    expect(view.top.cards.map((c) => c && [c.athleteId, c.family, c.points])).toEqual([
      ["m1", "sprint", 938],
      null,
      null,
      null,
    ]);
  });

  it("puts the substitute who came in on the place of the starter, with what the starter did (#1036)", async () => {
    // Given z2 did not finish and z3, her substitute, came in with 96 points
    const scores: DuelScore[] = [
      {
        userId: "zoe",
        total: 1196,
        athletes: [
          line("z1", 1100, 20),
          line("z3", 96, 0, {
            discipline: "800 m",
            mark: "2:01.30",
            substitution: {
              starterId: "z2",
              reason: "forfeit",
              starter: { mark: null, status: "dnf", total: 0, threshold: null },
            },
          }),
        ],
      },
      { userId: "max", total: 938, athletes: [line("m1", 938)] },
    ];

    // When zoe opens her head-to-head
    const view = await getManagerDuel(world({ scores })).execute({
      leagueId: "L",
      round: 1,
      home: "zoe",
    });

    // Then the middle-distance place holds z3 and her points, and says whom she replaced and why
    expect(view.bottom.cards[1]).toMatchObject({
      athleteId: "z3",
      name: "Athlète Z3",
      discipline: "800 m",
      mark: "2:01.30",
      points: 96,
      replaced: {
        reason: "forfeit",
        starterName: "Athlète Z2",
        starterMark: null,
        starterStatus: "dnf",
        threshold: null,
        gain: 96,
      },
    });
    expect(view.bottom.cards[0]).toMatchObject({
      athleteId: "z1",
      mark: "11.00",
      bonuses: [{ bonus: "first", points: 20 }],
      replaced: null,
    });
  });

  it("shows the opponent's view the other way round", async () => {
    const view = await getManagerDuel(world({ userId: "max" })).execute({
      leagueId: "L",
      round: 1,
      home: "zoe",
    });

    expect(view.top.participant.userId).toBe("zoe");
    expect(view.bottom.participant.userId).toBe("max");
    expect(view.outcome).toEqual({ outcome: "loss", points: 0 });
  });

  it("lets a member outside the head-to-head read it, the away player at the top", async () => {
    const view = await getManagerDuel(world({ userId: "ali" })).execute({
      leagueId: "L",
      round: 1,
      home: "zoe",
    });

    expect(view.mine).toBe(false);
    expect(view.top.participant.userId).toBe("max");
    expect(view.bottom.participant.userId).toBe("zoe");
    expect(view.outcome).toBeNull();
    expect(view.result).toBe("home");
  });

  it("shows the lineups without points while the competition is not scored", async () => {
    const view = await getManagerDuel(world({ scores: [] })).execute({
      leagueId: "L",
      round: 1,
      home: "zoe",
    });

    expect(view).toMatchObject({ locked: true, result: null, outcome: null });
    expect(view.bottom.score).toBeNull();
    expect(view.bottom.cards.map((c) => c?.points)).toEqual([null, null, undefined, undefined]);
  });

  it("keeps both lineups secret until the lock", async () => {
    // Given matchday 2 is not locked yet
    const view = await getManagerDuel(world()).execute({ leagueId: "L", round: 2, home: "max" });

    // Then no athlete is shown, on either side
    expect(view.locked).toBe(false);
    expect([...view.top.cards, ...view.bottom.cards]).toEqual(Array(8).fill(null));
    expect(view.bottom.home).toBe(false);
    expect(view.leg).toBe("return");
  });

  it("tells a player without a lineup at the lock", async () => {
    const view = await getManagerDuel(world({ locked: ["c1", "c2"] })).execute({
      leagueId: "L",
      round: 2,
      home: "max",
    });

    expect(view.locked).toBe(true);
    expect(view.top).toMatchObject({ participant: { userId: "max" }, linedUp: false });
    expect(view.top.cards).toEqual([null, null, null, null]);
    expect(view.bottom.linedUp).toBe(true);
  });

  it("refuses a head-to-head the matchday does not have, or a bonus matchday", async () => {
    const duel = getManagerDuel(world());
    await expect(duel.execute({ leagueId: "L", round: 1, home: "max" })).rejects.toEqual(
      new UseCaseError("MATCHDAY_NOT_FOUND"),
    );
    await expect(duel.execute({ leagueId: "L", round: 3, home: "zoe" })).rejects.toEqual(
      new UseCaseError("MATCHDAY_NOT_FOUND"),
    );
    await expect(duel.execute({ leagueId: "L", round: 9, home: "zoe" })).rejects.toEqual(
      new UseCaseError("MATCHDAY_NOT_FOUND"),
    );
  });

  it("refuses a league the player is not in", async () => {
    await expect(
      getManagerDuel(world()).execute({ leagueId: "X", round: 1, home: "zoe" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
    await expect(
      getManagerDuel(world({ member: false })).execute({ leagueId: "L", round: 1, home: "zoe" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
