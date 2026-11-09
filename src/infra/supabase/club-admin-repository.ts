import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminClub, ClubAdminRepository } from "@/application/club-admin";
import { UseCaseError } from "@/application/errors";

const fail = (): never => {
  throw new UseCaseError("CLUBS_UNAVAILABLE");
};

const outcomeOf = (error: { code?: string } | null) => {
  if (!error) return "done" as const;
  if (error.code === "42501") return "not_admin" as const;
  if (error.code === "P0002" || error.code === "22P02") return "unknown" as const;
  return fail();
};

/** The client must carry the admin's session: the database functions check the admin. */
export function createSupabaseClubAdminRepository(client: SupabaseClient): ClubAdminRepository {
  return {
    async list(query, pendingOnly) {
      const { data, error } = await client.rpc("admin_list_clubs", {
        p_query: query,
        p_pending_only: pendingOnly,
      });
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as (Omit<AdminClub, "playerCount"> & { player_count: number })[]
      ).map(({ player_count, ...club }) => ({ ...club, playerCount: Number(player_count) }));
    },

    async save(id, club) {
      const { data, error } = await client.rpc("admin_save_club", {
        p_club: id,
        p_name: club.name,
        p_city: club.city,
        p_department: club.department,
      });
      if (!error) return data as string;
      if (error.code === "FT013") return "banned";
      if (error.code === "22023") throw new UseCaseError("CLUB_NAME_INVALID");
      return outcomeOf(error) as "not_admin" | "unknown";
    },

    async validate(id) {
      const { error } = await client.rpc("admin_validate_club", { p_club: id });
      return outcomeOf(error);
    },

    async remove(id) {
      const { error } = await client.rpc("admin_delete_club", { p_club: id });
      return outcomeOf(error);
    },
  };
}
