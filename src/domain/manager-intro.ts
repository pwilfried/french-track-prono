import { MANAGER_LEAGUE_MAX, MANAGER_LEAGUE_MIN, MIN_SEASON_COMPETITIONS } from "./manager-league";
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
  /** The league sizes, an even number in between set by the competitions chosen (#644). */
  leagueMin: number;
  leagueMax: number;
  /** The fewest competitions a creator chooses for a league (#644). */
  minCompetitions: number;
};

export function managerIntroFigures(rules: ManagerRules): ManagerIntroFigures {
  return {
    budget: rules.budget,
    minTeamSize: rules.minTeamSize,
    lineupMax: rules.lineup.max,
    winBonus: rules.bonuses.first,
    leagueMin: MANAGER_LEAGUE_MIN,
    leagueMax: MANAGER_LEAGUE_MAX,
    minCompetitions: MIN_SEASON_COMPETITIONS,
  };
}
