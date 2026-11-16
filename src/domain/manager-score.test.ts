import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ManagerBonus } from "./manager-rules";
import {
  managerCompetitionScore,
  managerTablePoints,
  type CompetitionPerformance,
  type ManagerScoreInput,
  type ScoringLineup,
  type ScoringStarter,
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

/** Starters on the 100 m, in place order, without a substitute; an empty bench. */
const starters = (...ids: string[]): ScoringLineup => ({
  starters: ids.map((athleteId) => starter(athleteId)),
  bench: [],
});

const starter = (athleteId: string, over: Partial<ScoringStarter> = {}): ScoringStarter => ({
  athleteId,
  family: "sprint",
  discipline: "100 m",
  substituteId: null,
  threshold: null,
  ...over,
});

const input = (over: Partial<ManagerScoreInput> = {}): ManagerScoreInput => ({
  lineup: starters("a"),
  performances: [run()],
  indoor: false,
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

  it("scores an indoor competition with the short-track tables (#1026)", () => {
    const race = run({ discipline: "400 m", sex: "M", mark: "46.50" });
    const lineup = { starters: [starter("a", { discipline: "400 m" })], bench: [] };
    const indoors = managerCompetitionScore(input({ indoor: true, lineup, performances: [race] }));
    const outdoors = managerCompetitionScore(
      input({ indoor: false, lineup, performances: [race] }),
    );
    expect(indoors.athletes[0].points).toBe(114);
    expect(outdoors.athletes[0].points).toBe(107);
  });

  it("gives points to a 60 m and a 60 m hurdles indoors", () => {
    const score = managerCompetitionScore(
      input({
        indoor: true,
        lineup: {
          starters: [
            starter("a", { discipline: "60 m" }),
            starter("b", { discipline: "60 m haies" }),
          ],
          bench: [],
        },
        performances: [
          run({ athleteId: "a", discipline: "60 m", sex: "M", mark: "6.60" }),
          run({ athleteId: "b", discipline: "60 m haies", sex: "F", mark: "7.90" }),
        ],
      }),
    );
    expect(score.athletes.find((a) => a.athleteId === "a")!.points).toBe(115);
    expect(score.athletes.find((a) => a.athleteId === "b")!.points).toBeGreaterThan(0);
  });

  it("adds every lined-up athlete and their bonuses, rounding each athlete down", () => {
    const score = managerCompetitionScore(
      input({
        lineup: starters("a", "b"),
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
        discipline: "100 m",
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
      input({
        lineup: { starters: [starter("a", { discipline: "Course en sac" })], bench: [] },
        performances: [run({ discipline: "Course en sac", place: 1 })],
      }),
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

  it("counts the discipline chosen on the match sheet only, even when another one is better", () => {
    const score = managerCompetitionScore(
      input({
        performances: [
          run({ mark: "11.40" }),
          run({ discipline: "200 m", mark: "21.80", place: 1, records: ["wr"] }),
        ],
      }),
    );
    expect(score.athletes).toHaveLength(1);
    expect(score.athletes[0]).toMatchObject({ discipline: "100 m", mark: "11.40", bonusPoints: 0 });
  });

  it("keeps the best round of the chosen discipline (heats and final), without adding them", () => {
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
        lineup: starters("slow", "dnf", "fast"),
        performances: [
          run({ athleteId: "slow", mark: "12.50" }),
          run({ athleteId: "dnf", status: "dnf", place: null, mark: null }),
          run({ athleteId: "fast", mark: "10.90" }),
        ],
      }),
    );
    expect(score.athletes.map((a) => a.athleteId)).toEqual(["fast", "slow", "dnf"]);
  });

  const ids = ["a", "b", "c", "d", "e", "f"];
  const arbitraryLineup = fc.shuffledSubarray(ids, { maxLength: 6 }).chain((chosen) => {
    const cut = Math.min(chosen.length, 3);
    const onStage = chosen.slice(0, cut);
    const onBench = chosen.slice(cut);
    return fc.record({
      starters: fc.tuple(
        ...onStage.map((athleteId) =>
          fc.record({
            athleteId: fc.constant(athleteId),
            family: fc.constantFrom("sprint" as const, "jumps" as const),
            discipline: fc.constantFrom("100 m", "Saut en longueur"),
            substituteId: fc.option(fc.constantFrom(...(onBench.length ? onBench : ["x"])), {
              nil: null,
            }),
            threshold: fc.option(fc.double({ min: 1, max: 200, noNaN: true }), { nil: null }),
          }),
        ),
      ),
      bench: fc.tuple(
        ...onBench.map((athleteId) =>
          fc.record({
            athleteId: fc.constant(athleteId),
            family: fc.constantFrom("sprint" as const, "jumps" as const),
            discipline: fc.constantFrom("100 m", "Saut en longueur"),
          }),
        ),
      ),
    });
  });

  const arbitraryInput = fc.record({
    lineup: fc.option(arbitraryLineup, { nil: null }),
    performances: fc.array(
      fc.record({
        athleteId: fc.constantFrom(...ids, "z"),
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
    indoor: fc.boolean(),
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

  it("scores one line per starter and brings every substitute in once at most", () => {
    fc.assert(
      fc.property(arbitraryInput, (i) => {
        const score = managerCompetitionScore(i);
        const ids = score.athletes.map((a) => a.athleteId);
        return (
          score.athletes.length === (i.lineup?.starters.length ?? 0) &&
          new Set(ids).size === ids.length
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

describe("managerCompetitionScore with substitutions (#1033)", () => {
  /** Starter "a" on the 100 m with "s" designated, threshold 10"50; "s" and "t" on the bench. */
  const sheet = (over: Partial<ScoringStarter> = {}): ScoringLineup => ({
    starters: [starter("a", { substituteId: "s", threshold: 10.5, ...over })],
    bench: [
      { athleteId: "s", family: "sprint", discipline: "100 m" },
      { athleteId: "t", family: "sprint", discipline: "100 m" },
    ],
  });
  const dnf = (athleteId: string) => run({ athleteId, status: "dnf", place: null, mark: null });
  const dns = (athleteId: string) => run({ athleteId, status: "dns", place: null, mark: null });
  const dq = (athleteId: string) => run({ athleteId, status: "dq", place: null, mark: null });
  const counted = (i: ManagerScoreInput) =>
    managerCompetitionScore(i).athletes.map((a) => [a.athleteId, a.substitution?.reason ?? null]);

  it("brings the designated substitute in when the starter is slower than the threshold, even if slower still", () => {
    const score = managerCompetitionScore(
      input({
        lineup: sheet(),
        performances: [
          run({ athleteId: "a", mark: "10.58" }),
          run({ athleteId: "s", mark: "10.70" }),
        ],
      }),
    );
    expect(score.athletes).toEqual([
      expect.objectContaining({
        athleteId: "s",
        mark: "10.70",
        substitution: { starterId: "a", reason: "tactical" },
      }),
    ]);
    expect(score.total).toBe(points100("F", 10.7));
  });

  it("keeps the starter who beats the threshold", () => {
    const i = input({
      lineup: sheet(),
      performances: [
        run({ athleteId: "a", mark: "10.42" }),
        run({ athleteId: "s", mark: "10.30" }),
      ],
    });
    expect(counted(i)).toEqual([["a", null]]);
    expect(managerCompetitionScore(i).athletes[0]).not.toHaveProperty("substitution");
  });

  it("keeps the starter who equals the threshold", () => {
    const i = input({
      lineup: sheet(),
      performances: [
        run({ athleteId: "a", mark: "10.50" }),
        run({ athleteId: "s", mark: "10.30" }),
      ],
    });
    expect(counted(i)).toEqual([["a", null]]);
  });

  it("reads the threshold of a jump the other way: less far than it brings the substitute in", () => {
    const long = { discipline: "Saut en longueur", unit: "distance" as const };
    const lineup: ScoringLineup = {
      starters: [
        starter("a", { family: "jumps", ...long, substituteId: "s", threshold: 8 }),
        starter("b", { family: "jumps", ...long, substituteId: "t", threshold: 8 }),
      ],
      bench: [
        { athleteId: "s", family: "jumps", discipline: long.discipline },
        { athleteId: "t", family: "jumps", discipline: long.discipline },
      ],
    };
    const i = input({
      lineup,
      performances: [
        run({ athleteId: "a", ...long, sex: "M", mark: "7.90" }),
        run({ athleteId: "b", ...long, sex: "M", mark: "8.10" }),
        run({ athleteId: "s", ...long, sex: "M", mark: "7.80" }),
        run({ athleteId: "t", ...long, sex: "M", mark: "8.30" }),
      ],
    });
    expect(counted(i)).toEqual(
      expect.arrayContaining([
        ["s", "tactical"],
        ["b", null],
      ]),
    );
  });

  it("keeps the starter when the designated substitute has no mark to replace their slow one", () => {
    const i = input({
      lineup: sheet(),
      performances: [run({ athleteId: "a", mark: "10.58" }), dns("s")],
    });
    expect(counted(i)).toEqual([["a", null]]);
  });

  it("brings the designated substitute in for a starter who is DNS, DNF or DQ", () => {
    const i = input({
      lineup: sheet({ threshold: null }),
      performances: [dnf("a"), run({ athleteId: "s", mark: "11.20" })],
    });
    expect(counted(i)).toEqual([["s", "forfeit"]]);
  });

  it("brings the designated substitute in for a starter without any performance entered", () => {
    const i = input({ lineup: sheet(), performances: [run({ athleteId: "s", mark: "11.20" })] });
    expect(counted(i)).toEqual([["s", "forfeit"]]);
  });

  it("brings the first substitute of the bench of the family in when the designated one did not run either", () => {
    const lineup: ScoringLineup = {
      starters: [starter("a", { substituteId: "s" })],
      bench: [
        { athleteId: "s", family: "sprint", discipline: "100 m" },
        { athleteId: "j", family: "jumps", discipline: "Saut en longueur" },
        { athleteId: "t", family: "sprint", discipline: "100 m" },
        { athleteId: "u", family: "sprint", discipline: "100 m" },
      ],
    };
    const long = { discipline: "Saut en longueur", unit: "distance" as const };
    const i = input({
      lineup,
      performances: [
        dnf("a"),
        dns("s"),
        run({ athleteId: "j", ...long, mark: "6.50" }),
        run({ athleteId: "t", mark: "11.60" }),
        run({ athleteId: "u", mark: "11.10" }),
      ],
    });
    expect(counted(i)).toEqual([["t", "bench"]]);
  });

  it("brings the first substitute of the family in for a starter without a designated one", () => {
    const i = input({
      lineup: { ...sheet({ substituteId: null, threshold: null }) },
      performances: [dq("a"), run({ athleteId: "s", mark: "11.60" })],
    });
    expect(counted(i)).toEqual([["s", "bench"]]);
  });

  it("scores 0 for the place when the bench holds nobody of the family", () => {
    const i = input({
      lineup: {
        starters: [starter("a")],
        bench: [{ athleteId: "j", family: "jumps", discipline: "Saut en longueur" }],
      },
      performances: [
        dnf("a"),
        run({ athleteId: "j", discipline: "Saut en longueur", unit: "distance", mark: "6.50" }),
      ],
    });
    const score = managerCompetitionScore(i);
    expect(counted(i)).toEqual([["a", null]]);
    expect(score.total).toBe(0);
  });

  it("never brings a substitute in twice: one designated already in elsewhere does not come again", () => {
    // Place 1 has no designated substitute: the first one of the bench, "s", comes in. Place 2
    // designated "s", already in: the next one of the bench, "t", comes in; place 3 gets nobody.
    const lineup: ScoringLineup = {
      starters: [starter("a"), starter("b", { substituteId: "s" }), starter("c")],
      bench: [
        { athleteId: "s", family: "sprint", discipline: "100 m" },
        { athleteId: "t", family: "sprint", discipline: "100 m" },
      ],
    };
    const i = input({
      lineup,
      performances: [
        dnf("a"),
        dnf("b"),
        dns("c"),
        run({ athleteId: "s", mark: "11.10" }),
        run({ athleteId: "t", mark: "11.30" }),
      ],
    });
    expect(counted(i)).toEqual([
      ["s", "bench"],
      ["t", "bench"],
      ["c", null],
    ]);
  });

  it("does not count the substitutes who did not come in", () => {
    const i = input({
      lineup: sheet(),
      performances: [
        run({ athleteId: "a", mark: "10.40" }),
        run({ athleteId: "t", mark: "10.10" }),
      ],
    });
    expect(managerCompetitionScore(i).total).toBe(points100("F", 10.4));
  });

  it("counts the substitute in the discipline chosen for them", () => {
    const i = input({
      lineup: {
        starters: [starter("a", { substituteId: "s" })],
        bench: [{ athleteId: "s", family: "sprint", discipline: "200 m" }],
      },
      performances: [dnf("a"), run({ athleteId: "s", mark: "11.00" })],
    });
    // "s" ran the 100 m only, not the 200 m chosen for them: nobody comes in.
    expect(counted(i)).toEqual([["a", null]]);
  });
});
