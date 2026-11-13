import { managerStandings, nextDuel, seasonDuels } from "@/domain/manager-championship";
import { seasonOver } from "@/domain/manager-honours";
import { currentSeasonStep, type SeasonProgress, type SeasonStep } from "@/domain/manager-home";
import { lineupStatus } from "@/domain/manager-lineup";

import { UseCaseError } from "./errors";
import { loadSeason, type ManagerSeasonRepository } from "./manager-championship";
import type { ManagerLeagueRepository, ManagerParticipant } from "./manager-leagues";
import type { ManagerLineupRepository } from "./manager-lineup";

/** « Ma saison » on the Manager home (#606): where the player's league stands and what to do. */
export type MySeason = {
  leagueId: string;
  leagueName: string;
  players: number;
  step: SeasonStep;
  /** Matchday N of M, from the draw of the schedule (the mercato close). */
  round: { current: number; total: number } | null;
  standing: {
    rank: number;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    difference: number;
  } | null;
  next: {
    round: number;
    home: boolean;
    me: ManagerParticipant;
    opponent: ManagerParticipant;
  } | null;
  /** The competition to line up for, on the lineup step. */
  lineup: { slug: string; lockAt: string } | null;
  /** The slug of the last competition with Manager scores, for « Mes derniers points ». */
  lastPoints: string | null;
};

type Ports = {
  managerLeagues: Pick<ManagerLeagueRepository, "listMine" | "find">;
  season: ManagerSeasonRepository;
  lineups: Pick<ManagerLineupRepository, "mine">;
  userId: string;
};

/**
 * The season of the player's first Manager league; null without a league. The lineups are read
 * once the mercato is closed only.
 */
export function getManagerHome(ports: Ports) {
  return {
    async execute(input: { now: string }): Promise<MySeason | null> {
      const [first] = await ports.managerLeagues.listMine();
      if (!first) return null;
      const { league, season, matchdays, current, participant, scored } = await loadSeason(
        ports,
        first.id,
      );
      const base = {
        leagueId: league.id,
        leagueName: league.name,
        players: league.participants.length,
        round: null,
        standing: null,
        next: null,
        lineup: null,
        lastPoints: null,
      };
      if (!current) {
        const mercato = league.mercato.openedAt === null ? "waiting" : "open";
        return {
          ...base,
          step: currentSeasonStep({
            league: true,
            mercato,
            nextLineup: null,
            scored: false,
            over: false,
          }),
        };
      }

      const mine = await ports.lineups.mine(league.id);
      if (mine === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const competitions = [...mine].sort((a, b) => a.lockAt.localeCompare(b.lockAt));
      const upcoming = competitions.find((c) => !scored.has(c.competitionId));
      const lastScored = competitions.filter((c) => scored.has(c.competitionId)).at(-1);
      const progress: SeasonProgress = {
        league: true,
        mercato: "closed",
        nextLineup: upcoming
          ? lineupStatus(
              { lockAt: upcoming.lockAt, validated: upcoming.lineup !== null },
              input.now,
            )
          : null,
        scored: scored.size > 0,
        over: seasonOver(matchdays, scored),
      };
      const step = currentSeasonStep(progress);
      const row = managerStandings(
        league.participants.map((p) => p.userId),
        seasonDuels(matchdays, season.fixtures, season.scores),
      ).find((r) => r.userId === ports.userId);
      const next = nextDuel(ports.userId, matchdays, season.fixtures, scored);
      return {
        ...base,
        step,
        round: { current: current.round, total: matchdays.length },
        standing: row
          ? {
              rank: row.rank,
              points: row.points,
              wins: row.wins,
              draws: row.draws,
              losses: row.losses,
              difference: row.difference,
            }
          : null,
        next: next && {
          round: next.round,
          home: next.home,
          me: participant(ports.userId),
          opponent: participant(next.opponent),
        },
        lineup:
          step === "lineup" && upcoming ? { slug: upcoming.slug, lockAt: upcoming.lockAt } : null,
        lastPoints: lastScored?.slug ?? null,
      };
    },
  };
}
