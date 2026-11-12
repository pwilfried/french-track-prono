import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import type { RoundBid } from "@/domain/manager-reveal";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository, MyManagerBids } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";
import {
  getManagerRevealRounds,
  getManagerRoundReveal,
  markManagerRoundRevealed,
  type ManagerRevealRepository,
} from "./manager-reveal";

const athlete = (athleteId: string, name: string): CatalogueAthlete => ({
  athleteId,
  slug: athleteId,
  name,
  countryCode: "FRA",
  sex: "F",
  discipline: "100 m",
  family: "sprint",
  pb: null,
  sb: null,
  price: 10,
  available: true,
});

const catalogue: ManagerCatalogueRepository = {
  list: async (leagueId) =>
    leagueId === "l1"
      ? [athlete("a1", "Léa Fictive"), athlete("a2", "Inès Démo"), athlete("a3", "Zoé Exemple")]
      : "not_member",
};

const participant = (userId: string, pseudo: string) => ({
  userId,
  pseudo,
  bib: { number: 7, color: "blue" },
});

const managerLeagues = {
  find: async (id: string) =>
    id === "l1"
      ? ({
          id,
          participants: [participant("u1", "Flèche"), participant("u2", "Comète")],
        } as unknown as ManagerLeagueFile)
      : null,
} satisfies Pick<ManagerLeagueRepository, "find">;

/** The first player won a1 for 30 in round 1. */
const mine: MyManagerBids = {
  budget: 100,
  mercatoOpen: true,
  mercatoClosed: false,
  canClose: false,
  roundEndsAt: null,
  team: [{ athleteId: "a1", amount: 30, round: 1 }],
  bids: [],
};
const bids = (member: boolean): Pick<ManagerBidRepository, "mine"> => ({
  mine: async () => (member ? mine : "not_member"),
});

/** Round 1 of league l1 is closed: Flèche (u1) and Comète (u2) bid in it; round 2 is open. */
const round1: RoundBid[] = [
  { userId: "u1", athleteId: "a1", amount: 30, won: true },
  { userId: "u1", athleteId: "a2", amount: 15, won: false },
  { userId: "u2", athleteId: "a2", amount: 40, won: true },
  { userId: "u2", athleteId: "a3", amount: 10, won: true },
];

/** The reveals of one player; `seen` is the last round whose reveal they saw. */
function reveals(member: boolean, seen = 0) {
  const state = { seen };
  const repository: ManagerRevealRepository = {
    bidRounds: async () => (member ? [{ round: 1, seen: state.seen >= 1 }] : "not_member"),
    roundBids: async (_, round) => (member ? (round === 1 ? round1 : []) : "not_member"),
    markRevealed: async (_, round) => {
      if (!member) return "not_member";
      if (round !== 1) return "not_closed";
      state.seen = Math.max(state.seen, round);
      return "marked";
    },
  };
  return repository;
}

const reveal = (userId: string, round = 1, member = true) =>
  getManagerRoundReveal({
    reveals: reveals(member),
    bids: bids(member),
    catalogue,
    managerLeagues,
  }).execute({ leagueId: "l1", round, userId });

describe("getManagerRoundReveal", () => {
  it("shows the player their bids won or lost, then every bid of the round", async () => {
    // Given a closed round in which both participants bid
    // When the first player opens its reveal
    const shown = await reveal("u1");

    // Then their cards say what they won, and who got the athlete they lost, at what price
    expect(shown.cards).toEqual([
      expect.objectContaining({
        name: "Inès Démo",
        amount: 15,
        won: false,
        winner: { pseudo: "Comète", amount: 40 },
      }),
      expect.objectContaining({ name: "Léa Fictive", amount: 30, won: true, winner: null }),
    ]);
    expect(shown.tally).toEqual({ placed: 2, won: 1, athletes: 1, left: 70 });
    // And every athlete bid on lists its bids from the highest, the winning and own ones marked
    expect(
      shown.athletes.map((a) => [a.name, a.offers.map((o) => [o.pseudo, o.amount, o.won, o.mine])]),
    ).toEqual([
      [
        "Inès Démo",
        [
          ["Comète", 40, true, false],
          ["Flèche", 15, false, true],
        ],
      ],
      ["Léa Fictive", [["Flèche", 30, true, true]]],
      ["Zoé Exemple", [["Comète", 10, true, false]]],
    ]);
  });

  it("shows a player who did not bid no card, but every bid of the round", async () => {
    const shown = await reveal("u3");

    expect(shown.cards).toEqual([]);
    expect(shown.tally.placed).toBe(0);
    expect(shown.athletes).toHaveLength(3);
  });

  it("has no reveal for a round still open", async () => {
    await expect(reveal("u1", 2)).rejects.toEqual(new UseCaseError("ROUND_NOT_FOUND"));
  });

  it("refuses a player who is not in the league", async () => {
    await expect(reveal("u3", 1, false)).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});

describe("the reveal shows once per round and per player", () => {
  it("offers the reveal of a closed round until the player has seen it", async () => {
    // Given a closed round with bids the player has not seen
    const mineToSee = reveals(true);
    const rounds = () => getManagerRevealRounds({ reveals: mineToSee }).execute({ leagueId: "l1" });
    expect(await rounds()).toEqual({ rounds: [1], toReveal: 1 });

    // When the player sees it
    await markManagerRoundRevealed({ reveals: mineToSee }).execute({ leagueId: "l1", round: 1 });

    // Then it does not show again, and its summary stays readable
    expect(await rounds()).toEqual({ rounds: [1], toReveal: null });
  });

  it("offers nothing to an outsider and refuses to mark an open round", async () => {
    const outsider = reveals(false);
    expect(await getManagerRevealRounds({ reveals: outsider }).execute({ leagueId: "l1" })).toEqual(
      { rounds: [], toReveal: null },
    );
    await expect(
      markManagerRoundRevealed({ reveals: reveals(true) }).execute({ leagueId: "l1", round: 2 }),
    ).rejects.toEqual(new UseCaseError("ROUND_NOT_FOUND"));
    await expect(
      markManagerRoundRevealed({ reveals: outsider }).execute({ leagueId: "l1", round: 1 }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
