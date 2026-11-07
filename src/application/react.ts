import { isReaction } from "@/domain/reveal";
import type { Reaction } from "@/domain/reveal";

import { UseCaseError } from "./errors";

/** Port: the signed-in player's reaction to a prediction (at most one per prediction). */
export interface ReactionRepository {
  /** Sets or replaces my reaction; `refused` when the prediction is mine, unknown or not locked. */
  set(predictionId: string, reaction: Reaction): Promise<"done" | "refused">;
  /** Removes my reaction, if any. */
  remove(predictionId: string): Promise<void>;
}

/** React with one of the fixed emojis to someone else's revealed prediction, or `null` to undo. */
export function react(ports: { reactions: ReactionRepository }) {
  return {
    async execute(input: { predictionId: string; reaction: string | null }): Promise<void> {
      if (input.reaction === null) return ports.reactions.remove(input.predictionId);
      if (!isReaction(input.reaction)) throw new UseCaseError("INVALID_REACTION");
      const outcome = await ports.reactions.set(input.predictionId, input.reaction);
      if (outcome === "refused") throw new UseCaseError("REACTION_NOT_ALLOWED");
    },
  };
}
