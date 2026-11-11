import { describe, expect, it } from "vitest";

import type { ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";
import { setManagerRules, type ManagerRuleRepository, type ManagerRuleSet } from "./manager-rules";

const rules: ManagerRules = {
  budget: 100,
  teamSize: 2,
  quotas: [
    { sex: "F", family: "sprint", min: 1, max: 1 },
    { sex: "M", family: "sprint", min: 1, max: 1 },
  ],
  lineup: { max: 2, minPerFamily: { sprint: 1 } },
  rounds: { firstHours: 48, longRounds: 2, nextHours: 24 },
  closeModes: ["scheduled"],
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

function repository(outcome: "saved" | "not_admin" | "unknown_competition" = "saved") {
  const saved: ManagerRuleSet[] = [];
  const repo: ManagerRuleRepository = {
    get: async () => saved.at(-1) ?? { rules, competitionSlugs: [] },
    save: async (set) => {
      if (outcome === "saved") saved.push(set);
      return outcome;
    },
  };
  return { repo, saved };
}

describe("setManagerRules", () => {
  it("lets the admin set the budget and the eligible competitions, each competition once", async () => {
    const { repo, saved } = repository();

    await setManagerRules({ rules: repo }).execute({
      rules: { ...rules, budget: 150 },
      competitionSlugs: ["meeting-paris", "meeting-paris"],
    });

    expect(saved).toEqual([
      { rules: { ...rules, budget: 150 }, competitionSlugs: ["meeting-paris"] },
    ]);
  });

  it("refuses rules a team cannot be built with, before writing anything", async () => {
    const { repo, saved } = repository();

    await expect(
      setManagerRules({ rules: repo }).execute({
        rules: { ...rules, teamSize: 5 },
        competitionSlugs: [],
      }),
    ).rejects.toEqual(new UseCaseError("MANAGER_RULES_INVALID"));
    expect(saved).toEqual([]);
  });

  it.each([
    ["not_admin", "NOT_ADMIN"],
    ["unknown_competition", "COMPETITION_NOT_FOUND"],
  ] as const)("turns %s into %s", async (outcome, code) => {
    const { repo } = repository(outcome);

    await expect(
      setManagerRules({ rules: repo }).execute({ rules, competitionSlugs: ["x"] }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});
