import type { PlayerDetails, PlayerDetailsRepository } from "@/application/player-details";

import type { InMemoryClubDirectory } from "./club-directory";

/** Test double of the PlayerDetailsRepository port. Same rules as the database. */
export function createInMemoryPlayerDetailsRepository(
  clubs: InMemoryClubDirectory,
): PlayerDetailsRepository {
  const byUser = new Map<
    string,
    { sex: PlayerDetails["sex"]; disciplines: string[]; clubId: string | null }
  >();
  return {
    async find(userId) {
      const saved = byUser.get(userId);
      if (!saved) return { sex: null, disciplines: [], club: null };
      return {
        sex: saved.sex,
        disciplines: [...saved.disciplines],
        club: saved.clubId ? clubs.visible(saved.clubId) : null,
      };
    },
    async save(userId, details) {
      if (details.clubId && !clubs.visible(details.clubId)) return "unknown_club";
      byUser.set(userId, { ...details, disciplines: [...new Set(details.disciplines)] });
      return "saved";
    },
  };
}
