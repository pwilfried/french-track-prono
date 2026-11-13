import type { LineupStatus } from "./manager-lineup";

/**
 * The steps of a French Track Manager season, as the Manager home tells them (#606): join a
 * league, recruit at the mercato, own a team, line it up, score points, play the head-to-heads,
 * crown a champion. The last four come back every matchday; the home shows where the player is.
 */
export const SEASON_STEPS = [
  "league",
  "mercato",
  "team",
  "lineup",
  "points",
  "duels",
  "champion",
] as const;

export type SeasonStep = (typeof SEASON_STEPS)[number];

/** Where the season of the player's league stands. */
export type SeasonProgress =
  | { league: false }
  | {
      league: true;
      /** Waiting for its players (or its launch), open, or closed (the schedule is drawn). */
      mercato: "waiting" | "open" | "closed";
      /** The lineup of the next competition not scored yet; null when none is left. */
      nextLineup: LineupStatus | null;
      /** At least one competition of the league has Manager scores. */
      scored: boolean;
      over: boolean;
    };

/** The step the player is at now. */
export function currentSeasonStep(progress: SeasonProgress): SeasonStep {
  if (!progress.league || progress.mercato === "waiting") return "league";
  if (progress.mercato === "open") return "mercato";
  if (progress.over) return "champion";
  if (progress.nextLineup === "todo") return "lineup";
  if (progress.nextLineup !== null) return "points";
  return progress.scored ? "duels" : "team";
}

export type SeasonStepState = "done" | "current" | "todo";

/** Every step of the season: those before the current one are done, the next ones to do. */
export function seasonSteps(current: SeasonStep): { step: SeasonStep; state: SeasonStepState }[] {
  const at = SEASON_STEPS.indexOf(current);
  return SEASON_STEPS.map((step, i) => ({
    step,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));
}
