import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { consensus, roundedShares, type ConsensusPodium } from "./consensus";

const podium = (first: string, second: string, third: string, mine = false): ConsensusPodium => ({
  podium: { first, second, third },
  mine,
});

describe("roundedShares", () => {
  it("rounds whole percentages that always add up to 100", () => {
    expect(roundedShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundedShares([2, 1])).toEqual([67, 33]);
    expect(roundedShares([5, 2, 1])).toEqual([63, 25, 12]);
  });

  it("gives the leftover points to the largest remainders, the first one on a tie", () => {
    expect(roundedShares([1, 1, 1, 1, 1, 1])).toEqual([17, 17, 17, 17, 16, 16]);
  });

  it("is empty without count", () => {
    expect(roundedShares([])).toEqual([]);
  });

  it("always totals 100 % and never moves a share by a whole point", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 12 }),
        (counts) => {
          const shares = roundedShares(counts);
          const total = counts.reduce((sum, c) => sum + c, 0);
          expect(shares.reduce((sum, s) => sum + s, 0)).toBe(100);
          shares.forEach((share, i) => {
            expect(Math.abs(share - (counts[i]! / total) * 100)).toBeLessThan(1);
          });
        },
      ),
    );
  });
});

describe("consensus", () => {
  const field = [
    podium("a", "b", "c", true),
    podium("a", "b", "c"),
    podium("a", "c", "b"),
    podium("b", "a", "d"),
  ];

  it("gives each place its athletes with their share, most picked first, my choice marked", () => {
    const result = consensus(field);

    expect(result.total).toBe(4);
    expect(result.places.first).toEqual([
      { athleteId: "a", count: 3, percent: 75, mine: true },
      { athleteId: "b", count: 1, percent: 25, mine: false },
    ]);
    expect(result.places.second).toEqual([
      { athleteId: "b", count: 2, percent: 50, mine: true },
      { athleteId: "a", count: 1, percent: 25, mine: false },
      { athleteId: "c", count: 1, percent: 25, mine: false },
    ]);
    expect(result.places.third).toEqual([
      { athleteId: "c", count: 2, percent: 50, mine: true },
      { athleteId: "b", count: 1, percent: 25, mine: false },
      { athleteId: "d", count: 1, percent: 25, mine: false },
    ]);
  });

  it("gives the share of players who have exactly my podium, me included", () => {
    expect(consensus(field).samePodium).toEqual({ count: 2, percent: 50 });
  });

  it("finds my most original choice: the place where I agree with the fewest players", () => {
    const result = consensus([
      podium("a", "b", "d", true),
      podium("a", "b", "c"),
      podium("a", "c", "b"),
      podium("a", "b", "c"),
    ]);

    expect(result.boldest).toEqual({ place: "third", athleteId: "d", count: 1, percent: 25 });
  });

  it("keeps the highest place when my choices are equally original", () => {
    const result = consensus([podium("a", "b", "c", true), podium("d", "e", "f")]);

    expect(result.boldest).toEqual({ place: "first", athleteId: "a", count: 1, percent: 50 });
  });

  it("has no podium of mine to compare when I did not predict", () => {
    const result = consensus([podium("a", "b", "c")]);

    expect(result.samePodium).toBeNull();
    expect(result.boldest).toBeNull();
    expect(result.places.first[0]!.mine).toBe(false);
  });

  it("is empty without prediction", () => {
    expect(consensus([])).toEqual({
      total: 0,
      places: { first: [], second: [], third: [] },
      samePodium: null,
      boldest: null,
      perfect: null,
    });
  });

  it("says nothing of the perfect podium before the result", () => {
    expect(consensus(field).perfect).toBeNull();
    expect(consensus(field, []).perfect).toBeNull();
  });

  it("gives the share of players who found the perfect podium once the result is in", () => {
    const official = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
    ];

    expect(consensus(field, official).perfect).toEqual({ count: 2, percent: 50 });
  });

  it("counts a tied athlete as found at the place they share", () => {
    const official = [
      { athleteId: "a", rank: 1 },
      { athleteId: "c", rank: 2 },
      { athleteId: "b", rank: 2 },
    ];

    expect(consensus(field, official).perfect).toEqual({ count: 0, percent: 0 });
    expect(
      consensus(
        [podium("a", "c", "b")],
        [
          { athleteId: "a", rank: 1 },
          { athleteId: "c", rank: 2 },
          { athleteId: "b", rank: 3 },
          { athleteId: "d", rank: 3 },
        ],
      ).perfect,
    ).toEqual({ count: 1, percent: 100 });
  });

  it("never depends on the order the predictions arrive in", () => {
    const athlete = fc.constantFrom("a", "b", "c", "d", "e");
    const entry = fc
      .uniqueArray(athlete, { minLength: 3, maxLength: 3 })
      .map(([first, second, third]) => podium(first!, second!, third!));
    const list = fc
      .tuple(
        fc.array(entry, { maxLength: 30 }),
        entry.map((p) => ({ ...p, mine: true })),
      )
      .chain(([others, mine]) =>
        fc.shuffledSubarray([...others, mine], { minLength: others.length + 1 }),
      );
    const official = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 3 },
    ];
    fc.assert(
      fc.property(list, fc.boolean(), (podiums, withResult) => {
        const result = withResult ? official : undefined;
        expect(consensus([...podiums].reverse(), result)).toEqual(consensus(podiums, result));
      }),
    );
  });
});
