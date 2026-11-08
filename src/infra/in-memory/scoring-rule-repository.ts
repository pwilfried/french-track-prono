import type { ScoringRule, ScoringRuleRepository } from "@/application/scoring-rules";

/** Test double of the ScoringRuleRepository port: one store, a session per player. */
export function createInMemoryScoringRuleStore(rules: ScoringRule[]) {
  const stored = rules.map((r) => ({ ...r }));
  return {
    session(options: { isAdmin: boolean }): ScoringRuleRepository {
      return {
        async list() {
          return stored.map((r) => ({ ...r }));
        },
        async set(key, value) {
          if (!options.isAdmin) return "not_admin";
          const found = stored.find((r) => r.key === key);
          if (!found) return "unknown";
          found.value = value;
          return "saved";
        },
      };
    },
  };
}
