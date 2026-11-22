import type { MarkUnit } from "@/domain/discipline";
import type { ManagerBonus } from "@/domain/manager-rules";
import type { AthleteScore, SubstitutionReason } from "@/domain/manager-score";
import type { PerformanceStatus } from "@/domain/performance";

/**
 * One athlete of `manager_scores.athletes`, as stored. The fields added later (#1033, #1036) are
 * absent from the rows stored before, and some e2e fixtures only write the totals.
 */
export type AthleteScoreRow = {
  athlete_id: string;
  discipline?: string | null;
  mark?: string | null;
  status?: PerformanceStatus | null;
  table_points?: number;
  points?: number;
  bonuses?: { bonus: ManagerBonus; points: number }[];
  bonus_points?: number;
  total: number;
  substitution?: {
    starter_id: string;
    reason: SubstitutionReason;
    starter?: {
      mark: string | null;
      status: PerformanceStatus | null;
      total: number;
      threshold: { mark: string; unit: MarkUnit } | null;
    };
  };
};

export const athleteScoreRow = (a: AthleteScore): AthleteScoreRow => ({
  athlete_id: a.athleteId,
  discipline: a.discipline,
  mark: a.mark,
  status: a.status,
  ...(a.tablePoints !== undefined && { table_points: a.tablePoints }),
  points: a.points,
  bonuses: a.bonuses,
  bonus_points: a.bonusPoints,
  total: a.total,
  ...(a.substitution && {
    substitution: {
      starter_id: a.substitution.starterId,
      reason: a.substitution.reason,
      ...(a.substitution.starter && { starter: a.substitution.starter }),
    },
  }),
});

export const athleteScoreOf = (a: AthleteScoreRow): AthleteScore => ({
  athleteId: a.athlete_id,
  discipline: a.discipline ?? null,
  mark: a.mark ?? null,
  status: a.status ?? null,
  ...(a.table_points !== undefined && { tablePoints: a.table_points }),
  points: a.points ?? a.total - (a.bonus_points ?? 0),
  bonuses: a.bonuses ?? [],
  bonusPoints: a.bonus_points ?? 0,
  total: a.total,
  ...(a.substitution && {
    substitution: {
      starterId: a.substitution.starter_id,
      reason: a.substitution.reason,
      ...(a.substitution.starter && { starter: a.substitution.starter }),
    },
  }),
});
