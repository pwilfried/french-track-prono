import type { DisciplineFamily } from "@/domain/discipline";
import {
  duelOutcome,
  duelResult,
  type DuelOutcome,
  type DuelResult,
} from "@/domain/manager-championship";
import { lineupPlaces, placeLineup, type LineupPlace } from "@/domain/manager-lineup";
import type { ManagerSex } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";
import { legOf, loadSeason, type ManagerSeasonRepository } from "./manager-championship";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository, ManagerParticipant } from "./manager-leagues";

/** The lineups of a competition of the league: none before the lock, every one from it on. */
export type DuelLineups = {
  locked: boolean;
  /** The athletes in the order they were validated; a player without a lineup is absent. */
  lineups: { userId: string; athleteIds: string[] }[];
};

/** The stored Manager score of a participant for a competition, as the league reads it. */
export type DuelScore = {
  userId: string;
  total: number;
  predictions: number;
  athletes: { athleteId: string; total: number; bonusPoints: number }[];
};

/**
 * Port: what a head-to-head shows (#605). Real adapter = Supabase (the database keeps every
 * lineup secret until the lock of its competition); fake = in memory.
 */
export interface ManagerDuelRepository {
  lineups(leagueId: string, competitionId: string): Promise<DuelLineups | "not_member">;
  /** Every stored score of the competition in the league; none before the computation. */
  scores(leagueId: string, competitionId: string): Promise<DuelScore[]>;
}

/** An athlete on their place of the stadium, with their points once the competition is scored. */
export type DuelCard = {
  athleteId: string;
  name: string;
  discipline: string;
  family: DisciplineFamily;
  sex: ManagerSex;
  /** Null until the competition is scored. */
  points: number | null;
  /** The sporting bonuses within the points. */
  bonus: number;
};

export type DuelSide = {
  participant: ManagerParticipant;
  home: boolean;
  /** Null until the competition is scored. */
  score: number | null;
  /** The prediction points within the score. */
  predictions: number | null;
  /** False once locked without a lineup: the player scores 0. */
  linedUp: boolean;
  /** One per place of the stadium: null for an empty one, or everyone before the lock. */
  cards: (DuelCard | null)[];
};

/** « Une confrontation » (#605): both lineups on one stadium, the opponent at the top. */
export type ManagerDuelView = {
  leagueName: string;
  round: number;
  competitionName: string | null;
  leg: "first" | "return";
  locked: boolean;
  /** The signed-in player plays it: they sit at the bottom. */
  mine: boolean;
  places: LineupPlace[];
  /** The opponent; for a member outside the head-to-head, the away player. */
  top: DuelSide;
  bottom: DuelSide;
  result: DuelResult | null;
  /** The head-to-head as the player at the bottom sees it, when it is theirs. */
  outcome: { outcome: DuelOutcome; points: number } | null;
};

/**
 * A head-to-head of the league, read by every participant: the two lineups once the competition
 * is locked (secret before), each athlete's points once it is scored.
 */
export function getManagerDuel(ports: {
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
  season: ManagerSeasonRepository;
  duels: ManagerDuelRepository;
  catalogue: ManagerCatalogueRepository;
  userId: string;
}) {
  return {
    async execute(input: {
      leagueId: string;
      round: number;
      /** The home player identifies the head-to-head of the matchday. */
      home: string;
    }): Promise<ManagerDuelView> {
      const { league, season, matchdays, participant } = await loadSeason(ports, input.leagueId);
      const matchday = matchdays.find((m) => m.round === input.round);
      const fixture = season.fixtures.find((f) => f.round === input.round && f.home === input.home);
      const leg = matchday && legOf(matchday, matchdays);
      if (!matchday?.competitionId || !leg || !fixture) {
        throw new UseCaseError("MATCHDAY_NOT_FOUND");
      }
      const [lineups, catalogue] = await Promise.all([
        ports.duels.lineups(input.leagueId, matchday.competitionId),
        ports.catalogue.list(input.leagueId),
      ]);
      if (lineups === "not_member" || catalogue === "not_member") {
        throw new UseCaseError("LEAGUE_NOT_FOUND");
      }
      const scores = lineups.locked
        ? await ports.duels.scores(input.leagueId, matchday.competitionId)
        : [];
      const scored = scores.length > 0;
      const athletes = new Map(catalogue.map((a) => [a.athleteId, a]));
      const places = lineupPlaces(league.rules.lineup);

      const side = (userId: string): DuelSide => {
        const lineup = lineups.lineups.find((l) => l.userId === userId);
        const score = scores.find((s) => s.userId === userId);
        const known = (lineup?.athleteIds ?? []).flatMap((id) => {
          const a = athletes.get(id);
          return a ? [a] : [];
        });
        const { placed } = placeLineup(
          places,
          known.map((a) => ({ athleteId: a.athleteId, family: a.family, entered: true })),
          known.map((a) => a.athleteId),
        );
        return {
          participant: participant(userId),
          home: userId === fixture.home,
          score: scored ? (score?.total ?? 0) : null,
          predictions: scored ? (score?.predictions ?? 0) : null,
          linedUp: !lineups.locked || lineup !== undefined,
          cards: placed.map((id) => {
            const a = id ? athletes.get(id) : undefined;
            if (!a) return null;
            const points = score?.athletes.find((s) => s.athleteId === a.athleteId);
            return {
              athleteId: a.athleteId,
              name: a.name,
              discipline: a.discipline,
              family: a.family,
              sex: a.sex,
              points: scored ? (points?.total ?? 0) : null,
              bonus: points?.bonusPoints ?? 0,
            };
          }),
        };
      };

      const mine = ports.userId === fixture.home || ports.userId === fixture.away;
      const bottomId = mine ? ports.userId : fixture.home;
      const topId = bottomId === fixture.home ? fixture.away : fixture.home;
      const top = side(topId);
      const bottom = side(bottomId);
      const home = bottom.home ? bottom : top;
      const away = bottom.home ? top : bottom;
      return {
        leagueName: league.name,
        round: matchday.round,
        competitionName: matchday.competitionName,
        leg,
        locked: lineups.locked,
        mine,
        places,
        top,
        bottom,
        result:
          home.score === null || away.score === null ? null : duelResult(home.score, away.score),
        outcome:
          mine && bottom.score !== null && top.score !== null
            ? duelOutcome(bottom.score, top.score)
            : null,
      };
    },
  };
}
