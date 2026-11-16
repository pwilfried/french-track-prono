import type { BenchPlan } from "@/domain/manager-bench";
import {
  fillablePlaces,
  lineupPlaces,
  lineupStatus,
  placeLineup,
  type LineupDiscipline,
  type LineupPlace,
  type LineupProblem,
  type LineupStatus,
  type MatchSheet,
} from "@/domain/manager-lineup";

import { UseCaseError, type ErrorCode } from "./errors";
import type { ManagerBidRepository } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository } from "./manager-leagues";
import { getMyManagerTeam, type TeamAthlete } from "./manager-team";

/** An eligible competition of the league, as the player's lineup sees it (#427). */
export type LineupCompetition = {
  competitionId: string;
  slug: string;
  name: string;
  /** ISO date (YYYY-MM-DD). */
  startsOn: string;
  /** The first prediction lock of the competition: no lineup changes from then on. */
  lockAt: string;
  /** The athletes of the player's team entered in the competition. */
  entered: string[];
  /** The validated lineup; null without one. */
  lineup: string[] | null;
};

/** The refusals of a match sheet with an error of their own (#1032); the others are `invalid`. */
export type SheetRefusal = Exclude<
  LineupProblem,
  "not_in_team" | "twice" | "absent" | "does_not_fit" | "incomplete"
>;

export type LineupSaveOutcome =
  "saved" | "not_member" | "not_eligible" | "mercato_open" | "locked" | "invalid" | SheetRefusal;

/** The match sheet saved for a competition, and the disciplines each athlete may count in there. */
export type SavedSheet = {
  /** Athlete of the team → their disciplines for the competition, the first one first. */
  disciplines: Record<string, LineupDiscipline[]>;
  /** Null before the first validation. */
  sheet: MatchSheet | null;
};

/**
 * Port: the lineups of the signed-in player. Real adapter = Supabase (the database checks the
 * lineup and refuses it after the lock); fake = in memory.
 */
export interface ManagerLineupRepository {
  /** The eligible competitions of the league, first one first. */
  mine(leagueId: string): Promise<LineupCompetition[] | "not_member">;
  /** The match sheet of an eligible competition (#1035); `not_eligible` for any other. */
  sheet(
    leagueId: string,
    competitionId: string,
  ): Promise<SavedSheet | "not_member" | "not_eligible">;
  /** Validates the match sheet for a competition, or replaces it: the last one counts. */
  save(leagueId: string, competitionId: string, sheet: MatchSheet): Promise<LineupSaveOutcome>;
}

export type LineupSummary = Pick<LineupCompetition, "slug" | "name" | "startsOn" | "lockAt"> & {
  status: LineupStatus;
};

/** The eligible competitions of the league with where the player's lineup stands. */
export function listMyLineups(ports: { lineups: ManagerLineupRepository }) {
  return {
    async execute(input: { leagueId: string; now: string }): Promise<LineupSummary[]> {
      const mine = await ports.lineups.mine(input.leagueId);
      if (mine === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      return mine.map(({ slug, name, startsOn, lockAt, lineup }) => ({
        slug,
        name,
        startsOn,
        lockAt,
        status: lineupStatus({ lockAt, validated: lineup !== null }, input.now),
      }));
    },
  };
}

export type LineupAthleteView = TeamAthlete & {
  entered: boolean;
  /** Where they may count in this competition, the first one first; empty when unknown. */
  disciplines: LineupDiscipline[];
};

/**
 * The match sheet of one competition (#1035): its places, which ones the team can fill, the
 * athletes of the team (entered or absent), who sits where, the bench in order and the settings
 * of each starter. Without a validated lineup, every place and the bench are empty.
 */
export type MyLineup = {
  leagueName: string;
  /** How many substitutes the bench holds. */
  benchSize: number;
  /** Table points are divided by it (#1031). */
  divisor: number;
  plan: BenchPlan;
  competitionId: string;
  slug: string;
  name: string;
  lockAt: string;
  status: LineupStatus;
  mercatoClosed: boolean;
  places: LineupPlace[];
  fillable: boolean[];
  athletes: LineupAthleteView[];
  placed: (string | null)[];
};

export function getMyLineup(ports: {
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  bids: ManagerBidRepository;
  catalogue: ManagerCatalogueRepository;
  lineups: ManagerLineupRepository;
}) {
  return {
    async execute(input: { leagueId: string; slug: string; now: string }): Promise<MyLineup> {
      const [league, team, mine] = await Promise.all([
        ports.managerLeagues.find(input.leagueId),
        getMyManagerTeam(ports).execute({ leagueId: input.leagueId }),
        ports.lineups.mine(input.leagueId),
      ]);
      if (!league || mine === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const competition = mine.find((c) => c.slug === input.slug);
      if (!competition) throw new UseCaseError("COMPETITION_NOT_FOUND");
      const saved = await ports.lineups.sheet(input.leagueId, competition.competitionId);
      if (saved === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      if (saved === "not_eligible") throw new UseCaseError("COMPETITION_NOT_FOUND");
      const entered = new Set(competition.entered);
      const athletes = team.athletes.map((a) => ({
        ...a,
        entered: entered.has(a.athleteId),
        disciplines: saved.disciplines[a.athleteId] ?? [],
      }));
      const places = lineupPlaces(league.rules.lineup);
      const sheet = saved.sheet;
      const starters = sheet?.starters.map((s) => s.athleteId) ?? competition.lineup ?? [];
      return {
        leagueName: league.name,
        benchSize: league.rules.lineup.bench,
        divisor: league.rules.tablesDivisor,
        plan: {
          bench: sheet?.bench.map((s) => s.athleteId) ?? [],
          settings: Object.fromEntries(
            (sheet?.starters ?? []).map(({ athleteId, ...setting }) => [athleteId, setting]),
          ),
        },
        competitionId: competition.competitionId,
        slug: competition.slug,
        name: competition.name,
        lockAt: competition.lockAt,
        status: lineupStatus(
          { lockAt: competition.lockAt, validated: competition.lineup !== null },
          input.now,
        ),
        mercatoClosed: team.mercatoClosed,
        places,
        fillable: fillablePlaces(places, athletes),
        athletes,
        placed: placeLineup(places, athletes, starters).placed,
      };
    },
  };
}

const refused: Record<Exclude<LineupSaveOutcome, "saved">, ErrorCode> = {
  not_member: "LEAGUE_NOT_FOUND",
  not_eligible: "COMPETITION_NOT_FOUND",
  mercato_open: "MERCATO_NOT_OVER",
  locked: "LINEUP_LOCKED",
  invalid: "LINEUP_INVALID",
  bench_full: "LINEUP_BENCH_FULL",
  discipline_not_entered: "LINEUP_DISCIPLINE_NOT_ENTERED",
  substitute_not_on_bench: "LINEUP_SUBSTITUTE_NOT_ON_BENCH",
  substitute_other_family: "LINEUP_SUBSTITUTE_OTHER_FAMILY",
  substitute_twice: "LINEUP_SUBSTITUTE_TWICE",
  threshold_without_substitute: "LINEUP_THRESHOLD_WITHOUT_SUBSTITUTE",
  implausible_threshold: "LINEUP_THRESHOLD_IMPLAUSIBLE",
};

/** Validates the player's match sheet for a competition, or changes it, until the lock. */
export function saveMyLineup(ports: { lineups: ManagerLineupRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      competitionId: string;
      sheet: MatchSheet;
    }): Promise<void> {
      const outcome = await ports.lineups.save(input.leagueId, input.competitionId, input.sheet);
      if (outcome !== "saved") throw new UseCaseError(refused[outcome]);
    },
  };
}
