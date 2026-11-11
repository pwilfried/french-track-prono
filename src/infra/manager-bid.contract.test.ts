import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { managerBidContract } from "./contract/manager-bid.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerBidStore, createSupabaseManagerBids } from "./index";

managerBidContract("in-memory fake", async () => {
  const store = createInMemoryManagerBidStore({
    budget: 100,
    prices: { a1: 10, a2: 20 },
    members: { l1: ["u1", "u2"], l2: ["u1"] },
  });
  store.openMercato("l1");
  return {
    leagueId: "l1",
    closedLeagueId: "l2",
    first: store.session("u1"),
    second: store.session("u2"),
    outsider: store.session("u3"),
    cheap: "a1",
    dear: "a2",
    closeRound: async () => store.closeRound("l1"),
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerBidContract("Supabase (local)", async () => {
    const [first, second, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const league = async (name: string) => {
      const { data, error } = await first.client.rpc("create_manager_league", {
        p_name: name,
        p_public: false,
      });
      if (error) throw new Error(error.message);
      return data as string;
    };
    const leagueId = await league("Enchères");
    const closedLeagueId = await league("Pas encore");
    const code = sql(`select invite_code from manager_leagues where id = '${leagueId}'`);
    const joined = await second.client.rpc("join_manager_league", { p_code: code });
    if (joined.error) throw new Error(joined.error.message);
    sql(`update manager_leagues set rules = jsonb_set(rules, '{budget}', '100')
         where id in ('${leagueId}', '${closedLeagueId}')`);
    sql(`update manager_leagues set mercato_opened_at = now() - interval '1 minute'
         where id = '${leagueId}'`);
    // Two athletes of the catalogue, not the one the catalogue contract prices.
    const athlete = (offset: number) =>
      sql(`select a.id from athletes a
        join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
        join disciplines d on d.name = ad.discipline
        where a.kind = 'athlete' and a.gender in ('F', 'M') and d.family <> 'relay'
        order by a.slug offset ${offset} limit 1`);
    const [cheap, dear] = [athlete(1), athlete(2)];
    const before = sql(`select string_agg(id || '=' || coalesce(manager_price::text, 'null'), ',')
      from athletes where id in ('${cheap}', '${dear}')`);
    sql(`update athletes set manager_price = case id when '${cheap}' then 10 else 20 end
         where id in ('${cheap}', '${dear}')`);
    return {
      leagueId,
      closedLeagueId,
      first: createSupabaseManagerBids(first.client),
      second: createSupabaseManagerBids(second.client),
      outsider: createSupabaseManagerBids(outsider.client),
      cheap,
      dear,
      closeRound: async () => {
        // Round 1 lasts 48 hours (rules copied at creation): move the opening 48 hours back so
        // the round is due, close it, then move the opening forward again, as if the clock had
        // moved on instead (otherwise the next round would end earlier than the one closed).
        const shift = (sign: "+" | "-") =>
          sql(`update manager_leagues set mercato_opened_at = mercato_opened_at ${sign} interval '48 hours'
               where id = '${leagueId}'`);
        shift("-");
        sql(`select private.close_manager_rounds()`);
        shift("+");
      },
      restore: async () => {
        sql(`delete from manager_leagues where id in ('${leagueId}', '${closedLeagueId}')`);
        for (const pair of before.split(",")) {
          const [id, price] = pair.split("=");
          sql(`update athletes set manager_price = ${price} where id = '${id}'`);
        }
      },
    };
  });
} else {
  describe("Supabase Manager bids", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
