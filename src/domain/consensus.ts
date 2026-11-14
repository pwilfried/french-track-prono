import type { Podium } from "./podium-draft";

/** A podium predicted on a locked event, anonymous: only whether it is mine is known. */
export type ConsensusPodium = { podium: Podium; mine: boolean };

export type Place = keyof Podium;
const PLACES: readonly Place[] = ["first", "second", "third"];
const RANK: Record<Place, number> = { first: 1, second: 2, third: 3 };

/** How many players put this athlete at this place, their share, and whether I did too. */
export type PlaceShare = { athleteId: string; count: number; percent: number; mine: boolean };

/** A count of players and its share of all the predictions. */
export type Share = { count: number; percent: number };

export type Consensus = {
  total: number;
  /** For each place, the athletes picked, most picked first (ties by athlete id). */
  places: Record<Place, PlaceShare[]>;
  /** Players with exactly my podium, me included; null when I did not predict. */
  samePodium: Share | null;
  /** My least shared choice (the highest place on a tie); null when I did not predict. */
  boldest: (Share & { place: Place; athleteId: string }) | null;
  /** Players who found the perfect podium; null until the official result is in. */
  perfect: Share | null;
};

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Whole percentages that total exactly 100 (largest remainder): each share is floored, then the
 * points left go to the largest remainders, the earliest one first on a tie.
 */
export function roundedShares(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c * 100) / total);
  const shares = exact.map(Math.floor);
  const left = 100 - shares.reduce((sum, s) => sum + s, 0);
  exact
    .map((value, i) => ({ i, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
    .slice(0, left)
    .forEach(({ i }) => (shares[i]! += 1));
  return shares;
}

const share = (count: number, total: number): Share => ({
  count,
  percent: total === 0 ? 0 : Math.round((count * 100) / total),
});

const samePodium = (a: Podium, b: Podium) =>
  a.first === b.first && a.second === b.second && a.third === b.third;

/**
 * What the players predicted on a locked event. The order the predictions arrive in never
 * changes anything. `official` (athlete, rank; tied athletes share a rank) adds the share of
 * perfect podiums once the result is in.
 */
export function consensus(
  podiums: ConsensusPodium[],
  official?: { athleteId: string; rank: number }[],
): Consensus {
  const total = podiums.length;
  const mine = podiums.find((p) => p.mine)?.podium ?? null;

  const places = Object.fromEntries(
    PLACES.map((place) => {
      const counts = new Map<string, number>();
      for (const { podium } of podiums) {
        counts.set(podium[place], (counts.get(podium[place]) ?? 0) + 1);
      }
      const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || byId(a[0], b[0]));
      const percents = roundedShares(rows.map(([, count]) => count));
      return [
        place,
        rows.map(([athleteId, count], i) => ({
          athleteId,
          count,
          percent: percents[i]!,
          mine: mine?.[place] === athleteId,
        })),
      ];
    }),
  ) as Record<Place, PlaceShare[]>;

  let boldest: Consensus["boldest"] = null;
  if (mine) {
    for (const place of PLACES) {
      const row = places[place].find((r) => r.mine)!;
      if (!boldest || row.count < boldest.count) {
        boldest = { place, athleteId: row.athleteId, count: row.count, percent: row.percent };
      }
    }
  }

  let perfect: Share | null = null;
  if (official && official.length > 0) {
    const rankOf = new Map(official.map((line) => [line.athleteId, line.rank]));
    const found = podiums.filter(({ podium }) =>
      PLACES.every((place) => rankOf.get(podium[place]) === RANK[place]),
    ).length;
    perfect = share(found, total);
  }

  return {
    total,
    places,
    samePodium: mine
      ? share(podiums.filter((p) => samePodium(p.podium, mine)).length, total)
      : null,
    boldest,
    perfect,
  };
}
