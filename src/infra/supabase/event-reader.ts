import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { DisciplineFamily, MarkUnit } from "@/domain/discipline";
import type { EventReader } from "@/application/list-events";
import type {
  Entry,
  EventGender,
  EventStatus,
  EventSummary,
  PreviousRound,
  ResultLine,
} from "@/domain/event";
import { compareRounds, type Round } from "@/domain/rounds";

type EventRow = {
  id: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  starts_at: string;
  lock_at: string;
  is_featured: boolean;
  status: EventStatus;
  round: Round;
};

type EntryRow = {
  season_best: string | null;
  athletes: { id: string; slug: string; name: string; country_code: string };
};

type ResultRow = { athlete_id: string; rank: number; mark: string | null };

const EVENT_COLUMNS = "id, slug, discipline, gender, starts_at, lock_at, is_featured, status, round";

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
    round: row.round,
  };
}

type RoundResultRow = {
  event_id: string;
  rank: number;
  mark: string | null;
  entries: { athletes: { id: string; slug: string; name: string; country_code: string } };
};

/** The rounds leading to an event (their `parent_id` is the event), with their results. */
async function previousRounds(client: SupabaseClient, eventId: string): Promise<PreviousRound[]> {
  const rounds = await client
    .from("events")
    .select("id, slug, round, status")
    .eq("parent_id", eventId)
    .returns<{ id: string; slug: string; round: Round; status: EventStatus }[]>();
  if (rounds.error) throw new UseCaseError("EVENTS_UNAVAILABLE");
  if (rounds.data.length === 0) return [];
  // Results reach athletes through the start list (composite foreign key on entries).
  const results = await client
    .from("results")
    .select("event_id, rank, mark, entries!inner(athletes!inner(id, slug, name, country_code))")
    .in(
      "event_id",
      rounds.data.map((r) => r.id),
    )
    .order("rank")
    .returns<RoundResultRow[]>();
  if (results.error) throw new UseCaseError("EVENTS_UNAVAILABLE");
  return rounds.data
    .sort((a, b) => compareRounds(a.round, b.round) || a.slug.localeCompare(b.slug))
    .map((round) => ({
      slug: round.slug,
      round: round.round,
      status: round.status,
      results: results.data
        .filter((r) => r.event_id === round.id)
        .map(({ rank, mark, entries: { athletes: a } }) => ({
          athleteId: a.id,
          slug: a.slug,
          name: a.name,
          countryCode: a.country_code,
          rank,
          mark,
        })),
    }));
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
      const query = client
        .from("events")
        .select(`${EVENT_COLUMNS}, sub_disciplines, competitions!inner(slug, odds_enabled), disciplines(unit, tolerance, family)`)
        .eq("slug", eventSlug);
      const found = await (competitionSlug === null
        ? query
        : query.eq("competitions.slug", competitionSlug)
      ).maybeSingle<
        EventRow & {
          sub_disciplines: string[] | null;
          competitions: { slug: string; odds_enabled: boolean };
          disciplines: { unit: MarkUnit; tolerance: number | string; family: DisciplineFamily } | null;
        }
      >();
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
        previousRounds: await previousRounds(client, found.data.id),
        oddsRequired: found.data.competitions.odds_enabled,
        competitionSlug: found.data.competitions.slug,
        ...(found.data.disciplines
          ? {
              markUnit: found.data.disciplines.unit,
              markFamily: found.data.disciplines.family,
              tolerance: Number(found.data.disciplines.tolerance),
            }
          : {}),
      };
    },
  };
}
