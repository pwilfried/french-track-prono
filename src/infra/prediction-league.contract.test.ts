import { describe, it } from "vitest";

import { createTestCompetition, sql } from "./contract/database";
import { predictionLeagueContract } from "./contract/prediction-league.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryPredictionLeagueRepository,
  createSupabasePredictionLeagueRepository,
} from "./index";

predictionLeagueContract("in-memory fake", async () => {
  const lockAt = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  return {
    player: createInMemoryPredictionLeagueRepository({
      leagues: [
        { id: "amis", competitionSlugs: ["euro"] },
        { id: "club", competitionSlugs: ["euro", "monde"] },
        { id: "elsewhere", competitionSlugs: ["monde"] },
      ],
      events: [
        { id: "open", competitionSlug: "euro", lockAt: lockAt(1) },
        { id: "unpredicted", competitionSlug: "euro", lockAt: lockAt(1) },
        { id: "locked", competitionSlug: "euro", lockAt: lockAt(-1) },
      ],
      predicted: ["open", "locked"],
    }),
    userId: "me",
    amis: "amis",
    club: "club",
    elsewhere: "elsewhere",
    open: "open",
    unpredicted: "unpredicted",
    locked: "locked",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  predictionLeagueContract("Supabase (local)", async () => {
    const player = await signedInPlayer(url, key);
    const { competitionSlug, events } = createTestCompetition({ open: 3 });
    const other = createTestCompetition({ open: 1 });
    const [open, unpredicted, locked] = events as [
      (typeof events)[0],
      (typeof events)[0],
      (typeof events)[0],
    ];
    for (const event of [open, locked]) {
      const [p1, p2, p3] = event.athleteIds;
      sql(`insert into predictions (user_id, event_id, p1, p2, p3)
        values ('${player.userId}', '${event.eventId}', '${p1}', '${p2}', '${p3}')`);
    }
    sql(`update events set lock_at = now() - interval '1 minute' where id = '${locked.eventId}'`);
    const league = (name: string, slugs: string[]) =>
      sql(`with l as (
          insert into leagues (name, owner_id) values ('${name}', '${player.userId}') returning id
        ), m as (
          insert into league_members (league_id, user_id, role)
          select id, '${player.userId}', 'owner' from l
        ), c as (
          insert into league_competitions (league_id, competition_id)
          select l.id, c.id from l, competitions c where c.slug = any (array['${slugs.join("','")}'])
        )
        select id from l`).trim();
    return {
      player: createSupabasePredictionLeagueRepository(player.client),
      userId: player.userId,
      amis: league("Amis", [competitionSlug]),
      club: league("Club", [competitionSlug, other.competitionSlug]),
      elsewhere: league("Ailleurs", [other.competitionSlug]),
      open: open.eventId,
      unpredicted: unpredicted.eventId,
      locked: locked.eventId,
    };
  });
} else {
  describe("Supabase prediction league repository", () => {
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
