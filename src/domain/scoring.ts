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
};

export const DEFAULT_RULES: ScoringRules = {
  exactSlot: 3,
  wrongPlace: 1,
  perfectPodium: 3,
  flairBonus: 2,
  flairThreshold: 0.15,
  flairMinPlayers: 10,
  jokerMultiplier: 2,
};

export type ScoringPrediction = { first: string; second: string; third: string; useJoker: boolean };

/** One line of the official result. Tied athletes share a rank. */
export type OfficialLine = { athleteId: string; rank: number };

/** What the whole field of players picked, to detect a "coup de flair". */
export type FlairContext = { predictionCount: number; winnerPicks: Record<string, number> };

/** Why points were given. Codes only: the French texts live in the interface messages. */
export type ScoreReason =
  | { kind: "exact"; slot: 1 | 2 | 3 }
  | { kind: "on_podium"; slot: 1 | 2 | 3 }
  | { kind: "perfect_podium" }
  | { kind: "flair" }
  | { kind: "joker" };

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
): Score {
  const rankOf = (athleteId: string) => official.find((l) => l.athleteId === athleteId)?.rank;
  const slots = [
    [1, prediction.first],
    [2, prediction.second],
    [3, prediction.third],
  ] as const;

  let points = 0;
  const reasons: ScoreReason[] = [];
  let exactCount = 0;
  for (const [slot, athleteId] of slots) {
    const rank = rankOf(athleteId);
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

  const winnerFound = rankOf(prediction.first) === 1;
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
