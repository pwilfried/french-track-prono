import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { trophyRepositoryContract } from "./contract/trophy-repository.contract";
import { createInMemoryTrophyStore, createSupabaseTrophyRepository } from "./index";

trophyRepositoryContract("in-memory fake", async () => {
  const season = 2031;
  const competition = { slug: "meeting-2031", endsOn: "2031-07-12" };
  const store = createInMemoryTrophyStore({
    players: { adm: "Arbitre", ana: "Ana Lyse", bob: "Bob Ine", max: "Max Imum" },
    admins: ["adm"],
    leagues: [["ana", "bob"]],
    facts: {
      [season]: {
        competitions: [competition],
        leagues: [
          {
            id: "L",
            name: "Les copains",
            members: [
              { userId: "ana", joinedAt: "2031-01-01T00:00:00.000Z" },
              { userId: "bob", joinedAt: "2031-01-02T00:00:00.000Z" },
            ],
            competitions: [{ ...competition, addedAt: null }],
            families: [],
          },
        ],
        manager: [],
      },
    },
  });
  return {
    season,
    playerId: "ana",
    playerPseudo: "Ana Lyse",
    mateId: "bob",
    leagueId: "L",
    leagueName: "Les copains",
    admin: store.session("adm"),
    player: store.session("ana"),
    mate: store.session("bob"),
    outsider: store.session("max"),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  trophyRepositoryContract("Supabase (local)", async () => {
    const [admin, player, mate, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    // A season of its own, far ahead: no other test draws trophies in it.
    const season = 2040 + Math.floor(Math.random() * 60);
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const competitionId = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('trophees-${tag}', 'Meeting Trophées', '${season}-07-10', '${season}-07-12')
      returning id`);
    const leagueName = "Les copains";
    const leagueId = sql(`insert into leagues (name, owner_id)
      values ('${leagueName}', '${player.userId}') returning id`);
    sql(`insert into league_members (league_id, user_id, role)
         values ('${leagueId}', '${player.userId}', 'owner'), ('${leagueId}', '${mate.userId}', 'member')`);
    sql(`insert into league_competitions (league_id, competition_id)
         values ('${leagueId}', '${competitionId}')`);
    const playerPseudo = sql(`select pseudo from profiles where id = '${player.userId}'`);
    return {
      season,
      playerId: player.userId,
      playerPseudo,
      mateId: mate.userId,
      leagueId,
      leagueName,
      admin: createSupabaseTrophyRepository(admin.client),
      player: createSupabaseTrophyRepository(player.client),
      mate: createSupabaseTrophyRepository(mate.client),
      outsider: createSupabaseTrophyRepository(outsider.client),
    };
  });
} else {
  describe("Supabase trophy repository", () => {
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
