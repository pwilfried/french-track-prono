import { describe, expect, it } from "vitest";

import type { Discipline } from "./discipline";
import {
  isValidManagerPricing,
  suggestManagerPrice,
  type ManagerPricing,
  type PriceInput,
} from "./manager-price";

const pricing: ManagerPricing = {
  grid: [
    { minPoints: 1200, price: 20 },
    { minPoints: 1150, price: 12 },
    { minPoints: 1100, price: 7 },
    { minPoints: 1050, price: 4 },
    { minPoints: 0, price: 2 },
  ],
  oldMarkPenalty: 0.05,
  unfitFactor: 0.5,
  rarelyFactor: 0.6,
};

const sprint: Discipline = {
  name: "100 m",
  family: "sprint",
  unit: "time",
  lowerIsBetter: true,
  tolerance: 0.1,
};
const longJump: Discipline = {
  name: "Saut en longueur",
  family: "horizontal_jumps",
  unit: "distance",
  lowerIsBetter: false,
  tolerance: 0.1,
};

const athlete = (input: Partial<PriceInput>): PriceInput => ({
  sex: "M",
  discipline: sprint,
  records: [],
  condition: "fit",
  presence: "sometimes",
  today: "2026-11-16",
  ...input,
});

describe("suggestManagerPrice", () => {
  it("prices a recent season best over an old personal best", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        records: [
          { kind: "pr", mark: "9.90", date: "2019-07-01" },
          { kind: "sb", mark: "10.10", date: "2026-06-01" },
        ],
      }),
      pricing,
    );
    expect(suggestion).toEqual({ price: 12, mark: "10.10", points: 1172, basis: "recent" });
  });

  it("keeps the best of the marks of the last 12 months", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        records: [
          { kind: "pr", mark: "9.90", date: "2026-07-01" },
          { kind: "sb", mark: "10.10", date: "2026-06-01" },
        ],
      }),
      pricing,
    );
    expect(suggestion).toMatchObject({ price: 20, mark: "9.90", basis: "recent" });
  });

  it("counts a mark dated less than 12 months ago as recent", () => {
    const suggestion = suggestManagerPrice(
      athlete({ records: [{ kind: "sb", mark: "9.90", date: "2025-11-17" }] }),
      pricing,
    );
    expect(suggestion?.basis).toBe("recent");
  });

  it("degrades an old personal best by 5 % when no mark is recent (a slower time)", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        records: [
          { kind: "pr", mark: "9.80", date: "2020-08-01" },
          { kind: "sb", mark: "10.40", date: "2024-06-01" },
        ],
      }),
      pricing,
    );
    expect(suggestion).toMatchObject({ price: 7, mark: "9.80", basis: "old_pb" });
  });

  it("degrades an old personal best by 5 % when no mark is recent (a shorter jump)", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        discipline: longJump,
        records: [{ kind: "pr", mark: "8.40", date: null }],
      }),
      pricing,
    );
    expect(suggestion).toMatchObject({ price: 7, points: 1133, basis: "old_pb" });
  });

  it.each([["doubtful"], ["out"]] as const)("halves the price of a %s athlete", (condition) => {
    const suggestion = suggestManagerPrice(
      athlete({ condition, records: [{ kind: "pr", mark: "9.90", date: "2026-07-01" }] }),
      pricing,
    );
    expect(suggestion?.price).toBe(10);
  });

  it("multiplies by 0.6 the price of an athlete rarely seen in France", () => {
    const suggestion = suggestManagerPrice(
      athlete({ presence: "rarely", records: [{ kind: "pr", mark: "9.90", date: "2026-07-01" }] }),
      pricing,
    );
    expect(suggestion?.price).toBe(12);
  });

  it("rounds to the nearest whole credit", () => {
    const suggestion = suggestManagerPrice(
      athlete({ presence: "rarely", records: [{ kind: "pr", mark: "10.20", date: "2026-07-01" }] }),
      pricing,
    );
    expect(suggestion?.price).toBe(4);
  });

  it("never suggests a price under 1", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        condition: "out",
        presence: "rarely",
        records: [{ kind: "pr", mark: "11.50", date: "2026-07-01" }],
      }),
      { ...pricing, grid: [{ minPoints: 0, price: 1 }] },
    );
    expect(suggestion?.price).toBe(1);
  });

  it("suggests nothing for a discipline without a scoring table", () => {
    const suggestion = suggestManagerPrice(
      athlete({
        discipline: { ...sprint, name: "60 m" },
        records: [{ kind: "pr", mark: "6.50", date: "2026-02-01" }],
      }),
      pricing,
    );
    expect(suggestion).toBeNull();
  });

  it("suggests nothing without a recent mark or a personal best", () => {
    const suggestion = suggestManagerPrice(
      athlete({ records: [{ kind: "sb", mark: "10.00", date: "2023-06-01" }] }),
      pricing,
    );
    expect(suggestion).toBeNull();
  });

  it("suggests nothing without a main discipline or for a mixed team", () => {
    const records = [{ kind: "pr" as const, mark: "9.90", date: "2026-07-01" }];
    expect(suggestManagerPrice(athlete({ discipline: null, records }), pricing)).toBeNull();
    expect(suggestManagerPrice(athlete({ sex: "X", records }), pricing)).toBeNull();
  });
});

describe("isValidManagerPricing", () => {
  it("accepts the default pricing", () => {
    expect(isValidManagerPricing(pricing)).toBe(true);
  });

  it.each<[string, Partial<ManagerPricing>]>([
    ["no step", { grid: [] }],
    [
      "steps not from the highest points down",
      {
        grid: [
          { minPoints: 1100, price: 7 },
          { minPoints: 1200, price: 20 },
        ],
      },
    ],
    ["a price with cents", { grid: [{ minPoints: 0, price: 2.5 }] }],
    ["a penalty of 100 %", { oldMarkPenalty: 1 }],
    ["a factor of 0", { unfitFactor: 0 }],
    ["a factor above 1", { rarelyFactor: 1.2 }],
  ])("refuses %s", (_, change) => {
    expect(isValidManagerPricing({ ...pricing, ...change })).toBe(false);
  });
});
