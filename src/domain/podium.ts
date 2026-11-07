import type { ResultLine } from "./event";

export type PodiumStep = { rank: 1 | 2 | 3; athletes: ResultLine[] };

/** The three podium steps. Tied athletes share a step; a step can be empty (tie above it, no result). */
export function podiumSteps(results: ResultLine[]): PodiumStep[] {
  return ([1, 2, 3] as const).map((rank) => ({
    rank,
    athletes: results.filter((result) => result.rank === rank),
  }));
}
