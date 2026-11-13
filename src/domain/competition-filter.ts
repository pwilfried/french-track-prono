import { type CompetitionScope, type CompetitionVenue, SCOPES, VENUES } from "./competition";

/** Where a competition stands on a day: not started, under way, or over. */
export type CompetitionStatus = "coming" | "live" | "past";
export const COMPETITION_STATUSES: CompetitionStatus[] = ["coming", "live", "past"];

/** The filters of the admin competition list (#647); null means « all ». */
export type CompetitionFilter = {
  scope: CompetitionScope | null;
  venue: CompetitionVenue | null;
  level: string | null;
  status: CompetitionStatus | null;
};

export const NO_FILTER: CompetitionFilter = { scope: null, venue: null, level: null, status: null };

type Filterable = {
  scope: CompetitionScope;
  venue: CompetitionVenue;
  level: string | null;
  startsOn: string;
  endsOn: string;
};

/** Coming before its first day, live until its last day included, past after (YYYY-MM-DD). */
export function competitionStatus(
  c: { startsOn: string; endsOn: string },
  today: string,
): CompetitionStatus {
  if (today < c.startsOn) return "coming";
  return today <= c.endsOn ? "live" : "past";
}

/** The competitions matching every filter set, in the order given. */
export function filterCompetitions<T extends Filterable>(
  competitions: T[],
  filter: CompetitionFilter,
  today: string,
): T[] {
  return competitions.filter(
    (c) =>
      (filter.scope === null || c.scope === filter.scope) &&
      (filter.venue === null || c.venue === filter.venue) &&
      (filter.level === null || c.level === filter.level) &&
      (filter.status === null || competitionStatus(c, today) === filter.status),
  );
}

const KNOWN_LEVELS = ["championnat", "diamond-league", "world-indoor-tour-gold"];

/** The levels present, once each: the known ones first, then the others by name. */
export function competitionLevels(competitions: { level: string | null }[]): string[] {
  const present = new Set(competitions.flatMap((c) => (c.level ? [c.level] : [])));
  return [
    ...KNOWN_LEVELS.filter((level) => present.has(level)),
    ...[...present].filter((level) => !KNOWN_LEVELS.includes(level)).sort(),
  ];
}

const pick = <T extends string>(value: string | undefined, allowed: readonly T[]): T | null =>
  allowed.find((v) => v === value) ?? null;

/** The filters of the address (portee, lieu, niveau, statut); unknown values are ignored. */
export function parseCompetitionFilter(
  params: { portee?: string; lieu?: string; niveau?: string; statut?: string },
  levels: string[],
): CompetitionFilter {
  return {
    scope: pick(params.portee, SCOPES),
    venue: pick(params.lieu, VENUES),
    level: pick(params.niveau, levels),
    status: pick(params.statut, COMPETITION_STATUSES),
  };
}

export const isFiltered = (filter: CompetitionFilter) =>
  Object.values(filter).some((value) => value !== null);
