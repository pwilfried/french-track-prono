import { describe, expect, it } from "vitest";

import { OTHER_ATHLETE } from "@/domain/podium-draft";

import { UseCaseError } from "./errors";
import {
  getMyPrediction,
  savePrediction,
  type Prediction,
  type PredictionRepository,
  type SaveOutcome,
} from "./save-prediction";

function repository(outcome: SaveOutcome = "saved") {
  const saved: Prediction[] = [];
  const repo: PredictionRepository = {
    async find(userId, eventId) {
      return saved.find((p) => p.userId === userId && p.eventId === eventId) ?? null;
    },
    async listForCompetition(userId) {
      return saved.filter((p) => p.userId === userId);
    },
    async save(prediction) {
      if (outcome === "saved") saved.push(prediction);
      return outcome;
    },
  };
  return { repo, saved };
}

const input = {
  userId: "u1",
  eventId: "e1",
  first: "a1",
  second: "a2",
  third: "a3",
  useJoker: false,
};

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof UseCaseError) return error.code;
    throw error;
  }
  return null;
}

describe("SavePrediction", () => {
  it("saves a valid podium and returns it", async () => {
    const { repo, saved } = repository();

    const prediction = await savePrediction({ predictions: repo }).execute({
      ...input,
      useJoker: true,
    });

    expect(prediction).toEqual({
      userId: "u1",
      eventId: "e1",
      podium: { first: "a1", second: "a2", third: "a3" },
      useJoker: true,
    });
    expect(saved).toEqual([prediction]);
  });

  it("saves the marks typed for the athletes, in the unit of the discipline", async () => {
    const { repo, saved } = repository();

    await savePrediction({ predictions: repo }).execute({
      ...input,
      marks: { first: "10,85", second: "", third: "1:01.20" },
      markUnit: "time",
    });

    expect(saved[0]?.marks).toEqual({ first: 10.85, second: null, third: 61.2 });
  });

  it("saves no marks when none is typed", async () => {
    const { repo, saved } = repository();

    await savePrediction({ predictions: repo }).execute({
      ...input,
      marks: { first: "", second: " ", third: "" },
      markUnit: "time",
    });

    expect(saved[0]).not.toHaveProperty("marks");
  });

  it.each([
    ["a mark that is not one", { first: "dix", second: "", third: "" }, "time"],
    ["a mark for « autre athlète »", { first: "", second: "10.90", third: "" }, "time"],
    ["a mark without a known unit", { first: "10.85", second: "", third: "" }, undefined],
  ] as const)("refuses %s with MARK_INVALID, saving nothing", async (_, marks, markUnit) => {
    const { repo, saved } = repository();

    expect(
      await codeOf(
        savePrediction({ predictions: repo }).execute({
          ...input,
          second: OTHER_ATHLETE,
          marks,
          markUnit,
        }),
      ),
    ).toBe("MARK_INVALID");
    expect(saved).toEqual([]);
  });

  it("saves a podium with « autre athlète » on one place", async () => {
    const { repo, saved } = repository();

    await savePrediction({ predictions: repo }).execute({ ...input, second: OTHER_ATHLETE });

    expect(saved[0]?.podium.second).toBe(OTHER_ATHLETE);
  });

  it.each([
    ["the same athlete twice", { second: "a1" }],
    ["an empty step", { third: "" }],
  ])("refuses a podium with %s without calling the repository", async (_, change) => {
    const { repo, saved } = repository();

    expect(
      await codeOf(savePrediction({ predictions: repo }).execute({ ...input, ...change })),
    ).toBe("PODIUM_INVALID");
    expect(saved).toEqual([]);
  });

  it.each([
    ["locked", "PREDICTION_LOCKED"],
    ["athlete_not_in_event", "ATHLETE_NOT_IN_EVENT"],
    ["athlete_not_proposed", "ATHLETE_NOT_PROPOSED"],
    ["joker_already_used", "JOKER_ALREADY_USED"],
  ] as const)("turns the repository outcome %s into the code %s", async (outcome, code) => {
    const { repo } = repository(outcome);

    expect(await codeOf(savePrediction({ predictions: repo }).execute(input))).toBe(code);
  });
});

describe("GetMyPrediction", () => {
  it("returns the saved prediction of the player for the event", async () => {
    const { repo } = repository();
    const saved = await savePrediction({ predictions: repo }).execute(input);

    expect(
      await getMyPrediction({ predictions: repo }).execute({ userId: "u1", eventId: "e1" }),
    ).toEqual(saved);
  });

  it("returns null when the player has not predicted this event", async () => {
    const { repo } = repository();

    expect(
      await getMyPrediction({ predictions: repo }).execute({ userId: "u1", eventId: "e2" }),
    ).toBeNull();
  });
});
