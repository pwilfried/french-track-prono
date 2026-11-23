// The signed-in player's home (#346): the next final to predict and the next ones after it.
import { competitionDay, daysBetween, daysUntil, utcToParis } from "./competition";
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

/** When the other finals start, relative to now, for « N autres finales … » (competition days). */
export type SameDayWhen =
  { when: "evening" | "today" | "tomorrow" } | { when: "later"; day: string };

/** Tonight from 18:00 Paris time (the night until 6 am still belongs to the evening before). */
export function sameDayWhen(startsAt: string, now: Date): SameDayWhen {
  const day = competitionDay(startsAt);
  const gap = daysBetween(competitionDay(now.toISOString()), day);
  if (gap > 1) return { when: "later", day };
  if (gap === 1) return { when: "tomorrow" };
  const hour = Number(utcToParis(startsAt).slice(11, 13));
  return { when: hour >= 18 || hour < 6 ? "evening" : "today" };
}

/** The one thing the signed-in player's home puts first (#526, « Ta prochaine action »). */
export type NextAction<C> =
  | {
      kind: "predict";
      final: EventSummary;
      /** Other open finals left to predict, starting the same day (Paris time). */
      sameDay: number;
    }
  | { kind: "competition"; competition: C; daysLeft: number };

const parisDay = (iso: string) => utcToParis(iso).slice(0, 10);

/** The open finals the player has not predicted, the closest to their lock first. */
const finalsToPredict = (events: EventSummary[], predicted: Set<string>, now: Date) =>
  openFinals(events, predicted, now)
    .filter((final) => !final.predicted)
    .sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt) || compareEvents(a, b));

/**
 * An open final the player has not predicted: first among `events` (the competitions of their
 * leagues), else among `otherEvents` (any other competition, it counts in the general ranking),
 * the closest to its lock each time; else the next competition to start; null when there is none.
 * `competitionOf` tells the competition of an event, so « autres finales » counts only its own.
 */
export function nextAction<C extends { startsOn: string }>(input: {
  events: EventSummary[];
  otherEvents?: EventSummary[];
  competitionOf?: (eventId: string) => string;
  predicted: Set<string>;
  competitions: C[];
  now: Date;
}): NextAction<C> | null {
  const {
    events,
    otherEvents = [],
    competitionOf = () => "",
    predicted,
    competitions,
    now,
  } = input;
  for (const pool of [events, otherEvents]) {
    const toPredict = finalsToPredict(pool, predicted, now);
    const [final] = toPredict;
    if (!final) continue;
    const day = parisDay(final.startsAt);
    const sameDay = toPredict.filter(
      (f) =>
        f !== final &&
        parisDay(f.startsAt) === day &&
        competitionOf(f.id) === competitionOf(final.id),
    ).length;
    return { kind: "predict", final, sameDay };
  }

  const today = now.toISOString().slice(0, 10);
  const [competition] = competitions
    .filter((c) => c.startsOn > today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return competition
    ? { kind: "competition", competition, daysLeft: daysUntil(competition.startsOn, today) }
    : null;
}

type Ranked = { userId: string; rank: number; points: number };

/** Where the player stands in one league: three lines around them and the gap to the one ahead. */
export type LeagueStanding<R> = {
  leagueId: string;
  rank: number;
  total: number;
  /** Points behind the player just ahead; null for a leader. */
  gap: number | null;
  rows: R[];
};

/** The league where the player ranks best (the first one on a tie); null when in no ranking. */
export function leagueStanding<R extends Ranked>(
  leagues: { id: string; rows: R[] }[],
  userId: string,
): LeagueStanding<R> | null {
  let best: { id: string; rows: R[]; index: number } | null = null;
  for (const league of leagues) {
    const index = league.rows.findIndex((row) => row.userId === userId);
    if (index < 0) continue;
    if (!best || league.rows[index]!.rank < best.rows[best.index]!.rank) {
      best = { ...league, index };
    }
  }
  if (!best) return null;
  const { rows, index } = best;
  const me = rows[index]!;
  const ahead = rows[index - 1];
  const start = Math.max(0, Math.min(index - 1, rows.length - 3));
  return {
    leagueId: best.id,
    rank: me.rank,
    total: rows.length,
    gap: ahead ? ahead.points - me.points : null,
    rows: rows.slice(start, start + 3),
  };
}

/** The slug of the final a visitor's « Faire mon premier prono » leads to (#439); null when none. */
export function firstFinalToPredict(events: EventSummary[], now: Date): string | null {
  return openFinals(events, new Set(), now)[0]?.slug ?? null;
}
