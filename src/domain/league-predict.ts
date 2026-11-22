// The « Pronostiquer » block on top of a league (#1069).
import { competitionDay } from "./competition";
import { compareEvents, type EventSummary } from "./event";
import { openFinals } from "./home";

export type LeaguePredict<E, C> =
  /** The finals left to predict on the day of the one closest to its lock, in start order. */
  | { kind: "predict"; finals: E[] }
  /** Every open final is predicted: how many, and the first to lock (they stay editable until). */
  | { kind: "done"; posed: number; first: E }
  /** No final open: the next competition of the league to start. */
  | { kind: "next"; competition: C };

const byLock = (a: EventSummary, b: EventSummary) =>
  Date.parse(a.lockAt) - Date.parse(b.lockAt) || compareEvents(a, b);

/**
 * What the league puts first for the player, from the finals that count in it: the open ones left
 * to predict, else « all posed », else when the next competition starts; null when nothing comes.
 */
export function leaguePredict<E extends EventSummary, C extends { startsOn: string }>(input: {
  events: E[];
  predicted: Set<string>;
  competitions: C[];
  now: Date;
}): LeaguePredict<E, C> | null {
  const { events, predicted, competitions, now } = input;
  const openIds = new Set(openFinals(events, predicted, now).map((f) => f.id));
  const open = events.filter((e) => openIds.has(e.id)).sort(byLock);
  const toPredict = open.filter((e) => !predicted.has(e.id));
  const [first] = toPredict;
  if (first) {
    const day = competitionDay(first.startsAt);
    const finals = toPredict.filter((e) => competitionDay(e.startsAt) === day).sort(compareEvents);
    return { kind: "predict", finals };
  }
  if (open.length > 0) return { kind: "done", posed: open.length, first: open[0]! };
  const today = competitionDay(now.toISOString());
  const [competition] = competitions
    .filter((c) => c.startsOn > today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return competition ? { kind: "next", competition } : null;
}
