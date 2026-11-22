import type {
  ManagerJokerOutcome,
  ManagerJokerPlayRow,
  ManagerJokerRepository,
} from "@/application/manager-jokers";
import type { ManagerJoker } from "@/domain/manager-jokers";

/** A matchday of a Manager league: its competition, bonus or head-to-head, and its fixtures. */
export type ManagerJokerMatchday = {
  competitionId: string;
  bonus: boolean;
  fixtures: { home: string; away: string }[];
};

/** What the fake knows of the Manager leagues, the teams, the match sheets and the locks. */
export type ManagerJokerWorld = {
  leagues: {
    id: string;
    members: string[];
    jokers: string[];
    /** The team of each member. */
    teams: Record<string, string[]>;
    matchdays: ManagerJokerMatchday[];
    /** The athletes on the match sheet, as `user:competition`. */
    sheets: Record<string, string[]>;
  }[];
  /** The names of the athletes; their id without one. */
  names?: Record<string, string>;
  /** When the lineups of each competition lock. */
  locks: Record<string, string>;
  now?: () => Date;
};

/**
 * Test double of the ManagerJokerRepository port (#1091), with the rules of the database: once in
 * the season, one per head-to-head, never on a bonus matchday, the home advantage at home, a target
 * that fits the joker, until the lock; the coaching after it, once. The others see a joker from the
 * lock. Not modelled: the families and the start of the events of the coaching.
 */
export function createInMemoryManagerJokerStore(world: ManagerJokerWorld) {
  const now = world.now ?? (() => new Date());
  const plays: (ManagerJokerPlayRow & { leagueId: string })[] = [];
  const locked = (competitionId: string) =>
    Date.parse(world.locks[competitionId] ?? "1970-01-01") <= now().getTime();

  return {
    session(options: { userId: string }): ManagerJokerRepository {
      const me = options.userId;
      const leagueOf = (id: string) => {
        const league = world.leagues.find((l) => l.id === id);
        return league?.members.includes(me) ? league : null;
      };
      const mineOn = (leagueId: string, competitionId: string) =>
        plays.findIndex(
          (p) => p.leagueId === leagueId && p.userId === me && p.competitionId === competitionId,
        );

      return {
        async leagueJokers(leagueId) {
          return [...(leagueOf(leagueId)?.jokers ?? [])];
        },

        async plays(leagueId) {
          if (!leagueOf(leagueId)) return [];
          return plays
            .filter((p) => p.leagueId === leagueId && (p.userId === me || locked(p.competitionId)))
            .map((p) => ({
              userId: p.userId,
              competitionId: p.competitionId,
              kind: p.kind,
              athleteId: p.athleteId,
              discipline: p.discipline,
              replacedId: p.replacedId,
              coached: p.coached,
            }));
        },

        async duel(leagueId, competitionId) {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          const matchday = league.matchdays.find((m) => m.competitionId === competitionId);
          const fixture = matchday?.bonus
            ? undefined
            : matchday?.fixtures.find((f) => f.home === me || f.away === me);
          if (!fixture) return null;
          const opponentId = fixture.home === me ? fixture.away : fixture.home;
          return {
            home: fixture.home === me,
            opponentId,
            opponentTeam: (league.teams[opponentId] ?? []).map((athleteId) => ({
              athleteId,
              name: world.names?.[athleteId] ?? athleteId,
            })),
          };
        },

        async play(leagueId, competitionId, kind: ManagerJoker, athleteId) {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          if (locked(competitionId)) return "locked";
          const elsewhere = plays.some(
            (p) =>
              p.leagueId === leagueId &&
              p.userId === me &&
              p.kind === kind &&
              p.competitionId !== competitionId,
          );
          if (!league.jokers.includes(kind) || elsewhere) return "not_available";
          const matchday = league.matchdays.find((m) => m.competitionId === competitionId);
          const fixture = matchday?.bonus
            ? undefined
            : matchday?.fixtures.find((f) => f.home === me || f.away === me);
          if (!fixture) return "no_duel";
          const home = fixture.home === me;
          if (kind === "home_advantage" && !home) return "away";
          const opponent = home ? fixture.away : fixture.home;
          const sheet = league.sheets[`${me}:${competitionId}`] ?? [];
          const fits =
            kind === "coaching" || kind === "home_advantage"
              ? athleteId === null
              : athleteId !== null &&
                (kind === "false_start"
                  ? (league.teams[opponent] ?? []).includes(athleteId)
                  : (league.teams[me] ?? []).includes(athleteId) &&
                    (kind === "captain" || !sheet.includes(athleteId)));
          if (!fits) return "bad_target";
          const at = mineOn(leagueId, competitionId);
          if (at >= 0) plays.splice(at, 1);
          plays.push({
            leagueId,
            userId: me,
            competitionId,
            kind,
            athleteId,
            discipline: null,
            replacedId: null,
            coached: false,
          });
          return "done";
        },

        async remove(leagueId, competitionId) {
          if (!leagueOf(leagueId)) return "not_member";
          if (locked(competitionId)) return "locked";
          const at = mineOn(leagueId, competitionId);
          if (at >= 0) plays.splice(at, 1);
          return "done";
        },

        async coach(leagueId, competitionId, outId, inId): Promise<ManagerJokerOutcome> {
          const league = leagueOf(leagueId);
          if (!league) return "not_member";
          const play = plays[mineOn(leagueId, competitionId)];
          if (!locked(competitionId) || play?.kind !== "coaching" || play.coached) {
            return "no_coaching";
          }
          const sheet = league.sheets[`${me}:${competitionId}`] ?? [];
          if (!sheet.includes(outId) || sheet.includes(inId)) return "bad_target";
          if (!(league.teams[me] ?? []).includes(inId)) return "bad_target";
          Object.assign(play, { athleteId: inId, replacedId: outId, coached: true });
          return "done";
        },
      };
    },
  };
}
