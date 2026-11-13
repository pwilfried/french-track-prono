import { eventPhase } from "@/domain/countdown";
import { missingPodiumRanks } from "@/domain/official-result";
import {
  flairContext,
  scorePrediction,
  type EventBets,
  type OfficialLine,
  type ScoreReason,
  type ScoringPrediction,
  type ScoringRules,
} from "@/domain/scoring";

import { UseCaseError } from "./errors";

/** Everything needed to score one event. */
export type EventToScore = {
  lockAt: string;
  results: OfficialLine[];
  /** All the predictions of the event (readable by everyone once the event is locked). */
  predictions: (ScoringPrediction & { userId: string })[];
  rules: ScoringRules;
  /** v0.9: odds and the tolerance of a mark, when the event plays with them. */
  bets?: EventBets;
};

/** One score line: the points of one player on one event, with the reasons. */
export type ScoreLine = { userId: string; points: number; reasons: ScoreReason[] };

/** Port: points. Real adapter = Supabase (the admin's own session), fake = in memory. */
export interface PointsRepository {
  /** Null when the event does not exist. */
  loadEvent(eventId: string): Promise<EventToScore | null>;
  /** The score lines of an event, in any order. */
  findEventScores(eventId: string): Promise<ScoreLine[]>;
  /** Where the back-office stands in a competition: events with a result, events with points. */
  progress(competitionSlug: string): Promise<{ withResult: string[]; scored: string[] }>;
  /** The player's own score lines for the events of a competition. */
  listMine(userId: string, competitionSlug: string): Promise<(ScoreLine & { eventId: string })[]>;
  /** Replaces all the score lines of an event, in one go. */
  replaceEventScores(eventId: string, lines: ScoreLine[]): Promise<"saved" | "not_admin">;
}

/**
 * Computes the points of every player who predicted an event, from its official result. Can be run
 * again (after a corrected result): the lines of the event are replaced, never duplicated.
 */
export function computeEventPoints(ports: { points: PointsRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: { eventId: string }): Promise<ScoreLine[]> {
      const event = await ports.points.loadEvent(input.eventId);
      if (!event) throw new UseCaseError("EVENT_NOT_FOUND");
      if (eventPhase(now(), event.lockAt) === "open") throw new UseCaseError("EVENT_NOT_LOCKED");
      if (event.results.length === 0) throw new UseCaseError("RESULT_MISSING");
      if (missingPodiumRanks(event.results).length > 0) throw new UseCaseError("RESULT_INCOMPLETE");

      const context = flairContext(event.predictions);
      const lines = event.predictions.map((prediction) => ({
        userId: prediction.userId,
        ...scorePrediction(prediction, event.results, event.rules, context, event.bets),
      }));
      const outcome = await ports.points.replaceEventScores(input.eventId, lines);
      if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return lines;
    },
  };
}
