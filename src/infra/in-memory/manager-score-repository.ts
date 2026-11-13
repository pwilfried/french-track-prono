import type {
  ManagerScoreLine,
  ManagerScoreRepository,
  ManagerScoringSheet,
} from "@/application/manager-scores";

/** A competition the fake knows: what the admin's sheet holds, plus the athletes' names. */
export type ManagerScoreFixture = Omit<ManagerScoringSheet, "competitionId"> & {
  competitionId: string;
  slug: string;
  names: Record<string, string>;
};

/**
 * Test double of the ManagerScoreRepository port, with the rules of the database: only an admin
 * reads the sheet (lineups are private) and writes the scores, a new computation replaces every
 * score of the competition, a participant reads their own score in their leagues.
 */
export function createInMemoryManagerScoreStore(competitions: ManagerScoreFixture[]) {
  const stored = new Map<string, ManagerScoreLine[]>();
  return {
    session(options: { isAdmin: boolean; userId?: string }): ManagerScoreRepository {
      return {
        async sheet(slug) {
          if (!options.isAdmin) return "not_admin";
          const found = competitions.find((c) => c.slug === slug);
          if (!found) return null;
          const { competitionId, lockAt, participants, performances, predictionPoints } = found;
          return structuredClone({
            competitionId,
            lockAt,
            participants,
            performances,
            predictionPoints,
          });
        },
        async replace(competitionId, lines) {
          if (!options.isAdmin) return "not_admin";
          stored.set(competitionId, structuredClone(lines));
          return "saved";
        },
        async mine(leagueId, competitionId) {
          const competition = competitions.find((c) => c.competitionId === competitionId);
          const member = competitions.some((c) =>
            c.participants.some((p) => p.leagueId === leagueId && p.userId === options.userId),
          );
          if (!member) return "not_member";
          const line = (stored.get(competitionId) ?? []).find(
            (l) => l.leagueId === leagueId && l.userId === options.userId,
          );
          if (!line) return null;
          const { linedUp, total, hungarian, bonus, predictions, athletes } = structuredClone(line);
          return {
            linedUp,
            total,
            hungarian,
            bonus,
            predictions,
            athletes: athletes.map((a) => ({
              ...a,
              name: competition?.names[a.athleteId] ?? "?",
            })),
          };
        },
      };
    },
  };
}
