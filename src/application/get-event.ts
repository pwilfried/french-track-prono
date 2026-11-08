import { UseCaseError } from "./errors";
import { compareResults, type EventDetail } from "@/domain/event";

import type { EventReader } from "./list-events";

/** A null competition finds the event in any competition (the back-office). */
export type GetEventInput = { competitionSlug: string | null; eventSlug: string };

export function getEvent(ports: { events: EventReader }) {
  return {
    async execute(input: GetEventInput): Promise<EventDetail> {
      const event = await ports.events.findBySlug(input.competitionSlug, input.eventSlug);
      if (!event) throw new UseCaseError("EVENT_NOT_FOUND");
      return { ...event, results: [...event.results].sort(compareResults) };
    },
  };
}
