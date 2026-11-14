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

/** A record as the athlete page shows it: an unverified mark carries « ? » (#679). */
export type SheetRecord = AthleteRecord & { verified: boolean };

/** Everything the athlete page shows: records only, no results (owner's decision, #679). */
export type AthleteSheet = {
  athleteId: string;
  slug: string;
  name: string;
  countryCode: string;
  gender: EventGender;
  /** The athlete's disciplines, the main one first. */
  disciplines: string[];
  /** Price in the Manager catalogue; null when not in it. */
  managerPrice: number | null;
  records: SheetRecord[];
};

/** One block of the athlete page: the PB and the SB of the current season in a discipline. */
export type DisciplineRecords = {
  discipline: string;
  /** The athlete's main discipline. */
  main: boolean;
  pb: SheetRecord | null;
  sb: SheetRecord | null;
};

/**
 * The blocks of the athlete page (#679): one per discipline with a PB or an SB of `season` (an SB
 * dated an earlier year is stale; one without a date is kept). The athlete's disciplines come
 * first in their order (the main one at the top), then any other by its latest record.
 */
export function disciplineRecords(
  sheet: Pick<AthleteSheet, "disciplines" | "records">,
  season: number,
): DisciplineRecords[] {
  const blocks = new Map<string, DisciplineRecords & { latest: string }>();
  for (const record of sheet.records) {
    if (record.kind !== "pr" && record.kind !== "sb") continue;
    if (record.kind === "sb" && record.date && Number(record.date.slice(0, 4)) !== season) continue;
    const block = blocks.get(record.discipline) ?? {
      discipline: record.discipline,
      main: sheet.disciplines[0] === record.discipline,
      pb: null,
      sb: null,
      latest: "",
    };
    block[record.kind === "pr" ? "pb" : "sb"] = record;
    if ((record.date ?? "") > block.latest) block.latest = record.date ?? "";
    blocks.set(record.discipline, block);
  }
  const rank = (discipline: string) => {
    const at = sheet.disciplines.indexOf(discipline);
    return at < 0 ? sheet.disciplines.length : at;
  };
  return [...blocks.values()]
    .sort(
      (a, b) =>
        rank(a.discipline) - rank(b.discipline) ||
        b.latest.localeCompare(a.latest) ||
        a.discipline.localeCompare(b.discipline),
    )
    .map(({ discipline, main, pb, sb }) => ({ discipline, main, pb, sb }));
}

/** The block the key figures of the page come from: the main discipline, else the first one. */
export function keyRecords(blocks: DisciplineRecords[]): DisciplineRecords | null {
  return blocks.find((b) => b.main) ?? blocks[0] ?? null;
}
