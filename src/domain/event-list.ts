import { TIME_ZONE } from "./competition";
import type { EventSummary } from "./event";

export type EventDay = {
  /** Calendar day in Paris time, YYYY-MM-DD. */
  day: string;
  events: EventSummary[];
};

// The en-CA locale formats a date as YYYY-MM-DD.
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const parisDay = (date: Date | string) => dayFormat.format(new Date(date));

/** Groups events by calendar day in Paris time. Keeps the order of the input. */
export function groupEventsByDay(events: EventSummary[]): EventDay[] {
  const days: EventDay[] = [];
  for (const event of events) {
    const day = parisDay(event.startsAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}

/** The events still open to predictions at `now`, the soonest lock first, at most `count`. */
export function openEvents(events: EventSummary[], now: Date, count: number): EventSummary[] {
  return events
    .filter((e) => Date.parse(e.lockAt) > now.getTime())
    .sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt) || a.slug.localeCompare(b.slug))
    .slice(0, count);
}

/** The filters of the events tab (#546). */
export type EventFilter = "todo" | "posed" | "done" | "all";

/** Finished, else predicted, else still open: an event locked and not predicted is in « all » only. */
function filterOf(event: EventSummary, predicted: ReadonlySet<string>, now: Date) {
  if (event.status === "finished") return "done";
  if (predicted.has(event.id)) return "posed";
  return Date.parse(event.lockAt) > now.getTime() ? "todo" : null;
}

export function filterEvents(
  events: EventSummary[],
  predicted: ReadonlySet<string>,
  now: Date,
  filter: EventFilter,
): EventSummary[] {
  return filter === "all" ? events : events.filter((e) => filterOf(e, predicted, now) === filter);
}

export function filterCounts(
  events: EventSummary[],
  predicted: ReadonlySet<string>,
  now: Date,
): Record<EventFilter, number> {
  const counts = { todo: 0, posed: 0, done: 0, all: events.length };
  for (const event of events) {
    const filter = filterOf(event, predicted, now);
    if (filter) counts[filter] += 1;
  }
  return counts;
}

/** My podiums posed in the competition and the points won so far (#546, #659). */
export type EventsProgress = { posed: number; total: number; points: number };

/** My progress in the competition, from my marks by event id. */
export function eventsProgress(
  events: EventSummary[],
  mine: ReadonlyMap<string, { points?: number | null }>,
): EventsProgress {
  return {
    posed: events.filter((e) => mine.has(e.id)).length,
    total: events.length,
    points: [...mine.values()].reduce((sum, m) => sum + (m.points ?? 0), 0),
  };
}
