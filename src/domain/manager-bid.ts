/**
 * A secret bid of the mercato (v0.13, #422): a participant's offer on one athlete. Only its author
 * sees it; the last offer counts, and its time moves with every change (it breaks ties, #423).
 */
export type ManagerBid = {
  athleteId: string;
  amount: number;
  /** ISO time of the last change, to the microsecond in the database. */
  bidAt: string;
};

/** A bid has at most this many digits (#712): a longer amount is refused before the database. */
export const MAX_BID_DIGITS = 6;

export type BidProblem = "invalid" | "below_price" | "over_budget";

/** The credits the active bids reserve. */
export const reservedCredits = (bids: ManagerBid[]) => bids.reduce((sum, b) => sum + b.amount, 0);

/** What is left of the budget once the active bids are reserved. */
export const availableCredits = (budget: number, bids: ManagerBid[]) =>
  budget - reservedCredits(bids);

/**
 * Why a bid cannot be placed, or null. A bid is a whole number of credits, at least the reference
 * price; it replaces the player's former bid on the athlete, and all the active bids together stay
 * within the budget.
 */
export function bidProblem(input: {
  athleteId: string;
  amount: number;
  price: number;
  budget: number;
  bids: ManagerBid[];
}): BidProblem | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return "invalid";
  if (input.amount < input.price) return "below_price";
  const others = input.bids.filter((b) => b.athleteId !== input.athleteId);
  if (reservedCredits(others) + input.amount > input.budget) return "over_budget";
  return null;
}
