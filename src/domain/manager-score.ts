import { parseMark, type MarkUnit } from "./discipline";
import {
  managerBonusesEarned,
  managerBonusPoints,
  type ManagerBonusResult,
  type ManagerRecord,
} from "./manager-bonus";
import type { ManagerBonus, ManagerFamily, ManagerSex } from "./manager-rules";
import type { Performance, PerformanceStatus, RecordFlag } from "./performance";
import { worldAthleticsPoints } from "./world-athletics-points";

/** A performance entered by the admin (#429), with what the tables need to score it. */
export type CompetitionPerformance = Performance & {
  discipline: string;
  /** The sex of the event; null for a mixed event, which the tables do not cover. */
  sex: ManagerSex | null;
  unit: MarkUnit;
  /** series, quarter, semi or final: the place bonuses are for a final only. */
  round: string;
};

/**
 * A starter of the match sheet at the lock (#1032): the discipline that counts, the Manager family
 * of their place, their designated substitute and tactical threshold (a mark in the unit of the
 * discipline: seconds, metres or points), both optional.
 */
export type ScoringStarter = {
  athleteId: string;
  family: ManagerFamily;
  discipline: string;
  substituteId: string | null;
  threshold: number | null;
};
export type ScoringSubstitute = { athleteId: string; family: ManagerFamily; discipline: string };

/** Starters in place order, substitutes in the order they come in; the reserve never plays. */
export type ScoringLineup = { starters: ScoringStarter[]; bench: ScoringSubstitute[] };

/**
 * Why a substitute counts for a place (#1033): `tactical`, the starter did worse than their
 * threshold; `forfeit`, the starter has no mark and their designated substitute has one; `bench`,
 * neither has one and the first substitute of the family on the bench comes in.
 */
export type SubstitutionReason = "tactical" | "forfeit" | "bench";

export type ManagerScoreInput = {
  /** The validated match sheet of the participant at the lock; null without one. */
  lineup: ScoringLineup | null;
  /** Every performance of the competition; those of athletes not lined up are ignored. */
  performances: CompetitionPerformance[];
  /** The table points of an athlete are divided by it, rounded down (the league rules). */
  tablesDivisor: number;
  /** The bonus values frozen in the league rules. */
  bonuses: Record<ManagerBonus, number>;
};

/** What one lined-up athlete brought: table points (divided), bonuses, both added. */
export type AthleteScore = {
  athleteId: string;
  /** The discipline, mark and status of the performance kept; null without any performance. */
  discipline: string | null;
  mark: string | null;
  status: PerformanceStatus | null;
  /** The World Athletics points divided by the league's divisor, rounded down. */
  points: number;
  /** The bonuses earned with their value in the league, place first then records. */
  bonuses: { bonus: ManagerBonus; points: number }[];
  bonusPoints: number;
  total: number;
  /** When a substitute counts for the place: whose place, and why. Absent when the starter counts. */
  substitution?: { starterId: string; reason: SubstitutionReason };
};

/** The Manager score of a participant for a competition, with its detail (#431). */
export type ManagerCompetitionScore = {
  linedUp: boolean;
  total: number;
  /** World Athletics tables (« barème hongrois »), divided athlete by athlete. */
  hungarian: number;
  bonus: number;
  /** From the strongest to the weakest. */
  athletes: AthleteScore[];
};

const RECORD_BONUSES: Record<RecordFlag, ManagerRecord> = {
  pb: "personal_best",
  sb: "season_best",
  nr: "national_record",
  ar: "area_record",
  wr: "world_record",
};

const nothing = (athleteId: string, discipline: string): AthleteScore => ({
  athleteId,
  discipline,
  mark: null,
  status: null,
  points: 0,
  bonuses: [],
  bonusPoints: 0,
  total: 0,
});

/**
 * What the table points of one athlete are worth in the Manager: divided by the league's divisor,
 * rounded down athlete by athlete (#1031): 1 109 points of the tables are worth 110 with 10.
 */
export function managerTablePoints(tablePoints: number, divisor: number): number {
  return Math.floor(tablePoints / divisor);
}

/** DNS, DNF, DQ, a mark that cannot be read or a discipline without a table: 0 point (#416). */
function tablePoints(p: CompetitionPerformance): number {
  if (p.status !== "ok" || p.mark === null || p.sex === null) return 0;
  const mark = parseMark(p.mark, p.unit);
  if (mark === null) return 0;
  return worldAthleticsPoints(p.discipline, p.sex, mark) ?? 0;
}

