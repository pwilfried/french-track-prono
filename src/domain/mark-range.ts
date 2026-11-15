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

function rangeOf(unit: MarkUnit, family?: DisciplineFamily): MarkRangeWithExample {
  const known = family ? BY_FAMILY[family] : undefined;
  return known && known.unit === unit ? known : BY_UNIT[unit];
}

/** The plausible marks of a discipline, from its family (and unit), e.g. 5 to 20 m for the triple jump. */
export function markRange(unit: MarkUnit, family?: DisciplineFamily): MarkRange {
  const { min, max } = rangeOf(unit, family);
  return { min, max };
}

/** A typical mark of the discipline, written like athletics: "10.85", "4:01.20", "1.95", "8250". */
export function markExample(unit: MarkUnit, family?: DisciplineFamily): string {
  return formatMark(rangeOf(unit, family).example, unit);
}

/** True for a finite mark inside the range, bounds included. */
export function isInRange(value: number, range: MarkRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

export type MarkProblem = "bad_mark" | "out_of_range";

/** A typed mark read in the unit of its discipline: its value, or why it cannot be one. */
export function readMark(
  text: string,
  unit: MarkUnit,
  family?: DisciplineFamily,
): number | MarkProblem {
  const value = parseMark(text, unit);
  if (value === null) return "bad_mark";
  return isInRange(value, markRange(unit, family)) ? value : "out_of_range";
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
