import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { movesSinceYesterday, rankPlayers, streaks, totalsOf, type PlayerTotals } from "./ranking";

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
  // 20:00 in Paris on the 23rd, then on the 24th.
  const yesterday = "2026-11-23T19:00:00Z";
  const tonight = "2026-11-24T19:00:00Z";
  const today = "2026-11-24";
  const moves = (lines: ReturnType<typeof line>[], day = today) =>
    movesSinceYesterday(lines, day, (id) => id);

  it("compares each player's place with the ranking at the end of the day before", () => {
    const changes = moves([
      line("ana", "e1", yesterday, 10),
      line("bob", "e1", yesterday, 5),
      line("cid", "e1", yesterday, 3),
      line("bob", "e2", tonight, 12),
      line("cid", "e2", tonight, 1),
    ]);

    expect(changes.get("bob")).toBe(1); // 2nd → 1st
    expect(changes.get("ana")).toBe(-1); // 1st → 2nd
    expect(changes.get("cid")).toBe(0);
  });

  it("counts every event of the day, not only the last one computed", () => {
    const changes = moves([
      line("ana", "e1", yesterday, 10),
      line("bob", "e1", yesterday, 9),
      line("bob", "e2", tonight, 2),
      line("ana", "e3", "2026-11-24T20:00:00Z", 3),
    ]);

    // Bob led after e2, Ana took the lead back with e3: since yesterday, nobody moved.
    expect(changes.get("ana")).toBe(0);
    expect(changes.get("bob")).toBe(0);
  });

  it("reads the day in Paris time: an event at 00:30 in Paris belongs to that day", () => {
    const changes = moves([
      line("ana", "e1", yesterday, 5),
      line("bob", "e2", "2026-11-23T23:30:00Z", 8),
    ]);

    expect(changes.get("ana")).toBe(-1);
    expect(changes.get("bob")).toBeNull();
  });

  it("moves a player up to the place they now share with another", () => {
    const changes = moves([
      line("ana", "e1", yesterday, 10),
      line("bob", "e1", yesterday, 5),
      line("bob", "e2", tonight, 5),
    ]);

    expect(changes.get("bob")).toBe(1); // 2nd → tied 1st
    expect(changes.get("ana")).toBe(0);
  });

  it("gives null to a player not ranked yesterday, and to everyone before any day is over", () => {
    expect(moves([line("ana", "e1", tonight, 3)]).get("ana")).toBeNull();
    const changes = moves([line("ana", "e1", yesterday, 3), line("dan", "e2", tonight, 9)]);
    expect(changes.get("dan")).toBeNull();
    expect(changes.get("ana")).toBe(-1);
  });

  it("leaves everyone in place on a day without event", () => {
    const changes = moves(
      [line("ana", "e1", yesterday, 3), line("bob", "e2", tonight, 9)],
      "2026-11-25",
    );

    expect([...changes.values()]).toEqual([0, 0]);
  });

  it("does not depend on the order of the lines", () => {
    const lines = fc.sample(
      fc.array(
        fc.record({
          userId: fc.constantFrom("a", "b", "c"),
          eventId: fc.constantFrom("e1", "e2", "e3"),
          eventStartsAt: fc.constantFrom(yesterday, tonight),
          points: fc.integer({ min: 0, max: 28 }),
          reasons: fc.constant<never[]>([]),
        }),
      ),
      50,
    );
    const sorted = (m: Map<string, number | null>) => [...m].sort(([x], [y]) => x.localeCompare(y));
    for (const sample of lines) {
      expect(sorted(moves([...sample].reverse()))).toEqual(sorted(moves(sample)));
    }
  });
});

describe("streaks", () => {
  const line = (userId: string, eventId: string, day: number, points: number) => ({
    userId,
    eventId,
    eventStartsAt: `2026-11-2${day}T19:00:00Z`,
    points,
    reasons: [],
  });

  it("counts the last computed events in a row where the player scored at least 1 point", () => {
    const lines = [
      line("ana", "e1", 3, 4),
      line("ana", "e2", 4, 1),
      line("ana", "e3", 5, 3),
      line("bob", "e1", 3, 5),
      line("bob", "e2", 4, 0),
      line("bob", "e3", 5, 2),
      line("cid", "e1", 3, 6),
      line("cid", "e2", 4, 6),
    ];

    const result = streaks(lines);

    expect(result.get("ana")).toBe(3);
    expect(result.get("bob")).toBe(1); // 0 on e2 broke it
    expect(result.get("cid")).toBe(0); // no prediction on the last event
  });

  it("does not depend on the order of the lines", () => {
    const lines = [line("a", "e1", 3, 1), line("a", "e2", 4, 2), line("b", "e2", 4, 1)];
    expect(streaks([...lines].reverse()).get("a")).toBe(streaks(lines).get("a"));
  });
});
