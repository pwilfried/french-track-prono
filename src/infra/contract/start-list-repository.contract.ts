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
  /** An athlete of the gender who runs the discipline. */
  candidateId: string;
  /** An athlete of the gender who does not run the discipline. */
  nonRunnerId: string;
  /** Enters these athletes in the competition of the event (its « engagés »). */
  enter: (athleteIds: string[]) => void;
  markInUse: (athleteId: string) => void;
  /** Makes the event a round leading to a new event, ranks its first three athletes 1 to 3. */
  makeRound: () => Promise<string>;
  admin: StartListRepository;
  player: StartListRepository;
};

const byId = (a: StartListEntry, b: StartListEntry) => a.athleteId.localeCompare(b.athleteId);

/** Contract of the StartListRepository port, run against the in-memory fake AND Supabase. */
export function startListRepositoryContract(name: string, world: () => Promise<StartListWorld>) {
  describe(`StartListRepository contract: ${name}`, () => {
    it("lists the athletes of a gender as candidates, with how they fit the discipline", async () => {
      const w = await world();

      const candidates = await w.admin.candidates(w.gender, w.discipline, w.eventId);

      expect(candidates.map((c) => c.athleteId)).toContain(w.candidateId);
      expect(new Set(candidates.map((c) => c.athleteId)).size).toBe(candidates.length);
      const runner = candidates.find((c) => c.athleteId === w.candidateId);
      expect(runner?.fit === "primary" || runner?.fit === "discipline").toBe(true);
      expect(
        (await w.admin.candidates(w.gender, "Discipline inconnue", w.eventId)).every(
          (c) => c.fit === "other",
        ),
      ).toBe(true);
    });

    it("keeps the candidates to the entered athletes when one of them runs the discipline", async () => {
      const w = await world();
      w.enter([w.nonRunnerId, w.candidateId]);

      const ids = (await w.admin.candidates(w.gender, w.discipline, w.eventId)).map(
        (c) => c.athleteId,
      );

      expect(ids.sort()).toEqual([w.candidateId, w.nonRunnerId].sort());
    });

    it("offers every runner of the discipline when no entered athlete runs it", async () => {
      const w = await world();
      w.enter([w.nonRunnerId]);

      const candidates = await w.admin.candidates(w.gender, w.discipline, w.eventId);

      const runner = candidates.find((c) => c.athleteId === w.candidateId);
      expect(runner).toBeDefined();
      expect(runner?.fit).not.toBe("other");
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

    it("lets an admin add an athlete, then put them on the start list, and refuses a player", async () => {
      const w = await world();
      const tag = crypto.randomUUID().slice(0, 8);
      const athlete = {
        name: `Inventée ${tag}`,
        countryCode: "FRA",
        gender: w.gender,
        slug: `inventee-${tag}`,
      };

      expect(await w.player.createAthlete(athlete)).toBe("not_admin");
      const created = await w.admin.createAthlete(athlete);

      expect(created).not.toBe("not_admin");
      const { athleteId } = created as { athleteId: string };
      expect(await w.admin.replace(w.eventId, [{ athleteId, seasonBest: null }])).toBe("saved");
      expect((await w.admin.find(w.eventId)).map((e) => e.athleteId)).toEqual([athleteId]);
    });

    it("qualifies the first of a round for the next one, and refuses a round leading nowhere", async () => {
      const w = await world();
      expect(await w.admin.promote(w.eventId, 2)).toBe("no_next_round");
      const next = await w.makeRound();

      expect(await w.player.promote(w.eventId, 2)).toBe("not_admin");
      expect(await w.admin.promote(w.eventId, 2)).toBe(2);

      expect((await w.admin.find(next)).map((e) => e.athleteId).sort()).toEqual(
        w.athleteIds.slice(0, 2).sort(),
      );
    });
  });
}
