import { describe, expect, it } from "vitest";

import type { ResultEntry, ResultRepository } from "@/application/enter-results";

/** An event of its own (no other test touches it), its start list and an athlete not on it. */
export type ResultWorld = {
  eventId: string;
  athleteIds: string[];
  outsiderId: string;
  admin: ResultRepository;
  player: ResultRepository;
};

/** Contract of the ResultRepository port, run against the in-memory fake AND Supabase. */
export function resultRepositoryContract(name: string, world: () => Promise<ResultWorld>) {
  const podium = (w: ResultWorld): ResultEntry[] => [
    { athleteId: w.athleteIds[0]!, rank: 1, mark: "10.80" },
    { athleteId: w.athleteIds[1]!, rank: 2, mark: "10.85" },
    { athleteId: w.athleteIds[2]!, rank: 3, mark: null },
  ];

  describe(`ResultRepository contract: ${name}`, () => {
    it("finds no result before the admin enters one", async () => {
      const w = await world();

      expect(await w.player.find(w.eventId)).toEqual([]);
    });

    it("lets an admin save a result that everybody reads, best rank first", async () => {
      const w = await world();

      expect(await w.admin.replace(w.eventId, [...podium(w)].reverse())).toBe("saved");

      expect(await w.player.find(w.eventId)).toEqual(podium(w));
    });

    it("replaces the whole previous result", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, podium(w));
      const corrected: ResultEntry[] = [
        { athleteId: w.athleteIds[1]!, rank: 1, mark: null },
        { athleteId: w.athleteIds[0]!, rank: 2, mark: null },
        { athleteId: w.athleteIds[3]!, rank: 3, mark: null },
      ];

      expect(await w.admin.replace(w.eventId, corrected)).toBe("saved");

      expect(await w.admin.find(w.eventId)).toEqual(corrected);
    });

    it("refuses a player who is not admin and keeps the result", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, podium(w));

      expect(await w.player.replace(w.eventId, [])).toBe("not_admin");

      expect(await w.player.find(w.eventId)).toEqual(podium(w));
    });

    it("refuses an athlete who is not on the start list and keeps the result", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, podium(w));
      const wrong = podium(w);
      wrong[2] = { athleteId: w.outsiderId, rank: 3, mark: null };

      expect(await w.admin.replace(w.eventId, wrong)).toBe("athlete_not_in_event");

      expect(await w.admin.find(w.eventId)).toEqual(podium(w));
    });
  });
}
