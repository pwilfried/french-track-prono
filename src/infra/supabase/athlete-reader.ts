import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { AthleteReader } from "@/application/get-athlete";
import type { AthleteRace, AthleteRecord, RecordKind } from "@/domain/athlete";
import type { EventGender } from "@/domain/event";

type AthleteRow = { id: string; slug: string; name: string; country_code: string; gender: EventGender };
type RecordRow = {
  discipline: string;
  kind: RecordKind;
  mark: string;
  record_date: string | null;
  meeting_name: string | null;
};
type ResultRow = {
  rank: number;
  mark: string | null;
  events: {
    slug: string;
    discipline: string;
    starts_at: string;
    competitions: { slug: string; name: string };
  };
};

/** Public data: any client works, a visitor's included. */
export function createSupabaseAthleteReader(client: SupabaseClient): AthleteReader {
  return {
    async findBySlug(slug, races) {
      const found = await client
        .from("athletes")
        .select("id, slug, name, country_code, gender")
        .eq("slug", slug)
        .maybeSingle<AthleteRow>();
      if (found.error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      if (!found.data) return null;
      const athlete = found.data;

      const [records, results] = await Promise.all([
        client
          .from("athlete_records")
          .select("discipline, kind, mark, record_date, meeting_name")
          .eq("athlete_id", athlete.id)
          .returns<RecordRow[]>(),
        client
          .from("results")
          .select(
            "rank, mark, events!inner(slug, discipline, starts_at, competitions!inner(slug, name))",
          )
          .eq("athlete_id", athlete.id)
          .returns<ResultRow[]>(),
      ]);
      if (records.error || results.error) throw new UseCaseError("ATHLETES_UNAVAILABLE");

      return {
        athleteId: athlete.id,
        slug: athlete.slug,
        name: athlete.name,
        countryCode: athlete.country_code,
        gender: athlete.gender,
        records: records.data.map(
          (r): AthleteRecord => ({
            discipline: r.discipline,
            kind: r.kind,
            mark: r.mark,
            date: r.record_date,
            meeting: r.meeting_name,
          }),
        ),
        // An athlete has few results: sorted here rather than through the embedded table.
        races: results.data
          .map(
            (r): AthleteRace => ({
              competitionSlug: r.events.competitions.slug,
              eventSlug: r.events.slug,
              discipline: r.events.discipline,
              startsAt: new Date(r.events.starts_at).toISOString(),
              meeting: r.events.competitions.name,
              rank: r.rank,
              mark: r.mark,
            }),
          )
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
          .slice(0, races),
      };
    },
  };
}
