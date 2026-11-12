import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { ManagerRevealRepository } from "@/application/manager-reveal";

/**
 * The player's session (#604). Row level security shows every participant the bids of the closed
 * rounds (manager_round_bids) and an outsider nothing; manager_bid_rounds says which rounds the
 * player saw, mark_manager_round_revealed records it.
 */
export function createSupabaseManagerReveals(client: SupabaseClient): ManagerRevealRepository {
  /** A league the player reads is one they take part in. */
  const member = async (leagueId: string) => {
    const { data, error } = await client
      .from("manager_leagues")
      .select("id")
      .eq("id", leagueId)
      .maybeSingle();
    if (error?.code === "22P02") return false;
    if (error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    return data !== null;
  };
  return {
    async bidRounds(leagueId) {
      if (!(await member(leagueId))) return "not_member";
      const { data, error } = await client.rpc("manager_bid_rounds", { p_league: leagueId });
      if (error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      return (data as { round: number; seen: boolean }[]).map(({ round, seen }) => ({
        round,
        seen,
      }));
    },
    async roundBids(leagueId, round) {
      if (!(await member(leagueId))) return "not_member";
      const { data, error } = await client
        .from("manager_round_bids")
        .select("user_id, athlete_id, amount, won")
        .eq("league_id", leagueId)
        .eq("round", round);
      if (error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      return data.map((b) => ({
        userId: b.user_id as string,
        athleteId: b.athlete_id as string,
        amount: b.amount as number,
        won: b.won as boolean,
      }));
    },
    async markRevealed(leagueId, round) {
      const { error } = await client.rpc("mark_manager_round_revealed", {
        p_league: leagueId,
        p_round: round,
      });
      if (!error) return "marked";
      if (error.code === "42501" || error.code === "22P02") return "not_member";
      if (error.code === "P0002") return "not_closed";
      throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    },
  };
}
