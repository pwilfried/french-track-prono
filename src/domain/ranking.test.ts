import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  aroundMe,
  linesOfDay,
  movesSinceCompetitions,
  movesSinceYesterday,
  placeOf,
  previousCompetitionSlugs,
  rankPlayers,
  totalsOf,
  type PlayerTotals,
} from "./ranking";

const player = (
  pseudo: string,
  points: number,
  perfectPodiums = 0,
  winnersFound = 0,
): PlayerTotals => ({
  userId: pseudo.toLowerCase(),
  pseudo,
  points,
  perfectPodiums,
  winnersFound,
});
const order = (players: PlayerTotals[]) => rankPlayers(players).map((p) => [p.rank, p.pseudo]);

describe("rankPlayers", () => {
  it("ranks by points first", () => {
    expect(order([player("Ana", 10), player("Bob", 30), player("Cleo", 20)])).toEqual([
      [1, "Bob"],
      [2, "Cleo"],
      [3, "Ana"],
    ]);
  });

  it("breaks a tie on points with the perfect podiums (R9)", () => {
    expect(order([player("Ana", 20, 0, 3), player("Bob", 20, 1, 0)])).toEqual([
      [1, "Bob"],
      [2, "Ana"],
    ]);
  });

  it("then with the winners found (R9)", () => {
    expect(order([player("Ana", 20, 1, 1), player("Bob", 20, 1, 2)])).toEqual([
      [1, "Bob"],
      [2, "Ana"],
    ]);
  });

  it("gives players still equal the same rank, listed by pseudo, and skips the next rank", () => {
    expect(
      order([
        player("Zoé", 20, 1, 1),
        player("Ana", 30),
        player("élodie", 20, 1, 1),
        player("Max", 5),
      ]),
    ).toEqual([
      [1, "Ana"],
      [2, "élodie"],
      [2, "Zoé"],
      [4, "Max"],
    ]);
  });

  it("ranks nobody when there is nobody", () => {
    expect(rankPlayers([])).toEqual([]);
  });

  const players = fc.uniqueArray(
    fc.record({
      userId: fc.uuid(),
      pseudo: fc.constantFrom("Ana", "Bob", "Cleo", "Dan", "Eve"),
      points: fc.nat({ max: 40 }),
      perfectPodiums: fc.nat({ max: 3 }),
      winnersFound: fc.nat({ max: 3 }),
    }),
    { selector: (p) => p.userId, maxLength: 20 },
  );

  it("never depends on the order the players arrive in", () => {
    fc.assert(
      fc.property(players, fc.infiniteStream(fc.nat()), (list, noise) => {
        const shuffled = [...list].sort(() => (noise.next().value % 3) - 1);
        expect(rankPlayers(shuffled)).toEqual(rankPlayers(list));
      }),
    );
  });

  it("gives the same ranking when run again", () => {
    fc.assert(
      fc.property(players, (list) => {
        const once = rankPlayers(list);
        const again = once.map((p): PlayerTotals => ({ ...p, rank: undefined }) as PlayerTotals);
        expect(rankPlayers(again)).toEqual(once);
      }),
    );
  });
});

describe("totalsOf", () => {
  it("adds up the points, perfect podiums and winners found of each player", () => {
    const totals = totalsOf(
      [
        {
          userId: "a",
          points: 24,
          reasons: [{ kind: "exact", slot: 1 }, { kind: "perfect_podium" }],
        },
        { userId: "a", points: 3, reasons: [{ kind: "exact", slot: 1 }] },
        { userId: "b", points: 1, reasons: [{ kind: "on_podium", slot: 1 }] },
      ],
      (id) => id.toUpperCase(),
    );

    expect(totals).toEqual([
      { userId: "a", pseudo: "A", points: 27, perfectPodiums: 1, winnersFound: 2 },
      { userId: "b", pseudo: "B", points: 1, perfectPodiums: 0, winnersFound: 0 },
    ]);
  });
});

