import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "@/domain/scoring";

import {
  computeEventPoints,
  type EventToScore,
  type PointsRepository,
  type ScoreLine,
} from "./compute-event-points";
import { UseCaseError } from "./errors";

const NOW = new Date("2026-09-12T20:00:00Z");
const LOCKED = "2026-09-12T19:00:00Z";

const pick = (userId: string, first: string, second: string, third: string, useJoker = false) => ({
  userId,
  first,
  second,
  third,
  useJoker,
});

function repository(event: EventToScore | null, outcome: "saved" | "not_admin" = "saved") {
  const stored = new Map<string, ScoreLine[]>();
  const points: PointsRepository = {
    loadEvent: async () => event,
    progress: async () => ({ withResult: [], scored: [] }),
    findEventScores: async (eventId) => stored.get(eventId) ?? [],
    listMine: async () => [],
    replaceEventScores: async (eventId, lines) => {
      if (outcome === "saved") stored.set(eventId, lines);
      return outcome;
    },
  };
  return { points, stored };
}

const scoredEvent = (overrides: Partial<EventToScore> = {}): EventToScore => ({
  lockAt: LOCKED,
  results: [
    { athleteId: "A", rank: 1 },
    { athleteId: "B", rank: 2 },
    { athleteId: "C", rank: 3 },
  ],
  predictions: [
    pick("anna", "A", "B", "C", true),
    pick("bob", "A", "C", "X"),
    pick("cleo", "X", "Y", "Z"),
  ],
  rules: DEFAULT_RULES,
  ...overrides,
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("computeEventPoints", () => {
  it("stores one score line per prediction, with the reasons", async () => {
    const { points, stored } = repository(scoredEvent());

    await computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" });

    const lines = stored.get("e1")!;
    expect(lines.map((l) => [l.userId, l.points])).toEqual([
      ["anna", 24],
      ["bob", 4],
      ["cleo", 0],
    ]);
    expect(lines[0]!.reasons).toContainEqual({ kind: "joker" });
  });

  it("gives the same points when run twice, without duplicates (S12)", async () => {
    const { points, stored } = repository(scoredEvent());
    const useCase = computeEventPoints({ points, now: () => NOW });

    const first = await useCase.execute({ eventId: "e1" });
    const second = await useCase.execute({ eventId: "e1" });

    expect(second).toEqual(first);
    expect(stored.get("e1")).toHaveLength(3);
  });

  it("refuses an event without result with RESULT_MISSING (S13)", async () => {
    const { points } = repository(scoredEvent({ results: [] }));

    expect(
      await codeOf(computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" })),
    ).toBe("RESULT_MISSING");
  });

  it("refuses an event that is not locked yet", async () => {
    const { points } = repository(scoredEvent({ lockAt: "2026-09-12T21:00:00Z" }));

    expect(
      await codeOf(computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" })),
    ).toBe("EVENT_NOT_LOCKED");
  });

  it("reads the share of the winner from all the predictions of the event", async () => {
    // 1 player out of 10 picked A: the flair bonus applies.
    const crowd = Array.from({ length: 9 }, (_, i) => pick(`p${i}`, "B", "A", "C"));
    const { points } = repository(
      scoredEvent({ predictions: [pick("anna", "A", "X", "Y"), ...crowd] }),
    );

    const lines = await computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" });

    expect(lines.find((l) => l.userId === "anna")!.points).toBe(5);
  });

  it("refuses an unknown event with EVENT_NOT_FOUND", async () => {
    const { points } = repository(null);

    expect(
      await codeOf(computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" })),
    ).toBe("EVENT_NOT_FOUND");
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const { points } = repository(scoredEvent(), "not_admin");

    expect(
      await codeOf(computeEventPoints({ points, now: () => NOW }).execute({ eventId: "e1" })),
    ).toBe("NOT_ADMIN");
  });
});
