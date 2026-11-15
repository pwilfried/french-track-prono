import { describe, it } from "vitest";

import { communityContract } from "./contract/community.contract";
import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryCommunityStore, createSupabaseCommunityRepository } from "./index";

communityContract("in-memory fake", async () => {
  const store = createInMemoryCommunityStore();
  return {
    admin: store.as("admin", { admin: true }),
    voter: store.as("ana"),
    other: store.as("bob"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  communityContract("Supabase (local)", async () => {
    const [admin, voter, other] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    return {
      admin: createSupabaseCommunityRepository(admin.client),
      voter: createSupabaseCommunityRepository(voter.client),
      other: createSupabaseCommunityRepository(other.client),
    };
  });
} else {
  describe("Supabase community repository", () => {
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
