import { eventPhase } from "@/domain/countdown";
import type { DisciplineFamily, MarkUnit } from "@/domain/discipline";
import { isInRange, markRange } from "@/domain/mark-range";
import { OTHER_ATHLETE } from "@/domain/podium-draft";
import type { Prediction, PredictionRepository } from "@/application/save-prediction";

/** What the fake needs to know about an event to apply the same rules as the database. */
export type PredictionEventFixture = {
  id: string;
  competitionSlug: string;
  lockAt: string;
  athleteIds: string[];
  /** False for a heat, or a final whose earlier rounds are not finished. Default: true. */
  predictable?: boolean;
  /** With odds: the proposed athletes; the player may also put « autre athlète » on one place. */
  proposed?: string[];
  /** How its discipline measures a mark: a predicted mark must be plausible (#702). */
  discipline?: { unit: MarkUnit; family: DisciplineFamily };
};

/**
 * Test double of the PredictionRepository port, with the rules of the database: locked after
 * `lockAt`, only athletes of the start list, one joker per player, only from a league of the
 * competition. All the events given belong to one competition.
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
      if (event.predictable === false) return "round_not_ready";

      const picks = [prediction.podium.first, prediction.podium.second, prediction.podium.third];
      const athletes = picks.filter((id) => id !== OTHER_ATHLETE);
      if (!athletes.every((id) => event.athleteIds.includes(id))) return "athlete_not_in_event";
      const proposed = event.proposed;
      if (proposed ? !athletes.every((id) => proposed.includes(id)) : athletes.length < 3) {
        return "athlete_not_proposed";
      }
      const marks = Object.values(prediction.marks ?? {}).filter((m) => m !== null);
      const range = event.discipline && markRange(event.discipline.unit, event.discipline.family);
      if (range && !marks.every((m) => isInRange(m, range))) return "mark_out_of_range";
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
