import { describe, it } from "vitest";

import type { ManagerBonus } from "@/domain/manager-rules";

import { createTestEvent, sql } from "./contract/database";
import { managerScoreContract } from "./contract/manager-score.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerScoreStore, createSupabaseManagerScoreRepository } from "./index";

const bonuses = { first: 50 } as Record<ManagerBonus, number>;

managerScoreContract("in-memory fake", async () => {
  const athleteIds = ["a1", "a2", "a3"];
  const names = { a1: "Alice Fictive", a2: "Berthe Démo", a3: "Chloé Test" };
  const store = createInMemoryManagerScoreStore([
    {
      competitionId: "c1",
      slug: "meeting",
      lockAt: "2026-07-10T16:00:00Z",
      participants: [{ leagueId: "L", userId: "zoe", bonuses, lineup: ["a1", "a2"] }],
      performances: [
        {
          athleteId: "a1",
          discipline: "100 m",
          sex: "F",
          unit: "time",
          round: "final",
          status: "ok",
          place: 1,
          mark: "10.90",
          records: ["pb"],
        },
      ],
      predictionPoints: { zoe: 3 },
      names,
    },
  ]);
  return {
    competitionSlug: "meeting",
    competitionId: "c1",
    leagueId: "L",
    playerId: "zoe",
    athleteIds,
    names,
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false, userId: "zoe" }),
    outsider: store.session({ isAdmin: false, userId: "max" }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerScoreContract("Supabase (local)", async () => {
    const [admin, player, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { competitionSlug, eventId, athleteIds } = createTestEvent();
    const competitionId = sql(`select id from competitions where slug = '${competitionSlug}'`);
    const ids = athleteIds.map((id) => `'${id}'`).join(", ");
    const names = Object.fromEntries(
      sql(`select string_agg(id || '=' || name, '|') from athletes where id in (${ids})`)
        .split("|")
        .map((pair) => pair.split("=") as [string, string]),
    );
    // The player's league, mercato closed; their lineup before the lock, then the event starts.
    const leagueId = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids,
                            mercato_opened_at, mercato_closed_at)
      values ('Points', '${player.userId}', '{"bonuses": {"first": 50}}',
              array['${competitionId}']::uuid[], now() - interval '3 days', now() - interval '1 day')
      returning id`);
    sql(
      `insert into manager_members (league_id, user_id) values ('${leagueId}', '${player.userId}')`,
    );
    sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
         values ('${leagueId}', '${competitionId}', '${player.userId}',
                 array['${athleteIds[0]}', '${athleteIds[1]}']::uuid[])`);
    sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
         where id = '${eventId}'`);
    sql(`insert into event_performances (event_id, athlete_id, status, place, mark, records)
         values ('${eventId}', '${athleteIds[0]}', 'ok', 1, '10.90', array['pb'])`);
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason)
         values ('${player.userId}', '${competitionId}', '${eventId}', 'prediction', 3, 'prediction')`);
    return {
      competitionSlug,
      competitionId,
      leagueId,
      playerId: player.userId,
      athleteIds,
      names,
      admin: createSupabaseManagerScoreRepository(admin.client),
      player: createSupabaseManagerScoreRepository(player.client),
      outsider: createSupabaseManagerScoreRepository(outsider.client),
    };
  });
} else {
  describe("Supabase Manager score repository", () => {
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
