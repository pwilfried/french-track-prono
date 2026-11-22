import { describe, expect, it } from "vitest";

import type { CatalogueAthlete } from "@/domain/manager-catalogue";
import type { MatchSheet } from "@/domain/manager-lineup";
import type { ManagerRules } from "@/domain/manager-rules";

import { UseCaseError } from "./errors";
import type { ManagerBidRepository, MyManagerBids } from "./manager-bids";
import type { ManagerCatalogueRepository } from "./manager-catalogue";
import type { ManagerLeagueFile, ManagerLeagueRepository } from "./manager-leagues";
import {
  getFirstLineupGuide,
  getMyLineup,
  listMyLineups,
  saveMyLineup,
  type LineupCompetition,
  type LineupSaveOutcome,
  type ManagerLineupRepository,
  type SavedSheet,
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

// One place per family.
const rules = {
  minTeamSize: 3,
  quotas: [],
  lineup: { max: 4, perFamily: 1, bench: 0 },
  tablesDivisor: 10,
} as unknown as ManagerRules;

const leagues = {
  find: async (id: string) =>
    ({ id, name: "Ligue fictive", rules }) as unknown as ManagerLeagueFile,
} as unknown as ManagerLeagueRepository;

const bids: ManagerBidRepository = {
  mine: async (): Promise<MyManagerBids> => ({
    budget: 100,
    mercatoOpen: false,
    mercatoClosed: true,
    canClose: false,
    roundEndsAt: null,
    round: null,
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
  finishRound: async () => "finished",
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
  read: SavedSheet = { disciplines: {}, sheet: null },
): ManagerLineupRepository & { saved: MatchSheet[] } => {
  const saved: MatchSheet[] = [];
  return {
    saved,
    mine: async () => competitions,
    sheet: async () => (competitions === "not_member" ? "not_member" : read),
    save: async (_league, _competition, sheet) => {
      saved.push(sheet);
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

    // Then the stadium has one empty place per family, the throws one beyond the team's reach
    expect(view).toMatchObject({
      competitionId: "c1",
      status: "todo",
      mercatoClosed: true,
      places: ["sprint", "distance", "jumps", "throws"],
      fillable: [true, true, false, false],
      placed: [null, null, null, null],
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

    // Then each sits on the place of their family; validated, then locked
    expect(before).toMatchObject({ status: "validated", placed: ["a1", "a2", null, null] });
    expect(after.status).toBe("locked");
  });

  it("brings back the saved bench, substitutes, thresholds and the disciplines each athlete may count in", async () => {
    // Given a sheet saved with the sprinter in the 200 m, the runner on the bench as her
    // designated substitute below 23"00, and a bench of two
    const sprint = { name: "100 m", family: "sprint" as const, unit: "time" as const };
    const twoHundred = { ...sprint, name: "200 m" };
    const read: SavedSheet = {
      disciplines: { a1: [sprint, twoHundred] },
      sheet: {
        starters: [{ athleteId: "a1", discipline: "200 m", substituteId: "a2", threshold: 23 }],
        bench: [{ athleteId: "a2" }],
      },
    };
    const ports = {
      managerLeagues: leagues,
      bids,
      catalogue,
      lineups: lineups([meeting({ lineup: ["a1"] })], "saved", read),
    };

    // When the player opens the lineup
    const view = await getMyLineup(ports).execute({ leagueId: "l1", slug: "meeting", now: BEFORE });

    // Then the stadium, the bench and the settings of the place are those saved
    expect(view).toMatchObject({
      leagueName: "Ligue fictive",
      benchSize: 0,
      divisor: 10,
      placed: ["a1", null, null, null],
      plan: {
        bench: ["a2"],
        settings: { a1: { discipline: "200 m", substituteId: "a2", threshold: 23 } },
      },
    });
    expect(view.athletes.find((a) => a.athleteId === "a1")!.disciplines).toEqual([
      sprint,
      twoHundred,
    ]);
    // An athlete the saved sheet says nothing of has no discipline to choose from
    expect(view.athletes.find((a) => a.athleteId === "a3")!.disciplines).toEqual([]);
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
  it("validates the match sheet the player chose", async () => {
    const repo = lineups([meeting()]);
    const sheet: MatchSheet = {
      starters: [{ athleteId: "a1", discipline: "100 m", substituteId: "a3", threshold: 10.5 }],
      bench: [{ athleteId: "a3" }],
    };
    await saveMyLineup({ lineups: repo }).execute({ leagueId: "l1", competitionId: "c1", sheet });
    expect(repo.saved).toEqual([sheet]);
  });

  it.each([
    ["locked", "LINEUP_LOCKED"],
    ["invalid", "LINEUP_INVALID"],
    ["mercato_open", "MERCATO_NOT_OVER"],
    ["not_eligible", "COMPETITION_NOT_FOUND"],
    ["not_member", "LEAGUE_NOT_FOUND"],
    ["bench_full", "LINEUP_BENCH_FULL"],
    ["discipline_not_entered", "LINEUP_DISCIPLINE_NOT_ENTERED"],
    ["substitute_not_on_bench", "LINEUP_SUBSTITUTE_NOT_ON_BENCH"],
    ["substitute_other_family", "LINEUP_SUBSTITUTE_OTHER_FAMILY"],
    ["substitute_twice", "LINEUP_SUBSTITUTE_TWICE"],
    ["threshold_without_substitute", "LINEUP_THRESHOLD_WITHOUT_SUBSTITUTE"],
    ["implausible_threshold", "LINEUP_THRESHOLD_IMPLAUSIBLE"],
  ] as const)("refuses a lineup the database answers %s to", async (outcome, code) => {
    await expect(
      saveMyLineup({ lineups: lineups([meeting()], outcome) }).execute({
        leagueId: "l1",
        competitionId: "c1",
        sheet: { starters: [{ athleteId: "a1" }], bench: [] },
      }),
    ).rejects.toEqual(new UseCaseError(code));
  });
});

describe("getFirstLineupGuide", () => {
  const ports = (competitions: LineupCompetition[], read?: SavedSheet) => ({
    managerLeagues: leagues,
    bids,
    catalogue,
    lineups: lineups(competitions, "saved", read),
  });

  it("guides a player who never validated a lineup, on the next competition", async () => {
    // Given a team of three and no lineup yet in the league
    const guide = await getFirstLineupGuide(ports([meeting()])).execute({
      leagueId: "l1",
      now: BEFORE,
    });

    // Then the guide points at the starters step of that competition
    expect(guide).toMatchObject({ slug: "meeting", current: "starters" });
    expect(guide?.done).toEqual({ starters: false, bench: true, tactical: false, validate: false });
  });

  it("is gone once any lineup of the league was validated", async () => {
    const guide = await getFirstLineupGuide(
      ports([meeting({ slug: "done", lineup: ["a1"] }), meeting({ slug: "next" })]),
    ).execute({ leagueId: "l1", now: BEFORE });
    expect(guide).toBeNull();
  });

  it("has nothing to show when every competition is locked", async () => {
    const guide = await getFirstLineupGuide(ports([meeting()])).execute({
      leagueId: "l1",
      now: AFTER,
    });
    expect(guide).toBeNull();
  });

  it("refuses a player who is not in the league", async () => {
    await expect(
      getFirstLineupGuide({ ...ports([]), lineups: lineups("not_member") }).execute({
        leagueId: "l1",
        now: BEFORE,
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
