import { utcToParis } from "./competition";
import type { ScoreReason } from "./scoring";

/** One player's totals over the events counted by a ranking. */
export type PlayerTotals = {
  userId: string;
  pseudo: string;
  points: number;
  perfectPodiums: number;
  winnersFound: number;
};

export type RankedPlayer = PlayerTotals & { rank: number };

/** Adds up the score lines of each player (one line per scored event). */
export function totalsOf(
  lines: { userId: string; points: number; reasons: ScoreReason[] }[],
  pseudoOf: (userId: string) => string,
): PlayerTotals[] {
  const byUser = new Map<string, PlayerTotals>();
  for (const line of lines) {
    const totals = byUser.get(line.userId) ?? {
      userId: line.userId,
      pseudo: pseudoOf(line.userId),
      points: 0,
      perfectPodiums: 0,
      winnersFound: 0,
    };
    totals.points += line.points;
    if (line.reasons.some((r) => r.kind === "perfect_podium")) totals.perfectPodiums += 1;
    if (line.reasons.some((r) => r.kind === "exact" && r.slot === 1)) totals.winnersFound += 1;
    byUser.set(line.userId, totals);
  }
  return [...byUser.values()];
}

const compareScore = (a: PlayerTotals, b: PlayerTotals) =>
  b.points - a.points || b.perfectPodiums - a.perfectPodiums || b.winnersFound - a.winnersFound;

/**
 * Ranking (R9): points, then perfect podiums, then winners found. Players still equal share the
 * same rank (1, 2, 2, 4) and are listed by pseudo; the order the lines arrive in never matters.
 */
export function rankPlayers(players: PlayerTotals[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) =>
      compareScore(a, b) ||
      a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  return sorted.map((player, index) => {
    const first = sorted.findIndex((other) => compareScore(other, player) === 0);
    return { ...player, rank: first === index ? index + 1 : first + 1 };
  });
}

type DatedLine = {
  userId: string;
  eventId: string;
  eventStartsAt: string;
  points: number;
  reasons: ScoreReason[];
};

/**
 * Places won (+) or lost (−) by each player since the ranking at the end of the day before
 * `today` (YYYY-MM-DD, Paris time), #551: every event of the day counts. Null for a player who
 * was not ranked then, and for everyone until a day is over. The order of the lines never matters.
 */
export function movesSinceYesterday(
  lines: DatedLine[],
  today: string,
  pseudoOf: (userId: string) => string,
): Map<string, number | null> {
  const before = lines.filter((l) => utcToParis(l.eventStartsAt).slice(0, 10) < today);
  const previous = new Map(rankPlayers(totalsOf(before, pseudoOf)).map((p) => [p.userId, p.rank]));
  return new Map(
    rankPlayers(totalsOf(lines, pseudoOf)).map((p) => {
      const rank = previous.get(p.userId);
      return [p.userId, rank === undefined ? null : rank - p.rank];
    }),
  );
}

/**
 * Current streak of each player (owner's decision, v0.8): the last computed events in a row,
 * newest first, where the player scored at least 1 point. No prediction or 0 point breaks it.
 */
export function streaks(lines: DatedLine[]): Map<string, number> {
  const events = new Map<string, number>();
  for (const l of lines) events.set(l.eventId, Date.parse(l.eventStartsAt));
  const order = [...events]
    .sort(([a, ta], [b, tb]) => tb - ta || (a < b ? 1 : a > b ? -1 : 0))
    .map(([id]) => id);
  const scored = new Set(lines.filter((l) => l.points > 0).map((l) => `${l.userId}|${l.eventId}`));
  const result = new Map<string, number>();
  for (const userId of new Set(lines.map((l) => l.userId))) {
    let n = 0;
    while (n < order.length && scored.has(`${userId}|${order[n]}`)) n += 1;
    result.set(userId, n);
  }
  return result;
}
