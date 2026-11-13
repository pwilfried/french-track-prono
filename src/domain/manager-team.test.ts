import { describe, expect, it } from "vitest";

import {
  athleteInitials,
  cardGroupOf,
  CARD_GROUPS,
  shortAthleteName,
  unmetQuotas,
} from "./manager-team";
import type { TeamQuota } from "./manager-rules";

describe("cardGroupOf", () => {
  it("puts sprint and hurdles together, and both jumps together", () => {
    expect(cardGroupOf("sprint")).toBe("sprint");
    expect(cardGroupOf("hurdles")).toBe("sprint");
    expect(cardGroupOf("middle")).toBe("middle");
    expect(cardGroupOf("long")).toBe("long");
    expect(cardGroupOf("horizontal_jumps")).toBe("jumps");
    expect(cardGroupOf("vertical_jumps")).toBe("jumps");
    expect(cardGroupOf("throws")).toBe("throws");
    expect(cardGroupOf("combined")).toBe("combined");
  });

  it("lists the groups in the order of the team page", () => {
    expect(CARD_GROUPS).toEqual(["sprint", "middle", "long", "jumps", "throws", "combined"]);
  });
});

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

describe("unmetQuotas", () => {
  const quotas: TeamQuota[] = [
    { sex: "F", family: "sprint", min: 1, max: 2 },
    { sex: "M", family: "throws", min: 1, max: 2 },
    { sex: "F", family: "long", min: 0, max: 2 },
  ];

  it("is empty when the team reaches every minimum", () => {
    const team = [
      { sex: "F" as const, family: "sprint" as const },
      { sex: "M" as const, family: "throws" as const },
    ];
    expect(unmetQuotas(quotas, team)).toEqual([]);
  });

  it("lists the sex and family of each minimum not reached, in the order of the rules", () => {
    expect(unmetQuotas(quotas, [{ sex: "M", family: "sprint" }])).toEqual([
      { sex: "F", family: "sprint" },
      { sex: "M", family: "throws" },
    ]);
  });
});
