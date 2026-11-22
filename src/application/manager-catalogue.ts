import { viewList, type ListView } from "@/domain/list-view";
import {
  catalogueDisciplines,
  compareCatalogue,
  inCatalogueFilter,
  matchesCatalogueSearch,
  type CatalogueAthlete,
  type CatalogueFilter,
  type CatalogueSort,
} from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";

/** Port: the mercato catalogue of a league. Real adapter = Supabase, fake = in memory. */
export interface ManagerCatalogueRepository {
  /** "not_member" for a league the player is not in. */
  list(leagueId: string): Promise<CatalogueAthlete[] | "not_member">;
}

export const CATALOGUE_PAGE_SIZE = 30;

/** The catalogue of a league searched and filtered, sorted, one page at a time (#421). */
export function browseManagerCatalogue(ports: { catalogue: ManagerCatalogueRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      query: string;
      filter: CatalogueFilter;
      sort: CatalogueSort;
      page: number;
    }): Promise<ListView<CatalogueAthlete> & { disciplines: string[] }> {
      const athletes = await ports.catalogue.list(input.leagueId);
      if (athletes === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      const view = viewList(athletes, {
        query: input.query,
        matches: matchesCatalogueSearch,
        filter: (a) => inCatalogueFilter(a, input.filter),
        sort: compareCatalogue(input.sort),
        page: input.page,
        pageSize: CATALOGUE_PAGE_SIZE,
      });
      // The disciplines of the chosen family, whatever the other filters keep (#1087).
      const disciplines = input.filter.family
        ? catalogueDisciplines(athletes, input.filter.family)
        : [];
      return { ...view, disciplines };
    },
  };
}
