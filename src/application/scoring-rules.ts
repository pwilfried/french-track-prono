import { UseCaseError } from "./errors";

/** One value of the scale, as stored in `scoring_rules` (key in snake case). */
export type ScoringRule = { key: string; value: number };

/** Port: the scale. Real adapter = Supabase (writes need an admin session), fake = in memory. */
export interface ScoringRuleRepository {
  list(): Promise<ScoringRule[]>;
  set(key: string, value: number): Promise<"saved" | "not_admin" | "unknown">;
}

/** The order the back-office shows the scale in: the podium, the flair and joker, then v0.9. */
export const RULE_ORDER = [
  "exact_slot",
  "wrong_place",
  "perfect_podium",
  "flair_bonus",
  "flair_threshold",
  "flair_min_players",
  "joker_multiplier",
  "odds_exact",
  "odds_one_off",
  "odds_two_off",
  "mark_exact",
  "mark_near",
] as const;

const position = (key: string) => {
  const index = RULE_ORDER.indexOf(key as (typeof RULE_ORDER)[number]);
  return index === -1 ? RULE_ORDER.length : index;
};

export function listScoringRules(ports: { rules: ScoringRuleRepository }) {
  return {
    async execute(): Promise<ScoringRule[]> {
      const rules = await ports.rules.list();
      return [...rules].sort((a, b) => position(a.key) - position(b.key));
    },
  };
}

/** The admin changes one value: positive; the flair threshold is a share, at most 1. */
export function setScoringRule(ports: { rules: ScoringRuleRepository }) {
  return {
    async execute(input: { key: string; value: number }): Promise<void> {
      const { key, value } = input;
      if (!Number.isFinite(value) || value <= 0 || (key === "flair_threshold" && value > 1)) {
        throw new UseCaseError("SCORING_RULE_INVALID");
      }
      const outcome = await ports.rules.set(key, value);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (outcome === "unknown") throw new UseCaseError("SCORING_RULE_UNKNOWN");
    },
  };
}