function scorePerformance(
  p: CompetitionPerformance,
  values: Record<ManagerBonus, number>,
  divisor: number,
): AthleteScore {
  // DNS, DNF and DQ earn no bonus (#416); the place bonuses come from a final only.
  const result: ManagerBonusResult =
    p.status === "ok"
      ? {
          place: p.round === "final" ? p.place : null,
          records: p.records.map((r) => RECORD_BONUSES[r]),
        }
      : { place: null, records: [] };
  const bonuses = managerBonusesEarned(result).map((bonus) => ({ bonus, points: values[bonus] }));
  const points = managerTablePoints(tablePoints(p), divisor);
  const bonusPoints = managerBonusPoints(result, values);
  return {
    athleteId: p.athleteId,
    discipline: p.discipline,
    mark: p.mark,
    status: p.status,
    points,
    bonuses,
    bonusPoints,
    total: points + bonusPoints,
  };
}

/** The better of two lines of the same athlete, whatever order they come in. */
function better(a: AthleteScore, b: AthleteScore): AthleteScore {
  if (a.total !== b.total) return a.total > b.total ? a : b;
  if (a.points !== b.points) return a.points > b.points ? a : b;
  const keyA = `${a.discipline}|${a.mark}|${a.status}`;
  const keyB = `${b.discipline}|${b.mark}|${b.status}`;
  return keyA <= keyB ? a : b;
}

/** The line an athlete brings in a discipline, with their mark read, or null without a mark. */
type Line = { score: AthleteScore; mark: number | null; unit: MarkUnit };

/** Whether a mark is worse than the threshold: slower for a race, shorter or lower otherwise. */
function worseThan(mark: number, threshold: number, unit: MarkUnit): boolean {
  return unit === "time" ? mark > threshold : mark < threshold;
}

/**
 * Score of a competition = for every place of the match sheet, the World Athletics points of the
 * athlete who counts for it divided by the league's divisor (rounded down) + their sporting
 * bonuses; the predictions do not count (#1031, docs/decisions/french-track-manager.md, §3 and 4).
 * Without a lineup, 0 for the whole competition. Only the discipline chosen for an athlete counts;
 * in it, their best round (heats and final), without adding them; the place bonuses come from a
 * final. The places are taken in order (#1033):
 * - a starter with a mark worse than their threshold gives way to their designated substitute,
 *   whose line counts even if worse, provided the substitute has a mark;
 * - a starter without a mark (DNS, DNF, DQ, none entered) gives way to their designated substitute
 *   if they have one, else to the first substitute of the bench of the same family with one;
 *   otherwise the place scores 0.
 * A substitute comes in once at most.
 */
export function managerCompetitionScore(input: ManagerScoreInput): ManagerCompetitionScore {
  if (input.lineup === null) {
    return { linedUp: false, total: 0, hungarian: 0, bonus: 0, athletes: [] };
  }
  const { starters, bench } = input.lineup;
  const lines = new Map<string, Line>();
  for (const p of input.performances) {
    const chosen =
      starters.find((s) => s.athleteId === p.athleteId) ??
      bench.find((s) => s.athleteId === p.athleteId);
    if (chosen?.discipline !== p.discipline) continue;
    const score = scorePerformance(p, input.bonuses, input.tablesDivisor);
    const kept = lines.get(p.athleteId);
    if (kept && better(kept.score, score) === kept.score) continue;
    const mark = p.status === "ok" && p.mark !== null ? parseMark(p.mark, p.unit) : null;
    lines.set(p.athleteId, { score, mark, unit: p.unit });
  }
  const hasMark = (id: string) => (lines.get(id)?.mark ?? null) !== null;

  const entered = new Set<string>();
  const counted = starters.map((s, place) => {
    const own = lines.get(s.athleteId);
    const designated = bench.some((b) => b.athleteId === s.substituteId) ? s.substituteId : null;
    const free = (id: string | null): id is string =>
      id !== null && !entered.has(id) && hasMark(id);
    let substitute: { id: string; reason: SubstitutionReason } | null = null;
    if (own && own.mark !== null) {
      const tooBad = s.threshold !== null && worseThan(own.mark, s.threshold, own.unit);
      if (tooBad && free(designated)) {
        substitute = { id: designated, reason: "tactical" };
      }
    } else if (free(designated)) {
      substitute = { id: designated, reason: "forfeit" };
    } else {
      const next = bench.find((b) => b.family === s.family && free(b.athleteId));
      if (next) substitute = { id: next.athleteId, reason: "bench" };
    }
    if (!substitute) return { place, score: own?.score ?? nothing(s.athleteId, s.discipline) };
    entered.add(substitute.id);
    const score: AthleteScore = {
      ...lines.get(substitute.id)!.score,
      substitution: { starterId: s.athleteId, reason: substitute.reason },
    };
    return { place, score };
  });

  const athletes = counted
    .sort((a, b) => b.score.total - a.score.total || a.place - b.place)
    .map((c) => c.score);
  const hungarian = athletes.reduce((sum, a) => sum + a.points, 0);
  const bonus = athletes.reduce((sum, a) => sum + a.bonusPoints, 0);
  return { linedUp: true, total: hungarian + bonus, hungarian, bonus, athletes };
}
