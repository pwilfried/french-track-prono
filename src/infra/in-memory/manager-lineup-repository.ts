import type { LineupCompetition, ManagerLineupRepository } from "@/application/manager-lineup";
import type { DisciplineFamily } from "@/domain/discipline";
import { lineupProblem, type LineupRules } from "@/domain/manager-lineup";

type FakeCompetition = Omit<LineupCompetition, "entered" | "lineup"> & {
  /** Every athlete on a start list of the competition. */
  entries: string[];
};

type FakeLeague = {
  rules: LineupRules;
  mercatoClosed: boolean;
  /** Participant → their team. */
  teams: Record<string, { athleteId: string; family: DisciplineFamily }[]>;
  competitions: FakeCompetition[];
};

/**
 * Test double of the ManagerLineupRepository port: the eligible competitions and teams of each
 * league, a session per player, who reads their own lineups only. It checks a lineup with the
 * rule of the domain, as the database does in SQL, and refuses it from the lock time on (`now`).
 */
export function createInMemoryManagerLineupStore(input: {
  leagues: Record<string, FakeLeague>;
  now?: () => string;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const lineups = new Map<string, string[]>();
  const key = (leagueId: string, competitionId: string, userId: string) =>
    `${leagueId}/${competitionId}/${userId}`;
  return {
    session(userId: string): ManagerLineupRepository {
      const leagueOf = (leagueId: string) => {
        const league = input.leagues[leagueId];
        return league && userId in league.teams ? league : undefined;
      };
      return {
        async mine(leagueId) {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          const team = league.teams[userId]!;
          return [...league.competitions]
            .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name))
            .map(({ entries, ...c }) => ({
              ...c,
              entered: team
                .map((a) => a.athleteId)
                .filter((id) => entries.includes(id))
                .sort(),
              lineup: structuredClone(lineups.get(key(leagueId, c.competitionId, userId)) ?? null),
            }));
        },
        async save(leagueId, competitionId, athleteIds) {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          const competition = league.competitions.find((c) => c.competitionId === competitionId);
          if (!competition) return "not_eligible";
          if (!league.mercatoClosed) return "mercato_open";
          if (Date.parse(now()) >= Date.parse(competition.lockAt)) return "locked";
          const team = league.teams[userId]!.map((a) => ({
            ...a,
            entered: competition.entries.includes(a.athleteId),
          }));
          if (lineupProblem(league.rules, team, athleteIds)) return "invalid";
          lineups.set(key(leagueId, competitionId, userId), [...athleteIds]);
          return "saved";
        },
      };
    },
  };
}
