import { describe, expect, it } from "vitest";

import type { StartListEntry, StartListRepository } from "@/application/set-start-list";
import type { EventGender } from "@/domain/event";

/**
 * An event of its own with four athletes on its start list, an athlete on none, an athlete of a
 * gender, and a way to make an athlete of the list "in use" (predicted or in the result).
 */
export type StartListWorld = {
  eventId: string;
  athleteIds: string[];
  outsiderId: string;
  gender: EventGender;
  /** The discipline of the event; the athletes of its start list run it. */
  discipline: string;
  candidateId: string;
  markInUse: (athleteId: string) => void;
  admin: StartListRepository;
  player: StartListRepository;
};

const byId = (a: StartListEntry, b: StartListEntry) => a.athleteId.localeCompare(b.athleteId);

/** Contract of the StartListRepository port, run against the in-memory fake AND Supabase. */
export function startListRepositoryContract(name: string, world: () => Promise<StartListWorld>) {
  describe(`StartListRepository contract: ${name}`, () => {
    it("lists the athletes of a gender as candidates, with how they fit the discipline", async () => {
      const w = await world();

      const candidates = await w.admin.candidates(w.gender, w.discipline);

      expect(candidates.map((c) => c.athleteId)).toContain(w.candidateId);
      expect(new Set(candidates.map((c) => c.athleteId)).size).toBe(candidates.length);
      const runner = candidates.find((c) => c.athleteId === w.athleteIds[0]);
      expect(runner?.fit === "primary" || runner?.fit === "discipline").toBe(true);
      expect(
        (await w.admin.candidates(w.gender, "Discipline inconnue")).every((c) => c.fit === "other"),
      ).toBe(true);
    });

    it("lets an admin replace a start list, removing, adding and updating season bests", async () => {
      const w = await world();
      const next: StartListEntry[] = [
        { athleteId: w.athleteIds[0]!, seasonBest: "10.72" },
        { athleteId: w.athleteIds[1]!, seasonBest: null },
        { athleteId: w.outsiderId, seasonBest: "11.01" },
      ];

      expect(await w.admin.replace(w.eventId, next)).toBe("saved");

      expect((await w.player.find(w.eventId)).sort(byId)).toEqual([...next].sort(byId));
    });

    it("refuses a player who is not admin and keeps the start list", async () => {
      const w = await world();
      const before = (await w.admin.find(w.eventId)).sort(byId);

      expect(
        await w.player.replace(w.eventId, [{ athleteId: w.outsiderId, seasonBest: null }]),
      ).toBe("not_admin");

      expect((await w.admin.find(w.eventId)).sort(byId)).toEqual(before);
    });

    it("refuses to remove an athlete in use and keeps the start list", async () => {
      const w = await world();
      w.markInUse(w.athleteIds[0]!);
      const before = (await w.admin.find(w.eventId)).sort(byId);

      expect(
        await w.admin.replace(
          w.eventId,
          w.athleteIds.slice(1).map((athleteId) => ({ athleteId, seasonBest: null })),
        ),
      ).toBe("athlete_in_use");

      expect((await w.admin.find(w.eventId)).sort(byId)).toEqual(before);
    });
  });
}
