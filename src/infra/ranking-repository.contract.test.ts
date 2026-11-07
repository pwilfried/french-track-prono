import { describe, it } from "vitest";

import type { RankingLine } from "@/application/rankings";

import { createTestEvent, sql } from "./contract/database";
import { rankingRepositoryContract } from "./contract/ranking-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryRankingRepository, createSupabaseRankingRepository } from "./index";

const lines = (ana: string, bob: string, anaPseudo: string, bobPseudo: string): RankingLine[] => [
  {
    userId: ana,
    pseudo: anaPseudo,
    avatar: "🏃",
    points: 24,
    reasons: [{ kind: "perfect_podium" }, { kind: "joker" }],
  },
  {
    userId: bob,
    pseudo: bobPseudo,
    avatar: "🏃",
    points: 3,
    reasons: [{ kind: "exact", slot: 1 }],
  },
];

rankingRepositoryContract("in-memory fake", async () => {
  const expected = lines("ana", "bob", "Ana", "Bob");
  return {
    competitionSlug: "c",
    expected,
    reader: createInMemoryRankingRepository({ c: expected }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  rankingRepositoryContract("Supabase (local)", async () => {
    const [ana, bob] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    const pseudoOf = (id: string) => sql(`select pseudo from profiles where id = '${id}'`);
    const expected = lines(ana.userId, bob.userId, pseudoOf(ana.userId), pseudoOf(bob.userId));
    const { competitionSlug, eventId } = createTestEvent();
    for (const l of expected) {
      sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
        select '${l.userId}', competition_id, id, 'prediction', ${l.points}, 'prediction',
               '${JSON.stringify({ reasons: l.reasons })}'::jsonb
        from events where id = '${eventId}'`);
    }
    return { competitionSlug, expected, reader: createSupabaseRankingRepository(bob.client) };
  });
} else {
  describe("Supabase ranking repository", () => {
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
