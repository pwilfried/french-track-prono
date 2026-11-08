import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { startListRepositoryContract } from "./contract/start-list-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryStartListStore, createSupabaseStartListRepository } from "./index";

startListRepositoryContract("in-memory fake", async () => {
  const eventId = crypto.randomUUID();
  const athleteIds = ["a1", "a2", "a3", "a4"];
  const store = createInMemoryStartListStore([
    ...athleteIds.map((athleteId) => ({
      athleteId,
      name: athleteId,
      countryCode: "FRA",
      gender: "F" as const,
      disciplines: ["100 m"],
    })),
    { athleteId: "stranger", name: "Stranger", countryCode: "JAM", gender: "F" },
    { athleteId: "m1", name: "Man", countryCode: "USA", gender: "M" },
  ]);
  const admin = store.session({ isAdmin: true });
  await admin.replace(
    eventId,
    athleteIds.map((athleteId) => ({ athleteId, seasonBest: null })),
  );
  return {
    eventId,
    athleteIds,
    outsiderId: "stranger",
    gender: "F",
    discipline: "100 m",
    candidateId: "a1",
    markInUse: (athleteId) => store.markInUse(eventId, [athleteId]),
    makeRound: async () => {
      store.setRound(eventId, "next-round", [
        { athleteId: "a1", rank: 1 },
        { athleteId: "a2", rank: 2 },
        { athleteId: "a3", rank: 3 },
      ]);
      return "next-round";
    },
    admin,
    player: store.session({ isAdmin: false }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  startListRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { eventId, athleteIds, outsiderId } = createTestEvent();
    return {
      eventId,
      athleteIds,
      outsiderId,
      gender: "F",
      discipline: "100 m",
      // A woman of the seed who runs the event's discipline (a start list line gives it to her).
      candidateId: sql(`with a as (select id from athletes where gender = 'F' order by id limit 1),
        en as (insert into entries (event_id, athlete_id) select '${eventId}', id from a
               on conflict do nothing)
        select id from a`),
      // A result line is enough to make an athlete impossible to remove.
      markInUse: (athleteId) =>
        void sql(
          `insert into results (event_id, athlete_id, rank) values ('${eventId}', '${athleteId}', 1)`,
        ),
      makeRound: async () => {
        const next =
          sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
          select competition_id, slug || '-final', discipline, gender, starts_at + interval '1 day',
                 lock_at + interval '1 day' from events where id = '${eventId}' returning id`);
        sql(`update events set round = 'semi', parent_id = '${next}' where id = '${eventId}'`);
        sql(`insert into results (event_id, athlete_id, rank) values
          ('${eventId}', '${athleteIds[0]}', 1), ('${eventId}', '${athleteIds[1]}', 2),
          ('${eventId}', '${athleteIds[2]}', 3)`);
        return next;
      },
      admin: createSupabaseStartListRepository(admin.client),
      player: createSupabaseStartListRepository(player.client),
    };
  });
} else {
  describe("Supabase start list repository", () => {
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
