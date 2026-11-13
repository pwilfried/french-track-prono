import { parseMark, tidyMark, type MarkUnit } from "./discipline";

/** How an athlete's race ended: a mark, or did not start, did not finish, disqualified. */
export type PerformanceStatus = "ok" | "dns" | "dnf" | "dq";

/** Personal best, season best, national, continental (area) and world record. */
export type RecordFlag = "pb" | "sb" | "nr" | "ar" | "wr";

export const PERFORMANCE_STATUSES: PerformanceStatus[] = ["ok", "dns", "dnf", "dq"];
export const RECORD_FLAGS: RecordFlag[] = ["pb", "sb", "nr", "ar", "wr"];

/**
 * The performance of one athlete in an event, as the admin enters it for French Track Manager
 * (#429): place, mark and records. Only a finisher (`ok`) has them; DNS, DNF and DQ score 0 (#416).
 */
export type Performance = {
  athleteId: string;
  status: PerformanceStatus;
  /** Place in the event; tied athletes share it. Optional: the mark is what scores. */
  place: number | null;
  mark: string | null;
  records: RecordFlag[];
};

export type PerformanceProblem =
  "twice" | "bad_place" | "mark_missing" | "bad_mark" | "not_finished";

/**
 * The lines as the admin typed them, tidied: marks written like athletics writes them, nothing
 * but the status for an athlete who did not finish, each record once.
 */
export function tidyPerformances(lines: Performance[], unit: MarkUnit): Performance[] {
  return lines.map((line) => {
    if (line.status !== "ok") return { ...line, place: null, mark: null, records: [] };
    const mark = line.mark?.trim() ? tidyMark(line.mark.trim(), unit) : null;
    const records = RECORD_FLAGS.filter((flag) => line.records.includes(flag));
    return { ...line, mark, records };
  });
}

/** Why these lines are not the performances of an event, or null when they are. */
export function performanceProblem(
  lines: Performance[],
  unit: MarkUnit,
): PerformanceProblem | null {
  if (new Set(lines.map((l) => l.athleteId)).size !== lines.length) return "twice";
  for (const line of lines) {
    if (line.status !== "ok") {
      if (line.place !== null || line.mark !== null || line.records.length > 0) {
        return "not_finished";
      }
      continue;
    }
    if (line.place !== null && !(Number.isInteger(line.place) && line.place >= 1)) {
      return "bad_place";
    }
    if (line.mark === null || line.mark.trim() === "") return "mark_missing";
    if (parseMark(line.mark, unit) === null) return "bad_mark";
  }
  return null;
}

/** The lined-up athletes who have no line yet, in the order given: what the admin still has to enter. */
export function missingPerformances(linedUp: string[], lines: Performance[]): string[] {
  const entered = new Set(lines.map((l) => l.athleteId));
  return linedUp.filter((id) => !entered.has(id));
}
