import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { LeagueModerationRepository } from "@/application/league-moderation";

const fail = (): never => {
  throw new UseCaseError("LEAGUES_UNAVAILABLE");
};

/** The client must carry the admin's session: the database functions check the admin. */
export function createSupabaseLeagueModerationRepository(
  client: SupabaseClient,
): LeagueModerationRepository {
  return {
    async listReported() {
      const { data, error } = await client.rpc("admin_list_reported_leagues");
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as { league_id: string; name: string; report_count: number; member_count: number }[]
      ).map((row) => ({
        id: row.league_id,
        name: row.name,
        reportCount: Number(row.report_count),
        memberCount: Number(row.member_count),
      }));
    },

    async rename(leagueId, name) {
      const { error } = await client.rpc("admin_rename_league", { p_league: leagueId, p_name: name });
      if (!error) return "done";
      if (error.code === "42501") return "not_admin";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      if (error.code === "FT010") throw new UseCaseError("LEAGUE_NAME_BANNED");
      if (error.code === "22023") throw new UseCaseError("LEAGUE_NAME_INVALID");
      return fail();
    },

    async remove(leagueId) {
      const { error } = await client.rpc("admin_delete_league", { p_league: leagueId });
      if (!error) return "done";
      if (error.code === "42501") return "not_admin";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      return fail();
    },
  };
}
