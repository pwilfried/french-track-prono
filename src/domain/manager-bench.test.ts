import { describe, expect, it } from "vitest";

import {
  addToBench,
  benchRole,
  designateSubstitute,
  matchSheetOf,
  moveOnBench,
  removeFromBench,
  tacticalCount,
  thresholdPoints,
  thresholdSense,
  type BenchPlan,
} from "./manager-bench";
import { worldAthleticsPoints } from "./world-athletics-points";

const empty: BenchPlan = { bench: [], settings: {} };

describe("addToBench", () => {
  it("puts a reservist at the end of the bench", () => {
    expect(addToBench({ ...empty, bench: ["b1"] }, "b2", 4).bench).toEqual(["b1", "b2"]);
  });

  it("changes nothing when the bench is full or the athlete already sits on it", () => {
    const full = { ...empty, bench: ["b1", "b2"] };
    expect(addToBench(full, "m1", 2)).toBe(full);
    expect(addToBench(full, "b1", 4)).toBe(full);
  });
});

describe("removeFromBench", () => {
  it("sends a substitute to the reserve and forgets them as designated substitute, threshold included", () => {
    const plan: BenchPlan = {
      bench: ["b1", "b2"],
      settings: { s1: { discipline: "200 m", substituteId: "b1", threshold: 10.5 } },
    };
    expect(removeFromBench(plan, "b1")).toEqual({
      bench: ["b2"],
      settings: { s1: { discipline: "200 m", substituteId: null, threshold: null } },
    });
  });
});

describe("moveOnBench", () => {
  it("moves a substitute up or down the order of entry", () => {
    const plan = { ...empty, bench: ["b1", "b2", "m1"] };
    expect(moveOnBench(plan, 2, 0).bench).toEqual(["m1", "b1", "b2"]);
    expect(moveOnBench(plan, 0, 1).bench).toEqual(["b2", "b1", "m1"]);
  });

  it("changes nothing out of the bench", () => {
    const plan = { ...empty, bench: ["b1", "b2"] };
    expect(moveOnBench(plan, 0, -1)).toBe(plan);
    expect(moveOnBench(plan, 1, 2)).toBe(plan);
  });
});

describe("designateSubstitute", () => {
  it("designates a substitute of the bench for a starter", () => {
    const plan = designateSubstitute({ ...empty, bench: ["b1"] }, "s1", "b1", 4);
    expect(plan.settings.s1).toEqual({ substituteId: "b1" });
    expect(plan.bench).toEqual(["b1"]);
  });

  it("puts a reservist chosen as substitute on the bench", () => {
    expect(designateSubstitute(empty, "s1", "b2", 4).bench).toEqual(["b2"]);
  });

  it("changes nothing for a reservist when the bench is full", () => {
    const full = { ...empty, bench: ["b1"] };
    expect(designateSubstitute(full, "s1", "b2", 1)).toBe(full);
  });

  it("takes the substitute away from the starter they were designated for", () => {
    const plan: BenchPlan = {
      bench: ["b1"],
      settings: { s1: { substituteId: "b1", threshold: 10.5 } },
    };
    expect(designateSubstitute(plan, "s2", "b1", 4).settings).toEqual({
      s1: { substituteId: null, threshold: null },
      s2: { substituteId: "b1" },
    });
  });

  it("without a substitute, the threshold goes too", () => {
    const plan: BenchPlan = {
      bench: ["b1"],
      settings: { s1: { substituteId: "b1", threshold: 10.5 } },
    };
    expect(designateSubstitute(plan, "s1", null, 4).settings.s1).toEqual({
      substituteId: null,
      threshold: null,
    });
  });
});

describe("benchRole", () => {
  const plan: BenchPlan = {
    bench: ["b1", "b2", "m1"],
    settings: {
      s1: { substituteId: "b1", threshold: 10.5 },
      s2: { substituteId: "b2" },
      gone: { substituteId: "m1" },
    },
  };

  it("says whom a substitute replaces, below which mark, or that they sit on the bench", () => {
    expect(benchRole(plan, ["s1", "s2"], "b1")).toEqual({
      kind: "threshold",
      starterId: "s1",
      threshold: 10.5,
    });
    expect(benchRole(plan, ["s1", "s2"], "b2")).toEqual({ kind: "absent", starterId: "s2" });
  });

  it("forgets the designation of an athlete no longer on the stadium", () => {
    expect(benchRole(plan, ["s1", "s2"], "m1")).toEqual({ kind: "bench" });
  });
});

describe("matchSheetOf", () => {
  it("builds the sheet of the starters in place order and the bench in its order", () => {
    const plan: BenchPlan = {
      bench: ["b1", "m1"],
      settings: { s1: { discipline: "200 m", substituteId: "b1", threshold: 20.8 }, old: {} },
    };
    expect(matchSheetOf(["s1", null, "s2"], plan)).toEqual({
      starters: [
        { athleteId: "s1", discipline: "200 m", substituteId: "b1", threshold: 20.8 },
        { athleteId: "s2" },
      ],
      bench: [{ athleteId: "b1" }, { athleteId: "m1" }],
    });
  });

  it("drops a designated substitute who left the bench", () => {
    const plan: BenchPlan = {
      bench: [],
      settings: { s1: { substituteId: "b1", threshold: 10.5 } },
    };
    expect(matchSheetOf(["s1"], plan).starters).toEqual([{ athleteId: "s1" }]);
  });
});

describe("tacticalCount", () => {
  it("counts the starters with a threshold and a substitute on the bench", () => {
    const plan: BenchPlan = {
      bench: ["b1"],
      settings: {
        s1: { substituteId: "b1", threshold: 10.5 },
        s2: { substituteId: "b2", threshold: 10.4 },
      },
    };
    expect(tacticalCount(["s1", "s2"], plan)).toBe(1);
  });
});

describe("thresholdSense", () => {
  it("reads a race as slower, a high jump or vault as lower, a long jump or a throw as shorter", () => {
    expect(thresholdSense("sprint")).toBe("slower");
    expect(thresholdSense("long")).toBe("slower");
    expect(thresholdSense("vertical_jumps")).toBe("lower");
    expect(thresholdSense("horizontal_jumps")).toBe("shorter_jump");
    expect(thresholdSense("throws")).toBe("shorter_throw");
    expect(thresholdSense("combined")).toBe("fewer");
  });
});

describe("thresholdPoints", () => {
  it("gives what the threshold is worth in the Manager: the table points divided by the divisor", () => {
    // 10.50 over 100 m, a man: 1 040 points of the tables, 104 with a divisor of 10.
    expect(thresholdPoints("100 m", "M", 10.5, 10)).toBe(
      Math.floor(worldAthleticsPoints("100 m", "M", 10.5)! / 10),
    );
    expect(thresholdPoints("100 m", "M", 10.5, 10)).toBeGreaterThan(90);
  });

  it("gives nothing for a discipline the tables do not cover", () => {
    expect(thresholdPoints("Relais mixte 4x100 m", "M", 40, 10)).toBeNull();
  });
});
