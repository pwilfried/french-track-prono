import type { ManagerCatalogueRepository } from "@/application/manager-catalogue";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";

/** Test double of the ManagerCatalogueRepository port: the priced athletes, the members by league. */
export function createInMemoryManagerCatalogue(
  athletes: CatalogueAthlete[],
  members: Record<string, string[]>,
) {
  return {
    session(userId: string): ManagerCatalogueRepository {
      return {
        async list(leagueId) {
          if (!members[leagueId]?.includes(userId)) return "not_member";
          return structuredClone(athletes);
        },
      };
    },
  };
}
