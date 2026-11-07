import { describe, expect, it } from "vitest";

import type { ReactionRepository } from "@/application/react";
import type { Reaction } from "@/domain/reveal";

/**
 * Seen by Bob: Anna's prediction on a locked event (`annaLocked`) and on an open one
 * (`annaOpen`), and Bob's own prediction on the locked event (`bobLocked`). `reactionOf` reads
 * Bob's reaction back from the store itself.
 */
export type ReactionWorld = {
  bob: ReactionRepository;
  annaLocked: string;
  annaOpen: string;
  bobLocked: string;
  reactionOf(predictionId: string): Promise<Reaction | null>;
};

/** Contract of the ReactionRepository port, run against the in-memory fake AND Supabase. */
export function reactionRepositoryContract(name: string, world: () => Promise<ReactionWorld>) {
  describe(`ReactionRepository contract: ${name}`, () => {
    it("sets, replaces and removes my reaction on a locked prediction of someone else", async () => {
      const w = await world();

      expect(await w.bob.set(w.annaLocked, "🔥")).toBe("done");
      expect(await w.reactionOf(w.annaLocked)).toBe("🔥");
      expect(await w.bob.set(w.annaLocked, "👏")).toBe("done");
      expect(await w.reactionOf(w.annaLocked)).toBe("👏");
      await w.bob.remove(w.annaLocked);
      expect(await w.reactionOf(w.annaLocked)).toBeNull();
    });

    it("refuses my own prediction, an open one and an unknown one", async () => {
      const w = await world();

      expect(await w.bob.set(w.bobLocked, "🔥")).toBe("refused");
      expect(await w.bob.set(w.annaOpen, "🔥")).toBe("refused");
      expect(await w.bob.set(crypto.randomUUID(), "🔥")).toBe("refused");
    });
  });
}
