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
    async search(query) {
      const { data, error } = await client.rpc("admin_search_players", { p_query: query });
      if (error) return error.code === "42501" ? "not_admin" : fail();
      return (
        data as {
          user_id: string;
          pseudo: string;
          avatar: string;
          blocked: boolean;
          is_admin: boolean;
          joined_at: string;
        }[]
      ).map((row) => ({
        id: row.user_id,
        pseudo: row.pseudo,
        avatar: row.avatar,
        blocked: row.blocked,
        isAdmin: row.is_admin,
        joinedAt: new Date(row.joined_at).toISOString(),
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
