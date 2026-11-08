import { describe, expect, it } from "vitest";

import type { AthleteReader } from "@/application/get-athlete";

/**
 * Contract of the AthleteReader port, run against the in-memory fake AND Supabase. `known` is an
 * athlete with at least one result and one PR in the given reader.
 */
export function athleteReaderContract(name: string, create: () => AthleteReader, known: string) {
  describe(`AthleteReader contract: ${name}`, () => {
    it("finds nothing for an unknown athlete", async () => {
      expect(await create().findBySlug("no-such-athlete", 5)).toBeNull();
    });

    it("finds a known athlete with a PR and races, newest first, at most the number asked", async () => {
      const athlete = await create().findBySlug(known, 1);

      expect(athlete?.slug).toBe(known);
      expect(athlete?.countryCode).toMatch(/^[A-Z]{3}$/);
      expect(athlete?.records.some((r) => r.kind === "pr")).toBe(true);
      expect(athlete?.races).toHaveLength(1);
      const all = (await create().findBySlug(known, 50))!.races;
      expect(all.map((r) => r.startsAt)).toEqual([...all.map((r) => r.startsAt)].sort().reverse());
      expect(athlete?.races[0]).toEqual(all[0]);
    });
  });
}
