import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { PredictionLeagueRepository } from "@/application/prediction-leagues";

/**
 * The client must carry the player's session: row level security only lets them add or remove
 * their own prediction, before the lock, in a league of theirs counting the competition (#1068).
 */
export function createSupabasePredictionLeagueRepository(
  client: SupabaseClient,
): PredictionLeagueRepository {
  return {
    async leaguesOf(userId, eventId) {
      const { data, error } = await client
        .from("league_predictions")
        .select("league_id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .returns<{ league_id: string }[]>();
      if (error) throw new UseCaseError("LEAGUES_UNAVAILABLE");
      return data.map((row) => row.league_id).sort();
    },

    async set(eventId, leagueIds) {
      const { error } = await client.rpc("set_prediction_leagues", {
        p_event: eventId,
        p_leagues: leagueIds,
      });
      if (!error) return "done";
      if (error.code === "FT043") return "locked";
      // 42501: refused by row level security; 23503: not a member, or no prediction.
      if (error.code === "42501" || error.code === "23503" || error.code === "22P02") {
        return "refused";
      }
      throw new UseCaseError("LEAGUES_UNAVAILABLE");
    },
  };
}
