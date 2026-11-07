import type { ReactionRepository } from "@/application/react";
import type { Reaction } from "@/domain/reveal";

/** Test double of the ReactionRepository port, acting as `userId`. */
export function createInMemoryReactionRepository(
  userId: string,
  predictions: Record<string, { ownerId: string; locked: boolean }>,
): ReactionRepository & { reactionOf(predictionId: string): Reaction | null } {
  const mine = new Map<string, Reaction>();
  return {
    async set(predictionId, reaction) {
      const prediction = predictions[predictionId];
      if (!prediction || !prediction.locked || prediction.ownerId === userId) return "refused";
      mine.set(predictionId, reaction);
      return "done";
    },
    async remove(predictionId) {
      mine.delete(predictionId);
    },
    reactionOf: (predictionId) => mine.get(predictionId) ?? null,
  };
}
