import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  PREDICTION_JOKERS,
  isPredictionJoker,
  jokerHand,
  jokerPoints,
  pointsWithJoker,
} from "./league-jokers";
import { OTHER_ATHLETE } from "./podium-draft";
import { DEFAULT_RULES, scorePrediction, type OfficialLine } from "./scoring";

const standard: OfficialLine[] = [
  { athleteId: "A", rank: 1 },
  { athleteId: "B", rank: 2 },
  { athleteId: "C", rank: 3 },
  { athleteId: "D", rank: 4 },
];
const noCrowd = { predictionCount: 100, winnerPicks: { A: 50 } };
const pick = (first: string, second: string, third: string) => ({ first, second, third });
const jokers = (first: string, second: string, third: string) =>
  jokerPoints(pick(first, second, third), standard, DEFAULT_RULES, noCrowd);

// The odds case of S14 to S18: A 2, B 3, C 1.5 proposed, other 8; X (not proposed) 3rd, C 4th.
const bets = {
  odds: {
    proposed: [
      { athleteId: "A", odds: 2 },
      { athleteId: "B", odds: 3 },
      { athleteId: "C", odds: 1.5 },
    ],
    other: 8,
  },
  tolerance: null,
};
const withOdds: OfficialLine[] = [
  { athleteId: "A", rank: 1 },
  { athleteId: "B", rank: 2 },
  { athleteId: "X", rank: 3 },
  { athleteId: "C", rank: 4 },
];

describe("jokerPoints", () => {
  it("J1 doubles the points of a perfect podium", () => {
    expect(jokers("A", "B", "C").double).toBe(24);
  });

  it("J2 triples a perfect podium and gives nothing otherwise with all or nothing", () => {
    expect(jokers("A", "B", "C").all_or_nothing).toBe(36);
    expect(jokers("A", "C", "B").all_or_nothing).toBe(0);
  });

  it("J3 counts the misplaced athletes as well placed with the safety net, without the perfect podium bonus", () => {
    // Plain: 3 + 1 + 1 = 5. Safety net: 3 + 3 + 3, no bonus: the podium was not perfect.
    expect(jokers("A", "C", "B").safety_net).toBe(9);
    expect(jokers("B", "C", "A").safety_net).toBe(9);
    // A true perfect podium keeps its bonus.
    expect(jokers("A", "B", "C").safety_net).toBe(12);
  });

  it("J4 gives the odds at the right place to a misplaced athlete with the safety net", () => {
    // C, A, autre: plain 32 (1 + 3, odds 2 × 2 + 8 × 3). Safety net: A 3 + 2 × 3, other 3 + 24.
    const points = jokerPoints(
      pick("C", "A", OTHER_ATHLETE),
      withOdds,
      DEFAULT_RULES,
      noCrowd,
      bets,
    );
    expect(points.safety_net).toBe(36);
  });

  it("J5 doubles the odds points of « autre athlète » with the outsider", () => {
    // C, A, autre: 1 + 3 + 4 + 24 × 2.
    const points = jokerPoints(
      pick("C", "A", OTHER_ATHLETE),
      withOdds,
      DEFAULT_RULES,
      noCrowd,
      bets,
    );
    expect(points.outsider).toBe(56);
    // Without « autre athlète » on the podium, nothing changes.
    expect(jokerPoints(pick("A", "B", "C"), withOdds, DEFAULT_RULES, noCrowd, bets).outsider).toBe(
      21,
    );
  });

  it("J6 leaves the points as they are with the spy", () => {
    expect(jokers("A", "C", "B").spy).toBe(5);
  });

  it("never gives less than 0 nor changes when run again", () => {
    const ids = fc.constantFrom("A", "B", "C", "X", OTHER_ATHLETE);
    fc.assert(
      fc.property(fc.uniqueArray(ids, { minLength: 3, maxLength: 3 }), ([a, b, c]) => {
        const p = pick(a!, b!, c!);
        const once = jokerPoints(p, withOdds, DEFAULT_RULES, noCrowd, bets);
        const plain = scorePrediction(p, withOdds, DEFAULT_RULES, noCrowd, bets).points;
        for (const joker of PREDICTION_JOKERS) expect(once[joker]).toBeGreaterThanOrEqual(0);
        expect(once.safety_net).toBeGreaterThanOrEqual(plain);
        expect(once.outsider).toBeGreaterThanOrEqual(plain);
        expect(jokerPoints(p, withOdds, DEFAULT_RULES, noCrowd, bets)).toEqual(once);
      }),
    );
  });
});

describe("pointsWithJoker", () => {
  it("counts the points of the joker played, the general points without one", () => {
    const line = { points: 5, jokers: jokers("A", "C", "B") };
    expect(pointsWithJoker(line, "safety_net")).toBe(9);
    expect(pointsWithJoker(line, null)).toBe(5);
  });

  it("counts the general points of a line computed before the league jokers", () => {
    expect(pointsWithJoker({ points: 5 }, "double")).toBe(5);
  });
});

describe("jokerHand", () => {
  const all = [...PREDICTION_JOKERS];

  it("lists the jokers left and the ones played, with their event", () => {
    const hand = jokerHand(all, [{ joker: "double", eventId: "e1" }], { id: "e2", open: true });
    expect(hand.remaining).toEqual(["all_or_nothing", "safety_net", "spy", "outsider"]);
    expect(hand.used).toEqual([{ joker: "double", eventId: "e1" }]);
    expect(hand.onEvent).toBeNull();
  });

  it("lets the joker of an open event change, never the spy nor after the lock", () => {
    const double = [{ joker: "double" as const, eventId: "e1" }];
    expect(jokerHand(all, double, { id: "e1", open: true }).canChange).toBe(true);
    expect(jokerHand(all, double, { id: "e1", open: false }).canChange).toBe(false);
    const spy = [{ joker: "spy" as const, eventId: "e1" }];
    expect(jokerHand(all, spy, { id: "e1", open: true })).toMatchObject({
      onEvent: "spy",
      canChange: false,
    });
  });

  it("only offers the jokers the league received", () => {
    expect(jokerHand(["double", "spy"], []).remaining).toEqual(["double", "spy"]);
  });

  it("recognises a joker of the prediction leagues", () => {
    expect(isPredictionJoker("outsider")).toBe(true);
    expect(isPredictionJoker("joker")).toBe(false);
  });
});
