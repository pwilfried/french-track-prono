import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import {
  setStartList,
  type StartListEntry,
  type StartListOutcome,
  type StartListRepository,
} from "./set-start-list";

function repository(outcome: StartListOutcome = "saved") {
  const stored = new Map<string, StartListEntry[]>();
  const startLists: StartListRepository = {
    candidates: async () => [],
    find: async (eventId) => stored.get(eventId) ?? [],
    replace: async (eventId, entries) => {
      if (outcome === "saved") stored.set(eventId, entries);
      return outcome;
    },
    createAthlete: async () => "not_admin",
  };
  return { startLists, stored };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

const eight = Array.from({ length: 8 }, (_, i) => ({ athleteId: `a${i}`, seasonBest: null }));

describe("setStartList", () => {
  it("saves the eight athletes of a final, with their season bests trimmed", async () => {
    const { startLists, stored } = repository();
    const entries = [{ athleteId: "a0", seasonBest: " 10.72 " }, ...eight.slice(1)];

    await setStartList({ startLists }).execute({ eventId: "e1", entries });

    expect(stored.get("e1")).toHaveLength(8);
    expect(stored.get("e1")![0]).toEqual({ athleteId: "a0", seasonBest: "10.72" });
  });

  it("stores a blank season best as unknown", async () => {
    const { startLists, stored } = repository();

    await setStartList({ startLists }).execute({
      eventId: "e1",
      entries: [{ athleteId: "a0", seasonBest: "  " }],
    });

    expect(stored.get("e1")).toEqual([{ athleteId: "a0", seasonBest: null }]);
  });

  it("refuses an empty list or a duplicate with START_LIST_INVALID, and stores nothing", async () => {
    const { startLists, stored } = repository();
    const useCase = setStartList({ startLists });

    expect(await codeOf(useCase.execute({ eventId: "e1", entries: [] }))).toBe(
      "START_LIST_INVALID",
    );
    expect(await codeOf(useCase.execute({ eventId: "e1", entries: [...eight, eight[0]!] }))).toBe(
      "START_LIST_INVALID",
    );
    expect(stored.size).toBe(0);
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const { startLists } = repository("not_admin");

    expect(
      await codeOf(setStartList({ startLists }).execute({ eventId: "e1", entries: eight })),
    ).toBe("NOT_ADMIN");
  });

  it("refuses to remove an athlete already predicted or in the result with START_LIST_IN_USE", async () => {
    const { startLists } = repository("athlete_in_use");

    expect(
      await codeOf(setStartList({ startLists }).execute({ eventId: "e1", entries: eight })),
    ).toBe("START_LIST_IN_USE");
  });
});
