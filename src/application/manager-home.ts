import { managerStandings, nextDuel, seasonDuels } from "@/domain/manager-championship";
import { seasonOver } from "@/domain/manager-honours";
import { currentSeasonStep, type SeasonProgress, type SeasonStep } from "@/domain/manager-home";
import { lineupStatus } from "@/domain/manager-lineup";
import { currentRound } from "@/domain/manager-round";

import { UseCaseError } from "./errors";
import { loadSeason, type ManagerSeasonRepository } from "./manager-championship";
import type { ManagerLeagueRepository, ManagerParticipant } from "./manager-leagues";
import type { ManagerLineupRepository } from "./manager-lineup";

/**
 * « Ma saison » (#606): where one of the player's leagues stands and what to do. The Manager tab
 * lists one per league, the league page shows its own (#774).
 */
export type MySeason = {
  leagueId: string;
  step: SeasonStep;
  /** The bidding round open now and when it ends (ISO), while the mercato is open. */
  mercato: { round: number; endsAt: string } | null;
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
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  season: ManagerSeasonRepository;
  lineups: Pick<ManagerLineupRepository, "mine">;
  userId: string;
};

/** The seasons of all the player's Manager leagues, in the order of the list (#774). */
export function listMySeasons(
  ports: Ports & { managerLeagues: Pick<ManagerLeagueRepository, "listMine"> },
) {
  return {
    async execute(input: { now: string }): Promise<MySeason[]> {
      const leagues = await ports.managerLeagues.listMine();
      return Promise.all(leagues.map((league) => seasonOf(ports, league.id, input.now)));
    },
  };
}

/** The season of one of the player's leagues; LEAGUE_NOT_FOUND outside it. */
export function getManagerSeason(ports: Ports) {
  return {
    execute: (input: { leagueId: string; now: string }) =>
      seasonOf(ports, input.leagueId, input.now),
  };
}

/** The lineups are read once the mercato is closed only. */
async function seasonOf(ports: Ports, leagueId: string, now: string): Promise<MySeason> {
  const { league, season, matchdays, current, participant, scored } = await loadSeason(
    ports,
    leagueId,
  );
  const base = {
    leagueId: league.id,
    mercato: null,
    round: null,
    standing: null,
    next: null,
    lineup: null,
    lastPoints: null,
  };
  if (!current) {
    const { openedAt } = league.mercato;
    return {
      ...base,
      step: currentSeasonStep({
        league: true,
        mercato: openedAt === null ? "waiting" : "open",
        nextLineup: null,
        scored: false,
        over: false,
      }),
      mercato: openedAt === null ? null : currentRound(openedAt, league.rules.rounds, now),
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
      ? lineupStatus({ lockAt: upcoming.lockAt, validated: upcoming.lineup !== null }, now)
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
    lineup: step === "lineup" && upcoming ? { slug: upcoming.slug, lockAt: upcoming.lockAt } : null,
    lastPoints: lastScored?.slug ?? null,
  };
}
