import { describe, it } from "vitest";

import { competitionEditRepositoryContract } from "./contract/competition-edit-repository.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryCompetitionAdminStore,
  createSupabaseCompetitionAdminRepository,
  createSupabaseCompetitionEditRepository,
} from "./index";

competitionEditRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryCompetitionAdminStore([]);
  return {
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
    predict: async (eventSlug) => store.predict(eventSlug),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  competitionEditRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const both = (client: typeof admin.client) => ({
      ...createSupabaseCompetitionAdminRepository(client),
      ...createSupabaseCompetitionEditRepository(client),
    });
    return {
      admin: both(admin.client),
      player: both(player.client),
      // Three athletes on the start list and the player's podium, written as the database owner.
      predict: async (eventSlug) => {
        // Created in the back-office, the competition plays with odds: without them for this test.
        sql(`update competitions set odds_enabled = false
          where id = (select competition_id from events where slug = '${eventSlug}')`);
        sql(`with e as (select id from events where slug = '${eventSlug}'),
            a as (select id, row_number() over (order by id) n from athletes order by id limit 3),
            en as (insert into entries (event_id, athlete_id) select e.id, a.id from e, a returning athlete_id)
          insert into predictions (user_id, event_id, p1, p2, p3)
          select '${player.userId}', e.id,
                 (select id from a where n = 1), (select id from a where n = 2), (select id from a where n = 3)
          from e`);
      },
    };
  });
} else {
  describe("Supabase competition edit repository", () => {
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
