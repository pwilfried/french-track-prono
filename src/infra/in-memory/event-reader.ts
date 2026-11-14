import type { EventReader } from "@/application/list-events";
import { winnerOf, type EventDetail } from "@/domain/event";

/** Test double of the EventReader port. Data: events grouped by competition slug. */
export function createInMemoryEventReader(
  eventsByCompetition: Record<string, EventDetail[]>,
): EventReader {
  return {
    listByCompetition: async (competitionSlug) =>
      (eventsByCompetition[competitionSlug] ?? []).map((e) => ({
        ...e,
        winner: winnerOf(e.results),
      })),
    findBySlug: async (competitionSlug, eventSlug) =>
      (competitionSlug === null
        ? Object.values(eventsByCompetition).flat()
        : (eventsByCompetition[competitionSlug] ?? [])
      ).find((e) => e.slug === eventSlug) ?? null,
  };
}
