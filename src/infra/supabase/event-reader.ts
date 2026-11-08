import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { EventReader } from "@/application/list-events";
import type {
  Entry,
  EventGender,
  EventStatus,
  EventSummary,
  ResultLine,
} from "@/domain/event";

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

type EntryRow = {
  season_best: string | null;
  athletes: { id: string; slug: string; name: string; country_code: string };
};

type ResultRow = { athlete_id: string; rank: number; mark: string | null };

const EVENT_COLUMNS = "id, slug, discipline, gender, starts_at, lock_at, is_featured, status";

function toSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    slug: row.slug,
    discipline: row.discipline,
    gender: row.gender,
    startsAt: new Date(row.starts_at).toISOString(),
    lockAt: new Date(row.lock_at).toISOString(),
    isFeatured: row.is_featured,
    status: row.status,
  };
}

export function createSupabaseEventReader(client: SupabaseClient): EventReader {
  return {
    async listByCompetition(competitionSlug) {
      const { data, error } = await client
        .from("events")
        .select(`${EVENT_COLUMNS}, competitions!inner(slug)`)
        .eq("competitions.slug", competitionSlug)
        .returns<EventRow[]>();
      if (error) throw new UseCaseError("EVENTS_UNAVAILABLE");

      return data.map(toSummary);
    },

    async findBySlug(competitionSlug, eventSlug) {
      const found = await client
        .from("events")
        .select(`${EVENT_COLUMNS}, sub_disciplines, competitions!inner(slug)`)
        .eq("competitions.slug", competitionSlug)
        .eq("slug", eventSlug)
        .maybeSingle<EventRow & { sub_disciplines: string[] | null }>();
      if (found.error) throw new UseCaseError("EVENTS_UNAVAILABLE");
      if (!found.data) return null;

      const [entriesQuery, resultsQuery] = await Promise.all([
        client
          .from("entries")
          .select("season_best, athletes!inner(id, slug, name, country_code)")
          .eq("event_id", found.data.id)
          .returns<EntryRow[]>(),
        client
          .from("results")
          .select("athlete_id, rank, mark")
          .eq("event_id", found.data.id)
          .order("rank")
          .returns<ResultRow[]>(),
      ]);
      if (entriesQuery.error || resultsQuery.error) throw new UseCaseError("EVENTS_UNAVAILABLE");

      const entries: Entry[] = entriesQuery.data.map((row) => ({
        athleteId: row.athletes.id,
        slug: row.athletes.slug,
        name: row.athletes.name,
        countryCode: row.athletes.country_code,
        seasonBest: row.season_best,
      }));
      // Every result belongs to an entry (foreign key), so athlete details come from the start list.
      const byId = new Map(entries.map((entry) => [entry.athleteId, entry]));
      const results: ResultLine[] = resultsQuery.data.flatMap((row) => {
        const entry = byId.get(row.athlete_id);
        if (!entry) return [];
        return [
          {
            athleteId: entry.athleteId,
            slug: entry.slug,
            name: entry.name,
            countryCode: entry.countryCode,
            rank: row.rank,
            mark: row.mark,
          },
        ];
      });

      return {
        ...toSummary(found.data),
        entries,
        results,
        subDisciplines: found.data.sub_disciplines ?? [],
      };
    },
  };
}
