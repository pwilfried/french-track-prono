import type { ConsensusRepository } from "@/application/consensus";
import { UseCaseError } from "@/application/errors";
import type { ConsensusPodium } from "@/domain/consensus";

/**
 * Test double of the ConsensusRepository port: events with their lock state and podiums (and who
 * made them), leagues as lists of members, and the signed-in player `me`.
 */
export function createInMemoryConsensusRepository(world: {
  events: Record<string, { locked: boolean; podiums: (ConsensusPodium & { userId: string })[] }>;
  leagues: Record<string, string[]>;
  me: string;
}): ConsensusRepository {
  return {
    async podiums(eventId, leagueId) {
      const event = world.events[eventId];
      if (!event?.locked) throw new UseCaseError("EVENT_NOT_LOCKED");
      const members = leagueId === undefined ? null : world.leagues[leagueId];
      if (members === undefined || (members && !members.includes(world.me))) {
        throw new UseCaseError("LEAGUE_NOT_FOUND");
      }
      return event.podiums
        .filter((p) => !members || members.includes(p.userId))
        .map((p) => ({ podium: { ...p.podium }, mine: p.userId === world.me }));
    },
  };
}
