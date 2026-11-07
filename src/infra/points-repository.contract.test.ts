import { describe, it } from "vitest";

import { DEFAULT_RULES } from "@/domain/scoring";

import { createTestEvent, sql } from "./contract/database";
import { pointsRepositoryContract } from "./contract/points-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryPointsStore, createSupabasePointsRepository } from "./index";

pointsRepositoryContract("in-memory fake", async () => {
  const [eventId, adminId, playerId] = [crypto.randomUUID(), "admin", "player"];
  const athleteIds = ["a1", "a2", "a3", "a4"];
  const store = createInMemoryPointsStore({
    [eventId]: {
      lockAt: new Date(Date.now() - 60_000).toISOString(),
      results: athleteIds.slice(0, 3).map((athleteId, i) => ({ athleteId, rank: i + 1 })),
      predictions: [
        { userId: adminId, first: "a1", second: "a2", third: "a3", useJoker: true },
        { userId: playerId, first: "a1", second: "a4", third: "a2", useJoker: false },
      ],
      rules: DEFAULT_RULES,
    },
  });
  return {
    eventId,
    athleteIds,
    adminId,
    playerId,
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  pointsRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    // An event of its own: open while the predictions are written, then locked, then its result.
    const { eventId, athleteIds: ids } = createTestEvent();
    const [a1, a2, a3, a4] = ids as [string, string, string, string];
    sql(`insert into predictions (user_id, event_id, p1, p2, p3, use_joker) values
      ('${admin.userId}', '${eventId}', '${a1}', '${a2}', '${a3}', true),
      ('${player.userId}', '${eventId}', '${a1}', '${a4}', '${a2}', false)`);
    sql(
      `update events set lock_at = now() - interval '1 minute', starts_at = now() where id = '${eventId}'`,
    );
    sql(`insert into results (event_id, athlete_id, rank) values
      ('${eventId}', '${a1}', 1), ('${eventId}', '${a2}', 2), ('${eventId}', '${a3}', 3)`);
    return {
      eventId,
      athleteIds: ids,
      adminId: admin.userId,
      playerId: player.userId,
      admin: createSupabasePointsRepository(admin.client),
      player: createSupabasePointsRepository(player.client),
    };
  });
} else {
  describe("Supabase points repository", () => {
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
