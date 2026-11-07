import type { ResultEntry, ResultRepository } from "@/application/enter-results";

/** What the fake needs to know about the events: their start lists (athlete ids). */
export type ResultEventFixture = { id: string; athleteIds: string[] };

/**
 * Test double of the ResultRepository port, with the rules of the database: only an admin writes,
 * only athletes of the start list. One store shared by every session, one session per player.
 */
export function createInMemoryResultStore(events: ResultEventFixture[]) {
  const stored = new Map<string, ResultEntry[]>();
  return {
    session(options: { isAdmin: boolean }): ResultRepository {
      return {
        async find(eventId) {
          return [...(stored.get(eventId) ?? [])].sort((a, b) => a.rank - b.rank);
        },
        async replace(eventId, lines) {
          if (!options.isAdmin) return "not_admin";
          const event = events.find((e) => e.id === eventId);
          if (!event) throw new Error(`unknown event ${eventId}`);
          if (!lines.every((l) => event.athleteIds.includes(l.athleteId))) {
            return "athlete_not_in_event";
          }
          stored.set(
            eventId,
            lines.map((l) => ({ ...l })),
          );
          return "saved";
        },
      };
    },
  };
}
