import { describe, expect, it } from "vitest";

import {
  enterResults,
  type ResultEntry,
  type ResultOutcome,
  type ResultRepository,
} from "./enter-results";
import { UseCaseError } from "./errors";

function repository(outcome: ResultOutcome = "saved") {
  const stored = new Map<string, ResultEntry[]>();
  const results: ResultRepository = {
    find: async (eventId) => stored.get(eventId) ?? [],
    replace: async (eventId, lines) => {
      if (outcome === "saved") stored.set(eventId, lines);
      return outcome;
    },
  };
  return { results, stored };
}

const line = (athleteId: string, rank: number, mark: string | null = null): ResultEntry => ({
  athleteId,
  rank,
  mark,
});
const podium = [line("a", 1, "10.80"), line("b", 2, "10.85"), line("c", 3, "10.90")];

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("enterResults", () => {
  it("saves the official podium of an event", async () => {
    const { results, stored } = repository();

    await enterResults({ results }).execute({ eventId: "e1", lines: podium });

    expect(stored.get("e1")).toEqual(podium);
  });

  it("replaces the previous result when the admin saves again", async () => {
    const { results, stored } = repository();
    const useCase = enterResults({ results });
    await useCase.execute({ eventId: "e1", lines: podium });
    const corrected = [line("b", 1), line("a", 2), line("c", 3)];

    await useCase.execute({ eventId: "e1", lines: corrected });

    expect(stored.get("e1")).toEqual(corrected);
  });

  it("keeps a tie for third place", async () => {
    const { results, stored } = repository();
    const tie = [line("a", 1), line("b", 2), line("c", 3), line("d", 3)];

    await enterResults({ results }).execute({ eventId: "e1", lines: tie });

    expect(stored.get("e1")).toHaveLength(4);
  });

  it("trims the marks and stores an empty mark as none", async () => {
    const { results, stored } = repository();

    await enterResults({ results }).execute({
      eventId: "e1",
      lines: [line("a", 1, " 10.80 "), line("b", 2, ""), line("c", 3)],
    });

    expect(stored.get("e1")!.map((l) => l.mark)).toEqual(["10.80", null, null]);
  });

  it("refuses an incomplete or inconsistent podium with RESULT_INVALID", async () => {
    const { results, stored } = repository();
    const useCase = enterResults({ results });

    expect(await codeOf(useCase.execute({ eventId: "e1", lines: podium.slice(0, 2) }))).toBe(
      "RESULT_INVALID",
    );
    expect(
      await codeOf(
        useCase.execute({ eventId: "e1", lines: [line("a", 1), line("b", 3), line("c", 3)] }),
      ),
    ).toBe("RESULT_INVALID");
    expect(stored.size).toBe(0);
  });

  it("refuses a player who is not admin with NOT_ADMIN", async () => {
    const { results } = repository("not_admin");

    expect(await codeOf(enterResults({ results }).execute({ eventId: "e1", lines: podium }))).toBe(
      "NOT_ADMIN",
    );
  });

  it("refuses an athlete who is not on the start list with ATHLETE_NOT_IN_EVENT", async () => {
    const { results } = repository("athlete_not_in_event");

    expect(await codeOf(enterResults({ results }).execute({ eventId: "e1", lines: podium }))).toBe(
      "ATHLETE_NOT_IN_EVENT",
    );
  });
});
