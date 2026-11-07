import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
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
    const { eventId, athleteIds, outsiderId } = createTestEvent();
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
