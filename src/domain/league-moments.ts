import type { Bib } from "./bib";
import { competitionDay } from "./competition";
import { rankPlayers, totalsOf } from "./ranking";
import type { ScoreReason } from "./scoring";

/** What the app tells in the feed of a league (#671). The texts live in the messages file. */
export const MOMENT_KINDS = [
  "perfect_podium",
  "new_leader",
  "duel_result",
  "mercato_win",
  "badge",
  "streak",
] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

/** A run of scoring predictions is told when it reaches one of these lengths. */
export const STREAK_STEPS = [5, 7, 10] as const;

/** One score line of a league: a member's points on one event. */
export type MomentLine = {
  userId: string;
  pseudo: string;
  points: number;
  reasons: ScoreReason[];
  eventId: string;
  /** ISO 8601: orders the events. */
  eventStartsAt: string;
};

/**
 * A moment to publish. `key` names the fact: the same fact always gets the same key, so a
 * computation run again publishes nothing new.
 */
export type LeagueMoment = {
  key: string;
  kind: "perfect_podium" | "new_leader" | "streak";
  userId: string;
  eventId: string;
  /** Streak: the number of scoring predictions in a row. */
  length?: number;
};

const byEvent = (a: MomentLine, b: MomentLine) =>
  a.eventStartsAt.localeCompare(b.eventStartsAt) || a.eventId.localeCompare(b.eventId);

/** The events of the lines, in the order they took place. */
function eventsInOrder(lines: MomentLine[]): string[] {
  const seen = new Set<string>();
  return [...lines]
    .sort(byEvent)
    .flatMap((l) => (seen.has(l.eventId) ? [] : (seen.add(l.eventId), [l.eventId])));
}

/** The one player alone in 1st place with points; null when nobody scored or several share it. */
function leaderOf(lines: MomentLine[]): string | null {
  const pseudoOf = new Map(lines.map((l) => [l.userId, l.pseudo]));
  const ranked = rankPlayers(totalsOf(lines, (id) => pseudoOf.get(id) ?? ""));
  const first = ranked.filter((p) => p.rank === 1);
  return first.length === 1 && first[0].points > 0 ? first[0].userId : null;
}

/** Each member who found the perfect podium of an event. */
function perfectPodiums(lines: MomentLine[]): LeagueMoment[] {
  return lines
    .filter((l) => l.reasons.some((r) => r.kind === "perfect_podium"))
    .map((l) => ({
      key: `perfect_podium:${l.eventId}:${l.userId}`,
      kind: "perfect_podium",
      userId: l.userId,
      eventId: l.eventId,
    }));
}

/** Each time a new player is alone in 1st place once an event is scored. A tie changes nothing. */
function newLeaders(lines: MomentLine[]): LeagueMoment[] {
  const moments: LeagueMoment[] = [];
  const done = new Set<string>();
  let leader: string | null = null;
  for (const eventId of eventsInOrder(lines)) {
    done.add(eventId);
    const now = leaderOf(lines.filter((l) => done.has(l.eventId)));
    if (now && now !== leader) {
      moments.push({
        key: `new_leader:${eventId}:${now}`,
        kind: "new_leader",
        userId: now,
        eventId,
      });
      leader = now;
    }
  }
  return moments;
}

/** Each member whose run of scoring predictions reaches 5, 7 or 10. An event without points ends it. */
function streaks(lines: MomentLine[]): LeagueMoment[] {
  const moments: LeagueMoment[] = [];
  const players = [...new Set(lines.map((l) => l.userId))];
  for (const userId of players) {
    let run = 0;
    for (const line of lines.filter((l) => l.userId === userId).sort(byEvent)) {
      run = line.points > 0 ? run + 1 : 0;
      if ((STREAK_STEPS as readonly number[]).includes(run)) {
        moments.push({
          key: `streak:${userId}:${run}:${line.eventId}`,
          kind: "streak",
          userId,
          eventId: line.eventId,
          length: run,
        });
      }
    }
  }
  return moments;
}

/**
 * The moments told by the score lines of a league (#671): perfect podiums, changes of 1st place,
 * runs of scoring predictions. Pure: the same lines (one per player and event, as stored), in any
 * order, give the same moments.
 */
export function leagueMoments(lines: MomentLine[]): LeagueMoment[] {
  return [...perfectPodiums(lines), ...newLeaders(lines), ...streaks(lines)].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/** The moments not published yet: a fact already told is never told again. */
export function unpublished<T extends { key: string }>(
  published: Iterable<string>,
  moments: T[],
): T[] {
  const known = new Set(published);
  return moments.filter((m) => (known.has(m.key) ? false : (known.add(m.key), true)));
}

/** A moment as the feed shows it: the facts, never a text. */
export type FeedMoment = {
  key: string;
  kind: MomentKind;
  /** ISO 8601: when the app published it. */
  happenedAt: string;
  pseudo: string;
  /** The feed shows the players' pseudo and bib, nothing else (decision of 14 Nov 2026). */
  bib?: Bib;
  /** The other player of a Manager duel. */
  otherPseudo?: string;
  competitionName?: string;
  /** The event of the moment; the screen names it. */
  event?: { discipline: string; gender: "F" | "M" | "X" };
  /** Streak length, a winning bid's price, a duel's scores. */
  length?: number;
  price?: number;
  athlete?: string;
  badge?: string;
  scores?: [number, number];
};

/** How the feed titles a group of moments: tonight with its competition, yesterday, or a day. */
export type FeedGroupTitle =
  | { kind: "tonight"; competitionName: string | null }
  | { kind: "yesterday" }
  | { kind: "day"; day: string };

export type FeedGroup = { id: string; title: FeedGroupTitle; moments: FeedMoment[] };

/**
 * The feed, latest first, grouped by competition day (Paris time): « Ce soir · <compétition> »,
 * « Hier », then one group per older day.
 */
export function feedGroups(moments: FeedMoment[], now: string): FeedGroup[] {
  const today = competitionDay(now);
  const yesterday = competitionDay(new Date(Date.parse(now) - 86_400_000).toISOString());
  const groups = new Map<string, FeedGroup>();
  const sorted = [...moments].sort(
    (a, b) => b.happenedAt.localeCompare(a.happenedAt) || a.key.localeCompare(b.key),
  );
  for (const moment of sorted) {
    const day = competitionDay(moment.happenedAt);
    const title: FeedGroupTitle =
      day === today
        ? { kind: "tonight", competitionName: moment.competitionName ?? null }
        : day === yesterday
          ? { kind: "yesterday" }
          : { kind: "day", day };
    const id = title.kind === "tonight" ? `${day}:${title.competitionName ?? ""}` : day;
    const group = groups.get(id) ?? { id, title, moments: [] };
    group.moments.push(moment);
    groups.set(id, group);
  }
  return [...groups.values()];
}
