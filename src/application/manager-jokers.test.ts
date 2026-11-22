import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  coachManagerLineup,
  getMyManagerJokers,
  playManagerJoker,
  removeManagerJoker,
  type JokerDuel,
  type ManagerJokerOutcome,
  type ManagerJokerPlayRow,
  type ManagerJokerRepository,
} from "./manager-jokers";

const JOKERS = ["captain", "false_start", "extended_bench", "coaching", "home_advantage"];

const row = (over: Partial<ManagerJokerPlayRow>): ManagerJokerPlayRow => ({
  userId: "zoe",
  competitionId: "c1",
  kind: "captain",
  athleteId: "z1",
  discipline: null,
  replacedId: null,
  coached: false,
  ...over,
});

/** Zoé at home against Max on c1; the plays as the database shows them to her. */
function jokersOf(
  plays: ManagerJokerPlayRow[],
  options: { duel?: JokerDuel | null | "not_member"; outcome?: ManagerJokerOutcome } = {},
) {
  const calls: unknown[][] = [];
  const duel: JokerDuel = {
    home: true,
    opponentId: "max",
    opponentTeam: [{ athleteId: "m1", name: "Mia Fictive" }],
  };
  const outcome = options.outcome ?? "done";
  const jokers: ManagerJokerRepository = {
    leagueJokers: async () => [...JOKERS, "retired_joker"],
    plays: async () => plays,
    duel: async () => (options.duel === undefined ? duel : options.duel),
    play: async (...args) => (calls.push(["play", ...args]), outcome),
    remove: async (...args) => (calls.push(["remove", ...args]), outcome),
    coach: async (...args) => (calls.push(["coach", ...args]), outcome),
  };
  return { ports: { jokers, userId: "zoe" }, calls };
}

describe("the Manager jokers of a matchday", () => {
  it("shows the hand, the joker chosen with the lineup and the opponent's team to aim at", async () => {
    // Given Zoé made Z1 her captain on c1 and played the false start on c2; Max's joker on c1
    const { ports } = jokersOf([
      row({}),
      row({ competitionId: "c2", kind: "false_start", athleteId: "m1" }),
      row({ userId: "max", kind: "home_advantage", athleteId: null }),
    ]);

    // When she opens her lineup of c1
    const seen = await getMyManagerJokers(ports).execute({ leagueId: "L", competitionId: "c1" });

    // Then she sees her captain, the jokers left (a joker unknown to the code is not shown) and
    // Max's joker, which the database only shows once locked
    expect(seen.mine).toMatchObject({ kind: "captain", athleteId: "z1" });
    expect(seen.hand).toMatchObject({
      remaining: ["extended_bench", "coaching", "home_advantage"],
      onMatchday: "captain",
    });
    expect(seen.opponent).toMatchObject({ userId: "max", kind: "home_advantage" });
    expect(seen.duel?.opponentTeam).toEqual([{ athleteId: "m1", name: "Mia Fictive" }]);
  });

  it("has no duel nor opponent's joker on a bonus matchday", async () => {
    const { ports } = jokersOf([], { duel: null });
    const seen = await getMyManagerJokers(ports).execute({ leagueId: "L", competitionId: "c3" });
    expect(seen).toMatchObject({ duel: null, mine: null, opponent: null });
  });

  it("tells a player outside the league", async () => {
    const { ports } = jokersOf([], { duel: "not_member" });
    await expect(
      getMyManagerJokers(ports).execute({ leagueId: "L", competitionId: "c1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });

  it("plays, takes back and coaches through the database", async () => {
    const { ports, calls } = jokersOf([]);
    await playManagerJoker(ports).execute({
      leagueId: "L",
      competitionId: "c1",
      kind: "false_start",
      athleteId: "m1",
    });
    await removeManagerJoker(ports).execute({ leagueId: "L", competitionId: "c1" });
    await coachManagerLineup(ports).execute({
      leagueId: "L",
      competitionId: "c1",
      outId: "z1",
      inId: "z2",
    });
    expect(calls).toEqual([
      ["play", "L", "c1", "false_start", "m1"],
      ["remove", "L", "c1"],
      ["coach", "L", "c1", "z1", "z2"],
    ]);
  });

  it.each([
    ["locked", "LINEUP_LOCKED"],
    ["not_available", "JOKER_NOT_AVAILABLE"],
    ["no_duel", "MANAGER_JOKER_NO_DUEL"],
    ["away", "MANAGER_JOKER_AWAY"],
    ["bad_target", "MANAGER_JOKER_BAD_TARGET"],
    ["no_coaching", "MANAGER_JOKER_NO_COACHING"],
    ["not_member", "LEAGUE_NOT_FOUND"],
  ] as const)("turns the refusal « %s » into the code %s", async (outcome, code) => {
    const { ports } = jokersOf([], { outcome });
    await expect(
      playManagerJoker(ports).execute({
        leagueId: "L",
        competitionId: "c1",
        kind: "home_advantage",
        athleteId: null,
      }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});
