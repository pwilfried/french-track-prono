import { describe, it } from "vitest";

import { athleteAdminRepositoryContract } from "./contract/athlete-admin-repository.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryAthleteAdminStore, createSupabaseAthleteAdminRepository } from "./index";

athleteAdminRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryAthleteAdminStore([
    {
      athleteId: "a1",
      slug: "inventee",
      name: "Inventée",
      countryCode: "USA",
      gender: "F",
      disciplines: [{ discipline: "100 m", isPrimary: true }],
      records: [],
    },
  ]);
  return {
    athleteId: "a1",
    slug: "inventee",
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  athleteAdminRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const slug = `inventee-${crypto.randomUUID().slice(0, 8)}`;
    const athleteId = sql(`insert into athletes (slug, name, country_code, gender)
      values ('${slug}', 'Inventée', 'USA', 'F') returning id`);
    return {
      athleteId,
      slug,
      admin: createSupabaseAthleteAdminRepository(admin.client),
      player: createSupabaseAthleteAdminRepository(player.client),
    };
  });
} else {
  describe("Supabase athlete admin repository", () => {
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
