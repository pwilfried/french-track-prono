import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { LeagueMember, LeagueRepository } from "./leagues";
import {
  getGeneralRanking,
  countsInLeague,
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
const ranking = (
  lines: RankingLine[],
  byCompetition?: Record<string, RankingLine[]>,
): RankingRepository => ({
  competitionLines: async (slug) => byCompetition?.[slug] ?? lines,
});
const leagues = (members: LeagueMember[] | null): LeagueRepository => ({
  create: async () => Promise.reject(new Error("unused")),
  addCompetition: async () => "added",
  listPublic: async () => [],
  joinPublic: async () => ({ outcome: "unknown_code" }),
  report: async () => "unknown",
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
    }).execute({ competitionSlugs: ["c"] });

    expect(result.map((r) => [r.userId, r.change, r.streak])).toEqual([
      ["bob", 1, 2],
      ["ana", -1, 0],
    ]);
  });

  it("ranks all the players of the competition on their total", async () => {
    const result = await getGeneralRanking({
      ranking: ranking([line("ana", 12, true), line("bob", 20), line("ana", 10)]),
    }).execute({ competitionSlugs: ["c"] });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "ANA", 22],
      [2, "BOB", 20],
    ]);
  });
});

describe("getGeneralRanking over several competitions", () => {
  it("adds up the points of every competition given", async () => {
    const result = await getGeneralRanking({
      ranking: ranking([], { a: [line("ana", 12), line("bob", 5)], b: [line("bob", 9)] }),
    }).execute({ competitionSlugs: ["a", "b"] });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "BOB", 14],
      [2, "ANA", 12],
    ]);
  });
});

describe("getLeagueRanking", () => {
  it("ranks only the members, including a member without points", async () => {
    const result = await getLeagueRanking({
      ranking: ranking([line("ana", 12), line("stranger", 50)]),
      leagues: leagues([member("ana"), member("bob")]),
    }).execute({ leagueId: "l1", competitionSlugs: ["c"] });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "ANA", 12],
      [2, "BOB", 0],
    ]);
  });

  it("adds up the points of all the league's competitions", async () => {
    const result = await getLeagueRanking({
      ranking: ranking([], {
        a: [line("ana", 12, false, "a1"), line("bob", 5, false, "a1")],
        b: [line("bob", 10, false, "b1", "2026-12-01T19:00:00.000Z")],
      }),
      leagues: leagues([member("ana"), member("bob")]),
    }).execute({ leagueId: "l1", competitionSlugs: ["a", "b"] });

    expect(result.map((p) => [p.rank, p.pseudo, p.points])).toEqual([
      [1, "BOB", 15],
      [2, "ANA", 12],
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
      competitionSlugs: ["c"],
    });
    const seenByBob = await getLeagueRanking({
      ranking: ranking([...lines].reverse()),
      leagues: leagues([...members].reverse()),
    }).execute({ leagueId: "l1", competitionSlugs: ["c"] });

    expect(seenByBob).toEqual(seenByAna);
  });

  it("refuses a player who is not a member with LEAGUE_NOT_FOUND", async () => {
    await expect(
      getLeagueRanking({ ranking: ranking([]), leagues: leagues(null) }).execute({
        leagueId: "l1",
        competitionSlugs: ["c"],
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});

describe("a league counts only the predictions made as a member (#376)", () => {
  const at = (iso: string, l: RankingLine): RankingLine => ({ ...l, eventLockAt: iso });

  it("leaves out an event locked before the player joined", async () => {
    // given Ana in the league since the start, Bob who joined on 10 Nov
    const members = [
      { ...member("ana"), joinedAt: "2026-11-01T00:00:00.000Z" },
      { ...member("bob"), joinedAt: "2026-11-10T00:00:00.000Z" },
    ];
    // when both scored on an event locked on 5 Nov and on one locked on 12 Nov
    const lines = [
      at("2026-11-05T18:00:00.000Z", line("ana", 10)),
      at("2026-11-05T18:00:00.000Z", line("bob", 12)),
      at("2026-11-12T18:00:00.000Z", line("ana", 3)),
      at("2026-11-12T18:00:00.000Z", line("bob", 4)),
    ];
    const result = await getLeagueRanking({
      ranking: ranking(lines),
      leagues: leagues(members),
    }).execute({ leagueId: "l", competitionSlugs: ["c"] });
    // then Bob's 12 points from before he joined do not count in this league
    expect(result.map((r) => [r.pseudo, r.points])).toEqual([
      ["ANA", 13],
      ["BOB", 4],
    ]);
  });

  it("counts an event when a date is unknown", () => {
    expect(countsInLeague(undefined, "2026-11-05T18:00:00.000Z")).toBe(true);
    expect(countsInLeague("2026-11-10T00:00:00.000Z", undefined)).toBe(true);
    expect(countsInLeague("2026-11-10T00:00:00.000Z", "2026-11-10T00:00:00.000Z")).toBe(true);
  });

  it("gives the same ranking whatever the order of the score lines", async () => {
    const members = [
      { ...member("ana"), joinedAt: "2026-11-01T00:00:00.000Z" },
      { ...member("bob"), joinedAt: "2026-11-10T00:00:00.000Z" },
    ];
    const lines = [
      at("2026-11-05T18:00:00.000Z", line("bob", 12)),
      at("2026-11-12T18:00:00.000Z", line("ana", 3)),
      at("2026-11-12T18:00:00.000Z", line("bob", 4)),
      at("2026-11-13T18:00:00.000Z", line("ana", 7)),
    ];
    const rank = (ls: RankingLine[]) =>
      getLeagueRanking({ ranking: ranking(ls), leagues: leagues(members) })
        .execute({ leagueId: "l", competitionSlugs: ["c"] })
        .then((rows) => rows.map((r) => [r.userId, r.points, r.rank]));
    const expected = await rank(lines);
    await fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray(lines, { minLength: lines.length }),
        async (shuffled) => {
          expect(await rank(shuffled)).toEqual(expected);
        },
      ),
    );
  });
});
