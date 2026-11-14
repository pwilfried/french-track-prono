/** The only reactions allowed on a revealed prediction: no free text (non-goal: no chat). */
export const REACTIONS = ["🔥", "😂", "😮", "👏", "🤡", "🎯"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: string): value is Reaction {
  return (REACTIONS as readonly string[]).includes(value);
}

/** Reaction counts for one prediction, in the fixed order of REACTIONS, zero counts left out. */
export function reactionCounts(reactions: Reaction[]): { reaction: Reaction; count: number }[] {
  return REACTIONS.map((reaction) => ({
    reaction,
    count: reactions.filter((r) => r === reaction).length,
  })).filter((c) => c.count > 0);
}
