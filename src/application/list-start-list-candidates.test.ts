import { describe, expect, it } from "vitest";

import { listStartListCandidates } from "./list-start-list-candidates";
import type { Candidate, StartListRepository } from "./set-start-list";

describe("listStartListCandidates", () => {
  it("asks the start lists for the athletes of the event's gender", async () => {
    const women: Candidate[] = [{ athleteId: "1", name: "Julien Alfred", countryCode: "LCA" }];
    const startLists: StartListRepository = {
      candidates: async (gender) => (gender === "F" ? women : []),
      find: async () => [],
      replace: async () => "saved",
      promote: async () => "not_admin",
    };

    expect(await listStartListCandidates({ startLists }).execute({ gender: "F" })).toEqual(women);
  });
});
