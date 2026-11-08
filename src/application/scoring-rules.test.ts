import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  listScoringRules,
  setScoringRule,
  type ScoringRule,
  type ScoringRuleRepository,
} from "./scoring-rules";

function repository(rules: ScoringRule[]) {
  const changes: ScoringRule[] = [];
  const repo: ScoringRuleRepository = {
    list: async () => rules,
    set: async (key, value) => {
      if (!rules.some((r) => r.key === key)) return "unknown";
      changes.push({ key, value });
      return "saved";
    },
  };
  return { repo, changes };
}

describe("listScoringRules", () => {
  it("lists the podium points first and the v0.9 odds and marks after", async () => {
    const { repo } = repository([
      { key: "mark_exact", value: 5 },
      { key: "odds_exact", value: 3 },
      { key: "exact_slot", value: 3 },
    ]);

    const keys = (await listScoringRules({ rules: repo }).execute()).map((r) => r.key);

    expect(keys).toEqual(["exact_slot", "odds_exact", "mark_exact"]);
  });
});

describe("setScoringRule", () => {
  it("lets the admin change the points of a mark within the tolerance", async () => {
    const { repo, changes } = repository([{ key: "mark_exact", value: 5 }]);

    await setScoringRule({ rules: repo }).execute({ key: "mark_exact", value: 6 });

    expect(changes).toEqual([{ key: "mark_exact", value: 6 }]);
  });

  it.each([
    ["zero", "mark_exact", 0],
    ["a negative value", "odds_exact", -1],
    ["a flair threshold above 1", "flair_threshold", 1.5],
  ])("refuses %s with SCORING_RULE_INVALID", async (_, key, value) => {
    const { repo, changes } = repository([{ key, value: 1 }]);

    await expect(setScoringRule({ rules: repo }).execute({ key, value })).rejects.toEqual(
      new UseCaseError("SCORING_RULE_INVALID"),
    );
    expect(changes).toEqual([]);
  });

  it("refuses an unknown rule with SCORING_RULE_UNKNOWN", async () => {
    const { repo } = repository([]);

    await expect(
      setScoringRule({ rules: repo }).execute({ key: "bonus", value: 2 }),
    ).rejects.toEqual(new UseCaseError("SCORING_RULE_UNKNOWN"));
  });
});
