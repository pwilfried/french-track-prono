import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { managerSeasonContract } from "./contract/manager-season.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerSeasonStore, createSupabaseManagerSeasonRepository } from "./index";

managerSeasonContract("in-memory fake", async () => {
  const competitions = [1, 2, 3].map((n) => ({ id: `c${n}`, name: `Meeting ${n}` }));
  const store = createInMemoryManagerSeasonStore([
    {
      leagueId: "L",
      members: ["ana", "bob"],
      season: {
        matchdays: competitions.map((c, i) => ({
          round: i + 1,
          competitionId: c.id,
          competitionName: c.name,
          bonus: i === 2,
        })),
        fixtures: [
          { round: 1, home: "bob", away: "ana" },
          { round: 2, home: "ana", away: "bob" },
        ],
        scores: [
          { competitionId: "c1", userId: "ana", total: 900 },
          { competitionId: "c1", userId: "bob", total: 700 },
        ],
      },
    },
  ]);
  return {
    leagueId: "L",
    firstId: "ana",
    secondId: "bob",
    competitions,
    player: store.session("ana"),
    outsider: store.session("max"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerSeasonContract("Supabase (local)", async () => {
    const [first, second, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    // Three competitions of their own, a day apart, all after the close of the mercato.
    const competitions = [1, 2, 3].map((day) => {
      const { competitionSlug, eventId } = createTestEvent();
      sql(`update events set starts_at = now() + interval '${day} days' where id = '${eventId}'`);
      return {
        id: sql(`select id from competitions where slug = '${competitionSlug}'`),
        name: sql(`select name from competitions where slug = '${competitionSlug}'`),
      };
    });
    const ids = competitions.map((c) => `'${c.id}'`).join(", ");
    const leagueId = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
      values ('Saison', '${first.userId}', '{}', array[${ids}]::uuid[]) returning id`);
    sql(`insert into manager_members (league_id, user_id)
         values ('${leagueId}', '${first.userId}'), ('${leagueId}', '${second.userId}')`);
    // Closing the mercato draws the schedule.
    sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
           mercato_closed_at = now() where id = '${leagueId}'`);
    sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                     bonus, predictions)
         values ('${leagueId}', '${competitions[0]!.id}', '${first.userId}', true, 900, 900, 0, 0),
                ('${leagueId}', '${competitions[0]!.id}', '${second.userId}', true, 700, 700, 0, 0)`);
    // The second competition is still being entered: provisional scores only (#665).
    sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                     bonus, predictions, complete)
         values ('${leagueId}', '${competitions[1]!.id}', '${first.userId}', true, 50, 50, 0, 0,
                 false)`);
    return {
      leagueId,
      firstId: first.userId,
      secondId: second.userId,
      competitions,
      player: createSupabaseManagerSeasonRepository(first.client),
      outsider: createSupabaseManagerSeasonRepository(outsider.client),
    };
  });
} else {
  describe("Supabase Manager season repository", () => {
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
