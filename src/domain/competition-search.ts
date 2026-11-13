import type { CompetitionScope } from "./competition";

type Searchable = {
  slug: string;
  name: string;
  city: string | null;
  scope: CompetitionScope;
  startsOn: string;
  endsOn: string;
};

/** Lower case, without accents nor extra spaces: « Élite » matches « elite ». */
export const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** The competitions whose name or city holds the words typed, of one kind or of both (#659). */
export function searchCompetitions<T extends Searchable>(
  competitions: T[],
  query: string,
  scope: CompetitionScope | "all",
): T[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return competitions.filter((c) => {
    if (scope !== "all" && c.scope !== scope) return false;
    const text = plain(`${c.name} ${c.city ?? ""}`);
    return words.every((word) => text.includes(word));
  });
}

export type CompetitionGroup<T> =
  | { kind: "mine" | "past"; month: null; competitions: T[] }
  | { kind: "month"; month: string; competitions: T[] };

const byStart = (a: Searchable, b: Searchable) =>
  a.startsOn.localeCompare(b.startsOn) || a.slug.localeCompare(b.slug);

/**
 * The groups of the « Choisir une compétition » sheet (#659): the coming competitions of my leagues,
 * then the other coming ones by month (YYYY-MM), then the finished ones, the latest first.
 */
export function competitionGroups<T extends Searchable>(
  competitions: T[],
  myLeagueSlugs: string[],
  today: string,
): CompetitionGroup<T>[] {
  const mineSet = new Set(myLeagueSlugs);
  const coming = competitions.filter((c) => c.endsOn >= today).sort(byStart);
  const past = competitions.filter((c) => c.endsOn < today).sort((a, b) => byStart(b, a));
  const groups: CompetitionGroup<T>[] = [];
  const mine = coming.filter((c) => mineSet.has(c.slug));
  if (mine.length > 0) groups.push({ kind: "mine", month: null, competitions: mine });
  for (const c of coming.filter((c) => !mineSet.has(c.slug))) {
    const month = c.startsOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.kind === "month" && last.month === month) last.competitions.push(c);
    else groups.push({ kind: "month", month, competitions: [c] });
  }
  if (past.length > 0) groups.push({ kind: "past", month: null, competitions: past });
  return groups;
}

/**
 * The competitions of the rankings scope sheet (#661) matching the search: those in progress, then
 * the finished ones, the latest first. The coming ones have no ranking yet and are left out.
 */
export function rankingScopeGroups<T extends Searchable>(
  competitions: T[],
  query: string,
  today: string,
): { live: T[]; past: T[] } {
  const found = searchCompetitions(competitions, query, "all");
  return {
    live: found.filter((c) => c.startsOn <= today && c.endsOn >= today).sort(byStart),
    past: found.filter((c) => c.endsOn < today).sort((a, b) => byStart(b, a)),
  };
}

/** The years a season spans (« 2026-27 »), from its first to its last competition; null if none. */
export function seasonYears(competitions: Searchable[]): { from: number; to: number } | null {
  if (competitions.length === 0) return null;
  const years = competitions.map((c) => Number(c.startsOn.slice(0, 4)));
  return { from: Math.min(...years), to: Math.max(...years) };
}
