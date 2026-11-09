import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClubDirectory } from "@/application/clubs";
import { UseCaseError } from "@/application/errors";

/** Any client works: validated clubs are public. */
export function createSupabaseClubDirectory(client: SupabaseClient): ClubDirectory {
  return {
    async search(query, limit) {
      const { data, error } = await client.rpc("search_clubs", { p_query: query, p_limit: limit });
      if (error) throw new UseCaseError("CLUBS_UNAVAILABLE");
      return (
        data as { id: string; name: string; city: string; department: string; validated: boolean }[]
      ).map((row) => ({ ...row }));
    },
  };
}
