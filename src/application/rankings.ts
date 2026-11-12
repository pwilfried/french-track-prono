import { DEFAULT_BIB, type Bib } from "@/domain/bib";
import { rankClubs, type ClubRank } from "@/domain/club-ranking";
import {
  linesOfDay,
  movesSinceYesterday,
  rankPlayers,
  totalsOf,
  type RankedPlayer,
} from "@/domain/ranking";
import type { ScoreReason } from "@/domain/scoring";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";

export type RankingLine = {
  userId: string;
  pseudo: string;
  bib: Bib;
  /** The player's club, shown on their card (#342); null or absent when none or not visible. */
  club?: string | null;
  /** Id of that club: the club ranking groups by it (#386). */
  clubId?: string | null;
  points: number;
  reasons: ScoreReason[];
  eventId: string;
  /** Start of the event, ISO 8601: orders the events to find the last computed one. */
  eventStartsAt: string;
  /** Lock of the event, ISO 8601: a league counts it for a member who joined before (#376). */
  eventLockAt?: string;
};

/** Port: the score lines a ranking is made of. Real adapter = Supabase, fake = in memory. */
export interface RankingRepository {
  /** Every score line of a competition, all players, with their pseudo. */
  competitionLines(competitionSlug: string): Promise<RankingLine[]>;
}

/** A ranked player with the bib shown next to the pseudo and the places won since yesterday. */
export type RankingRow = RankedPlayer & {
  bib: Bib;
  club: string | null;
  change: number | null;
};

/**
 * Ranks the lines; `today` (a competition day, YYYY-MM-DD) gives each player's move since
 * yesterday (#551), null for everyone without it.
 */
const rank = (lines: RankingLine[], today?: string): RankingRow[] => {
  const byUser = new Map(lines.map((l) => [l.userId, l]));
  const pseudoOf = (id: string) => byUser.get(id)?.pseudo ?? "";
  const changes = today ? movesSinceYesterday(lines, pseudoOf, today) : new Map();
  return rankPlayers(totalsOf(lines, pseudoOf)).map((player) => ({
    ...player,
    bib: byUser.get(player.userId)?.bib ?? DEFAULT_BIB,
    club: lines.find((l) => l.userId === player.userId && l.club)?.club ?? null,
    change: changes.get(player.userId) ?? null,
  }));
};

const linesOf = async (ranking: RankingRepository, competitionSlugs: string[]) =>
  (await Promise.all(competitionSlugs.map((slug) => ranking.competitionLines(slug)))).flat();

/**
 * All the players who scored in the competitions given, their points added up: every competition
 * for the general ranking (decision of 8 Nov 2026), one for the page of a competition.
 */
export function getGeneralRanking(ports: { ranking: RankingRepository }) {
  return {
    async execute(input: { competitionSlugs: string[]; today?: string }): Promise<RankingRow[]> {
      return rank(await linesOf(ports.ranking, input.competitionSlugs), input.today);
    },
  };
}

/**
 * « Ce soir » (#551): the players ranked on the points won on the events of the competition day
 * `today` only, Paris time. Nobody moves in it.
 */
export function getTonightRanking(ports: { ranking: RankingRepository }) {
  return {
    async execute(input: { competitionSlugs: string[]; today: string }): Promise<RankingRow[]> {
      return rank(linesOfDay(await linesOf(ports.ranking, input.competitionSlugs), input.today));
    },
  };
}

/** Clubs ranked on the average points of their players over the competitions given (#386). */
export function getClubRanking(ports: { ranking: RankingRepository }) {
  return {
    async execute(input: { competitionSlugs: string[] }): Promise<ClubRank[]> {
      const lines = await linesOf(ports.ranking, input.competitionSlugs);
      const clubOf = new Map(
        lines
          .filter((l) => l.clubId)
          .map((l) => [l.userId, { id: l.clubId!, name: l.club ?? null }]),
      );
      const points = new Map<string, number>();
      for (const l of lines) points.set(l.userId, (points.get(l.userId) ?? 0) + l.points);
      return rankClubs(
        [...points].map(([userId, total]) => ({
          clubId: clubOf.get(userId)?.id ?? null,
          club: clubOf.get(userId)?.name ?? null,
          points: total,
        })),
      );
    },
  };
}

/** True when the event locked after the member joined (or when either date is unknown). */
export function countsInLeague(joinedAt: string | undefined, eventLockAt: string | undefined) {
  if (!joinedAt || !eventLockAt) return true;
  return Date.parse(eventLockAt) >= Date.parse(joinedAt);
}

/**
 * The members of a league, ranked on the league's competitions (their points add up); a member without points is listed
 * with 0. Only a member sees it. Every member gets the same ranking from the same score lines.
 */
export function getLeagueRanking(ports: { ranking: RankingRepository; leagues: LeagueRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      competitionSlugs: string[];
      today?: string;
    }): Promise<RankingRow[]> {
      const members = await ports.leagues.members(input.leagueId);
      if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const joinedAt = new Map(members.map((m) => [m.userId, m.joinedAt]));
      // Only the predictions made as a member count in a league (decision of 9 Nov 2026, #376):
      // an event locked before the player joined stays out of this league's ranking.
      const lines = (await linesOf(ports.ranking, input.competitionSlugs))
        .filter((l) => joinedAt.has(l.userId))
        .filter((l) => countsInLeague(joinedAt.get(l.userId), l.eventLockAt));
      // Members without any score line yet still appear, with 0 points.
      const zero = members.map((m) => ({
        userId: m.userId,
        pseudo: m.pseudo,
        bib: m.bib,
        club: m.club ?? null,
        points: 0,
        reasons: [],
        eventId: "",
        eventStartsAt: "",
      }));
      return rank([...zero, ...lines], input.today);
    },
  };
}

/** Where a player stands in a ranking (#552): null while they have no points or are not in it. */
export function standingIn(
  rows: RankingRow[],
  userId: string,
): { rank: number; change: number | null } | null {
  const row = rows.find((r) => r.userId === userId);
  return row && row.points > 0 ? { rank: row.rank, change: row.change } : null;
}
