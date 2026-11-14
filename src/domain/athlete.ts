import type { EventGender } from "./event";

export type RecordKind = "pr" | "sb" | "wr" | "wb";

/** A record of an athlete in a discipline. */
export type AthleteRecord = {
  discipline: string;
  kind: RecordKind;
  mark: string;
  /** YYYY-MM-DD, or null when unknown. */
  date: string | null;
  meeting: string | null;
};

/** One official result of an athlete. */
export type AthleteRace = {
  competitionSlug: string;
  eventSlug: string;
  discipline: string;
  /** ISO 8601, UTC. */
  startsAt: string;
  meeting: string;
  rank: number;
  mark: string | null;
};

/** Everything the athlete page shows. */
export type AthleteSheet = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  gender: EventGender;
  records: AthleteRecord[];
  /** Newest first. */
  races: AthleteRace[];
};

/** One line of the records band: PR and SB of a discipline side by side. */
export type RecordRow = { discipline: string; pr: AthleteRecord | null; sb: AthleteRecord | null };

/** How many disciplines the records band shows. */
export const RECORD_ROWS = 4;

/**
 * The records band: one row per discipline with a PR or an SB, the most recent record first
 * (where the athlete is active), at most RECORD_ROWS rows.
 */
export function recordRows(records: AthleteRecord[]): RecordRow[] {
  const rows = new Map<string, RecordRow & { latest: string }>();
  for (const record of records) {
    if (record.kind !== "pr" && record.kind !== "sb") continue;
    const row = rows.get(record.discipline) ?? {
      discipline: record.discipline,
      pr: null,
      sb: null,
      latest: "",
    };
    row[record.kind] = record;
    if ((record.date ?? "") > row.latest) row.latest = record.date ?? "";
    rows.set(record.discipline, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.latest.localeCompare(a.latest) || a.discipline.localeCompare(b.discipline))
    .slice(0, RECORD_ROWS)
    .map(({ discipline, pr, sb }) => ({ discipline, pr, sb }));
}
