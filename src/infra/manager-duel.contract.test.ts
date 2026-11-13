import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { managerDuelContract } from "./contract/manager-duel.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerDuelStore, createSupabaseManagerDuelRepository } from "./index";

managerDuelContract("in-memory fake", async () => {
  const store = createInMemoryManagerDuelStore([
    {
      leagueId: "L",
      members: ["ana", "bob"],
      locked: ["c1"],
      lineups: ["c1", "c2"].flatMap((competitionId) => [
        { competitionId, userId: "ana", athleteIds: ["a2", "a1"] },
        { competitionId, userId: "bob", athleteIds: ["b1"] },
      ]),
      scores: [
        {
          competitionId: "c1",
          userId: "ana",
          total: 900,
          predictions: 30,
          athletes: [{ athleteId: "a2", total: 850, bonusPoints: 20 }],
        },
      ],
    },
  ]);
  return {
    leagueId: "L",
    firstId: "ana",
    secondId: "bob",
    locked: "c1",
    open: "c2",
    firstLineup: ["a2", "a1"],
    player: store.session("bob"),
    outsider: store.session("max"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerDuelContract("Supabase (local)", async () => {
    const [first, second, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const [locked, open] = [1, 2].map(() => {
      const { competitionSlug, eventId, athleteIds } = createTestEvent();
      const id = sql(`select id from competitions where slug = '${competitionSlug}'`);
      return { id, eventId, athleteIds };
    });
    const leagueId = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                            mercato_opened_at, mercato_closed_at)
      values ('Duel', '${first.userId}', '{}', array['${locked!.id}', '${open!.id}']::uuid[],
              now() - interval '3 days', now() - interval '1 day')
      returning id`);
    sql(`insert into manager_members (league_id, user_id)
         values ('${leagueId}', '${first.userId}'), ('${leagueId}', '${second.userId}')`);
    const firstLineup = [locked!.athleteIds[1]!, locked!.athleteIds[0]!];
    // Both players line up before the lock; then the first competition starts.
    for (const c of [locked!, open!]) {
      sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
           values ('${leagueId}', '${c.id}', '${first.userId}',
                   array['${firstLineup.join("','")}']::uuid[]),
                  ('${leagueId}', '${c.id}', '${second.userId}',
                   array['${c.athleteIds[2]}']::uuid[])`);
    }
    sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
         where id = '${locked!.eventId}'`);
    sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                     bonus, predictions, athletes)
         values ('${leagueId}', '${locked!.id}', '${first.userId}', true, 900, 850, 20, 30,
                 '[{"athlete_id": "${firstLineup[0]}", "total": 850, "bonus_points": 20}]')`);
    return {
      leagueId,
      firstId: first.userId,
      secondId: second.userId,
      locked: locked!.id,
      open: open!.id,
      firstLineup,
      player: createSupabaseManagerDuelRepository(second.client),
      outsider: createSupabaseManagerDuelRepository(outsider.client),
    };
  });
} else {
  describe("Supabase Manager duel repository", () => {
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
