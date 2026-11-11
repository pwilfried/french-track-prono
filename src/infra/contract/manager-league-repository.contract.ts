import { describe, expect, it } from "vitest";

import type { ManagerLeagueRepository } from "@/application/manager-leagues";

/** Two players, and a way to change the budget of the rules in force (then put it back). */
export type ManagerLeagueWorld = {
  creator: ManagerLeagueRepository;
  creatorId: string;
  other: ManagerLeagueRepository;
  setBudget: (budget: number) => Promise<void>;
  /** What the mercato (v0.13) will do: nobody joins any more. */
  openMercato: (leagueId: string) => Promise<void>;
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

    it("lets a player join a private league with its code, not in one tap", async () => {
      const w = await world();
      const created = await w.creator.create("Les Haies Basses", false);
      if (created === "banned") throw new Error("the name is not banned");
      const code = (await w.creator.find(created.id))!.inviteCode;

      expect(await w.other.joinPublic(created.id)).toEqual({ outcome: "unknown" });
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(created.id);
      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect(await w.other.join(code)).toEqual({ outcome: "joined", leagueId: created.id });
      expect((await w.creator.find(created.id))?.memberCount).toBe(2);
      expect(await w.other.join("ZZZZZZ")).toEqual({ outcome: "unknown" });
    });

    it("lists a public league with places, joined in one tap until the mercato opens", async () => {
      const w = await world();
      const created = await w.creator.create("Les Relayeurs", true);
      if (created === "banned") throw new Error("the name is not banned");

      expect(await w.other.listPublic()).toContainEqual({
        id: created.id,
        name: "Les Relayeurs",
        memberCount: 1,
      });
      expect(await w.other.joinPublic(created.id)).toEqual({
        outcome: "joined",
        leagueId: created.id,
      });
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(created.id);

      const late = await w.creator.create("Les Retardataires", true);
      if (late === "banned") throw new Error("the name is not banned");
      await w.openMercato(late.id);
      expect((await w.other.listPublic()).map((l) => l.id)).not.toContain(late.id);
      expect(await w.other.joinPublic(late.id)).toEqual({ outcome: "mercato_open" });
    });

    it("refuses a banned name", async () => {
      const w = await world();
      expect(await w.creator.create("Ligue FFA", false)).toBe("banned");
    });
  });
}
