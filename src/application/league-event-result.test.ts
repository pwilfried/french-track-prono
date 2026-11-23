import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import { getLeagueEventResult } from "./league-event-result";
import type { LeagueJokerPlay } from "./league-jokers";
import type { LeagueMember, LeagueRepository } from "./leagues";
import type { RevealedPrediction } from "./reveal";

const bib = { number: 7, color: "blue" } as const;
const prediction = (userId: string, score: RevealedPrediction["score"]): RevealedPrediction => ({
  predictionId: `p-${userId}`,
  userId,
  pseudo: userId,
  bib,
  podium: { first: "a", second: "b", third: "c" },
  reactions: [],
  score,
});
const member = (userId: string, countedEvents = ["e1"]): LeagueMember => ({
  userId,
  pseudo: userId,
  bib,
  countedEvents,
});
const leagues = (members: LeagueMember[] | null) =>
  ({ members: async () => members }) as unknown as LeagueRepository;

function world(input: {
  locked?: boolean;
  predictions: RevealedPrediction[];
  members: LeagueMember[] | null;
  plays?: LeagueJokerPlay[];
}) {
  return getLeagueEventResult({
    reveal: {
      listForEvent: async () => ({
        locked: input.locked ?? true,
        predictions: input.predictions,
      }),
    },
    leagues: leagues(input.members),
    jokers: { plays: async () => input.plays ?? [] },
  });
}

describe("getLeagueEventResult", () => {
  it("ranks every member's prediction by their points in the league, the joker counted", async () => {
    // Given three members: Bob doubles his 5 points, Ana and Zoé made 7.
    const result = await world({
      predictions: [
        prediction("zoe", { points: 7, reasons: [] }),
        prediction("bob", { points: 5, reasons: [], jokers: { double: 10 } }),
        prediction("ana", { points: 7, reasons: [] }),
      ],
      members: [member("ana"), member("bob"), member("zoe")],
      plays: [
        { userId: "bob", eventId: "e1", joker: "double" },
        { userId: "ana", eventId: "e2", joker: "double" },
      ],
    }).execute({ leagueId: "l1", eventId: "e1" });

    // Then Bob leads with 10; Ana and Zoé share the 2nd place, by pseudo.
    expect(result.lines.map((l) => [l.userId, l.rank, l.points, l.joker])).toEqual([
      ["bob", 1, 10, "double"],
      ["ana", 2, 7, null],
      ["zoe", 2, 7, null],
    ]);
    expect(result.without).toEqual([]);
  });

  it("puts the members without a prediction in the league apart, and the unscored last", async () => {
    // Given Eve did not predict, Max did not add his podium to the league, Léa is not scored yet.
    const result = await world({
      predictions: [
        prediction("lea", null),
        prediction("max", { points: 9, reasons: [] }),
        prediction("ana", { points: 3, reasons: [] }),
      ],
      members: [member("ana"), member("eve"), member("lea"), member("max", [])],
    }).execute({ leagueId: "l1", eventId: "e1" });

    expect(result.lines.map((l) => [l.userId, l.rank])).toEqual([
      ["ana", 1],
      ["lea", null],
    ]);
    expect(result.without.map((m) => m.userId)).toEqual(["eve", "max"]);
  });

  it("refuses before the lock, as the reveal", async () => {
    await expect(
      world({ locked: false, predictions: [], members: [member("ana")] }).execute({
        leagueId: "l1",
        eventId: "e1",
      }),
    ).rejects.toEqual(new UseCaseError("EVENT_NOT_LOCKED"));
  });

  it("refuses a league I cannot see with LEAGUE_NOT_FOUND", async () => {
    await expect(
      world({ predictions: [], members: null }).execute({ leagueId: "l1", eventId: "e1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
