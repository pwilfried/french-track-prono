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
