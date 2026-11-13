import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { managerBonusPoints, type ManagerRecord } from "./manager-bonus";
import { MANAGER_BONUSES, type ManagerBonus } from "./manager-rules";

// Distinct values, so that every sum tells which bonuses were counted.
const bonuses: Record<ManagerBonus, number> = {
  first: 1,
  second: 2,
  third: 4,
  personal_best: 8,
  season_best: 16,
  national_record: 32,
  area_record: 64,
  world_record: 128,
};

describe("managerBonusPoints", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
  ])("gives the bonus of place %i", (place, points) => {
    expect(managerBonusPoints({ place, records: [] }, bonuses)).toBe(points);
  });

  it("gives no place bonus from the fourth place on", () => {
    expect(managerBonusPoints({ place: 4, records: [] }, bonuses)).toBe(0);
    expect(managerBonusPoints({ place: 12, records: [] }, bonuses)).toBe(0);
  });

  it("gives no place bonus without a place (DNS, DNF, DQ)", () => {
    expect(managerBonusPoints({ place: null, records: [] }, bonuses)).toBe(0);
  });

  it.each([
    ["personal_best", 8],
    ["season_best", 16],
    ["national_record", 32],
    ["area_record", 64],
    ["world_record", 128],
  ] as const)("gives the bonus of a %s", (record, points) => {
    expect(managerBonusPoints({ place: 5, records: [record] }, bonuses)).toBe(points);
  });

  it("adds a win and a personal best", () => {
    expect(managerBonusPoints({ place: 1, records: ["personal_best"] }, bonuses)).toBe(9);
  });

  it("adds every bonus earned at once", () => {
    const records: ManagerRecord[] = [
      "personal_best",
      "season_best",
      "national_record",
      "area_record",
      "world_record",
    ];
    expect(managerBonusPoints({ place: 1, records }, bonuses)).toBe(1 + 8 + 16 + 32 + 64 + 128);
  });

  it("counts a record flagged twice once", () => {
    expect(
      managerBonusPoints({ place: null, records: ["season_best", "season_best"] }, bonuses),
    ).toBe(16);
  });

  it("uses the values of the league rules", () => {
    const rules = { ...bonuses, first: 10, personal_best: 3 };
    expect(managerBonusPoints({ place: 1, records: ["personal_best"] }, rules)).toBe(13);
  });

  it("gives nothing when the rules set every bonus to zero", () => {
    const zero = Object.fromEntries(MANAGER_BONUSES.map((b) => [b, 0])) as typeof bonuses;
    expect(managerBonusPoints({ place: 1, records: ["world_record"] }, zero)).toBe(0);
  });

  it("is never negative and never more than the sum of every bonus", () => {
    const records = fc.uniqueArray(
      fc.constantFrom<ManagerRecord>(
        "personal_best",
        "season_best",
        "national_record",
        "area_record",
        "world_record",
      ),
    );
    const place = fc.option(fc.integer({ min: 1, max: 40 }));
    const values = fc.record(
      Object.fromEntries(MANAGER_BONUSES.map((b) => [b, fc.nat({ max: 100 })])) as Record<
        ManagerBonus,
        fc.Arbitrary<number>
      >,
    );
    fc.assert(
      fc.property(place, records, values, (p, r, v) => {
        const points = managerBonusPoints({ place: p, records: r }, v);
        const max = MANAGER_BONUSES.reduce((sum, b) => sum + v[b], 0);
        return points >= 0 && points <= max;
      }),
    );
  });
});
