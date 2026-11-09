import { describe, it } from "vitest";

import { clubAdminContract } from "./contract/club-admin.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryClubAdminStore, createSupabaseClubAdminRepository } from "./index";

clubAdminContract("in-memory fake", async () => {
  const store = createInMemoryClubAdminStore();
  return {
    admin: store.session({ isAdmin: true }),
    notAdmin: store.session({ isAdmin: false }),
    async playerClub(name) {
      return store.add({ name, city: "", department: "", source: "player", validated: false });
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  clubAdminContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    return {
      admin: createSupabaseClubAdminRepository(admin.client),
      notAdmin: createSupabaseClubAdminRepository(player.client),
      async playerClub(name) {
        return sql(`insert into clubs (name, source, created_by)
          values ('${name.replaceAll("'", "''")}', 'player', '${player.userId}') returning id`);
      },
    };
  });
} else {
  describe("Supabase club admin repository", () => {
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
