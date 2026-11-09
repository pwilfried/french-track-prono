// The signed-in player's home (#346): the next final to predict and the next ones after it.
import { compareEvents, type EventSummary } from "./event";

export type OpenFinal = EventSummary & { predicted: boolean };

/**
 * The finals still open to predictions (lock in the future), in start order, each marked
 * predicted or not: the first is « la prochaine finale », the next three « à pronostiquer ».
 */
export function openFinals(
  events: EventSummary[],
  predictedEventIds: Set<string>,
  now: Date,
): OpenFinal[] {
  return events
    .filter((event) => event.round === "final" && Date.parse(event.lockAt) > now.getTime())
    .sort(compareEvents)
    .map((event) => ({ ...event, predicted: predictedEventIds.has(event.id) }));
}
