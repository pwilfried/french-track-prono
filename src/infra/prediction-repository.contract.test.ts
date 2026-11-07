import { describe, it } from "vitest";

import {
  predictionRepositoryContract,
  type EventFixture,
  type PredictionWorld,
} from "./contract/prediction-repository.contract";
import { createTestCompetition } from "./contract/database";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryPredictionRepository, createSupabasePredictionRepository } from "./index";

function fakeWorld(): PredictionWorld {
  const athletes = ["a1", "a2", "a3", "a4"];
  const future = new Date(Date.now() + 3600_000).toISOString();
  const past = new Date(Date.now() - 3600_000).toISOString();
  const fixtures = [
    { id: "open-1", competitionSlug: "c", lockAt: future, athleteIds: athletes },
    { id: "open-2", competitionSlug: "c", lockAt: future, athleteIds: athletes },
    { id: "locked", competitionSlug: "c", lockAt: past, athleteIds: athletes },
  ];
  const shared = createInMemoryPredictionRepository({ events: fixtures });
  const event = (id: string): EventFixture => ({
    eventId: id,
    athleteIds: athletes,
    outsiderId: "stranger",
  });
  return {
    competitionSlug: "c",
    newPlayer: async () => ({ userId: crypto.randomUUID(), predictions: shared }),
    openEvents: [event("open-1"), event("open-2")],
    lockedEvent: event("locked"),
  };
}

predictionRepositoryContract("in-memory fake", async () => fakeWorld());

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  /** A competition of its own: two open events and one locked event. */
  const realWorld = async (): Promise<PredictionWorld> => {
    const { competitionSlug, events, outsiderId } = createTestCompetition({ open: 2, locked: 1 });
    const [a, b, c] = events.map((e) => ({
      eventId: e.eventId,
      athleteIds: e.athleteIds,
      outsiderId,
    })) as [EventFixture, EventFixture, EventFixture];

    const newPlayer = async () => {
      const player = await signedInPlayer(url, key);
      return {
        userId: player.userId,
        predictions: createSupabasePredictionRepository(player.client),
      };
    };
    return { competitionSlug, newPlayer, openEvents: [a, b], lockedEvent: c };
  };
  predictionRepositoryContract("Supabase (local)", realWorld);
} else {
  describe("Supabase prediction repository", () => {
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
