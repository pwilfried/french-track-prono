import { describe, it } from "vitest";

import { managerSeasonCompetitions, sql } from "./contract/database";
import { managerLineupContract } from "./contract/manager-lineup.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerLineupStore, createSupabaseManagerLineups } from "./index";

const hour = 3600 * 1000;

managerLineupContract("in-memory fake", async () => {
  const at = (offset: number) => new Date(Date.now() + offset).toISOString();
  const competition = (slug: string, lockAt: string, entries: string[]) => ({
    competitionId: `id-${slug}`,
    slug,
    name: `Meeting ${slug}`,
    startsOn: lockAt.slice(0, 10),
    lockAt,
    entries,
  });
  const open = competition("open", at(48 * hour), ["s1", "m1"]);
  const locked = competition("locked", at(-hour), ["s1", "m1"]);
  const team = [
    { athleteId: "s1", family: "sprint" as const },
    { athleteId: "m1", family: "middle" as const },
    { athleteId: "t1", family: "throws" as const },
  ];
  const rules = { max: 2, minPerFamily: { sprint: 1 } };
  const store = createInMemoryManagerLineupStore({
    leagues: {
      l1: { rules, mercatoClosed: true, teams: { u1: team, u2: [] }, competitions: [open, locked] },
      l2: { rules, mercatoClosed: false, teams: { u1: [] }, competitions: [open] },
    },
  });
  return {
    leagueId: "l1",
    mercatoLeagueId: "l2",
    first: store.session("u1"),
    second: store.session("u2"),
    outsider: store.session("u3"),
    open,
    locked,
    elsewhere: "id-elsewhere",
    sprinter: "s1",
    runner: "m1",
    thrower: "t1",
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerLineupContract("Supabase (local)", async () => {
    const [first, second, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const league = async (name: string) => {
      const { data, error } = await first.client.rpc("create_manager_league", {
        p_name: name,
        p_public: false,
        p_competitions: managerSeasonCompetitions(),
      });
      if (error) throw new Error(error.message);
      return data as string;
    };
    const leagueId = await league("Alignement");
    const mercatoLeagueId = await league("Mercato");
    const code = sql(`select invite_code from manager_leagues where id = '${leagueId}'`);
    const joined = await second.client.rpc("join_manager_league", { p_code: code });
    if (joined.error) throw new Error(joined.error.message);

    const tag = crypto.randomUUID().slice(0, 8);
    // Three athletes of the first participant's team, and three competitions of their own.
    const athlete = (n: string, sex: string, discipline: string) => {
      const id = sql(`insert into athletes (slug, name, country_code, gender)
        values ('lineup-${n}-${tag}', 'Lineup ${n} ${tag}', 'FRA', '${sex}') returning id`);
      sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
           values ('${id}', '${discipline}', true)`);
      return id;
    };
    const sprinter = athlete("sprint", "F", "100 m");
    const runner = athlete("middle", "F", "800 m");
    const thrower = athlete("throws", "M", "Lancer du poids");
    const competition = (n: string, lockIn: string, entries: string[]) => {
      const slug = `lineup-${n}-${tag}`;
      const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
        values ('${slug}', 'Lineup ${n}', current_date, current_date + 3) returning id`);
      const event =
        sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
        values ('${id}', '${slug}-100', '100 m', 'F', now() + interval '${lockIn}',
                now() + interval '${lockIn}') returning id`);
      for (const a of entries) {
        sql(`insert into entries (event_id, athlete_id) values ('${event}', '${a}')`);
      }
      return { competitionId: id, slug };
    };
    const open = competition("open", "2 days", [sprinter, runner]);
    const locked = competition("locked", "-1 hour", [sprinter, runner]);
    const elsewhere = competition("elsewhere", "2 days", [sprinter, runner]).competitionId;

    sql(`update manager_leagues
         set rules = rules || '{"lineup": {"max": 2, "minPerFamily": {"sprint": 1}}}',
             competition_ids = array['${open.competitionId}', '${locked.competitionId}']::uuid[]
         where id in ('${leagueId}', '${mercatoLeagueId}')`);
    sql(`update manager_leagues
         set mercato_opened_at = now() - interval '3 days', mercato_closed_at = now()
         where id = '${leagueId}'`);
    sql(`insert into manager_rounds (league_id, round, ends_at) values ('${leagueId}', 1, now())`);
    sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
         select '${leagueId}', a, '${first.userId}', 10, 1
         from unnest(array['${sprinter}', '${runner}', '${thrower}']::uuid[]) a`);
    return {
      leagueId,
      mercatoLeagueId,
      first: createSupabaseManagerLineups(first.client),
      second: createSupabaseManagerLineups(second.client),
      outsider: createSupabaseManagerLineups(outsider.client),
      open,
      locked,
      elsewhere,
      sprinter,
      runner,
      thrower,
      restore: async () => {
        sql(`delete from manager_leagues where id in ('${leagueId}', '${mercatoLeagueId}')`);
        sql(`delete from competitions where slug like 'lineup-%-${tag}'`);
        sql(`delete from athletes where slug like 'lineup-%-${tag}'`);
      },
    };
  });
} else {
  describe("Supabase Manager lineups", () => {
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
