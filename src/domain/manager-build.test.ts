import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import { firstLineupSteps, teamBuild, type BuildRules } from "./manager-build";
import { MANAGER_FAMILIES, type ManagerSex } from "./manager-rules";

/** The rules of 16 Nov. 2026 (#1017): 12 athletes, per family 1 woman, 1 man and 3 in all. */
const rules: BuildRules = {
  minTeamSize: 12,
  quotas: MANAGER_FAMILIES.map((family) => ({ family, min: 3, minPerSex: 1, maxPerSex: 4 })),
};
const athlete = (family: DisciplineFamily, sex: ManagerSex) => ({ family, sex });

describe("teamBuild", () => {
  it("starts with an empty team missing every athlete and spreading the credits over them", () => {
    const build = teamBuild(rules, [], 120);
    expect(build).toMatchObject({ count: 0, target: 12, missing: 12, perMissing: 10 });
    expect(build.complete).toBe(false);
    expect(build.families.map((f) => [f.family, f.have, f.need, f.done])).toEqual(
      MANAGER_FAMILIES.map((family) => [family, 0, 3, false]),
    );
  });

  it("counts relays out and groups hurdles with sprint, middle and long with distance", () => {
    const build = teamBuild(
      rules,
      [
        athlete("hurdles", "F"),
        athlete("middle", "M"),
        athlete("long", "F"),
        athlete("relay", "M"),
      ],
      100,
    );
    expect(build.families.find((f) => f.family === "sprint")?.have).toBe(1);
    expect(build.families.find((f) => f.family === "distance")?.have).toBe(2);
    expect(build.count).toBe(3);
  });

  it("names the families still to complete, with how many athletes and the sexes missing", () => {
    const team = [
      ...["F", "M", "F"].map((sex) => athlete("sprint", sex as ManagerSex)),
      ...["F", "F", "F"].map((sex) => athlete("middle", sex as ManagerSex)),
    ];
    const distance = teamBuild(rules, team, 58).families.find((f) => f.family === "distance")!;
    expect(distance).toMatchObject({ have: 3, need: 3, done: false, missingSexes: ["M"] });
    const jumps = teamBuild(rules, team, 58).families.find((f) => f.family === "jumps")!;
    expect(jumps).toMatchObject({ have: 0, missing: 3, missingSexes: ["F", "M"] });
  });

  it("gives the credits left per missing athlete, rounded down", () => {
    const team = Array.from({ length: 7 }, () => athlete("sprint", "F"));
    expect(teamBuild(rules, team, 58)).toMatchObject({ missing: 5, perMissing: 11 });
  });

  it("is complete when every family is covered and the team reaches its size", () => {
    const team = MANAGER_FAMILIES.flatMap((family) => [
      athlete(family === "distance" ? "middle" : family === "jumps" ? "combined" : family, "F"),
      athlete(family === "distance" ? "middle" : family === "jumps" ? "combined" : family, "M"),
      athlete(family === "distance" ? "long" : family === "jumps" ? "vertical_jumps" : family, "F"),
    ]);
    const build = teamBuild(rules, team, 12);
    expect(build).toMatchObject({ count: 12, missing: 0, perMissing: null, complete: true });
    expect(build.families.every((f) => f.done)).toBe(true);
  });

  it("is not complete when a family is short even with enough athletes", () => {
    const team = Array.from({ length: 12 }, () => athlete("sprint", "F"));
    const build = teamBuild(rules, team, 5);
    expect(build.missing).toBe(0);
    expect(build.complete).toBe(false);
  });

  it("gives nothing per athlete when no credit is left", () => {
    expect(teamBuild(rules, [], 0).perMissing).toBe(0);
  });
});

describe("firstLineupSteps", () => {
  const base = {
    startersFilled: 0,
    startersFillable: 8,
    benchFilled: 0,
    benchSize: 4,
    tactical: false,
    validated: false,
  };

  it("starts on the starters", () => {
    expect(firstLineupSteps(base).current).toBe("starters");
  });

  it("moves on to the bench once the starters are in, then skips the optional tactical step", () => {
    const starters = { ...base, startersFilled: 8 };
    expect(firstLineupSteps(starters)).toMatchObject({ current: "bench" });
    const bench = { ...starters, benchFilled: 4 };
    const steps = firstLineupSteps(bench);
    expect(steps.done.tactical).toBe(false);
    expect(steps.current).toBe("validate");
  });

  it("is over once the lineup is validated", () => {
    const steps = firstLineupSteps({ ...base, startersFilled: 8, benchFilled: 4, validated: true });
    expect(steps.current).toBeNull();
  });
});
