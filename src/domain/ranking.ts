import { parisDay } from "./competition";
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
  const before = lines.filter((l) => parisDay(l.eventStartsAt) < today);
  const previous = new Map(rankPlayers(totalsOf(before, pseudoOf)).map((p) => [p.userId, p.rank]));
  return new Map(
    rankPlayers(totalsOf(lines, pseudoOf)).map((p) => {
      const rank = previous.get(p.userId);
      return [p.userId, rank === undefined ? null : rank - p.rank];
    }),
  );
}

/**
 * The rows a long ranking shows (#551): the top `top`, then, after a gap (null), me and `side`
 * neighbours on each side. No gap when they follow the top; the top only when I am in it or not
 * ranked.
 */
export function rankingWindow<T extends { userId: string }>(
  rows: T[],
  meId: string | null,
  top = 10,
  side = 2,
): (T | null)[] {
  const shown: (T | null)[] = rows.slice(0, top);
  const me = rows.findIndex((r) => r.userId === meId);
  const from = Math.max(me - side, top);
  const to = Math.min(me + side, rows.length - 1);
  if (me < 0 || from > to) return shown;
  if (from > top) shown.push(null);
  return [...shown, ...rows.slice(from, to + 1)];
}
