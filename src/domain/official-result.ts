import type { OfficialLine } from "./scoring";

/**
 * An official podium as the admin types it: at least three athletes, all different, ranks 1 to 3
 * with standard competition ranking (tied athletes share a rank and the next rank is skipped:
 * 1-1-3, 1-2-2, 1-1-1 are valid, 1-2-2-3 or 2-3-4 are not).
 */
export function isValidOfficialPodium(lines: OfficialLine[]): boolean {
  if (lines.length < 3) return false;
  if (new Set(lines.map((l) => l.athleteId)).size !== lines.length) return false;
  if (lines.some((l) => !l.athleteId)) return false;
  return lines.every(
    (line) =>
      Number.isInteger(line.rank) &&
      line.rank >= 1 &&
      line.rank <= 3 &&
      lines.filter((other) => other.rank < line.rank).length === line.rank - 1,
  );
}

/**
 * The podium ranks nobody fills yet. A rank skipped because of a tie is not missing: with two
 * athletes tied first, rank 2 is skipped and only rank 3 can be missing.
 */
export function missingPodiumRanks(lines: OfficialLine[]): number[] {
  return [1, 2, 3].filter((rank) => lines.filter((line) => line.rank <= rank).length < rank);
}
