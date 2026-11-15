import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { FrenchTrackRepository } from "@/application/frenchtrack";
import { bibOf } from "@/domain/bib";
import type { EventGender } from "@/domain/event";

type ChallengeRow = {
  locked: boolean;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  points: number | null;
  mine: number | null;
  scores: number[] | null;
};
type SummaryRow = {
  event_id: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  starts_at: string;
  lock_at: string;
  points: number | null;
  mine: number | null;
  scored_at: string | null;
  scores: number[] | null;
};
type SeasonRow = {
  event_id: string;
  frenchtrack_points: number;
  user_id: string;
  pseudo: string;
  bib_number: number;
  bib_color: string;
  points: number;
};

const iso = (instant: string) => new Date(instant).toISOString();

/**
 * The client carries the player's (or the admin's) session: the functions of #674 hide the podium
 * before the lock and refuse a player who is not an admin (42501), a locked event (FT034), an
 * athlete outside the start list (23503) or twice on the podium (23514).
 */
export function createSupabaseFrenchTrackRepository(client: SupabaseClient): FrenchTrackRepository {
  const fail = (): never => {
    throw new UseCaseError("FRENCHTRACK_UNAVAILABLE");
  };

  return {
    async challenge(eventId) {
      const { data, error } = await client.rpc("frenchtrack_challenge", { p_event: eventId });
      if (error) fail();
      const row = ((data ?? []) as ChallengeRow[])[0];
      if (!row) return null;
      return {
        locked: row.locked,
        podium: row.p1 && row.p2 && row.p3 ? { first: row.p1, second: row.p2, third: row.p3 } : null,
        points: row.points,
        mine: row.mine,
        scores: row.scores ?? [],
      };
    },

    async challenges(year) {
      const { data, error } = await client.rpc("frenchtrack_challenges", { p_year: year });
      if (error) fail();
      return ((data ?? []) as SummaryRow[]).map((row) => ({
        eventId: row.event_id,
        slug: row.slug,
        discipline: row.discipline,
        gender: row.gender,
        startsAt: iso(row.starts_at),
        lockAt: iso(row.lock_at),
        points: row.points,
        mine: row.mine,
        scoredAt: row.scored_at ? iso(row.scored_at) : null,
        scores: row.scores ?? [],
      }));
    },

    async season(year) {
      const { data, error } = await client.rpc("frenchtrack_season", { p_year: year });
      if (error) fail();
      return ((data ?? []) as SeasonRow[]).map((row) => ({
        eventId: row.event_id,
        userId: row.user_id,
        pseudo: row.pseudo,
        bib: bibOf(row.bib_number, row.bib_color),
        points: row.points,
        frenchTrackPoints: row.frenchtrack_points,
      }));
    },

    async savePick(eventId, podium) {
      const { error } = await client.rpc("admin_set_frenchtrack_pick", {
        p_event: eventId,
        p_p1: podium.first,
        p_p2: podium.second,
        p_p3: podium.third,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      if (error.code === "FT034") return "locked";
      if (error.code === "23503" || error.code === "23514" || error.code === "22P02") {
        return "invalid";
      }
      return fail();
    },

    async removePick(eventId) {
      const { error } = await client.rpc("admin_remove_frenchtrack_pick", { p_event: eventId });
      if (!error) return "removed";
      if (error.code === "42501") return "not_admin";
      if (error.code === "FT034") return "locked";
      return fail();
    },

    async saveScore(eventId, points) {
      const { error } = await client.rpc("admin_set_frenchtrack_points", {
        p_event: eventId,
        p_points: points,
      });
      if (!error) return "saved";
      if (error.code === "42501") return "not_admin";
      return fail();
    },
  };
}
