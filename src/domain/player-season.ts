import type { DisciplineFamily } from "./discipline";
import type { EventGender } from "./event";
import type { ScoreReason } from "./scoring";

/** One computed event the player predicted, with what it gave them. */
export type SeasonLine = {
  eventId: string;
  /** ISO 8601: orders the season. */
  eventStartsAt: string;
  points: number;
  reasons: ScoreReason[];
  discipline: string;
  gender: EventGender;
  /** Null when the discipline is unknown to the back-office. */
  family: DisciplineFamily | null;
};

export type SeasonStats = {
  predictions: number;
  perfectPodiums: number;
  winners: number;
  /** Rounded percentage of computed predictions that gave points. */
  successRate: number;
  /** The longest run of computed predictions in a row that gave points. */
  bestStreak: number;
  /** Cumulative points after each computed event, in order. */
  curve: number[];
  /** The line that gave the most points (the earliest when tied). */
  bestShot: (SeasonLine & { perfect: boolean; odds: number | null }) | null;
};

const byDate = (a: SeasonLine, b: SeasonLine) =>
  Date.parse(a.eventStartsAt) - Date.parse(b.eventStartsAt) || (a.eventId < b.eventId ? -1 : 1);

const has = (line: SeasonLine, kind: ScoreReason["kind"]) =>
  line.reasons.some((r) => r.kind === kind);

/** The figures of the profile (#384), from the player's computed predictions of the season. */
export function seasonStats(lines: readonly SeasonLine[], predictions: number): SeasonStats {
  const ordered = [...lines].sort(byDate);
  let run = 0;
  let bestStreak = 0;
  let total = 0;
  const curve: number[] = [];
  for (const line of ordered) {
    run = line.points > 0 ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
    total += line.points;
    curve.push(total);
  }

  const best = ordered.reduce<SeasonLine | null>(
    (top, line) => (line.points > (top?.points ?? 0) ? line : top),
    null,
  );
  const oddsOf = (line: SeasonLine) => {
    const all = line.reasons.flatMap((r) => (r.kind === "odds" ? [r.odds] : []));
    return all.length ? Math.max(...all) : null;
  };

  const scored = ordered.filter((l) => l.points > 0).length;
  return {
    predictions,
    perfectPodiums: ordered.filter((l) => has(l, "perfect_podium")).length,
    winners: ordered.filter((l) => l.reasons.some((r) => r.kind === "exact" && r.slot === 1))
      .length,
    successRate: ordered.length ? Math.round((scored / ordered.length) * 100) : 0,
    bestStreak,
    curve,
    bestShot: best ? { ...best, perfect: has(best, "perfect_podium"), odds: oddsOf(best) } : null,
  };
}
