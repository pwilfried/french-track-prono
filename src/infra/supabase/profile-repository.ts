import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { Profile, ProfileRepository } from "@/application/create-profile";
import { isAvatar } from "@/domain/profile";

type Row = { id: string; pseudo: string; avatar_emoji: string; age_confirmed_at: string };

/** The client must carry the player's session: row level security only lets one create their own profile. */
export function createSupabaseProfileRepository(client: SupabaseClient): ProfileRepository {
  return {
    async find(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("id, pseudo, avatar_emoji, age_confirmed_at")
        .eq("id", userId)
        .maybeSingle<Row>();
      if (error) throw new UseCaseError("PROFILE_UNAVAILABLE");
      if (!data || !isAvatar(data.avatar_emoji)) return null;
      return {
        userId: data.id,
        pseudo: data.pseudo,
        avatar: data.avatar_emoji,
        ageConfirmedAt: new Date(data.age_confirmed_at),
      } satisfies Profile;
    },

    async isAdmin(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle<{ is_admin: boolean }>();
      if (error) throw new UseCaseError("PROFILE_UNAVAILABLE");
      return data?.is_admin ?? false;
    },

    async create(profile) {
      const { error } = await client.from("profiles").insert({
        id: profile.userId,
        pseudo: profile.pseudo,
        avatar_emoji: profile.avatar,
        age_confirmed_at: profile.ageConfirmedAt.toISOString(),
      });
      if (!error) return "created";
      if (error.code === "23505") {
        const where = `${error.message} ${error.details ?? ""}`;
        if (where.includes("profiles_pseudo_lower_key")) return "pseudo_taken";
        if (where.includes("profiles_pkey")) return "profile_exists";
      }
      throw new UseCaseError("PROFILE_UNAVAILABLE");
    },
  };
}
