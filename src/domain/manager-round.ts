import type { ManagerRules } from "./manager-rules";

/**
 * The bidding rounds of the mercato (v0.13, #423). Rounds follow each other from the opening of
 * the mercato: the first `longRounds` last `firstHours`, the next ones `nextHours`. At the close
 * of a round each athlete bid on goes to the highest bid; a tie goes to the bid placed first at
 * that amount. The database does the same in private.close_manager_rounds().
 */
export type RoundRules = ManagerRules["rounds"];

/** How long round `n` (from 1) lasts, in hours. */
export const roundHours = (rules: RoundRules, n: number) =>
  n <= rules.longRounds ? rules.firstHours : rules.nextHours;

const HOUR = 3_600_000;

/**
 * When round `n` closes, as an ISO time. `closed` holds the real closes of the rounds already
 * closed, in order (#1084): a round closes early once every participant has finished it, and the
 * next rounds keep their length from there. A closed round ends at its real close.
 */
export function roundEndsAt(
  openedAt: string,
  rules: RoundRules,
  n: number,
  closed: readonly string[] = [],
): string {
  if (n <= closed.length) return closed[n - 1]!;
  let ends = Date.parse(closed.at(-1) ?? openedAt);
  for (let round = closed.length + 1; round <= n; round += 1)
    ends += roundHours(rules, round) * HOUR;
  return new Date(ends).toISOString();
}

/**
 * The round open at `now` in a mercato opened at `openedAt`, and when it ends (ISO): the first
 * round that has not ended yet (#774), after the closed ones (`closed`, their real closes, #1084).
 */
export function currentRound(
  openedAt: string,
  rules: RoundRules,
  now: string,
  closed: readonly string[] = [],
): { round: number; endsAt: string } {
  const at = Date.parse(now);
  let ends = Date.parse(closed.at(-1) ?? openedAt);
  for (let round = closed.length + 1; ; round += 1) {
    ends += roundHours(rules, round) * HOUR;
    if (ends > at) return { round, endsAt: new Date(ends).toISOString() };
  }
}

/** A bid of any participant of the league, as the closing of a round reads it. */
export type LeagueBid = { userId: string; athleteId: string; amount: number; bidAt: string };

/** An athlete won at the close of a round, for the amount of the winning bid. */
export type ManagerAward = { athleteId: string; userId: string; amount: number };

/** True when `a` beats `b`: a higher amount, or the same amount placed earlier. */
const beats = (a: LeagueBid, b: LeagueBid) =>
  a.amount !== b.amount ? a.amount > b.amount : a.bidAt < b.bidAt;

/** The winner of each athlete bid on, by athlete id. ISO times compare as text (same format). */
export function awardBids(bids: LeagueBid[]): ManagerAward[] {
  const best = new Map<string, LeagueBid>();
  for (const b of bids) {
    const current = best.get(b.athleteId);
    if (!current || beats(b, current)) best.set(b.athleteId, b);
  }
  return [...best.values()]
    .map(({ athleteId, userId, amount }) => ({ athleteId, userId, amount }))
    .sort((a, b) => (a.athleteId < b.athleteId ? -1 : a.athleteId > b.athleteId ? 1 : 0));
}
