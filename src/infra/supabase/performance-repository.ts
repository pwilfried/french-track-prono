import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { PerformanceRepository } from "@/application/enter-performances";
import type { Performance, PerformanceStatus, RecordFlag } from "@/domain/performance";

type Row = {
  athlete_id: string;
  status: PerformanceStatus;
  place: number | null;
  mark: string | null;
  records: RecordFlag[];
};

/** Reads are public; writes and lineups go through admin RPCs, with the admin's own session. */
export function createSupabasePerformanceRepository(client: SupabaseClient): PerformanceRepository {
  return {
    async find(eventId) {
      const { data, error } = await client
        .from("event_performances")
        .select("athlete_id, status, place, mark, records")
        .eq("event_id", eventId)
        .returns<Row[]>();
      if (error) throw new UseCaseError("PERFORMANCES_UNAVAILABLE");
      return data.map(
        (row): Performance => ({
          athleteId: row.athlete_id,
          status: row.status,
          place: row.place,
          mark: row.mark,
          records: row.records,
        }),
      );
    },

    async linedUp(eventId) {
      const { data, error } = await client.rpc("admin_manager_lined_up", { p_event: eventId });
      if (!error) return (data ?? []) as string[];
      // 42501: the session is not an admin's.
      if (error.code === "42501") return "not_admin";
      throw new UseCaseError("PERFORMANCES_UNAVAILABLE");
    },

    async replace(eventId, lines) {
      const { error } = await client.rpc("admin_set_performances", {
        p_event: eventId,
        p_lines: lines.map((l) => ({
          athlete_id: l.athleteId,
          status: l.status,
          place: l.place,
          mark: l.mark,
          records: l.records,
        })),
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      // 23503: an athlete is not on the start list.
      if (error.code === "23503") return "athlete_not_in_event";
      throw new UseCaseError("PERFORMANCES_UNAVAILABLE");
    },
  };
}
