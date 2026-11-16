import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ManagerBonus } from "./manager-rules";
import {
  managerCompetitionScore,
  managerTablePoints,
  type CompetitionPerformance,
  type ManagerScoreInput,
} from "./manager-score";
import { worldAthleticsPoints } from "./world-athletics-points";

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

const run = (over: Partial<CompetitionPerformance> = {}): CompetitionPerformance => ({
  athleteId: "a",
  discipline: "100 m",
  sex: "F",
  unit: "time",
  round: "final",
  status: "ok",
  place: 4,
  mark: "11.00",
  records: [],
  ...over,
});

const input = (over: Partial<ManagerScoreInput> = {}): ManagerScoreInput => ({
  lineup: ["a"],
  performances: [run()],
  tablesDivisor: 10,
  bonuses,
  ...over,
});

const table100 = (sex: "F" | "M", mark: number) => worldAthleticsPoints("100 m", sex, mark) ?? 0;
/** What a 100 m is worth in the Manager, the tables divided by 10. */
const points100 = (sex: "F" | "M", mark: number) => Math.floor(table100(sex, mark) / 10);

describe("managerTablePoints", () => {
  it.each([
    [1109, 110],
    [1356, 135],
    [999, 99],
    [9, 0],
    [0, 0],
  ])("is worth %i points of the tables divided by 10, rounded down: %i", (table, points) => {
    expect(managerTablePoints(table, 10)).toBe(points);
  });

  it("rounds athlete by athlete: the reference teams of the decision of 16 Nov. 2026", () => {
    // The tables of team A add up to 8 956 and those of team B to 8 687 (#1017).
    const teamA = [1129, 1119, 1109, 1099, 1130, 1120, 1080, 1170];
    const teamB = [1099, 1089, 1079, 1069, 1111, 1080, 1060, 1100];
    const score = (team: number[], bonus: number) =>
      team.reduce((sum, t) => sum + managerTablePoints(t, 10), 0) + bonus;
    expect(teamA.reduce((a, b) => a + b)).toBe(8956);
    expect(teamB.reduce((a, b) => a + b)).toBe(8687);
    expect(score(teamA, 15)).toBe(907);
    expect(score(teamB, 66)).toBe(931);
  });
});

