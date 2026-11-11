import { availableCredits, reservedCredits, type ManagerBid } from "@/domain/manager-bid";

import { UseCaseError, type ErrorCode } from "./errors";
import type { ManagerCatalogueRepository } from "./manager-catalogue";

/** The player's own bids in a league, with the budget of the league and whether bids are open. */
export type MyManagerBids = { budget: number; mercatoOpen: boolean; bids: ManagerBid[] };

export type BidOutcome =
  "placed" | "not_member" | "mercato_closed" | "not_in_catalogue" | "below_price" | "over_budget";

/**
 * Port: the secret bids of the signed-in player. Real adapter = Supabase (the database checks the
 * price and the budget, and shows each player their own bids only); fake = in memory.
 */
export interface ManagerBidRepository {
  mine(leagueId: string): Promise<MyManagerBids | "not_member">;
  /** Places a bid on an athlete, or replaces the former one: the last bid counts. */
  place(leagueId: string, athleteId: string, amount: number): Promise<BidOutcome>;
  withdraw(
    leagueId: string,
    athleteId: string,
  ): Promise<"withdrawn" | "not_member" | "mercato_closed">;
}

export type MyBidLine = ManagerBid & { name: string; price: number };

export type MyBidsView = {
  budget: number;
  reserved: number;
  available: number;
  mercatoOpen: boolean;
  /** By athlete name. */
  bids: MyBidLine[];
};

const refused: Record<Exclude<BidOutcome, "placed">, ErrorCode> = {
  not_member: "LEAGUE_NOT_FOUND",
  mercato_closed: "MERCATO_NOT_OPEN",
  not_in_catalogue: "ATHLETE_NOT_IN_CATALOGUE",
  below_price: "MANAGER_BID_BELOW_PRICE",
  over_budget: "MANAGER_BID_OVER_BUDGET",
};

/** The player's bids in a league, the credits they reserve and those left (#422). */
export function getMyManagerBids(ports: {
  bids: ManagerBidRepository;
  catalogue: ManagerCatalogueRepository;
}) {
  return {
    async execute(input: { leagueId: string }): Promise<MyBidsView> {
      const [mine, athletes] = await Promise.all([
        ports.bids.mine(input.leagueId),
        ports.catalogue.list(input.leagueId),
      ]);
      if (mine === "not_member" || athletes === "not_member") {
        throw new UseCaseError("LEAGUE_NOT_FOUND");
      }
      const byId = new Map(athletes.map((a) => [a.athleteId, a]));
      const bids = mine.bids
        .map((b) => {
          const athlete = byId.get(b.athleteId);
          return { ...b, name: athlete?.name ?? "", price: athlete?.price ?? 0 };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
      return {
        budget: mine.budget,
        reserved: reservedCredits(mine.bids),
        available: availableCredits(mine.budget, mine.bids),
        mercatoOpen: mine.mercatoOpen,
        bids,
      };
    },
  };
}

/** Places or changes a secret bid; the amount comes from the form, in whole credits. */
export function placeManagerBid(ports: { bids: ManagerBidRepository }) {
  return {
    async execute(input: { leagueId: string; athleteId: string; amount: string }): Promise<void> {
      const text = input.amount.trim();
      if (!/^\d+$/.test(text) || Number(text) <= 0) {
        throw new UseCaseError("MANAGER_BID_INVALID");
      }
      const outcome = await ports.bids.place(input.leagueId, input.athleteId, Number(text));
      if (outcome !== "placed") throw new UseCaseError(refused[outcome]);
    },
  };
}

/** Withdraws a bid, which frees its credits. */
export function withdrawManagerBid(ports: { bids: ManagerBidRepository }) {
  return {
    async execute(input: { leagueId: string; athleteId: string }): Promise<void> {
      const outcome = await ports.bids.withdraw(input.leagueId, input.athleteId);
      if (outcome !== "withdrawn") throw new UseCaseError(refused[outcome]);
    },
  };
}
