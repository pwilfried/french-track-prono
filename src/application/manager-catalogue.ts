import { viewList, type ListView } from "@/domain/list-view";
import {
  inCatalogueFilter,
  matchesCatalogueSearch,
  type CatalogueAthlete,
  type CatalogueFilter,
} from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";

/** Port: the mercato catalogue of a league. Real adapter = Supabase, fake = in memory. */
export interface ManagerCatalogueRepository {
  /** "not_member" for a league the player is not in. */
  list(leagueId: string): Promise<CatalogueAthlete[] | "not_member">;
}

export const CATALOGUE_PAGE_SIZE = 30;

/** The catalogue of a league searched and filtered, by name, one page at a time (#421). */
export function browseManagerCatalogue(ports: { catalogue: ManagerCatalogueRepository }) {
  return {
    async execute(input: {
      leagueId: string;
      query: string;
      filter: CatalogueFilter;
      page: number;
    }): Promise<ListView<CatalogueAthlete>> {
      const athletes = await ports.catalogue.list(input.leagueId);
      if (athletes === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      return viewList(athletes, {
        query: input.query,
        matches: matchesCatalogueSearch,
        filter: (a) => inCatalogueFilter(a, input.filter),
        sort: (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
        page: input.page,
        pageSize: CATALOGUE_PAGE_SIZE,
      });
    },
  };
}
