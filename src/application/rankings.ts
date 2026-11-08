import { rankChanges, rankPlayers, streaks, totalsOf, type RankedPlayer } from "@/domain/ranking";
import type { ScoreReason } from "@/domain/scoring";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";

export type RankingLine = {
  userId: string;
  pseudo: string;
  avatar: string;
  points: number;
  reasons: ScoreReason[];
  eventId: string;
  /** Start of the event, ISO 8601: orders the events to find the last computed one. */
  eventStartsAt: string;
};

/** Port: the score lines a ranking is made of. Real adapter = Supabase, fake = in memory. */
export interface RankingRepository {
  /** Every score line of a competition, all players, with their pseudo. */
  competitionLines(competitionSlug: string): Promise<RankingLine[]>;
}

/** A ranked player with the avatar shown next to the pseudo and the places won since the last event. */
export type RankingRow = RankedPlayer & { avatar: string; change: number | null; streak: number };

const rank = (lines: RankingLine[]): RankingRow[] => {
  const byUser = new Map(lines.map((l) => [l.userId, l]));
  const pseudoOf = (id: string) => byUser.get(id)?.pseudo ?? "";
  // League members without points have no event: they never move.
  const dated = lines.filter((l) => l.eventId !== "");
  const changes = rankChanges(dated, pseudoOf);
  const streakOf = streaks(dated);
  return rankPlayers(totalsOf(lines, pseudoOf)).map((player) => ({
    ...player,
    avatar: byUser.get(player.userId)?.avatar ?? "",
    change: changes.get(player.userId) ?? null,
    streak: streakOf.get(player.userId) ?? 0,
  }));
};

/**
 * All the players who scored in the competitions given, their points added up: every competition
 * for the general ranking (decision of 8 Nov 2026), one for the page of a competition.
 */
export function getGeneralRanking(ports: { ranking: RankingRepository }) {
  return {
    async execute(input: { competitionSlugs: string[] }): Promise<RankingRow[]> {
      const perCompetition = await Promise.all(
        input.competitionSlugs.map((slug) => ports.ranking.competitionLines(slug)),
      );
      return rank(perCompetition.flat());
    },
  };
}

/**
 * The members of a league, ranked on the league's competitions (their points add up); a member without points is listed
 * with 0. Only a member sees it. Every member gets the same ranking from the same score lines.
 */
export function getLeagueRanking(ports: { ranking: RankingRepository; leagues: LeagueRepository }) {
  return {
    async execute(input: { leagueId: string; competitionSlugs: string[] }): Promise<RankingRow[]> {
      const members = await ports.leagues.members(input.leagueId);
      if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const ids = new Set(members.map((m) => m.userId));
      const perCompetition = await Promise.all(
        input.competitionSlugs.map((slug) => ports.ranking.competitionLines(slug)),
      );
      const lines = perCompetition.flat().filter((l) => ids.has(l.userId));
      // Members without any score line yet still appear, with 0 points.
      const zero = members.map((m) => ({
        userId: m.userId,
        pseudo: m.pseudo,
        avatar: m.avatar,
        points: 0,
        reasons: [],
        eventId: "",
        eventStartsAt: "",
      }));
      return rank([...zero, ...lines]);
    },
  };
}
