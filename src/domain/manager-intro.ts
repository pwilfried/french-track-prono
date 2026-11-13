import { MANAGER_LEAGUE_MAX, MANAGER_LEAGUE_MIN } from "./manager-league";
import type { ManagerRules } from "./manager-rules";

/**
 * The figures the presentation (#618) and the tutorial (#616) of the Manager quote: never written
 * in the text.
 */
export type ManagerIntroFigures = {
  budget: number;
  minTeamSize: number;
  lineupMax: number;
  /** The bonus for a win, the first of the sporting bonuses. */
  winBonus: number;
  /** The league sizes a creator can choose (an even number in between). */
  leagueMin: number;
  leagueMax: number;
};

export function managerIntroFigures(rules: ManagerRules): ManagerIntroFigures {
  return {
    budget: rules.budget,
    minTeamSize: rules.minTeamSize,
    lineupMax: rules.lineup.max,
    winBonus: rules.bonuses.first,
    leagueMin: MANAGER_LEAGUE_MIN,
    leagueMax: MANAGER_LEAGUE_MAX,
  };
}
