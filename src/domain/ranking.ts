import { competitionDay } from "./competition";
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

/** A score line with its event; an empty `eventStartsAt` is a player without any event yet. */
type DatedLine = {
  userId: string;
  eventStartsAt: string;
  points: number;
  reasons: ScoreReason[];
};

/**
 * Places won (+) or lost (−) by each player since the ranking at the end of the competition day
 * before `today` (#551): every event of the day counts as one move. Null for a player who was not
 * ranked yesterday. A player without any event (a league member at 0) is ranked on both days.
 * The order of the lines never matters.
 */
export function movesSinceYesterday(
  lines: DatedLine[],
  pseudoOf: (userId: string) => string,
  today: string,
): Map<string, number | null> {
  const now = rankPlayers(totalsOf(lines, pseudoOf));
  const before = new Map(
    rankPlayers(
      totalsOf(
        lines.filter((l) => !l.eventStartsAt || competitionDay(l.eventStartsAt) < today),
        pseudoOf,
      ),
    ).map((p) => [p.userId, p.rank]),
  );
  return new Map(
    now.map((player) => {
      const previous = before.get(player.userId);
      return [player.userId, previous === undefined ? null : previous - player.rank];
    }),
  );
}

/** The score lines of one competition day (« Ce soir », #551). */
export function linesOfDay<T extends { eventStartsAt: string }>(lines: T[], day: string): T[] {
  return lines.filter((l) => l.eventStartsAt !== "" && competitionDay(l.eventStartsAt) === day);
}

/** Players shown at the top of a long ranking, and on each side of the player (#551). */
const TOP = 10;
const NEIGHBOURS = 2;

/**
 * A long ranking cut around the player (#551): the first ten, then « gap » where rows are left
 * out, then the player with two neighbours on each side. Neighbours are taken in the order of the
 * list, tied players included. Only the first ten when the player is not ranked.
 */
export function aroundMe<T extends { userId: string }>(
  rows: T[],
  meId: string | undefined,
): (T | "gap")[] {
  const me = rows.findIndex((r) => r.userId === meId);
  const shown = rows.map(
    (_, i) => i < TOP || (me >= 0 && i >= me - NEIGHBOURS && i <= me + NEIGHBOURS),
  );
  const items: (T | "gap")[] = [];
  rows.forEach((row, i) => {
    if (!shown[i]) return;
    if (i > 0 && !shown[i - 1]) items.push("gap");
    items.push(row);
  });
  return items;
}
