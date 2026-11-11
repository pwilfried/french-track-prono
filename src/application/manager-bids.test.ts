import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";
import {
  getMyManagerBids,
  placeManagerBid,
  withdrawManagerBid,
  type BidOutcome,
  type ManagerBidRepository,
  type MyManagerBids,
} from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";

const athlete = (athleteId: string, name: string, price: number): CatalogueAthlete => ({
  athleteId,
  slug: athleteId,
  name,
  countryCode: "FRA",
  sex: "F",
  discipline: "100 m",
  family: "sprint",
  pb: null,
  sb: null,
  price,
  available: true,
});

const catalogue: ManagerCatalogueRepository = {
  list: async () => [athlete("a1", "Zoé Fictive", 10), athlete("a2", "Anna Fictive", 15)],
};

function bids(mine: MyManagerBids | "not_member", answer: BidOutcome = "placed") {
  const placed: [string, string, number][] = [];
  const withdrawn: [string, string][] = [];
  const repository: ManagerBidRepository = {
    mine: async () => mine,
    place: async (leagueId, athleteId, amount) => {
      placed.push([leagueId, athleteId, amount]);
      return answer;
    },
    withdraw: async (leagueId, athleteId) => {
      withdrawn.push([leagueId, athleteId]);
      return answer === "placed"
        ? "withdrawn"
        : answer === "not_member"
          ? answer
          : "mercato_closed";
    },
  };
  return { repository, placed, withdrawn };
}

const open: MyManagerBids = {
  budget: 100,
  mercatoOpen: true,
  bids: [
    { athleteId: "a1", amount: 30, bidAt: "2027-01-02T10:00:00.000Z" },
    { athleteId: "a2", amount: 25, bidAt: "2027-01-01T10:00:00.000Z" },
  ],
};

describe("getMyManagerBids", () => {
  it("shows a participant their own bids by name, the credits reserved and those left", async () => {
    const { repository } = bids(open);

    const view = await getMyManagerBids({ bids: repository, catalogue }).execute({
      leagueId: "l1",
    });

    expect(view).toMatchObject({ budget: 100, reserved: 55, available: 45, mercatoOpen: true });
    expect(view.bids.map((b) => [b.name, b.amount, b.price])).toEqual([
      ["Anna Fictive", 25, 15],
      ["Zoé Fictive", 30, 10],
    ]);
  });

  it("answers LEAGUE_NOT_FOUND to a player who is not in the league", async () => {
    const { repository } = bids("not_member");

    await expect(
      getMyManagerBids({ bids: repository, catalogue }).execute({ leagueId: "l1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});

describe("placeManagerBid", () => {
  it("places a bid, or changes it, with its amount in whole credits", async () => {
    const { repository, placed } = bids(open);

    await placeManagerBid({ bids: repository }).execute({
      leagueId: "l1",
      athleteId: "a1",
      amount: "35",
    });

    expect(placed).toEqual([["l1", "a1", 35]]);
  });

  it("refuses an amount that is not a whole number of credits, without asking the database", async () => {
    const { repository, placed } = bids(open);

    for (const amount of ["", "12.5", "-3", "douze"]) {
      await expect(
        placeManagerBid({ bids: repository }).execute({ leagueId: "l1", athleteId: "a1", amount }),
      ).rejects.toEqual(new UseCaseError("MANAGER_BID_INVALID"));
    }
    expect(placed).toEqual([]);
  });

  it.each([
    ["below_price", "MANAGER_BID_BELOW_PRICE"],
    ["over_budget", "MANAGER_BID_OVER_BUDGET"],
    ["mercato_closed", "MERCATO_NOT_OPEN"],
    ["not_in_catalogue", "ATHLETE_NOT_IN_CATALOGUE"],
    ["not_member", "LEAGUE_NOT_FOUND"],
  ] as const)("turns a refused bid (%s) into %s", async (answer, code) => {
    const { repository } = bids(open, answer);

    await expect(
      placeManagerBid({ bids: repository }).execute({
        leagueId: "l1",
        athleteId: "a1",
        amount: "40",
      }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});

describe("withdrawManagerBid", () => {
  it("withdraws a bid while the mercato is open", async () => {
    const { repository, withdrawn } = bids(open);

    await withdrawManagerBid({ bids: repository }).execute({ leagueId: "l1", athleteId: "a1" });

    expect(withdrawn).toEqual([["l1", "a1"]]);
  });

  it("answers MERCATO_NOT_OPEN once the mercato is not open", async () => {
    const { repository } = bids(open, "mercato_closed");

    await expect(
      withdrawManagerBid({ bids: repository }).execute({ leagueId: "l1", athleteId: "a1" }),
    ).rejects.toEqual(new UseCaseError("MERCATO_NOT_OPEN"));
  });
});
