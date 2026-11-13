import { describe, expect, it } from "vitest";

import type { ManagerBonus } from "@/domain/manager-rules";
import type { CompetitionPerformance } from "@/domain/manager-score";
import { worldAthleticsPoints } from "@/domain/world-athletics-points";

import { UseCaseError } from "./errors";
import type { LineupCompetition, ManagerLineupRepository } from "./manager-lineup";
import {
  computeManagerScores,
  getMyManagerScore,
  type ManagerScoreLine,
  type ManagerScoreRepository,
  type ManagerScoringSheet,
} from "./manager-scores";

const bonuses: Record<ManagerBonus, number> = {
  first: 50,
  second: 30,
  third: 20,
  personal_best: 20,
  season_best: 10,
  national_record: 40,
  area_record: 60,
  world_record: 100,
};

const LOCK = "2026-07-10T16:00:00Z";
const run = (athleteId: string, mark: string, extra: Partial<CompetitionPerformance> = {}) =>
  ({
    athleteId,
    discipline: "100 m",
    sex: "F",
    unit: "time",
    round: "final",
    status: "ok",
    place: null,
    mark,
    records: [],
    ...extra,
  }) satisfies CompetitionPerformance;

/** One competition, one league of two participants: Zoé lined up two athletes, Max none. */
function world() {
  const sheet: ManagerScoringSheet = {
    competitionId: "meeting-id",
    lockAt: LOCK,
    participants: [
      { leagueId: "L", userId: "zoe", bonuses, lineup: ["a1", "a2"] },
      { leagueId: "L", userId: "max", bonuses, lineup: null },
    ],
    performances: [
      run("a1", "10.90", { place: 1, records: ["pb"] }),
      run("a2", "", { status: "dnf", mark: null }),
    ],
    predictionPoints: { zoe: 12, max: 30 },
  };
  const names: Record<string, string> = { a1: "Alice Fictive", a2: "Berthe Démo" };
  let stored: ManagerScoreLine[] = [];
  const scores = (who: { isAdmin: boolean; userId?: string }): ManagerScoreRepository => ({
    sheet: async (slug) =>
      who.isAdmin ? (slug === "meeting" ? structuredClone(sheet) : null) : "not_admin",
    replace: async (_, lines) => {
      if (!who.isAdmin) return "not_admin";
      stored = lines;
      return "saved";
    },
    mine: async (leagueId) => {
      if (leagueId !== "L" || !["zoe", "max"].includes(who.userId ?? "")) return "not_member";
      const line = stored.find((l) => l.userId === who.userId);
      if (!line) return null;
      return { ...line, athletes: line.athletes.map((a) => ({ ...a, name: names[a.athleteId]! })) };
    },
  });
  const competition: LineupCompetition = {
    competitionId: "meeting-id",
    slug: "meeting",
    name: "Meeting Fictif",
    startsOn: "2026-07-10",
    lockAt: LOCK,
    entered: [],
    lineup: null,
  };
  const lineups: ManagerLineupRepository = {
    mine: async (leagueId) => (leagueId === "L" ? [competition] : "not_member"),
    save: async () => "saved",
  };
  return { sheet, scores, lineups, stored: () => stored };
}

const after = () => new Date("2026-07-11T08:00:00Z");
const points = worldAthleticsPoints("100 m", "F", 10.9)!;

describe("computeManagerScores", () => {
  it("scores every participant of the competition once the admin runs the computation", async () => {
    // Given the performances entered after the start of the competition
    const w = world();

    // When the admin runs the computation
    await computeManagerScores({ scores: w.scores({ isAdmin: true }), now: after }).execute({
      competitionSlug: "meeting",
    });

    // Then Zoé gets her athletes' points, their bonuses and her predictions; Max gets 0
    const [zoe, max] = w.stored();
    expect(zoe).toMatchObject({
      leagueId: "L",
      userId: "zoe",
      linedUp: true,
      hungarian: points,
      bonus: 70,
      predictions: 12,
      total: points + 70 + 12,
    });
    expect(zoe!.athletes.map((a) => [a.athleteId, a.total])).toEqual([
      ["a1", points + 70],
      ["a2", 0],
    ]);
    expect(max).toMatchObject({ userId: "max", linedUp: false, total: 0, predictions: 0 });
  });

  it("replaces the scores when run again after a corrected result", async () => {
    const w = world();
    const compute = computeManagerScores({ scores: w.scores({ isAdmin: true }), now: after });
    await compute.execute({ competitionSlug: "meeting" });

    w.sheet.performances[0] = run("a1", "10.90");
    await compute.execute({ competitionSlug: "meeting" });

    expect(w.stored()).toHaveLength(2);
    expect(w.stored()[0]!.total).toBe(points + 12);
  });

  it("stores nothing when no Manager league plays the competition", async () => {
    const w = world();
    w.sheet.participants = [];
    let written = false;
    const scores = w.scores({ isAdmin: true });

    const lines = await computeManagerScores({
      scores: { ...scores, replace: async () => ((written = true), "saved") },
      now: after,
    }).execute({ competitionSlug: "meeting" });

    expect(lines).toEqual([]);
    expect(written).toBe(false);
  });

  it("refuses to compute before the competition has started", async () => {
    const w = world();
    const before = () => new Date("2026-07-10T15:00:00Z");

    await expect(
      computeManagerScores({ scores: w.scores({ isAdmin: true }), now: before }).execute({
        competitionSlug: "meeting",
      }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_NOT_STARTED"));
    expect(w.stored()).toEqual([]);
  });

  it("refuses a player who is not admin", async () => {
    const w = world();
    await expect(
      computeManagerScores({ scores: w.scores({ isAdmin: false }), now: after }).execute({
        competitionSlug: "meeting",
      }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });

  it("tells an unknown competition", async () => {
    const w = world();
    await expect(
      computeManagerScores({ scores: w.scores({ isAdmin: true }), now: after }).execute({
        competitionSlug: "nope",
      }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_NOT_FOUND"));
  });
});

describe("getMyManagerScore", () => {
  it("shows no score before the admin computes it", async () => {
    const w = world();
    const mine = await getMyManagerScore({
      lineups: w.lineups,
      scores: w.scores({ isAdmin: false, userId: "zoe" }),
    }).execute({ leagueId: "L", slug: "meeting" });

    expect(mine).toEqual({ slug: "meeting", name: "Meeting Fictif", lockAt: LOCK, score: null });
  });

  it("shows the participant's points with the name of each athlete", async () => {
    const w = world();
    await computeManagerScores({ scores: w.scores({ isAdmin: true }), now: after }).execute({
      competitionSlug: "meeting",
    });

    const mine = await getMyManagerScore({
      lineups: w.lineups,
      scores: w.scores({ isAdmin: false, userId: "zoe" }),
    }).execute({ leagueId: "L", slug: "meeting" });

    expect(mine.score?.total).toBe(points + 70 + 12);
    expect(mine.score?.athletes.map((a) => a.name)).toEqual(["Alice Fictive", "Berthe Démo"]);
  });

  it("does not show a league the player is not in, nor a competition it does not play", async () => {
    const w = world();
    const ports = { lineups: w.lineups, scores: w.scores({ isAdmin: false, userId: "zoe" }) };

    await expect(
      getMyManagerScore(ports).execute({ leagueId: "other", slug: "meeting" }),
    ).rejects.toEqual(new UseCaseError("LEAGUE_NOT_FOUND"));
    await expect(
      getMyManagerScore(ports).execute({ leagueId: "L", slug: "other" }),
    ).rejects.toEqual(new UseCaseError("COMPETITION_NOT_FOUND"));
  });
});
