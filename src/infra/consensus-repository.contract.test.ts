import { describe, it } from "vitest";

import { createTestCompetition, sql } from "./contract/database";
import { consensusRepositoryContract } from "./contract/consensus-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryConsensusRepository, createSupabaseConsensusRepository } from "./index";

consensusRepositoryContract("in-memory fake", async () => {
  const podium = (userId: string, first: string, second: string) => ({
    userId,
    podium: { first, second, third: "c" },
    mine: false,
  });
  const podiums = [podium("anna", "a", "b"), podium("bob", "b", "a"), podium("cleo", "a", "b")];
  return {
    athleteIds: ["a", "b", "c", "d"],
    openEventId: "open",
    lockedEventId: "locked",
    leagueId: "friends",
    otherLeagueId: "others",
    bob: createInMemoryConsensusRepository({
      events: { open: { locked: false, podiums }, locked: { locked: true, podiums } },
      leagues: { friends: ["anna", "bob"], others: ["anna", "cleo"] },
      me: "bob",
    }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  consensusRepositoryContract("Supabase (local)", async () => {
    const [anna, bob, cleo] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const { events } = createTestCompetition({ open: 2 });
    const open = events[0]!;
    const locked = events[1]!;
    for (const e of [open, locked]) {
      const [a, b, c] = e.athleteIds as [string, string, string];
      sql(`insert into predictions (user_id, event_id, p1, p2, p3) values
        ('${anna.userId}', '${e.eventId}', '${a}', '${b}', '${c}'),
        ('${bob.userId}', '${e.eventId}', '${b}', '${a}', '${c}'),
        ('${cleo.userId}', '${e.eventId}', '${a}', '${b}', '${c}')`);
    }
    sql(`update events set lock_at = now() - interval '1 minute' where id = '${locked.eventId}'`);
    const league = (owner: string, member: string) =>
      sql(`with l as (insert into leagues (name, owner_id) values ('Consensus', '${owner}') returning id),
             m as (insert into league_members (league_id, user_id, role)
                   select id, '${owner}', 'owner'::league_role from l
                   union all select id, '${member}', 'member'::league_role from l)
           select id from l`);
    return {
      athleteIds: locked.athleteIds,
      openEventId: open.eventId,
      lockedEventId: locked.eventId,
      leagueId: league(anna.userId, bob.userId),
      otherLeagueId: league(anna.userId, cleo.userId),
      bob: createSupabaseConsensusRepository(bob.client),
    };
  });
} else {
  describe("Supabase consensus repository", () => {
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