describe("movesSinceYesterday", () => {
  const line = (userId: string, eventId: string, startsAt: string, points: number) => ({
    userId,
    eventId,
    eventStartsAt: startsAt,
    points,
    reasons: [],
  });
  // 23 and 24 Nov, evening in Paris (UTC+1).
  const day1 = "2026-11-23T19:00:00Z";
  const day2 = "2026-11-24T19:00:00Z";

  it("compares each player's place with the ranking at the end of the day before", () => {
    const lines = [
      line("ana", "e1", day1, 10),
      line("bob", "e1", day1, 5),
      line("cid", "e1", day1, 3),
      line("bob", "e2", day2, 12),
      line("cid", "e2", day2, 1),
    ];

    const moves = movesSinceYesterday(lines, (id) => id, "2026-11-24");

    expect(moves.get("bob")).toBe(1); // 2nd → 1st
    expect(moves.get("ana")).toBe(-1); // 1st → 2nd
    expect(moves.get("cid")).toBe(0);
  });

  it("counts every event of the day as one move, however many were computed", () => {
    const lines = [
      line("ana", "e1", day1, 10),
      line("bob", "e1", day1, 5),
      line("bob", "e2", "2026-11-24T17:00:00Z", 3),
      line("bob", "e3", day2, 3),
    ];

    expect(movesSinceYesterday(lines, (id) => id, "2026-11-24").get("bob")).toBe(1);
  });

  it("gives 0 to everyone once a day has passed without event: nobody moved since yesterday", () => {
    const lines = [line("ana", "e1", day1, 10), line("bob", "e2", day2, 12)];

    const moves = movesSinceYesterday(lines, (id) => id, "2026-11-26");

    expect([...moves.values()]).toEqual([0, 0]);
  });

  it("gives null to a player who was not ranked yesterday, and to everyone on the first day", () => {
    expect(
      movesSinceYesterday([line("ana", "e1", day1, 3)], (id) => id, "2026-11-23").get("ana"),
    ).toBeNull();
    const moves = movesSinceYesterday(
      [line("ana", "e1", day1, 3), line("dan", "e2", day2, 9)],
      (id) => id,
      "2026-11-24",
    );
    expect(moves.get("dan")).toBeNull();
    expect(moves.get("ana")).toBe(-1);
  });

  it("ranks a player without any event (a league member at 0) on both days", () => {
    const lines = [line("zoe", "", "", 0), line("ana", "e0", day1, 1), line("bob", "e1", day2, 3)];

    const moves = movesSinceYesterday(lines, (id) => id, "2026-11-24");

    expect(moves.get("zoe")).toBe(-1); // 2nd yesterday, 3rd today
    expect(moves.get("ana")).toBe(-1);
    expect(moves.get("bob")).toBeNull();
  });

  it("gives tied players the same move", () => {
    const lines = [
      line("ana", "e1", day1, 10),
      line("bob", "e1", day1, 4),
      line("cid", "e1", day1, 4),
      line("bob", "e2", day2, 8),
      line("cid", "e2", day2, 8),
    ];

    const moves = movesSinceYesterday(lines, (id) => id, "2026-11-24");

    expect([moves.get("bob"), moves.get("cid"), moves.get("ana")]).toEqual([1, 1, -2]);
  });

  it("does not depend on the order of the lines", () => {
    const lines = [
      line("a", "e1", day1, 2),
      line("b", "e2", day2, 5),
      line("b", "e1", day1, 1),
      line("c", "e2", day2, 4),
    ];
    const sorted = (m: Map<string, number | null>) => [...m].sort(([x], [y]) => x.localeCompare(y));
    const expected = sorted(movesSinceYesterday(lines, (id) => id, "2026-11-24"));
    fc.assert(
      fc.property(fc.shuffledSubarray(lines, { minLength: lines.length }), (shuffled) => {
        expect(sorted(movesSinceYesterday(shuffled, (id) => id, "2026-11-24"))).toEqual(expected);
      }),
    );
  });
});

