import type { RevealedPrediction, RevealRepository } from "@/application/reveal";

/** Test double of the RevealRepository port: events given with their lock state and predictions. */
export function createInMemoryRevealRepository(
  events: Record<string, { locked: boolean; predictions: RevealedPrediction[] }>,
): RevealRepository {
  return {
    async listForEvent(eventId) {
      const event = events[eventId];
      if (!event) return { locked: false, predictions: [] };
      return {
        locked: event.locked,
        predictions: event.locked ? event.predictions.map((p) => ({ ...p })) : [],
      };
    },
  };
}
