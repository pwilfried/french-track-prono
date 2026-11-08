import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ReactionRepository } from "@/application/react";

// Row level security refuses the row (own prediction, not locked yet); an unknown prediction
// breaks the foreign key.
const REFUSED = new Set(["42501", "23503"]);

const fail = (): never => {
  throw new UseCaseError("REVEAL_UNAVAILABLE");
};

/** The client carries the player's session: the policies decide who may react to what. */
export function createSupabaseReactionRepository(client: SupabaseClient): ReactionRepository {
  const me = async () => {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) fail();
    return data.user!.id;
  };
  return {
    async set(predictionId, reaction) {
      const { error } = await client
        .from("reactions")
        .upsert(
          { prediction_id: predictionId, user_id: await me(), emoji: reaction },
          { onConflict: "prediction_id,user_id" },
        );
      if (!error) return "done";
      if (REFUSED.has(error.code)) return "refused";
      return fail();
    },
    async remove(predictionId) {
      const { error } = await client
        .from("reactions")
        .delete()
        .eq("prediction_id", predictionId)
        .eq("user_id", await me());
      if (error) fail();
    },
  };
}
