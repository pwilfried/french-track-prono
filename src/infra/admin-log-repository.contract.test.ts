import { describe, it } from "vitest";

import { adminLogRepositoryContract } from "./contract/admin-log-repository.contract";
import { createTestCompetition, sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryAdminLogStore,
  createSupabaseAdminLogRepository,
  createSupabaseStartListRepository,
} from "./index";

adminLogRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryAdminLogStore();
  const eventIds: [string, string] = [crypto.randomUUID(), crypto.randomUUID()];
  let clock = Date.parse("2026-09-12T20:00:00Z");
  return {
    adminId: "admin-1",
    adminPseudo: "Admin",
    eventIds,
    act: async (eventId) => {
      store.record({
        id: crypto.randomUUID(),
        at: new Date((clock += 1000)).toISOString(),
        kind: "set_start_list",
        admin: { id: "admin-1", pseudo: "Admin" },
        event: { id: eventId, slug: eventId, discipline: "100 m", gender: "F" },
        size: 4,
      });
    },
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  adminLogRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { events } = createTestCompetition({ open: 2 });
    const startLists = createSupabaseStartListRepository(admin.client);
    return {
      adminId: admin.userId,
      adminPseudo: sql(`select pseudo from profiles where id = '${admin.userId}'`),
      eventIds: [events[0]!.eventId, events[1]!.eventId],
      act: async (eventId) => {
        const event = events.find((e) => e.eventId === eventId)!;
        const outcome = await startLists.replace(
          eventId,
          event.athleteIds.map((athleteId) => ({ athleteId, seasonBest: null })),
        );
        if (outcome !== "saved") throw new Error(`could not act: ${outcome}`);
      },
      admin: createSupabaseAdminLogRepository(admin.client),
      player: createSupabaseAdminLogRepository(player.client),
    };
  });
} else {
  describe("Supabase admin log repository", () => {
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
