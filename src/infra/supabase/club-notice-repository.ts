import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClubNotice, ClubNoticeRepository } from "@/application/club-notices";
import { UseCaseError } from "@/application/errors";

/** The client must carry the player's session: a player reads only their own notices. */
export function createSupabaseClubNoticeRepository(client: SupabaseClient): ClubNoticeRepository {
  return {
    async listUnseen() {
      const { data, error } = await client
        .from("club_notices")
        .select("id, kind, club_name, new_name")
        .is("seen_at", null)
        .order("created_at")
        .returns<{ id: string; kind: ClubNotice["kind"]; club_name: string; new_name: string | null }[]>();
      if (error) throw new UseCaseError("CLUBS_UNAVAILABLE");
      return data.map((row) => ({
        id: row.id,
        kind: row.kind,
        clubName: row.club_name,
        newName: row.new_name,
      }));
    },

    async dismiss(id) {
      const { error } = await client.rpc("dismiss_club_notice", { p_notice: id });
      if (error) throw new UseCaseError("CLUBS_UNAVAILABLE");
    },
  };
}
