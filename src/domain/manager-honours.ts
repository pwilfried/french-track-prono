/**
 * The end of a French Track Manager season and its honours (v0.16, #434). The season ends once
 * every matchday of the schedule that has a competition is scored, bonus matchdays included
 * (owner's rule, 13 Nov. 2026); a matchday without competition is not played. No playoffs: the
 * first of the standings is champion, and the final standings are frozen with the honours. The
 * same rule closes the season in the database (private.close_manager_season).
 */

import type { PlayedDuel, SeasonMatchday, StandingRow } from "./manager-championship";

/** `scored`: the competitions that have Manager scores in the league. */
export function seasonOver(
  matchdays: readonly SeasonMatchday[],
  scored: ReadonlySet<string>,
): boolean {
  const played = matchdays.filter((m) => m.competitionId !== null);
  return played.length > 0 && played.every((m) => scored.has(m.competitionId!));
}

/** A player's figures over the whole season, bonus matchdays included. */
export type PlayerSeasonStats = {
  userId: string;
  /** The Manager points of every matchday, bonus ones included. */
  managerPoints: number;
  /** The athlete who brought the most Manager points; null without a lineup all season. */
  bestAthlete: { name: string; points: number } | null;
};

/** The frozen honours of a finished season. */
export type ManagerHonours = {
  leagueId: string;
  leagueName: string;
  endedAt: string;
  /** Null when the champion's account is gone. */
  championId: string | null;
  /** The final standings, first first. */
  standings: StandingRow[];
  /** Every head-to-head of the season, first matchday first. */
  duels: (PlayedDuel & { round: number })[];
  players: PlayerSeasonStats[];
};

/**
 * The player's main rival: the one just ahead of them in the final standings; for the first,
 * the second. Null when alone or not in the standings.
 */
export function mainRival(userId: string, standings: readonly StandingRow[]): string | null {
  const i = standings.findIndex((r) => r.userId === userId);
  if (i < 0) return null;
  return standings[i === 0 ? 1 : i - 1]?.userId ?? null;
}

export type HeadToHead = { wins: number; draws: number; losses: number };

/** The player's record against one opponent, over their head-to-heads. */
export function headToHead(
  userId: string,
  opponentId: string,
  duels: readonly PlayedDuel[],
): HeadToHead {
  const record = { wins: 0, draws: 0, losses: 0 };
  for (const d of duels) {
    const home = d.home === userId && d.away === opponentId;
    const away = d.away === userId && d.home === opponentId;
    if (!home && !away) continue;
    const [mine, theirs] = home ? [d.homeScore, d.awayScore] : [d.awayScore, d.homeScore];
    if (mine > theirs) record.wins += 1;
    else if (mine === theirs) record.draws += 1;
    else record.losses += 1;
  }
  return record;
}

/** « Ma saison »: the player's final place and figures. */
export type SeasonReview = {
  rank: number;
  /** Position in the final standings (1 = first line). */
  position: number;
  players: number;
  champion: boolean;
  wins: number;
  draws: number;
  losses: number;
  managerPoints: number;
  bestAthlete: PlayerSeasonStats["bestAthlete"];
  rival: ({ userId: string } & HeadToHead) | null;
};

/** The player's season in the frozen honours; null when they are not in the standings. */
export function seasonReview(userId: string, honours: ManagerHonours): SeasonReview | null {
  const i = honours.standings.findIndex((r) => r.userId === userId);
  const row = honours.standings[i];
  if (!row) return null;
  const stats = honours.players.find((p) => p.userId === userId);
  const rival = mainRival(userId, honours.standings);
  return {
    rank: row.rank,
    position: i + 1,
    players: honours.standings.length,
    champion: honours.championId === userId,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    managerPoints: stats?.managerPoints ?? 0,
    bestAthlete: stats?.bestAthlete ?? null,
    rival: rival === null ? null : { userId: rival, ...headToHead(userId, rival, honours.duels) },
  };
}
