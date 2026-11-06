import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { EventReader } from "@/application/list-events";
import type { EventGender, EventStatus, EventSummary } from "@/domain/event";

type EventRow = {
  id: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  starts_at: string;
  lock_at: string;
  is_featured: boolean;
  status: EventStatus;
};

export function createSupabaseEventReader(client: SupabaseClient): EventReader {
  return {
    async listByCompetition(competitionSlug) {
      const { data, error } = await client
        .from("events")
        .select("id, slug, discipline, gender, starts_at, lock_at, is_featured, status, competitions!inner(slug)")
        .eq("competitions.slug", competitionSlug)
        .returns<EventRow[]>();
      if (error) throw new UseCaseError("EVENTS_UNAVAILABLE");

      return data.map(
        (row): EventSummary => ({
          id: row.id,
          slug: row.slug,
          discipline: row.discipline,
          gender: row.gender,
          startsAt: new Date(row.starts_at).toISOString(),
          lockAt: new Date(row.lock_at).toISOString(),
          isFeatured: row.is_featured,
          status: row.status,
        }),
      );
    },
  };
}
