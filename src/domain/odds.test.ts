import { describe, expect, it } from "vitest";

import { isValidOdds, parseOdds, pickChoices } from "./odds";
import { OTHER_ATHLETE } from "./podium-draft";

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

describe("pickChoices", () => {
  const entry = (athleteId: string, name: string) => ({
    athleteId,
    slug: athleteId,
    name,
    countryCode: "FRA",
    seasonBest: null,
  });

  it("offers the proposed athletes, favourite first, then « autre athlète »", () => {
    const choices = pickChoices(
      [entry("a", "Ana"), entry("b", "Bea"), entry("c", "Cleo")],
      {
        proposed: [
          { athleteId: "b", odds: 4 },
          { athleteId: "a", odds: 1.8 },
        ],
        other: 9,
      },
      new Map([["a", { athleteId: "a", pr: "10.98", sb: "11.04" }]]),
      "Autre athlète",
    );

    expect(choices.map((c) => [c.athleteId, c.odds, c.personalBest])).toEqual([
      ["a", 1.8, "10.98"],
      ["b", 4, null],
      [OTHER_ATHLETE, 9, null],
    ]);
    expect(choices[0]?.seasonBest).toBe("11.04");
    expect(choices[2]?.name).toBe("Autre athlète");
  });
});
