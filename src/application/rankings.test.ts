import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { LeagueMember, LeagueRepository } from "./leagues";
import {
  getGeneralRanking,
  getClubRanking,
  countsInLeague,
  getLeagueRanking,
  getTonightRanking,
  standingIn,
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
  bib: { number: 7, color: "blue" },
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
  bib: { number: 7, color: "blue" },
});

describe("getGeneralRanking", () => {
  it("tells how many places each player won or lost since yesterday", async () => {
    // given Ana ahead after the 23rd, Bob scoring on the evening of the 24th
    const lines = [
      line("ana", 10),
      line("bob", 5),
      line("bob", 9, false, "e2", "2026-11-24T19:00:00.000Z"),
    ];
    // when the ranking is read on the 24th
    const result = await getGeneralRanking({ ranking: ranking(lines) }).execute({
      competitionSlugs: ["c"],
      today: "2026-11-24",
    });
    // then Bob went up one place and Ana down one
    expect(result.map((r) => [r.userId, r.change])).toEqual([
      ["bob", 1],
      ["ana", -1],
    ]);
  });

  it("shows no move without a competition day", async () => {
    const result = await getGeneralRanking({
      ranking: ranking([line("ana", 10), line("bob", 9, false, "e2", "2026-11-24T19:00:00.000Z")]),
    }).execute({ competitionSlugs: ["c"] });

    expect(result.map((r) => r.change)).toEqual([null, null]);
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

describe("getTonightRanking", () => {
  it("ranks the players on the points of tonight's events only", async () => {
    // given Ana far ahead yesterday, Bob and Cid scoring tonight (Cid after midnight in Paris)
    const lines = [
      line("ana", 40, false, "e1", "2026-11-23T19:00:00.000Z"),
      line("bob", 5, false, "e2", "2026-11-24T19:00:00.000Z"),
      line("cid", 8, false, "e3", "2026-11-25T00:15:00.000Z"),
      line("bob", 3, false, "e3", "2026-11-25T00:15:00.000Z"),
    ];
    // when « Ce soir » is read on the 24th
    const result = await getTonightRanking({ ranking: ranking(lines) }).execute({
      competitionSlugs: ["c"],
      today: "2026-11-24",
    });
    // then only tonight's points count, and nobody moves
    expect(result.map((r) => [r.rank, r.userId, r.points, r.change])).toEqual([
      [1, "bob", 8, null],
      [1, "cid", 8, null],
    ]);
  });

  it("is empty on a day without events", async () => {
    const result = await getTonightRanking({ ranking: ranking([line("ana", 40)]) }).execute({
      competitionSlugs: ["c"],
      today: "2026-11-30",
    });

    expect(result).toEqual([]);
  });
});

describe("getLeagueRanking", () => {
  it("moves a member without points down when another member scores today", async () => {
    const result = await getLeagueRanking({
      ranking: ranking([
        line("ana", 2, false, "e1", "2026-11-23T19:00:00.000Z"),
        line("bob", 7, false, "e2", "2026-11-24T19:00:00.000Z"),
      ]),
      leagues: leagues([member("ana"), member("bob"), member("zoe")]),
    }).execute({ leagueId: "l1", competitionSlugs: ["c"], today: "2026-11-24" });

    expect(result.map((r) => [r.userId, r.rank, r.change])).toEqual([
      ["bob", 1, 1],
      ["ana", 2, -1],
      ["zoe", 3, -1],
    ]);
  });

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

describe("getClubRanking", () => {
  const inClub = (userId: string, points: number, clubId: string | null): RankingLine => ({
    ...line(userId, points),
    ...(clubId ? { clubId, club: `Club ${clubId}` } : {}),
  });

  it("adds up each player's points over the competitions, then averages them per club", async () => {
    const result = await getClubRanking({
      ranking: ranking([], {
        c1: [inClub("a", 10, "x"), inClub("b", 4, "x"), inClub("c", 1, "x"), inClub("d", 9, null)],
        c2: [inClub("a", 5, "x"), inClub("e", 50, "y")],
      }),
    }).execute({ competitionSlugs: ["c1", "c2"] });

    // Club x: (15 + 4 + 1) / 3; club y has a single player and is not ranked.
    expect(result).toEqual([{ clubId: "x", name: "Club x", players: 3, average: 6.7, rank: 1 }]);
  });
});

describe("standingIn (#552)", () => {
  it("gives the player's place and movement in a league ranking", async () => {
    const rows = await getLeagueRanking({
      ranking: ranking([
        line("ana", 10),
        line("bob", 5),
        line("bob", 9, false, "e2", "2026-11-24T19:00:00.000Z"),
      ]),
      leagues: leagues([member("ana"), member("bob")]),
    }).execute({ leagueId: "l1", competitionSlugs: ["c1"], today: "2026-11-24" });
    // Bob was 2nd yesterday, 1st after tonight's event.
    expect(standingIn(rows, "bob")).toEqual({ rank: 1, change: 1 });
    expect(standingIn(rows, "ana")).toEqual({ rank: 2, change: -1 });
  });

  it("gives no place to a player without points yet, nor to a stranger", async () => {
    const rows = await getLeagueRanking({
      ranking: ranking([line("ana", 10)]),
      leagues: leagues([member("ana"), member("bob")]),
    }).execute({ leagueId: "l1", competitionSlugs: ["c1"] });
    expect(standingIn(rows, "bob")).toBeNull();
    expect(standingIn(rows, "zoe")).toBeNull();
  });
});
