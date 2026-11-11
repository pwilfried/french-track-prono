import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerCatalogueRepository } from "@/application/manager-catalogue";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";

type Row = {
  athlete_id: string;
  slug: string;
  name: string;
  country_code: string;
  sex: CatalogueAthlete["sex"];
  discipline: string;
  family: CatalogueAthlete["family"];
  pb: string | null;
  sb: string | null;
  price: number;
  available: boolean;
};

/** The player's session: manager_catalogue answers the participants of the league only. */
export function createSupabaseManagerCatalogue(client: SupabaseClient): ManagerCatalogueRepository {
  return {
    async list(leagueId) {
      const { data, error } = await client.rpc("manager_catalogue", { p_league: leagueId });
      if (error?.code === "42501" || error?.code === "22P02") return "not_member";
      if (error) throw new UseCaseError("CATALOGUE_UNAVAILABLE");
      return (data as Row[]).map((row) => ({
        athleteId: row.athlete_id,
        slug: row.slug,
        name: row.name,
        countryCode: row.country_code,
        sex: row.sex,
        discipline: row.discipline,
        family: row.family,
        pb: row.pb,
        sb: row.sb,
        price: row.price,
        available: row.available,
      }));
    },
  };
}
