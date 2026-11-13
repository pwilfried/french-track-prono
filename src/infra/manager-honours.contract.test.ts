import { describe, it } from "vitest";

import { managerStandings } from "@/domain/manager-championship";

import { createTestEvent, sql } from "./contract/database";
import { managerHonoursContract } from "./contract/manager-honours.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerHonoursStore, createSupabaseManagerHonoursRepository } from "./index";

managerHonoursContract("in-memory fake", async () => {
  const duels = [
    { round: 1, home: "ana", away: "bob", homeScore: 900, awayScore: 700 },
    { round: 2, home: "bob", away: "ana", homeScore: 600, awayScore: 800 },
  ];
  const store = createInMemoryManagerHonoursStore([
    {
      members: ["ana", "bob"],
      honours: {
        leagueId: "L",
        leagueName: "Saison finie",
        endedAt: "2026-11-13T10:00:00.000Z",
        championId: "ana",
        standings: managerStandings(["ana", "bob"], duels),
        duels,
        players: [
          { userId: "ana", managerPoints: 1800, bestAthlete: { name: "Athlète A", points: 1700 } },
          { userId: "bob", managerPoints: 6300, bestAthlete: null },
        ],
      },
    },
  ]);
  return {
    finishedId: "L",
    finishedName: "Saison finie",
    playingId: "P",
    firstId: "ana",
    secondId: "bob",
    athleteName: "Athlète A",
    player: store.session("ana"),
    outsider: store.session("max"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerHonoursContract("Supabase (local)", async () => {
    const [first, second, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    // Three competitions of their own, a day apart, all after the close of the mercato.
    const competitions = [1, 2, 3].map((day) => {
      const { competitionSlug, eventId } = createTestEvent();
      sql(`update events set starts_at = now() + interval '${day} days' where id = '${eventId}'`);
      return sql(`select id from competitions where slug = '${competitionSlug}'`);
    });
    const athleteName = `Athlete Palmares ${Date.now()}`;
    const athleteId = sql(`insert into athletes (slug, name, country_code, gender)
      values ('palmares-${Date.now()}-${Math.random().toString(36).slice(2, 8)}', '${athleteName}',
              'FRA', 'F') returning id`);
    const ids = competitions.map((c) => `'${c}'`).join(", ");
    const league = (name: string) => {
      const id = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
        values ('${name}', '${first.userId}', '{}', array[${ids}]::uuid[]) returning id`);
      sql(`insert into manager_members (league_id, user_id)
           values ('${id}', '${first.userId}'), ('${id}', '${second.userId}')`);
      // Closing the mercato draws the schedule.
      sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
             mercato_closed_at = now() where id = '${id}'`);
      return id;
    };
    const finishedName = "Saison finie";
    const finishedId = league(finishedName);
    const playingId = league("Saison en cours");
    const score = (leagueId: string, c: number, userId: string, total: number, athlete = 0) => `(
      '${leagueId}', '${competitions[c]}', '${userId}', true, ${total}, ${total}, 0, 0,
      '${athlete ? JSON.stringify([{ athlete_id: athleteId, total: athlete }]) : "[]"}')`;
    const insert = (rows: string[]) =>
      sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total,
                                       hungarian, bonus, predictions, athletes)
           values ${rows.join(", ")}`);
    for (const leagueId of [finishedId, playingId]) {
      insert([
        score(leagueId, 0, first.userId, 900, 900),
        score(leagueId, 0, second.userId, 700),
        score(leagueId, 1, first.userId, 800, 800),
        score(leagueId, 1, second.userId, 600),
      ]);
    }
    // Only « Saison finie » plays its bonus matchday.
    insert([score(finishedId, 2, first.userId, 100), score(finishedId, 2, second.userId, 5000)]);
    return {
      finishedId,
      finishedName,
      playingId,
      firstId: first.userId,
      secondId: second.userId,
      athleteName,
      player: createSupabaseManagerHonoursRepository(first.client),
      outsider: createSupabaseManagerHonoursRepository(outsider.client),
    };
  });
} else {
  describe("Supabase Manager honours repository", () => {
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
