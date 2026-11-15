import { describe, it } from "vitest";

import { createTestEvent, sql } from "./contract/database";
import { leagueMomentContract } from "./contract/league-moment.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryLeagueMomentStore, createSupabaseLeagueMomentRepository } from "./index";

leagueMomentContract("in-memory fake", async () => {
  const store = createInMemoryLeagueMomentStore({
    leagues: [{ id: "friends", competitionSlugs: ["meeting"], members: [{ userId: "ana" }] }],
    pseudos: { ana: "Ana" },
    events: {
      "100m": {
        startsAt: "2026-11-15T19:00:00.000Z",
        discipline: "100 m",
        gender: "F",
        competitionName: "Meeting",
      },
    },
  });
  return {
    admin: store.as("admin", { admin: true }),
    member: store.as("ana"),
    outsider: store.as("cid"),
    leagueId: "friends",
    competitionSlug: "meeting",
    competitionName: "Meeting",
    memberId: "ana",
    memberPseudo: "Ana",
    eventId: "100m",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  leagueMomentContract("Supabase (local)", async () => {
    const [admin, member, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const { competitionSlug, eventId } = createTestEvent();
    const leagueId = sql(`with l as (
        insert into leagues (name, owner_id) values ('Ligue du fil', '${member.userId}') returning id
      ), m as (
        insert into league_members (league_id, user_id, role) select id, '${member.userId}', 'owner' from l
      ), c as (
        insert into league_competitions (league_id, competition_id)
        select l.id, c.id from l, competitions c where c.slug = '${competitionSlug}'
      )
      select id from l`).trim();
    return {
      admin: createSupabaseLeagueMomentRepository(admin.client),
      member: createSupabaseLeagueMomentRepository(member.client),
      outsider: createSupabaseLeagueMomentRepository(outsider.client),
      leagueId,
      competitionSlug,
      competitionName: sql(
        `select name from competitions where slug = '${competitionSlug}'`,
      ).trim(),
      memberId: member.userId,
      memberPseudo: sql(`select pseudo from profiles where id = '${member.userId}'`).trim(),
      eventId,
    };
  });
} else {
  describe("Supabase league moment repository", () => {
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
