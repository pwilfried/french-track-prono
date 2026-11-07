import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { LeagueMember, LeagueRepository } from "./leagues";
import { listEventPredictions, type RevealedPrediction, type RevealRepository } from "./reveal";

const prediction = (userId: string, pseudo: string): RevealedPrediction => ({
  predictionId: `p-${userId}`,
  userId,
  pseudo,
  avatar: "🦅",
  podium: { first: "a", second: "b", third: "c" },
  useJoker: false,
  reactions: [],
});
const reveal = (locked: boolean, predictions: RevealedPrediction[]): RevealRepository => ({
  listForEvent: async () => ({ locked, predictions }),
});
const leagues = (members: LeagueMember[] | null): LeagueRepository => ({
  create: async () => Promise.reject(new Error("unused")),
  join: async () => ({ outcome: "unknown_code" }),
  listMine: async () => [],
  members: async () => members,
  leave: async () => "left",
  handOver: async () => "done",
});
const all = [prediction("z", "Zoé"), prediction("a", "ana"), prediction("b", "Bob")];

describe("listEventPredictions", () => {
  it("reveals everyone's podium after the lock, by pseudo", async () => {
    const result = await listEventPredictions({
      reveal: reveal(true, all),
      leagues: leagues(null),
    }).execute({
      eventId: "e1",
    });

    expect(result.map((p) => p.pseudo)).toEqual(["ana", "Bob", "Zoé"]);
  });

  it("refuses before the lock with EVENT_NOT_LOCKED", async () => {
    await expect(
      listEventPredictions({ reveal: reveal(false, []), leagues: leagues(null) }).execute({
        eventId: "e1",
      }),
    ).rejects.toEqual(new UseCaseError("EVENT_NOT_LOCKED"));
  });

  it("keeps only the members of my league when I filter on it", async () => {
    const result = await listEventPredictions({
      reveal: reveal(true, all),
      leagues: leagues([
        { userId: "b", pseudo: "Bob", avatar: "🦅" },
        { userId: "z", pseudo: "Zoé", avatar: "🦅" },
      ]),
    }).execute({ eventId: "e1", leagueId: "l1" });

    expect(result.map((p) => p.userId)).toEqual(["b", "z"]);
  });

  it("refuses a league I am not in with LEAGUE_NOT_FOUND", async () => {
    await expect(
      listEventPredictions({ reveal: reveal(true, all), leagues: leagues(null) }).execute({
        eventId: "e1",
        leagueId: "l1",
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
