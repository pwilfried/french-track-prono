import { describe, expect, it } from "vitest";

import { listMyPredictions } from "./list-my-predictions";
import type { Prediction, PredictionRepository } from "./save-prediction";

const prediction = (userId: string, eventId: string, useJoker = false): Prediction => ({
  userId,
  eventId,
  podium: { first: "a", second: "b", third: "c" },
  useJoker,
});

function repositoryWith(all: Prediction[]): PredictionRepository {
  return {
    find: async () => null,
    save: async () => "saved",
    listForCompetition: async (userId) => all.filter((p) => p.userId === userId),
  };
}

describe("listMyPredictions", () => {
  it("returns the predictions of the player with the joker flag", async () => {
    const mine = [prediction("me", "e1", true), prediction("me", "e2")];
    const useCase = listMyPredictions({ predictions: repositoryWith(mine) });

    expect(await useCase.execute({ userId: "me", competitionSlug: "c" })).toEqual(mine);
  });

  it("does not return the predictions of other players", async () => {
    const useCase = listMyPredictions({
      predictions: repositoryWith([prediction("me", "e1"), prediction("other", "e1")]),
    });

    const result = await useCase.execute({ userId: "me", competitionSlug: "c" });

    expect(result.map((p) => p.userId)).toEqual(["me"]);
  });
});
