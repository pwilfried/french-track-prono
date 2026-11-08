import type { EventStatus } from "./event";

/** The rounds of a race, in the order they are run. */
export const ROUNDS = ["series", "quarter", "semi", "final"] as const;
export type Round = (typeof ROUNDS)[number];

/** Heats first, the final last. */
export function compareRounds(a: string, b: string): number {
  return ROUNDS.indexOf(a as Round) - ROUNDS.indexOf(b as Round);
}

/**
 * Players predict finals only (option A), and a final only once every round leading to it is
 * finished: the start list of the final is then known.
 */
export function canPredictRound(round: Round, previous: { status: EventStatus }[]): boolean {
  return round === "final" && previous.every((r) => r.status === "finished");
}
