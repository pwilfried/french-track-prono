import { compareEvents, type EventDetail, type EventSummary } from "@/domain/event";

/** Port: where events are read from (Supabase in production, memory in tests). */
export interface EventReader {
  /** Events of a competition, in any order. An unknown competition gives an empty list. */
  listByCompetition(competitionSlug: string): Promise<EventSummary[]>;
  /** One event with its start list and results, or null when the competition or event is unknown. */
  findBySlug(competitionSlug: string, eventSlug: string): Promise<EventDetail | null>;
}

export type ListEventsInput = { competitionSlug: string };

export function listEvents(ports: { events: EventReader }) {
  return {
    async execute(input: ListEventsInput): Promise<EventSummary[]> {
      const events = await ports.events.listByCompetition(input.competitionSlug);
      return [...events].sort(compareEvents);
    },
  };
}
