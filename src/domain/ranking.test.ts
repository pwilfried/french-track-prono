import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { rankChanges, rankPlayers, totalsOf, type PlayerTotals } from "./ranking";

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

describe("rankChanges", () => {
  const line = (userId: string, eventId: string, startsAt: string, points: number) => ({
    userId,
    eventId,
    eventStartsAt: startsAt,
    points,
    reasons: [],
  });
  const day1 = "2026-11-23T19:00:00Z";
  const day2 = "2026-11-24T19:00:00Z";

  it("compares each player's place with the ranking before the last computed event", () => {
    const lines = [
      line("ana", "e1", day1, 10),
      line("bob", "e1", day1, 5),
      line("cid", "e1", day1, 3),
      line("bob", "e2", day2, 12),
      line("cid", "e2", day2, 1),
    ];

    const changes = rankChanges(lines, (id) => id);

    expect(changes.get("bob")).toBe(1); // 2nd → 1st
    expect(changes.get("ana")).toBe(-1); // 1st → 2nd
    expect(changes.get("cid")).toBe(0);
  });

  it("gives null to a player who only scored in the last event, and to everyone after one event", () => {
    expect(rankChanges([line("ana", "e1", day1, 3)], (id) => id).get("ana")).toBeNull();
    const changes = rankChanges(
      [line("ana", "e1", day1, 3), line("dan", "e2", day2, 9)],
      (id) => id,
    );
    expect(changes.get("dan")).toBeNull();
    expect(changes.get("ana")).toBe(-1);
  });

  it("does not depend on the order of the lines", () => {
    const lines = [line("a", "e1", day1, 2), line("b", "e2", day2, 5), line("b", "e1", day1, 1)];
    const sorted = (m: Map<string, number | null>) => [...m].sort(([x], [y]) => x.localeCompare(y));
    expect(sorted(rankChanges([...lines].reverse(), (id) => id))).toEqual(
      sorted(rankChanges(lines, (id) => id)),
    );
  });
});