describe("managerCompetitionScore", () => {
  it("gives a lined-up athlete the points of their mark in the World Athletics tables, divided", () => {
    const score = managerCompetitionScore(input());
    expect(score.hungarian).toBe(Math.floor(table100("F", 11) / 10));
    expect(score.athletes).toEqual([
      expect.objectContaining({ athleteId: "a", discipline: "100 m", mark: "11.00", status: "ok" }),
    ]);
    expect(score.athletes[0].points).toBe(points100("F", 11));
  });

  it("divides the tables by the divisor of the league", () => {
    const score = managerCompetitionScore(input({ tablesDivisor: 1 }));
    expect(score.athletes[0].points).toBe(table100("F", 11));
  });

  it("adds every lined-up athlete and their bonuses, rounding each athlete down", () => {
    const score = managerCompetitionScore(
      input({
        lineup: ["a", "b"],
        performances: [
          run({ athleteId: "a", place: 1, records: ["pb"] }),
          run({ athleteId: "b", sex: "M", mark: "10.20", place: 5 }),
        ],
      }),
    );
    const hungarian = points100("F", 11) + points100("M", 10.2);
    expect(score.hungarian).toBe(hungarian);
    expect(score.bonus).toBe(70);
    expect(score.total).toBe(hungarian + 70);
  });

  it("lists the bonuses an athlete earned, place first", () => {
    const score = managerCompetitionScore(
      input({ performances: [run({ place: 1, records: ["sb", "pb"] })] }),
    );
    expect(score.athletes[0].bonuses).toEqual([
      { bonus: "first", points: 50 },
      { bonus: "personal_best", points: 20 },
      { bonus: "season_best", points: 10 },
    ]);
    expect(score.athletes[0].bonusPoints).toBe(80);
  });

  it("scores 0 for the whole competition without a lineup", () => {
    const score = managerCompetitionScore(input({ lineup: null }));
    expect(score).toEqual({ linedUp: false, total: 0, hungarian: 0, bonus: 0, athletes: [] });
  });

  it.each(["dns", "dnf", "dq"] as const)("gives 0 point to an athlete who is %s", (status) => {
    const score = managerCompetitionScore(
      input({ performances: [run({ status, place: null, mark: null })] }),
    );
    expect(score.athletes[0]).toMatchObject({ status, points: 0, bonusPoints: 0, total: 0 });
    expect(score.total).toBe(0);
  });

  it("gives 0 point to a lined-up athlete without a performance entered", () => {
    const score = managerCompetitionScore(input({ performances: [] }));
    expect(score.athletes).toEqual([
      {
        athleteId: "a",
        discipline: null,
        mark: null,
        status: null,
        points: 0,
        bonuses: [],
        bonusPoints: 0,
        total: 0,
      },
    ]);
  });

  it("gives no table points to a discipline the tables do not cover, the bonuses still count", () => {
    const score = managerCompetitionScore(
      input({ performances: [run({ discipline: "Course en sac", place: 1 })] }),
    );
    expect(score.athletes[0]).toMatchObject({ points: 0, bonusPoints: 50 });
  });

  it("gives no table points to a mark that cannot be read", () => {
    const score = managerCompetitionScore(input({ performances: [run({ mark: "vite" })] }));
    expect(score.athletes[0].points).toBe(0);
  });

  it("ignores the performances of athletes who are not lined up", () => {
    const score = managerCompetitionScore(
      input({ performances: [run(), run({ athleteId: "z", place: 1 })] }),
    );
    expect(score.athletes.map((a) => a.athleteId)).toEqual(["a"]);
  });

  it("keeps the best performance of an athlete who ran several events, without adding them", () => {
    const heat = run({ round: "series", mark: "11.20" });
    const final = run({ round: "final", mark: "11.05" });
    const score = managerCompetitionScore(input({ performances: [heat, final] }));
    expect(score.athletes).toHaveLength(1);
    expect(score.athletes[0]).toMatchObject({ mark: "11.05", points: points100("F", 11.05) });
  });

  it("gives the place bonuses in a final only; a record in a heat still counts", () => {
    const score = managerCompetitionScore(
      input({ performances: [run({ round: "series", place: 1, records: ["pb"] })] }),
    );
    expect(score.athletes[0].bonuses.map((b) => b.bonus)).toEqual(["personal_best"]);
  });

  it("lists the athletes from the strongest to the weakest", () => {
    const score = managerCompetitionScore(
      input({
        lineup: ["slow", "dnf", "fast"],
        performances: [
          run({ athleteId: "slow", mark: "12.50" }),
          run({ athleteId: "dnf", status: "dnf", place: null, mark: null }),
          run({ athleteId: "fast", mark: "10.90" }),
        ],
      }),
    );
    expect(score.athletes.map((a) => a.athleteId)).toEqual(["fast", "slow", "dnf"]);
  });

  const arbitraryInput = fc.record({
    lineup: fc.option(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { maxLength: 4 }), {
      nil: null,
    }),
    performances: fc.array(
      fc.record({
        athleteId: fc.constantFrom("a", "b", "c", "d", "e"),
        discipline: fc.constantFrom("100 m", "800 m", "Saut en longueur", "Course en sac"),
        sex: fc.constantFrom("F" as const, "M" as const),
        unit: fc.constantFrom("time" as const, "distance" as const),
        round: fc.constantFrom("series", "final"),
        status: fc.constantFrom("ok" as const, "dns" as const, "dnf" as const, "dq" as const),
        place: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
        mark: fc.option(
          fc.double({ min: 1, max: 200, noNaN: true }).map((m) => m.toFixed(2)),
          { nil: null },
        ),
        records: fc.subarray(["pb", "sb", "nr", "ar", "wr"] as const),
      }),
      { maxLength: 8 },
    ),
    tablesDivisor: fc.integer({ min: 1, max: 20 }),
    bonuses: fc.constant(bonuses),
  });

  it("always totals the sum of its parts, each athlete never below 0", () => {
    fc.assert(
      fc.property(arbitraryInput, (i) => {
        const score = managerCompetitionScore(i);
        const athletes = score.athletes.reduce((sum, a) => sum + a.total, 0);
        return (
          score.total === score.hungarian + score.bonus &&
          athletes === score.hungarian + score.bonus &&
          score.athletes.every((a) => a.points >= 0 && a.total === a.points + a.bonusPoints)
        );
      }),
    );
  });

  it("does not change when computed again or with the performances in another order", () => {
    fc.assert(
      fc.property(arbitraryInput, (i) => {
        const once = managerCompetitionScore(i);
        const reversed = managerCompetitionScore({
          ...i,
          performances: [...i.performances].reverse(),
        });
        expect(managerCompetitionScore(i)).toEqual(once);
        expect(reversed.total).toBe(once.total);
      }),
    );
  });
});
