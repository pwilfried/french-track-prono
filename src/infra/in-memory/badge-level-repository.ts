import type { BadgeLevelRepository } from "@/application/get-my-badges";
import { BADGE_LEVELS, BADGES, type StoredLevels } from "@/domain/badges";

/**
 * Test double of the BadgeLevelRepository port: each player raises only their own levels, and
 * tells them in the leagues `leaguesOf` gives them.
 */
export function createInMemoryBadgeLevelStore(
  world: { leaguesOf?: Record<string, string[]> } = {},
) {
  const byUser = new Map<string, StoredLevels>();
  const told = new Set<string>();
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
        async publishMoments(moments) {
          const held = byUser.get(me) ?? {};
          let count = 0;
          for (const m of moments) {
            const level = held[m.badge];
            const holds =
              level !== undefined && BADGE_LEVELS.indexOf(level) >= BADGE_LEVELS.indexOf(m.level);
            if (m.userId !== me || m.key !== `badge:${me}:${m.badge}:${m.level}` || !holds)
              continue;
            for (const league of world.leaguesOf?.[me] ?? []) {
              const id = `${league}|${m.key}`;
              if (told.has(id)) continue;
              told.add(id);
              count += 1;
            }
          }
          return count;
        },
      };
    },
  };
}
