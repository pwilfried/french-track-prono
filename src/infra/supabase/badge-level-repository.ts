import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { BadgeLevelRepository } from "@/application/get-my-badges";
import { BADGE_LEVELS, BADGES, type Badge, type BadgeLevel, type StoredLevels } from "@/domain/badges";

const fail = (): never => {
  throw new UseCaseError("BADGES_UNAVAILABLE");
};

/** The client must carry the player's session: they only raise their own levels. */
export function createSupabaseBadgeLevelRepository(client: SupabaseClient): BadgeLevelRepository {
  return {
    async levels(userId) {
      const { data, error } = await client
        .from("user_badges")
        .select("badge_code, level")
        .eq("user_id", userId)
        .returns<{ badge_code: string; level: string }[]>();
      if (error) fail();
      const levels: StoredLevels = {};
      for (const row of data ?? []) {
        // A code or a level the app no longer knows is left out.
        if (BADGES.includes(row.badge_code as Badge) && BADGE_LEVELS.includes(row.level as BadgeLevel)) {
          levels[row.badge_code as Badge] = row.level as BadgeLevel;
        }
      }
      return levels;
    },

    // The function raises the levels of the signed-in player, who is the one given.
    async raise(_, levels) {
      if (levels.length === 0) return;
      const { error } = await client.rpc("raise_my_badge_levels", { p_levels: levels });
      if (error) fail();
    },

    async publishMoments(moments) {
      if (moments.length === 0) return 0;
      const { data, error } = await client.rpc("publish_my_badge_moments", {
        p_moments: moments.map((m) => ({ key: m.key, badge: m.badge, level: m.level })),
      });
      if (error) fail();
      return data as number;
    },
  };
}
