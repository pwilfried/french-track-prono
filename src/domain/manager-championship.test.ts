import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CHAMPIONSHIP_POINTS,
  duelOutcome,
  duelResult,
  managerStandings,
  matchdayState,
  nextDuel,
  seasonDuels,
  type PlayedDuel,
  type SeasonMatchday,
} from "./manager-championship";

const duel = (home: string, away: string, homeScore: number, awayScore: number): PlayedDuel => ({
  home,
  away,
  homeScore,
  awayScore,
});

describe("duelResult", () => {
  it("gives the win to the higher Manager score, at home or away", () => {
    expect(duelResult(812, 640)).toBe("home");
    expect(duelResult(500, 501)).toBe("away");
  });

  it("calls an equal score a draw", () => {
    expect(duelResult(700, 700)).toBe("draw");
  });

  it("is worth 3 points for a win, 1 for a draw, 0 for a defeat", () => {
    expect(CHAMPIONSHIP_POINTS).toEqual({ win: 3, draw: 1, loss: 0 });
  });
});

describe("duelOutcome", () => {
  it("tells a player of the head-to-head whether they won, drew or lost, and what it is worth", () => {
    expect(duelOutcome(812, 640)).toEqual({ outcome: "win", points: 3 });
    expect(duelOutcome(700, 700)).toEqual({ outcome: "draw", points: 1 });
    expect(duelOutcome(500, 501)).toEqual({ outcome: "loss", points: 0 });
  });

  it("gives the two players of a head-to-head opposite outcomes", () => {
    fc.assert(
      fc.property(fc.nat(10000), fc.nat(10000), (a, b) => {
        const mine = duelOutcome(a, b);
        const theirs = duelOutcome(b, a);
        expect(mine.points + theirs.points).toBe(a === b ? 2 : 3);
      }),
    );
  });
});

describe("managerStandings", () => {
  it("counts wins, draws, defeats, points scored and conceded for each player", () => {
    const rows = managerStandings(
      ["ana", "bob"],
      [duel("ana", "bob", 900, 700), duel("bob", "ana", 650, 650)],
    );

    expect(rows).toEqual([
      {
        userId: "ana",
        rank: 1,
        played: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        scored: 1550,
        conceded: 1350,
        difference: 200,
        points: 4,
      },
      {
        userId: "bob",
        rank: 2,
        played: 2,
        wins: 0,
        draws: 1,
        losses: 1,
        scored: 1350,
        conceded: 1550,
        difference: -200,
        points: 1,
      },
    ]);
  });

  it("lists a player who has not played yet with zero everywhere", () => {
    const rows = managerStandings(["ana", "bob"], []);
    expect(rows.map((r) => [r.userId, r.rank, r.points, r.played])).toEqual([
      ["ana", 1, 0, 0],
      ["bob", 1, 0, 0],
    ]);
  });

  it("ranks on championship points first", () => {
    // ana: 2 draws = 2 points; bob: 1 win, 1 defeat = 3 points.
    const rows = managerStandings(
      ["ana", "bob", "cat", "dan"],
      [
        duel("ana", "cat", 500, 500),
        duel("dan", "ana", 400, 400),
        duel("bob", "cat", 600, 100),
        duel("dan", "bob", 900, 100),
      ],
    );
    expect(rows.findIndex((r) => r.userId === "bob")).toBeLessThan(
      rows.findIndex((r) => r.userId === "ana"),
    );
  });

  it("breaks a tie on points with the number of wins", () => {
    // ana: 3 draws = 3 points, 0 win; bob: 1 win, 2 defeats = 3 points.
    const rows = managerStandings(
      ["ana", "bob", "cat", "dan"],
      [
        duel("ana", "cat", 100, 100),
        duel("ana", "dan", 100, 100),
        duel("cat", "ana", 100, 100),
        duel("bob", "cat", 101, 100),
        duel("dan", "bob", 900, 100),
        duel("cat", "bob", 900, 100),
      ],
    );
    const ana = rows.find((r) => r.userId === "ana")!;
    const bob = rows.find((r) => r.userId === "bob")!;
    expect([ana.points, bob.points]).toEqual([3, 3]);
    expect(bob.rank).toBeLessThan(ana.rank);
  });

  it("then with the Manager points difference", () => {
    // ana and bob: 1 win each; ana +300, bob +100.
    const rows = managerStandings(
      ["ana", "bob", "cat", "dan"],
      [duel("ana", "cat", 900, 600), duel("bob", "dan", 1100, 1000)],
    );
    expect(rows.slice(0, 2).map((r) => r.userId)).toEqual(["ana", "bob"]);
  });

  it("then with the Manager points scored", () => {
    // ana and bob: 1 win each, +100 each; bob scored more.
    const rows = managerStandings(
      ["ana", "bob", "cat", "dan"],
      [duel("ana", "cat", 600, 500), duel("bob", "dan", 1100, 1000)],
    );
    expect(rows.slice(0, 2).map((r) => [r.userId, r.rank])).toEqual([
      ["bob", 1],
      ["ana", 2],
    ]);
  });

  it("shares a rank when everything is equal, and skips the next one", () => {
    const rows = managerStandings(
      ["ana", "bob", "cat", "dan"],
      [duel("ana", "cat", 600, 500), duel("bob", "dan", 600, 500)],
    );
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([
      ["ana", 1],
      ["bob", 1],
      ["cat", 3],
      ["dan", 3],
    ]);
  });

  it("does not depend on the order the results come in", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const duelArb = fc
      .tuple(fc.constantFrom(...players), fc.constantFrom(...players), fc.nat(2000), fc.nat(2000))
      .filter(([h, a]) => h !== a)
      .map(([h, a, hs, as]) => duel(h, a, hs, as));
    fc.assert(
      fc.property(fc.array(duelArb, { maxLength: 12 }), (duels) => {
        const shuffled = [...duels].reverse();
        expect(managerStandings(players, shuffled)).toEqual(managerStandings(players, duels));
      }),
    );
  });

  it("hands out 3 points per decided duel and 2 per draw in total", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const duelArb = fc
      .tuple(fc.constantFrom(...players), fc.constantFrom(...players), fc.nat(5), fc.nat(5))
      .filter(([h, a]) => h !== a)
      .map(([h, a, hs, as]) => duel(h, a, hs, as));
    fc.assert(
      fc.property(fc.array(duelArb, { maxLength: 12 }), (duels) => {
        const total = managerStandings(players, duels).reduce((sum, r) => sum + r.points, 0);
        const draws = duels.filter((d) => d.homeScore === d.awayScore).length;
        expect(total).toBe(3 * (duels.length - draws) + 2 * draws);
      }),
    );
  });
});

