import { utcToParis, type CompetitionScope, type CompetitionVenue } from "./competition";

/**
 * The competition picker of a league (#663): quick selections built from the data, a search with
 * combinable filters, and the list grouped by month. Pure, so that it stays smooth with 150
 * competitions: the component calls each function once per change, not once per row.
 */
export type PickableCompetition = {
  id: string;
  name: string;
  /** ISO instant of its first event. */
  firstEventAt: string;
  city: string | null;
  scope: CompetitionScope;
  venue: CompetitionVenue;
  /** « diamond-league », « championnat »…, null when none is set. */
  level: string | null;
};

/** The level of championships: with an international scope, the major championships. */
export const CHAMPIONSHIP_LEVEL = "championnat";

export type QuickSelection =
  | { kind: "season" | "indoor" | "majors"; ids: string[] }
  | { kind: "level"; level: string; ids: string[] };

const idsOf = (list: readonly PickableCompetition[]) => list.map((c) => c.id);

/** The levels present, once each, most frequent first, then in alphabetical order. */
export function levelsOf(list: readonly PickableCompetition[]): string[] {
  const counts = new Map<string, number>();
  for (const c of list) if (c.level) counts.set(c.level, (counts.get(c.level) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([level]) => level);
}

/**
 * « Toute la saison », « Saison en salle », one per level (championships aside), then « Grands
 * championnats » (championships of international scope); none without a competition.
 */
export function quickSelections(list: readonly PickableCompetition[]): QuickSelection[] {
  const selections: QuickSelection[] = [
    { kind: "season", ids: idsOf(list) },
    { kind: "indoor", ids: idsOf(list.filter((c) => c.venue === "indoor")) },
    ...levelsOf(list)
      .filter((level) => level !== CHAMPIONSHIP_LEVEL)
      .map((level) => ({
        kind: "level" as const,
        level,
        ids: idsOf(list.filter((c) => c.level === level)),
      })),
    {
      kind: "majors",
      ids: idsOf(list.filter((c) => c.level === CHAMPIONSHIP_LEVEL && c.scope === "international")),
    },
  ];
  return selections.filter((s) => s.ids.length > 0);
}

export type PickerFilters = {
  query: string;
  scope: CompetitionScope | null;
  venue: CompetitionVenue | null;
  level: string | null;
  /** « Voir seulement mes compétitions cochées ». */
  onlyChosen: boolean;
};

export const NO_FILTERS: PickerFilters = {
  query: "",
  scope: null,
  venue: null,
  level: null,
  onlyChosen: false,
};

/** Lower case, without accents nor spaces around: « Liévin » and « lievin » match. */
export const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Whether a search is typed: then every month opens. */
export const isSearching = (filters: PickerFilters) => searchable(filters.query) !== "";

/** The competitions shown: the search (name, city) and every filter set, in their order. */
export function filterCompetitions(
  list: readonly PickableCompetition[],
  filters: PickerFilters,
  chosen: ReadonlySet<string>,
): PickableCompetition[] {
  const query = searchable(filters.query);
  return list.filter(
    (c) =>
      (!filters.scope || c.scope === filters.scope) &&
      (!filters.venue || c.venue === filters.venue) &&
      (!filters.level || c.level === filters.level) &&
      (!filters.onlyChosen || chosen.has(c.id)) &&
      (query === "" ||
        searchable(c.name).includes(query) ||
        (c.city !== null && searchable(c.city).includes(query))),
  );
}

/** A month of the list: « YYYY-MM » in Paris time, and its competitions, first one first. */
export type MonthGroup<C> = { month: string; competitions: C[] };

/** The competitions by month of their first event (Paris time), first month first. */
export function groupByMonth<C extends { firstEventAt: string }>(
  list: readonly C[],
): MonthGroup<C>[] {
  const months = new Map<string, C[]>();
  const sorted = [...list].sort((a, b) => a.firstEventAt.localeCompare(b.firstEventAt));
  for (const c of sorted) {
    const month = utcToParis(c.firstEventAt).slice(0, 7);
    const group = months.get(month);
    if (group) group.push(c);
    else months.set(month, [c]);
  }
  return [...months.entries()].map(([month, competitions]) => ({ month, competitions }));
}
