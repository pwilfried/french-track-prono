import type { SupabaseClient } from "@supabase/supabase-js";

import type { CompetitionEditRepository } from "@/application/edit-competition";
import { UseCaseError } from "@/application/errors";

type Outcome = "saved" | "not_admin" | "unknown" | "has_predictions";

/** 42501 not admin, FT004 unknown, FT008 already predicted (see the edit_competitions migration). */
function outcomeOf(error: { code?: string } | null): Outcome {
  if (!error) return "saved";
  if (error.code === "42501") return "not_admin";
  if (error.code === "FT004") return "unknown";
  if (error.code === "FT008") return "has_predictions";
  throw new UseCaseError("COMPETITIONS_UNAVAILABLE");
}

/** Corrections in the back-office; the client carries the admin's session. */
export function createSupabaseCompetitionEditRepository(
  client: SupabaseClient,
): CompetitionEditRepository {
  return {
    async update(slug, f) {
      const { error } = await client.rpc("admin_update_competition", {
        p_slug: slug,
        p_name: f.name,
        p_scope: f.scope,
        p_city: f.city ?? "",
        p_country: f.countryCode ?? "",
        p_starts_on: f.startsOn,
        p_ends_on: f.endsOn,
        p_time_zone: f.timeZone,
      });
      const outcome = outcomeOf(error);
      return outcome === "has_predictions" ? "saved" : outcome;
    },
    async remove(slug) {
      const { error } = await client.rpc("admin_delete_competition", { p_slug: slug });
      return outcomeOf(error);
    },
    async updateEvent(eventSlug, change) {
      const { error } = await client.rpc("admin_update_event", {
        p_slug: eventSlug,
        p_round: change.round,
        p_starts_at: change.startsAt,
        p_lock_at: change.lockAt,
      });
      return outcomeOf(error);
    },
    async removeEvent(eventSlug) {
      const { error } = await client.rpc("admin_delete_event", { p_slug: eventSlug });
      return outcomeOf(error);
    },
  };
}
