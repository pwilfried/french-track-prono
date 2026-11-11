import type { SupabaseClient } from "@supabase/supabase-js";

import type { AthleteAdminRepository, AthleteSummary } from "@/application/edit-athlete";
import { UseCaseError } from "@/application/errors";
import type { RecordKind } from "@/domain/athlete";
import type { EventGender } from "@/domain/event";

import { readAll } from "./read-all";

type AthleteRow = { id: string; slug: string; name: string; country_code: string; gender: EventGender };

const summary = (row: AthleteRow): AthleteSummary => ({
  athleteId: row.id,
  slug: row.slug,
  name: row.name,
  countryCode: row.country_code,
  gender: row.gender,
});

/** The client must carry the admin's session: the functions refuse anyone else. */
export function createSupabaseAthleteAdminRepository(client: SupabaseClient): AthleteAdminRepository {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await client.rpc(fn, args);
    if (!error) return "saved" as const;
    if (error.code === "42501") return "not_admin" as const;
    throw new UseCaseError("ATHLETES_UNAVAILABLE");
  };
  return {
    async list() {
      const { data, error } = await readAll((from, to) =>
        client
          .from("athletes")
          .select("id, slug, name, country_code, gender, athlete_disciplines(discipline)")
          .order("id")
          .range(from, to)
          .returns<(AthleteRow & { athlete_disciplines: { discipline: string }[] })[]>(),
      );
      if (error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      return data.map((row) => ({
        ...summary(row),
        disciplines: row.athlete_disciplines.map((d) => d.discipline),
      }));
    },

    async find(slug) {
      const { data, error } = await client
        .from("athletes")
        .select(
          "id, slug, name, country_code, gender, manager_price, athlete_disciplines(discipline, is_primary), athlete_records(discipline, kind, mark, record_date, meeting_name)",
        )
        .eq("slug", slug)
        .maybeSingle<
          AthleteRow & {
            manager_price: number | null;
            athlete_disciplines: { discipline: string; is_primary: boolean }[];
            athlete_records: {
              discipline: string;
              kind: RecordKind;
              mark: string;
              record_date: string | null;
              meeting_name: string | null;
            }[];
          }
        >();
      if (error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      if (!data) return null;
      return {
        ...summary(data),
        disciplines: data.athlete_disciplines.map((d) => ({
          discipline: d.discipline,
          isPrimary: d.is_primary,
        })),
        records: data.athlete_records.map((r) => ({
          discipline: r.discipline,
          kind: r.kind,
          mark: r.mark,
          date: r.record_date,
          meeting: r.meeting_name,
        })),
        managerPrice: data.manager_price,
      };
    },

    setPrice: (athleteId, price) =>
      call("admin_set_athlete_price", { p_athlete: athleteId, p_price: price }),

    async create(fields) {
      const created = await client.rpc("create_athlete", {
        p_name: fields.name,
        p_country: fields.countryCode,
        p_gender: fields.gender,
        p_slug: fields.slug,
      });
      if (created.error?.code === "42501") return "not_admin";
      if (created.error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      const athleteId = created.data as string;
      const row = await client.from("athletes").select("slug").eq("id", athleteId).single<{ slug: string }>();
      if (row.error) throw new UseCaseError("ATHLETES_UNAVAILABLE");
      return { athleteId, slug: row.data.slug };
    },
    update: (athleteId, fields) =>
      call("admin_update_athlete", {
        p_athlete: athleteId,
        p_name: fields.name,
        p_country: fields.countryCode,
        p_gender: fields.gender,
      }),
    setDiscipline: (athleteId, discipline, isPrimary) =>
      call("admin_set_athlete_discipline", {
        p_athlete: athleteId,
        p_discipline: discipline,
        p_primary: isPrimary,
      }),
    removeDiscipline: (athleteId, discipline) =>
      call("admin_remove_athlete_discipline", { p_athlete: athleteId, p_discipline: discipline }),
    setRecord: (athleteId, record) =>
      call("admin_set_athlete_record", {
        p_athlete: athleteId,
        p_discipline: record.discipline,
        p_kind: record.kind,
        p_mark: record.mark ?? "",
        p_value: record.value,
        p_date: record.date,
      }),
  };
}
