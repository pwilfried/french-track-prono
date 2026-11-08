import { describe, expect, it } from "vitest";

import { scoreSummary } from "./score-summary";

describe("scoreSummary", () => {
  it("counts the players, the points given, the best score and the players at zero", () => {
    expect(scoreSummary([24, 4, 0])).toEqual({
      players: 3,
      total: 28,
      average: 28 / 3,
      best: 24,
      atZero: 1,
    });
  });

  it("gives zeros when nobody predicted the event", () => {
    expect(scoreSummary([])).toEqual({ players: 0, total: 0, average: 0, best: 0, atZero: 0 });
  });
});
