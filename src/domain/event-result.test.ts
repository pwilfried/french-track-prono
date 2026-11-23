import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { eventPointsStats, pointsBreakdown, rankByPoints } from "./event-result";
import { DEFAULT_RULES, scorePrediction, type OfficialLine } from "./scoring";

const official: OfficialLine[] = [
  { athleteId: "a", rank: 1 },
  { athleteId: "b", rank: 2 },
  { athleteId: "c", rank: 3 },
];
const context = { predictionCount: 0, winnerPicks: {} };

describe("pointsBreakdown", () => {
  it("gives a line per found place and the misplaced athletes on one line", () => {
    const score = scorePrediction(
      { first: "a", second: "c", third: "b" },
      official,
      DEFAULT_RULES,
      context,
    );
    const detail = pointsBreakdown(score, DEFAULT_RULES);
    expect(detail.lines).toEqual([
      { kind: "exact", slot: 1, points: 3 },
      { kind: "on_podium", count: 2, points: 2 },
    ]);
    expect(detail).toMatchObject({ subtotal: 5, total: 5, joker: null });
  });

  it("adds the perfect podium, the flair, the odds and the marks", () => {
    const detail = pointsBreakdown(
      {
        points: 3 * 3 + 3 + 2 + 6 + 5,
        reasons: [
          { kind: "exact", slot: 1 },
          { kind: "exact", slot: 2 },
          { kind: "exact", slot: 3 },
          { kind: "perfect_podium" },
          { kind: "odds", slot: 1, odds: 2, multiplier: 3, points: 6 },
          { kind: "mark", slot: 1, predicted: 9.8, official: 9.8, points: 5 },
          { kind: "flair" },
        ],
      },
      DEFAULT_RULES,
    );
    expect(detail.lines.map((l) => [l.kind, l.points])).toEqual([
      ["exact", 3],
      ["exact", 3],
      ["exact", 3],
      ["perfect_podium", 3],
      ["flair", 2],
      ["odds", 6],
      ["mark", 5],
    ]);
  });

  it("shows the joker as the difference it makes to the points", () => {
    const score = { points: 7, reasons: [], jokers: { double: 14, all_or_nothing: 0 } };
    expect(pointsBreakdown(score, DEFAULT_RULES, "double")).toMatchObject({
      subtotal: 7,
      joker: { joker: "double", points: 7 },
      total: 14,
    });
    expect(pointsBreakdown(score, DEFAULT_RULES, "all_or_nothing")).toMatchObject({
      joker: { joker: "all_or_nothing", points: -7 },
      total: 0,
    });
  });

  it("has no joker line for the spy, which changes nothing to the points", () => {
    const score = { points: 4, reasons: [], jokers: { spy: 4 } };
    expect(pointsBreakdown(score, DEFAULT_RULES, "spy")).toMatchObject({ joker: null, total: 4 });
  });

  it("adds up to the points of the scoring, for any podium", () => {
    const athlete = fc.constantFrom("a", "b", "c", "d", "e");
    fc.assert(
      fc.property(athlete, athlete, athlete, (first, second, third) => {
        const score = scorePrediction({ first, second, third }, official, DEFAULT_RULES, context);
        const detail = pointsBreakdown(score, DEFAULT_RULES);
        expect(detail.lines.reduce((sum, l) => sum + l.points, 0)).toBe(score.points);
      }),
    );
  });
});

describe("rankByPoints", () => {
  it("orders by points and gives tied players the same rank", () => {
    const ranked = rankByPoints(
      [
        { id: "x", points: 3 },
        { id: "y", points: 9 },
        { id: "z", points: 3 },
        { id: "w", points: 1 },
      ],
      (a, b) => a.id.localeCompare(b.id),
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["y", 1],
      ["x", 2],
      ["z", 2],
      ["w", 4],
    ]);
  });
});

describe("eventPointsStats", () => {
  const scores = [
    { userId: "u1", points: 0, perfect: false },
    { userId: "u2", points: 4, perfect: false },
    { userId: "u3", points: 12, perfect: false },
    { userId: "me", points: 8, perfect: false },
    { userId: "u5", points: 18, perfect: true },
  ];

  it("counts the players in each range of points, mine marked", () => {
    const stats = eventPointsStats(scores, "me");
    expect(stats.ranges.map((r) => [r.min, r.max, r.count, r.percent, r.mine])).toEqual([
      [0, 0, 1, 20, false],
      [1, 5, 1, 20, false],
      [6, 10, 1, 20, true],
      [11, 15, 1, 20, false],
      [16, null, 1, 20, false],
    ]);
  });

  it("gives the mean, the perfect podiums and my rank among all", () => {
    expect(eventPointsStats(scores, "me")).toMatchObject({
      total: 5,
      mean: 8.4,
      perfect: 1,
      me: { rank: 3, topPercent: 60 },
    });
  });

  it("has no rank for a player without a prediction, and nothing to divide when nobody scored", () => {
    expect(eventPointsStats(scores, "nobody").me).toBeNull();
    expect(eventPointsStats([], "me")).toMatchObject({ total: 0, mean: 0, me: null });
  });

  it("does not depend on the order the predictions came in", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(scores, { minLength: 5, maxLength: 5 }), (shuffled) => {
        expect(eventPointsStats(shuffled, "me")).toEqual(eventPointsStats(scores, "me"));
      }),
    );
  });
});
