import { withinTolerance } from "./discipline";
import type { EventOdds } from "./odds";
import { OTHER_ATHLETE, type PodiumMarks } from "./podium-draft";

/** Rules of the game, read from the `scoring_rules` table. */
export type ScoringRules = {
  exactSlot: number;
  wrongPlace: number;
  perfectPodium: number;
  flairBonus: number;
  /** Flair applies when the winner was picked by strictly less than this share of the players. */
  flairThreshold: number;
  flairMinPlayers: number;
  jokerMultiplier: number;
  /** v0.9: the odds of an athlete are multiplied by these, at the right place, 1 or 2 places off. */
  oddsExact: number;
  oddsOneOff: number;
  oddsTwoOff: number;
  /** v0.9: points of a predicted mark within the tolerance, and within twice the tolerance. */
  markExact: number;
  markNear: number;
};

export const DEFAULT_RULES: ScoringRules = {
  exactSlot: 3,
  wrongPlace: 1,
  perfectPodium: 3,
  flairBonus: 2,
  flairThreshold: 0.15,
  flairMinPlayers: 10,
  jokerMultiplier: 2,
  oddsExact: 3,
  oddsOneOff: 2,
  oddsTwoOff: 1,
  markExact: 5,
  markNear: 2,
};

export type ScoringPrediction = {
  first: string;
  second: string;
  third: string;
  useJoker: boolean;
  /** v0.9: the marks predicted for the three athletes. */
  marks?: PodiumMarks;
};

/** One line of the official result. Tied athletes share a rank. `markValue` in the discipline's unit. */
export type OfficialLine = { athleteId: string; rank: number; markValue?: number | null };

/** v0.9: what an event plays with besides the podium: odds, and the tolerance of a mark. */
export type EventBets = { odds: EventOdds | null; tolerance: number | null };

/** What the whole field of players picked, to detect a "coup de flair". */
export type FlairContext = { predictionCount: number; winnerPicks: Record<string, number> };

/** Why points were given. Codes only: the French texts live in the interface messages. */
export type ScoreReason =
  | { kind: "exact"; slot: 1 | 2 | 3 }
  | { kind: "on_podium"; slot: 1 | 2 | 3 }
  | { kind: "perfect_podium" }
  | { kind: "flair" }
  | { kind: "joker" }
  | { kind: "odds"; slot: 1 | 2 | 3; odds: number; multiplier: number; points: number }
  | { kind: "mark"; slot: 1 | 2 | 3; predicted: number; official: number; points: number };

export type Score = { points: number; reasons: ScoreReason[] };

export function flairContext(predictions: ScoringPrediction[]): FlairContext {
  const winnerPicks: Record<string, number> = {};
  for (const { first } of predictions) winnerPicks[first] = (winnerPicks[first] ?? 0) + 1;
  return { predictionCount: predictions.length, winnerPicks };
}

/**
 * Points of one prediction. An athlete's official place is its rank, so a tie shares the place:
 * with two athletes tied for 3rd, predicting either one in 3rd is an exact hit.
 */
export function scorePrediction(
  prediction: ScoringPrediction,
  official: OfficialLine[],
  rules: ScoringRules,
  context: FlairContext,
  bets: EventBets = { odds: null, tolerance: null },
): Score {
  const proposed = new Set(bets.odds?.proposed.map((p) => p.athleteId) ?? []);
  // « Autre athlète » stands for the athletes not proposed: its place is the one, among theirs,
  // closest to the slot it was put on.
  const rankOf = (athleteId: string, slot?: number): number | undefined => {
    if (athleteId !== OTHER_ATHLETE || !bets.odds) {
      return official.find((l) => l.athleteId === athleteId)?.rank;
    }
    const ranks = official.filter((l) => !proposed.has(l.athleteId)).map((l) => l.rank);
    return ranks.sort((a, b) => Math.abs(a - (slot ?? 1)) - Math.abs(b - (slot ?? 1)))[0];
  };
  const slots = [
    [1, prediction.first],
    [2, prediction.second],
    [3, prediction.third],
  ] as const;

  let points = 0;
  const reasons: ScoreReason[] = [];
  let exactCount = 0;
  for (const [slot, athleteId] of slots) {
    const rank = rankOf(athleteId, slot);
    if (rank === slot) {
      points += rules.exactSlot;
      exactCount += 1;
      reasons.push({ kind: "exact", slot });
    } else if (rank !== undefined && rank <= 3) {
      points += rules.wrongPlace;
      reasons.push({ kind: "on_podium", slot });
    }
  }

  if (exactCount === 3) {
    points += rules.perfectPodium;
    reasons.push({ kind: "perfect_podium" });
  }

  points += oddsPoints(slots, rankOf, rules, bets, reasons);
  points += markPoints(slots, prediction, official, rules, bets, reasons);

  const winnerFound = rankOf(prediction.first, 1) === 1;
  const share =
    context.predictionCount > 0
      ? (context.winnerPicks[prediction.first] ?? 0) / context.predictionCount
      : 1;
  if (
    winnerFound &&
    context.predictionCount >= rules.flairMinPlayers &&
    share < rules.flairThreshold
  ) {
    points += rules.flairBonus;
    reasons.push({ kind: "flair" });
  }

  if (prediction.useJoker) {
    points *= rules.jokerMultiplier;
    reasons.push({ kind: "joker" });
  }
  return { points, reasons };
}

const ODDS_MULTIPLIER = ["oddsExact", "oddsOneOff", "oddsTwoOff"] as const;

/** v0.9: each proposed athlete (or « autre athlète ») on the podium earns its odds × 3, 2 or 1. */
function oddsPoints(
  slots: readonly (readonly [1 | 2 | 3, string])[],
  rankOf: (athleteId: string, slot: number) => number | undefined,
  rules: ScoringRules,
  bets: EventBets,
  reasons: ScoreReason[],
): number {
  if (!bets.odds) return 0;
  let total = 0;
  for (const [slot, athleteId] of slots) {
    const odds =
      athleteId === OTHER_ATHLETE
        ? bets.odds.other
        : bets.odds.proposed.find((p) => p.athleteId === athleteId)?.odds;
    const rank = rankOf(athleteId, slot);
    if (odds === undefined || rank === undefined || rank > 3) continue;
    const key = ODDS_MULTIPLIER[Math.abs(rank - slot)];
    if (!key) continue;
    const multiplier = rules[key];
    const points = Math.round(odds * multiplier);
    total += points;
    reasons.push({ kind: "odds", slot, odds, multiplier, points });
  }
  return total;
}

/** v0.9: a predicted mark earns points within the tolerance, fewer within twice the tolerance. */
function markPoints(
  slots: readonly (readonly [1 | 2 | 3, string])[],
  prediction: ScoringPrediction,
  official: OfficialLine[],
  rules: ScoringRules,
  bets: EventBets,
  reasons: ScoreReason[],
): number {
  if (!prediction.marks || bets.tolerance === null) return 0;
  const key = { 1: "first", 2: "second", 3: "third" } as const;
  let total = 0;
  for (const [slot, athleteId] of slots) {
    const predicted = prediction.marks[key[slot]];
    const mark = official.find((l) => l.athleteId === athleteId)?.markValue;
    if (predicted == null || mark == null) continue;
    const points = withinTolerance(predicted, mark, bets.tolerance)
      ? rules.markExact
      : withinTolerance(predicted, mark, bets.tolerance * 2)
        ? rules.markNear
        : 0;
    if (points === 0) continue;
    total += points;
    reasons.push({ kind: "mark", slot, predicted, official: mark, points });
  }
  return total;
}
