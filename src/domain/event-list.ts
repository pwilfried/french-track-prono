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
/** Whole days from one YYYY-MM-DD day to another. */
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

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

export type EventSection =
  | { kind: "tonight" | "tomorrow" | "day"; day: string; events: EventSummary[] }
  | { kind: "done"; day: null; events: EventSummary[] };

/** The events to run by day (tonight, tomorrow, then the date), then the finished ones (#546). */
export function eventSections(events: EventSummary[], now: Date): EventSection[] {
  const today = parisDay(now);
  const { coming, done } = splitFinished(events);
  const sections: EventSection[] = groupEventsByDay(coming).map(({ day, events: dayEvents }) => {
    const ahead = daysBetween(today, day);
    const kind = ahead === 0 ? "tonight" : ahead === 1 ? "tomorrow" : "day";
    return { kind, day, events: dayEvents };
  });
  if (done.length > 0) sections.push({ kind: "done", day: null, events: done });
  return sections;
}

export type EventsProgress = {
  posed: number;
  total: number;
  /** The points won so far in the competition. */
  points: number;
  /** Days to the first event, null once its day has come. */
  daysToStart: number | null;
  /** Tonight's events still to predict, and the soonest of their locks. */
  tonight: { todo: number; nextLockAt: string | null };
};

/** The progress card of the events tab (#546), from my marks by event id. */
export function eventsProgress(
  events: EventSummary[],
  mine: ReadonlyMap<string, { points?: number | null }>,
  now: Date,
): EventsProgress {
  const today = parisDay(now);
  const predicted = new Set(mine.keys());
  const starts = events.map((e) => Date.parse(e.startsAt));
  const ahead = starts.length > 0 ? daysBetween(today, parisDay(new Date(Math.min(...starts)))) : 0;
  const tonight = filterEvents(events, predicted, now, "todo")
    .filter((e) => parisDay(e.startsAt) === today)
    .sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt));
  return {
    posed: events.filter((e) => predicted.has(e.id)).length,
    total: events.length,
    points: [...mine.values()].reduce((sum, m) => sum + (m.points ?? 0), 0),
    daysToStart: ahead > 0 ? ahead : null,
    tonight: { todo: tonight.length, nextLockAt: tonight[0]?.lockAt ?? null },
  };
}
