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
};

/** Orders events by start time, then by slug so the order is stable. */
export function compareEvents(a: EventSummary, b: EventSummary): number {
  const byStart = Date.parse(a.startsAt) - Date.parse(b.startsAt);
  if (byStart !== 0) return byStart;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

export type AthleteRef = { athleteId: string; name: string; countryCode: string };

/** An athlete on the start list of an event. */
export type Entry = AthleteRef & { seasonBest: string | null };

/** One line of the official result. Tied athletes share the same rank. */
export type ResultLine = AthleteRef & { rank: number; mark: string | null };

export type EventDetail = EventSummary & { entries: Entry[]; results: ResultLine[] };

/** Orders result lines by rank, then by name so the order of tied athletes is stable. */
export function compareResults(a: ResultLine, b: ResultLine): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
