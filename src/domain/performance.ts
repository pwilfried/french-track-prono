import { parseMark, tidyMark, type DisciplineFamily, type MarkUnit } from "./discipline";
import { readMark } from "./mark-range";

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
    // A placed finisher may have no mark: the podium alone is enough (#665); it then scores 0.
    if (line.mark === null || line.mark.trim() === "") {
      if (line.place === null) return "mark_missing";
    } else if (parseMark(line.mark, unit) === null) return "bad_mark";
  }
  return null;
}

/**
 * The athletes whose mark reads but is not a plausible mark of the discipline (#702): the admin is
 * warned and may confirm it, a world record stays possible.
 */
export function outOfRangeMarks(
  lines: Performance[],
  unit: MarkUnit,
  family?: DisciplineFamily,
): string[] {
  return lines
    .filter((l) => l.status === "ok" && l.mark && readMark(l.mark, unit, family) === "out_of_range")
    .map((l) => l.athleteId);
}

/** The lined-up athletes who have no line yet, in the order given: what the admin still has to enter. */
export function missingPerformances(linedUp: string[], lines: Performance[]): string[] {
  const entered = new Set(lines.map((l) => l.athleteId));
  return linedUp.filter((id) => !entered.has(id));
}

/** A line of the official podium of the predictions, as stored in `results`. */
export type PodiumLine = { athleteId: string; rank: number; mark: string | null };

/**
 * The official podium of the predictions, drawn from the results sheet (#665): the finishers placed
 * 1 to 3, tied athletes sharing their step, best place first. Same rule as admin_set_performances.
 */
export function podiumFromPerformances(lines: Performance[]): PodiumLine[] {
  return lines
    .flatMap((l) =>
      l.status === "ok" && l.place !== null && l.place <= 3
        ? [{ athleteId: l.athleteId, rank: l.place, mark: l.mark }]
        : [],
    )
    .sort((a, b) => a.rank - b.rank || a.athleteId.localeCompare(b.athleteId));
}
