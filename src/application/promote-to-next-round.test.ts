import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import { promoteToNextRound } from "./promote-to-next-round";
import type { StartListRepository } from "./set-start-list";

const repository = (outcome: Awaited<ReturnType<StartListRepository["promote"]>>) => {
  const calls: [string, number][] = [];
  const startLists: StartListRepository = {
    candidates: async () => [],
    find: async () => [],
    replace: async () => "saved",
    createAthlete: async () => "not_admin",
    promote: async (eventId, top) => {
      calls.push([eventId, top]);
      return outcome;
    },
  };
  return { startLists, calls };
};

describe("promoteToNextRound", () => {
  it("qualifies the first two of a semi-final for the final", async () => {
    const { startLists, calls } = repository(2);

    expect(await promoteToNextRound({ startLists }).execute({ eventId: "semi-1", top: 2 })).toBe(2);
    expect(calls).toEqual([["semi-1", 2]]);
  });

  it("refuses a number of qualifiers that makes no sense", async () => {
    const { startLists, calls } = repository(0);

    await expect(
      promoteToNextRound({ startLists }).execute({ eventId: "s", top: 0 }),
    ).rejects.toEqual(new UseCaseError("START_LIST_INVALID"));
    expect(calls).toEqual([]);
  });

  it("says when a round leads nowhere, or when the player is not admin", async () => {
    await expect(
      promoteToNextRound(repository("no_next_round")).execute({ eventId: "final", top: 2 }),
    ).rejects.toEqual(new UseCaseError("ROUND_UNAVAILABLE"));
    await expect(
      promoteToNextRound(repository("not_admin")).execute({ eventId: "s", top: 2 }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
