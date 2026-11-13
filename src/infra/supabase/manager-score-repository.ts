import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerScoreRepository, StoredManagerScore } from "@/application/manager-scores";
import type { MarkUnit } from "@/domain/discipline";
import { MANAGER_BONUSES, type ManagerBonus } from "@/domain/manager-rules";
import type { AthleteScore, CompetitionPerformance } from "@/domain/manager-score";
import type { PerformanceStatus, RecordFlag } from "@/domain/performance";

type SheetRow = {
  competition_id: string;
  lock_at: string;
  participants: {
    league_id: string;
    user_id: string;
    bonuses: Partial<Record<ManagerBonus, number>>;
    lineup: string[] | null;
  }[];
  performances: {
    athlete_id: string;
    discipline: string;
    gender: string;
    unit: MarkUnit;
    round: string;
    status: PerformanceStatus;
    place: number | null;
    mark: string | null;
    records: RecordFlag[];
  }[];
  predictions: Record<string, number>;
};

type AthleteRow = {
  athlete_id: string;
  discipline: string | null;
  mark: string | null;
  status: PerformanceStatus | null;
  points: number;
  bonuses: { bonus: ManagerBonus; points: number }[];
  bonus_points: number;
  total: number;
};

type ScoreRow = {
  lined_up: boolean;
  total: number;
  hungarian: number;
  bonus: number;
  predictions: number;
  athletes: (AthleteRow & { name: string })[];
};

/** A league created before a bonus existed scores 0 for it. */
const bonusValues = (stored: Partial<Record<ManagerBonus, number>>) =>
  Object.fromEntries(MANAGER_BONUSES.map((b) => [b, Number(stored[b] ?? 0)])) as Record<
    ManagerBonus,
    number
  >;

const athleteRow = (a: AthleteScore): AthleteRow => ({
  athlete_id: a.athleteId,
  discipline: a.discipline,
  mark: a.mark,
  status: a.status,
  points: a.points,
  bonuses: a.bonuses,
  bonus_points: a.bonusPoints,
  total: a.total,
});

/** The admin reads the sheet and writes the scores with their own session; a participant reads theirs. */
export function createSupabaseManagerScoreRepository(
  client: SupabaseClient,
): ManagerScoreRepository {
  return {
    async sheet(competitionSlug) {
      const { data, error } = await client.rpc("admin_manager_scoring_sheet", {
        p_competition: competitionSlug,
      });
      if (error?.code === "42501") return "not_admin";
      if (error) throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
      const sheet = data as SheetRow | null;
      if (!sheet) return null;
      return {
        competitionId: sheet.competition_id,
        lockAt: sheet.lock_at,
        participants: sheet.participants.map((p) => ({
          leagueId: p.league_id,
          userId: p.user_id,
          bonuses: bonusValues(p.bonuses),
          lineup: p.lineup,
        })),
        performances: sheet.performances.map(
          (p): CompetitionPerformance => ({
            athleteId: p.athlete_id,
            discipline: p.discipline,
            sex: p.gender === "F" || p.gender === "M" ? p.gender : null,
            unit: p.unit,
            round: p.round,
            status: p.status,
            place: p.place,
            mark: p.mark,
            records: p.records,
          }),
        ),
        predictionPoints: sheet.predictions,
      };
    },

    async replace(competitionId, lines) {
      const { error } = await client.rpc("admin_set_manager_scores", {
        p_competition: competitionId,
        p_lines: lines.map((l) => ({
          league_id: l.leagueId,
          user_id: l.userId,
          lined_up: l.linedUp,
          total: l.total,
          hungarian: l.hungarian,
          bonus: l.bonus,
          predictions: l.predictions,
          athletes: l.athletes.map(athleteRow),
        })),
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
    },

    async mine(leagueId, competitionId) {
      const { data, error } = await client.rpc("my_manager_score", {
        p_league: leagueId,
        p_competition: competitionId,
      });
      if (error?.code === "42501") return "not_member";
      if (error) throw new UseCaseError("MANAGER_SCORES_UNAVAILABLE");
      const row = ((data ?? []) as ScoreRow[])[0];
      if (!row) return null;
      return {
        linedUp: row.lined_up,
        total: row.total,
        hungarian: row.hungarian,
        bonus: row.bonus,
        predictions: row.predictions,
        athletes: row.athletes.map(
          (a): StoredManagerScore["athletes"][number] => ({
            athleteId: a.athlete_id,
            name: a.name,
            discipline: a.discipline,
            mark: a.mark,
            status: a.status,
            points: a.points,
            bonuses: a.bonuses,
            bonusPoints: a.bonus_points,
            total: a.total,
          }),
        ),
      };
    },
  };
}
