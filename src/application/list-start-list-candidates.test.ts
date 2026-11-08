import { describe, expect, it } from "vitest";

import { listStartListCandidates } from "./list-start-list-candidates";
import type { Candidate, StartListRepository } from "./set-start-list";

describe("listStartListCandidates", () => {
  it("offers the women of the 100 m first, a main discipline before the others", async () => {
    const women: Candidate[] = [
      { athleteId: "3", name: "Yaroslava Mahuchikh", countryCode: "UKR", fit: "other" },
      { athleteId: "2", name: "Gabby Thomas", countryCode: "USA", fit: "discipline" },
      { athleteId: "1", name: "Julien Alfred", countryCode: "LCA", fit: "primary" },
    ];
    const asked: string[] = [];
    const startLists: StartListRepository = {
      candidates: async (gender, discipline, eventId) => {
        asked.push(`${gender} ${discipline} ${eventId}`);
        return gender === "F" ? women : [];
      },
      find: async () => [],
      replace: async () => "saved",
      createAthlete: async () => "not_admin",
      promote: async () => "not_admin",
    };

    const candidates = await listStartListCandidates({ startLists }).execute({
      gender: "F",
      discipline: "100 m",
      eventId: "e1",
    });

    expect(asked).toEqual(["F 100 m e1"]);
    expect(candidates.map((c) => c.athleteId)).toEqual(["1", "2", "3"]);
  });
});
