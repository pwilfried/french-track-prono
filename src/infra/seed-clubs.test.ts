import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sqlScript } from "./contract/database";

// Pre-production loads the public seed at every deploy (#776): its invented clubs must not pile
// up. The local database already holds the seed (supabase db reset), so loading it again here is
// the second load. Everything runs in one transaction that is rolled back.
const seed = readFileSync("supabase/seed.sql", "utf8");
const body = seed.replace(/^begin;$/m, "").replace(/^commit;$/m, "");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  describe("invented clubs of the seed", () => {
    it("keeps one copy of each club when the seed is loaded again, and merges earlier copies with their players", () => {
      const player = "00000000-0000-4000-9776-000000000001";
      const output = sqlScript(`begin;
        -- given a copy left by an earlier load, chosen by a player
        insert into clubs (name, city, department, source, validated, created_at)
        values ('Stade Imaginaire Athlétisme', 'Songeville', '13', 'import', true, now() + interval '1 day');
        insert into auth.users (id, email) values ('${player}', 'e2e-seed-clubs@example.test');
        insert into profiles (id, pseudo, age_confirmed_at, club_id)
        select '${player}', 'E2E seed clubs', now(), id from clubs
        where name = 'Stade Imaginaire Athlétisme' order by created_at desc limit 1;
        -- when the seed is loaded again
        ${body}
        -- then
        select json_build_object(
          'copies', (select json_agg(n order by n) from (select count(*) as n from clubs
                     where name in ('Athlé Club des Tests', 'Foulées de Fictiville',
                                    'Stade Imaginaire Athlétisme')
                     group by name) counts),
          'playerClub', (select c.name from profiles p join clubs c on c.id = p.club_id
                         where p.id = '${player}')
        )::text;
        rollback;`);
      const line = output.split("\n").find((l) => l.startsWith("{"));

      expect(JSON.parse(line!)).toEqual({
        copies: [1, 1, 1],
        playerClub: "Stade Imaginaire Athlétisme",
      });
    });
  });
} else {
  describe("invented clubs of the seed", () => {
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
