import { describe, expect, it } from "vitest";

import { DISCIPLINE_FAMILIES } from "./discipline";
import {
  isPlayableManagerRules,
  MANAGER_FAMILIES,
  managerFamilyOf,
  type ManagerRules,
} from "./manager-rules";

/** The rules decided by the owner on 16 Nov. 2026 (#1017). */
const rules: ManagerRules = {
  budget: 100,
  minTeamSize: 12,
  quotas: MANAGER_FAMILIES.map((family) => ({ family, min: 3, minPerSex: 1, maxPerSex: 4 })),
  lineup: { max: 8, perFamily: 2, bench: 4 },
  tablesDivisor: 10,
  rounds: { firstHours: 48, longRounds: 2, nextHours: 24 },
  closeModes: ["budgets_spent", "scheduled"],
  bonuses: {
    first: 10,
    second: 6,
    third: 3,
    personal_best: 5,
    season_best: 3,
    national_record: 10,
    area_record: 15,
    world_record: 25,
  },
  season: { startsOn: "2027-01-01", endsOn: "2027-12-31" },
  pricing: {
    grid: [
      { minPoints: 1200, price: 20 },
      { minPoints: 0, price: 2 },
    ],
    oldMarkPenalty: 0.05,
    unfitFactor: 0.5,
    rarelyFactor: 0.6,
  },
};

const withQuota = (change: Partial<ManagerRules["quotas"][number]>): ManagerRules => ({
  ...rules,
  quotas: rules.quotas.map((q) => (q.family === "throws" ? { ...q, ...change } : q)),
});

describe("managerFamilyOf", () => {
  it.each([
    ["sprint", "sprint"],
    ["hurdles", "sprint"],
    ["middle", "distance"],
    ["long", "distance"],
    ["horizontal_jumps", "jumps"],
    ["vertical_jumps", "jumps"],
    ["combined", "jumps"],
    ["throws", "throws"],
  ] as const)("puts %s in the %s family", (discipline, family) => {
    expect(managerFamilyOf(discipline)).toBe(family);
  });

  it("puts every discipline but relays in exactly one of the four families", () => {
    for (const family of DISCIPLINE_FAMILIES.filter((f) => f !== "relay")) {
      expect(MANAGER_FAMILIES.filter((f) => f === managerFamilyOf(family))).toHaveLength(1);
    }
  });

  it("leaves relays out of the Manager", () => {
    expect(managerFamilyOf("relay")).toBeNull();
  });
});

describe("isPlayableManagerRules", () => {
  it("accepts the rules of 16 Nov. 2026: four families of two places, a bench of four", () => {
    expect(isPlayableManagerRules(rules)).toBe(true);
  });

  it.each<[string, ManagerRules]>([
    ["no budget", { ...rules, budget: 0 }],
    ["a budget with cents", { ...rules, budget: 10.5 }],
    ["a minimum team the quotas cannot fill", { ...rules, minTeamSize: 33 }],
    ["a minimum team smaller than the family minimums", { ...rules, minTeamSize: 11 }],
    ["a family without a quota", { ...rules, quotas: rules.quotas.slice(1) }],
    ["the same family twice", { ...rules, quotas: [...rules.quotas, rules.quotas[0]!] }],
    ["a minimum per sex above the maximum", withQuota({ minPerSex: 5 })],
    ["a family minimum both sexes cannot reach", withQuota({ min: 9 })],
    ["a family whose minimum does not cover its places", withQuota({ min: 1, minPerSex: 0 })],
    [
      "starters and bench above the minimum team",
      { ...rules, lineup: { ...rules.lineup, bench: 5 } },
    ],
    [
      "a lineup that is not two places per family",
      { ...rules, lineup: { ...rules.lineup, max: 7 } },
    ],
    ["no place per family", { ...rules, lineup: { max: 0, perFamily: 0, bench: 4 } }],
    ["a negative bench", { ...rules, lineup: { ...rules.lineup, bench: -1 } }],
    ["no table divisor", { ...rules, tablesDivisor: 0 }],
    ["a table divisor with decimals", { ...rules, tablesDivisor: 2.5 }],
    [
      "a bidding round of no hours",
      { ...rules, rounds: { firstHours: 0, longRounds: 2, nextHours: 24 } },
    ],
    ["no way to close the mercato", { ...rules, closeModes: [] }],
    ["a negative bonus", { ...rules, bonuses: { ...rules.bonuses, world_record: -1 } }],
    ["a price grid without a step", { ...rules, pricing: { ...rules.pricing, grid: [] } }],
    [
      "a season ending before it starts",
      { ...rules, season: { startsOn: "2027-12-31", endsOn: "2027-01-01" } },
    ],
    [
      "a season date that is not a date",
      { ...rules, season: { startsOn: "2027-02-30x", endsOn: "2027-12-31" } },
    ],
  ])("refuses %s", (_, changed) => {
    expect(isPlayableManagerRules(changed)).toBe(false);
  });

  it("never accepts a lineup larger than the minimum team", () => {
    for (let minTeamSize = 1; minTeamSize <= 16; minTeamSize++) {
      for (let perFamily = 1; perFamily <= 4; perFamily++) {
        const changed = {
          ...rules,
          minTeamSize,
          lineup: { max: perFamily * 4, perFamily, bench: 0 },
          quotas: rules.quotas.map((q) => ({ ...q, min: perFamily, minPerSex: 0 })),
        };
        if (isPlayableManagerRules(changed)) {
          expect(changed.lineup.max).toBeLessThanOrEqual(minTeamSize);
        }
      }
    }
  });
});
