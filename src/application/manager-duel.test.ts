import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";
import type { ManagerSeasonData, ManagerSeasonRepository } from "./manager-championship";
import { getManagerDuel, type DuelScore, type ManagerDuelRepository } from "./manager-duel";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";

const participant = (userId: string, number: number) => ({
  userId,
  pseudo: `Joueur ${userId}`,
  bib: { number, color: "blue" as const },
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
 * two places, one sprint and one free. Matchday 1 on c1 (locked, scored): zoe at home against max.
 * Matchday 2 on c2: not locked yet. Matchday 3 on c3: a bonus one.
 */
function world(
  options: { userId?: string; scores?: DuelScore[]; locked?: string[]; member?: boolean } = {},
) {
  const league = {
    id: "L",
    name: "Ligue des copains",
    rules: { lineup: { max: 2, minPerFamily: { sprint: 1 } } },
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
  // zoe lined up her middle-distance runner first: she still sits on the free place.
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
              predictions: 30,
              athletes: [
                { athleteId: "z1", total: 1100, bonusPoints: 20 },
                { athleteId: "z2", total: 0, bonusPoints: 0 },
              ],
            },
            {
              userId: "max",
              total: 950,
              predictions: 12,
              athletes: [{ athleteId: "m1", total: 938, bonusPoints: 0 }],
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
      locked: true,
      mine: true,
      places: ["sprint", "free"],
      outcome: { outcome: "win", points: 3 },
      result: "home",
    });
    expect(view.top).toMatchObject({
      participant: { userId: "max" },
      home: false,
      score: 950,
      predictions: 12,
      linedUp: true,
    });
    expect(view.bottom).toMatchObject({
      participant: { userId: "zoe" },
      home: true,
      score: 1130,
      predictions: 30,
    });
    expect(view.bottom.cards.map((c) => c && [c.athleteId, c.points, c.bonus])).toEqual([
      ["z1", 1100, 20],
      ["z2", 0, 0],
    ]);
    expect(view.top.cards.map((c) => c && [c.athleteId, c.family, c.points])).toEqual([
      ["m1", "sprint", 938],
      null,
    ]);
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
    expect(view.bottom.cards.map((c) => c?.points)).toEqual([null, null]);
  });

  it("keeps both lineups secret until the lock", async () => {
    // Given matchday 2 is not locked yet
    const view = await getManagerDuel(world()).execute({ leagueId: "L", round: 2, home: "max" });

    // Then no athlete is shown, on either side
    expect(view.locked).toBe(false);
    expect([...view.top.cards, ...view.bottom.cards]).toEqual([null, null, null, null]);
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
    expect(view.top.cards).toEqual([null, null]);
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
