import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClubDirectory } from "@/application/clubs";
import { UseCaseError } from "@/application/errors";

/** Any client works for search (validated clubs are public); propose needs a session. */
export function createSupabaseClubDirectory(client: SupabaseClient): ClubDirectory {
  return {
    async search(query, limit) {
      const { data, error } = await client.rpc("search_clubs", { p_query: query, p_limit: limit });
      if (error) throw new UseCaseError("CLUBS_UNAVAILABLE");
      return (
        data as { id: string; name: string; city: string; department: string; validated: boolean }[]
      ).map((row) => ({ ...row }));
    },

    async propose(name, city) {
      const { data, error } = await client.rpc("propose_club", { p_name: name, p_city: city });
      if (error) {
        if (error.code === "FT013") return "banned";
        if (error.code === "22023") throw new UseCaseError("CLUB_NAME_INVALID");
        throw new UseCaseError("CLUBS_UNAVAILABLE");
      }
      return { id: data as string, name, city, department: "", validated: false };
    },
  };
}
