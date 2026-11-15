import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { momentReactionContract } from "./contract/moment-reaction.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryMomentReactionStore, createSupabaseMomentReactionRepository } from "./index";

const MOMENT = "perfect_podium:e1:ana";

momentReactionContract("in-memory fake", async () => {
  const store = createInMemoryMomentReactionStore({
    leagues: [{ id: "friends", name: "Les amis", members: ["ana", "bob"] }],
    moments: [{ leagueId: "friends", key: MOMENT, kind: "perfect_podium" }],
    pseudos: { ana: "Ana", bob: "Bob" },
  });
  return {
    admin: store.as("admin", { admin: true }),
    member: store.as("ana"),
    friend: store.as("bob"),
    outsider: store.as("cid"),
    leagueId: "friends",
    leagueName: "Les amis",
    momentKey: MOMENT,
    friendPseudo: "Bob",
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  momentReactionContract("Supabase (local)", async () => {
    const [admin, member, friend, outsider] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const leagueName = `Ligue des réactions ${crypto.randomUUID().slice(0, 6)}`;
    const momentKey = `perfect_podium:${crypto.randomUUID()}:${member.userId}`;
    const leagueId = sql(`with l as (
        insert into leagues (name, owner_id) values ('${leagueName}', '${member.userId}')
        returning id
      ), m as (
        insert into league_members (league_id, user_id, role)
        select id, '${member.userId}'::uuid, 'owner'::league_role from l
        union all
        select id, '${friend.userId}'::uuid, 'member'::league_role from l
      ), moment as (
        insert into league_moments (league_id, key, kind, user_id)
        select id, '${momentKey}', 'perfect_podium', '${member.userId}' from l
      )
      select id from l`).trim();
    return {
      admin: createSupabaseMomentReactionRepository(admin.client),
      member: createSupabaseMomentReactionRepository(member.client),
      friend: createSupabaseMomentReactionRepository(friend.client),
      outsider: createSupabaseMomentReactionRepository(outsider.client),
      leagueId,
      leagueName,
      momentKey,
      friendPseudo: sql(`select pseudo from profiles where id = '${friend.userId}'`).trim(),
    };
  });
} else {
  describe("Supabase moment reaction repository", () => {
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
