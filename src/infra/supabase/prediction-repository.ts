import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { Prediction, PredictionRepository } from "@/application/save-prediction";

type Row = { user_id: string; event_id: string; p1: string; p2: string; p3: string; use_joker: boolean };

function toPrediction(row: Row): Prediction {
  return {
    userId: row.user_id,
    eventId: row.event_id,
    podium: { first: row.p1, second: row.p2, third: row.p3 },
    useJoker: row.use_joker,
  };
}

/** The client must carry the player's session: row level security decides who can write what. */
export function createSupabasePredictionRepository(client: SupabaseClient): PredictionRepository {
  return {
    async find(userId, eventId) {
      const { data, error } = await client
        .from("predictions")
        .select("user_id, event_id, p1, p2, p3, use_joker")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle<Row>();
      if (error) throw new UseCaseError("PREDICTION_UNAVAILABLE");
      return data ? toPrediction(data) : null;
    },

    async listForCompetition(userId, competitionSlug) {
      const { data, error } = await client
        .from("predictions")
        .select("user_id, event_id, p1, p2, p3, use_joker, events!inner(competitions!inner(slug))")
        .eq("user_id", userId)
        .eq("events.competitions.slug", competitionSlug)
        .returns<Row[]>();
      if (error) throw new UseCaseError("PREDICTION_UNAVAILABLE");
      return data.map(toPrediction);
    },

    async save(prediction) {
      const { error } = await client.from("predictions").upsert(
        {
          user_id: prediction.userId,
          event_id: prediction.eventId,
          p1: prediction.podium.first,
          p2: prediction.podium.second,
          p3: prediction.podium.third,
          use_joker: prediction.useJoker,
        },
        { onConflict: "user_id,event_id" },
      );
      if (!error) return "saved";

      const where = `${error.message} ${error.details ?? ""}`;
      // P0001: raised by the lock trigger.
      if (error.code === "P0001") return "locked";
      // 23503: a foreign key to `entries` (event, athlete) failed.
      if (error.code === "23503" && where.includes("entries")) return "athlete_not_in_event";
      // 23505: the unique index of the single joker.
      if (error.code === "23505" && where.includes("one_joker_per_competition")) return "joker_already_used";
      if (error.code === "23514") throw new UseCaseError("PODIUM_INVALID");
      throw new UseCaseError("PREDICTION_UNAVAILABLE");
    },
  };
}
