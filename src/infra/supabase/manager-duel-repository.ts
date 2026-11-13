import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerDuelRepository } from "@/application/manager-duel";

type LineupsJson = { locked: boolean; lineups: { user_id: string; athlete_ids: string[] }[] };
type ScoreRow = {
  user_id: string;
  total: number;
  predictions: number;
  athletes: { athlete_id: string; total: number; bonus_points: number }[];
};

/**
 * The lineups come from manager_duel_lineups (secret until the lock); the participants read the
 * scores of their leagues directly, row level security keeping out everyone else.
 */
export function createSupabaseManagerDuelRepository(client: SupabaseClient): ManagerDuelRepository {
  return {
    async lineups(leagueId, competitionId) {
      const { data, error } = await client.rpc("manager_duel_lineups", {
        p_league: leagueId,
        p_competition: competitionId,
      });
      if (error?.code === "42501") return "not_member";
      if (error) throw new UseCaseError("MANAGER_SEASON_UNAVAILABLE");
      const json = data as LineupsJson;
      return {
        locked: json.locked,
        lineups: json.lineups.map((l) => ({ userId: l.user_id, athleteIds: l.athlete_ids })),
      };
    },
    async scores(leagueId, competitionId) {
      // One line per participant of the league: one page is enough.
      const { data, error } = await client
        .from("manager_scores")
        .select("user_id, total, predictions, athletes")
        .eq("league_id", leagueId)
        .eq("competition_id", competitionId)
        .order("user_id");
      if (error) throw new UseCaseError("MANAGER_SEASON_UNAVAILABLE");
      return ((data ?? []) as ScoreRow[]).map((s) => ({
        userId: s.user_id,
        total: s.total,
        predictions: s.predictions,
        athletes: s.athletes.map((a) => ({
          athleteId: a.athlete_id,
          total: a.total,
          bonusPoints: a.bonus_points,
        })),
      }));
    },
  };
}
