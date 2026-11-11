import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { awardBids, roundEndsAt, roundHours, type LeagueBid } from "./manager-round";

const rounds = { firstHours: 48, longRounds: 2, nextHours: 24 };

describe("round durations", () => {
  it("lasts 48 hours for rounds 1 and 2, then 24 hours", () => {
    expect([1, 2, 3, 4].map((n) => roundHours(rounds, n))).toEqual([48, 48, 24, 24]);
  });

  it("ends each round after the ones before it, from the opening of the mercato", () => {
    const opened = "2027-01-01T12:00:00.000Z";
    expect(roundEndsAt(opened, rounds, 1)).toBe("2027-01-03T12:00:00.000Z");
    expect(roundEndsAt(opened, rounds, 2)).toBe("2027-01-05T12:00:00.000Z");
    expect(roundEndsAt(opened, rounds, 3)).toBe("2027-01-06T12:00:00.000Z");
  });
});

const bid = (userId: string, athleteId: string, amount: number, bidAt: string): LeagueBid => ({
  userId,
  athleteId,
  amount,
  bidAt,
});

describe("awardBids", () => {
  it("gives each athlete to the highest bid", () => {
    const awards = awardBids([
      bid("u1", "a", 30, "2027-01-01T10:00:00.000001Z"),
      bid("u2", "a", 40, "2027-01-01T10:00:00.000002Z"),
      bid("u1", "b", 20, "2027-01-01T10:00:00.000003Z"),
    ]);
    expect(awards).toEqual([
      { athleteId: "a", userId: "u2", amount: 40 },
      { athleteId: "b", userId: "u1", amount: 20 },
    ]);
  });

  it("breaks a tie in favour of the bid placed first at that amount", () => {
    const awards = awardBids([
      bid("u1", "a", 30, "2027-01-01T10:00:00.000002Z"),
      bid("u2", "a", 30, "2027-01-01T10:00:00.000001Z"),
    ]);
    expect(awards).toEqual([{ athleteId: "a", userId: "u2", amount: 30 }]);
  });

  it("awards nothing without a bid", () => {
    expect(awardBids([])).toEqual([]);
  });

  it("does not depend on the order the bids arrive in", () => {
    const bids = fc.array(
      fc.record({
        userId: fc.constantFrom("u1", "u2", "u3"),
        athleteId: fc.constantFrom("a", "b", "c"),
        amount: fc.integer({ min: 1, max: 5 }),
      }),
    );
    fc.assert(
      fc.property(bids, fc.nat(), (raw, seed) => {
        // One bid per player and athlete, and distinct times, as in the database.
        const seen = new Set<string>();
        const list = raw
          .filter((b) => {
            const key = `${b.userId}/${b.athleteId}`;
            return !seen.has(key) && Boolean(seen.add(key));
          })
          .map((b, i) =>
            bid(
              b.userId,
              b.athleteId,
              b.amount,
              `2027-01-01T10:00:00.${String(i).padStart(6, "0")}Z`,
            ),
          );
        const shuffled = [...list].sort(
          (x, y) => ((x.amount * 31 + seed) % 7) - ((y.amount * 31 + seed) % 7),
        );
        expect(awardBids(shuffled)).toEqual(awardBids(list));
        for (const award of awardBids(list)) {
          const amounts = list.filter((b) => b.athleteId === award.athleteId).map((b) => b.amount);
          expect(award.amount).toBe(Math.max(...amounts));
        }
      }),
    );
  });
});
