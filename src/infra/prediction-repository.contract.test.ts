import { describe, it } from "vitest";

import {
  predictionRepositoryContract,
  type EventFixture,
  type PredictionWorld,
} from "./contract/prediction-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import {
  createInMemoryPredictionRepository,
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePredictionRepository,
} from "./index";

const COMPETITION = "ultimate-championship-2026";

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
  /** Events of the local database, as the contract needs them: two open, one locked. */
  const realWorld = async (): Promise<PredictionWorld> => {
    const reader = createSupabaseEventReader(createPublicSupabaseClient());
    const summaries = await reader.listByCompetition(COMPETITION);
    const now = Date.now();
    const open = summaries.filter((e) => Date.parse(e.lockAt) > now);
    const locked = summaries.find((e) => Date.parse(e.lockAt) <= now);
    if (open.length < 2 || !locked) {
      throw new Error(
        "Needs two open events and one locked event: run `npm run db:open-events` first.",
      );
    }
    const details = await Promise.all(
      [open[0]!, open[1]!, locked].map((e) => reader.findBySlug(COMPETITION, e.slug)),
    );
    const all = details.map((d) => d!);
    const fixture = (d: (typeof all)[number]): EventFixture => {
      const ids = d.entries.map((e) => e.athleteId);
      const outsider = all.flatMap((o) => o.entries).find((e) => !ids.includes(e.athleteId));
      if (ids.length < 3 || !outsider)
        throw new Error(`Event ${d.slug} cannot be used by the contract`);
      return { eventId: d.id, athleteIds: ids, outsiderId: outsider.athleteId };
    };
    const [a, b, c] = all.map(fixture) as [EventFixture, EventFixture, EventFixture];

    const newPlayer = async () => {
      const player = await signedInPlayer(url, key);
      return {
        userId: player.userId,
        predictions: createSupabasePredictionRepository(player.client),
      };
    };
    return { competitionSlug: COMPETITION, newPlayer, openEvents: [a, b], lockedEvent: c };
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
