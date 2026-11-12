import type { SupabaseClient } from "@supabase/supabase-js";

import { UseCaseError } from "@/application/errors";
import type { BidOutcome, ManagerBidRepository } from "@/application/manager-bids";
import { roundEndsAt, type RoundRules } from "@/domain/manager-round";

/**
 * The answers of place_manager_bid, withdraw_manager_bid and close_manager_mercato
 * (supabase/migrations, #422, #423, #424; FT021 is the close's own).
 */
const refusals: Record<string, Exclude<BidOutcome, "placed">> = {
  "42501": "not_member",
  "22P02": "not_member",
  FT016: "mercato_closed",
  FT020: "round_closing",
  P0002: "not_in_catalogue",
  FT019: "taken",
  FT017: "below_price",
  FT018: "over_budget",
};

type LeagueRules = { budget: number; rounds?: RoundRules };

/**
 * The player's session. Row level security shows a player their own bids and athletes only; the
 * database checks the price, the budget, the opening of the mercato and the time of the round.
 */
export function createSupabaseManagerBids(client: SupabaseClient): ManagerBidRepository {
  return {
    async mine(leagueId) {
      const league = await client
        .from("manager_leagues")
        .select("rules, mercato_opened_at, mercato_closed_at")
        .eq("id", leagueId)
        .maybeSingle();
      if (league.error?.code === "22P02") return "not_member";
      if (league.error) throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      if (!league.data) return "not_member";
      const [bids, awards, rounds, canClose] = await Promise.all([
        client
          .from("manager_bids")
          .select("athlete_id, amount, bid_at")
          .eq("league_id", leagueId)
          .order("bid_at"),
        client
          .from("manager_awards")
          .select("athlete_id, amount, round")
          .eq("league_id", leagueId)
          .order("round"),
        client.from("manager_rounds").select("round", { count: "exact", head: true }).eq(
          "league_id",
          leagueId,
        ),
        client.rpc("can_close_manager_mercato", { p_league: leagueId }),
      ]);
      if (bids.error || awards.error || rounds.error || canClose.error) {
        throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
      }
      const rules = league.data.rules as LeagueRules;
      const opened = league.data.mercato_opened_at as string | null;
      const closed = league.data.mercato_closed_at !== null;
      return {
        budget: Number(rules.budget),
        mercatoOpen: opened !== null && Date.parse(opened) <= Date.now() && !closed,
        mercatoClosed: closed,
        canClose: canClose.data === true,
        roundEndsAt:
          opened !== null && !closed && rules.rounds
            ? roundEndsAt(opened, rules.rounds, (rounds.count ?? 0) + 1)
            : null,
        team: awards.data.map((a) => ({
          athleteId: a.athlete_id as string,
          amount: a.amount as number,
          round: a.round as number,
        })),
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
      if (refusal === "not_member" || refusal === "mercato_closed" || refusal === "round_closing") {
        return refusal;
      }
      throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    },
    async close(leagueId) {
      const { error } = await client.rpc("close_manager_mercato", { p_league: leagueId });
      if (!error) return "closed";
      if (error.code === "FT021") return "not_last_bidder";
      const refusal = refusals[error.code];
      if (refusal === "not_member" || refusal === "mercato_closed") return refusal;
      throw new UseCaseError("MANAGER_BIDS_UNAVAILABLE");
    },
  };
}
