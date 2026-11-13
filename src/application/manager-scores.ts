import type { ManagerBonus } from "@/domain/manager-rules";
import {
  managerCompetitionScore,
  type AthleteScore,
  type CompetitionPerformance,
  type ManagerCompetitionScore,
} from "@/domain/manager-score";

import { UseCaseError } from "./errors";
import type { ManagerLineupRepository } from "./manager-lineup";

/** A participant of a Manager league playing the competition, with their lineup at the lock. */
export type ScoringParticipant = {
  leagueId: string;
  userId: string;
  /** The bonus values frozen in the league rules. */
  bonuses: Record<ManagerBonus, number>;
  /** Null without a validated lineup. */
  lineup: string[] | null;
};

/** Everything the admin needs to score a competition for every Manager league. */
export type ManagerScoringSheet = {
  competitionId: string;
  /** The lineups lock then: no score before. */
  lockAt: string;
  participants: ScoringParticipant[];
  performances: CompetitionPerformance[];
  /** The prediction points of every player on the competition; a player without any is absent. */
  predictionPoints: Record<string, number>;
};

/** One stored score: a participant of a league, for the competition. */
export type ManagerScoreLine = ManagerCompetitionScore & { leagueId: string; userId: string };

/** A stored score as the player reads it: the athletes with their names. */
export type StoredManagerScore = Omit<ManagerCompetitionScore, "athletes"> & {
  athletes: (AthleteScore & { name: string })[];
};

/**
 * Port: the Manager scores (#431). Real adapter = Supabase (admin RPCs; a participant reads the
 * scores of their leagues); fake = in memory.
 */
export interface ManagerScoreRepository {
  /** Admin only. Null when the competition does not exist. */
  sheet(competitionSlug: string): Promise<ManagerScoringSheet | null | "not_admin">;
  /** Replaces every Manager score of the competition, in one go. Admin only. */
  replace(competitionId: string, lines: ManagerScoreLine[]): Promise<"saved" | "not_admin">;
  /** The player's own score; null before the first computation. */
  mine(leagueId: string, competitionId: string): Promise<StoredManagerScore | null | "not_member">;
}

/**
 * The admin computes the Manager score of every participant of every league playing the
 * competition, from the performances entered and the prediction points. Run again after a
 * corrected result: everything is computed again and replaced (#416).
 */
export function computeManagerScores(ports: { scores: ManagerScoreRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: { competitionSlug: string }): Promise<ManagerScoreLine[]> {
      const sheet = await ports.scores.sheet(input.competitionSlug);
      if (sheet === "not_admin") throw new UseCaseError("NOT_ADMIN");
      if (!sheet) throw new UseCaseError("COMPETITION_NOT_FOUND");
      if (now().getTime() < Date.parse(sheet.lockAt)) {
        throw new UseCaseError("COMPETITION_NOT_STARTED");
      }
      const lines = sheet.participants.map((p) => ({
        leagueId: p.leagueId,
        userId: p.userId,
        ...managerCompetitionScore({
          lineup: p.lineup,
          performances: sheet.performances,
          predictionPoints: sheet.predictionPoints[p.userId] ?? 0,
          bonuses: p.bonuses,
        }),
      }));
      const outcome = await ports.scores.replace(sheet.competitionId, lines);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return lines;
    },
  };
}

/** « Mes points » for a competition of a Manager league: null score until the admin computes it. */
export type MyManagerScore = {
  slug: string;
  name: string;
  lockAt: string;
  score: StoredManagerScore | null;
};

export function getMyManagerScore(ports: {
  lineups: ManagerLineupRepository;
  scores: ManagerScoreRepository;
}) {
  return {
    async execute(input: { leagueId: string; slug: string }): Promise<MyManagerScore> {
      const competitions = await ports.lineups.mine(input.leagueId);
      if (competitions === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const competition = competitions.find((c) => c.slug === input.slug);
      if (!competition) throw new UseCaseError("COMPETITION_NOT_FOUND");
      const score = await ports.scores.mine(input.leagueId, competition.competitionId);
      if (score === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const { slug, name, lockAt } = competition;
      return { slug, name, lockAt, score };
    },
  };
}
