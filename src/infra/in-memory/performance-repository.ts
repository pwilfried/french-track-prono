import type { PerformanceRepository } from "@/application/enter-performances";
import type { Performance } from "@/domain/performance";

/** What the fake needs to know about the events: their start lists (athlete ids). */
export type PerformanceEventFixture = { id: string; athleteIds: string[] };

/**
 * Test double of the PerformanceRepository port, with the rules of the database: everybody reads
 * the performances, only an admin writes them (athletes of the start list only) and reads who is
 * lined up. One store shared by every session.
 */
export function createInMemoryPerformanceStore(events: PerformanceEventFixture[]) {
  const stored = new Map<string, Performance[]>();
  const linedUp = new Map<string, string[]>();
  const copy = (line: Performance): Performance => ({ ...line, records: [...line.records] });
  return {
    /** Lines athletes of an event up in a Manager league (only those of its start list count). */
    lineUp(eventId: string, athleteIds: string[]) {
      linedUp.set(eventId, athleteIds);
    },
    session(options: { isAdmin: boolean }): PerformanceRepository {
      return {
        async find(eventId) {
          return (stored.get(eventId) ?? []).map(copy);
        },
        async linedUp(eventId) {
          if (!options.isAdmin) return "not_admin";
          const event = events.find((e) => e.id === eventId);
          return (linedUp.get(eventId) ?? []).filter((id) => event?.athleteIds.includes(id));
        },
        async replace(eventId, lines) {
          if (!options.isAdmin) return "not_admin";
          const event = events.find((e) => e.id === eventId);
          if (!event) throw new Error(`unknown event ${eventId}`);
          if (!lines.every((l) => event.athleteIds.includes(l.athleteId))) {
            return "athlete_not_in_event";
          }
          stored.set(eventId, lines.map(copy));
          return "saved";
        },
      };
    },
  };
}
