import type { SupabaseClient } from "@supabase/supabase-js";

import type { ManagerSeasonRepository } from "@/application/manager-championship";
import { UseCaseError } from "@/application/errors";

import { readAll } from "./read-all";

type MatchdayRow = {
  round: number;
  competition_id: string | null;
  bonus: boolean;
  competition: { name: string } | null;
};
type FixtureRow = { round: number; home_id: string; away_id: string };
type ScoreRow = { competition_id: string; user_id: string; total: number };

/**
 * The participants read the schedule (#432) and the Manager scores (#431) of their leagues
 * directly, row level security keeping out everyone else.
 */
export function createSupabaseManagerSeasonRepository(
  client: SupabaseClient,
): ManagerSeasonRepository {
  return {
    async season(leagueId) {
      const [matchdays, fixtures, scores] = await Promise.all([
        // A season has a few dozen matchdays at most: one page is enough.
        client
          .from("manager_matchdays")
          .select("round, competition_id, bonus, competition:competitions(name)")
          .eq("league_id", leagueId)
          .order("round")
          .then(({ data, error }) => ({
            data: (data ?? []) as unknown as MatchdayRow[],
            error,
          })),
        readAll<FixtureRow>((from, to) =>
          client
            .from("manager_fixtures")
            .select("round, home_id, away_id")
            .eq("league_id", leagueId)
            .order("round")
            .order("home_id")
            .range(from, to),
        ),
        readAll<ScoreRow>((from, to) =>
          client
            .from("manager_scores")
            .select("competition_id, user_id, total")
            .eq("league_id", leagueId)
            .order("competition_id")
            .order("user_id")
            .range(from, to),
        ),
      ]);
      if (matchdays.error || fixtures.error || scores.error) {
        throw new UseCaseError("MANAGER_SEASON_UNAVAILABLE");
      }
      return {
        matchdays: matchdays.data.map((m) => ({
          round: m.round,
          competitionId: m.competition_id,
          competitionName: m.competition?.name ?? null,
          bonus: m.bonus,
        })),
        fixtures: fixtures.data.map((f) => ({ round: f.round, home: f.home_id, away: f.away_id })),
        scores: scores.data.map((s) => ({
          competitionId: s.competition_id,
          userId: s.user_id,
          total: s.total,
        })),
      };
    },
  };
}
