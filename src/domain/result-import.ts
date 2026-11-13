import {
  RECORD_FLAGS,
  type Performance,
  type PerformanceStatus,
  type RecordFlag,
} from "./performance";
import { nameKey } from "./start-list-import";

/** One line of a results table pasted from World Athletics (#666). */
export type ResultRow = {
  /** Place in the event; tied athletes share it; null for an athlete who did not finish. */
  place: number | null;
  name: string;
  countryCode: string | null;
  status: PerformanceStatus;
  mark: string | null;
  records: RecordFlag[];
};

type Entry = { athleteId: string; name: string; countryCode: string };

/** The pasted lines matched with the start list, and those that match no one. */
export type ResultMatch = { lines: Performance[]; unmatched: ResultRow[] };

const STATUSES: Record<string, PerformanceStatus> = {
  DNS: "dns",
  DNF: "dnf",
  DQ: "dq",
  DSQ: "dq",
  // No valid mark in a field event: no performance, like a race not finished.
  NM: "dnf",
  NH: "dnf",
};

/** Area records all count as the continental record. */
const RECORDS: Record<string, RecordFlag> = {
  PB: "pb",
  SB: "sb",
  NR: "nr",
  WR: "wr",
  AR: "ar",
  ER: "ar",
  ASR: "ar",
  AFR: "ar",
  NACAR: "ar",
  SACAR: "ar",
  OCR: "ar",
};

const DATE_OF_BIRTH = /\b\d{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/gi;
const PLACE = /^=?(\d+)[.=]?$/;
const MARK = /^(\d+(?:[.:,]\d+)*)[hm]?$/;

const statusOf = (token: string) => STATUSES[token.toUpperCase()];
const isMark = (token: string) => MARK.test(token);
const isCountry = (token: string) => /^[A-Z]{3}$/.test(token) && statusOf(token) === undefined;

/** One pasted line as a result, or null for a title, a header, the wind or anything else. */
function parseLine(line: string): ResultRow | null {
  const tokens = line
    .replace(DATE_OF_BIRTH, " ")
    .split(/\s+/)
    .map((token) => token.replace(/,+$/, ""))
    .filter(Boolean);
  let i = 0;
  let place: number | null = null;
  let status: PerformanceStatus | undefined;
  const placed = tokens[0]?.match(PLACE);
  if (placed) {
    place = Number(placed[1]);
    i = 1;
    // A bib number may follow the place.
    while (/^\d+$/.test(tokens[i] ?? "")) i++;
  } else if (tokens[0] && statusOf(tokens[0])) {
    status = statusOf(tokens[0]);
    i = 1;
  }

  // The country is the three capitals right before the mark, the status or the end of the line:
  // a surname in capitals (« LEE ») is not.
  const ends = (j: number) => {
    const next = tokens[j + 1];
    return next === undefined || isMark(next) || statusOf(next) !== undefined;
  };
  let country = -1;
  for (let j = i + 1; j < tokens.length; j++) {
    if (isCountry(tokens[j]!) && ends(j)) {
      country = j;
      break;
    }
  }
  let end = country;
  if (end < 0) {
    end = tokens.findIndex((t, j) => j > i && (isMark(t) || statusOf(t) !== undefined));
    if (end < 0) end = tokens.length;
  }
  const name = tokens.slice(i, end).join(" ");

  let mark: string | null = null;
  const records = new Set<RecordFlag>();
  for (const token of tokens.slice(country < 0 ? end : end + 1)) {
    const word = token.replace(/^=/, "").toUpperCase();
    if (status === undefined && statusOf(token)) status = statusOf(token);
    else if (mark === null && isMark(token)) mark = token.match(MARK)![1]!;
    else if (mark !== null && RECORDS[word]) records.add(RECORDS[word]);
  }

  if (!/\p{L}/u.test(name)) return null;
  if (status !== undefined) {
    return {
      place: null,
      name,
      countryCode: tokens[country] ?? null,
      status,
      mark: null,
      records: [],
    };
  }
  if (place === null || mark === null) return null;
  return {
    place,
    name,
    countryCode: tokens[country] ?? null,
    status: "ok",
    mark,
    records: RECORD_FLAGS.filter((f) => records.has(f)),
  };
}

/**
 * Reads a results table copied from a World Athletics results page (#666): place, name, country,
 * mark, records and DNS / DNF / DQ, cells separated by tabs or spaces, names in capitals or not.
 * Titles, headers, the wind and blank lines are skipped; a bib or a date of birth is dropped.
 */
export function parseResultsTable(text: string): ResultRow[] {
  return text.split(/\r?\n/).flatMap((line) => parseLine(line) ?? []);
}

/**
 * Matches the pasted rows with the athletes of the start list, by name regardless of accents,
 * case and word order, and by country when the row has one: a namesake from another country is
 * not the athlete. A row that matches no one, or an athlete already matched, is left apart.
 */
export function matchResults(rows: ResultRow[], entries: Entry[]): ResultMatch {
  const keyed = entries.map((entry) => ({ entry, key: nameKey(entry.name) }));
  const taken = new Set<string>();
  const lines: Performance[] = [];
  const unmatched: ResultRow[] = [];
  for (const row of rows) {
    const wanted = nameKey(row.name);
    const found = keyed.filter(
      (c) =>
        c.key === wanted && (row.countryCode === null || c.entry.countryCode === row.countryCode),
    );
    const athleteId = found.length === 1 ? found[0]!.entry.athleteId : null;
    if (athleteId === null || taken.has(athleteId)) {
      unmatched.push(row);
      continue;
    }
    taken.add(athleteId);
    lines.push({
      athleteId,
      status: row.status,
      place: row.place,
      mark: row.mark,
      records: row.records,
    });
  }
  return { lines, unmatched };
}
