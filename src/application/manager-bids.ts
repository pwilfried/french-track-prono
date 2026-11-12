import { availableCredits, reservedCredits, type ManagerBid } from "@/domain/manager-bid";

import { UseCaseError, type ErrorCode } from "./errors";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository } from "./manager-leagues";

/** An athlete the player won at the close of a round (#423), for the amount of their bid. */
export type WonAthlete = { athleteId: string; amount: number; round: number };

/**
 * The player's own bids in a league, the athletes they won, the budget of the league, whether bids
 * are open and when the open round ends (null before the mercato opens).
 */
export type MyManagerBids = {
  budget: number;
  mercatoOpen: boolean;
  roundEndsAt: string | null;
  team: WonAthlete[];
  bids: ManagerBid[];
};

export type BidOutcome =
  | "placed"
  | "not_member"
  | "mercato_closed"
  | "round_closing"
  | "not_in_catalogue"
  | "taken"
  | "below_price"
  | "over_budget";

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
  ): Promise<"withdrawn" | "not_member" | "mercato_closed" | "round_closing">;
}

type Named = { name: string; price: number };
export type MyBidLine = ManagerBid & Named;
export type MyAthleteLine = WonAthlete & { name: string };

export type MyBidsView = {
  budget: number;
  /** What the athletes won cost. */
  spent: number;
  reserved: number;
  available: number;
  mercatoOpen: boolean;
  roundEndsAt: string | null;
  /** By athlete name. */
  team: MyAthleteLine[];
  /** By athlete name. */
  bids: MyBidLine[];
};

const refused: Record<Exclude<BidOutcome, "placed">, ErrorCode> = {
  not_member: "LEAGUE_NOT_FOUND",
  mercato_closed: "MERCATO_NOT_OPEN",
  round_closing: "ROUND_CLOSING",
  not_in_catalogue: "ATHLETE_NOT_IN_CATALOGUE",
  taken: "ATHLETE_TAKEN",
  below_price: "MANAGER_BID_BELOW_PRICE",
  over_budget: "MANAGER_BID_OVER_BUDGET",
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/**
 * The player's bids in a league, the athletes they won, the credits spent, reserved and left
 * (#422, #423).
 */
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
      const named = (athleteId: string): Named => {
        const athlete = byId.get(athleteId);
        return { name: athlete?.name ?? "", price: athlete?.price ?? 0 };
      };
      const spent = mine.team.reduce((sum, a) => sum + a.amount, 0);
      return {
        budget: mine.budget,
        spent,
        reserved: reservedCredits(mine.bids),
        available: availableCredits(mine.budget - spent, mine.bids),
        mercatoOpen: mine.mercatoOpen,
        roundEndsAt: mine.roundEndsAt,
        team: mine.team.map((a) => ({ ...a, name: named(a.athleteId).name })).sort(byName),
        bids: mine.bids.map((b) => ({ ...b, ...named(b.athleteId) })).sort(byName),
      };
    },
  };
}

/** Places or changes a secret bid; the amount comes from the form, in whole credits. */
/** Whether one of the player's Manager leagues takes bids now: the home says so (#526). */
export function isMercatoOpenForMe(ports: {
  managerLeagues: Pick<ManagerLeagueRepository, "listMine">;
  bids: ManagerBidRepository;
}) {
  return {
    async execute(): Promise<boolean> {
      const leagues = await ports.managerLeagues.listMine();
      const states = await Promise.all(leagues.map((league) => ports.bids.mine(league.id)));
      return states.some((state) => state !== "not_member" && state.mercatoOpen);
    },
  };
}

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
