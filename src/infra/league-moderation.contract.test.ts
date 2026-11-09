import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { leagueModerationContract } from "./contract/league-moderation.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryLeagueStore,
  createSupabaseLeagueModerationRepository,
  createSupabaseLeagueRepository,
} from "./index";

leagueModerationContract("in-memory fake", async () => {
  const store = createInMemoryLeagueStore();
  const player = (id: string) => store.session({ userId: id, pseudo: id, avatar: "🦅" });
  return {
    creator: player("creator"),
    reporter: player("reporter"),
    admin: store.moderation({ isAdmin: true }),
    notAdmin: store.moderation({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  leagueModerationContract("Supabase (local)", async () => {
    const [creator, reporter, admin] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    return {
      creator: createSupabaseLeagueRepository(creator.client),
      reporter: createSupabaseLeagueRepository(reporter.client),
      admin: createSupabaseLeagueModerationRepository(admin.client),
      notAdmin: createSupabaseLeagueModerationRepository(reporter.client),
    };
  });
} else {
  describe("Supabase league moderation repository", () => {
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
