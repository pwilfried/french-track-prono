import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { OddsRepository } from "@/application/set-event-odds";

/** Odds and records are public; saving needs the admin's own session. */
export function createSupabaseOddsRepository(client: SupabaseClient): OddsRepository {
  return {
    async find(eventId) {
      const { data, error } = await client
        .from("event_odds")
        .select("athlete_id, odds")
        .eq("event_id", eventId)
        .returns<{ athlete_id: string | null; odds: number | string }[]>();
      if (error) throw new UseCaseError("ODDS_UNAVAILABLE");
      const other = data.find((row) => row.athlete_id === null);
      if (!other) return null;
      return {
        // numeric columns come back as text.
        proposed: data
          .filter((row) => row.athlete_id !== null)
          .map((row) => ({ athleteId: row.athlete_id!, odds: Number(row.odds) }))
          .sort((a, b) => a.odds - b.odds),
        other: Number(other.odds),
      };
    },

    async marks(eventId) {
      const event = await client
        .from("events")
        .select("discipline, entries(athlete_id)")
        .eq("id", eventId)
        .maybeSingle<{ discipline: string; entries: { athlete_id: string }[] }>();
      if (event.error) throw new UseCaseError("ODDS_UNAVAILABLE");
      if (!event.data || event.data.entries.length === 0) return [];
      const ids = event.data.entries.map((e) => e.athlete_id);
      const records = await client
        .from("athlete_records")
        .select("athlete_id, kind, mark")
        .eq("discipline", event.data.discipline)
        .in("kind", ["pr", "sb"])
        .in("athlete_id", ids)
        .returns<{ athlete_id: string; kind: "pr" | "sb"; mark: string }[]>();
      if (records.error) throw new UseCaseError("ODDS_UNAVAILABLE");
      const markOf = (id: string, kind: "pr" | "sb") =>
        records.data.find((r) => r.athlete_id === id && r.kind === kind)?.mark ?? null;
      return ids.map((athleteId) => ({ athleteId, pr: markOf(athleteId, "pr"), sb: markOf(athleteId, "sb") }));
    },

    async save(eventId, odds) {
      const { error } = await client.rpc("admin_set_event_odds", {
        p_event: eventId,
        p_odds: [
          ...odds.proposed.map((p) => ({ athlete_id: p.athleteId, odds: p.odds })),
          { athlete_id: null, odds: odds.other },
        ],
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      // FT005: the event is locked; 22023: not 5–6 athletes of the start list plus another.
      if (error.code === "FT005") return "locked";
      if (error.code === "22023") return "invalid";
      throw new UseCaseError("ODDS_UNAVAILABLE");
    },
  };
}
