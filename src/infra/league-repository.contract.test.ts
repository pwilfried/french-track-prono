import { describe, it } from "vitest";

import { leagueRepositoryContract } from "./contract/league-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryLeagueStore, createSupabaseLeagueRepository } from "./index";

leagueRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryLeagueStore();
  return {
    competitionSlug: "ultimate-championship-2026",
    newPlayer: async () => {
      const userId = crypto.randomUUID();
      return {
        userId,
        leagues: store.session({ userId, pseudo: userId.slice(0, 8), avatar: "🦅" }),
      };
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  leagueRepositoryContract("Supabase (local)", async () => ({
    competitionSlug: "ultimate-championship-2026",
    newPlayer: async () => {
      const player = await signedInPlayer(url, key);
      return { userId: player.userId, leagues: createSupabaseLeagueRepository(player.client) };
    },
  }));
} else {
  describe("Supabase league repository", () => {
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
