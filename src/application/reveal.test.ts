import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { LeagueMember, LeagueRepository } from "./leagues";
import {
  listEventPredictions,
  revealFilter,
  type RevealedPrediction,
  type RevealRepository,
} from "./reveal";

const prediction = (userId: string, pseudo: string): RevealedPrediction => ({
  predictionId: `p-${userId}`,
  userId,
  pseudo,
  bib: { number: 7, color: "blue" },
  podium: { first: "a", second: "b", third: "c" },
  useJoker: false,
  reactions: [],
  flair: false,
});
const reveal = (locked: boolean, predictions: RevealedPrediction[]): RevealRepository => ({
  listForEvent: async () => ({ locked, predictions }),
});
const member = (userId: string): LeagueMember => ({
  userId,
  pseudo: userId,
  bib: { number: 7, color: "blue" },
});
const leagues = (
  members: LeagueMember[] | null | ((leagueId: string) => LeagueMember[] | null),
): LeagueRepository => ({
  create: async () => Promise.reject(new Error("unused")),
  addCompetition: async () => "added",
  addFamily: async () => "added",
  listPublic: async () => [],
  joinPublic: async () => ({ outcome: "unknown_code" }),
  inviteStatus: async () => "unknown",
  report: async () => "unknown",
  join: async () => ({ outcome: "unknown_code" }),
  listMine: async () => [],
  members: async (leagueId) => (typeof members === "function" ? members(leagueId) : members),
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

    expect(result.predictions.map((p) => p.pseudo)).toEqual(["ana", "Bob", "Zoé"]);
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
        { userId: "b", pseudo: "Bob", bib: { number: 7, color: "blue" } },
        { userId: "z", pseudo: "Zoé", bib: { number: 7, color: "blue" } },
      ]),
    }).execute({ eventId: "e1", leagueId: "l1" });

    expect(result.predictions.map((p) => p.userId)).toEqual(["b", "z"]);
  });

  it("refuses a league I am not in with LEAGUE_NOT_FOUND", async () => {
    await expect(
      listEventPredictions({ reveal: reveal(true, all), leagues: leagues(null) }).execute({
        eventId: "e1",
        leagueId: "l1",
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });

  it("puts the members of my leagues first and folds the other players' podiums", async () => {
    const result = await listEventPredictions({
      reveal: reveal(true, all),
      leagues: leagues((leagueId) =>
        leagueId === "l1" ? [member("me"), member("z")] : [member("b")],
      ),
    }).execute({ eventId: "e1", myLeagueIds: ["l1", "l2"] });

    expect(result.predictions.map((p) => p.userId)).toEqual(["b", "z"]);
    expect(result.others.map((p) => p.userId)).toEqual(["a"]);
  });

  it("folds nothing when I am in no league", async () => {
    const result = await listEventPredictions({
      reveal: reveal(true, all),
      leagues: leagues(null),
    }).execute({ eventId: "e1", myLeagueIds: [] });

    expect(result.predictions).toHaveLength(3);
    expect(result.others).toEqual([]);
  });

  it("folds nothing when I filter on one of my leagues", async () => {
    const result = await listEventPredictions({
      reveal: reveal(true, all),
      leagues: leagues([member("b")]),
    }).execute({ eventId: "e1", leagueId: "l1", myLeagueIds: ["l1", "l2"] });

    expect(result.predictions.map((p) => p.userId)).toEqual(["b"]);
    expect(result.others).toEqual([]);
  });

  it("shows at most 20 podiums unfiltered and folds the rest when I am in no league", async () => {
    const many = Array.from({ length: 23 }, (_, i) => prediction(`u${i}`, `p${100 + i}`));
    const result = await listEventPredictions({
      reveal: reveal(true, many),
      leagues: leagues(null),
    }).execute({ eventId: "e1", myLeagueIds: [] });

    expect(result.predictions.map((p) => p.pseudo)).toEqual(many.slice(0, 20).map((p) => p.pseudo));
    expect(result.others.map((p) => p.pseudo)).toEqual(["p120", "p121", "p122"]);
  });

  it("folds the members of my leagues past the first 20, before the other players", async () => {
    const friends = Array.from({ length: 21 }, (_, i) => prediction(`f${i}`, `f${100 + i}`));
    const result = await listEventPredictions({
      reveal: reveal(true, [prediction("x", "aaa"), ...friends]),
      leagues: leagues(friends.map((f) => member(f.userId))),
    }).execute({ eventId: "e1", myLeagueIds: ["l1"] });

    expect(result.predictions).toHaveLength(20);
    expect(result.others.map((p) => p.userId)).toEqual(["f20", "x"]);
  });
});

describe("revealFilter", () => {
  it("opens on my first league when I am in one and chose nothing", () => {
    expect(revealFilter(undefined, ["l1", "l2"])).toBe("l1");
  });

  it("opens on all the players when I am in no league", () => {
    expect(revealFilter(undefined, [])).toBeUndefined();
  });

  it("keeps the league or the all players view I chose", () => {
    expect(revealFilter("l2", ["l1", "l2"])).toBe("l2");
    expect(revealFilter("tous", ["l1", "l2"])).toBeUndefined();
  });
});
