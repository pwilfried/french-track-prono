import { describe, it } from "vitest";

import { isReaction } from "@/domain/reveal";

import { createTestCompetition, sql } from "./contract/database";
import { reactionRepositoryContract } from "./contract/reaction-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryReactionRepository, createSupabaseReactionRepository } from "./index";

reactionRepositoryContract("in-memory fake", async () => {
  const bob = createInMemoryReactionRepository("bob", {
    annaLocked: { ownerId: "anna", locked: true },
    annaOpen: { ownerId: "anna", locked: false },
    bobLocked: { ownerId: "bob", locked: true },
  });
  return {
    bob,
    annaLocked: "annaLocked",
    annaOpen: "annaOpen",
    bobLocked: "bobLocked",
    reactionOf: async (id) => bob.reactionOf(id),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  reactionRepositoryContract("Supabase (local)", async () => {
    const [anna, bob] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    const { events } = createTestCompetition({ open: 2 });
    const open = events[0]!;
    const locked = events[1]!;
    const predict = (userId: string, eventId: string, athleteIds: string[]) =>
      sql(`insert into predictions (user_id, event_id, p1, p2, p3)
        values ('${userId}', '${eventId}', '${athleteIds[0]}', '${athleteIds[1]}', '${athleteIds[2]}')
        returning id`).trim();
    const annaOpen = predict(anna.userId, open.eventId, open.athleteIds);
    const annaLocked = predict(anna.userId, locked.eventId, locked.athleteIds);
    const bobLocked = predict(bob.userId, locked.eventId, locked.athleteIds);
    sql(`update events set lock_at = now() - interval '1 minute' where id = '${locked.eventId}'`);
    return {
      bob: createSupabaseReactionRepository(bob.client),
      annaLocked,
      annaOpen,
      bobLocked,
      reactionOf: async (id) => {
        const emoji = sql(
          `select emoji from reactions where prediction_id = '${id}' and user_id = '${bob.userId}'`,
        ).trim();
        return isReaction(emoji) ? emoji : null;
      },
    };
  });
} else {
  describe("Supabase reaction repository", () => {
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
