import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { oddsRepositoryContract } from "./contract/odds-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryOddsStore, createSupabaseOddsRepository } from "./index";

oddsRepositoryContract("in-memory fake", async () => {
  const startList = ["a", "b", "c", "d", "e", "f"];
  const marks = [{ athleteId: "a", pr: "10.65", sb: null }];
  const store = createInMemoryOddsStore([
    { eventId: "open", startList, locked: false, marks },
    { eventId: "locked", startList, locked: true, marks },
  ]);
  return {
    openEventId: "open",
    lockedEventId: "locked",
    startList,
    withPr: { athleteId: "a", pr: "10.65" },
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  oddsRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const tag = crypto.randomUUID().slice(0, 8);
    // An invented athlete with a PR of her own, so no seed record changes.
    const invented = sql(`insert into athletes (slug, name, country_code, gender)
      values ('odds-${tag}', 'Inventée ${tag}', 'FRA', 'F') returning id`);
    const ids = [
      invented,
      ...sql(
        `select string_agg(id::text, ',' order by id)
         from (select id from athletes where id <> '${invented}' order by id limit 5) a`,
      ).split(","),
    ];
    const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('odds-${tag}', 'Odds ${tag}', current_date, current_date + 1) returning id`);
    const event = (slug: string, lock: string) =>
      sql(`with e as (
          insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
          values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day', ${lock}) returning id
        ), s as (insert into entries (event_id, athlete_id) select e.id, a::uuid from e, unnest(array['${ids.join("','")}']) a)
        select id from e`);
    const openEventId = event(`odds-${tag}-open`, "now() + interval '1 hour'");
    const lockedEventId = event(`odds-${tag}-locked`, "now() - interval '1 hour'");
    sql(`insert into athlete_records (athlete_id, discipline, kind, mark, mark_value)
      values ('${invented}', '100 m', 'pr', '10.10', 10.10)`);
    return {
      openEventId,
      lockedEventId,
      startList: ids,
      withPr: { athleteId: invented, pr: "10.10" },
      admin: createSupabaseOddsRepository(admin.client),
      player: createSupabaseOddsRepository(player.client),
    };
  });
} else {
  describe("Supabase odds repository", () => {
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
