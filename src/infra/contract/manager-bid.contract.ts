import { describe, expect, it } from "vitest";

import type { ManagerBidRepository } from "@/application/manager-bids";
import type { ManagerRevealRepository } from "@/application/manager-reveal";

/**
 * A league with a budget of 100 and its mercato open, two participants, an outsider, two athletes
 * of the catalogue priced 10 and 20, and a closed league the first participant is also in. The
 * rules of the league let the last bidder close the mercato, and only them.
 */
export type ManagerBidWorld = {
  leagueId: string;
  closedLeagueId: string;
  first: ManagerBidRepository;
  second: ManagerBidRepository;
  outsider: ManagerBidRepository;
  firstId: string;
  secondId: string;
  /** The same three players' view of the closed rounds (#604). */
  reveals: Record<"first" | "second" | "outsider", ManagerRevealRepository>;
  cheap: string;
  dear: string;
  /** Lets the time of the open round pass and runs the close of the rounds (#423). */
  closeRound: () => Promise<void>;
  restore: () => Promise<void>;
};

/** Contract of the ManagerBidRepository port, run against the in-memory fake AND Supabase. */
export function managerBidContract(name: string, world: () => Promise<ManagerBidWorld>) {
  describe(`ManagerBidRepository contract: ${name}`, () => {
    it("keeps each player's bids secret, at the price at least and within the budget", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.leagueId, w.cheap, 30)).toBe("placed");
        expect(await w.first.place(w.leagueId, w.dear, 19)).toBe("below_price");
        expect(await w.first.place(w.leagueId, w.dear, 71)).toBe("over_budget");
        expect(await w.first.place(w.leagueId, w.dear, 70)).toBe("placed");
        expect(await w.second.place(w.leagueId, w.cheap, 50)).toBe("placed");

        const mine = await w.first.mine(w.leagueId);
        if (mine === "not_member") throw new Error("the participant reads their bids");
        expect(mine.budget).toBe(100);
        expect(mine.mercatoOpen).toBe(true);
        expect(mine.bids.map((b) => [b.athleteId, b.amount]).sort()).toEqual(
          [
            [w.cheap, 30],
            [w.dear, 70],
          ].sort(),
        );
        const theirs = await w.second.mine(w.leagueId);
        if (theirs === "not_member") throw new Error("the second participant reads their bids");
        expect(theirs.bids.map((b) => [b.athleteId, b.amount])).toEqual([[w.cheap, 50]]);

        expect(await w.outsider.mine(w.leagueId)).toBe("not_member");
        expect(await w.outsider.place(w.leagueId, w.cheap, 10)).toBe("not_member");
      } finally {
        await w.restore();
      }
    });

    it("moves the time of a changed bid and frees the credits of a withdrawn one", async () => {
      const w = await world();
      try {
        await w.first.place(w.leagueId, w.cheap, 30);
        const before = await w.first.mine(w.leagueId);
        await w.first.place(w.leagueId, w.cheap, 35);
        const after = await w.first.mine(w.leagueId);
        if (before === "not_member" || after === "not_member") throw new Error("a participant");
        expect(after.bids).toHaveLength(1);
        expect(Date.parse(after.bids[0]!.bidAt)).toBeGreaterThan(Date.parse(before.bids[0]!.bidAt));

        expect(await w.first.withdraw(w.leagueId, w.cheap)).toBe("withdrawn");
        expect(await w.first.place(w.leagueId, w.dear, 100)).toBe("placed");
      } finally {
        await w.restore();
      }
    });

    it("awards each athlete to the best bid at the close of a round and frees the others", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.leagueId, w.cheap, 30)).toBe("placed");
        expect(await w.second.place(w.leagueId, w.cheap, 30)).toBe("placed");
        expect(await w.second.place(w.leagueId, w.dear, 40)).toBe("placed");
        const before = await w.first.mine(w.leagueId);
        if (before === "not_member") throw new Error("a participant");
        expect(before.team).toEqual([]);

        await w.closeRound();

        const first = await w.first.mine(w.leagueId);
        const second = await w.second.mine(w.leagueId);
        if (first === "not_member" || second === "not_member") throw new Error("participants");
        expect(first.team).toEqual([{ athleteId: w.cheap, amount: 30, round: 1 }]);
        expect(second.team).toEqual([{ athleteId: w.dear, amount: 40, round: 1 }]);
        expect(first.bids).toEqual([]);
        expect(second.bids).toEqual([]);
        expect(Date.parse(first.roundEndsAt!)).toBeGreaterThan(Date.parse(before.roundEndsAt!));
        expect(await w.second.place(w.leagueId, w.cheap, 50)).toBe("taken");
      } finally {
        await w.restore();
      }
    });

    it("reveals every bid of a closed round to every participant, and its reveal once (#604)", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.leagueId, w.cheap, 30)).toBe("placed");
        expect(await w.second.place(w.leagueId, w.cheap, 20)).toBe("placed");
        expect(await w.second.place(w.leagueId, w.dear, 25)).toBe("placed");
        expect(await w.reveals.second.bidRounds(w.leagueId)).toEqual([]);
        expect(await w.reveals.second.roundBids(w.leagueId, 1)).toEqual([]);
        expect(await w.reveals.second.markRevealed(w.leagueId, 1)).toBe("not_closed");

        await w.closeRound();

        const bids = await w.reveals.second.roundBids(w.leagueId, 1);
        if (bids === "not_member") throw new Error("a participant reads the closed round");
        expect(bids.sort((a, b) => b.amount - a.amount)).toEqual([
          { userId: w.firstId, athleteId: w.cheap, amount: 30, won: true },
          { userId: w.secondId, athleteId: w.dear, amount: 25, won: true },
          { userId: w.secondId, athleteId: w.cheap, amount: 20, won: false },
        ]);
        expect(await w.reveals.first.roundBids(w.leagueId, 2)).toEqual([]);
        expect(await w.reveals.outsider.bidRounds(w.leagueId)).toBe("not_member");
        expect(await w.reveals.outsider.roundBids(w.leagueId, 1)).toBe("not_member");
        expect(await w.reveals.outsider.markRevealed(w.leagueId, 1)).toBe("not_member");

        expect(await w.reveals.second.bidRounds(w.leagueId)).toEqual([{ round: 1, seen: false }]);
        expect(await w.reveals.second.markRevealed(w.leagueId, 2)).toBe("not_closed");
        expect(await w.reveals.second.markRevealed(w.leagueId, 1)).toBe("marked");
        expect(await w.reveals.second.bidRounds(w.leagueId)).toEqual([{ round: 1, seen: true }]);
        expect(await w.reveals.first.bidRounds(w.leagueId)).toEqual([{ round: 1, seen: false }]);
      } finally {
        await w.restore();
      }
    });

    it("lets the last participant who can still recruit close the mercato (#424)", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.leagueId, w.dear, 100)).toBe("placed");
        const before = await w.second.mine(w.leagueId);
        if (before === "not_member") throw new Error("a participant");
        expect(before.canClose).toBe(false);
        expect(await w.second.close(w.leagueId)).toBe("not_last_bidder");

        await w.closeRound();

        const spent = await w.first.mine(w.leagueId);
        const last = await w.second.mine(w.leagueId);
        if (spent === "not_member" || last === "not_member") throw new Error("participants");
        expect(spent.canClose).toBe(false);
        expect(last.canClose).toBe(true);
        expect(await w.first.close(w.leagueId)).toBe("not_last_bidder");
        expect(await w.outsider.close(w.leagueId)).toBe("not_member");

        expect(await w.second.place(w.leagueId, w.cheap, 10)).toBe("placed");
        expect(await w.second.close(w.leagueId)).toBe("closed");

        const closed = await w.second.mine(w.leagueId);
        if (closed === "not_member") throw new Error("a participant");
        expect(closed).toMatchObject({
          mercatoOpen: false,
          mercatoClosed: true,
          canClose: false,
          roundEndsAt: null,
          bids: [],
        });
        expect(closed.team).toEqual([{ athleteId: w.cheap, amount: 10, round: 2 }]);
        expect(await w.second.place(w.leagueId, w.cheap, 10)).toBe("mercato_closed");
        expect(await w.second.close(w.leagueId)).toBe("mercato_closed");
      } finally {
        await w.restore();
      }
    });

    it("takes no bid while the mercato of the league is not open", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.closedLeagueId, w.cheap, 10)).toBe("mercato_closed");
        expect(await w.first.withdraw(w.closedLeagueId, w.cheap)).toBe("mercato_closed");
        const mine = await w.first.mine(w.closedLeagueId);
        expect(mine).toMatchObject({
          mercatoOpen: false,
          mercatoClosed: false,
          canClose: false,
          roundEndsAt: null,
          team: [],
          bids: [],
        });
        expect(await w.first.close(w.closedLeagueId)).toBe("mercato_closed");
      } finally {
        await w.restore();
      }
    });
  });
}
