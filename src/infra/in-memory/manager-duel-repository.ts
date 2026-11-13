import type { DuelScore, ManagerDuelRepository } from "@/application/manager-duel";

/** A league the fake knows: its participants, its competitions, their lineups and scores. */
export type ManagerDuelFixture = {
  leagueId: string;
  members: string[];
  /** The competitions of the league whose lineups are locked. */
  locked: string[];
  lineups: { competitionId: string; userId: string; athleteIds: string[] }[];
  scores: (DuelScore & { competitionId: string })[];
};

/**
 * Test double of the ManagerDuelRepository port, with the rules of the database: only the
 * participants of a league read it, and no lineup shows before the lock of its competition.
 */
export function createInMemoryManagerDuelStore(leagues: ManagerDuelFixture[]) {
  const find = (leagueId: string, userId: string) => {
    const league = leagues.find((l) => l.leagueId === leagueId);
    return league?.members.includes(userId) ? league : undefined;
  };
  return {
    session(userId: string): ManagerDuelRepository {
      return {
        async lineups(leagueId, competitionId) {
          const league = find(leagueId, userId);
          if (!league) return "not_member";
          const locked = league.locked.includes(competitionId);
          return {
            locked,
            lineups: locked
              ? league.lineups
                  .filter((l) => l.competitionId === competitionId)
                  .map(({ userId: id, athleteIds }) => ({
                    userId: id,
                    athleteIds: [...athleteIds],
                  }))
              : [],
          };
        },
        async scores(leagueId, competitionId) {
          const league = find(leagueId, userId);
          return (league?.scores ?? [])
            .filter((s) => s.competitionId === competitionId)
            .map(({ userId: id, total, predictions, athletes }) =>
              structuredClone({ userId: id, total, predictions, athletes }),
            );
        },
      };
    },
  };
}
