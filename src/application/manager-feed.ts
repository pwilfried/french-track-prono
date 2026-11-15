import type { FeedGroup } from "@/domain/league-moments";
import { feedGroups } from "@/domain/league-moments";
import { managerMoments, type ManagerFacts } from "@/domain/manager-moments";

/**
 * Port: what the feed of a Manager league tells (#875): the athletes won at each reveal, the
 * duels once scored, the badges published. Real adapter = Supabase, fake = in memory. Someone
 * outside the league reads no fact.
 */
export interface ManagerFeedRepository {
  facts(leagueId: string): Promise<ManagerFacts>;
}

/** The « Fil » tab of a Manager league, grouped « Ce soir · <compétition> », « Hier », then by day. */
export function getManagerFeed(ports: { feed: ManagerFeedRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: { leagueId: string }): Promise<FeedGroup[]> {
      const moments = managerMoments(await ports.feed.facts(input.leagueId));
      return feedGroups(moments, now().toISOString());
    },
  };
}
