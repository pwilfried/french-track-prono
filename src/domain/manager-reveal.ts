/**
 * The reveal at the end of each round of the mercato (v0.14, #604). While a round is open every bid
 * stays secret; once it is closed every participant sees all its bids: who bid on which athlete,
 * how much, and who got them. The reveal shows once per round and per player.
 */

/** A bid of a closed round, of any participant, and whether it won the athlete. */
export type RoundBid = { userId: string; athleteId: string; amount: number; won: boolean };

/** A closed round in which somebody bid, and whether the player saw its reveal. */
export type BidRound = { round: number; seen: boolean };

/**
 * The round whose reveal shows now: the last closed round with bids, if the player has not seen it
 * (seeing it marks the former ones as seen too). Rounds come in order.
 */
export function roundToReveal(rounds: BidRound[]): number | null {
  const last = rounds.at(-1);
  return last && !last.seen ? last.round : null;
}

/** The highest bid first; at the same amount, the one that won. */
const byAmount = (a: RoundBid, b: RoundBid) => b.amount - a.amount || Number(b.won) - Number(a.won);

/** The bids of a round by athlete, each from the highest; the athletes by their best bid, then id. */
export function bidsByAthlete(bids: RoundBid[]): { athleteId: string; bids: RoundBid[] }[] {
  const groups = new Map<string, RoundBid[]>();
  for (const b of bids) groups.set(b.athleteId, [...(groups.get(b.athleteId) ?? []), b]);
  return [...groups.entries()]
    .map(([athleteId, list]) => ({ athleteId, bids: [...list].sort(byAmount) }))
    .sort(
      (a, b) =>
        b.bids[0]!.amount - a.bids[0]!.amount ||
        (a.athleteId < b.athleteId ? -1 : a.athleteId > b.athleteId ? 1 : 0),
    );
}

/** How many bids the player placed in the round, and how many won. */
export function myRoundTally(bids: RoundBid[], userId: string) {
  const mine = bids.filter((b) => b.userId === userId);
  return { placed: mine.length, won: mine.filter((b) => b.won).length };
}
