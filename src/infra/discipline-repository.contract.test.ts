import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { disciplineRepositoryContract } from "./contract/discipline-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryDisciplineStore, createSupabaseDisciplineRepository } from "./index";

disciplineRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryDisciplineStore([
    { name: "100 m", family: "sprint", unit: "time", lowerIsBetter: true, tolerance: 0.05 },
    {
      name: "Saut en hauteur",
      family: "vertical_jumps",
      unit: "distance",
      lowerIsBetter: false,
      tolerance: 0.02,
    },
  ]);
  return {
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  disciplineRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const before = sql("select tolerance from disciplines where name = '100 m'");
    return {
      admin: createSupabaseDisciplineRepository(admin.client),
      player: createSupabaseDisciplineRepository(player.client),
      restore: async () =>
        void sql(`update disciplines set tolerance = ${before} where name = '100 m'`),
    };
  });
} else {
  describe("Supabase discipline repository", () => {
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
