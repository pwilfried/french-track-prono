import type { BadgeLevelRepository } from "@/application/get-my-badges";
import { BADGE_LEVELS, BADGES, type StoredLevels } from "@/domain/badges";

/** Test double of the BadgeLevelRepository port: each player raises only their own levels. */
export function createInMemoryBadgeLevelStore() {
  const byUser = new Map<string, StoredLevels>();
  return {
    /** The repository as seen by a signed-in player. */
    session(me: string): BadgeLevelRepository {
      return {
        async levels(userId) {
          return { ...byUser.get(userId) };
        },
        async raise(userId, levels) {
          if (userId !== me) return;
          const stored = { ...byUser.get(me) };
          for (const { badge, level } of levels) {
            if (!BADGES.includes(badge) || !BADGE_LEVELS.includes(level)) continue;
            const current = stored[badge];
            if (!current || BADGE_LEVELS.indexOf(level) > BADGE_LEVELS.indexOf(current)) {
              stored[badge] = level;
            }
          }
          byUser.set(me, stored);
        },
      };
    },
  };
}
