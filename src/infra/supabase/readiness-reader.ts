import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReadinessReader } from "@/application/competition-readiness";
import { UseCaseError } from "@/application/errors";

const fail = (): never => {
  throw new UseCaseError("EVENTS_UNAVAILABLE");
};

/** Start lists and odds are public: any client reads them. */
export function createSupabaseReadinessReader(client: SupabaseClient): ReadinessReader {
  return {
    async readiness(competitionSlug) {
      const events = await client
        .from("events")
        .select("id, competitions!inner(slug)")
        .eq("competitions.slug", competitionSlug)
        .returns<{ id: string }[]>();
      if (events.error) fail();
      const ids = events.data!.map((e) => e.id);
      if (ids.length === 0) return { withStartList: [], withOdds: [] };
      const [entries, odds] = await Promise.all([
        client.from("entries").select("event_id").in("event_id", ids).returns<{ event_id: string }[]>(),
        client.from("event_odds").select("event_id").in("event_id", ids).returns<{ event_id: string }[]>(),
      ]);
      if (entries.error || odds.error) fail();
      const unique = (rows: { event_id: string }[]) => [...new Set(rows.map((r) => r.event_id))];
      return { withStartList: unique(entries.data!), withOdds: unique(odds.data!) };
    },
  };
}
