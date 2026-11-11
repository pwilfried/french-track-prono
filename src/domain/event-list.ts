import { TIME_ZONE } from "./competition";
import type { EventGender, EventSummary } from "./event";

export type EventDay = {
  /** Calendar day in Paris time, YYYY-MM-DD. */
  day: string;
  events: EventSummary[];
};

/** Groups events by calendar day in Paris time. Keeps the order of the input. */
export function groupEventsByDay(events: EventSummary[]): EventDay[] {
  // The en-CA locale formats a date as YYYY-MM-DD.
  const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
  const days: EventDay[] = [];
  for (const event of events) {
    const day = dayFormat.format(new Date(event.startsAt));
    const last = days[days.length - 1];
    if (last && last.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}

export function filterByGender(events: EventSummary[], gender: EventGender | null): EventSummary[] {
  return gender ? events.filter((event) => event.gender === gender) : events;
}

/** The events still open to predictions at `now`, the soonest lock first, at most `count`. */
export function openEvents(events: EventSummary[], now: Date, count: number): EventSummary[] {
  return events
    .filter((e) => Date.parse(e.lockAt) > now.getTime())
    .sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt) || a.slug.localeCompare(b.slug))
    .slice(0, count);
}

/**
 * The events still to run (upcoming or live), in their order, and the finished ones from the latest
 * to the earliest: the list shows what to predict first, then what already ran (#488).
 */
export function splitFinished(events: EventSummary[]): {
  coming: EventSummary[];
  done: EventSummary[];
} {
  return {
    coming: events.filter((e) => e.status !== "finished"),
    done: events
      .filter((e) => e.status === "finished")
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)),
  };
}
