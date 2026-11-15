import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sqlScript } from "./contract/database";

// The pre-production demo set (#694), loaded at every deploy: a second load adds nothing. Both
// loads run in one transaction that is rolled back, so the other tests never see the set.
const demo = readFileSync("supabase/preprod/demo.sql", "utf8");
const body = demo.replace(/^begin;$/m, "").replace(/^commit;$/m, "");

const demoPlayer = "'00000000-0000-4000-9000-%'";
const counts = `select json_build_object(
  'players', (select count(*) from profiles where id::text like ${demoPlayer}),
  'leagues', (select count(*) from leagues where owner_id::text like ${demoPlayer}),
  'leagueMembers', (select count(*) from league_members m join leagues l on l.id = m.league_id
                    where l.owner_id::text like ${demoPlayer}),
  'predictions', (select count(*) from predictions where user_id::text like ${demoPlayer}),
  'points', (select count(*) from score_events where user_id::text like ${demoPlayer}),
  'competitions', (select count(*) from competitions where slug like 'demo-%'),
  'athletes', (select count(*) from athletes where slug like 'demo-%'),
  'records', (select count(*) from athlete_records r join athletes a on a.id = r.athlete_id
              where a.slug like 'demo-%'),
  'results', (select count(*) from results r join events e on e.id = r.event_id
              join competitions c on c.id = e.competition_id where c.slug like 'demo-%'),
  'managerLeagues', (select count(*) from manager_leagues where owner_id::text like ${demoPlayer}),
  'managerAwards', (select count(*) from manager_awards w join manager_leagues l on l.id = w.league_id
                    where l.owner_id::text like ${demoPlayer}),
  'matchdays', (select count(*) from manager_matchdays d join manager_leagues l on l.id = d.league_id
                where l.owner_id::text like ${demoPlayer} and d.competition_id is not null),
  'managerScores', (select count(*) from manager_scores s join manager_leagues l on l.id = s.league_id
                    where l.owner_id::text like ${demoPlayer})
)::text;`;

// The states of the test accounts (#944): demo-21 Nouveau, demo-22 Mercato, demo-23 Direct,
// demo-24 Joker.
const tester = (n: number) => `'00000000-0000-4000-9000-${String(n).padStart(12, "0")}'::uuid`;
const states = `select json_build_object(
  'nouveauProfile', exists (select 1 from profiles where id = ${tester(21)} and pseudo = 'Démo Nouveau'
                            and club_id is null and not is_admin),
  'nouveauPredictions', (select count(*) from predictions where user_id = ${tester(21)}),
  'nouveauLeagues', (select count(*) from league_members where user_id = ${tester(21)})
                    + (select count(*) from manager_members where user_id = ${tester(21)}),
  'mercatoRoundUnderWay', exists (
    select 1 from manager_members m
    join manager_leagues l on l.id = m.league_id
    cross join lateral private.manager_open_round(l.id) o
    where m.user_id = ${tester(22)} and l.mercato_opened_at <= now() and l.mercato_closed_at is null
      and o.ends_at > now()),
  'directDuelUnderWay', exists (
    select 1 from manager_fixtures f
    join manager_matchdays d using (league_id, round)
    join manager_scores s on s.league_id = f.league_id and s.competition_id = d.competition_id
                         and s.user_id = ${tester(23)}
    where ${tester(23)} in (f.home_id, f.away_id) and s.total > 0
      and exists (select 1 from events e join results r on r.event_id = e.id
                  where e.competition_id = d.competition_id)
      and exists (select 1 from events e where e.competition_id = d.competition_id
                  and e.starts_at > now())),
  'directLockedWithFriends', exists (
    select 1 from predictions p
    join events e on e.id = p.event_id
    where p.user_id = ${tester(23)} and e.lock_at <= now()
      and not exists (select 1 from results r where r.event_id = e.id)
      and exists (select 1 from predictions f
                  join league_members a on a.user_id = f.user_id
                  join league_members b on b.league_id = a.league_id and b.user_id = ${tester(23)}
                  where f.event_id = e.id and f.user_id <> ${tester(23)})),
  'jokerPoints', (select coalesce(sum(points), 0) from score_events where user_id = ${tester(24)}),
  'jokerBadges', (select count(*) from user_badges where user_id = ${tester(24)}),
  'jokerOnLive', exists (select 1 from predictions p join competitions c on c.id = p.competition_id
                         where p.user_id = ${tester(24)} and p.use_joker and c.status = 'live'),
  'testerAdmins', (select count(*) from profiles
                   where id in (${[21, 22, 23, 24].map(tester).join(", ")}) and is_admin)
)::text;`;

type Counts = Record<string, number | boolean>;

function loadTwice(): [Counts, Counts, Counts, Counts] {
  const output = sqlScript(
    `begin;\n${body}\n${counts}\n${states}\n${body}\n${counts}\n${states}\nrollback;\n`,
  );
  const [first, firstStates, second, secondStates] = output
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as Counts);
  return [first!, second!, firstStates!, secondStates!];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  describe("pre-production demo set", () => {
    it("gives the same players, leagues and predictions when it is loaded twice", () => {
      const [first, second] = loadTwice();

      expect(second).toEqual(first);
      expect(first).toMatchObject({
        players: 24,
        leagues: 3,
        competitions: 6,
        athletes: 60,
        records: 120,
        managerLeagues: 3,
        managerAwards: 96,
        matchdays: 11,
        managerScores: 8,
      });
      expect(first.predictions).toBeGreaterThan(500);
      expect(first.points).toBeGreaterThan(0);
      expect(first.results).toBeGreaterThan(0);
    });

    it("keeps each test account in the state it is named after, load after load", () => {
      const [, , first, second] = loadTwice();

      for (const states of [first, second]) {
        expect(states).toEqual({
          nouveauProfile: true,
          nouveauPredictions: 0,
          nouveauLeagues: 0,
          mercatoRoundUnderWay: true,
          directDuelUnderWay: true,
          directLockedWithFriends: true,
          jokerPoints: expect.any(Number) as number,
          jokerBadges: 1,
          jokerOnLive: true,
          testerAdmins: 0,
        });
        expect(states.jokerPoints).toBeGreaterThan(0);
      }
    });
  });
} else {
  describe("pre-production demo set", () => {
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
