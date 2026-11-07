import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { resultRepositoryContract } from "./contract/result-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryResultStore, createSupabaseResultRepository } from "./index";

resultRepositoryContract("in-memory fake", async () => {
  const eventId = crypto.randomUUID();
  const athleteIds = ["a1", "a2", "a3", "a4"];
  const store = createInMemoryResultStore([{ id: eventId, athleteIds }]);
  return {
    eventId,
    athleteIds,
    outsiderId: "stranger",
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  resultRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    // An event of its own with four athletes, and a fifth one not on its start list.
    const slug = `test-results-${crypto.randomUUID().slice(0, 8)}`;
    const ids = sql(
      "select string_agg(id::text, ',' order by id) from (select id from athletes order by id limit 5) a",
    ).split(",");
    const athleteIds = ids.slice(0, 4);
    const outsiderId = ids[4]!;
    const eventId = sql(`
      with e as (
        insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
        select competition_id, '${slug}', discipline, gender, starts_at, lock_at
        from events where slug = 'f-100m' returning id
      ), s as (
        insert into entries (event_id, athlete_id)
        select e.id, a.id::uuid from e, unnest(array['${athleteIds.join("','")}']) as a(id)
        returning event_id
      )
      select id from e`);
    return {
      eventId,
      athleteIds,
      outsiderId,
      admin: createSupabaseResultRepository(admin.client),
      player: createSupabaseResultRepository(player.client),
    };
  });
} else {
  describe("Supabase result repository", () => {
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
