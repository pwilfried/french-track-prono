import { describe, expect, it } from "vitest";

import type { RevealRepository } from "@/application/reveal";

/**
 * Two events of their own: `openEventId` still open and `lockedEventId` locked, each predicted by
 * Anna (a b c, joker) and Bob (b a c). `bob` reads as Bob; on the locked event, Bob reacted 🔥 to
 * Anna's prediction.
 */
export type RevealWorld = {
  annaId: string;
  bobId: string;
  athleteIds: string[];
  openEventId: string;
  lockedEventId: string;
  bob: RevealRepository;
};

/** Contract of the RevealRepository port, run against the in-memory fake AND Supabase. */
export function revealRepositoryContract(name: string, world: () => Promise<RevealWorld>) {
  describe(`RevealRepository contract: ${name}`, () => {
    it("says an open event is not locked and reveals nothing of the others", async () => {
      const w = await world();

      const open = await w.bob.listForEvent(w.openEventId);

      expect(open.locked).toBe(false);
      expect(open.predictions.filter((p) => p.userId !== w.bobId)).toEqual([]);
    });

    it("reveals every prediction of a locked event, with pseudo, podium, joker and reactions", async () => {
      const w = await world();
      const [a, b, c] = w.athleteIds as [string, string, string];

      const locked = await w.bob.listForEvent(w.lockedEventId);

      expect(locked.locked).toBe(true);
      const anna = locked.predictions.find((p) => p.userId === w.annaId)!;
      expect(anna.podium).toEqual({ first: a, second: b, third: c });
      expect(anna.useJoker).toBe(true);
      expect(anna.pseudo).not.toBe("");
      expect(anna.reactions).toEqual([{ userId: w.bobId, reaction: "🔥" }]);
      const bob = locked.predictions.find((p) => p.userId === w.bobId)!;
      expect(bob.podium).toEqual({ first: b, second: a, third: c });
      expect(bob.reactions).toEqual([]);
    });
  });
}
