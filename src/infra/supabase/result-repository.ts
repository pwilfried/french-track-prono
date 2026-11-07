import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResultEntry, ResultRepository } from "@/application/enter-results";
import { UseCaseError } from "@/application/errors";

type Row = { athlete_id: string; rank: number; mark: string | null };

/** The client must carry the admin's session: row level security decides who can write. */
export function createSupabaseResultRepository(client: SupabaseClient): ResultRepository {
  return {
    async find(eventId) {
      const { data, error } = await client
        .from("results")
        .select("athlete_id, rank, mark")
        .eq("event_id", eventId)
        .order("rank")
        .returns<Row[]>();
      if (error) throw new UseCaseError("RESULTS_UNAVAILABLE");
      return data.map(
        (row): ResultEntry => ({ athleteId: row.athlete_id, rank: row.rank, mark: row.mark }),
      );
    },

    async replace(eventId, lines) {
      const { error } = await client.rpc("set_results", {
        p_event: eventId,
        p_lines: lines.map((l) => ({ athlete_id: l.athleteId, rank: l.rank, mark: l.mark })),
      });
      if (!error) return "saved";
      // 42501: row level security, the session is not an admin's.
      if (error.code === "42501") return "not_admin";
      // 23503: the (event, athlete) pair is not in `entries`.
      if (error.code === "23503") return "athlete_not_in_event";
      throw new UseCaseError("RESULTS_UNAVAILABLE");
    },
  };
}
