import { describe, expect, it } from "vitest";

import { UseCaseError } from "./errors";
import type { League, LeagueMember, LeagueRepository } from "./leagues";
import {
  listPredictionLeagues,
  savePredictionLeagues,
  type PredictionLeagueRepository,
} from "./prediction-leagues";
import type { RankingLine, RankingRepository } from "./rankings";

const league = (
  id: string,
  name: string,
  slugs: string[],
  extra: Partial<League> = {},
): League => ({
  id,
  name,
  inviteCode: "ABCDEF",
  ownerId: "me",
  memberCount: 2,
  competitionSlugs: slugs,
  isPublic: false,
  ...extra,
});
const member = (userId: string, countedEvents: string[]): LeagueMember => ({
  userId,
  pseudo: userId,
  bib: { number: 7, color: "blue" },
  countedEvents,
});
const leagues = (
  mine: League[],
  members: Record<string, LeagueMember[]> = {},
): LeagueRepository => ({
  create: async () => Promise.reject(new Error("unused")),
  addCompetition: async () => "added",
  addFamily: async () => "added",
  listPublic: async () => [],
  joinPublic: async () => ({ outcome: "unknown_code" }),
  inviteStatus: async () => "unknown",
  report: async () => "unknown",
  join: async () => ({ outcome: "unknown_code" }),
  listMine: async () => mine,
  members: async (id) => members[id] ?? [],
  leave: async () => "left",
  handOver: async () => "done",
});
const line = (userId: string, points: number, eventId: string): RankingLine => ({
  userId,
  pseudo: userId,
  bib: { number: 7, color: "blue" },
  points,
  reasons: [],
  eventId,
  eventStartsAt: "2026-11-23T19:00:00.000Z",
});
const ranking = (lines: RankingLine[], reads: string[] = []): RankingRepository => ({
  competitionLines: async (slug) => {
    reads.push(slug);
    return lines;
  },
});
const predictionLeagues = (
  counted: string[],
  outcome: "done" | "locked" | "refused" = "done",
  sets: string[][] = [],
): PredictionLeagueRepository => ({
  leaguesOf: async () => counted,
  set: async (_eventId, ids) => {
    sets.push(ids);
    return outcome;
  },
});

describe("listPredictionLeagues (#1068)", () => {
  it("offers the leagues of the player that count the competition, none checked for a new podium", async () => {
    // given « Amis » and « Club » on the Euro, « Monde » on another competition
    const mine = [
      league("club", "Club", ["euro"], { isPublic: true }),
      league("amis", "Amis", ["euro"]),
      league("monde", "Monde", ["monde"]),
    ];
    // when the player has just saved their first podium of the Euro
    const result = await listPredictionLeagues({
      leagues: leagues(mine),
      predictionLeagues: predictionLeagues([]),
      ranking: ranking([]),
    }).execute({ userId: "me", competitionSlug: "euro", eventId: "e1", hasPrediction: true });
    // then the sheet lists « Amis » and « Club », in that order, nothing checked
    expect(result.map((l) => [l.name, l.kind, l.counted])).toEqual([
      ["Amis", "private", false],
      ["Club", "public", false],
    ]);
  });

  it("tells where the podium counts and the player's place in each league", async () => {
    const mine = [
      league("amis", "Amis", ["euro"]),
      league("ft", "Ligue FrenchTrack", ["euro"], { isPublic: true, isOfficial: true }),
    ];
    const members = {
      amis: [member("me", ["e0"]), member("bob", ["e0"])],
      ft: [member("me", []), member("bob", ["e0"])],
    };
    const reads: string[] = [];
    const result = await listPredictionLeagues({
      leagues: leagues(mine, members),
      predictionLeagues: predictionLeagues(["amis"]),
      ranking: ranking([line("me", 10, "e0"), line("bob", 4, "e0")], reads),
    }).execute({ userId: "me", competitionSlug: "euro", eventId: "e1", hasPrediction: true });

    expect(result.map((l) => [l.name, l.kind, l.rank, l.counted])).toEqual([
      ["Amis", "private", 1, true],
      ["Ligue FrenchTrack", "official", null, false],
    ]);
    // the competition is read once for both leagues
    expect(reads).toEqual(["euro"]);
  });

  it("offers nothing to a player in no league of the competition", async () => {
    const result = await listPredictionLeagues({
      leagues: leagues([league("monde", "Monde", ["monde"])]),
      predictionLeagues: predictionLeagues([]),
      ranking: ranking([]),
    }).execute({ userId: "me", competitionSlug: "euro", eventId: "e1", hasPrediction: false });
    expect(result).toEqual([]);
  });
});

describe("savePredictionLeagues (#1068)", () => {
  it("sets the leagues chosen, each once", async () => {
    const sets: string[][] = [];
    await savePredictionLeagues({
      predictionLeagues: predictionLeagues([], "done", sets),
    }).execute({ eventId: "e1", leagueIds: ["amis", "amis", "club", ""] });
    expect(sets).toEqual([["amis", "club"]]);
  });

  it("refuses once the event is locked with PREDICTION_LOCKED", async () => {
    await expect(
      savePredictionLeagues({ predictionLeagues: predictionLeagues([], "locked") }).execute({
        eventId: "e1",
        leagueIds: ["amis"],
      }),
    ).rejects.toEqual(new UseCaseError("PREDICTION_LOCKED"));
  });

  it("refuses a league the podium cannot count in with LEAGUE_NOT_FOUND", async () => {
    await expect(
      savePredictionLeagues({ predictionLeagues: predictionLeagues([], "refused") }).execute({
        eventId: "e1",
        leagueIds: ["monde"],
      }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
  });
});
