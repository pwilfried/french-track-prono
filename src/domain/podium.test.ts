import { describe, expect, it } from "vitest";

import type { ResultLine } from "./event";
import { podiumSteps, predictionVsOfficial } from "./podium";

const line = (name: string, rank: number): ResultLine => ({
  athleteId: name,
  slug: name,
  name,
  countryCode: "FRA",
  rank,
  mark: null,
});

describe("podiumSteps", () => {
  it("returns the three steps in order 1, 2, 3 with their athletes", () => {
    const steps = podiumSteps([line("a", 1), line("b", 2), line("c", 3)]);

    expect(steps.map((s) => [s.rank, s.athletes.map((a) => a.name)])).toEqual([
      [1, ["a"]],
      [2, ["b"]],
      [3, ["c"]],
    ]);
  });

  it("puts tied athletes on the same step", () => {
    const steps = podiumSteps([line("a", 1), line("b", 2), line("c", 3), line("d", 3)]);

    expect(steps[2]!.athletes.map((a) => a.name)).toEqual(["c", "d"]);
  });

  it("leaves the second step empty after a tie for first", () => {
    const steps = podiumSteps([line("a", 1), line("b", 1), line("c", 3)]);

    expect(steps.map((s) => s.athletes.length)).toEqual([2, 0, 1]);
  });

  it("ignores athletes ranked below the podium", () => {
    const steps = podiumSteps([line("a", 1), line("b", 2), line("c", 3), line("d", 4)]);

    expect(steps.flatMap((s) => s.athletes).map((a) => a.name)).toEqual(["a", "b", "c"]);
  });

  it("returns three empty steps when there is no result", () => {
    expect(podiumSteps([]).map((s) => s.athletes.length)).toEqual([0, 0, 0]);
  });
});

describe("predictionVsOfficial", () => {
  const results = [
    { athleteId: "a", rank: 1 },
    { athleteId: "b", rank: 2 },
    { athleteId: "c", rank: 3 },
    { athleteId: "d", rank: 3 },
  ];

  it("says exact, on the podium or off for each slot", () => {
    expect(
      predictionVsOfficial({ first: "a", second: "c", third: "z" }, results).map((r) => r.outcome),
    ).toEqual(["exact", "on_podium", "off"]);
  });

  it("counts a tied athlete as exact on the shared place", () => {
    expect(predictionVsOfficial({ first: "b", second: "a", third: "d" }, results)[2]!.outcome).toBe(
      "exact",
    );
  });
});
