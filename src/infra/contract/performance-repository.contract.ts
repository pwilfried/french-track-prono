import { describe, expect, it } from "vitest";

import type { PerformanceRepository } from "@/application/enter-performances";
import type { Performance } from "@/domain/performance";

/** An event of its own, its start list (four athletes), an athlete off it, and two sessions. */
export type PerformanceWorld = {
  eventId: string;
  athleteIds: string[];
  outsiderId: string;
  /** Lines these athletes up in a Manager league for the event's competition. */
  lineUp: (athleteIds: string[]) => Promise<void>;
  admin: PerformanceRepository;
  player: PerformanceRepository;
};

const byAthlete = (lines: Performance[]) =>
  [...lines].sort((a, b) => (a.athleteId < b.athleteId ? -1 : 1));
const sorted = (ids: string[] | "not_admin") => (ids === "not_admin" ? ids : [...ids].sort());

/** Contract of the PerformanceRepository port, run against the in-memory fake AND Supabase. */
export function performanceRepositoryContract(
  name: string,
  world: () => Promise<PerformanceWorld>,
) {
  const sheet = (w: PerformanceWorld): Performance[] => [
    {
      athleteId: w.athleteIds[0]!,
      status: "ok",
      place: 1,
      mark: "10.62",
      records: ["pb", "sb", "nr", "ar", "wr"],
    },
    { athleteId: w.athleteIds[1]!, status: "ok", place: null, mark: "10.80", records: [] },
    { athleteId: w.athleteIds[2]!, status: "dnf", place: null, mark: null, records: [] },
  ];

  describe(`PerformanceRepository contract: ${name}`, () => {
    it("finds no performance before the admin enters them", async () => {
      const w = await world();

      expect(await w.player.find(w.eventId)).toEqual([]);
    });

    it("lets an admin save performances that everybody reads", async () => {
      const w = await world();

      expect(await w.admin.replace(w.eventId, sheet(w))).toBe("saved");

      expect(byAthlete(await w.player.find(w.eventId))).toEqual(byAthlete(sheet(w)));
    });

    it("replaces the whole previous entry", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, sheet(w));
      const corrected: Performance[] = [
        { athleteId: w.athleteIds[3]!, status: "dq", place: null, mark: null, records: [] },
      ];

      expect(await w.admin.replace(w.eventId, corrected)).toBe("saved");

      expect(await w.admin.find(w.eventId)).toEqual(corrected);
    });

    it("refuses a player who is not admin and keeps the performances", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, sheet(w));

      expect(await w.player.replace(w.eventId, [])).toBe("not_admin");

      expect(byAthlete(await w.player.find(w.eventId))).toEqual(byAthlete(sheet(w)));
    });

    it("refuses an athlete who is not on the start list and keeps the performances", async () => {
      const w = await world();
      await w.admin.replace(w.eventId, sheet(w));
      const wrong = [...sheet(w), { ...sheet(w)[1]!, athleteId: w.outsiderId }];

      expect(await w.admin.replace(w.eventId, wrong)).toBe("athlete_not_in_event");

      expect(byAthlete(await w.admin.find(w.eventId))).toEqual(byAthlete(sheet(w)));
    });

    it("tells only an admin which athletes of the start list are lined up", async () => {
      const w = await world();
      expect(await w.admin.linedUp(w.eventId)).toEqual([]);

      await w.lineUp([w.athleteIds[0]!, w.athleteIds[2]!]);

      expect(sorted(await w.admin.linedUp(w.eventId))).toEqual(
        [w.athleteIds[0]!, w.athleteIds[2]!].sort(),
      );
      expect(await w.player.linedUp(w.eventId)).toBe("not_admin");
    });
  });
}
