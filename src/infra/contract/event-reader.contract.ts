import { describe, expect, it } from "vitest";

import type { EventReader } from "@/application/list-events";

/**
 * Contract of the EventReader port, run against the in-memory fake AND the real Supabase adapter.
 * `knownCompetition` is a competition slug that has at least one event in the given reader.
 */
export function eventReaderContract(
  name: string,
  create: () => EventReader,
  knownCompetition: string,
) {
  describe(`EventReader contract: ${name}`, () => {
    it("returns an empty list for an unknown competition", async () => {
      const events = await create().listByCompetition("no-such-competition");

      expect(events).toEqual([]);
    });

    it("returns at least one event for a known competition", async () => {
      const events = await create().listByCompetition(knownCompetition);

      expect(events.length).toBeGreaterThan(0);
    });

    it("returns complete event summaries with valid values", async () => {
      const events = await create().listByCompetition(knownCompetition);

      for (const event of events) {
        expect(event.id).toBeTruthy();
        expect(event.slug).toBeTruthy();
        expect(event.discipline).toBeTruthy();
        expect(["F", "M", "X"]).toContain(event.gender);
        expect(["upcoming", "live", "finished"]).toContain(event.status);
        expect(typeof event.isFeatured).toBe("boolean");
        expect(new Date(event.startsAt).toISOString()).toBe(event.startsAt);
        expect(new Date(event.lockAt).toISOString()).toBe(event.lockAt);
        expect(Date.parse(event.lockAt)).toBeLessThanOrEqual(Date.parse(event.startsAt));
      }
    });

    it("returns each event once", async () => {
      const events = await create().listByCompetition(knownCompetition);

      expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    });
  });
}
