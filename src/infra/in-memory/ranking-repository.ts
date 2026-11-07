import type { RankingLine, RankingRepository } from "@/application/rankings";

/** Test double of the RankingRepository port: score lines given by competition slug. */
export function createInMemoryRankingRepository(
  linesByCompetition: Record<string, RankingLine[]>,
): RankingRepository {
  return {
    async competitionLines(competitionSlug) {
      return (linesByCompetition[competitionSlug] ?? []).map((line) => ({ ...line }));
    },
  };
}
