import type { CompetitionAdminRepository } from "@/application/create-competition";
import type { DisciplineRepository } from "@/application/disciplines";
import type { EventReader } from "@/application/list-events";
import type { ScoringRuleRepository } from "@/application/scoring-rules";

/**
 * The public data kept across requests (#693): it changes rarely and is the same for everyone.
 * Personal data (predictions, points, rankings, leagues, profile, Manager) is never cached here.
 */
export type PublicTag = "competitions" | "events" | "disciplines" | "scale";

export const PUBLIC_TAGS: readonly PublicTag[] = ["competitions", "events", "disciplines", "scale"];

/** How long a cached read may be served without an invalidation (a missed one heals by then). */
export const PUBLIC_CACHE_SECONDS = 120;

/**
 * What each admin change makes stale. A competition counts its events, finals and entered
 * athletes, so event changes stale the competitions too.
 */
export const STALE_AFTER = {
  competition: ["competitions", "events"],
  event: ["events", "competitions"],
  startList: ["events", "competitions"],
  odds: ["events", "competitions"],
  result: ["events", "competitions"],
  discipline: ["disciplines", "events"],
  scale: ["scale"],
} as const satisfies Record<string, readonly PublicTag[]>;

export type PublicChange = keyof typeof STALE_AFTER;

/**
 * Keeps the result of an async read across requests, under `key` (plus its arguments) and
 * `tags`. Real one: Next.js `unstable_cache` (public-cache.next.ts); tests use a map.
 */
export type Memo = <A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
  key: string,
  tags: readonly PublicTag[],
) => (...args: A) => Promise<R>;

/** The events of a competition from the cache; one event (its lock, start list) stays fresh. */
export function cachedEventReader(reader: EventReader, memo: Memo): EventReader {
  return {
    ...reader,
    listByCompetition: memo((slug: string) => reader.listByCompetition(slug), "events", ["events"]),
  };
}

/** The competition list from the cache; a competition file (admin) stays fresh. */
export function cachedCompetitions(
  repository: CompetitionAdminRepository,
  memo: Memo,
): CompetitionAdminRepository {
  return {
    ...repository,
    list: memo(() => repository.list(), "competitions", ["competitions"]),
  };
}

/** The disciplines from the cache (read only: the admin writes through its own client). */
export function cachedDisciplines(
  repository: DisciplineRepository,
  memo: Memo,
): DisciplineRepository {
  return {
    ...repository,
    list: memo(() => repository.list(), "disciplines", ["disciplines"]),
  };
}

/** The scale from the cache (read only: the admin writes through its own client). */
export function cachedScale(repository: ScoringRuleRepository, memo: Memo): ScoringRuleRepository {
  return { ...repository, list: memo(() => repository.list(), "scale", ["scale"]) };
}
