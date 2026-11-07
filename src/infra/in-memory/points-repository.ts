import type { EventToScore, PointsRepository, ScoreLine } from "@/application/compute-event-points";

/**
 * Test double of the PointsRepository port: events to score are given as fixtures; only an admin
 * session writes. One store shared by every session, one session per player.
 */
export function createInMemoryPointsStore(events: Record<string, EventToScore>) {
  const scores = new Map<string, ScoreLine[]>();
  return {
    session(options: { isAdmin: boolean }): PointsRepository {
      return {
        async loadEvent(eventId) {
          return events[eventId] ?? null;
        },
        async findEventScores(eventId) {
          return scores.get(eventId) ?? [];
        },
        async replaceEventScores(eventId, lines) {
          if (!options.isAdmin) return "not_admin";
          scores.set(
            eventId,
            lines.map((l) => ({ ...l })),
          );
          return "saved";
        },
      };
    },
  };
}
