import { cache } from "react";

import { UseCaseError } from "@/application/errors";
import { listScoringRules } from "@/application/scoring-rules";
import { DEFAULT_RULES } from "@/domain/scoring";

import { publicScale } from "./public-data";

/**
 * The scale as stored (the admin can change it; kept across requests, see public-data.ts); the
 * defaults when it cannot be read.
 */
export const loadScale = cache(async (): Promise<Record<string, number>> => {
  const defaults: Record<string, number> = {
    exact_slot: DEFAULT_RULES.exactSlot,
    wrong_place: DEFAULT_RULES.wrongPlace,
    perfect_podium: DEFAULT_RULES.perfectPodium,
    flair_bonus: DEFAULT_RULES.flairBonus,
    flair_threshold: DEFAULT_RULES.flairThreshold,
    flair_min_players: DEFAULT_RULES.flairMinPlayers,
    joker_multiplier: DEFAULT_RULES.jokerMultiplier,
    odds_exact: DEFAULT_RULES.oddsExact,
    odds_one_off: DEFAULT_RULES.oddsOneOff,
    odds_two_off: DEFAULT_RULES.oddsTwoOff,
    mark_exact: DEFAULT_RULES.markExact,
    mark_near: DEFAULT_RULES.markNear,
  };
  try {
    const rules = await listScoringRules({
      rules: publicScale(),
    }).execute();
    return { ...defaults, ...Object.fromEntries(rules.map((r) => [r.key, r.value])) };
  } catch (error) {
    if (error instanceof UseCaseError) return defaults;
    throw error;
  }
});
