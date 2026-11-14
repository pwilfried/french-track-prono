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

type Counts = Record<string, number>;

function loadTwice(): [Counts, Counts] {
  const output = sqlScript(`begin;\n${body}\n${counts}\n${body}\n${counts}\nrollback;\n`);
  const lines = output.split("\n").filter((line) => line.startsWith("{"));
  return [JSON.parse(lines[0]!) as Counts, JSON.parse(lines[1]!) as Counts];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  describe("pre-production demo set", () => {
    it("gives the same players, leagues and predictions when it is loaded twice", () => {
      const [first, second] = loadTwice();

      expect(second).toEqual(first);
      expect(first).toMatchObject({
        players: 20,
        leagues: 3,
        competitions: 6,
        athletes: 60,
        records: 120,
        managerLeagues: 1,
        managerAwards: 48,
        matchdays: 6,
        managerScores: 4,
      });
      expect(first.predictions).toBeGreaterThan(500);
      expect(first.points).toBeGreaterThan(0);
      expect(first.results).toBeGreaterThan(0);
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
