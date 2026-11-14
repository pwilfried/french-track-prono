import { consensus, type Consensus, type ConsensusPodium } from "@/domain/consensus";

/** Port: the anonymous podiums of an event, for the signed-in player. */
export interface ConsensusRepository {
  /**
   * Every podium of a locked event, or only those of a league's members. Throws EVENT_NOT_LOCKED
   * before the lock and LEAGUE_NOT_FOUND for a league the player is not a member of.
   */
  podiums(eventId: string, leagueId?: string): Promise<ConsensusPodium[]>;
}

export type EventConsensus = {
  consensus: Consensus;
  /** How many players predicted: all of them, and the members of each of my leagues. */
  counts: { all: number; leagues: Record<string, number> };
};

/**
 * What the players predicted on a locked event: all of them, or the members of one of my leagues.
 * `official` (once the result is in) adds the share of perfect podiums.
 */
export function getEventConsensus(ports: { consensus: ConsensusRepository }) {
  return {
    async execute(input: {
      eventId: string;
      leagueId?: string;
      leagueIds: string[];
      official?: { athleteId: string; rank: number }[];
    }): Promise<EventConsensus> {
      const ids = [...new Set([...input.leagueIds, ...(input.leagueId ? [input.leagueId] : [])])];
      const [all, ...byLeague] = await Promise.all([
        ports.consensus.podiums(input.eventId),
        ...ids.map((id) => ports.consensus.podiums(input.eventId, id)),
      ]);
      const leagues = Object.fromEntries(ids.map((id, i) => [id, byLeague[i]!]));
      const shown = input.leagueId ? leagues[input.leagueId]! : all!;
      return {
        consensus: consensus(shown, input.official),
        counts: {
          all: all!.length,
          leagues: Object.fromEntries(ids.map((id) => [id, leagues[id]!.length])),
        },
      };
    },
  };
}
