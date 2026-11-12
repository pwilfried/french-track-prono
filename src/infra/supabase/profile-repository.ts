import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { Profile, ProfileRepository } from "@/application/create-profile";
import { bibOf } from "@/domain/bib";

type Row = {
  id: string;
  pseudo: string;
  bib_number: number;
  bib_color: string;
  age_confirmed_at: string;
};

/** The client must carry the player's session: row level security only lets one create their own profile. */
export function createSupabaseProfileRepository(client: SupabaseClient): ProfileRepository {
  return {
    async find(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("id, pseudo, bib_number, bib_color, age_confirmed_at")
        .eq("id", userId)
        .maybeSingle<Row>();
      if (error) throw new UseCaseError("PROFILE_UNAVAILABLE");
      if (!data) return null;
      return {
        userId: data.id,
        pseudo: data.pseudo,
        bib: bibOf(data.bib_number, data.bib_color),
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
        bib_number: profile.bib.number,
        bib_color: profile.bib.color,
        age_confirmed_at: profile.ageConfirmedAt.toISOString(),
      });
      if (!error) return "created";
      if (error.code === "FT013") throw new UseCaseError("PSEUDO_BANNED");
      if (error.code === "23505") {
        const where = `${error.message} ${error.details ?? ""}`;
        if (where.includes("profiles_pseudo_lower_key")) return "pseudo_taken";
        if (where.includes("profiles_pkey")) return "profile_exists";
      }
      throw new UseCaseError("PROFILE_UNAVAILABLE");
    },

    async update(userId, change) {
      const { error } = await client
        .from("profiles")
        .update({
          pseudo: change.pseudo,
          bib_number: change.bib.number,
          bib_color: change.bib.color,
        })
        .eq("id", userId);
      if (!error) return "updated";
      if (error.code === "FT013") throw new UseCaseError("PSEUDO_BANNED");
      if (error.code === "23505") return "pseudo_taken";
      throw new UseCaseError("PROFILE_UNAVAILABLE");
    },

    // The database function deletes the caller (auth.uid()), whatever id is given.
    async deleteMine() {
      const { error } = await client.rpc("delete_my_account");
      if (error) throw new UseCaseError("PROFILE_UNAVAILABLE");
    },
  };
}
