import type {
  LineupCompetition,
  ManagerLineupRepository,
  SheetRefusal,
} from "@/application/manager-lineup";
import type { DisciplineFamily } from "@/domain/discipline";
import {
  lineupProblem,
  sheetDiscipline,
  type LineupDiscipline,
  type LineupProblem,
  type LineupRules,
  type MatchSheet,
} from "@/domain/manager-lineup";

/** These problems answer `invalid`; the others, of the match sheet, answer their own name. */
const INVALID: LineupProblem[] = ["not_in_team", "twice", "absent", "does_not_fit", "incomplete"];
const refusalOf = (problem: LineupProblem): "invalid" | SheetRefusal =>
  INVALID.includes(problem) ? "invalid" : (problem as SheetRefusal);

type FakeCompetition = Omit<LineupCompetition, "entered" | "lineup"> & {
  /** Every athlete on a start list of the competition. */
  entries: string[];
};

type FakeLeague = {
  rules: LineupRules;
  mercatoClosed: boolean;
  /**
   * Participant → their team, with the disciplines each athlete may count in (the same for every
   * competition: the fake has no start list per competition).
   */
  teams: Record<
    string,
    { athleteId: string; family: DisciplineFamily; disciplines: LineupDiscipline[] }[]
  >;
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
  const lineups = new Map<string, MatchSheet>();
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
              lineup:
                lineups
                  .get(key(leagueId, c.competitionId, userId))
                  ?.starters.map((s) => s.athleteId) ?? null,
            }));
        },
        async sheet(leagueId, competitionId) {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          if (!league.competitions.some((c) => c.competitionId === competitionId)) {
            return "not_eligible";
          }
          const team = league.teams[userId]!;
          const saved = lineups.get(key(leagueId, competitionId, userId));
          // As the database stores it: every athlete of the sheet with the discipline that counts.
          const disciplineOf = (athleteId: string, chosen: string | undefined) =>
            sheetDiscipline(
              team.find((a) => a.athleteId === athleteId)!,
              chosen,
            )!.name;
          return {
            disciplines: Object.fromEntries(
              team.map((a) => [a.athleteId, structuredClone(a.disciplines)]),
            ),
            sheet: saved
              ? {
                  starters: saved.starters.map((s) => ({
                    athleteId: s.athleteId,
                    discipline: disciplineOf(s.athleteId, s.discipline),
                    substituteId: s.substituteId ?? null,
                    threshold: s.threshold ?? null,
                  })),
                  bench: saved.bench.map((s) => ({
                    athleteId: s.athleteId,
                    discipline: disciplineOf(s.athleteId, s.discipline),
                  })),
                }
              : null,
          };
        },
        async save(leagueId, competitionId, sheet) {
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
          const problem = lineupProblem(league.rules, team, sheet);
          if (problem) return refusalOf(problem);
          lineups.set(key(leagueId, competitionId, userId), structuredClone(sheet));
          return "saved";
        },
      };
    },
  };
}
