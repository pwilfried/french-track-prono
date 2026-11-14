import { describe, expect, it } from "vitest";

import { MAX_BID_DIGITS } from "@/domain/manager-bid";
import type { CatalogueAthlete } from "@/domain/manager-catalogue";

import { UseCaseError } from "./errors";
import {
  closeManagerMercato,
  getMyManagerBids,
  isMercatoOpenForMe,
  placeManagerBid,
  withdrawManagerBid,
  type BidOutcome,
  type CloseOutcome,
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
    close: async () => "closed",
  };
  return { repository, placed, withdrawn };
}

const open: MyManagerBids = {
  budget: 100,
  mercatoOpen: true,
  mercatoClosed: false,
  canClose: false,
  roundEndsAt: "2027-01-03T10:00:00.000Z",
  team: [],
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

    expect(view).toMatchObject({
      budget: 100,
      spent: 0,
      reserved: 55,
      available: 45,
      mercatoOpen: true,
      roundEndsAt: "2027-01-03T10:00:00.000Z",
    });
    expect(view.bids.map((b) => [b.name, b.amount, b.price])).toEqual([
      ["Anna Fictive", 25, 15],
      ["Zoé Fictive", 30, 10],
    ]);
  });

  it("shows the athletes won at the close of a round and the budget left", async () => {
    // Given a participant who won Anna for 40 in round 1 and bids 30 on Zoé in round 2
    const { repository } = bids({
      ...open,
      team: [{ athleteId: "a2", amount: 40, round: 1 }],
      bids: [{ athleteId: "a1", amount: 30, bidAt: "2027-01-04T10:00:00.000Z" }],
    });

    // When they open the catalogue
    const view = await getMyManagerBids({ bids: repository, catalogue }).execute({
      leagueId: "l1",
    });

    // Then the 40 is spent, the 30 reserved, and 30 credits are left
    expect(view).toMatchObject({ budget: 100, spent: 40, reserved: 30, available: 30 });
    expect(view.team).toEqual([{ athleteId: "a2", name: "Anna Fictive", amount: 40, round: 1 }]);
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

  it("refuses an amount with more digits than a bid can hold, without asking the database", async () => {
    const { repository, placed } = bids(open);

    for (const amount of ["1".repeat(MAX_BID_DIGITS + 1), "9".repeat(300)]) {
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
    ["taken", "ATHLETE_TAKEN"],
    ["round_closing", "ROUND_CLOSING"],
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

describe("closeManagerMercato", () => {
  function closing(answer: CloseOutcome) {
    const asked: string[] = [];
    const repository: ManagerBidRepository = {
      ...bids(open).repository,
      close: async (leagueId) => {
        asked.push(leagueId);
        return answer;
      },
    };
    return { repository, asked };
  }

  it("lets the last participant who can still recruit close the mercato", async () => {
    // Given the only participant of the league who still has credits for a free athlete
    const { repository, asked } = closing("closed");

    // When they close the mercato
    await closeManagerMercato({ bids: repository }).execute({ leagueId: "l1" });

    // Then the league is asked to close it
    expect(asked).toEqual(["l1"]);
  });

  it.each([
    ["not_last_bidder", "MERCATO_NOT_LAST_BIDDER"],
    ["mercato_closed", "MERCATO_NOT_OPEN"],
    ["not_member", "LEAGUE_NOT_FOUND"],
  ] as const)("turns a refused close (%s) into %s", async (answer, code) => {
    const { repository } = closing(answer);

    await expect(
      closeManagerMercato({ bids: repository }).execute({ leagueId: "l1" }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});

describe("isMercatoOpenForMe", () => {
  const leagues = (ids: string[]) => ({
    listMine: async () =>
      ids.map((id) => ({
        id,
        name: id,
        isPublic: false,
        inviteCode: "CODE",
        ownerId: "u1",
        memberCount: 2,
        target: 4,
      })),
  });
  const byLeague = (states: Record<string, MyManagerBids | "not_member">) =>
    ({
      ...bids(open).repository,
      mine: async (leagueId: string) => states[leagueId] ?? "not_member",
    }) satisfies ManagerBidRepository;

  it("says the mercato is open when one of the player's Manager leagues takes bids", async () => {
    const answer = await isMercatoOpenForMe({
      managerLeagues: leagues(["closed", "open"]),
      bids: byLeague({ closed: { ...open, mercatoOpen: false }, open }),
    }).execute();
    expect(answer).toBe(true);
  });

  it("says it is closed without a Manager league, or when no league takes bids", async () => {
    const closed = byLeague({ l1: { ...open, mercatoOpen: false }, l2: "not_member" });
    expect(await isMercatoOpenForMe({ managerLeagues: leagues([]), bids: closed }).execute()).toBe(
      false,
    );
    expect(
      await isMercatoOpenForMe({ managerLeagues: leagues(["l1", "l2"]), bids: closed }).execute(),
    ).toBe(false);
  });
});
