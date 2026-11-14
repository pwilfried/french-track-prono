import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { AthleteReader } from "@/application/get-athlete";
import type { RecordKind, SheetRecord } from "@/domain/athlete";
import type { EventGender } from "@/domain/event";

type AthleteRow = {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  gender: EventGender;
  manager_price: number | null;
  athlete_disciplines: { discipline: string; is_primary: boolean }[];
  athlete_records: {
    discipline: string;
    kind: RecordKind;
    mark: string;
    record_date: string | null;
    meeting_name: string | null;
    verified: boolean;
  }[];
};

/** Public data: any client works, a visitor's included. */
export function createSupabaseAthleteReader(client: SupabaseClient): AthleteReader {
  return {
    async namesOf(athleteIds) {
      if (athleteIds.length === 0) return [];
      const { data, error } = await client
        .from("athletes")
        .select("id, name, country_code")
        .in("id", [...new Set(athleteIds)])
        .returns<{ id: string; name: string; country_code: string }[]>();
      if (error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      return data.map((a) => ({ athleteId: a.id, name: a.name, countryCode: a.country_code }));
    },

    async findBySlug(slug) {
      const found = await client
        .from("athletes")
        .select(
          "id, slug, name, country_code, gender, manager_price, athlete_disciplines(discipline, is_primary), athlete_records(discipline, kind, mark, record_date, meeting_name, verified)",
        )
        .eq("slug", slug)
        .maybeSingle<AthleteRow>();
      if (found.error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      if (!found.data) return null;
      const a = found.data;
      return {
        athleteId: a.id,
        slug: a.slug,
        name: a.name,
        countryCode: a.country_code,
        gender: a.gender,
        // The main discipline first, then the others by name.
        disciplines: [...a.athlete_disciplines]
          .sort(
            (x, y) =>
              Number(y.is_primary) - Number(x.is_primary) || x.discipline.localeCompare(y.discipline),
          )
          .map((d) => d.discipline),
        managerPrice: a.manager_price,
        records: a.athlete_records.map(
          (r): SheetRecord => ({
            discipline: r.discipline,
            kind: r.kind,
            mark: r.mark,
            date: r.record_date,
            meeting: r.meeting_name,
            verified: r.verified,
          }),
        ),
      };
    },
  };
}
