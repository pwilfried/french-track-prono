import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import type { ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository, MyManagerBids } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";
import {
  getMyLineup,
  listMyLineups,
  saveMyLineup,
  type LineupCompetition,
  type LineupSaveOutcome,
  type ManagerLineupRepository,
} from "./manager-lineup";

const athlete = (
  athleteId: string,
  name: string,
  family: CatalogueAthlete["family"],
): CatalogueAthlete => ({
  athleteId,
  slug: athleteId,
  name,
  countryCode: "FRA",
  sex: "F",
  discipline: family === "throws" ? "Poids" : family === "middle" ? "800 m" : "100 m",
  family,
  pb: null,
  sb: null,
  price: 5,
  available: false,
});

const catalogue: ManagerCatalogueRepository = {
  list: async () => [
    athlete("a1", "Zoé Fictive", "sprint"),
    athlete("a2", "Anna Fictive", "middle"),
    athlete("a3", "Inès Démo", "throws"),
  ],
};

// One sprint place, one free place.
const rules = {
  teamSize: 3,
  quotas: [],
  lineup: { max: 2, minPerFamily: { sprint: 1 } },
} as unknown as ManagerRules;

const leagues = {
  find: async (id: string) => ({ id, rules }) as unknown as ManagerLeagueFile,
} as unknown as ManagerLeagueRepository;

const bids: ManagerBidRepository = {
  mine: async (): Promise<MyManagerBids> => ({
    budget: 100,
    mercatoOpen: false,
    mercatoClosed: true,
    canClose: false,
    roundEndsAt: null,
    team: [
      { athleteId: "a1", amount: 30, round: 1 },
      { athleteId: "a2", amount: 20, round: 1 },
      { athleteId: "a3", amount: 10, round: 1 },
    ],
    bids: [],
  }),
  place: async () => "placed",
  withdraw: async () => "withdrawn",
  close: async () => "closed",
};

const meeting = (over: Partial<LineupCompetition> = {}): LineupCompetition => ({
  competitionId: "c1",
  slug: "meeting",
  name: "Meeting fictif",
  startsOn: "2027-06-01",
  lockAt: "2027-06-01T16:00:00.000Z",
  entered: ["a1", "a2"],
  lineup: null,
  ...over,
});

const lineups = (
  competitions: LineupCompetition[] | "not_member",
  save: LineupSaveOutcome = "saved",
): ManagerLineupRepository & { saved: string[][] } => {
  const saved: string[][] = [];
  return {
    saved,
    mine: async () => competitions,
    save: async (_league, _competition, athleteIds) => {
      saved.push(athleteIds);
      return save;
    },
  };
};

const BEFORE = "2027-06-01T10:00:00.000Z";
const AFTER = "2027-06-01T16:00:00.000Z";

describe("getMyLineup", () => {
  it("shows the stadium with its places, the absent athletes and which places can be filled", async () => {
    // Given a team of three, the thrower not entered in the meeting, no lineup yet
    const ports = { managerLeagues: leagues, bids, catalogue, lineups: lineups([meeting()]) };

    // When the player opens the lineup of the meeting
    const view = await getMyLineup(ports).execute({ leagueId: "l1", slug: "meeting", now: BEFORE });

    // Then the stadium has a sprint place and a free one, both empty, both fillable
    expect(view).toMatchObject({
      competitionId: "c1",
      status: "todo",
      mercatoClosed: true,
      places: ["sprint", "free"],
      fillable: [true, true],
      placed: [null, null],
    });
    expect(view.athletes.map((a) => [a.athleteId, a.entered, a.paid])).toEqual([
      ["a2", true, 20],
      ["a3", false, 10],
      ["a1", true, 30],
    ]);
  });

  it("seats a validated lineup and locks it at the lock time", async () => {
    // Given a lineup validated with the middle-distance runner and the sprinter
    const ports = {
      managerLeagues: leagues,
      bids,
      catalogue,
      lineups: lineups([meeting({ lineup: ["a2", "a1"] })]),
    };

    // When the player opens it before, then after the lock
    const before = await getMyLineup(ports).execute({
      leagueId: "l1",
      slug: "meeting",
      now: BEFORE,
    });
    const after = await getMyLineup(ports).execute({ leagueId: "l1", slug: "meeting", now: AFTER });

    // Then the sprinter sits on the sprint place; validated, then locked
    expect(before).toMatchObject({ status: "validated", placed: ["a1", "a2"] });
    expect(after.status).toBe("locked");
  });

  it("finds no competition the league does not play", async () => {
    const ports = { managerLeagues: leagues, bids, catalogue, lineups: lineups([meeting()]) };
    await expect(
      getMyLineup(ports).execute({ leagueId: "l1", slug: "other", now: BEFORE }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_NOT_FOUND"));
  });
});

describe("listMyLineups", () => {
  it("lists the eligible competitions with where the lineup stands", async () => {
    const ports = {
      lineups: lineups([
        meeting({ slug: "past", lockAt: "2027-05-01T16:00:00.000Z" }),
        meeting({ slug: "done", lineup: ["a1", "a2"] }),
        meeting({ slug: "todo" }),
      ]),
    };
    const list = await listMyLineups(ports).execute({ leagueId: "l1", now: BEFORE });
    expect(list.map((c) => [c.slug, c.status])).toEqual([
      ["past", "locked"],
      ["done", "validated"],
      ["todo", "todo"],
    ]);
  });

  it("refuses a player who is not in the league", async () => {
    await expect(
      listMyLineups({ lineups: lineups("not_member") }).execute({ leagueId: "l1", now: BEFORE }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});

describe("saveMyLineup", () => {
  it("validates the lineup the player chose", async () => {
    const repo = lineups([meeting()]);
    await saveMyLineup({ lineups: repo }).execute({
      leagueId: "l1",
      competitionId: "c1",
      athleteIds: ["a1", "a2"],
    });
    expect(repo.saved).toEqual([["a1", "a2"]]);
  });

  it.each([
    ["locked", "LINEUP_LOCKED"],
    ["invalid", "LINEUP_INVALID"],
    ["mercato_open", "MERCATO_NOT_OVER"],
    ["not_eligible", "COMPETITION_NOT_FOUND"],
    ["not_member", "LEAGUE_NOT_FOUND"],
  ] as const)("refuses a lineup the database answers %s to", async (outcome, code) => {
    await expect(
      saveMyLineup({ lineups: lineups([meeting()], outcome) }).execute({
        leagueId: "l1",
        competitionId: "c1",
        athleteIds: ["a1"],
      }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});
