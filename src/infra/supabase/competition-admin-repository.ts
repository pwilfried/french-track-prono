import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompetitionAdminRepository,
  CompetitionSummary,
} from "@/application/create-competition";
import { UseCaseError } from "@/application/errors";
import type { CompetitionScope } from "@/domain/competition";
import type { EventGender } from "@/domain/event";
import type { Round } from "@/domain/rounds";

import { readAll } from "./read-all";

type CompetitionRow = {
  slug: string;
  name: string;
  scope: CompetitionScope;
  city: string | null;
  country_code: string | null;
  starts_on: string;
  ends_on: string;
  events: { round: string }[];
  competition_athletes: { count: number }[];
};

const COLUMNS =
  "slug, name, scope, city, country_code, starts_on, ends_on, events(round), competition_athletes(count)";

const summary = (row: CompetitionRow): CompetitionSummary => ({
  slug: row.slug,
  name: row.name,
  scope: row.scope,
  city: row.city,
  countryCode: row.country_code?.trim() ?? null,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  events: row.events.length,
  finals: row.events.filter((e) => e.round === "final").length,
  entered: row.competition_athletes[0]?.count ?? 0,
});

/** The client must carry the admin's session for writes; reads are public. */
export function createSupabaseCompetitionAdminRepository(
  client: SupabaseClient,
): CompetitionAdminRepository {
  return {
    async list() {
      const { data, error } = await readAll((from, to) =>
        client
          .from("competitions")
          .select(COLUMNS)
          .order("id")
          .range(from, to)
          .returns<CompetitionRow[]>(),
      );
      if (error) throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
      return data.map(summary);
    },

    async find(slug) {
      const { data, error } = await client
        .from("competitions")
        .select(
          `${COLUMNS}, eventList:events(slug, discipline, gender, round, starts_at, entries(count)), athletes:competition_athletes(athletes(id, slug, name, country_code, gender))`,
        )
        .eq("slug", slug)
        .maybeSingle<
          CompetitionRow & {
            eventList: {
              slug: string;
              discipline: string;
              gender: EventGender;
              round: Round;
              starts_at: string;
              entries: { count: number }[];
            }[];
            athletes: {
              athletes: { id: string; slug: string; name: string; country_code: string; gender: EventGender };
            }[];
          }
        >();
      if (error) throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
      if (!data) return null;
      return {
        ...summary(data),
        eventList: data.eventList.map((e) => ({
          slug: e.slug,
          discipline: e.discipline,
          gender: e.gender,
          round: e.round,
          startsAt: new Date(e.starts_at).toISOString(),
          entries: e.entries[0]?.count ?? 0,
        })),
        athletes: data.athletes.map(({ athletes: a }) => ({
          athleteId: a.id,
          slug: a.slug,
          name: a.name,
          countryCode: a.country_code,
          gender: a.gender,
        })),
      };
    },

    async create(c) {
      const { data, error } = await client.rpc("admin_create_competition", {
        p_slug: c.slug,
        p_name: c.name,
        p_scope: c.scope,
        p_city: c.city ?? "",
        p_country: c.countryCode ?? "",
        p_starts_on: c.startsOn,
        p_ends_on: c.endsOn,
      });
      if (error?.code === "42501") return "not_admin";
      if (error) throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
      return data as string;
    },

    async addEvent(competition, event) {
      const { data, error } = await client.rpc("admin_add_event", {
        p_competition: competition,
        p_slug: event.slug,
        p_discipline: event.discipline,
        p_gender: event.gender,
        p_round: event.round,
        p_starts_at: event.startsAt,
        p_lock_at: event.lockAt,
      });
      if (error?.code === "42501") return "not_admin";
      // FT004: no competition with this slug.
      if (error?.code === "FT004") return "unknown";
      if (error) throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
      return data as string;
    },

    async setAthlete(competition, athleteId, entered) {
      const { error } = await client.rpc("admin_set_competition_athlete", {
        p_competition: competition,
        p_athlete: athleteId,
        p_entered: entered,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      // 23503: the athlete is on a start list of the competition.
      if (error.code === "23503") return "in_use";
      throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
    },
  };
}
