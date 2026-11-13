import { DEFAULT_BIB } from "@/domain/bib";
import {
  duelResult,
  managerStandings,
  matchdayState,
  nextDuel,
  seasonDuels,
  type DuelResult,
  type MatchdayState,
  type SeasonFixture,
  type SeasonMatchday,
  type SeasonScore,
  type StandingRow,
} from "@/domain/manager-championship";
import { seasonOver } from "@/domain/manager-honours";

import { UseCaseError } from "./errors";
import type { ManagerLeagueRepository, ManagerParticipant } from "./manager-leagues";

/** The season of a league as its participants read it: schedule (#432) and Manager scores (#431). */
export type ManagerSeasonData = {
  /** Every matchday, with the name of its competition (null: none, not played). */
  matchdays: (SeasonMatchday & { competitionName: string | null })[];
  fixtures: SeasonFixture[];
  /** The Manager score of every participant on every scored competition of the league. */
  scores: SeasonScore[];
};

/**
 * Port: the season of a Manager league. Real adapter = Supabase (the participants read the
 * schedule and the scores of their leagues); fake = in memory. A league the player is not in, or
 * whose season has not started, has no matchday.
 */
export interface ManagerSeasonRepository {
  season(leagueId: string): Promise<ManagerSeasonData>;
}

type Ports = {
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  season: ManagerSeasonRepository;
  userId: string;
};

export type MatchdayDuel = {
  home: ManagerParticipant;
  away: ManagerParticipant;
  /** Null until the competition is scored. */
  homeScore: number | null;
  awayScore: number | null;
  result: DuelResult | null;
  /** The signed-in player plays it. */
  mine: boolean;
};

/** « La journée » (#433): one matchday, its head-to-heads and their results. */
export type ManagerMatchdayView = {
  leagueName: string;
  matchdays: { round: number; state: MatchdayState }[];
  round: number;
  competitionName: string | null;
  state: MatchdayState;
  /** First or return leg; null on a bonus matchday. */
  leg: "first" | "return" | null;
  /** The player's head-to-head first; none on a bonus matchday. */
  duels: MatchdayDuel[];
};

/** « Classement » (#433): the standings and the player's next head-to-head. */
export type ManagerStandingsView = {
  leagueName: string;
  started: boolean;
  /** Every matchday of the schedule is scored, bonus ones included (#434). */
  ended: boolean;
  rows: (StandingRow & { participant: ManagerParticipant; mine: boolean })[];
  next: {
    round: number;
    competitionName: string | null;
    opponent: ManagerParticipant;
    home: boolean;
  } | null;
};

/** The league, its season and who is who; a league the player is not in is not found. */
export async function loadManagerSeason(ports: Omit<Ports, "userId">, leagueId: string) {
  const league = await ports.managerLeagues.find(leagueId);
  if (!league) throw new UseCaseError("LEAGUE_NOT_FOUND");
  const season = await ports.season.season(leagueId);
  const byId = new Map(league.participants.map((p) => [p.userId, p]));
  const participant = (userId: string): ManagerParticipant =>
    byId.get(userId) ?? { userId, pseudo: "?", bib: DEFAULT_BIB };
  const scored = new Set(season.scores.map((s) => s.competitionId));
  const matchdays = [...season.matchdays].sort((a, b) => a.round - b.round);
  // The current matchday: the first not played yet, else the last one.
  const current =
    matchdays.find((m) => matchdayState(m, scored) === "upcoming") ?? matchdays.at(-1);
  return { league, season, matchdays, current, participant, scored };
}

/**
 * A matchday of the league; without a round, the current one: the first not played yet, else the
 * last one.
 */
export function getManagerMatchday(ports: Ports) {
  return {
    async execute(input: { leagueId: string; round?: number }): Promise<ManagerMatchdayView> {
      const { league, season, matchdays, current, participant, scored } = await loadManagerSeason(
        ports,
        input.leagueId,
      );
      if (!current) throw new UseCaseError("MANAGER_SEASON_NOT_STARTED");
      const matchday =
        input.round === undefined ? current : matchdays.find((m) => m.round === input.round);
      if (!matchday) throw new UseCaseError("MATCHDAY_NOT_FOUND");
      const state = matchdayState(matchday, scored);
      const duelDays = matchdays.filter((m) => !m.bonus).length;
      const played = new Map(
        seasonDuels(matchdays, season.fixtures, season.scores)
          .filter((d) => d.round === matchday.round)
          .map((d) => [d.home, d]),
      );
      const duels = matchday.bonus
        ? []
        : season.fixtures
            .filter((f) => f.round === matchday.round)
            .map((f): MatchdayDuel => {
              const d = played.get(f.home);
              return {
                home: participant(f.home),
                away: participant(f.away),
                homeScore: d?.homeScore ?? null,
                awayScore: d?.awayScore ?? null,
                result: d ? duelResult(d.homeScore, d.awayScore) : null,
                mine: f.home === ports.userId || f.away === ports.userId,
              };
            })
            .sort((a, b) => Number(b.mine) - Number(a.mine));
      return {
        leagueName: league.name,
        matchdays: matchdays.map((m) => ({ round: m.round, state: matchdayState(m, scored) })),
        round: matchday.round,
        competitionName: matchday.competitionName,
        state,
        leg: matchday.bonus ? null : matchday.round <= duelDays / 2 ? "first" : "return",
        duels,
      };
    },
  };
}

/** The standings of the league, then the player's next head-to-head (bonus matchdays skipped). */
export function getManagerStandings(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<ManagerStandingsView> {
      const { league, season, matchdays, participant, scored } = await loadManagerSeason(
        ports,
        input.leagueId,
      );
      const duels = seasonDuels(matchdays, season.fixtures, season.scores);
      const rows = managerStandings(
        league.participants.map((p) => p.userId),
        duels,
      ).map((row) => ({
        ...row,
        participant: participant(row.userId),
        mine: row.userId === ports.userId,
      }));
      const next = nextDuel(ports.userId, matchdays, season.fixtures, scored);
      return {
        leagueName: league.name,
        started: matchdays.length > 0,
        ended: seasonOver(matchdays, scored),
        rows,
        next: next && {
          round: next.round,
          competitionName: matchdays.find((m) => m.round === next.round)?.competitionName ?? null,
          opponent: participant(next.opponent),
          home: next.home,
        },
      };
    },
  };
}
