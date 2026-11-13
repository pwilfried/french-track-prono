import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerHonoursRepository } from "@/application/manager-honours";
import type { ManagerHonours } from "@/domain/manager-honours";

type StandingJson = {
  user_id: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
};
type DuelJson = {
  round: number;
  home_id: string;
  away_id: string;
  home_score: number;
  away_score: number;
};
type PlayerJson = {
  user_id: string;
  manager_points: number;
  best_athlete: { name: string; points: number } | null;
};
type HonoursRow = {
  league_id: string;
  champion_id: string | null;
  ended_at: string;
  standings: StandingJson[];
  duels: DuelJson[];
  players: PlayerJson[];
  league: { name: string } | null;
};

const COLUMNS =
  "league_id, champion_id, ended_at, standings, duels, players, league:manager_leagues(name)";

const toHonours = (row: HonoursRow): ManagerHonours => ({
  leagueId: row.league_id,
  leagueName: row.league?.name ?? "",
  endedAt: new Date(row.ended_at).toISOString(),
  championId: row.champion_id,
  standings: row.standings.map((s) => ({
    userId: s.user_id,
    rank: s.rank,
    played: s.played,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    scored: s.scored,
    conceded: s.conceded,
    difference: s.difference,
    points: s.points,
  })),
  duels: row.duels.map((d) => ({
    round: d.round,
    home: d.home_id,
    away: d.away_id,
    homeScore: d.home_score,
    awayScore: d.away_score,
  })),
  players: row.players.map((p) => ({
    userId: p.user_id,
    managerPoints: p.manager_points,
    bestAthlete: p.best_athlete && { name: p.best_athlete.name, points: p.best_athlete.points },
  })),
});

/** The participants read the frozen honours of their leagues (#434), row level security. */
export function createSupabaseManagerHonoursRepository(
  client: SupabaseClient,
): ManagerHonoursRepository {
  return {
    async find(leagueId) {
      const { data, error } = await client
        .from("manager_honours")
        .select(COLUMNS)
        .eq("league_id", leagueId)
        .maybeSingle();
      if (error) throw new UseCaseError("MANAGER_HONOURS_UNAVAILABLE");
      return data ? toHonours(data as unknown as HonoursRow) : null;
    },
    async mine() {
      // A player finishes a few seasons a year: one page is enough.
      const { data, error } = await client
        .from("manager_honours")
        .select(COLUMNS)
        .order("ended_at", { ascending: false })
        .order("league_id");
      if (error) throw new UseCaseError("MANAGER_HONOURS_UNAVAILABLE");
      return ((data ?? []) as unknown as HonoursRow[]).map(toHonours);
    },
  };
}
