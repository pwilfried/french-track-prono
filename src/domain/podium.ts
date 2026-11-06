import type { ResultLine } from "./event";

export type PodiumStep = { rank: 1 | 2 | 3; athletes: ResultLine[] };

/** The three podium steps. Tied athletes share a step; a step can be empty (tie above it, no result). */
export function podiumSteps(results: ResultLine[]): PodiumStep[] {
  return ([1, 2, 3] as const).map((rank) => ({
    rank,
    athletes: results.filter((result) => result.rank === rank),
  }));
}

/** Initials for an avatar: first letter of the first and of the last word. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .filter((word): word is string => Boolean(word))
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
