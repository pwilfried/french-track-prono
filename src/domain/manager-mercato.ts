import type { MercatoCloseMode } from "./manager-rules";

/**
 * The close of the mercato (v0.13, #424), in the ways the rules of the league allow: no
 * participant can recruit any more (once the bids under way are resolved), the last one who can
 * decides to end it, or the scheduled time has come. The close is collective: it reads the
 * situation of every participant. The database does the same in private.close_manager_rounds()
 * and close_manager_mercato().
 */

/** A participant as the close sees them: the credits left and how many athletes they won. */
export type Recruiter = { userId: string; left: number; athletes: number };

/** What recruiting takes in a league: the price of the cheapest free athlete. */
export type RecruitRules = { cheapestFree: number | null };

/**
 * A participant can recruit while their credits pay a free athlete; a team has no maximum size
 * (#607).
 */
export const canRecruit = (p: Recruiter, rules: RecruitRules) =>
  rules.cheapestFree !== null && p.left >= rules.cheapestFree;

type League = RecruitRules & { modes: MercatoCloseMode[]; players: Recruiter[] };

/** Why the mercato closes by itself now, or null while it stays open. */
export function mercatoCloseReason(
  league: League & { closesAt: string | null; now: string },
): Exclude<MercatoCloseMode, "last_bidder"> | null {
  if (
    league.modes.includes("scheduled") &&
    league.closesAt !== null &&
    Date.parse(league.closesAt) <= Date.parse(league.now)
  ) {
    return "scheduled";
  }
  if (
    league.modes.includes("budgets_spent") &&
    !league.players.some((p) => canRecruit(p, league))
  ) {
    return "budgets_spent";
  }
  return null;
}

/** True when `userId` is the only participant who can still recruit, and the rules let them close. */
export function mayCloseMercato(userId: string, league: League): boolean {
  const recruiters = league.players.filter((p) => canRecruit(p, league));
  return (
    league.modes.includes("last_bidder") &&
    recruiters.length === 1 &&
    recruiters[0]!.userId === userId
  );
}
