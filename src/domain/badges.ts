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

/** How far a player is from a badge: earned when `current` reaches `target`. */
export type BadgeProgress = { badge: Badge; current: number; target: number };

/**
 * Nostradamus: a perfect podium. Chasseur: 3 winners found. Flair: a coup de flair. Série: 5
 * computed events in a row with at least 1 point, at any time. Bleus: a French winner found.
 * Fidèle: a prediction on every event of a competition day.
 */
export function badgeProgress(input: BadgeInput): BadgeProgress[] {
  const count = (kind: ScoreReason["kind"]) =>
    input.myLines.filter((l) => l.reasons.some((r) => r.kind === kind)).length;
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

  // Fidèle: the day closest to being fully predicted.
  const days = input.days.filter((day) => day.length > 0);
  const day = days
    .map((d) => ({
      current: d.filter((id) => input.predictedEventIds.has(id)).length,
      target: d.length,
    }))
    .sort((a, b) => a.target - a.current - (b.target - b.current))[0] ?? { current: 0, target: 1 };

  const raw: Record<Badge, [number, number]> = {
    nostradamus: [count("perfect_podium"), 1],
    chasseur: [winners, HUNTER],
    flair: [count("flair"), 1],
    // Once earned it stays; until then only the ongoing run brings it closer.
    serie: [best >= STREAK ? STREAK : run, STREAK],
    bleus: [input.frenchWinnerEvents.size, 1],
    fidele: [day.current, day.target],
  };
  return BADGES.map((badge) => {
    const [current, target] = raw[badge];
    return { badge, current: Math.min(current, target), target };
  });
}

/** A badge is earned once its progress reaches its target. */
export function isEarned(progress: BadgeProgress): boolean {
  return progress.current >= progress.target;
}

/** The locked badge with the fewest steps left (display order breaks ties); null when all earned. */
export function nextBadge(progress: BadgeProgress[]): (BadgeProgress & { left: number }) | null {
  return (
    progress
      .filter((p) => !isEarned(p))
      .map((p) => ({ ...p, left: p.target - p.current }))
      .sort((a, b) => a.left - b.left)[0] ?? null
  );
}
