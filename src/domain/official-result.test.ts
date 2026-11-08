import { describe, expect, it } from "vitest";

import { isValidOfficialPodium, missingPodiumRanks } from "./official-result";

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

describe("missingPodiumRanks", () => {
  const line = (athleteId: string, rank: number) => ({ athleteId, rank });

  it("finds no missing rank on a full podium, with or without ties", () => {
    expect(missingPodiumRanks([line("A", 1), line("B", 2), line("C", 3)])).toEqual([]);
    expect(missingPodiumRanks([line("A", 1), line("B", 1), line("C", 3)])).toEqual([]);
    expect(missingPodiumRanks([line("A", 1), line("B", 2), line("C", 2)])).toEqual([]);
  });

  it("names the ranks still empty on a podium of two", () => {
    expect(missingPodiumRanks([line("A", 1), line("B", 2)])).toEqual([3]);
    expect(missingPodiumRanks([line("A", 1)])).toEqual([2, 3]);
    expect(missingPodiumRanks([])).toEqual([1, 2, 3]);
  });
});
