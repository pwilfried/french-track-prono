/** How a discipline measures a performance. */
export type MarkUnit = "time" | "distance" | "points";

export type DisciplineFamily =
  | "sprint"
  | "hurdles"
  | "middle"
  | "long"
  | "horizontal_jumps"
  | "vertical_jumps"
  | "throws"
  | "combined"
  | "relay";

/** A discipline: how its marks read, which way is better, and the prediction tolerance. */
export type Discipline = {
  name: string;
  family: DisciplineFamily;
  unit: MarkUnit;
  /** Races: a lower time wins. Jumps, throws, combined events: a higher value wins. */
  lowerIsBetter: boolean;
  /** Largest gap (seconds, metres or points) for a predicted mark to count as right. */
  tolerance: number;
};

/**
 * A mark typed as text, as a number in the unit of the discipline: "10.62", "1:56.70", "2:05:30"
 * (seconds); "2.04", "8,12 m", "2m34" (metres); "8125", "8 125 pts" (points). Null otherwise.
 */
export function parseMark(text: string, unit: MarkUnit): number | null {
  const mark = text
    .toLowerCase()
    .replace(/\(.*\)/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (unit === "time") {
    const parts = mark.split(":");
    if (
      parts.length > 3 ||
      !parts.every(
        (p, i) => /^\d+(\.\d+)?$/.test(p) && (i === parts.length - 1 || !p.includes(".")),
      )
    ) {
      return null;
    }
    return parts.reduce((total, part) => total * 60 + Number(part), 0);
  }
  if (unit === "distance") {
    const metres = /^(\d+)m(\d{1,2})$/.exec(mark);
    if (metres) return Number(`${metres[1]}.${metres[2]}`);
    const plain = mark.replace(/m$/, "");
    return /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : null;
  }
  const points = mark.replace(/(pts|points)$/, "");
  return /^\d+$/.test(points) ? Number(points) : null;
}

const two = (n: number) => n.toFixed(2);
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** A number in the unit of the discipline, written the way athletics writes it. */
export function formatMark(value: number, unit: MarkUnit): string {
  if (unit === "points") return String(Math.round(value));
  if (unit === "distance") return two(value);
  if (value < 60) return two(value);
  const seconds = value % 60;
  const minutes = Math.floor(value / 60) % 60;
  const hours = Math.floor(value / 3600);
  const sec = seconds < 10 ? `0${two(seconds)}` : two(seconds);
  return hours > 0 ? `${hours}:${pad(minutes)}:${sec}` : `${minutes}:${sec}`;
}

/** True when a predicted mark is at most `tolerance` away from the official one. */
export function withinTolerance(predicted: number, official: number, tolerance: number): boolean {
  // Rounded to the hundredth, so 10.81 vs 10.76 with 0.05 counts despite floating point.
  return Math.round(Math.abs(predicted - official) * 100) <= Math.round(tolerance * 100);
}

/** A tolerance the admin can set: a positive number. */
export function isValidTolerance(tolerance: number): boolean {
  return Number.isFinite(tolerance) && tolerance > 0;
}
