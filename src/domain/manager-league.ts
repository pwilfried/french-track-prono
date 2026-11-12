/** A French Track Manager league holds 4 to 12 participants (v0.12, #419). */
export const MANAGER_LEAGUE_MIN = 4;
export const MANAGER_LEAGUE_MAX = 12;

/** The season starts with 4 to 12 participants, an even number: everyone plays every round. */
export const canStartManagerSeason = (participants: number) =>
  participants >= MANAGER_LEAGUE_MIN &&
  participants <= MANAGER_LEAGUE_MAX &&
  participants % 2 === 0;

/**
 * The participant who joined last, first joined first in the list: the catalogue before the
 * mercato says « X vient de rejoindre la ligue » (#620). Nobody while the creator is alone.
 */
export const newestArrival = <P>(participants: readonly P[]): P | null =>
  participants.length > 1 ? participants[participants.length - 1]! : null;
