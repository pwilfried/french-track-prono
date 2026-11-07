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
export function badgesOf(input: BadgeInput): Badge[] {
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

  const earned: Record<Badge, boolean> = {
    nostradamus: has("perfect_podium"),
    chasseur: winners >= HUNTER,
    flair: has("flair"),
    serie: best >= STREAK,
    bleus: input.frenchWinnerEvents.size > 0,
    fidele: input.days.some(
      (day) => day.length > 0 && day.every((id) => input.predictedEventIds.has(id)),
    ),
  };
  return BADGES.filter((b) => earned[b]);
}
