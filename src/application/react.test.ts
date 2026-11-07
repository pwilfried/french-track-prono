import { describe, expect, it } from "vitest";

import type { Reaction } from "@/domain/reveal";

import { UseCaseError } from "./errors";
import { react, type ReactionRepository } from "./react";

// Seen by "me": Anna's locked and open predictions, and my own locked one.
const world = () => {
  const allowed = new Set(["annaLocked"]);
  const mine = new Map<string, Reaction>();
  const reactions: ReactionRepository & { reactionOf(id: string): Reaction | null } = {
    set: async (id, reaction) => (allowed.has(id) ? (mine.set(id, reaction), "done") : "refused"),
    remove: async (id) => void mine.delete(id),
    reactionOf: (id) => mine.get(id) ?? null,
  };
  return reactions;
};

describe("react", () => {
  it("puts my emoji on someone else's revealed prediction, then replaces it", async () => {
    const reactions = world();
    const useCase = react({ reactions });

    await useCase.execute({ predictionId: "annaLocked", reaction: "🔥" });
    await useCase.execute({ predictionId: "annaLocked", reaction: "🎯" });

    expect(reactions.reactionOf("annaLocked")).toBe("🎯");
  });

  it("removes my reaction when I undo it", async () => {
    const reactions = world();
    const useCase = react({ reactions });
    await useCase.execute({ predictionId: "annaLocked", reaction: "🔥" });

    await useCase.execute({ predictionId: "annaLocked", reaction: null });

    expect(reactions.reactionOf("annaLocked")).toBeNull();
  });

  it("refuses an emoji outside the fixed list with INVALID_REACTION", async () => {
    await expect(
      react({ reactions: world() }).execute({ predictionId: "annaLocked", reaction: "💩" }),
    ).rejects.toEqual(new UseCaseError("INVALID_REACTION"));
  });

  it("refuses my own prediction and a prediction before the lock with REACTION_NOT_ALLOWED", async () => {
    const useCase = react({ reactions: world() });

    for (const predictionId of ["mineLocked", "annaOpen", "unknown"]) {
      await expect(useCase.execute({ predictionId, reaction: "🔥" })).rejects.toEqual(
        new UseCaseError("REACTION_NOT_ALLOWED"),
      );
    }
  });
});
