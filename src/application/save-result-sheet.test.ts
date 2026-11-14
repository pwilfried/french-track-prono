import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { duelOutcome } from "@/domain/manager-championship";
import type { ManagerBonus } from "@/domain/manager-rules";
import { podiumFromPerformances, type Performance } from "@/domain/performance";
import {
  DEFAULT_RULES,
  flairContext,
  scorePrediction,
  type ScoringPrediction,
} from "@/domain/scoring";
import { worldAthleticsPoints } from "@/domain/world-athletics-points";

import type { PointsRepository, ScoreLine } from "./compute-event-points";
import { getPerformanceSheet, type PerformanceRepository } from "./enter-performances";
import { UseCaseError } from "./errors";
import type {
  ManagerScoreLine,
  ManagerScoreRepository,
  ScoringParticipant,
} from "./manager-scores";
import { recomputeResultSheet, saveResultSheet } from "./save-result-sheet";

const NOW = () => new Date("2026-07-10T20:00:00Z");
const LOCK = "2026-07-10T18:00:00Z";
const EVENT = "final-100";
const START_LIST = ["a1", "a2", "a3", "a4", "a5", "a6"];

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

type Pick = ScoringPrediction & { userId: string };
const pick = (userId: string, first: string, second: string, third: string, useJoker = false) =>
  ({ userId, first, second, third, useJoker }) satisfies Pick;

/**
 * One women's 100 m final of the « meeting » competition, and the fakes of the three ports sharing
 * their state as the database does: the podium is drawn from the sheet, the Manager reads the
 * performances and the prediction points stored.
 */
function world(options: { predictions?: Pick[]; participants?: ScoringParticipant[] } = {}) {
  const predictions = options.predictions ?? [];
  const participants = options.participants ?? [];
  const sheets = new Map<string, Performance[]>();
  const eventScores = new Map<string, ScoreLine[]>();
  let managerScores: ManagerScoreLine[] = [];
  const calls: string[] = [];

  const session = (isAdmin: boolean) => {
    const performances: PerformanceRepository = {
      find: async (eventId) => structuredClone(sheets.get(eventId) ?? []),
      linedUp: async () => {
        if (!isAdmin) return "not_admin";
        const lineups = participants.flatMap((p) => p.lineup ?? []);
        return START_LIST.filter((id) => lineups.includes(id));
      },
      replace: async (eventId, lines) => {
        if (!isAdmin) return "not_admin";
        if (!lines.every((l) => START_LIST.includes(l.athleteId))) return "athlete_not_in_event";
        calls.push("sheet");
        sheets.set(eventId, structuredClone(lines));
        return "saved";
      },
    };
    const points: PointsRepository = {
      loadEvent: async (eventId) => ({
        lockAt: LOCK,
        // As the database: the official podium is drawn from the sheet.
        results: podiumFromPerformances(sheets.get(eventId) ?? []),
        predictions,
        rules: DEFAULT_RULES,
      }),
      findEventScores: async (eventId) => eventScores.get(eventId) ?? [],
      progress: async () => ({ withResult: [], scored: [] }),
      listMine: async () => [],
      replaceEventScores: async (eventId, lines) => {
        if (!isAdmin) return "not_admin";
        calls.push("predictions");
        eventScores.set(eventId, structuredClone(lines));
        return "saved";
      },
    };
    const scores: ManagerScoreRepository = {
      sheet: async (slug) => {
        if (!isAdmin) return "not_admin";
        if (slug !== "meeting") return null;
        const predictionPoints: Record<string, number> = {};
        for (const line of [...eventScores.values()].flat()) {
          predictionPoints[line.userId] = (predictionPoints[line.userId] ?? 0) + line.points;
        }
        return {
          competitionId: "meeting-id",
          lockAt: LOCK,
          participants: structuredClone(participants),
          performances: [...sheets.values()].flat().map((p) => ({
            ...p,
            discipline: "100 m",
            sex: "F" as const,
            unit: "time" as const,
            round: "final",
          })),
          predictionPoints,
        };
      },
      replace: async (_, lines) => {
        if (!isAdmin) return "not_admin";
        calls.push("manager");
        managerScores = structuredClone(lines);
        return "saved";
      },
      mine: async () => null,
    };
    return { performances, points, scores, now: NOW };
  };

  return {
    admin: session(true),
    player: session(false),
    calls,
    sheet: () => sheets.get(EVENT) ?? [],
    eventPoints: (userId: string) =>
      eventScores.get(EVENT)?.find((l) => l.userId === userId)?.points,
    manager: (userId: string) => managerScores.find((l) => l.userId === userId),
  };
}

