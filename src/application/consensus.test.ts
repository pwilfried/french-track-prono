import { describe, expect, it } from "vitest";

import type { ConsensusPodium } from "@/domain/consensus";

import { getEventConsensus, type ConsensusRepository } from "./consensus";
import { UseCaseError } from "./errors";

const podium = (first: string, second: string, mine = false): ConsensusPodium => ({
  podium: { first, second, third: "c" },
  mine,
});

const field = [
  { userId: "me", ...podium("a", "b", true) },
  { userId: "zoe", ...podium("a", "b") },
  { userId: "bob", ...podium("b", "a") },
];
const leagues: Record<string, string[]> = { friends: ["me", "zoe"], club: ["me", "bob"] };

const repository = (locked: boolean): ConsensusRepository => ({
  podiums: async (eventId, leagueId) => {
    if (!locked || eventId !== "e1") throw new UseCaseError("EVENT_NOT_LOCKED");
    if (leagueId === undefined) return field;
    const members = leagues[leagueId];
    if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
    return field.filter((p) => members.includes(p.userId));
  },
});

describe("getEventConsensus", () => {
  it("shows what everyone predicted once the event is locked, with my choice marked", async () => {
    // given a locked event predicted by three players, me included
    const useCase = getEventConsensus({ consensus: repository(true) });

    // when I open the consensus of all the players
    const result = await useCase.execute({ eventId: "e1", leagueIds: ["friends", "club"] });

    // then every podium counts, and each of my leagues says how many of its members predicted
    expect(result.consensus.total).toBe(3);
    expect(result.consensus.places.first[0]).toEqual({
      athleteId: "a",
      count: 2,
      percent: 67,
      mine: true,
    });
    expect(result.counts).toEqual({ all: 3, leagues: { friends: 2, club: 2 } });
  });

  it("shows only the members of the league I chose", async () => {
    const useCase = getEventConsensus({ consensus: repository(true) });

    const result = await useCase.execute({
      eventId: "e1",
      leagueId: "friends",
      leagueIds: ["friends", "club"],
    });

    expect(result.consensus.total).toBe(2);
    expect(result.consensus.samePodium).toEqual({ count: 2, percent: 100 });
  });

  it("adds the share of perfect podiums once the result is in", async () => {
    const useCase = getEventConsensus({ consensus: repository(true) });

    const result = await useCase.execute({
      eventId: "e1",
      leagueIds: [],
      official: [
        { athleteId: "b", rank: 1 },
        { athleteId: "a", rank: 2 },
        { athleteId: "c", rank: 3 },
      ],
    });

    expect(result.consensus.perfect).toEqual({ count: 1, percent: 33 });
  });

  it("refuses before the lock, so that nothing influences a prediction", async () => {
    const useCase = getEventConsensus({ consensus: repository(false) });

    await expect(useCase.execute({ eventId: "e1", leagueIds: [] })).rejects.toEqual(
      new UseCaseError("EVENT_NOT_LOCKED"),
    );
  });

  it("refuses a league I am not a member of", async () => {
    const useCase = getEventConsensus({ consensus: repository(true) });

    await expect(
      useCase.execute({ eventId: "e1", leagueId: "other", leagueIds: [] }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
