import { rankPlayers, totalsOf, type RankedPlayer } from "@/domain/ranking";
import type { ScoreReason } from "@/domain/scoring";

import { UseCaseError } from "./errors";
import type { LeagueRepository } from "./leagues";

export type RankingLine = {
  userId: string;
  pseudo: string;
  points: number;
  reasons: ScoreReason[];
};

/** Port: the score lines a ranking is made of. Real adapter = Supabase, fake = in memory. */
export interface RankingRepository {
  /** Every score line of a competition, all players, with their pseudo. */
  competitionLines(competitionSlug: string): Promise<RankingLine[]>;
}

const rank = (lines: RankingLine[]) => {
  const pseudos = new Map(lines.map((l) => [l.userId, l.pseudo]));
  return rankPlayers(totalsOf(lines, (id) => pseudos.get(id) ?? ""));
};

/** All the players who scored in a competition. */
export function getGeneralRanking(ports: { ranking: RankingRepository }) {
  return {
    async execute(input: { competitionSlug: string }): Promise<RankedPlayer[]> {
      return rank(await ports.ranking.competitionLines(input.competitionSlug));
    },
  };
}

/**
 * The members of a league, ranked on the league's competition; a member without points is listed
 * with 0. Only a member sees it. Every member gets the same ranking from the same score lines.
 */
export function getLeagueRanking(ports: { ranking: RankingRepository; leagues: LeagueRepository }) {
  return {
    async execute(input: { leagueId: string; competitionSlug: string }): Promise<RankedPlayer[]> {
      const members = await ports.leagues.members(input.leagueId);
      if (!members) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const ids = new Set(members.map((m) => m.userId));
      const lines = (await ports.ranking.competitionLines(input.competitionSlug)).filter((l) =>
        ids.has(l.userId),
      );
      // Members without any score line yet still appear, with 0 points.
      const zero = members.map((m) => ({
        userId: m.userId,
        pseudo: m.pseudo,
        points: 0,
        reasons: [],
      }));
      return rank([...zero, ...lines]);
    },
  };
}
