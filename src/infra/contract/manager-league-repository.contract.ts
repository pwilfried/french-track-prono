import { describe, expect, it } from "vitest";

import type { ManagerLeagueRepository } from "@/application/manager-leagues";

/** Two players, and a way to change the budget of the rules in force (then put it back). */
export type ManagerLeagueWorld = {
  creator: ManagerLeagueRepository;
  creatorId: string;
  other: ManagerLeagueRepository;
  setBudget: (budget: number) => Promise<void>;
  restore: () => Promise<void>;
};

/** Contract of the ManagerLeagueRepository port, run against the in-memory fake AND Supabase. */
export function managerLeagueRepositoryContract(
  name: string,
  world: () => Promise<ManagerLeagueWorld>,
) {
  describe(`ManagerLeagueRepository contract: ${name}`, () => {
    it("creates a league its creator is in, with the rules in force kept at creation", async () => {
      const w = await world();
      try {
        await w.setBudget(120);
        const created = await w.creator.create("Les Perchistes", true);
        if (created === "banned") throw new Error("the name is not banned");
        await w.setBudget(300);

        const league = await w.creator.find(created.id);
        expect(league).toMatchObject({
          name: "Les Perchistes",
          isPublic: true,
          ownerId: w.creatorId,
          memberCount: 1,
          participants: [{ userId: w.creatorId }],
        });
        expect(league?.rules.budget).toBe(120);
        expect((await w.creator.listMine()).map((l) => l.id)).toContain(created.id);
        // Another player does not see it (joining is #420).
        expect(await w.other.find(created.id)).toBeNull();
        expect((await w.other.listMine()).map((l) => l.id)).not.toContain(created.id);
      } finally {
        await w.restore();
      }
    });

    it("refuses a banned name", async () => {
      const w = await world();
      expect(await w.creator.create("Ligue FFA", false)).toBe("banned");
    });
  });
}
