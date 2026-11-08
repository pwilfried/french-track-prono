import type { Round } from "./rounds";

export type EventGender = "F" | "M" | "X";
export type EventStatus = "upcoming" | "live" | "finished";

export type EventSummary = {
  id: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  /** ISO 8601, UTC. */
  startsAt: string;
  /** ISO 8601, UTC. Predictions close at this time. */
  lockAt: string;
  isFeatured: boolean;
  status: EventStatus;
  /** Heat, quarter, semi-final or final. Players predict finals only. */
  round: Round;
};

/** Orders events by start time, then by slug so the order is stable. */
export function compareEvents(a: EventSummary, b: EventSummary): number {
  const byStart = Date.parse(a.startsAt) - Date.parse(b.startsAt);
  if (byStart !== 0) return byStart;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

type AthleteRef = { athleteId: string; name: string; countryCode: string };

/** An athlete on the start list of an event. */
export type Entry = AthleteRef & { seasonBest: string | null };

/** One line of the official result. Tied athletes share the same rank. */
export type ResultLine = AthleteRef & { rank: number; mark: string | null };

export type EventDetail = EventSummary & {
  entries: Entry[];
  results: ResultLine[];
  /** The disciplines of a combined event (decathlon...), in order; empty for a single event. */
  subDisciplines: string[];
  /** The rounds leading to this one (heats, semi-finals...), in running order, with their results. */
  previousRounds: PreviousRound[];
};

/** A round leading to an event, as its page shows it. */
export type PreviousRound = {
  slug: string;
  round: Round;
  status: EventStatus;
  results: ResultLine[];
};

/** Orders result lines by rank, then by name so the order of tied athletes is stable. */
export function compareResults(a: ResultLine, b: ResultLine): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
