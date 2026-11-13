import type { ScoreReason } from "./scoring";

/** Profile badges (owner's decision, v0.8), in display order. */
export const BADGES = ["nostradamus", "chasseur", "flair", "serie", "bleus", "fidele"] as const;
export type Badge = (typeof BADGES)[number];

export type BadgeInput = {
  /** The player's own score lines. */
  myLines: { eventId: string; eventStartsAt: string; points: number; reasons: ScoreReason[] }[];
  /** Every computed event of the competition (any player has points on it). */
  computedEvents: { eventId: string; startsAt: string }[];
  /** Events where the player's winner pick was right and is French. */
  frenchWinnerEvents: Set<string>;
  /** The competition's events grouped by day. */
  days: string[][];
  /** Events the player predicted. */
  predictedEventIds: Set<string>;
};

const STREAK = 5;
const HUNTER = 3;

/**
 * Nostradamus: a perfect podium. Chasseur: 3 winners found. Flair: a coup de flair. Série: 5
 * computed events in a row with at least 1 point, at any time. Bleus: a French winner found.
 * Fidèle: a prediction on every event of a competition day.
 */
export function badgeProgress(input: BadgeInput): BadgeProgress[] {
  const has = (kind: ScoreReason["kind"]) =>
    input.myLines.some((l) => l.reasons.some((r) => r.kind === kind));
  const winners = input.myLines.filter((l) =>
    l.reasons.some((r) => r.kind === "exact" && r.slot === 1),
  ).length;

  const scored = new Set(input.myLines.filter((l) => l.points > 0).map((l) => l.eventId));
  const order = [...input.computedEvents].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || (a.eventId < b.eventId ? -1 : 1),
  );
  let run = 0;
  let best = 0;
  for (const e of order) {
    run = scored.has(e.eventId) ? run + 1 : 0;
    best = Math.max(best, run);
  }

  const bestDay = input.days.reduce(
    (top, day) => {
      const done = day.filter((id) => input.predictedEventIds.has(id)).length;
      // The day closest to complete: fewest events left, then the most predicted.
      const left = day.length - done;
      return day.length > 0 && (left < top.goal - top.progress || top.goal === 0)
        ? { progress: done, goal: day.length }
        : top;
    },
    { progress: 0, goal: 0 },
  );

  const progress: Record<Badge, { progress: number; goal: number }> = {
    nostradamus: { progress: has("perfect_podium") ? 1 : 0, goal: 1 },
    chasseur: { progress: Math.min(winners, HUNTER), goal: HUNTER },
    flair: { progress: has("flair") ? 1 : 0, goal: 1 },
    serie: { progress: Math.min(best, STREAK), goal: STREAK },
    bleus: { progress: input.frenchWinnerEvents.size > 0 ? 1 : 0, goal: 1 },
    fidele: bestDay.goal > 0 ? bestDay : { progress: 0, goal: 1 },
  };
  return BADGES.map((badge) => ({
    badge,
    ...progress[badge],
    earned: progress[badge].progress >= progress[badge].goal,
  }));
}

export type BadgeProgress = { badge: Badge; earned: boolean; progress: number; goal: number };

/** The badges earned, in display order. */
export function badgesOf(input: BadgeInput): Badge[] {
  return badgeProgress(input)
    .filter((b) => b.earned)
    .map((b) => b.badge);
}

/** The badge to aim for: not earned yet, the fewest steps left, the display order on a tie. */
export function nextBadge(progress: readonly BadgeProgress[]): BadgeProgress | null {
  return progress
    .filter((b) => !b.earned)
    .reduce<BadgeProgress | null>(
      (top, b) => (!top || b.goal - b.progress < top.goal - top.progress ? b : top),
      null,
    );
}
