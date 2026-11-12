import { describe, expect, it } from "vitest";

import { bidsByAthlete, myRoundTally, roundToReveal, type RoundBid } from "./manager-reveal";

const bid = (userId: string, athleteId: string, amount: number, won = false): RoundBid => ({
  userId,
  athleteId,
  amount,
  won,
});

describe("roundToReveal", () => {
  it("reveals the last closed round with bids the player has not seen", () => {
    expect(
      roundToReveal([
        { round: 1, seen: true },
        { round: 3, seen: false },
      ]),
    ).toBe(3);
  });

  it("reveals nothing once the last round is seen, or before any round with bids", () => {
    expect(roundToReveal([{ round: 2, seen: true }])).toBeNull();
    expect(roundToReveal([])).toBeNull();
  });
});

describe("bidsByAthlete", () => {
  it("lists each athlete's bids from the highest, the winning one first at the same amount", () => {
    const groups = bidsByAthlete([
      bid("u1", "a1", 20),
      bid("u2", "a1", 30),
      bid("u3", "a1", 30, true),
      bid("u1", "a2", 50, true),
    ]);
    expect(groups.map((g) => g.athleteId)).toEqual(["a2", "a1"]);
    expect(groups[1]!.bids.map((b) => [b.userId, b.amount])).toEqual([
      ["u3", 30],
      ["u2", 30],
      ["u1", 20],
    ]);
  });

  it("orders the athletes by their best bid, then by id", () => {
    const groups = bidsByAthlete([bid("u1", "b", 10), bid("u1", "a", 10), bid("u2", "c", 40)]);
    expect(groups.map((g) => g.athleteId)).toEqual(["c", "a", "b"]);
  });

  it("has nothing to show for a round without bids", () => {
    expect(bidsByAthlete([])).toEqual([]);
  });
});

describe("myRoundTally", () => {
  it("counts the player's bids and those that won", () => {
    expect(
      myRoundTally(
        [bid("u1", "a1", 20, true), bid("u1", "a2", 20), bid("u2", "a2", 30, true)],
        "u1",
      ),
    ).toEqual({ placed: 2, won: 1 });
  });

  it("counts nothing for a player who did not bid", () => {
    expect(myRoundTally([bid("u2", "a2", 30, true)], "u1")).toEqual({ placed: 0, won: 0 });
  });
});
