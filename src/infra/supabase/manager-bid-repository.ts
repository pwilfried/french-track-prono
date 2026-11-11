import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { BidOutcome, ManagerBidRepository } from "@/application/manager-bids";

/** The answers of place_manager_bid and withdraw_manager_bid (supabase/migrations, #422). */
const refusals: Record<string, Exclude<BidOutcome, "placed">> = {
  "42501": "not_member",
  "22P02": "not_member",
  FT016: "mercato_closed",
  P0002: "not_in_catalogue",
  FT017: "below_price",
  FT018: "over_budget",
};

/**
 * The player's session. Row level security shows a player their own bids only; the database
 * checks the price, the budget and the opening of the mercato.
 */
export function createSupabaseManagerBids(client: SupabaseClient): ManagerBidRepository {
  return {
    async mine(leagueId) {
      const league = await client
        .from("manager_leagues")
        .select("rules, mercato_opened_at")
        .eq("id", leagueId)
        .maybeSingle();
      if (league.error?.code === "22P02") return "not_member";
      if (league.error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      if (!league.data) return "not_member";
      const bids = await client
        .from("manager_bids")
        .select("athlete_id, amount, bid_at")
        .eq("league_id", leagueId)
        .order("bid_at");
      if (bids.error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      const opened = league.data.mercato_opened_at as string | null;
      return {
        budget: Number((league.data.rules as { budget: number }).budget),
        mercatoOpen: opened !== null && Date.parse(opened) <= Date.now(),
        bids: bids.data.map((b) => ({
          athleteId: b.athlete_id as string,
          amount: b.amount as number,
          bidAt: b.bid_at as string,
        })),
      };
    },
    async place(leagueId, athleteId, amount) {
      const { error } = await client.rpc("place_manager_bid", {
        p_league: leagueId,
        p_athlete: athleteId,
        p_amount: amount,
      });
      if (!error) return "placed";
      const refusal = refusals[error.code];
      if (refusal) return refusal;
      throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    },
    async withdraw(leagueId, athleteId) {
      const { error } = await client.rpc("withdraw_manager_bid", {
        p_league: leagueId,
        p_athlete: athleteId,
      });
      if (!error) return "withdrawn";
      const refusal = refusals[error.code];
      if (refusal === "not_member" || refusal === "mercato_closed") return refusal;
      throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    },
  };
}
