import { describe, it } from "vitest";

import { badgeLevelContract } from "./contract/badge-level.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryBadgeLevelStore, createSupabaseBadgeLevelRepository } from "./index";

badgeLevelContract("in-memory fake", async () => {
  const store = createInMemoryBadgeLevelStore();
  return {
    userId: "me",
    levels: store.session("me"),
    other: { userId: "other", levels: store.session("other") },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  badgeLevelContract("Supabase (local)", async () => {
    const [me, other] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    return {
      userId: me.userId,
      levels: createSupabaseBadgeLevelRepository(me.client),
      other: { userId: other.userId, levels: createSupabaseBadgeLevelRepository(other.client) },
    };
  });
} else {
  describe("Supabase badge level repository", () => {
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
