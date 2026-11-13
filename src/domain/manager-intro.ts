import type { ManagerRules } from "./manager-rules";

/** The figures the presentation of the Manager quotes (#618): never written in the text. */
export type ManagerIntroFigures = {
  budget: number;
  minTeamSize: number;
  lineupMax: number;
  /** The bonus for a win, the first of the sporting bonuses. */
  winBonus: number;
};

export function managerIntroFigures(rules: ManagerRules): ManagerIntroFigures {
  return {
    budget: rules.budget,
    minTeamSize: rules.minTeamSize,
    lineupMax: rules.lineup.max,
    winBonus: rules.bonuses.first,
  };
}
