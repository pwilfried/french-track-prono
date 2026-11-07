import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  flairContext,
  scorePrediction,
  type OfficialLine,
  type ScoringPrediction,
} from "./scoring";

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
