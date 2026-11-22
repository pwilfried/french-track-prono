import { UseCaseError } from "./errors";
import type { League, LeagueRepository } from "./leagues";
import { getLeagueRanking, standingIn, type RankingLine, type RankingRepository } from "./rankings";

/**
 * Port: the leagues a prediction counts in (#1068). It always counts in the general ranking; in a
 * league only once its player added it there. Real adapter = Supabase, fake = in memory.
 */
export interface PredictionLeagueRepository {
  /** The leagues the player's prediction of the event counts in (the signed-in player's). */
  leaguesOf(userId: string, eventId: string): Promise<string[]>;
  /**
   * Sets exactly the leagues it counts in, the others are removed. "locked" once the event is
   * locked; "refused" for a league the player is not in, that does not count the competition, or
   * without a prediction.
   */
  set(eventId: string, leagueIds: string[]): Promise<"done" | "locked" | "refused">;
}

/** How a league shows on the sheet and on the page of the event. */
export type LeagueKind = "private" | "public" | "official";

export type PredictionLeague = {
  id: string;
  name: string;
  kind: LeagueKind;
  memberCount: number;
  /** The player's place in it, null while they have no points there. */
  rank: number | null;
  /** True when the player's prediction of the event counts in it. */
  counted: boolean;
};

/** No player is in that many leagues: a longer list is not a choice made on the screen. */
export const MAX_PREDICTION_LEAGUES = 100;

const kindOf = (league: League): LeagueKind =>
  league.isOfficial ? "official" : league.isPublic ? "public" : "private";

/**
 * The predictions leagues of the player that count the competition of the event, with their
 * place in each and whether the prediction counts there (#1068). Empty: no sheet, no block.
 */
export function listPredictionLeagues(ports: {
  leagues: LeagueRepository;
  predictionLeagues: PredictionLeagueRepository;
  ranking: RankingRepository;
}) {
  return {
    async execute(input: {
      userId: string;
      competitionSlug: string;
      eventId: string;
      /** Without a prediction, it counts nowhere: nothing to read. */
      hasPrediction: boolean;
    }): Promise<PredictionLeague[]> {
      const leagues = (await ports.leagues.listMine())
        .filter((l) => l.competitionSlugs.includes(input.competitionSlug))
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
      if (leagues.length === 0) return [];
      const counted = new Set(
        input.hasPrediction
          ? await ports.predictionLeagues.leaguesOf(input.userId, input.eventId)
          : [],
      );
      // Each competition is read once, whatever the number of leagues counting it.
      const read = new Map<string, Promise<RankingLine[]>>();
      const ranking: RankingRepository = {
        competitionLines(slug) {
          if (!read.has(slug)) read.set(slug, ports.ranking.competitionLines(slug));
          return read.get(slug)!;
        },
      };
      return Promise.all(
        leagues.map(async (league): Promise<PredictionLeague> => {
          const rows = await getLeagueRanking({ ranking, leagues: ports.leagues }).execute({
            leagueId: league.id,
            competitionSlugs: league.competitionSlugs,
            families: league.families,
            competitionAddedAt: league.competitionAddedAt,
          });
          return {
            id: league.id,
            name: league.name,
            kind: kindOf(league),
            memberCount: league.memberCount,
            rank: standingIn(rows, input.userId)?.rank ?? null,
            counted: counted.has(league.id),
          };
        }),
      );
    },
  };
}

/**
 * Sets the leagues the player's prediction of the event counts in (#1068), until the lock. It
 * keeps counting in the general ranking whatever the choice.
 */
export function savePredictionLeagues(ports: { predictionLeagues: PredictionLeagueRepository }) {
  return {
    async execute(input: { eventId: string; leagueIds: string[] }): Promise<void> {
      const leagueIds = [...new Set(input.leagueIds.filter((id) => id !== ""))];
      if (leagueIds.length > MAX_PREDICTION_LEAGUES) throw new UseCaseError("LEAGUE_NOT_FOUND");
      const outcome = await ports.predictionLeagues.set(input.eventId, leagueIds);
      if (outcome === "locked") throw new UseCaseError("PREDICTION_LOCKED");
      if (outcome === "refused") throw new UseCaseError("LEAGUE_NOT_FOUND");
    },
  };
}
