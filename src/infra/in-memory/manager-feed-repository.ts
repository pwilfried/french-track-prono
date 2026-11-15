import type { ManagerFeedRepository } from "@/application/manager-feed";
import type { ManagerFacts } from "@/domain/manager-moments";

/**
 * Test double of the ManagerFeedRepository port: the facts of each league, seen by each player
 * through `as(viewerId)`; someone outside a league reads no fact of it.
 */
export function createInMemoryManagerFeedStore(
  leagues: { id: string; members: string[]; facts: ManagerFacts }[],
) {
  return {
    as(viewerId: string): ManagerFeedRepository {
      return {
        async facts(leagueId) {
          const league = leagues.find((l) => l.id === leagueId && l.members.includes(viewerId));
          return league ? structuredClone(league.facts) : { wins: [], duels: [], published: [] };
        },
      };
    },
  };
}
