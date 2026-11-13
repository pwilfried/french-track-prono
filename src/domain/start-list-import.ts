/** One line of a pasted start list. */
export type ImportRow = { name: string; countryCode: string | null; seasonBest: string | null };

export type ImportParse = { rows: ImportRow[] } | { error: "CSV_EMPTY" | "CSV_NO_NAME" };

type Candidate = { athleteId: string; name: string; countryCode: string };

/** One line of the pre-import report. */
export type ImportLine =
  | { row: ImportRow; status: "matched"; athlete: Candidate }
  | { row: ImportRow; status: "ambiguous"; choices: Candidate[] }
  | { row: ImportRow; status: "new" };

/** Largest number of edits for two names to be "the same athlete, misspelt". */
export const MAX_DISTANCE = 3;

const HEADERS = {
  name: ["nom", "name", "athlete", "athlète", "athletes"],
  country: ["pays", "country", "nat", "nation", "ctry", "nationalite", "nationalité"],
  seasonBest: ["sb", "mps", "perf", "season best", "meilleure", "marque"],
};

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const isCountry = (cell: string) => /^[A-Z]{3}$/.test(cell);
const isMark = (cell: string) => /^\d+([.:,]\d+)*$/.test(cell);

/**
 * Reads a start list pasted from a spreadsheet or a results page: comma, semicolon or tab
 * separated, with or without a header row, columns in any order. Without a header, a three-letter
 * code is the country, a number is the season best and the first other text is the name.
 */
export function parseStartListCsv(text: string): ImportParse {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { error: "CSV_EMPTY" };
  const first = lines[0]!;
  const separator = first.includes("\t")
    ? "\t"
    : (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const table = lines.map((line) => line.split(separator).map((cell) => cell.trim()));

  const header = table[0]!.map(plain);
  const find = (keys: string[]) => header.findIndex((cell) => keys.includes(cell));
  let columns = {
    name: find(HEADERS.name),
    country: find(HEADERS.country),
    seasonBest: find(HEADERS.seasonBest),
  };
  let body = table;
  if (columns.name >= 0) {
    body = table.slice(1);
  } else {
    const sample = table[0]!;
    const country = sample.findIndex(isCountry);
    const seasonBest = sample.findIndex((cell, i) => i !== country && isMark(cell));
    const name = sample.findIndex(
      (cell, i) => i !== country && i !== seasonBest && /\p{L}/u.test(cell),
    );
    columns = { name, country, seasonBest };
  }
  if (columns.name < 0) return { error: "CSV_NO_NAME" };

  const cell = (row: string[], index: number) => (index >= 0 ? row[index]?.trim() || null : null);
  const rows = body
    .map((row) => ({
      name: cell(row, columns.name) ?? "",
      countryCode: cell(row, columns.country)?.toUpperCase() ?? null,
      seasonBest: cell(row, columns.seasonBest),
    }))
    .filter((row) => row.name !== "");
  return rows.length === 0 ? { error: "CSV_EMPTY" } : { rows };
}

/** The number of single-letter edits to turn one text into the other. */
export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** A name compared regardless of accents, case, punctuation and word order. */
export const nameKey = (name: string) =>
  plain(name)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(" ");

/**
 * Matches each pasted name with the known athletes. An exact name (word order and accents aside)
 * matches; otherwise the athletes within MAX_DISTANCE edits are the possibilities: one is a match,
 * several are a choice for the admin (closest first), none means a new athlete.
 */
export function importReport(rows: ImportRow[], candidates: Candidate[]): ImportLine[] {
  const keyed = candidates.map((athlete) => ({ athlete, key: nameKey(athlete.name) }));
  return rows.map((row): ImportLine => {
    const wanted = nameKey(row.name);
    const close = keyed
      .map((c) => ({ athlete: c.athlete, distance: levenshtein(wanted, c.key) }))
      .filter((c) => c.distance <= MAX_DISTANCE)
      .sort((a, b) => a.distance - b.distance);
    const exact = close.filter((c) => c.distance === 0);
    if (exact.length === 1) return { row, status: "matched", athlete: exact[0]!.athlete };
    if (close.length === 1) return { row, status: "matched", athlete: close[0]!.athlete };
    if (close.length > 1) return { row, status: "ambiguous", choices: close.map((c) => c.athlete) };
    return { row, status: "new" };
  });
}

/** The address of a new athlete: "Gémima Joseph" → "gemima-joseph". */
export function athleteSlug(name: string): string {
  return plain(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
