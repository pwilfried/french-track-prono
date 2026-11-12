import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ProfileReminderRepository } from "@/application/profile-reminder";

const fail = (): never => {
  throw new UseCaseError("PROFILE_UNAVAILABLE");
};

/** The client must carry the player's session: the date lives in their private details row. */
export function createSupabaseProfileReminderRepository(
  client: SupabaseClient,
): ProfileReminderRepository {
  return {
    async hiddenUntil(userId) {
      const { data, error } = await client
        .from("player_details")
        .select("reminder_hidden_until")
        .eq("profile_id", userId)
        .maybeSingle<{ reminder_hidden_until: string | null }>();
      if (error) fail();
      return data?.reminder_hidden_until ? new Date(data.reminder_hidden_until) : null;
    },

    async hideUntil(userId, until) {
      // Only this column is written: sex and disciplines stay as they are.
      const { error } = await client
        .from("player_details")
        .upsert({ profile_id: userId, reminder_hidden_until: until.toISOString() });
      if (error) fail();
    },
  };
}
