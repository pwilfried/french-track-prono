import { describe, expect, it } from "vitest";

import type { OddsRepository } from "@/application/set-event-odds";

/** An open event with 6 athletes on its start list (one with a PR), a locked one, two sessions. */
export type OddsWorld = {
  openEventId: string;
  lockedEventId: string;
  startList: string[];
  /** An athlete of the start list with a PR in the event's discipline, and that PR. */
  withPr: { athleteId: string; pr: string };
  admin: OddsRepository;
  player: OddsRepository;
};

/** Contract of the OddsRepository port, run against the in-memory fake AND Supabase. */
export function oddsRepositoryContract(name: string, world: () => Promise<OddsWorld>) {
  describe(`OddsRepository contract: ${name}`, () => {
    const oddsFor = (ids: string[]) => ({
      proposed: ids.map((athleteId, i) => ({ athleteId, odds: 1.5 + i })),
      other: 8,
    });

    it("finds no odds before they are set, and the athletes' PR", async () => {
      const w = await world();

      expect(await w.admin.find(w.openEventId)).toBeNull();
      expect(await w.admin.marks(w.openEventId)).toContainEqual(
        expect.objectContaining({ athleteId: w.withPr.athleteId, pr: w.withPr.pr }),
      );
    });

    it("lets an admin set odds, favourite first, and replace them", async () => {
      const w = await world();

      expect(await w.admin.save(w.openEventId, oddsFor(w.startList.slice(0, 6)))).toBe("saved");
      expect(await w.admin.save(w.openEventId, oddsFor(w.startList.slice(0, 5)))).toBe("saved");

      expect(await w.player.find(w.openEventId)).toEqual(oddsFor(w.startList.slice(0, 5)));
    });

    it("refuses a player, a locked event and an incomplete set", async () => {
      const w = await world();

      expect(await w.player.save(w.openEventId, oddsFor(w.startList.slice(0, 5)))).toBe(
        "not_admin",
      );
      expect(await w.admin.save(w.lockedEventId, oddsFor(w.startList.slice(0, 5)))).toBe("locked");
      expect(await w.admin.save(w.openEventId, oddsFor(w.startList.slice(0, 4)))).toBe("invalid");
      expect(await w.admin.find(w.openEventId)).toBeNull();
    });
  });
}
