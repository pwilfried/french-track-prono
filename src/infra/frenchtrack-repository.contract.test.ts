import { describe, it } from "vitest";

import { createTestCompetition, sql } from "./contract/database";
import { frenchTrackRepositoryContract } from "./contract/frenchtrack-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryFrenchTrackStore, createSupabaseFrenchTrackRepository } from "./index";

frenchTrackRepositoryContract("in-memory fake", async () => {
  const startsAt = "2026-08-12T19:00:00.000Z";
  const event = (eventId: string) => ({
    eventId,
    slug: eventId,
    discipline: "100 m",
    gender: "F" as const,
    startsAt,
    lockAt: startsAt,
    startList: ["a", "b", "c", "d"],
    locked: false,
  });
  const store = createInMemoryFrenchTrackStore([event("e1"), event("e2")]);
  return {
    eventId: "e1",
    otherEventId: "e2",
    athleteIds: ["a", "b", "c", "d"],
    outsiderId: "z",
    year: 2026,
    adminId: "admin",
    bobId: "bob",
    admin: store.session({ userId: "admin", isAdmin: true }),
    bob: store.session({ userId: "bob", isAdmin: false }),
    lock: (eventId) => store.lock(eventId),
    score: (eventId, lines) => store.score(eventId, lines),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  frenchTrackRepositoryContract("Supabase (local)", async () => {
    const [admin, bob] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { events, outsiderId } = createTestCompetition({ open: 2 });
    const first = events[0]!;
    const year = sql(`select extract(year from starts_at at time zone 'Europe/Paris')::int
      from events where id = '${first.eventId}'`);
    return {
      eventId: first.eventId,
      otherEventId: events[1]!.eventId,
      athleteIds: first.athleteIds,
      outsiderId,
      year: Number(year),
      adminId: admin.userId,
      bobId: bob.userId,
      admin: createSupabaseFrenchTrackRepository(admin.client),
      bob: createSupabaseFrenchTrackRepository(bob.client),
      lock: (eventId) =>
        void sql(`update events set lock_at = now() - interval '1 minute' where id = '${eventId}'`),
      score: (eventId, lines) =>
        void sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason)
          select l.user_id::uuid, e.competition_id, e.id, 'prediction', l.points, 'prediction'
          from events e, (values ${Object.entries(lines)
            .map(([userId, points]) => `('${userId}', ${points})`)
            .join(", ")}) as l(user_id, points)
          where e.id = '${eventId}'`),
    };
  });
} else {
  describe("Supabase FrenchTrack repository", () => {
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
