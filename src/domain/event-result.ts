import { pointsWithJoker, type JokerPoints, type PredictionJoker } from "./league-jokers";
import type { ScoreReason, ScoringRules } from "./scoring";

/** The computed points of one prediction, as stored with their reasons and joker points (#1090). */
export type PredictionScore = {
  points: number;
  reasons: ScoreReason[];
  jokers?: Partial<JokerPoints>;
};

/** One line of the detail of a score, in reading order (#1155). */
export type BreakdownLine =
  | { kind: "exact"; slot: 1 | 2 | 3; points: number }
  | { kind: "on_podium"; count: number; points: number }
  | { kind: "perfect_podium"; points: number }
  | { kind: "flair"; points: number }
  | { kind: "odds"; points: number }
  | { kind: "mark"; points: number };

/**
 * How a score is made: a line per reason, the points before the joker, the joker's own line when
 * one changes the count, and the total.
 */
export type PointsBreakdown = {
  lines: BreakdownLine[];
  subtotal: number;
  joker: { joker: PredictionJoker; points: number } | null;
  total: number;
};

/** The values of the scale a reason without its own points is worth. */
export type BreakdownRules = Pick<
  ScoringRules,
  "exactSlot" | "wrongPlace" | "perfectPodium" | "flairBonus"
>;

/**
 * The detail of any revealed and scored prediction (#1155), read from its stored reasons: the same
 * reasons the scoring gave, so nothing is computed a second time. Misplaced athletes, odds and marks
 * are grouped on one line each. With a league joker, its effect is the difference it makes.
 */
export function pointsBreakdown(
  score: PredictionScore,
  rules: BreakdownRules,
  joker?: PredictionJoker | null,
): PointsBreakdown {
  const lines: BreakdownLine[] = [];
  for (const reason of score.reasons)
    if (reason.kind === "exact")
      lines.push({ kind: "exact", slot: reason.slot, points: rules.exactSlot });
  const misplaced = score.reasons.filter((r) => r.kind === "on_podium").length;
  if (misplaced > 0)
    lines.push({ kind: "on_podium", count: misplaced, points: misplaced * rules.wrongPlace });
  if (score.reasons.some((r) => r.kind === "perfect_podium"))
    lines.push({ kind: "perfect_podium", points: rules.perfectPodium });
  if (score.reasons.some((r) => r.kind === "flair"))
    lines.push({ kind: "flair", points: rules.flairBonus });
  for (const kind of ["odds", "mark"] as const) {
    const points = score.reasons.reduce((sum, r) => (r.kind === kind ? sum + r.points : sum), 0);
    if (points > 0) lines.push({ kind, points });
  }
  const total = pointsWithJoker(score, joker);
  // The spy changes nothing to the points: no line for it.
  const withJoker = joker && joker !== "spy" ? { joker, points: total - score.points } : null;
  return { lines, subtotal: score.points, joker: withJoker, total };
}

/** Items ordered by points, the most first, each with its rank: a tie shares the rank. */
export function rankByPoints<T extends { points: number }>(
  items: T[],
  tie: (a: T, b: T) => number = () => 0,
): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.points - a.points || tie(a, b));
  return sorted.map((item) => ({
    ...item,
    rank: 1 + sorted.filter((other) => other.points > item.points).length,
  }));
}

/** The ranges of points the spread of an event is counted in; the last has no top. */
export const POINT_RANGES = [
  { min: 0, max: 0 },
  { min: 1, max: 5 },
  { min: 6, max: 10 },
  { min: 11, max: 15 },
  { min: 16, max: null },
] as const;

export type PointRange = {
  min: number;
  max: number | null;
  count: number;
  percent: number;
  /** True for the range my points fall in. */
  mine: boolean;
};

/** What all the players scored on an event, once the result is in (#1155). */
export type EventPointsStats = {
  /** How many scored predictions. */
  total: number;
  /** The mean of the points, to one decimal. */
  mean: number;
  ranges: PointRange[];
  perfect: number;
  /** My rank among all, and the share of players at or above it (« Top 4 % »); null without my prediction. */
  me: { rank: number; topPercent: number } | null;
};

/** The spread of the points of an event, its mean, the perfect podiums and my rank among all. */
export function eventPointsStats(
  scores: { userId: string; points: number; perfect: boolean }[],
  myUserId?: string,
): EventPointsStats {
  const total = scores.length;
  const percent = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));
  const mine = scores.find((s) => s.userId === myUserId);
  const inRange = (points: number, range: { min: number; max: number | null }) =>
    points >= range.min && (range.max === null || points <= range.max);
  const ranges = POINT_RANGES.map((range): PointRange => {
    const count = scores.filter((s) => inRange(s.points, range)).length;
    return {
      min: range.min,
      max: range.max,
      count,
      percent: percent(count),
      mine: mine !== undefined && inRange(mine.points, range),
    };
  });
  const sum = scores.reduce((acc, s) => acc + s.points, 0);
  const rank = mine ? 1 + scores.filter((s) => s.points > mine.points).length : 0;
  return {
    total,
    mean: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
    ranges,
    perfect: scores.filter((s) => s.perfect).length,
    me: mine ? { rank, topPercent: Math.max(1, Math.ceil((rank / total) * 100)) } : null,
  };
}
