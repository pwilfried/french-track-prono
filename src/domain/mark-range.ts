import { formatMark, parseMark, type DisciplineFamily, type MarkUnit } from "./discipline";

/** The plausible marks of a discipline, bounds included, in its unit (seconds, metres, points). */
export type MarkRange = { min: number; max: number };

/** A range and a typical mark inside it, shown greyed in an empty mark field (#927). */
type MarkRangeWithExample = MarkRange & { example: number };

/**
 * Plausible marks per family, wide enough for every discipline of the family, from the indoor
 * 60 m to the 400 m, from the 800 m to the 1500 m, from the 3000 m to the marathon and the walks.
 * Mirrored by `mark_range` in the database (supabase/migrations/20261114030000_mark_range.sql):
 * change both together (the examples live here only).
 */
const BY_FAMILY: Record<DisciplineFamily, MarkRangeWithExample & { unit: MarkUnit }> = {
  sprint: { unit: "time", min: 5, max: 90, example: 10.85 },
  hurdles: { unit: "time", min: 6, max: 90, example: 13.2 },
  relay: { unit: "time", min: 30, max: 300, example: 38.2 },
  middle: { unit: "time", min: 90, max: 900, example: 241.2 },
  long: { unit: "time", min: 300, max: 21600, example: 795 },
  horizontal_jumps: { unit: "distance", min: 5, max: 20, example: 7.45 },
  vertical_jumps: { unit: "distance", min: 1, max: 7, example: 1.95 },
  throws: { unit: "distance", min: 5, max: 110, example: 62.4 },
  combined: { unit: "points", min: 1000, max: 10000, example: 8250 },
};

/** For a discipline whose unit is not the usual one of its family: the widest marks of the unit. */
const BY_UNIT: Record<MarkUnit, MarkRangeWithExample> = {
  time: { min: 5, max: 21600, example: 10.85 },
  distance: { min: 1, max: 110, example: 8.15 },
  points: { min: 1000, max: 10000, example: 8250 },
};

/**
 * Plausible marks of the known disciplines (#935): about their world records (men and women
 * alike) with a margin below, and the slowest or shortest mark of a championship final above.
 * Mirrored by `discipline_mark_range` in the database
 * (supabase/migrations/20261115100000_discipline_mark_range.sql): change both together.
 */
const BY_DISCIPLINE: Record<string, MarkRangeWithExample & { unit: MarkUnit }> = {
  "100 m": { unit: "time", min: 9, max: 14, example: 10.85 },
  "200 m": { unit: "time", min: 18.5, max: 28, example: 21.8 },
  "400 m": { unit: "time", min: 42, max: 65, example: 48.5 },
  "100 m haies": { unit: "time", min: 11.5, max: 17, example: 12.9 },
  "110 m haies": { unit: "time", min: 12.5, max: 18, example: 13.4 },
  "400 m haies": { unit: "time", min: 44, max: 70, example: 49.8 },
  "800 m": { unit: "time", min: 95, max: 160, example: 105.5 },
  "1500 m": { unit: "time", min: 200, max: 330, example: 215.2 },
  "3000 m steeple": { unit: "time", min: 450, max: 720, example: 500 },
  "5000 m": { unit: "time", min: 720, max: 1200, example: 800 },
  "10 000 m": { unit: "time", min: 1500, max: 2400, example: 1650 },
  Marathon: { unit: "time", min: 6900, max: 12600, example: 7590 },
  "Relais 4x100 m": { unit: "time", min: 35, max: 50, example: 38.2 },
  "Relais 4x400 m": { unit: "time", min: 170, max: 240, example: 180.5 },
  "Relais mixte 4x100 m": { unit: "time", min: 38, max: 52, example: 40.5 },
  "Relais mixte 4x400 m": { unit: "time", min: 175, max: 250, example: 191.2 },
  "Saut en longueur": { unit: "distance", min: 5, max: 9.5, example: 8.15 },
  "Triple saut": { unit: "distance", min: 11, max: 19, example: 17.2 },
  "Saut en hauteur": { unit: "distance", min: 1.5, max: 2.6, example: 2.3 },
  "Saut à la perche": { unit: "distance", min: 3.5, max: 6.8, example: 5.8 },
  "Lancer du poids": { unit: "distance", min: 12, max: 25, example: 21.5 },
  "Lancer du disque": { unit: "distance", min: 45, max: 80, example: 67 },
  "Lancer du marteau": { unit: "distance", min: 55, max: 90, example: 78 },
  Javelot: { unit: "distance", min: 45, max: 100, example: 85 },
  Heptathlon: { unit: "points", min: 4500, max: 7600, example: 6500 },
  Décathlon: { unit: "points", min: 6000, max: 9400, example: 8250 },
};

