import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type {
  Candidate,
  StartListEntry,
  StartListRepository,
} from "@/application/set-start-list";

/** The client must carry the admin's session: row level security decides who can write. */
export function createSupabaseStartListRepository(client: SupabaseClient): StartListRepository {
  return {
    async candidates(gender) {
      const { data, error } = await client
        .from("athletes")
        .select("id, name, country_code")
        .eq("gender", gender)
        .order("name")
        .returns<{ id: string; name: string; country_code: string }[]>();
      if (error) throw new UseCaseError("START_LIST_UNAVAILABLE");
      return data.map(
        (row): Candidate => ({ athleteId: row.id, name: row.name, countryCode: row.country_code }),
      );
    },

    async find(eventId) {
      const { data, error } = await client
        .from("entries")
        .select("athlete_id, season_best")
        .eq("event_id", eventId)
        .returns<{ athlete_id: string; season_best: string | null }[]>();
      if (error) throw new UseCaseError("START_LIST_UNAVAILABLE");
      return data.map(
        (row): StartListEntry => ({ athleteId: row.athlete_id, seasonBest: row.season_best }),
      );
    },

    async createAthlete(athlete) {
      const { data, error } = await client.rpc("create_athlete", {
        p_name: athlete.name,
        p_country: athlete.countryCode,
        p_gender: athlete.gender,
        p_slug: athlete.slug,
      });
      if (!error) return { athleteId: data as string };
      if (error.code === "42501") return "not_admin";
      throw new UseCaseError("START_LIST_UNAVAILABLE");
    },

    async replace(eventId, entries) {
      const { error } = await client.rpc("set_start_list", {
        p_event: eventId,
        p_entries: entries.map((e) => ({ athlete_id: e.athleteId, season_best: e.seasonBest })),
      });
      if (!error) return "saved";
      // 42501: the session is not an admin's.
      if (error.code === "42501") return "not_admin";
      // 23503: a removed athlete is predicted or in the result.
      if (error.code === "23503") return "athlete_in_use";
      throw new UseCaseError("START_LIST_UNAVAILABLE");
    },
  };
}