const ok = (athleteId: string, place: number | null, mark: string | null = null): Performance => ({
  athleteId,
  status: "ok",
  place,
  mark,
  records: [],
});

const save = (ports: ReturnType<typeof world>["admin"], lines: Performance[], final = true) =>
  saveResultSheet(ports).execute({
    eventId: EVENT,
    competitionSlug: "meeting",
    final,
    unit: "time",
    lines,
  });

const podium = [ok("a1", 1), ok("a2", 2), ok("a3", 3)];

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof UseCaseError ? error.code : String(error);
  }
};

describe("saveResultSheet", () => {
  it("scores the predictions and the Manager from one sheet, with no other call", async () => {
    // Given a final predicted by Zoé and Max, who both play a Manager league on the competition
    const w = world({
      predictions: [pick("zoe", "a1", "a2", "a3"), pick("max", "a4", "a5", "a6")],
      participants: [
        { leagueId: "L", userId: "zoe", bonuses, lineup: ["a1", "a4"] },
        { leagueId: "L", userId: "max", bonuses, lineup: ["a2"] },
      ],
    });

    // When the admin saves the sheet: podium with marks, a personal best, a DNF
    await save(w.admin, [
      { ...ok("a1", 1, "10.90"), records: ["pb"] },
      ok("a2", 2, "11.00"),
      ok("a3", 3, "11.10"),
      { athleteId: "a4", status: "dnf", place: null, mark: null, records: [] },
    ]);

    // Then the prediction points come first, then the Manager scores that add them
    expect(w.calls).toEqual(["sheet", "predictions", "manager"]);
    expect(w.eventPoints("zoe")).toBe(12);
    expect(w.eventPoints("max")).toBe(0);
    const winner = worldAthleticsPoints("100 m", "F", 10.9)!;
    expect(w.manager("zoe")).toMatchObject({ hungarian: winner, bonus: 70, predictions: 12 });
    expect(w.manager("zoe")!.total).toBe(winner + 70 + 12);
    expect(w.manager("max")!.total).toBe(worldAthleticsPoints("100 m", "F", 11)! + 30);
  });

  it("changes the Manager score and the head-to-head when a mark is corrected", async () => {
    // Given Zoé's athlete ahead of Max's on the first sheet
    const w = world({
      participants: [
        { leagueId: "L", userId: "zoe", bonuses, lineup: ["a3"] },
        { leagueId: "L", userId: "max", bonuses, lineup: ["a4"] },
      ],
    });
    await save(w.admin, [...podium.slice(0, 2), ok("a3", 3, "10.80"), ok("a4", 4, "11.50")]);
    expect(duelOutcome(w.manager("zoe")!.total, w.manager("max")!.total).outcome).toBe("win");

    // When the admin corrects Zoé's athlete's mark
    await save(w.admin, [...podium.slice(0, 2), ok("a3", 3, "12.90"), ok("a4", 4, "11.50")]);

    // Then her score drops and she loses the head-to-head
    expect(w.manager("zoe")!.total).toBe(worldAthleticsPoints("100 m", "F", 12.9)! + 20);
    expect(duelOutcome(w.manager("zoe")!.total, w.manager("max")!.total).outcome).toBe("loss");
  });

  it("only needs the podium when no Manager league plays the competition", async () => {
    // Given a final nobody plays in the Manager
    const w = world({ predictions: [pick("zoe", "a1", "a2", "a3", true)] });
    const sheet = await getPerformanceSheet(w.admin).execute({
      eventId: EVENT,
      competitionSlug: "meeting",
    });
    expect(sheet).toMatchObject({ manager: false, linedUp: [], missing: [] });

    // When the admin enters places 1 to 3 only, without marks
    const saved = await save(w.admin, podium);

    // Then the predictions are scored and no Manager score is stored
    expect(w.eventPoints("zoe")).toBe(24);
    expect(saved.manager).toEqual([]);
    expect(w.calls).toEqual(["sheet", "predictions"]);
  });

  it("tells the sheet a Manager league plays the competition, and who is lined up", async () => {
    const w = world({
      participants: [{ leagueId: "L", userId: "zoe", bonuses, lineup: ["a5", "a2"] }],
    });
    await save(w.admin, podium);

    const sheet = await getPerformanceSheet(w.admin).execute({
      eventId: EVENT,
      competitionSlug: "meeting",
    });

    expect(sheet).toMatchObject({ manager: true, linedUp: ["a2", "a5"], missing: ["a5"] });
  });

  it("gives no prediction points on a heat, and still scores the Manager", async () => {
    const w = world({
      predictions: [pick("zoe", "a1", "a2", "a3")],
      participants: [{ leagueId: "L", userId: "zoe", bonuses, lineup: ["a1"] }],
    });

    const saved = await save(w.admin, podium, false);

    expect(saved.predictions).toBeNull();
    expect(w.calls).toEqual(["sheet", "manager"]);
  });

  it("refuses a sheet without a full podium and saves nothing", async () => {
    const w = world();

    expect(await codeOf(save(w.admin, [ok("a1", 1), ok("a2", 2)]))).toBe("RESULT_INVALID");
    expect(await codeOf(save(w.admin, [ok("a1", 1), ok("a2", 2), ok("a3", 2), ok("a4", 3)]))).toBe(
      "RESULT_INVALID",
    );
    expect(w.calls).toEqual([]);
  });

  it("refuses a finisher with neither place nor mark, an athlete off the start list, a player", async () => {
    const w = world();

    expect(await codeOf(save(w.admin, [...podium, ok("a4", null)]))).toBe(
      "PERFORMANCE_MARK_MISSING",
    );
    expect(await codeOf(save(w.admin, [...podium, ok("stranger", 4, "11.00")]))).toBe(
      "ATHLETE_NOT_IN_EVENT",
    );
    expect(await codeOf(save(w.player, podium))).toBe("NOT_ADMIN");
    expect(w.sheet()).toEqual([]);
  });

  it("warns about a mark out of the plausible range, and saves it once the admin confirms", async () => {
    // Given a 100 m sheet whose winner ran in 2 seconds (a typo, or a deliberate entry)
    const w = world();
    const lines = [ok("a1", 1, "2.10"), ok("a2", 2, "11.00"), ok("a3", 3, "11.10")];
    const sheet = {
      eventId: EVENT,
      competitionSlug: "meeting",
      final: true,
      unit: "time" as const,
    };

    // When the admin saves it, nothing is stored: a warning asks for a confirmation
    expect(
      await codeOf(saveResultSheet(w.admin).execute({ ...sheet, family: "sprint", lines })),
    ).toBe("MARK_OUT_OF_RANGE_CONFIRM");
    expect(w.calls).toEqual([]);

    // Then, confirmed, it is saved and scored
    await saveResultSheet(w.admin).execute({
      ...sheet,
      family: "sprint",
      lines,
      confirmOutOfRange: true,
    });
    expect(w.sheet().map((l) => l.mark)).toEqual(["2.10", "11.00", "11.10"]);
  });

  it("changes nothing when the computation runs again", async () => {
    const w = world({
      predictions: [pick("zoe", "a1", "a3", "a2")],
      participants: [{ leagueId: "L", userId: "zoe", bonuses, lineup: ["a1"] }],
    });
    const first = await save(w.admin, [ok("a1", 1, "10.90"), ok("a2", 2), ok("a3", 3)]);

    const again = await recomputeResultSheet(w.admin).execute({
      eventId: EVENT,
      competitionSlug: "meeting",
      final: true,
    });

    expect(again.predictions).toEqual(first.predictions);
    expect(again.manager).toEqual(first.manager);
  });
});

