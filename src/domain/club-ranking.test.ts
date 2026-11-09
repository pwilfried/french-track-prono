import { describe, expect, it } from "vitest";

import { rankClubs } from "./club-ranking";

const player = (clubId: string | null, points: number) => ({
  clubId,
  club: clubId ? `Club ${clubId}` : null,
  points,
});

describe("rankClubs", () => {
  it("ranks clubs by the average points of their players", () => {
    const ranked = rankClubs(
      [
        player("a", 10),
        player("a", 20),
        player("a", 30),
        player("b", 40),
        player("b", 50),
        player("b", 0),
      ],
      3,
    );
    expect(ranked.map((c) => [c.name, c.players, c.average, c.rank])).toEqual([
      ["Club b", 3, 30, 1],
      ["Club a", 3, 20, 2],
    ]);
  });

  it("leaves out clubs with too few players and players without a club", () => {
    const ranked = rankClubs([player("a", 99), player("a", 99), player(null, 50)], 3);
    expect(ranked).toEqual([]);
  });

  it("shares the rank on equal averages and rounds to one decimal", () => {
    const ranked = rankClubs(
      [player("a", 1), player("a", 2), player("b", 3), player("b", 0), player("c", 0)],
      1,
    );
    expect(ranked.map((c) => [c.name, c.average, c.rank])).toEqual([
      ["Club a", 1.5, 1],
      ["Club b", 1.5, 1],
      ["Club c", 0, 3],
    ]);
  });

  it("does not depend on the order of the players", () => {
    const players = [
      player("a", 5),
      player("b", 7),
      player("a", 9),
      player("b", 1),
      player("c", 4),
    ];
    expect(rankClubs([...players].reverse(), 1)).toEqual(rankClubs(players, 1));
  });
});
