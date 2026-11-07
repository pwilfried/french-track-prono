import type { EventToScore, PointsRepository, ScoreLine } from "@/application/compute-event-points";

/**
 * Test double of the PointsRepository port: events to score are given as fixtures; only an admin
 * session writes. One store shared by every session, one session per player.
 */
export function createInMemoryPointsStore(
  events: Record<string, EventToScore>,
  /** All the events belong to this competition. */
  competitionSlug = "ultimate-championship-2026",
) {
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
        async listMine(userId, slug) {
          if (slug !== competitionSlug) return [];
          return [...scores.entries()].flatMap(([eventId, lines]) =>
            lines.filter((l) => l.userId === userId).map((l) => ({ ...l, eventId })),
          );
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
