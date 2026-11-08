import { describe, expect, it } from "vitest";

import { canPredictRound, compareRounds } from "./rounds";

describe("canPredictRound", () => {
  it("lets players predict a final once every previous round is finished", () => {
    expect(canPredictRound("final", [])).toBe(true);
    expect(canPredictRound("final", [{ status: "finished" }, { status: "finished" }])).toBe(true);
  });

  it("waits while a semi-final is not finished", () => {
    expect(canPredictRound("final", [{ status: "finished" }, { status: "live" }])).toBe(false);
    expect(canPredictRound("final", [{ status: "upcoming" }])).toBe(false);
  });

  it("never opens predictions on a heat, a quarter or a semi-final", () => {
    expect(canPredictRound("series", [])).toBe(false);
    expect(canPredictRound("quarter", [])).toBe(false);
    expect(canPredictRound("semi", [])).toBe(false);
  });
});

describe("compareRounds", () => {
  it("orders heats, quarters, semi-finals, then the final", () => {
    expect(["final", "semi", "series", "quarter"].sort(compareRounds)).toEqual([
      "series",
      "quarter",
      "semi",
      "final",
    ]);
  });
});
