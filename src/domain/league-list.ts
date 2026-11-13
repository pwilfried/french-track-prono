import { plain } from "./competition-search";
import { PUBLIC_LEAGUE_MAX_MEMBERS } from "./league";
import { LEAGUE_FAMILIES, type LeagueFamily } from "./league-families";

type Dated = { slug: string; startsOn: string; endsOn: string };

/**
 * « 3 compétitions · déc. → avr. » on a league card (#662): how many competitions it counts, and
 * the months (YYYY-MM) from the first start to the last end of those still known. No period
 * without a known competition.
 */
export function leagueSummary(
  slugs: string[],
  competitions: Dated[],
): { count: number; start: string | null; end: string | null } {
  const mine = competitions.filter((c) => slugs.includes(c.slug));
  if (mine.length === 0) return { count: slugs.length, start: null, end: null };
  const start = mine.map((c) => c.startsOn).sort()[0]!;
  const end = mine
    .map((c) => c.endsOn)
    .sort()
    .at(-1)!;
  return { count: slugs.length, start: start.slice(0, 7), end: end.slice(0, 7) };
}

/** The competition of a league under way or coming first (YYYY-MM-DD today); none once all are over. */
export function nextLeagueCompetition<T extends Dated>(
  slugs: string[],
  competitions: T[],
  today: string,
): T | null {
  return (
    competitions
      .filter((c) => slugs.includes(c.slug) && c.endsOn >= today)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.slug.localeCompare(b.slug))[0] ??
    null
  );
}

/** The orders of « Découvrir » (#662), the first one by default. */
export const PUBLIC_LEAGUE_SORTS = ["places", "players", "recent"] as const;
export type PublicLeagueSort = (typeof PUBLIC_LEAGUE_SORTS)[number];

export type DiscoverableLeague = {
  name: string;
  memberCount: number;
  /** ISO 8601. */
  createdAt: string;
  families?: LeagueFamily[];
};

const byName = (a: DiscoverableLeague, b: DiscoverableLeague) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base" }) ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const ORDER: Record<PublicLeagueSort, (a: DiscoverableLeague, b: DiscoverableLeague) => number> = {
  places: (a, b) =>
    PUBLIC_LEAGUE_MAX_MEMBERS - b.memberCount - (PUBLIC_LEAGUE_MAX_MEMBERS - a.memberCount),
  players: (a, b) => b.memberCount - a.memberCount,
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

/**
 * The public leagues of « Découvrir » (#662): those whose name holds every word typed (without
 * accents nor case), of one family or of all, in the order chosen, then by name.
 */
export function discoverLeagues<T extends DiscoverableLeague>(
  leagues: T[],
  options: { query: string; family: LeagueFamily | "all"; sort: PublicLeagueSort },
): T[] {
  const words = plain(options.query).split(/\s+/).filter(Boolean);
  const order = ORDER[options.sort];
  return leagues
    .filter((l) => options.family === "all" || (l.families ?? []).includes(options.family))
    .filter((l) => {
      const name = plain(l.name);
      return words.every((word) => name.includes(word));
    })
    .sort(
      (a, b) =>
        order(a, b) ||
        byName(a, b) ||
        a.memberCount - b.memberCount ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

/** The families of the filter: those of at least one league, in the order of the screen. */
export function leagueFamiliesIn(leagues: DiscoverableLeague[]): LeagueFamily[] {
  return LEAGUE_FAMILIES.filter((f) => leagues.some((l) => l.families?.includes(f)));
}
