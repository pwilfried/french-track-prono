import type { ManagerHonoursRepository } from "@/application/manager-honours";
import type { ManagerHonours } from "@/domain/manager-honours";

/** A finished season the fake knows: its participants and its honours. */
export type ManagerHonoursFixture = { members: string[]; honours: ManagerHonours };

/**
 * Test double of the ManagerHonoursRepository port, with the rule of the database: only the
 * participants of a league read its honours.
 */
export function createInMemoryManagerHonoursStore(seasons: ManagerHonoursFixture[]) {
  return {
    session(userId: string): ManagerHonoursRepository {
      const visible = () =>
        seasons
          .filter((s) => s.members.includes(userId))
          .map((s) => structuredClone(s.honours))
          .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
      return {
        async find(leagueId) {
          return visible().find((h) => h.leagueId === leagueId) ?? null;
        },
        async mine() {
          return visible();
        },
      };
    },
  };
}
