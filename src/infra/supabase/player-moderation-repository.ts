import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { PlayerModerationRepository } from "@/application/player-moderation";

const fail = (): never => {
  throw new UseCaseError("PLAYERS_UNAVAILABLE");
};

const outcomeOf = (error: { code?: string } | null) => {
  if (!error) return "done" as const;
  if (error.code === "42501") return "not_admin" as const;
  if (error.code === "P0002" || error.code === "22P02") return "unknown" as const;
  return fail();
};

/** The client must carry the admin's session: the database functions check the admin. */
export function createSupabasePlayerModerationRepository(
  client: SupabaseClient,
): PlayerModerationRepository {
  return {
    async list() {
      const { data, error } = await client.rpc("admin_list_players");
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as {
          user_id: string;
          pseudo: string;
          avatar: string;
          blocked: boolean;
          is_admin: boolean;
          joined_at: string;
          club: string | null;
          points: number;
          predictions: number;
          leagues: number;
          last_active_at: string;
          reports: number;
        }[]
      ).map((row) => ({
        id: row.user_id,
        pseudo: row.pseudo,
        avatar: row.avatar,
        blocked: row.blocked,
        isAdmin: row.is_admin,
        joinedAt: new Date(row.joined_at).toISOString(),
        club: row.club,
        points: Number(row.points),
        predictions: Number(row.predictions),
        leagues: Number(row.leagues),
        lastActiveAt: new Date(row.last_active_at).toISOString(),
        reports: Number(row.reports),
      }));
    },

    async leaguesOf(playerId) {
      const { data, error } = await client.rpc("admin_player_leagues", { p_user: playerId });
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as { league_id: string; name: string; member_count: number; rank: number }[]
      ).map((row) => ({
        id: row.league_id,
        name: row.name,
        memberCount: Number(row.member_count),
        rank: Number(row.rank),
      }));
    },

    async setBlocked(playerId, blocked) {
      const { error } = await client.rpc("admin_set_player_blocked", {
        p_user: playerId,
        p_blocked: blocked,
      });
      return outcomeOf(error);
    },

    async remove(playerId) {
      const { error } = await client.rpc("admin_delete_player", { p_user: playerId });
      return outcomeOf(error);
    },
  };
}
