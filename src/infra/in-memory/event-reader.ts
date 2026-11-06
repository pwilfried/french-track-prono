import type { EventReader } from "@/application/list-events";
import type { EventDetail } from "@/domain/event";

/** Test double of the EventReader port. Data: events grouped by competition slug. */
export function createInMemoryEventReader(
  eventsByCompetition: Record<string, EventDetail[]>,
): EventReader {
  return {
    listByCompetition: async (competitionSlug) => eventsByCompetition[competitionSlug] ?? [],
    findBySlug: async (competitionSlug, eventSlug) =>
      eventsByCompetition[competitionSlug]?.find((e) => e.slug === eventSlug) ?? null,
  };
}
