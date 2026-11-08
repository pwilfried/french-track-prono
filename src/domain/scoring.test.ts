import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  flairContext,
  scorePrediction,
  type OfficialLine,
  type ScoringPrediction,
} from "./scoring";
import { OTHER_ATHLETE } from "./podium-draft";

const official = (...lines: [string, number][]): OfficialLine[] =>
  lines.map(([athleteId, rank]) => ({ athleteId, rank }));
const standard = official(["A", 1], ["B", 2], ["C", 3], ["D", 4]);
const pick = (
  first: string,
  second: string,
  third: string,
  useJoker = false,
): ScoringPrediction => ({
  first,
  second,
  third,
  useJoker,
});
const crowd = (predictionCount: number, winnerPicks: Record<string, number> = {}) => ({
  predictionCount,
  winnerPicks,
});
const noCrowd = crowd(100, { A: 50 });

const points = (p: ScoringPrediction, o = standard, c = noCrowd) =>
  scorePrediction(p, o, DEFAULT_RULES, c).points;

describe("scorePrediction", () => {
  it("gives 12 points for a perfect podium", () => {
    expect(points(pick("A", "B", "C"))).toBe(12);
  });

  it("gives 3 points when only the winner is found", () => {
    expect(points(pick("A", "X", "Y"))).toBe(3);
  });

  it("gives 5 points for the winner and the two others swapped", () => {
    expect(points(pick("A", "C", "B"))).toBe(5);
  });

  it("gives 3 points when the three athletes are right but all misplaced", () => {
    expect(points(pick("B", "C", "A"))).toBe(3);
  });

  it("gives 0 points when nobody is on the podium", () => {
    expect(points(pick("X", "Y", "Z"))).toBe(0);
  });

  it("doubles a perfect podium with the joker", () => {
    expect(points(pick("A", "B", "C", true))).toBe(24);
  });

  it("adds the flair bonus when the winner was picked by 1 player out of 20", () => {
    expect(points(pick("A", "X", "Y"), standard, crowd(20, { A: 1 }))).toBe(5);
  });

  it("gives no flair bonus under 10 predictions", () => {
    expect(points(pick("A", "X", "Y"), standard, crowd(9, { A: 1 }))).toBe(3);
  });

  it("gives no flair bonus at exactly 15 percent", () => {
    expect(points(pick("A", "X", "Y"), standard, crowd(20, { A: 3 }))).toBe(3);
  });

  it("reaches 28 points with a perfect podium, flair and joker", () => {
    expect(points(pick("A", "B", "C", true), standard, crowd(20, { A: 1 }))).toBe(28);
  });

  it("counts a tie for third place for either tied athlete", () => {
    const tied = official(["A", 1], ["B", 2], ["C", 3], ["D", 3]);
    expect(points(pick("A", "B", "C"), tied)).toBe(12);
    expect(points(pick("A", "B", "D"), tied)).toBe(12);
  });

  it("counts a tie for the win: both tied athletes are winners", () => {
    const tied = official(["A", 1], ["B", 1], ["C", 3]);
    const popular = crowd(100, { A: 40, B: 40 });
    expect(points(pick("B", "X", "Y"), tied, popular)).toBe(3);
    expect(points(pick("A", "X", "Y"), tied, popular)).toBe(3);
  });

  it("explains the points with reasons", () => {
    const result = scorePrediction(pick("A", "C", "X"), standard, DEFAULT_RULES, noCrowd);

    expect(result.reasons).toEqual([
      { kind: "exact", slot: 1 },
      { kind: "on_podium", slot: 2 },
    ]);
  });
});

describe("flairContext", () => {
  it("counts the predictions and the winner picks", () => {
    const context = flairContext([pick("A", "B", "C"), pick("A", "C", "B"), pick("B", "A", "C")]);

    expect(context).toEqual({ predictionCount: 3, winnerPicks: { A: 2, B: 1 } });
  });

  it("does not depend on the order of the predictions", () => {
    const athlete = fc.constantFrom("A", "B", "C", "D", "E");
    const prediction = fc
      .uniqueArray(athlete, { minLength: 3, maxLength: 3 })
      .chain(([first, second, third]) =>
        fc.boolean().map((useJoker) => pick(first!, second!, third!, useJoker)),
      );

    fc.assert(
      fc.property(fc.array(prediction, { maxLength: 30 }), (predictions) => {
        expect(flairContext([...predictions].reverse())).toEqual(flairContext(predictions));
      }),
    );
  });
});

