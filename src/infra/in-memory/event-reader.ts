import type { EventReader } from "@/application/list-events";
import type { EventSummary } from "@/domain/event";

/** Test double of the EventReader port. Data: events grouped by competition slug. */
export function createInMemoryEventReader(
  eventsByCompetition: Record<string, EventSummary[]>,
): EventReader {
  return {
    listByCompetition: async (competitionSlug) => eventsByCompetition[competitionSlug] ?? [],
  };
}
