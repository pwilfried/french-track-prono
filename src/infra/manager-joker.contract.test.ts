import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { managerJokerContract } from "./contract/manager-joker.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerJokerStore, createSupabaseManagerJokerRepository } from "./index";

const JOKERS = ["captain", "false_start", "extended_bench", "coaching", "home_advantage"];

managerJokerContract("in-memory fake", async () => {
  const later = new Date(Date.now() + 3_600_000).toISOString();
  const locks: Record<string, string> = { c1: later, c2: later, c3: later, c4: later };
  const store = createInMemoryManagerJokerStore({
    leagues: [
      {
        id: "L",
        members: ["anna", "bob"],
        jokers: JOKERS,
        teams: { anna: ["a1", "a2", "a3"], bob: ["b1"] },
        matchdays: [
          { competitionId: "c1", bonus: false, fixtures: [{ home: "anna", away: "bob" }] },
          { competitionId: "c2", bonus: false, fixtures: [{ home: "bob", away: "anna" }] },
          { competitionId: "c3", bonus: false, fixtures: [{ home: "anna", away: "bob" }] },
          { competitionId: "c4", bonus: true, fixtures: [] },
        ],
        sheets: { "anna:c3": ["a1"] },
      },
    ],
    locks,
  });
  // Anna chooses the coaching for c3, then its lineup locks.
  const anna = store.session({ userId: "anna" });
  await anna.play("L", "c3", "coaching", null);
  locks.c3 = new Date(Date.now() - 60_000).toISOString();
  return {
    leagueId: "L",
    annaId: "anna",
    bobId: "bob",
    annaTeam: ["a1", "a2", "a3"],
    bobTeam: ["b1"],
    open: "c1",
    away: "c2",
    bonus: "c4",
    locked: "c3",
    anna,
    bob: store.session({ userId: "bob" }),
    cleo: store.session({ userId: "cleo" }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerJokerContract("Supabase (local)", async () => {
    const [anna, bob, cleo] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    // Four competitions of their own, each with one 100 m; four athletes of their own, sprinters
    // (the coaching keeps a family), entered in each.
    const [open, away, locked, bonus] = [1, 2, 3, 4].map(() => {
      const { competitionSlug, eventId } = createTestEvent();
      const id = sql(`select id from competitions where slug = '${competitionSlug}'`);
      return { id, eventId };
    });
    const tag = crypto.randomUUID().slice(0, 8);
    const athletes = sql(`
      with a as (
        insert into athletes (slug, name, country_code, gender)
        select 'joker-${tag}-' || n, 'Joker ${tag} ' || n, 'FRA', 'F' from generate_series(1, 4) n
        returning id, slug
      ), d as (
        insert into athlete_disciplines (athlete_id, discipline, is_primary)
        select id, '100 m', true from a
      ), e as (
        insert into entries (event_id, athlete_id)
        select ev.id, a.id from a
        cross join unnest(array['${[open, away, locked, bonus].map((c) => c!.eventId).join("','")}']::uuid[]) as ev(id)
      )
      select string_agg(id::text, ',' order by slug) from a`).split(",");
    const annaTeam = athletes.slice(0, 3);
    const bobTeam = athletes.slice(3, 4);
    const all = [open!, away!, locked!, bonus!].map((c) => `'${c.id}'`).join(",");
    const leagueId = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                            mercato_opened_at, mercato_closed_at)
      values ('Jokers', '${anna.userId}', '{}', array[${all}]::uuid[],
              now() - interval '3 days', now() - interval '1 day')
      returning id`);
    sql(`insert into manager_members (league_id, user_id)
         values ('${leagueId}', '${anna.userId}'), ('${leagueId}', '${bob.userId}')`);
    sql(`insert into manager_rounds (league_id, round, ends_at) values ('${leagueId}', 1, now())`);
    sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
         select '${leagueId}', a.id::uuid, a.owner::uuid, 10, 1
         from (values ${annaTeam.map((id) => `('${id}', '${anna.userId}')`).join(",")},
                      ('${bobTeam[0]}', '${bob.userId}')) as a(id, owner)`);
    sql(`insert into manager_matchdays (league_id, round, competition_id, bonus) values
           ('${leagueId}', 1, '${open!.id}', false), ('${leagueId}', 2, '${away!.id}', false),
           ('${leagueId}', 3, '${locked!.id}', false), ('${leagueId}', 4, '${bonus!.id}', true)`);
    sql(`insert into manager_fixtures (league_id, round, home_id, away_id) values
           ('${leagueId}', 1, '${anna.userId}', '${bob.userId}'),
           ('${leagueId}', 2, '${bob.userId}', '${anna.userId}'),
           ('${leagueId}', 3, '${anna.userId}', '${bob.userId}')`);
    // Anna lines up her first athlete and chooses the coaching before the lock; then it locks,
    // the 100 m still to start.
    sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
         values ('${leagueId}', '${locked!.id}', '${anna.userId}', array['${annaTeam[0]}']::uuid[])`);
    sql(`insert into manager_joker_plays (league_id, user_id, competition_id, kind)
         values ('${leagueId}', '${anna.userId}', '${locked!.id}', 'coaching')`);
    sql(`update events set lock_at = now() - interval '1 hour' where id = '${locked!.eventId}'`);
    return {
      leagueId,
      annaId: anna.userId,
      bobId: bob.userId,
      annaTeam,
      bobTeam,
      open: open!.id,
      away: away!.id,
      bonus: bonus!.id,
      locked: locked!.id,
      anna: createSupabaseManagerJokerRepository(anna.client),
      bob: createSupabaseManagerJokerRepository(bob.client),
      cleo: createSupabaseManagerJokerRepository(cleo.client),
    };
  });
} else {
  describe("Supabase Manager joker repository", () => {
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
