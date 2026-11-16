import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import { MANAGER_FAMILIES, type ManagerSex, type TeamQuota } from "./manager-rules";
import { athleteInitials, fitsQuotas, shortAthleteName, unmetQuotas } from "./manager-team";

describe("athleteInitials", () => {
  it("takes the first letter of the first and the last name", () => {
    expect(athleteInitials("Léa Fictive")).toBe("LF");
    expect(athleteInitials("  jean-marc de la Démo ")).toBe("JD");
  });

  it("keeps one letter for a single name", () => {
    expect(athleteInitials("Démo")).toBe("D");
  });
});

describe("shortAthleteName", () => {
  it("keeps the first name and the initial of the last name", () => {
    expect(shortAthleteName("Léa Fictive")).toBe("Léa F.");
    expect(shortAthleteName("Jean-Marc de la Démo")).toBe("Jean-Marc D.");
  });

  it("keeps a single name whole", () => {
    expect(shortAthleteName("Démo")).toBe("Démo");
  });
});

/** The quotas of 16 Nov. 2026 (#1017): per family 1 woman and 1 man, 3 in all, 4 of a sex at most. */
const quotas: TeamQuota[] = MANAGER_FAMILIES.map((family) => ({
  family,
  min: 3,
  minPerSex: 1,
  maxPerSex: 4,
}));

const athletes = (n: number, sex: ManagerSex, family: DisciplineFamily) =>
  Array.from({ length: n }, () => ({ sex, family }));

/** Two women and a man in every family: compliant. */
const balanced = [
  ...athletes(2, "F", "sprint"),
  ...athletes(1, "M", "hurdles"),
  ...athletes(2, "F", "middle"),
  ...athletes(1, "M", "long"),
  ...athletes(2, "F", "horizontal_jumps"),
  ...athletes(1, "M", "combined"),
  ...athletes(2, "F", "throws"),
  ...athletes(1, "M", "throws"),
];

describe("unmetQuotas", () => {
  it("is empty when the team reaches every minimum", () => {
    expect(unmetQuotas(quotas, balanced)).toEqual([]);
  });

  it("finds a team without a woman thrower not compliant", () => {
    const team = [...balanced.filter((a) => a.family !== "throws"), ...athletes(3, "M", "throws")];
    expect(unmetQuotas(quotas, team)).toEqual([{ family: "throws", sex: "F" }]);
  });

  it("counts hurdlers as sprinters and combined events as jumps", () => {
    const team = [
      ...balanced.filter((a) => a.family !== "sprint" && a.family !== "horizontal_jumps"),
      ...athletes(2, "F", "hurdles"),
      ...athletes(2, "F", "combined"),
    ];
    expect(unmetQuotas(quotas, team)).toEqual([]);
  });

  it("lists, family by family, the sexes missing and then a family too small", () => {
    expect(unmetQuotas(quotas, [{ sex: "M", family: "sprint" }]).slice(0, 4)).toEqual([
      { family: "sprint", sex: "F" },
      { family: "sprint", sex: null },
      { family: "distance", sex: "F" },
      { family: "distance", sex: "M" },
    ]);
  });
});

describe("fitsQuotas", () => {
  it("refuses a fifth man sprinter", () => {
    const team = athletes(4, "M", "sprint");
    expect(fitsQuotas(quotas, team, { sex: "M", family: "hurdles" })).toBe(false);
  });

  it("still takes a woman sprinter next to four men", () => {
    const team = athletes(4, "M", "sprint");
    expect(fitsQuotas(quotas, team, { sex: "F", family: "sprint" })).toBe(true);
  });

  it("refuses a relay team and a family without a quota", () => {
    expect(fitsQuotas(quotas, [], { sex: "F", family: "relay" })).toBe(false);
    expect(fitsQuotas(quotas.slice(1), [], { sex: "F", family: "sprint" })).toBe(false);
  });
});
