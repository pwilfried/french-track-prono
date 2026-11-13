import { describe, expect, it } from "vitest";

import { isPlayableManagerRules, type ManagerRules } from "./manager-rules";

const rules: ManagerRules = {
  budget: 100,
  minTeamSize: 4,
  quotas: [
    { sex: "F", family: "sprint", min: 1, max: 2 },
    { sex: "M", family: "sprint", min: 1, max: 2 },
    { sex: "F", family: "throws", min: 0, max: 1 },
  ],
  lineup: { max: 3, minPerFamily: { sprint: 2 } },
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
};

describe("isPlayableManagerRules", () => {
  it("accepts rules a team can be completed and lined up with", () => {
    expect(isPlayableManagerRules(rules)).toBe(true);
  });

  it("accepts a lineup as large as the minimum team", () => {
    expect(isPlayableManagerRules({ ...rules, lineup: { max: 4, minPerFamily: {} } })).toBe(true);
  });

  it.each<[string, Partial<ManagerRules>]>([
    ["no budget", { budget: 0 }],
    ["a budget with cents", { budget: 10.5 }],
    ["a minimum team the quotas cannot fill", { minTeamSize: 6 }],
    ["a minimum team smaller than the quota minimums", { minTeamSize: 1 }],
    [
      "a quota whose minimum is above its maximum",
      { quotas: [{ sex: "F", family: "sprint", min: 3, max: 2 }] },
    ],
    [
      "the same quota twice",
      {
        quotas: [
          { sex: "F", family: "sprint", min: 0, max: 2 },
          { sex: "F", family: "sprint", min: 0, max: 2 },
        ],
      },
    ],
    ["a minimum team that does not cover the lineup", { lineup: { max: 5, minPerFamily: {} } }],
    ["lineup minimums above the lineup size", { lineup: { max: 3, minPerFamily: { sprint: 4 } } }],
    ["a bidding round of no hours", { rounds: { firstHours: 0, longRounds: 2, nextHours: 24 } }],
    ["no way to close the mercato", { closeModes: [] }],
    ["a negative bonus", { bonuses: { ...rules.bonuses, world_record: -1 } }],
    [
      "a season ending before it starts",
      { season: { startsOn: "2027-12-31", endsOn: "2027-01-01" } },
    ],
    [
      "a season date that is not a date",
      { season: { startsOn: "2027-02-30x", endsOn: "2027-12-31" } },
    ],
  ])("refuses %s", (_, change) => {
    expect(isPlayableManagerRules({ ...rules, ...change })).toBe(false);
  });
});
