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
    async list() {
      const { data, error } = await client.rpc("admin_list_leagues");
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as {
          league_id: string;
          name: string;
          emoji: string;
          is_public: boolean;
          owner: string | null;
          created_at: string;
          member_count: number;
          report_count: number;
          competitions: string[] | null;
        }[]
      ).map((row) => ({
        id: row.league_id,
        name: row.name,
        emoji: row.emoji,
        isPublic: row.is_public,
        owner: row.owner,
        createdAt: new Date(row.created_at).toISOString(),
        memberCount: Number(row.member_count),
        reportCount: Number(row.report_count),
        competitions: row.competitions ?? [],
      }));
    },

    async members(leagueId) {
      const { data, error } = await client.rpc("admin_league_members", { p_league: leagueId });
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as {
          user_id: string;
          pseudo: string;
          avatar: string;
          is_owner: boolean;
          joined_at: string;
          points: number;
          rank: number;
        }[]
      ).map((row) => ({
        userId: row.user_id,
        pseudo: row.pseudo,
        avatar: row.avatar,
        isOwner: row.is_owner,
        joinedAt: new Date(row.joined_at).toISOString(),
        points: Number(row.points),
        rank: Number(row.rank),
      }));
    },

    async dismissReports(leagueId) {
      const { error } = await client.rpc("admin_dismiss_league_reports", { p_league: leagueId });
      if (!error) return "done";
      if (error.code === "42501") return "not_admin";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      return fail();
    },

    async removeMember(leagueId, userId) {
      const { error } = await client.rpc("admin_remove_league_member", {
        p_league: leagueId,
        p_user: userId,
      });
      if (!error) return "done";
      if (error.code === "42501") return "not_admin";
      if (error.code === "2BP01") return "owner";
      if (error.code === "P0002" || error.code === "22P02") return "unknown";
      return fail();
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
