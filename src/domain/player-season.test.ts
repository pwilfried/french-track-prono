import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { seasonStats, type SeasonLine } from "./player-season";

const line = (
  id: string,
  day: number,
  points: number,
  reasons: SeasonLine["reasons"] = [],
  family: SeasonLine["family"] = "sprint",
): SeasonLine => ({
  eventId: id,
  eventStartsAt: new Date(Date.UTC(2026, 7, day)).toISOString(),
  points,
  reasons,
  discipline: "100 m",
  gender: "F",
  family,
});

describe("season stats of the profile", () => {
  const lines = [
    line("a", 1, 12, [{ kind: "exact", slot: 1 }, { kind: "perfect_podium" }]),
    line("b", 2, 0, [], "middle"),
    line("c", 3, 5, [{ kind: "exact", slot: 1 }, { kind: "joker" }], "middle"),
    line("d", 4, 3, [{ kind: "odds", slot: 1, odds: 6, multiplier: 2, points: 3 }], "throws"),
  ];

  it("counts perfect podiums, winners, success and the joker", () => {
    expect(seasonStats(lines, 6)).toMatchObject({
      predictions: 6,
      perfectPodiums: 1,
      winners: 2,
      successRate: 75,
      bestStreak: 2,
      jokerPlayed: true,
    });
  });

  it("draws the cumulative points in the order of the events", () => {
    expect(seasonStats(lines, 4).curve).toEqual([12, 12, 17, 20]);
  });

  it("keeps the best shot with its perfect podium and its odds", () => {
    expect(seasonStats(lines, 4).bestShot).toMatchObject({
      eventId: "a",
      perfect: true,
      odds: null,
    });
    const withOdds = seasonStats([line("x", 1, 2), lines[3]!], 2).bestShot;
    expect(withOdds).toMatchObject({ eventId: "d", odds: 6 });
  });

  it("ranks the families by success, three at most", () => {
    expect(seasonStats(lines, 4).families).toEqual([
      { family: "sprint", rate: 100, events: 1 },
      { family: "throws", rate: 100, events: 1 },
      { family: "middle", rate: 50, events: 2 },
    ]);
  });

  it("gives empty stats before the first computed event", () => {
    expect(seasonStats([], 2)).toEqual({
      predictions: 2,
      perfectPodiums: 0,
      winners: 0,
      successRate: 0,
      bestStreak: 0,
      jokerPlayed: false,
      curve: [],
      bestShot: null,
      families: [],
    });
  });

  const arbitraryLines = fc
    .array(fc.tuple(fc.integer({ min: 1, max: 28 }), fc.integer({ min: 0, max: 28 })), {
      maxLength: 30,
    })
    .map((rows) => rows.map(([day, points], i) => line(`e${i}`, day, points)));

  it("ends the curve on the total and keeps success between 0 and 100", () => {
    fc.assert(
      fc.property(arbitraryLines, (rows) => {
        const stats = seasonStats(rows, rows.length);
        const total = rows.reduce((sum, r) => sum + r.points, 0);
        expect(stats.curve.at(-1) ?? 0).toBe(total);
        expect(stats.successRate).toBeGreaterThanOrEqual(0);
        expect(stats.successRate).toBeLessThanOrEqual(100);
        expect(stats.bestStreak).toBeLessThanOrEqual(rows.length);
      }),
    );
  });

  it("does not depend on the order the lines arrive in", () => {
    fc.assert(
      fc.property(arbitraryLines, (rows) => {
        expect(seasonStats([...rows].reverse(), 3)).toEqual(seasonStats(rows, 3));
      }),
    );
  });
});
