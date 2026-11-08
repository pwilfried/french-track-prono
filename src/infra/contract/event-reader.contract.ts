import { describe, expect, it } from "vitest";

import type { EventReader } from "@/application/list-events";

/**
 * Contract of the EventReader port, run against the in-memory fake AND the real Supabase adapter.
 * `knownCompetition` is a competition slug that has at least one event in the given reader;
 * `combined` gives a combined event (decathlon...) known to the reader, with its disciplines.
 */
export function eventReaderContract(
  name: string,
  create: () => EventReader,
  knownCompetition: string,
  combined: () => { competitionSlug: string; eventSlug: string; subDisciplines: string[] },
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

    it("finds nothing for an unknown event", async () => {
      expect(await create().findBySlug(knownCompetition, "no-such-event")).toBeNull();
    });

    it("finds nothing for an unknown competition", async () => {
      const reader = create();
      const [known] = await reader.listByCompetition(knownCompetition);

      expect(await reader.findBySlug("no-such-competition", known!.slug)).toBeNull();
    });

    it("finds a known event with its start list and results", async () => {
      const reader = create();
      const [known] = await reader.listByCompetition(knownCompetition);

      const event = await reader.findBySlug(knownCompetition, known!.slug);

      expect(event?.id).toBe(known!.id);
      expect(event?.entries.length).toBeGreaterThan(0);
      for (const result of event?.results ?? []) {
        expect(result.rank).toBeGreaterThanOrEqual(1);
        expect(event?.entries.map((e) => e.athleteId)).toContain(result.athleteId);
      }
    });

    it("finds the disciplines of a combined event, in order, and none for a single event", async () => {
      const reader = create();
      const event = combined();
      const [single] = await reader.listByCompetition(knownCompetition);

      expect(
        (await reader.findBySlug(event.competitionSlug, event.eventSlug))?.subDisciplines,
      ).toEqual(event.subDisciplines);
      expect((await reader.findBySlug(knownCompetition, single!.slug))?.subDisciplines).toEqual([]);
    });
  });
}
