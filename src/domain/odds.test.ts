import { describe, expect, it } from "vitest";

import { isValidOdds, parseOdds } from "./odds";

const startList = ["a", "b", "c", "d", "e", "f", "g"];
const proposed = (n: number) =>
  startList.slice(0, n).map((athleteId, i) => ({ athleteId, odds: 1.5 + i }));

describe("isValidOdds", () => {
  it("accepts 5 or 6 athletes of the start list and odds for another athlete", () => {
    expect(isValidOdds({ proposed: proposed(5), other: 8 }, startList)).toBe(true);
    expect(isValidOdds({ proposed: proposed(6), other: 8 }, startList)).toBe(true);
  });

  it("refuses 4 or 7 athletes, a duplicate, an athlete off the start list, and odds of 1 or less", () => {
    expect(isValidOdds({ proposed: proposed(4), other: 8 }, startList)).toBe(false);
    expect(isValidOdds({ proposed: proposed(7), other: 8 }, startList)).toBe(false);
    expect(
      isValidOdds({ proposed: [...proposed(4), { athleteId: "a", odds: 3 }], other: 8 }, startList),
    ).toBe(false);
    expect(
      isValidOdds({ proposed: [...proposed(4), { athleteId: "z", odds: 3 }], other: 8 }, startList),
    ).toBe(false);
    expect(isValidOdds({ proposed: proposed(5), other: 1 }, startList)).toBe(false);
    expect(
      isValidOdds(
        { proposed: [...proposed(4), { athleteId: "e", odds: 0.9 }], other: 8 },
        startList,
      ),
    ).toBe(false);
  });
});

describe("parseOdds", () => {
  it("reads odds typed with a comma or a dot, to the hundredth", () => {
    expect(parseOdds("2,5")).toBe(2.5);
    expect(parseOdds(" 1.80 ")).toBe(1.8);
    expect(parseOdds("abc")).toBeNull();
    expect(parseOdds("")).toBeNull();
  });
});
