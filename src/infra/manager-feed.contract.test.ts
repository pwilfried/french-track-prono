import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { managerFeedContract } from "./contract/manager-feed.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerFeedStore, createSupabaseManagerFeedRepository } from "./index";

managerFeedContract("in-memory fake", async () => {
  const store = createInMemoryManagerFeedStore([
    {
      id: "L",
      members: ["home", "away"],
      facts: {
        wins: [
          {
            round: 1,
            athleteId: "x",
            athlete: "Athlète X",
            price: 35,
            userId: "home",
            pseudo: "Maison",
            closedAt: "2026-11-15T09:00:00.000Z",
          },
        ],
        duels: [
          {
            round: 1,
            home: { userId: "home", pseudo: "Maison", score: 700 },
            away: { userId: "away", pseudo: "Visite", score: 900 },
            scoredAt: "2026-11-15T21:00:00.000Z",
          },
        ],
        published: [
          {
            key: "badge:home:foudre:silver",
            kind: "badge",
            happenedAt: "2026-11-15T10:00:00.000Z",
            pseudo: "Maison",
            badge: "foudre",
            level: "silver",
          },
        ],
      },
    },
  ]);
  return {
    member: store.as("away"),
    outsider: store.as("max"),
    leagueId: "L",
    homePseudo: "Maison",
    awayPseudo: "Visite",
    athlete: "Athlète X",
    price: 35,
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerFeedContract("Supabase (local)", async () => {
    const [home, away, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const { competitionSlug } = createTestEvent();
    const competition = sql(`select id from competitions where slug = '${competitionSlug}'`);
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const athlete = `Athlete Fil ${tag}`;
    const athleteId = sql(`insert into athletes (slug, name, country_code, gender)
      values ('fil-${tag}', '${athlete}', 'FRA', 'F') returning id`);
    const leagueId = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
      values ('Fil Manager', '${home.userId}', '{}', array['${competition}']::uuid[]) returning id`);
    sql(`insert into manager_members (league_id, user_id)
         values ('${leagueId}', '${home.userId}'), ('${leagueId}', '${away.userId}')`);
    sql(`insert into manager_rounds (league_id, round, ends_at) values ('${leagueId}', 1, now())`);
    sql(`insert into manager_round_bids (league_id, round, user_id, athlete_id, amount, bid_at, won)
         values ('${leagueId}', 1, '${home.userId}', '${athleteId}', 35, now(), true),
                ('${leagueId}', 1, '${away.userId}', '${athleteId}', 20, now(), false)`);
    sql(`insert into manager_matchdays (league_id, round, competition_id)
         values ('${leagueId}', 1, '${competition}')`);
    sql(`insert into manager_fixtures (league_id, round, home_id, away_id)
         values ('${leagueId}', 1, '${home.userId}', '${away.userId}')`);
    sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                     bonus, predictions)
         values ('${leagueId}', '${competition}', '${home.userId}', true, 700, 700, 0, 0),
                ('${leagueId}', '${competition}', '${away.userId}', true, 900, 900, 0, 0)`);
    sql(`insert into manager_moments (league_id, key, kind, user_id, data)
         values ('${leagueId}', 'badge:${home.userId}:foudre:silver', 'badge', '${home.userId}',
                 '{"badge": "foudre", "level": "silver"}')`);
    const pseudo = (id: string) => sql(`select pseudo from profiles where id = '${id}'`).trim();
    return {
      member: createSupabaseManagerFeedRepository(away.client),
      outsider: createSupabaseManagerFeedRepository(outsider.client),
      leagueId,
      homePseudo: pseudo(home.userId),
      awayPseudo: pseudo(away.userId),
      athlete,
      price: 35,
    };
  });
} else {
  describe("Supabase Manager feed repository", () => {
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
