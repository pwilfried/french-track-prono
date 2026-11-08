import { describe, it } from "vitest";

import { competitionAdminRepositoryContract } from "./contract/competition-admin-repository.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryCompetitionAdminStore,
  createSupabaseCompetitionAdminRepository,
} from "./index";

competitionAdminRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryCompetitionAdminStore([
    { athleteId: "a1", slug: "a1", name: "Inventée", countryCode: "FRA", gender: "F" },
  ]);
  return {
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
    athleteId: "a1",
    putOnStartList: async (competition) => store.putOnStartList(competition, "a1"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  competitionAdminRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const athleteId = sql("select id from athletes where gender = 'F' order by id limit 1");
    return {
      admin: createSupabaseCompetitionAdminRepository(admin.client),
      player: createSupabaseCompetitionAdminRepository(player.client),
      athleteId,
      putOnStartList: async (competition) =>
        void sql(`with e as (
            insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
            select id, slug || '-startlist', '100 m', 'F', now() + interval '30 days', now() + interval '30 days'
            from competitions where slug = '${competition}' returning id
          ) insert into entries (event_id, athlete_id) select id, '${athleteId}' from e`),
    };
  });
} else {
  describe("Supabase competition admin repository", () => {
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
