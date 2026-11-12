import type { Bib } from "@/domain/bib";
import type { ManagerSex } from "@/domain/manager-rules";
import {
  bidsByAthlete,
  myRoundTally,
  roundToReveal,
  type BidRound,
  type RoundBid,
} from "@/domain/manager-reveal";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueRepository } from "./manager-leagues";

/**
 * Port: the bids of the closed rounds of a league, which every participant reads once the round is
 * closed (#604), and the reveals the player saw. Real adapter = Supabase (row level security keeps
 * the open round secret); fake = in memory.
 */
export interface ManagerRevealRepository {
  /** The closed rounds in which somebody bid, in order, and whether the player saw their reveal. */
  bidRounds(leagueId: string): Promise<BidRound[] | "not_member">;
  /** Every bid of a closed round, of every participant; none for a round still open. */
  roundBids(leagueId: string, round: number): Promise<RoundBid[] | "not_member">;
  /** The player saw the reveal of a closed round: it does not show again. */
  markRevealed(leagueId: string, round: number): Promise<"marked" | "not_member" | "not_closed">;
}

type Athlete = { athleteId: string; name: string; discipline: string; sex: ManagerSex };

/** One of the player's bids, face down until revealed: won, or who got the athlete and for how much. */
export type RevealCardData = Athlete & {
  amount: number;
  won: boolean;
  /** Who got the athlete when the player lost it. */
  winner: { pseudo: string; amount: number } | null;
};

export type RevealOffer = {
  userId: string;
  pseudo: string;
  bib: Bib | null;
  amount: number;
  won: boolean;
  mine: boolean;
};

/** An athlete bid on in the round, with every bid on them from the highest. */
export type RevealAthlete = Athlete & { offers: RevealOffer[] };

/** The reveal of a closed round (#604): the player's cards, their tally, then every bid of the round. */
export type ManagerRoundReveal = {
  round: number;
  /** The player's bids of the round, the highest first. */
  cards: RevealCardData[];
  tally: { placed: number; won: number; athletes: number; left: number };
  /** Every athlete bid on in the round, by their best bid. */
  athletes: RevealAthlete[];
};

/**
 * The closed rounds of a league with bids, whose summary stays readable from the mercato, and the
 * one whose reveal the player has not seen yet, or null (#604).
 */
export function getManagerRevealRounds(ports: { reveals: ManagerRevealRepository }) {
  return {
    async execute(input: {
      leagueId: string;
    }): Promise<{ rounds: number[]; toReveal: number | null }> {
      const rounds = await ports.reveals.bidRounds(input.leagueId);
      if (rounds === "not_member") return { rounds: [], toReveal: null };
      return { rounds: rounds.map((r) => r.round), toReveal: roundToReveal(rounds) };
    },
  };
}

/**
 * The reveal of a closed round of a league (#604): who bid on which athlete, how much, and who got
 * them. A round still open, or in which nobody bid, has no reveal (ROUND_NOT_FOUND).
 */
export function getManagerRoundReveal(ports: {
  reveals: ManagerRevealRepository;
  bids: Pick<ManagerBidRepository, "mine">;
  catalogue: ManagerCatalogueRepository;
  managerLeagues: Pick<ManagerLeagueRepository, "find">;
}) {
  return {
    async execute(input: {
      leagueId: string;
      round: number;
      userId: string;
    }): Promise<ManagerRoundReveal> {
      const [bids, league, mine, catalogue] = await Promise.all([
        ports.reveals.roundBids(input.leagueId, input.round),
        ports.managerLeagues.find(input.leagueId),
        ports.bids.mine(input.leagueId),
        ports.catalogue.list(input.leagueId),
      ]);
      if (bids === "not_member" || !league || mine === "not_member" || catalogue === "not_member") {
        throw new UseCaseError("LEAGUE_NOT_FOUND");
      }
      if (bids.length === 0) throw new UseCaseError("ROUND_NOT_FOUND");

      const athletes = new Map(catalogue.map((a) => [a.athleteId, a]));
      const athlete = (athleteId: string): Athlete => {
        const a = athletes.get(athleteId);
        return {
          athleteId,
          name: a?.name ?? "",
          discipline: a?.discipline ?? "",
          sex: a?.sex ?? "F",
        };
      };
      const players = new Map(league.participants.map((p) => [p.userId, p]));
      const groups = bidsByAthlete(bids).map((group) => ({
        ...athlete(group.athleteId),
        offers: group.bids.map((b) => ({
          userId: b.userId,
          pseudo: players.get(b.userId)?.pseudo ?? "",
          bib: players.get(b.userId)?.bib ?? null,
          amount: b.amount,
          won: b.won,
          mine: b.userId === input.userId,
        })),
      }));
      const cards = groups.flatMap((group) => {
        const own = group.offers.find((o) => o.mine);
        if (!own) return [];
        const winner = group.offers.find((o) => o.won);
        return [
          {
            athleteId: group.athleteId,
            name: group.name,
            discipline: group.discipline,
            sex: group.sex,
            amount: own.amount,
            won: own.won,
            winner: !own.won && winner ? { pseudo: winner.pseudo, amount: winner.amount } : null,
          },
        ];
      });
      const spent = mine.team.reduce((sum, a) => sum + a.amount, 0);
      return {
        round: input.round,
        cards,
        tally: {
          ...myRoundTally(bids, input.userId),
          athletes: mine.team.length,
          left: mine.budget - spent,
        },
        athletes: groups,
      };
    },
  };
}

/** The player saw the reveal of a round: it does not show again (#604). */
export function markManagerRoundRevealed(ports: { reveals: ManagerRevealRepository }) {
  return {
    async execute(input: { leagueId: string; round: number }): Promise<void> {
      const outcome = await ports.reveals.markRevealed(input.leagueId, input.round);
      if (outcome === "not_member") throw new UseCaseError("LEAGUE_NOT_FOUND");
      if (outcome === "not_closed") throw new UseCaseError("ROUND_NOT_FOUND");
    },
  };
}