describe("scorePrediction properties", () => {
  it("always gives between 0 and 28 points", () => {
    const athlete = fc.constantFrom("A", "B", "C", "D", "E", "F");
    const lines = fc
      .uniqueArray(athlete, { minLength: 3, maxLength: 6 })
      .map((ids) => ids.map((athleteId, index) => ({ athleteId, rank: index + 1 })));
    const prediction = fc
      .uniqueArray(athlete, { minLength: 3, maxLength: 3 })
      .chain(([first, second, third]) =>
        fc.boolean().map((useJoker) => pick(first!, second!, third!, useJoker)),
      );
    const context = fc
      .nat({ max: 60 })
      .chain((predictionCount) =>
        fc
          .nat({ max: predictionCount })
          .map((count) => crowd(predictionCount, { A: count, B: count, C: count })),
      );

    fc.assert(
      fc.property(prediction, lines, context, (p, o, c) => {
        const result = points(p, o, c);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(28);
      }),
    );
  });
});

describe("scorePrediction with odds and marks (v0.9)", () => {
  // A at 2.00, B at 3.00, C at 1.50 are proposed; X is not, so it is « autre athlète » (8.00).
  const odds = {
    proposed: [
      { athleteId: "A", odds: 2 },
      { athleteId: "B", odds: 3 },
      { athleteId: "C", odds: 1.5 },
    ],
    other: 8,
  };
  const result: OfficialLine[] = [
    { athleteId: "A", rank: 1, markValue: 10.79 },
    { athleteId: "B", rank: 2, markValue: 10.87 },
    { athleteId: "X", rank: 3, markValue: 10.9 },
    { athleteId: "C", rank: 4, markValue: 11.02 },
  ];
  const bets = { odds, tolerance: 0.05 };
  const score = (p: ScoringPrediction) => scorePrediction(p, result, DEFAULT_RULES, noCrowd, bets);

  it("adds the odds times 3 at the right place: A and B found, C off the podium", () => {
    // Base 3 + 3, odds 2 × 3 + 3 × 3.
    expect(score(pick("A", "B", "C")).points).toBe(21);
  });

  it("gives the odds times 2 one place off, and « autre athlète » found by an athlete not proposed", () => {
    // Base: A on the podium 1, « autre athlète » 3rd exact 3. Odds: A 2 × 2, other 8 × 3.
    expect(score(pick("C", "A", OTHER_ATHLETE)).points).toBe(32);
  });

  it("gives the odds times 1 two places off, rounded to the point", () => {
    const close = { proposed: [{ athleteId: "A", odds: 1.8 }], other: 5 };
    // B and A on the podium elsewhere: base 1 + 1; A 3rd for a win: odds 1.8 × 1 = 2 (rounded).
    const s = scorePrediction(pick("B", "C", "A"), result, DEFAULT_RULES, noCrowd, {
      odds: close,
      tolerance: null,
    });
    expect(s.points).toBe(1 + 1 + 2);
    expect(s.reasons).toContainEqual({
      kind: "odds",
      slot: 3,
      odds: 1.8,
      multiplier: 1,
      points: 2,
    });
  });

  it("adds 5 points for a mark within the tolerance and 2 within twice the tolerance", () => {
    const s = score({
      ...pick("A", "B", "C"),
      marks: { first: 10.81, second: 10.95, third: null },
    });
    // 21, then 10.81 for 10.79 (+5) and 10.95 for 10.87 (+2).
    expect(s.points).toBe(28);
    expect(s.reasons).toContainEqual({
      kind: "mark",
      slot: 1,
      predicted: 10.81,
      official: 10.79,
      points: 5,
    });
    expect(s.reasons).toContainEqual({
      kind: "mark",
      slot: 2,
      predicted: 10.95,
      official: 10.87,
      points: 2,
    });
  });

  it("gives nothing for a mark further than twice the tolerance", () => {
    expect(
      score({ ...pick("A", "B", "C"), marks: { first: 10.95, second: null, third: null } }).points,
    ).toBe(21);
  });

  it("doubles everything with the joker", () => {
    expect(
      score({ ...pick("A", "B", "C", true), marks: { first: 10.81, second: null, third: null } })
        .points,
    ).toBe(52);
  });

  it("is never negative and stays the same when run again", () => {
    const ids = fc.constantFrom("A", "B", "C", "X", OTHER_ATHLETE);
    fc.assert(
      fc.property(
        fc.uniqueArray(ids, { minLength: 3, maxLength: 3 }),
        fc.boolean(),
        (picked, useJoker) => {
          const p = pick(picked[0]!, picked[1]!, picked[2]!, useJoker);
          const first = score(p);
          expect(first.points).toBeGreaterThanOrEqual(0);
          expect(score(p)).toEqual(first);
        },
      ),
    );
  });
});
