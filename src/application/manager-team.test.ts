import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import type { ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository, MyManagerBids } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";
import { getMyManagerTeam } from "./manager-team";

const athlete = (
  athleteId: string,
  name: string,
  family: CatalogueAthlete["family"],
  sex: CatalogueAthlete["sex"] = "F",
): CatalogueAthlete => ({
  athleteId,
  slug: athleteId,
  name,
  countryCode: "FRA",
  sex,
  discipline: family === "throws" ? "Poids" : "100 m",
  family,
  pb: null,
  sb: null,
  price: 5,
  available: false,
});

const catalogue: ManagerCatalogueRepository = {
  list: async () => [
    athlete("a1", "Zoé Fictive", "sprint"),
    athlete("a2", "Anna Fictive", "sprint"),
    athlete("a3", "Hugo Démo", "throws", "M"),
  ],
};

const rules = {
  budget: 100,
  teamSize: 3,
  quotas: [
    { sex: "F", family: "sprint", min: 1, max: 2 },
    { sex: "M", family: "throws", min: 1, max: 1 },
  ],
} as ManagerRules;

const leagues = (found: boolean): ManagerLeagueRepository =>
  ({
    find: async (id: string) => (found ? ({ id, rules } as unknown as ManagerLeagueFile) : null),
  }) as unknown as ManagerLeagueRepository;

const bids = (mine: MyManagerBids | "not_member"): ManagerBidRepository => ({
  mine: async () => mine,
  place: async () => "placed",
  withdraw: async () => "withdrawn",
  close: async () => "closed",
});

const closed = (team: MyManagerBids["team"]): MyManagerBids => ({
  budget: 100,
  mercatoOpen: false,
  mercatoClosed: true,
  canClose: false,
  roundEndsAt: null,
  team,
  bids: [],
});

describe("getMyManagerTeam", () => {
  it("shows the player's athletes by name, the price paid and the credits left", async () => {
    // Given a closed mercato in which the player won three athletes
    const mine = closed([
      { athleteId: "a1", amount: 30, round: 1 },
      { athleteId: "a3", amount: 12, round: 2 },
      { athleteId: "a2", amount: 20, round: 1 },
    ]);

    // When they open their team
    const team = await getMyManagerTeam({
      managerLeagues: leagues(true),
      bids: bids(mine),
      catalogue,
    }).execute({ leagueId: "l1" });

    // Then they see every athlete, what they paid, and a team that misses nothing
    expect(team).toMatchObject({
      mercatoClosed: true,
      teamSize: 3,
      budget: 100,
      spent: 62,
      left: 38,
      unmet: [],
    });
    expect(team.athletes.map((a) => [a.name, a.discipline, a.paid])).toEqual([
      ["Anna Fictive", "100 m", 20],
      ["Hugo Démo", "Poids", 12],
      ["Zoé Fictive", "100 m", 30],
    ]);
  });

  it("says which quota an incomplete team could not fill", async () => {
    const mine = closed([
      { athleteId: "a1", amount: 30, round: 1 },
      { athleteId: "a2", amount: 20, round: 1 },
    ]);

    const team = await getMyManagerTeam({
      managerLeagues: leagues(true),
      bids: bids(mine),
      catalogue,
    }).execute({ leagueId: "l1" });

    expect(team.athletes).toHaveLength(2);
    expect(team.unmet).toEqual([{ sex: "M", family: "throws" }]);
  });

  it("refuses a league the player is not in", async () => {
    await expect(
      getMyManagerTeam({
        managerLeagues: leagues(false),
        bids: bids("not_member"),
        catalogue,
      }).execute({ leagueId: "l1" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
