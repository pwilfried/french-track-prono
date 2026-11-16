import { parseMark, type MarkUnit } from "./discipline";
import {
  managerBonusesEarned,
  managerBonusPoints,
  type ManagerBonusResult,
  type ManagerRecord,
} from "./manager-bonus";
import type { ManagerBonus, ManagerSex } from "./manager-rules";
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

export type ManagerScoreInput = {
  /** The validated lineup of the participant at the lock; null without one. */
  lineup: string[] | null;
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

const nothing = (athleteId: string): AthleteScore => ({
  athleteId,
  discipline: null,
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

/**
 * Score of a competition = for every lined-up athlete, their World Athletics points divided by the
 * league's divisor (rounded down) + their sporting bonuses; the predictions do not count (#1031,
 * docs/decisions/french-track-manager.md, §4). Without a lineup, 0 for the whole competition. An athlete who took part in several events
 * (heats and final, two disciplines) brings their best line only; the place bonuses come from a
 * final.
 */
export function managerCompetitionScore(input: ManagerScoreInput): ManagerCompetitionScore {
  if (input.lineup === null) {
    return { linedUp: false, total: 0, hungarian: 0, bonus: 0, athletes: [] };
  }
  const lineup = input.lineup;
  const best = new Map<string, AthleteScore>();
  for (const p of input.performances) {
    if (!lineup.includes(p.athleteId)) continue;
    const line = scorePerformance(p, input.bonuses, input.tablesDivisor);
    const kept = best.get(p.athleteId);
    best.set(p.athleteId, kept ? better(kept, line) : line);
  }
  const athletes = lineup
    .map((id) => best.get(id) ?? nothing(id))
    .sort((a, b) => b.total - a.total || lineup.indexOf(a.athleteId) - lineup.indexOf(b.athleteId));
  const hungarian = athletes.reduce((sum, a) => sum + a.points, 0);
  const bonus = athletes.reduce((sum, a) => sum + a.bonusPoints, 0);
  return { linedUp: true, total: hungarian + bonus, hungarian, bonus, athletes };
}
