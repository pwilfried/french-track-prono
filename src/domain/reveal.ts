/** The only reactions allowed on a revealed prediction: no free text (non-goal: no chat). */
export const REACTIONS = ["🔥", "😂", "😮", "👏", "🤡", "🎯"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: string): value is Reaction {
  return (REACTIONS as readonly string[]).includes(value);
}

/** How many players picked each athlete as winner, and the share of all predictions. */
export type PickShare = { athleteId: string; count: number; percent: number };

/**
 * Winner picks of an event, most picked first (ties by athlete id, so the order never depends on
 * the order the predictions arrive in). Percentages are rounded to whole numbers for display.
 */
export function pickDistribution(predictions: { first: string }[]): PickShare[] {
  const counts = new Map<string, number>();
  for (const { first } of predictions) counts.set(first, (counts.get(first) ?? 0) + 1);
  const total = predictions.length;
  return [...counts.entries()]
    .map(([athleteId, count]) => ({ athleteId, count, percent: Math.round((count / total) * 100) }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.athleteId < b.athleteId ? -1 : a.athleteId > b.athleteId ? 1 : 0),
    );
}

/** Reaction counts for one prediction, in the fixed order of REACTIONS, zero counts left out. */
export function reactionCounts(reactions: Reaction[]): { reaction: Reaction; count: number }[] {
  return REACTIONS.map((reaction) => ({
    reaction,
    count: reactions.filter((r) => r === reaction).length,
  })).filter((c) => c.count > 0);
}
