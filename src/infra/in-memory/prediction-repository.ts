import { eventPhase } from "@/domain/countdown";
import type { Prediction, PredictionRepository } from "@/application/save-prediction";

/** What the fake needs to know about an event to apply the same rules as the database. */
export type PredictionEventFixture = {
  id: string;
  competitionSlug: string;
  lockAt: string;
  athleteIds: string[];
};

/**
 * Test double of the PredictionRepository port, with the rules of the database: locked after
 * `lockAt`, only athletes of the start list, one joker per player. All the events given belong to
 * one competition.
 */
export function createInMemoryPredictionRepository(options: {
  events: PredictionEventFixture[];
  now?: () => Date;
}): PredictionRepository {
  const now = options.now ?? (() => new Date());
  const stored = new Map<string, Prediction>();
  const key = (userId: string, eventId: string) => `${userId}:${eventId}`;

  return {
    async find(userId, eventId) {
      return stored.get(key(userId, eventId)) ?? null;
    },
    async listForCompetition(userId, competitionSlug) {
      const ids = new Set(
        options.events.filter((e) => e.competitionSlug === competitionSlug).map((e) => e.id),
      );
      return [...stored.values()].filter((p) => p.userId === userId && ids.has(p.eventId));
    },
    async save(prediction) {
      const event = options.events.find((e) => e.id === prediction.eventId);
      if (!event) throw new Error(`unknown event ${prediction.eventId}`);
      if (eventPhase(now(), event.lockAt) === "locked") return "locked";

      const { first, second, third } = prediction.podium;
      if (![first, second, third].every((id) => event.athleteIds.includes(id))) {
        return "athlete_not_in_event";
      }
      if (prediction.useJoker) {
        const otherJoker = [...stored.values()].some(
          (p) => p.userId === prediction.userId && p.eventId !== prediction.eventId && p.useJoker,
        );
        if (otherJoker) return "joker_already_used";
      }
      stored.set(key(prediction.userId, prediction.eventId), prediction);
      return "saved";
    },
  };
}
