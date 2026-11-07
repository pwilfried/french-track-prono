import type { ResultLine } from "./event";

export type PodiumStep = { rank: 1 | 2 | 3; athletes: ResultLine[] };

/** The three podium steps. Tied athletes share a step; a step can be empty (tie above it, no result). */
export function podiumSteps(results: ResultLine[]): PodiumStep[] {
  return ([1, 2, 3] as const).map((rank) => ({
    rank,
    athletes: results.filter((result) => result.rank === rank),
  }));
}

export type SlotOutcome = "exact" | "on_podium" | "off";

/**
 * My podium against the official one, slot by slot: exact place (a tie shares the place), on the
 * podium but elsewhere, or off the podium. Same rule as the scoring.
 */
export function predictionVsOfficial(
  podium: { first: string; second: string; third: string },
  results: { athleteId: string; rank: number }[],
): { slot: 1 | 2 | 3; athleteId: string; outcome: SlotOutcome }[] {
  const rankOf = (id: string) => results.find((r) => r.athleteId === id)?.rank;
  return (
    [
      [1, podium.first],
      [2, podium.second],
      [3, podium.third],
    ] as const
  ).map(([slot, athleteId]) => {
    const rank = rankOf(athleteId);
    const outcome: SlotOutcome =
      rank === slot ? "exact" : rank !== undefined && rank <= 3 ? "on_podium" : "off";
    return { slot, athleteId, outcome };
  });
}
