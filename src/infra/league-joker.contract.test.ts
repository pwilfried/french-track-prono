import { describe, it } from "vitest";

import { createTestCompetition, sql } from "./contract/database";
import { leagueJokerContract } from "./contract/league-joker.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryLeagueJokerStore, createSupabaseLeagueJokerRepository } from "./index";

leagueJokerContract("in-memory fake", async () => {
  const events = ["e1", "e2", "e3"].map((id) => ({
    id,
    lockAt: new Date(Date.now() + 3_600_000).toISOString(),
  }));
  const store = createInMemoryLeagueJokerStore({
    leagues: [
      {
        id: "amis",
        members: ["anna", "bob"],
        jokers: ["double", "all_or_nothing", "safety_net", "spy", "outsider"],
        events: ["e1", "e2", "e3"],
      },
    ],
    events,
    counted: ["amis:anna:e1", "amis:anna:e2"],
  });
  return {
    leagueId: "amis",
    annaId: "anna",
    first: "e1",
    second: "e2",
    third: "e3",
    anna: store.session({ userId: "anna" }),
    bob: store.session({ userId: "bob" }),
    cleo: store.session({ userId: "cleo" }),
    lock: (id) => {
      events.find((e) => e.id === id)!.lockAt = new Date(Date.now() - 60_000).toISOString();
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  leagueJokerContract("Supabase (local)", async () => {
    const [anna, bob, cleo] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const { competitionSlug, events } = createTestCompetition({ open: 3 });
    for (const event of events) {
      const [p1, p2, p3] = event.athleteIds;
      sql(`insert into predictions (user_id, event_id, p1, p2, p3)
        values ('${anna.userId}', '${event.eventId}', '${p1}', '${p2}', '${p3}')`);
    }
    const leagueId = sql(`with l as (
        insert into leagues (name, owner_id) values ('Amis', '${anna.userId}') returning id
      ), m as (
        insert into league_members (league_id, user_id, role)
        select id, '${anna.userId}', 'owner' from l
        union all select id, '${bob.userId}', 'member' from l
      ), c as (
        insert into league_competitions (league_id, competition_id)
        select l.id, c.id from l, competitions c where c.slug = '${competitionSlug}'
      )
      select id from l`).trim();
    sql(`insert into league_predictions (league_id, user_id, event_id) values
      ('${leagueId}', '${anna.userId}', '${events[0]!.eventId}'),
      ('${leagueId}', '${anna.userId}', '${events[1]!.eventId}')`);
    return {
      leagueId,
      annaId: anna.userId,
      first: events[0]!.eventId,
      second: events[1]!.eventId,
      third: events[2]!.eventId,
      anna: createSupabaseLeagueJokerRepository(anna.client),
      bob: createSupabaseLeagueJokerRepository(bob.client),
      cleo: createSupabaseLeagueJokerRepository(cleo.client),
      lock: (eventId) =>
        sql(`update events set lock_at = now() - interval '1 minute' where id = '${eventId}'`),
    };
  });
} else {
  describe("Supabase league joker repository", () => {
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