const matchdays: SeasonMatchday[] = [
  { round: 1, competitionId: "c1", bonus: false },
  { round: 2, competitionId: "c2", bonus: false },
  { round: 3, competitionId: "c3", bonus: true },
];

const fixtures = [
  { round: 1, home: "ana", away: "bob" },
  { round: 2, home: "bob", away: "ana" },
];

describe("seasonDuels", () => {
  it("plays a head-to-head once the Manager scores of its competition are in", () => {
    const scores = [
      { competitionId: "c1", userId: "ana", total: 900 },
      { competitionId: "c1", userId: "bob", total: 700 },
    ];
    expect(seasonDuels(matchdays, fixtures, scores)).toEqual([
      { round: 1, ...duel("ana", "bob", 900, 700) },
    ]);
  });

  it("counts a missing score as zero once its competition is scored", () => {
    const scores = [{ competitionId: "c1", userId: "ana", total: 900 }];
    expect(seasonDuels(matchdays, fixtures, scores)).toEqual([
      { round: 1, ...duel("ana", "bob", 900, 0) },
    ]);
  });

  it("plays no head-to-head on a bonus matchday, whatever the scores", () => {
    const scores = [
      { competitionId: "c3", userId: "ana", total: 900 },
      { competitionId: "c3", userId: "bob", total: 100 },
    ];
    const withStray = [...fixtures, { round: 3, home: "ana", away: "bob" }];
    expect(seasonDuels(matchdays, withStray, scores)).toEqual([]);
  });

  it("gives no championship point for a bonus matchday", () => {
    const scores = [
      { competitionId: "c3", userId: "ana", total: 900 },
      { competitionId: "c3", userId: "bob", total: 100 },
    ];
    const rows = managerStandings(["ana", "bob"], seasonDuels(matchdays, fixtures, scores));
    expect(rows.map((r) => [r.points, r.played, r.scored])).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});

describe("matchdayState", () => {
  it("tells a played, an upcoming, a bonus and an unplayable matchday apart", () => {
    const scored = new Set(["c1"]);
    expect(matchdayState(matchdays[0]!, scored)).toBe("played");
    expect(matchdayState(matchdays[1]!, scored)).toBe("upcoming");
    expect(matchdayState(matchdays[2]!, scored)).toBe("bonus");
    expect(matchdayState({ round: 4, competitionId: null, bonus: false }, scored)).toBe(
      "not_played",
    );
  });
});

describe("nextDuel", () => {
  it("is the player's first head-to-head not played yet", () => {
    expect(nextDuel("ana", matchdays, fixtures, new Set(["c1"]))).toEqual({
      round: 2,
      competitionId: "c2",
      opponent: "bob",
      home: false,
    });
  });

  it("skips the bonus matchdays and is null once every head-to-head is played", () => {
    expect(nextDuel("ana", matchdays, fixtures, new Set(["c1", "c2"]))).toBeNull();
  });
});
