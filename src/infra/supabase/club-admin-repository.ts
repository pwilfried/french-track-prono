import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminClub, ClubAdminRepository } from "@/application/club-admin";
import { UseCaseError } from "@/application/errors";

import { readAll } from "./read-all";

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
    async list(query, pendingOnly, limit = 50) {
      type Row = Omit<AdminClub, "playerCount" | "createdAt"> & {
        player_count: number;
        created_at: string;
      };
      const call = () =>
        client.rpc("admin_list_clubs", {
          p_query: query,
          p_pending_only: pendingOnly,
          // null: every club (#508), read a page at a time.
          p_limit: limit === "all" ? null : limit,
        });
      const { data, error } =
        limit === "all" ? await readAll<Row>((from, to) => call().range(from, to)) : await call();
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (data as Row[]).map(({ player_count, created_at, ...club }) => ({
        ...club,
        playerCount: Number(player_count),
        createdAt: new Date(created_at).toISOString(),
      }));
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

    async merge(fromId, intoId) {
      const { data, error } = await client.rpc("admin_merge_club", {
        p_from: fromId,
        p_into: intoId,
      });
      if (!error) return Number(data);
      if (error.code === "22023") return "same";
      return outcomeOf(error) as "not_admin" | "unknown";
    },
  };
}
