import type { SupabaseClient } from "@supabase/supabase-js";

import type { Club } from "@/application/clubs";
import { UseCaseError } from "@/application/errors";
import type { PlayerDetailsRepository } from "@/application/player-details";

const fail = (): never => {
  throw new UseCaseError("PROFILE_UNAVAILABLE");
};

/** The client must carry the player's session: rows are private to their owner. */
export function createSupabasePlayerDetailsRepository(
  client: SupabaseClient,
): PlayerDetailsRepository {
  return {
    async find(userId) {
      const [details, profile] = await Promise.all([
        client
          .from("player_details")
          .select("sex, disciplines")
          .eq("profile_id", userId)
          .maybeSingle<{ sex: "F" | "M" | null; disciplines: string[] }>(),
        client
          .from("profiles")
          .select("club:clubs(id, name, city, department, validated)")
          .eq("id", userId)
          .maybeSingle<{ club: Club | null }>(),
      ]);
      if (details.error || profile.error) fail();
      return {
        sex: details.data?.sex ?? null,
        disciplines: details.data?.disciplines ?? [],
        club: profile.data?.club ?? null,
      };
    },

    async save(userId, details) {
      const club = await client.from("profiles").update({ club_id: details.clubId }).eq("id", userId);
      if (club.error) return club.error.code === "P0002" ? "unknown_club" : fail();
      const saved = await client
        .from("player_details")
        .upsert({ profile_id: userId, sex: details.sex, disciplines: details.disciplines });
      if (saved.error) fail();
      return "saved";
    },
  };
}
