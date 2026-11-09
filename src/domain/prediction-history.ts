import type { ResultLine } from "./event";
import type { Podium } from "./podium-draft";

/** How one pick of a podium turned out: right place, on the podium elsewhere, off it, or not known yet. */
export type PickHit = "exact" | "misplaced" | "missed" | "pending";

/**
 * The outcome of each pick (1st, 2nd, 3rd) against the official result (#387). Tied athletes share
 * a rank, so a pick is exact when the athlete's rank is its slot. No result yet: all pending.
 */
export function pickHits(podium: Podium, results: Pick<ResultLine, "athleteId" | "rank">[]) {
  if (results.length === 0) return ["pending", "pending", "pending"] as PickHit[];
  const rankOf = new Map(results.map((r) => [r.athleteId, r.rank]));
  return [podium.first, podium.second, podium.third].map((athleteId, i): PickHit => {
    const rank = rankOf.get(athleteId);
    if (rank === i + 1) return "exact";
    return rank !== undefined && rank <= 3 ? "misplaced" : "missed";
  });
}
