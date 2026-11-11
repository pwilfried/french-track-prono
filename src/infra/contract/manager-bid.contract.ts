import { describe, expect, it } from "vitest";

import type { ManagerBidRepository } from "@/application/manager-bids";

/**
 * A league with a budget of 100 and its mercato open, two participants, an outsider, two athletes
 * of the catalogue priced 10 and 20, and a closed league the first participant is also in.
 */
export type ManagerBidWorld = {
  leagueId: string;
  closedLeagueId: string;
  first: ManagerBidRepository;
  second: ManagerBidRepository;
  outsider: ManagerBidRepository;
  cheap: string;
  dear: string;
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

    it("takes no bid while the mercato of the league is not open", async () => {
      const w = await world();
      try {
        expect(await w.first.place(w.closedLeagueId, w.cheap, 10)).toBe("mercato_closed");
        expect(await w.first.withdraw(w.closedLeagueId, w.cheap)).toBe("mercato_closed");
        const mine = await w.first.mine(w.closedLeagueId);
        expect(mine).toMatchObject({ mercatoOpen: false, bids: [] });
      } finally {
        await w.restore();
      }
    });
  });
}
