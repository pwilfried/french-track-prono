import { describe, expect, it } from "vitest";

import type { PointsRepository, ScoreLine } from "./compute-event-points";
import { getMyPoints } from "./get-my-points";

function repository(lines: (ScoreLine & { eventId: string })[]): PointsRepository {
  return {
    loadEvent: async () => null,
    progress: async () => ({ withResult: [], scored: [] }),
    findEventScores: async () => [],
    replaceEventScores: async () => "saved",
    listMine: async (userId) => lines.filter((l) => l.userId === userId),
  };
}

describe("getMyPoints", () => {
  it("returns the total and one line per scored event, with the joker", async () => {
    const useCase = getMyPoints({
      points: repository([
        {
          userId: "me",
          eventId: "e1",
          points: 24,
          reasons: [{ kind: "perfect_podium" }, { kind: "joker" }],
        },
        { userId: "me", eventId: "e2", points: 3, reasons: [{ kind: "exact", slot: 1 }] },
      ]),
    });

    const mine = await useCase.execute({ userId: "me", competitionSlug: "c" });

    expect(mine.total).toBe(27);
    expect(mine.events.map((e) => [e.eventId, e.points, e.joker])).toEqual([
      ["e1", 24, true],
      ["e2", 3, false],
    ]);
  });

  it("only counts the player's own lines", async () => {
    const useCase = getMyPoints({
      points: repository([
        { userId: "me", eventId: "e1", points: 3, reasons: [] },
        { userId: "other", eventId: "e1", points: 12, reasons: [] },
      ]),
    });

    expect((await useCase.execute({ userId: "me", competitionSlug: "c" })).total).toBe(3);
  });

  it("gives zero points before any event is scored", async () => {
    const mine = await getMyPoints({ points: repository([]) }).execute({
      userId: "me",
      competitionSlug: "c",
    });

    expect(mine).toEqual({ total: 0, events: [] });
  });
});
