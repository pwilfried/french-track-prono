import { describe, expect, it } from "vitest";

import type { ConsensusRepository } from "./consensus";
import { UseCaseError } from "./errors";
import {
  getEventLeagueJokers,
  getMyLeagueJokers,
  getSpyTrend,
  listNewLeagueJokers,
  playLeagueJoker,
  setJokerActive,
  type JokerOutcome,
  type LeagueJokerPlay,
  type LeagueJokerRepository,
} from "./league-jokers";

const ALL = ["double", "all_or_nothing", "safety_net", "spy", "outsider"];

/** A league « amis » with every joker, « club » with none; the plays as the database keeps them. */
function jokersOf(plays: LeagueJokerPlay[] = [], outcome: JokerOutcome = "done") {
  const calls: string[] = [];
  const repository: LeagueJokerRepository = {
    catalogue: async () => ALL.map((joker) => ({ joker, active: joker !== "outsider" })),
    setActive: async (_game, joker) => (joker === "unknown" ? "unknown" : "saved"),
    leagueJokers: async (leagueId) => (leagueId === "amis" ? [...ALL, "retired_kind"] : []),
    plays: async (leagueId) => (leagueId === "amis" ? plays : []),
    play: async (leagueId, eventId, joker) => {
      calls.push(`play ${leagueId} ${eventId} ${joker}`);
      return outcome;
    },
    remove: async (leagueId, eventId) => {
      calls.push(`remove ${leagueId} ${eventId}`);
      return outcome;
    },
  };
  return { repository, calls };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof UseCaseError) return error.code;
    throw error;
  }
};

describe("league jokers", () => {
  it("shows my jokers left and played in a league, without those of the others", async () => {
    // Given my Double on e1 and Bob's Spy on e2 in « amis »
    const { repository } = jokersOf([
      { userId: "me", eventId: "e1", joker: "double" },
      { userId: "bob", eventId: "e2", joker: "spy" },
    ]);

    // When I open the league
    const hand = await getMyLeagueJokers({ jokers: repository }).execute({
      leagueId: "amis",
      userId: "me",
    });

    // Then the Double is played on e1, the four others are left, an unknown kind is ignored
    expect(hand.used).toEqual([{ userId: "me", eventId: "e1", joker: "double" }]);
    expect(hand.remaining).toEqual(["all_or_nothing", "safety_net", "spy", "outsider"]);
  });

  it("plays a joker, or takes it back when none is chosen", async () => {
    const { repository, calls } = jokersOf();
    const play = playLeagueJoker({ jokers: repository });

    await play.execute({ leagueId: "amis", eventId: "e1", joker: "double" });
    await play.execute({ leagueId: "amis", eventId: "e1", joker: null });

    expect(calls).toEqual(["play amis e1 double", "remove amis e1"]);
  });

  it.each([
    ["not_available", "JOKER_NOT_AVAILABLE"],
    ["spy_spent", "JOKER_SPY_SPENT"],
    ["not_in_league", "JOKER_NOT_IN_LEAGUE"],
    ["locked", "JOKER_LOCKED"],
    ["not_member", "LEAGUE_NOT_FOUND"],
  ] as const)("turns the outcome %s into the code %s", async (outcome, code) => {
    const { repository } = jokersOf([], outcome);

    expect(
      await codeOf(
        playLeagueJoker({ jokers: repository }).execute({
          leagueId: "amis",
          eventId: "e1",
          joker: "safety_net",
        }),
      ),
    ).toBe(code);
  });

  it("shows my jokers of an event in each league that has some, a league without joker left out", async () => {
    const { repository } = jokersOf([{ userId: "me", eventId: "e1", joker: "outsider" }]);

    const leagues = await getEventLeagueJokers({ jokers: repository }).execute({
      userId: "me",
      leagueIds: ["amis", "club"],
      event: { id: "e1", open: true },
    });

    expect(leagues).toHaveLength(1);
    expect(leagues[0]).toMatchObject({
      leagueId: "amis",
      hand: { onEvent: "outsider", canChange: true },
    });
  });

  it("gives a new league the active jokers of its game only", async () => {
    const { repository } = jokersOf();

    expect(
      await listNewLeagueJokers({ jokers: repository }).execute({ game: "predictions" }),
    ).toEqual(["double", "all_or_nothing", "safety_net", "spy"]);
  });

  it("refuses to turn on a joker the catalogue does not know", async () => {
    const { repository } = jokersOf();
    const notAdmin = { setActive: async () => "not_admin" as const };

    expect(
      await codeOf(
        setJokerActive({ jokers: repository }).execute({
          game: "predictions",
          joker: "unknown",
          active: true,
        }),
      ),
    ).toBe("JOKERS_UNAVAILABLE");
    expect(
      await codeOf(
        setJokerActive({ jokers: notAdmin }).execute({
          game: "predictions",
          joker: "spy",
          active: false,
        }),
      ),
    ).toBe("NOT_ADMIN");
  });

  it("shows the spy the trend of the league's members on the event", async () => {
    const consensus: ConsensusRepository = {
      podiums: async (_eventId, leagueId) =>
        leagueId === "amis"
          ? [
              { podium: { first: "a", second: "b", third: "c" }, mine: false },
              { podium: { first: "a", second: "c", third: "b" }, mine: true },
            ]
          : [],
    };

    const trend = await getSpyTrend({ consensus }).execute({ leagueId: "amis", eventId: "e1" });

    expect(trend.total).toBe(2);
    expect(trend.places.first[0]).toMatchObject({ athleteId: "a", percent: 100 });
  });
});
