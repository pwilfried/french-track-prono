import { competitionDay, utcToParis } from "./competition";
import { compareEvents, type EventSummary } from "./event";

/** The part of a competition day an event starts in, Paris time (#659). */
export type Session = "morning" | "afternoon" | "evening";
const SESSIONS: Session[] = ["morning", "afternoon", "evening"];

/** Before noon: morning; noon to 6 pm: afternoon; from 6 pm, and the night after: evening. */
export function sessionOf(startsAt: string): Session {
  const hour = Number(utcToParis(startsAt).slice(11, 13));
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** One tab of the days bar: its events, whether it is today, whether all its events ran. */
export type ProgramDay = { day: string; events: number; today: boolean; done: boolean };

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * The days of a competition (#659), from its first to its last date, plus any day an event falls on
 * outside them. An event belongs to its competition day in Paris time: the night until 6 am stays
 * on the evening before.
 */
export function programDays(
  competition: { startsOn: string; endsOn: string },
  events: EventSummary[],
  today: string,
): ProgramDay[] {
  const byDay = new Map<string, EventSummary[]>();
  for (let day = competition.startsOn; day <= competition.endsOn; day = nextDay(day)) {
    byDay.set(day, []);
  }
  for (const event of events) {
    const day = competitionDay(event.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEvents]) => ({
      day,
      events: dayEvents.length,
      today: day === today,
      done: dayEvents.length > 0 && dayEvents.every((e) => e.status === "finished"),
    }));
}

/** The day to open: the one asked for if it is a day of the competition, else today, else the first. */
export function defaultDay(
  days: ProgramDay[],
  today: string,
  asked: string | undefined,
): string | null {
  const known = (day: string | undefined) => days.some((d) => d.day === day);
  if (known(asked)) return asked!;
  if (known(today)) return today;
  return days[0]?.day ?? null;
}

/** The events of one competition day, Paris time. */
export function eventsOfDay(events: EventSummary[], day: string): EventSummary[] {
  return events.filter((e) => competitionDay(e.startsAt) === day);
}

/** The events of a day by session, morning first, each in start order; no empty session. */
export function eventsBySession(
  events: EventSummary[],
): { session: Session; events: EventSummary[] }[] {
  const sorted = [...events].sort(compareEvents);
  return SESSIONS.map((session) => ({
    session,
    events: sorted.filter((e) => sessionOf(e.startsAt) === session),
  })).filter((s) => s.events.length > 0);
}
