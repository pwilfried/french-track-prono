import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { LineupSaveOutcome, ManagerLineupRepository } from "@/application/manager-lineup";

/** The answers of save_manager_lineup (supabase/migrations, #427, #1032). */
const refusals: Record<string, Exclude<LineupSaveOutcome, "saved">> = {
  "42501": "not_member",
  "22P02": "not_member",
  P0002: "not_eligible",
  FT022: "mercato_open",
  FT023: "locked",
  FT024: "invalid",
  FT036: "discipline_not_entered",
  FT037: "substitute_other_family",
  FT038: "substitute_not_on_bench",
  FT039: "substitute_twice",
  FT040: "implausible_threshold",
  FT041: "bench_full",
  FT042: "threshold_without_substitute",
};

type LineupRow = {
  competition_id: string;
  slug: string;
  name: string;
  starts_on: string;
  lock_at: string;
  entered: string[];
  athlete_ids: string[] | null;
  carried_from_name: string | null;
};

/**
 * The player's session. Row level security shows a player their own lineups; the database checks
 * a lineup against the rules of the league and refuses any change after the lock.
 */
export function createSupabaseManagerLineups(client: SupabaseClient): ManagerLineupRepository {
  return {
    async mine(leagueId) {
      const { data, error } = await client.rpc("my_manager_lineups", { p_league: leagueId });
      if (error && refusals[error.code] === "not_member") return "not_member";
      if (error) throw new UseCaseError("LINEUPS_UNAVAILABLE");
      return ((data ?? []) as LineupRow[]).map((row) => ({
        competitionId: row.competition_id,
        slug: row.slug,
        name: row.name,
        startsOn: row.starts_on,
        lockAt: new Date(row.lock_at).toISOString(),
        entered: row.entered,
        lineup: row.athlete_ids,
        ...(row.carried_from_name ? { carriedFrom: row.carried_from_name } : {}),
      }));
    },
    async save(leagueId, competitionId, sheet) {
      const { error } = await client.rpc("save_manager_lineup", {
        p_league: leagueId,
        p_competition: competitionId,
        p_sheet: {
          starters: sheet.starters.map((s) => ({
            athlete: s.athleteId,
            discipline: s.discipline ?? null,
            substitute: s.substituteId ?? null,
            threshold: s.threshold ?? null,
          })),
          bench: sheet.bench.map((s) => ({ athlete: s.athleteId, discipline: s.discipline ?? null })),
        },
      });
      if (!error) return "saved";
      const refusal = refusals[error.code];
      if (refusal) return refusal;
      throw new UseCaseError("LINEUPS_UNAVAILABLE");
    },
  };
}
