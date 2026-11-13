import { describe, it } from "vitest";

import type { RankingLine } from "@/application/rankings";

import { createTestEvent, sql } from "./contract/database";
import { rankingRepositoryContract } from "./contract/ranking-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryRankingRepository, createSupabaseRankingRepository } from "./index";

const lines = (
  ana: string,
  bob: string,
  anaPseudo: string,
  bobPseudo: string,
  eventId: string,
  eventStartsAt: string,
  eventLockAt: string,
  eventFamily: RankingLine["eventFamily"],
): RankingLine[] => [
  {
    userId: ana,
    pseudo: anaPseudo,
    bib: { number: 7, color: "blue" },
    points: 24,
    reasons: [{ kind: "perfect_podium" }, { kind: "joker" }],
    eventId,
    eventStartsAt,
    eventLockAt,
    eventFamily,
  },
  {
    userId: bob,
    pseudo: bobPseudo,
    bib: { number: 7, color: "blue" },
    points: 3,
    reasons: [{ kind: "exact", slot: 1 }],
    eventId,
    eventStartsAt,
    eventLockAt,
    eventFamily,
  },
];

rankingRepositoryContract("in-memory fake", async () => {
  const expected = lines(
    "ana",
    "bob",
    "Ana",
    "Bob",
    "e1",
    "2026-11-23T19:00:00.000Z",
    "2026-11-23T18:55:00.000Z",
    "sprint",
  );
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
    const { competitionSlug, eventId } = createTestEvent();
    const isoOf = (column: string) =>
      new Date(
        sql(
          `select to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from events where id = '${eventId}'`,
        ),
      ).toISOString();
    const startsAt = isoOf("starts_at");
    const lockAt = isoOf("lock_at");
    const expected = lines(
      ana.userId,
      bob.userId,
      pseudoOf(ana.userId),
      pseudoOf(bob.userId),
      eventId,
      startsAt,
      lockAt,
      // The family of the event's discipline (#613).
      sql(`select d.family from events e join disciplines d on d.name = e.discipline
        where e.id = '${eventId}'`) as RankingLine["eventFamily"],
    );
    for (const l of expected) {
      // A new profile draws a random bib: pin it to the expected one.
      sql(`update profiles set bib_number = ${l.bib.number}, bib_color = '${l.bib.color}'
        where id = '${l.userId}'`);
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
