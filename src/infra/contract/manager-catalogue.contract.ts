import { describe, expect, it } from "vitest";

import type { ManagerCatalogueRepository } from "@/application/manager-catalogue";

/** A league, a participant, an outsider, and one athlete priced 17 in the catalogue. */
export type ManagerCatalogueWorld = {
  leagueId: string;
  participant: ManagerCatalogueRepository;
  outsider: ManagerCatalogueRepository;
  athleteId: string;
  restore: () => Promise<void>;
};

/** Contract of the ManagerCatalogueRepository port, run against the in-memory fake AND Supabase. */
export function managerCatalogueContract(
  name: string,
  world: () => Promise<ManagerCatalogueWorld>,
) {
  describe(`ManagerCatalogueRepository contract: ${name}`, () => {
    it("shows a participant the priced athletes, free in the league; nothing to an outsider", async () => {
      const w = await world();
      try {
        const athletes = await w.participant.list(w.leagueId);
        if (athletes === "not_member") throw new Error("the participant reads the catalogue");
        expect(athletes.find((a) => a.athleteId === w.athleteId)).toMatchObject({
          price: 17,
          available: true,
        });
        expect(athletes.every((a) => a.price > 0 && a.family !== "relay")).toBe(true);
        expect(await w.outsider.list(w.leagueId)).toBe("not_member");
      } finally {
        await w.restore();
      }
    });
  });
}
