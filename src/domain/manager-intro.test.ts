import { describe, expect, it } from "vitest";

import { managerIntroFigures } from "./manager-intro";
import type { ManagerRules } from "./manager-rules";

const rules: ManagerRules = {
  budget: 250,
  minTeamSize: 12,
  quotas: [{ sex: "F", family: "sprint", min: 0, max: 12 }],
  lineup: { max: 8, minPerFamily: {} },
  rounds: { firstHours: 48, longRounds: 2, nextHours: 24 },
  closeModes: ["scheduled"],
  bonuses: {
    first: 10,
    second: 6,
    third: 3,
    personal_best: 5,
    season_best: 3,
    national_record: 10,
    area_record: 15,
    world_record: 25,
  },
  season: { startsOn: "2027-01-01", endsOn: "2027-12-31" },
};

describe("managerIntroFigures", () => {
  it("takes the budget, the team, the lineup and the win bonus from the rules", () => {
    expect(managerIntroFigures(rules)).toMatchObject({
      budget: 250,
      minTeamSize: 12,
      lineupMax: 8,
      winBonus: 10,
    });
  });

  it("gives the league sizes a creator can choose, for the tutorial (#616)", () => {
    expect(managerIntroFigures(rules)).toMatchObject({ leagueMin: 4, leagueMax: 10 });
  });

  it("follows the rules when the admin changes them", () => {
    const changed = { ...rules, budget: 130, bonuses: { ...rules.bonuses, first: 7 } };
    expect(managerIntroFigures(changed)).toMatchObject({ budget: 130, winBonus: 7 });
  });
});
