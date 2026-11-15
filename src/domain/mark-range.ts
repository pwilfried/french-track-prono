import { parseMark, type DisciplineFamily, type MarkUnit } from "./discipline";

/** The plausible marks of a discipline, bounds included, in its unit (seconds, metres, points). */
export type MarkRange = { min: number; max: number };

/**
 * Plausible marks per family, wide enough for every discipline of the family, from the indoor
 * 60 m to the 400 m, from the 800 m to the 1500 m, from the 3000 m to the marathon and the walks.
 * Mirrored by `mark_range` in the database (supabase/migrations/20261114030000_mark_range.sql):
 * change both together.
 */
const BY_FAMILY: Record<DisciplineFamily, MarkRange & { unit: MarkUnit }> = {
  sprint: { unit: "time", min: 5, max: 90 },
  hurdles: { unit: "time", min: 6, max: 90 },
  relay: { unit: "time", min: 30, max: 300 },
  middle: { unit: "time", min: 90, max: 900 },
  long: { unit: "time", min: 300, max: 21600 },
  horizontal_jumps: { unit: "distance", min: 5, max: 20 },
  vertical_jumps: { unit: "distance", min: 1, max: 7 },
  throws: { unit: "distance", min: 5, max: 110 },
  combined: { unit: "points", min: 1000, max: 10000 },
};

/** For a discipline whose unit is not the usual one of its family: the widest marks of the unit. */
const BY_UNIT: Record<MarkUnit, MarkRange> = {
  time: { min: 5, max: 21600 },
  distance: { min: 1, max: 110 },
  points: { min: 1000, max: 10000 },
};

/**
 * Plausible marks of the known disciplines (#935): about their world records (men and women
 * alike) with a margin below, and the slowest or shortest mark of a championship final above.
 * Mirrored by `discipline_mark_range` in the database
 * (supabase/migrations/20261115100000_discipline_mark_range.sql): change both together.
 */
const BY_DISCIPLINE: Record<string, MarkRange & { unit: MarkUnit }> = {
  "100 m": { unit: "time", min: 9, max: 14 },
  "200 m": { unit: "time", min: 18.5, max: 28 },
  "400 m": { unit: "time", min: 42, max: 65 },
  "100 m haies": { unit: "time", min: 11.5, max: 17 },
  "110 m haies": { unit: "time", min: 12.5, max: 18 },
  "400 m haies": { unit: "time", min: 44, max: 70 },
  "800 m": { unit: "time", min: 95, max: 160 },
  "1500 m": { unit: "time", min: 200, max: 330 },
  "3000 m steeple": { unit: "time", min: 450, max: 720 },
  "5000 m": { unit: "time", min: 720, max: 1200 },
  "10 000 m": { unit: "time", min: 1500, max: 2400 },
  Marathon: { unit: "time", min: 6900, max: 12600 },
  "Relais 4x100 m": { unit: "time", min: 35, max: 50 },
  "Relais 4x400 m": { unit: "time", min: 170, max: 240 },
  "Relais mixte 4x100 m": { unit: "time", min: 38, max: 52 },
  "Relais mixte 4x400 m": { unit: "time", min: 175, max: 250 },
  "Saut en longueur": { unit: "distance", min: 5, max: 9.5 },
  "Triple saut": { unit: "distance", min: 11, max: 19 },
  "Saut en hauteur": { unit: "distance", min: 1.5, max: 2.6 },
  "Saut à la perche": { unit: "distance", min: 3.5, max: 6.8 },
  "Lancer du poids": { unit: "distance", min: 12, max: 25 },
  "Lancer du disque": { unit: "distance", min: 45, max: 80 },
  "Lancer du marteau": { unit: "distance", min: 55, max: 90 },
  Javelot: { unit: "distance", min: 45, max: 100 },
  Heptathlon: { unit: "points", min: 4500, max: 7600 },
  Décathlon: { unit: "points", min: 6000, max: 9400 },
};

/**
 * The plausible marks of a discipline: its own when the app knows it (11 to 19 m for the triple
 * jump), else those of its family (5 to 20 m for any horizontal jump), else those of its unit.
 */
export function markRange(
  unit: MarkUnit,
  family?: DisciplineFamily,
  discipline?: string,
): MarkRange {
  const own = discipline ? BY_DISCIPLINE[discipline] : undefined;
  if (own && own.unit === unit) return { min: own.min, max: own.max };
  const known = family ? BY_FAMILY[family] : undefined;
  return known && known.unit === unit ? { min: known.min, max: known.max } : BY_UNIT[unit];
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
