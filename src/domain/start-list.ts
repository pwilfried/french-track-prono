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
