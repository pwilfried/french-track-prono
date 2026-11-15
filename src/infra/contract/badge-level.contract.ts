import { describe, expect, it } from "vitest";

import type { BadgeLevelRepository } from "@/application/get-my-badges";
import { badgeMoments } from "@/domain/manager-moments";

export type BadgeLevelWorld = {
  userId: string;
  levels: BadgeLevelRepository;
  /** Another player's view, to check that each one raises only their own levels. */
  other: { userId: string; levels: BadgeLevelRepository };
  /** How many leagues the player plays (one prediction league): a moment is told in each. */
  leagueCount: number;
};

/** Contract of the BadgeLevelRepository port (#821). */
export function badgeLevelContract(name: string, world: () => Promise<BadgeLevelWorld>) {
  describe(`BadgeLevelRepository contract: ${name}`, () => {
    it("starts with no level", async () => {
      const w = await world();
      expect(await w.levels.levels(w.userId)).toEqual({});
    });

    it("stores the levels raised", async () => {
      const w = await world();
      await w.levels.raise(w.userId, [
        { badge: "chasseur", level: "bronze" },
        { badge: "foudre", level: "silver" },
      ]);
      expect(await w.levels.levels(w.userId)).toEqual({ chasseur: "bronze", foudre: "silver" });
    });

    it("never lowers a level", async () => {
      const w = await world();
      await w.levels.raise(w.userId, [{ badge: "nostradamus", level: "gold" }]);
      await w.levels.raise(w.userId, [{ badge: "nostradamus", level: "bronze" }]);
      expect(await w.levels.levels(w.userId)).toEqual({ nostradamus: "gold" });
    });

    it("lets another player read the levels, not raise them", async () => {
      const w = await world();
      await w.levels.raise(w.userId, [{ badge: "flair", level: "bronze" }]);
      await w.other.levels.raise(w.userId, [{ badge: "flair", level: "gold" }]).catch(() => {});
      expect(await w.other.levels.levels(w.userId)).toEqual({ flair: "bronze" });
    });

    it("tells a level held once in each league of the player, never a level not held", async () => {
      const w = await world();
      await w.levels.raise(w.userId, [{ badge: "foudre", level: "silver" }]);
      const silver = badgeMoments(w.userId, [{ badge: "foudre", level: "silver" }]);
      expect(await w.levels.publishMoments(silver)).toBe(w.leagueCount);
      expect(await w.levels.publishMoments(silver)).toBe(0);
      const gold = badgeMoments(w.userId, [{ badge: "foudre", level: "gold" }]);
      expect(await w.levels.publishMoments(gold)).toBe(0);
      // Someone else's level, under their key, is not told by this player.
      expect(await w.other.levels.publishMoments(silver)).toBe(0);
    });
  });
}
