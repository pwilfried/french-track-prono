import { describe, expect, it } from "vitest";

import { firstInvalidOdds, isValidOdds, parseOdds, pickChoices } from "./odds";
import { OTHER_ATHLETE } from "./podium-draft";

const startList = ["a", "b", "c", "d", "e", "f", "g"];
const proposed = (n: number) =>
  startList.slice(0, n).map((athleteId, i) => ({ athleteId, odds: 1.5 + i }));

describe("isValidOdds", () => {
  it("accepts any number of athletes of the start list, from one, and odds for another athlete", () => {
    expect(isValidOdds({ proposed: proposed(1), other: 8 }, startList)).toBe(true);
    expect(isValidOdds({ proposed: proposed(7), other: 8 }, startList)).toBe(true);
  });

  it("accepts odds of 1 or below, as long as they are positive", () => {
    expect(isValidOdds({ proposed: [{ athleteId: "a", odds: 1 }], other: 1 }, startList)).toBe(
      true,
    );
    expect(isValidOdds({ proposed: [{ athleteId: "a", odds: 0.5 }], other: 2 }, startList)).toBe(
      true,
    );
  });

  it("refuses no athlete, a duplicate, an athlete off the start list, and odds of 0", () => {
    expect(isValidOdds({ proposed: [], other: 8 }, startList)).toBe(false);
    expect(
      isValidOdds({ proposed: [...proposed(2), { athleteId: "a", odds: 3 }], other: 8 }, startList),
    ).toBe(false);
    expect(isValidOdds({ proposed: [{ athleteId: "z", odds: 3 }], other: 8 }, startList)).toBe(
      false,
    );
    expect(isValidOdds({ proposed: [{ athleteId: "a", odds: 0 }], other: 8 }, startList)).toBe(
      false,
    );
    expect(isValidOdds({ proposed: proposed(2), other: 0 }, startList)).toBe(false);
  });
});

describe("firstInvalidOdds", () => {
  it("names the first line whose odds cannot be read or are not positive", () => {
    expect(
      firstInvalidOdds(
        [
          { athleteId: "a", text: "2" },
          { athleteId: "b", text: "0" },
        ],
        "8",
      ),
    ).toBe("b");
    expect(firstInvalidOdds([{ athleteId: "a", text: "deux" }], "8")).toBe("a");
    expect(firstInvalidOdds([{ athleteId: "a", text: "1,00" }], "")).toBe(OTHER_ATHLETE);
    expect(firstInvalidOdds([{ athleteId: "a", text: "1,00" }], "20")).toBeNull();
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
