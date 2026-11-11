import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { availableCredits, bidProblem, reservedCredits, type ManagerBid } from "./manager-bid";

const bid = (athleteId: string, amount: number): ManagerBid => ({
  athleteId,
  amount,
  bidAt: "2027-01-01T10:00:00.000Z",
});

describe("reserved and available credits", () => {
  it("reserves the sum of the active bids and leaves the rest of the budget", () => {
    const bids = [bid("a", 30), bid("b", 25)];
    expect(reservedCredits(bids)).toBe(55);
    expect(availableCredits(100, bids)).toBe(45);
  });

  it("reserves nothing without a bid", () => {
    expect(availableCredits(100, [])).toBe(100);
  });
});

describe("bidProblem", () => {
  const base = { athleteId: "c", price: 10, budget: 100, bids: [bid("a", 30), bid("b", 25)] };

  it("accepts a bid at the reference price within the available budget", () => {
    expect(bidProblem({ ...base, amount: 10 })).toBeNull();
  });

  it("refuses a bid below the reference price", () => {
    expect(bidProblem({ ...base, amount: 9 })).toBe("below_price");
  });

  it("refuses an amount that is not a whole number of credits above 0", () => {
    expect(bidProblem({ ...base, amount: 12.5 })).toBe("invalid");
    expect(bidProblem({ ...base, amount: 0 })).toBe("invalid");
    expect(bidProblem({ ...base, amount: Number.NaN })).toBe("invalid");
  });

  it("refuses a bid that takes the active bids over the budget", () => {
    expect(bidProblem({ ...base, amount: 45 })).toBeNull();
    expect(bidProblem({ ...base, amount: 46 })).toBe("over_budget");
  });

  it("counts a changed bid in place of the former one on the same athlete", () => {
    expect(bidProblem({ ...base, athleteId: "a", amount: 75 })).toBeNull();
    expect(bidProblem({ ...base, athleteId: "a", amount: 76 })).toBe("over_budget");
  });

  it("never lets the accepted bids reserve more than the budget", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.array(fc.tuple(fc.constantFrom("a", "b", "c", "d"), fc.integer({ min: 1, max: 120 }))),
        (budget, attempts) => {
          let bids: ManagerBid[] = [];
          for (const [athleteId, amount] of attempts) {
            if (bidProblem({ athleteId, amount, price: 1, budget, bids })) continue;
            bids = [...bids.filter((b) => b.athleteId !== athleteId), bid(athleteId, amount)];
          }
          return reservedCredits(bids) <= budget;
        },
      ),
    );
  });
});
