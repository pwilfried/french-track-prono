import { describe, expect, it } from "vitest";

import { isValidOfficialPodium } from "./official-result";

const podium = (...ranks: number[]) => ranks.map((rank, i) => ({ athleteId: `a${i}`, rank }));

describe("isValidOfficialPodium", () => {
  it.each([[[1, 2, 3]], [[1, 1, 3]], [[1, 2, 2]], [[1, 1, 1]], [[1, 2, 3, 3]]])(
    "accepts ranks %j",
    (ranks) => {
      expect(isValidOfficialPodium(podium(...ranks))).toBe(true);
    },
  );

  it.each([
    [[1, 2]],
    [[1, 2, 2, 3]],
    [[2, 3, 4]],
    [[1, 3, 3]],
    [[1, 2, 4]],
    [[0, 1, 2]],
    [[1, 2, 2.5]],
  ])("refuses ranks %j", (ranks) => {
    expect(isValidOfficialPodium(podium(...ranks))).toBe(false);
  });

  it("refuses the same athlete twice", () => {
    expect(
      isValidOfficialPodium([
        { athleteId: "a", rank: 1 },
        { athleteId: "a", rank: 2 },
        { athleteId: "b", rank: 3 },
      ]),
    ).toBe(false);
  });
});
