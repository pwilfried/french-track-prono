import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { REACTIONS, isReaction, pickDistribution, reactionCounts } from "./reveal";

describe("isReaction", () => {
  it("accepts the six reactions of the list", () => {
    for (const reaction of REACTIONS) expect(isReaction(reaction)).toBe(true);
  });

  it.each([["❤️"], ["lol"], [""], ["🔥🔥"]])("refuses %j", (value) => {
    expect(isReaction(value)).toBe(false);
  });
});

describe("pickDistribution", () => {
  it("gives the share of players who picked each winner, most picked first", () => {
    const picks = ["a", "b", "a", "c", "a", "b", "a", "a"].map((first) => ({ first }));

    expect(pickDistribution(picks)).toEqual([
      { athleteId: "a", count: 5, percent: 63 },
      { athleteId: "b", count: 2, percent: 25 },
      { athleteId: "c", count: 1, percent: 13 },
    ]);
  });

  it("is empty without prediction", () => {
    expect(pickDistribution([])).toEqual([]);
  });

  it("never depends on the order of the predictions", () => {
    const picks = fc.array(
      fc.constantFrom("a", "b", "c", "d").map((first) => ({ first })),
      {
        maxLength: 40,
      },
    );
    fc.assert(
      fc.property(picks, (list) => {
        expect(pickDistribution([...list].reverse())).toEqual(pickDistribution(list));
      }),
    );
  });

  it("counts every prediction once", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("a", "b", "c").map((first) => ({ first }))), (list) => {
        expect(pickDistribution(list).reduce((sum, s) => sum + s.count, 0)).toBe(list.length);
      }),
    );
  });
});

describe("reactionCounts", () => {
  it("counts each reaction in the order of the list and leaves out the absent ones", () => {
    expect(reactionCounts(["😂", "🔥", "😂"])).toEqual([
      { reaction: "🔥", count: 1 },
      { reaction: "😂", count: 2 },
    ]);
  });
});
