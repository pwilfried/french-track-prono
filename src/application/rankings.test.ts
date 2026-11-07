import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { LeagueMember, LeagueRepository } from "./leagues";
import {
  getGeneralRanking,
  getLeagueRanking,
  type RankingLine,
  type RankingRepository,
} from "./rankings";

const line = (
  userId: string,
  points: number,
  perfect = false,
  eventId = "e1",
  eventStartsAt = "2026-11-23T19:00:00.000Z",
): RankingLine => ({
  userId,
  pseudo: userId.toUpperCase(),
  avatar: "🦅",
  points,
  reasons: perfect ? [{ kind: "perfect_podium" }] : [],
  eventId,
  eventStartsAt,
});
const ranking = (lines: RankingLine[]): RankingRepository => ({
  competitionLines: async () => lines,
});
const leagues = (members: LeagueMember[] | null): LeagueRepository => ({
  create: async () => Promise.reject(new Error("unused")),
  join: async () => ({ outcome: "unknown_code" }),
  listMine: async () => [],
  members: async () => members,
  leave: async () => "left",
  handOver: async () => "done",
});
const member = (userId: string): LeagueMember => ({
  userId,
  pseudo: userId.toUpperCase(),
  avatar: "🦅",
});

describe("getGeneralRanking", () => {
  it("tells how many places each player won or lost with the last computed event", async () => {
    const result = await getGeneralRanking({
      ranking: ranking([
        line("ana", 10),
        line("bob", 5),
        line("bob", 9, false, "e2", "2026-11-24T19:00:00.000Z"),
      ]),
    }).execute({ competitionSlug: "c" });

    expect(result.map((r) => [r.userId, r.change])).toEqual([
      ["bob", 1],
      ["ana", -1],
    ]);
  });

  it("ranks all the players of the competition on their total", async () => {
    const result = await getGeneralRanking({
      ranking: ranking([line("ana", 12, true), line("bob", 20), line("ana", 10)]),
    }).execute({ competitionSlug: "c" });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "ANA", 22],
      [2, "BOB", 20],
    ]);
  });
});

describe("getLeagueRanking", () => {
  it("ranks only the members, including a member without points", async () => {
    const result = await getLeagueRanking({
      ranking: ranking([line("ana", 12), line("stranger", 50)]),
      leagues: leagues([member("ana"), member("bob")]),
    }).execute({ leagueId: "l1", competitionSlug: "c" });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "ANA", 12],
      [2, "BOB", 0],
    ]);
  });

  it("gives two members the same ranking", async () => {
    const lines = [line("ana", 12), line("bob", 12, true)];
    const members = [member("ana"), member("bob")];
    const seenByAna = await getLeagueRanking({
      ranking: ranking(lines),
      leagues: leagues(members),
    }).execute({
      leagueId: "l1",
      competitionSlug: "c",
    });
    const seenByBob = await getLeagueRanking({
      ranking: ranking([...lines].reverse()),
      leagues: leagues([...members].reverse()),
    }).execute({ leagueId: "l1", competitionSlug: "c" });

    expect(seenByBob).toEqual(seenByAna);
  });

  it("refuses a player who is not a member with LEAGUE_NOT_FOUND", async () => {
    await expect(
      getLeagueRanking({ ranking: ranking([]), leagues: leagues(null) }).execute({
        leagueId: "l1",
        competitionSlug: "c",
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
