import { describe, it } from "vitest";

import type { RevealedPrediction } from "@/application/reveal";

import { createTestCompetition, sql } from "./contract/database";
import { revealRepositoryContract } from "./contract/reveal-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryRevealRepository, createSupabaseRevealRepository } from "./index";

revealRepositoryContract("in-memory fake", async () => {
  const athleteIds = ["a", "b", "c", "d"];
  const of = (
    userId: string,
    first: string,
    second: string,
    joker: boolean,
  ): RevealedPrediction => ({
    predictionId: `${userId}-p`,
    userId,
    pseudo: userId.toUpperCase(),
    bib: { number: 7, color: "blue" },
    podium: { first, second, third: "c" },
    useJoker: joker,
    reactions: [],
    flair: false,
  });
  const anna = {
    ...of("anna", "a", "b", true),
    reactions: [{ userId: "bob", reaction: "🔥" as const }],
    flair: true,
  };
  return {
    annaId: "anna",
    bobId: "bob",
    athleteIds,
    openEventId: "open",
    lockedEventId: "locked",
    bob: createInMemoryRevealRepository({
      open: {
        locked: false,
        predictions: [of("anna", "a", "b", true), of("bob", "b", "a", false)],
      },
      locked: { locked: true, predictions: [anna, of("bob", "b", "a", false)] },
    }),
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  revealRepositoryContract("Supabase (local)", async () => {
    const [anna, bob] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    const { events } = createTestCompetition({ open: 2 });
    const open = events[0]!;
    const locked = events[1]!;
    const athleteIds = locked.athleteIds;
    for (const e of [open, locked]) {
      const [a, b, c] = e.athleteIds as [string, string, string];
      sql(`insert into predictions (user_id, event_id, p1, p2, p3, use_joker) values
        ('${anna.userId}', '${e.eventId}', '${a}', '${b}', '${c}', ${e === locked}),
        ('${bob.userId}', '${e.eventId}', '${b}', '${a}', '${c}', false)`);
    }
    // Anna's joker is on the locked event only (one joker per competition).
    sql(`update events set lock_at = now() - interval '1 minute' where id = '${locked.eventId}'`);
    sql(`insert into reactions (prediction_id, user_id, emoji)
      select id, '${bob.userId}', '🔥' from predictions where event_id = '${locked.eventId}' and user_id = '${anna.userId}'`);
    // Anna's computed points, with the flair (as the admin's computation would write them).
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select '${anna.userId}', e.competition_id, e.id, 'prediction', 7, 'prediction',
             '{"reasons":[{"kind":"exact","slot":1},{"kind":"flair"}]}'::jsonb
      from events e where e.id = '${locked.eventId}'`);
    return {
      annaId: anna.userId,
      bobId: bob.userId,
      athleteIds,
      openEventId: open.eventId,
      lockedEventId: locked.eventId,
      bob: createSupabaseRevealRepository(bob.client),
    };
  });
} else {
  describe("Supabase reveal repository", () => {
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
