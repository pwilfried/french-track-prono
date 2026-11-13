import type {
  ManagerSeasonData,
  ManagerSeasonRepository,
} from "@/application/manager-championship";

/** A league the fake knows: its participants and its season. */
export type ManagerSeasonFixture = {
  leagueId: string;
  members: string[];
  season: ManagerSeasonData;
};

/**
 * Test double of the ManagerSeasonRepository port, with the rule of the database: only the
 * participants of a league read its schedule and scores; anyone else sees an empty season.
 */
export function createInMemoryManagerSeasonStore(leagues: ManagerSeasonFixture[]) {
  return {
    session(userId: string): ManagerSeasonRepository {
      return {
        async season(leagueId) {
          const league = leagues.find((l) => l.leagueId === leagueId);
          if (!league || !league.members.includes(userId)) {
            return { matchdays: [], fixtures: [], scores: [] };
          }
          return structuredClone(league.season);
        },
      };
    },
  };
}
