import { describe, expect, it } from "vitest";

import type { AthleteReader } from "@/application/get-athlete";

/**
 * Contract of the AthleteReader port, run against the in-memory fake AND Supabase. `known` is an
 * athlete with a main discipline and a PB in the given reader.
 */
export function athleteReaderContract(name: string, create: () => AthleteReader, known: string) {
  describe(`AthleteReader contract: ${name}`, () => {
    it("finds nothing for an unknown athlete", async () => {
      expect(await create().findBySlug("no-such-athlete")).toBeNull();
    });

    it("gives the names and countries of the athletes asked, none for an unknown id (#800)", async () => {
      const reader = create();
      const athlete = (await reader.findBySlug(known))!;

      expect(
        await reader.namesOf([athlete.athleteId, "00000000-0000-0000-0000-000000000000"]),
      ).toEqual([
        { athleteId: athlete.athleteId, name: athlete.name, countryCode: athlete.countryCode },
      ]);
      expect(await reader.namesOf([])).toEqual([]);
    });

    it("finds a known athlete with their main discipline and a PB", async () => {
      const athlete = await create().findBySlug(known);

      expect(athlete?.slug).toBe(known);
      expect(athlete?.countryCode).toMatch(/^[A-Z]{3}$/);
      expect(athlete?.disciplines[0]).toBeTruthy();
      const pb = athlete?.records.find((r) => r.kind === "pr");
      expect(pb).toBeDefined();
      expect(typeof pb?.verified).toBe("boolean");
      expect(athlete?.managerPrice === null || athlete!.managerPrice > 0).toBe(true);
    });
  });
}