describe("linesOfDay", () => {
  it("keeps the lines of the events of one competition day, Paris time", () => {
    const lines = [
      { eventStartsAt: "2026-11-23T19:00:00Z" },
      { eventStartsAt: "2026-11-24T19:00:00Z" },
      { eventStartsAt: "2026-11-25T00:30:00Z" }, // 01:30 in Paris: still the 24th's evening
      { eventStartsAt: "" },
    ];

    expect(linesOfDay(lines, "2026-11-24")).toEqual([lines[1], lines[2]]);
  });
});

describe("aroundMe", () => {
  const ranked = (n: number) =>
    rankPlayers(
      Array.from({ length: n }, (_, i) => player(`P${String(i + 1).padStart(2, "0")}`, 100 - i)),
    );
  const shape = (items: ("gap" | { rank: number })[]) =>
    items.map((item) => (item === "gap" ? "···" : item.rank));

  it("shows the first ten, a gap, then the player and two neighbours on each side", () => {
    expect(shape(aroundMe(ranked(30), "p20"))).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      "···",
      18,
      19,
      20,
      21,
      22,
    ]);
  });

  it("shows only the first ten when the player is among them, far from the eleventh", () => {
    expect(shape(aroundMe(ranked(30), "p04"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("joins the neighbours to the first ten without a gap when they touch", () => {
    expect(shape(aroundMe(ranked(30), "p10"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(shape(aroundMe(ranked(30), "p13"))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it("shows the two players above the last one, and nobody below", () => {
    expect(shape(aroundMe(ranked(30), "p30"))).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      "···",
      28,
      29,
      30,
    ]);
  });

  it("takes tied players around the player in the order of the list", () => {
    const rows = rankPlayers([
      ...Array.from({ length: 12 }, (_, i) => player(`T${String(i + 1).padStart(2, "0")}`, 99 - i)),
      player("Ana", 5),
      player("Bob", 5),
      player("Cid", 5),
      player("Dan", 1),
    ]);

    const items = aroundMe(rows, "bob");

    expect(items.slice(10).map((i) => (i === "gap" ? "···" : `${i.userId}:${i.rank}`))).toEqual([
      "···",
      "t12:12",
      "ana:13",
      "bob:13",
      "cid:13",
      "dan:16",
    ]);
  });

  it("shows the first ten only when the player is not ranked", () => {
    expect(shape(aroundMe(ranked(30), "nobody"))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(shape(aroundMe(ranked(30), undefined))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("shows everyone in a short ranking", () => {
    expect(shape(aroundMe(ranked(5), "p05"))).toEqual([1, 2, 3, 4, 5]);
    expect(aroundMe([], "p01")).toEqual([]);
  });
});

describe("previousCompetitionSlugs", () => {
  const competition = (slug: string, endsOn: string) => ({ slug, endsOn });

  it("keeps the finished competitions but the last one", () => {
    const list = [
      competition("c", "2027-03-01"),
      competition("a", "2026-09-13"),
      competition("live", "2027-06-12"),
      competition("b", "2026-12-01"),
    ];

    expect(previousCompetitionSlugs(list, "2027-06-10")?.sort()).toEqual(["a", "b"]);
  });

  it("gives null while fewer than two competitions are finished: no move to show", () => {
    expect(previousCompetitionSlugs([competition("a", "2026-09-13")], "2026-10-01")).toBeNull();
    expect(previousCompetitionSlugs([competition("a", "2027-09-13")], "2026-10-01")).toBeNull();
    expect(previousCompetitionSlugs([], "2026-10-01")).toBeNull();
  });

  it("leaves out every competition ending on the last day, whatever their order", () => {
    const list = [
      competition("a", "2026-09-13"),
      competition("b", "2026-12-01"),
      competition("c", "2026-12-01"),
    ];

    expect(previousCompetitionSlugs(list, "2027-01-01")).toEqual(["a"]);
  });
});

describe("movesSinceCompetitions", () => {
  const line = (userId: string, competitionSlug: string, points: number) => ({
    userId,
    competitionSlug,
    eventStartsAt: "2026-11-23T19:00:00Z",
    points,
    reasons: [],
  });
  const lines = [
    line("ana", "first", 10),
    line("bob", "first", 5),
    line("cid", "first", 3),
    line("bob", "last", 12),
    line("cid", "last", 1),
    line("dan", "last", 2),
  ];

  it("compares each place with the ranking at the end of the competitions given (gain, loss, same)", () => {
    const moves = movesSinceCompetitions(lines, (id) => id, ["first"]);

    expect(moves.get("bob")).toBe(1); // 2nd → 1st
    expect(moves.get("ana")).toBe(-1); // 1st → 2nd
    expect(moves.get("cid")).toBe(0); // 3rd → 3rd
  });

  it("gives null to a new player, who was not ranked before", () => {
    expect(movesSinceCompetitions(lines, (id) => id, ["first"]).get("dan")).toBeNull();
  });

  it("ranks a league member without any line in both rankings", () => {
    const zero = { userId: "zoe", eventStartsAt: "", points: 0, reasons: [] };

    const moves = movesSinceCompetitions([zero, ...lines], (id) => id, ["first"]);

    expect(moves.get("zoe")).toBe(-1); // 4th → 5th
  });

  it("does not depend on the order the predictions arrive in", () => {
    const sorted = (m: Map<string, number | null>) => [...m].sort(([x], [y]) => x.localeCompare(y));
    const expected = sorted(movesSinceCompetitions(lines, (id) => id, ["first"]));
    fc.assert(
      fc.property(fc.shuffledSubarray(lines, { minLength: lines.length }), (shuffled) => {
        expect(sorted(movesSinceCompetitions(shuffled, (id) => id, ["first"]))).toEqual(expected);
      }),
    );
  });
});

describe("placeOf", () => {
  const ranked = rankPlayers([
    player("Ana", 50),
    player("Bob", 32),
    player("Cleo", 32),
    player("Dan", 14),
    player("Eve", 0),
  ]);

  it("gives the gap with the player just ahead, with their pseudo and rank", () => {
    expect(placeOf(ranked, "dan")).toMatchObject({
      rank: 4,
      points: 14,
      ahead: { pseudo: "Cleo", rank: 2, gap: 18 },
    });
  });

  it("looks past the players tied with me to the one strictly ahead", () => {
    expect(placeOf(ranked, "cleo")?.ahead).toEqual({ pseudo: "Ana", rank: 1, gap: 18 });
  });

  it("gives a gap of 0 to a player behind on the tie-breakers only", () => {
    const list = rankPlayers([player("Ana", 20, 1), player("Bob", 20, 0)]);

    expect(placeOf(list, "bob")?.ahead).toEqual({ pseudo: "Ana", rank: 1, gap: 0 });
  });

  it("gives no gap to the first", () => {
    expect(placeOf(ranked, "ana")?.ahead).toBeNull();
  });

  it("gives the top percent of the ranking, rounded up", () => {
    expect(placeOf(ranked, "ana")?.topPercent).toBe(20);
    expect(placeOf(ranked, "dan")?.topPercent).toBe(80);
    const many = rankPlayers(
      Array.from({ length: 200 }, (_, i) => player(`P${String(i).padStart(3, "0")}`, 200 - i)),
    );
    expect(placeOf(many, "p000")?.topPercent).toBe(1);
    expect(placeOf(many, "p035")?.topPercent).toBe(18);
  });

  it("is null for a player not ranked or without points", () => {
    expect(placeOf(ranked, "nobody")).toBeNull();
    expect(placeOf(ranked, "eve")).toBeNull();
    expect(placeOf(ranked, undefined)).toBeNull();
  });

  it("keeps the move of the row", () => {
    const rows = ranked.map((r) => ({ ...r, change: r.userId === "dan" ? -2 : null }));

    expect(placeOf(rows, "dan")?.change).toBe(-2);
    expect(placeOf(rows, "ana")?.change).toBeNull();
  });
});
