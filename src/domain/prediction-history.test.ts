import { describe, expect, it } from "vitest";

import { pickHits } from "./prediction-history";

const podium = { first: "a", second: "b", third: "c" };

describe("pickHits", () => {
  it("is pending while there is no result", () => {
    expect(pickHits(podium, [])).toEqual(["pending", "pending", "pending"]);
  });

  it("tells exact, misplaced and missed picks apart", () => {
    const results = [
      { athleteId: "a", rank: 1 },
      { athleteId: "c", rank: 2 },
      { athleteId: "x", rank: 3 },
      { athleteId: "b", rank: 4 },
    ];
    expect(pickHits(podium, results)).toEqual(["exact", "missed", "misplaced"]);
  });

  it("counts a shared rank as exact for the slot it matches", () => {
    const results = [
      { athleteId: "a", rank: 1 },
      { athleteId: "b", rank: 2 },
      { athleteId: "c", rank: 2 },
    ];
    expect(pickHits(podium, results)).toEqual(["exact", "exact", "misplaced"]);
  });

  it("never finds « autre athlète »", () => {
    expect(pickHits({ ...podium, first: "other" }, [{ athleteId: "a", rank: 1 }])).toEqual([
      "missed",
      "missed",
      "missed",
    ]);
  });
});