function rangeOf(
  unit: MarkUnit,
  family?: DisciplineFamily,
  discipline?: string,
): MarkRangeWithExample {
  const own = discipline ? BY_DISCIPLINE[discipline] : undefined;
  if (own && own.unit === unit) return own;
  const known = family ? BY_FAMILY[family] : undefined;
  return known && known.unit === unit ? known : BY_UNIT[unit];
}

/**
 * The plausible marks of a discipline: its own when the app knows it (11 to 19 m for the triple
 * jump), else those of its family (5 to 20 m for any horizontal jump), else those of its unit.
 */
export function markRange(
  unit: MarkUnit,
  family?: DisciplineFamily,
  discipline?: string,
): MarkRange {
  const { min, max } = rangeOf(unit, family, discipline);
  return { min, max };
}

/** A typical mark of the discipline, written like athletics: "10.85", "3:35.20", "1.95", "8250". */
export function markExample(
  unit: MarkUnit,
  family?: DisciplineFamily,
  discipline?: string,
): string {
  return formatMark(rangeOf(unit, family, discipline).example, unit);
}

/** True for a finite mark inside the range, bounds included. */
export function isInRange(value: number, range: MarkRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

export type MarkProblem = "bad_mark" | "out_of_range";

/** "4,02" or "4.02" read as minutes and seconds (4:02), the way a player writes a 1500 m. */
function asMinutes(text: string): number | null {
  const parts = /^\s*(\d{1,3})[.,]([0-5]\d)\s*$/.exec(text);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
}

/**
 * A typed mark read in the unit of its discipline: its value, or why it cannot be one. A time like
 * "4,02" reads as 4.02 s, or as 4:02 when only that is plausible (a 1500 m, #935).
 */
export function readMark(
  text: string,
  unit: MarkUnit,
  family?: DisciplineFamily,
  discipline?: string,
): number | MarkProblem {
  const value = parseMark(text, unit);
  if (value === null) return "bad_mark";
  const range = markRange(unit, family, discipline);
  if (isInRange(value, range)) return value;
  const minutes = unit === "time" ? asMinutes(text) : null;
  return minutes !== null && isInRange(minutes, range) ? minutes : "out_of_range";
}

/** How a mark of the range is written: ss.cc, m:ss.cc or h:mm:ss for a time, m.cc, points. */
export type MarkFormat = "seconds" | "minutes" | "hours" | "metres" | "points";

/** The way a player writes a mark of the range: a 100 m in seconds, a 1500 m in minutes. */
export function markFormat(unit: MarkUnit, range: MarkRange): MarkFormat {
  if (unit === "points") return "points";
  if (unit === "distance") return "metres";
  if (range.min < 60) return "seconds";
  return range.min < 3600 ? "minutes" : "hours";
}

/** Longest mark a player may type: "2:05:30.00", "8 125 pts", "17,92 m" all fit. */
export const MARK_MAX_LENGTH = 12;

/** The keyboard for a mark: digits only for points, a colon too for races written in minutes. */
export function markInputMode(
  unit: MarkUnit,
  family?: DisciplineFamily,
): "numeric" | "decimal" | "text" {
  if (unit === "points") return "numeric";
  if (unit === "distance") return "decimal";
  return family === "sprint" || family === "hurdles" ? "decimal" : "text";
}
