/** The most athletes a start list can hold (a final has 8 to 12, a heat-less race up to 24). */
export const MAX_START_LIST = 24;

/** Lower case, without accents: "Josée" and "JOSEE" compare equal. */
function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The athletes whose name matches the query, ignoring case and accents. A name with a word that
 * starts with the query comes first, then names that only contain it; each group keeps the order
 * of the list. Without a query, the whole list.
 */
export function searchAthletes<T extends { name: string }>(athletes: T[], query: string): T[] {
  const q = normalized(query.trim());
  if (!q) return athletes;
  const startsWord = (name: string) => name.split(/[\s'-]+/).some((word) => word.startsWith(q));
  const names = athletes.map((athlete) => ({ athlete, name: normalized(athlete.name) }));
  return [
    ...names.filter((n) => startsWord(n.name)),
    ...names.filter((n) => !startsWord(n.name) && n.name.includes(q)),
  ].map((n) => n.athlete);
}

/** Filters of the back-office athlete list; an empty filter keeps everyone. */
export type AthleteFilter = { discipline?: string; gender?: "F" | "M" | "X"; country?: string };

/** The athletes that match every filter given (discipline, sex, country). */
export function filterAthletes<
  T extends { gender: string; countryCode: string; disciplines: string[] },
>(athletes: T[], filter: AthleteFilter): T[] {
  const country = filter.country?.trim().toUpperCase();
  return athletes.filter(
    (a) =>
      (!filter.discipline || a.disciplines.includes(filter.discipline)) &&
      (!filter.gender || a.gender === filter.gender) &&
      (!country || a.countryCode.trim().toUpperCase() === country),
  );
}

/** One to MAX_START_LIST athletes, all different. */
export function isValidStartList(entries: { athleteId: string }[]): boolean {
  const ids = entries.map((e) => e.athleteId);
  return (
    ids.length >= 1 &&
    ids.length <= MAX_START_LIST &&
    ids.every((id) => id.trim() !== "") &&
    new Set(ids).size === ids.length
  );
}

/** How an athlete relates to the discipline of an event. */
export type DisciplineFit = "primary" | "discipline" | "other";

const FIT_ORDER: DisciplineFit[] = ["primary", "discipline", "other"];

/**
 * The athletes whose main discipline it is first, then those who also run it, then everybody
 * else; by name within each group.
 */
export function sortByDiscipline<T extends { name: string; fit: DisciplineFit }>(
  athletes: T[],
): T[] {
  return [...athletes].sort(
    (a, b) => FIT_ORDER.indexOf(a.fit) - FIT_ORDER.indexOf(b.fit) || a.name.localeCompare(b.name),
  );
}
