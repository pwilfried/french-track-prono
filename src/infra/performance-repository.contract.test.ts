import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { createManagerLeagueAs } from "./contract/manager-competitions";
import { performanceRepositoryContract } from "./contract/performance-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryPerformanceStore, createSupabasePerformanceRepository } from "./index";

performanceRepositoryContract("in-memory fake", async () => {
  const eventId = crypto.randomUUID();
  const athleteIds = ["a1", "a2", "a3", "a4"];
  const store = createInMemoryPerformanceStore([{ id: eventId, athleteIds }]);
  return {
    eventId,
    athleteIds,
    outsiderId: "stranger",
    lineUp: async (ids) => store.lineUp(eventId, ids),
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  performanceRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { eventId, athleteIds, outsiderId } = createTestEvent();
    return {
      eventId,
      athleteIds,
      outsiderId,
      // A Manager league of the player's own, with a lineup for the event's competition (its
      // predictions lock in an hour, so the lineup is still open).
      lineUp: async (ids) => {
        const leagueId = await createManagerLeagueAs(player.client, "Performances");
        sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
          select '${leagueId}', competition_id, '${player.userId}',
                 array[${ids.map((id) => `'${id}'`).join(", ")}]::uuid[]
          from events where id = '${eventId}'`);
      },
      admin: createSupabasePerformanceRepository(admin.client),
      player: createSupabasePerformanceRepository(player.client),
    };
  });
} else {
  describe("Supabase performance repository", () => {
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