describe("saveResultSheet, places 1 to 3 only: the same prediction points as before (S1 to S12)", () => {
  // Twenty players: the case under test, then 19 who pick a6 to win (flair needs 10 predictions).
  const crowd = Array.from({ length: 19 }, (_, n) => pick(`p${n}`, "a6", "a5", "a4"));
  const cases: [string, Pick, Pick[], number][] = [
    ["S1 perfect podium in order", pick("me", "a1", "a2", "a3"), [], 12],
    ["S2 winner found, the other two off the podium", pick("me", "a1", "a4", "a5"), [], 3],
    ["S3 winner found, 2nd and 3rd swapped", pick("me", "a1", "a3", "a2"), [], 5],
    ["S4 three right athletes, all misplaced", pick("me", "a2", "a3", "a1"), [], 3],
    ["S5 nobody on the podium", pick("me", "a4", "a5", "a6"), [], 0],
    ["S6 perfect podium with the joker", pick("me", "a1", "a2", "a3", true), [], 24],
    ["S7 winner found by 1 player in 20", pick("me", "a1", "a4", "a5"), crowd, 5],
    ["S10 perfect podium + flair + joker", pick("me", "a1", "a2", "a3", true), crowd, 28],
  ];

  it.each(cases)("%s", async (_, prediction, others, expected) => {
    const w = world({ predictions: [prediction, ...others] });

    await save(w.admin, podium);

    expect(w.eventPoints("me")).toBe(expected);
  });

  it("S8 no flair under 10 predictions", async () => {
    const w = world({ predictions: [pick("me", "a1", "a4", "a5"), ...crowd.slice(0, 8)] });
    await save(w.admin, podium);
    expect(w.eventPoints("me")).toBe(3);
  });

  it("S11 two athletes tied 3rd: either one in 3rd gets the place points", async () => {
    const w = world({ predictions: [pick("me", "a1", "a2", "a3"), pick("you", "a1", "a2", "a4")] });
    await save(w.admin, [...podium, ok("a4", 3)]);
    expect(w.eventPoints("me")).toBe(12);
    expect(w.eventPoints("you")).toBe(12);
  });

  it("S12 saving the same sheet twice stores the same points, without duplicates", async () => {
    const w = world({ predictions: [pick("me", "a1", "a2", "a3")] });
    await save(w.admin, podium);
    await save(w.admin, podium);
    expect(w.eventPoints("me")).toBe(12);
  });

  it("scores any podium exactly like the podium entered on its own, and again gives the same", async () => {
    const athlete = fc.constantFrom(...START_LIST);
    const prediction = fc
      .tuple(fc.uniqueArray(athlete, { minLength: 3, maxLength: 3 }), fc.boolean())
      .map(([[first, second, third], useJoker]) => ({
        first: first!,
        second: second!,
        third: third!,
        useJoker,
      }));
    // A valid podium: athletes in order, each tied with the previous one or placed by their rank.
    const sheet = fc
      .tuple(
        fc.shuffledSubarray(START_LIST, { minLength: 3, maxLength: 6 }),
        fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
      )
      .map(([order, ties]) => {
        const places: number[] = [];
        order.forEach((_, i) => places.push(i > 0 && ties[i] ? places[i - 1]! : i + 1));
        return order.map((id, i) => ok(id, places[i]!));
      })
      .filter((lines) => podiumFromPerformances(lines).length >= 3);

    await fc.assert(
      fc.asyncProperty(sheet, fc.array(prediction, { maxLength: 12 }), async (lines, picks) => {
        const predictions = picks.map((p, n) => ({ ...p, userId: `u${n}` }));
        const w = world({ predictions });

        await save(w.admin, lines);
        const before = predictions.map((p) => w.eventPoints(p.userId));
        await save(w.admin, lines);

        const official = podiumFromPerformances(lines);
        const context = flairContext(predictions);
        expect(before).toEqual(
          predictions.map((p) => scorePrediction(p, official, DEFAULT_RULES, context).points),
        );
        expect(predictions.map((p) => w.eventPoints(p.userId))).toEqual(before);
      }),
    );
  });
});
