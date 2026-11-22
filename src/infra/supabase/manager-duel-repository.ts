import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerDuelRepository } from "@/application/manager-duel";
import type { ManagerJokerEffect } from "@/domain/manager-jokers";

import { athleteScoreOf, type AthleteScoreRow } from "./manager-score-row";

type LineupsJson = { locked: boolean; lineups: { user_id: string; athlete_ids: string[] }[] };
type ScoreRow = {
  user_id: string;
  total: number;
  athletes: AthleteScoreRow[];
  joker_effects: {
    kind: ManagerJokerEffect["kind"];
    by: ManagerJokerEffect["by"];
    athlete_id: string | null;
    points: number;
  }[];
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
        .select("user_id, total, athletes, joker_effects")
        .eq("league_id", leagueId)
        .eq("competition_id", competitionId)
        .order("user_id");
      if (error) throw new UseCaseError("MANAGER_SEASON_UNAVAILABLE");
      return ((data ?? []) as ScoreRow[]).map((s) => ({
        userId: s.user_id,
        total: s.total,
        athletes: s.athletes.map(athleteScoreOf),
        jokerEffects: (s.joker_effects ?? []).map((e) => ({
          kind: e.kind,
          by: e.by,
          athleteId: e.athlete_id,
          points: e.points,
        })),
      }));
    },
  };
}
