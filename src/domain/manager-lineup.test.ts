import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import {
  sheetDiscipline,
  fillablePlaces,
  fitsPlace,
  lineupPlaces,
  lineupProblem,
  lineupProgress,
  lineupStatus,
  placeLineup,
  seatAthlete,
  type LineupAthlete,
  type LineupDiscipline,
  type MatchSheet,
  type SheetAthlete,
} from "./manager-lineup";

/** 8 places: two per family (the rules of 16 Nov. 2026, #1017). */
const RULES = { perFamily: 2, bench: 4 };
const ONE = { perFamily: 1, bench: 2 };

const athlete = (athleteId: string, family: DisciplineFamily, entered = true): LineupAthlete => ({
  athleteId,
  family,
  entered,
});

const DISCIPLINES: Record<string, LineupDiscipline> = {
  "100 m": { name: "100 m", family: "sprint", unit: "time" },
  "200 m": { name: "200 m", family: "sprint", unit: "time" },
  "110 m haies": { name: "110 m haies", family: "hurdles", unit: "time" },
  "800 m": { name: "800 m", family: "middle", unit: "time" },
  "5000 m": { name: "5000 m", family: "long", unit: "time" },
  "Lancer du poids": { name: "Lancer du poids", family: "throws", unit: "distance" },
  "Saut en longueur": { name: "Saut en longueur", family: "horizontal_jumps", unit: "distance" },
};
const DEFAULT_DISCIPLINE: Partial<Record<DisciplineFamily, string>> = {
  sprint: "100 m",
  hurdles: "110 m haies",
  middle: "800 m",
  long: "5000 m",
  throws: "Lancer du poids",
  horizontal_jumps: "Saut en longueur",
};

/** An athlete of the team, with the disciplines they may count in (their family's by default). */
const entrant = (
  athleteId: string,
  family: DisciplineFamily,
  entered = true,
  disciplines: string[] = [DEFAULT_DISCIPLINE[family] ?? "100 m"],
): SheetAthlete => ({
  ...athlete(athleteId, family, entered),
  disciplines: disciplines.map((d) => DISCIPLINES[d]!),
});

/** A match sheet of these starters, in place order, and these substitutes, in rank order. */
const sheet = (starters: string[], bench: string[] = []): MatchSheet => ({
  starters: starters.map((athleteId) => ({ athleteId })),
  bench: bench.map((athleteId) => ({ athleteId })),
});

describe("lineupPlaces", () => {
  it("gives each of the four families its places, in order, and no free place", () => {
    expect(lineupPlaces(RULES)).toEqual([
      "sprint",
      "sprint",
      "distance",
      "distance",
      "jumps",
      "jumps",
      "throws",
      "throws",
    ]);
  });
});

describe("fitsPlace", () => {
  it("takes an athlete of the place's family only", () => {
    expect(fitsPlace("sprint", "hurdles")).toBe(true);
    expect(fitsPlace("sprint", "middle")).toBe(false);
    expect(fitsPlace("distance", "long")).toBe(true);
    expect(fitsPlace("jumps", "horizontal_jumps")).toBe(true);
    expect(fitsPlace("jumps", "combined")).toBe(true);
    expect(fitsPlace("throws", "relay")).toBe(false);
  });
});

describe("placeLineup", () => {
  it("seats each athlete on the first empty place of their family", () => {
    const team = [athlete("m1", "middle"), athlete("s1", "sprint"), athlete("s2", "hurdles")];
    expect(placeLineup(lineupPlaces(RULES), team, ["s2", "m1", "s1"])).toEqual({
      placed: ["s2", "s1", "m1", null, null, null, null, null],
      left: [],
    });
  });

  it("leaves out who finds no place", () => {
    const team = [athlete("s1", "sprint"), athlete("s2", "sprint"), athlete("t1", "throws")];
    expect(placeLineup(lineupPlaces(ONE), team, ["s1", "s2", "t1"])).toEqual({
      placed: ["s1", null, null, "t1"],
      left: ["s2"],
    });
  });
});

describe("seatAthlete", () => {
  const places = lineupPlaces(ONE);
  const team = [
    athlete("s1", "sprint"),
    athlete("s2", "hurdles"),
    athlete("m1", "middle"),
    athlete("t1", "throws", false),
  ];

  it("seats an athlete and sends whoever sat there back to the bench", () => {
    const placed = seatAthlete(places, team, [null, null, null, null], "s1", 0);
    expect(placed).toEqual(["s1", null, null, null]);
    expect(seatAthlete(places, team, placed, "s2", 0)).toEqual(["s2", null, null, null]);
  });

  it("swaps two athletes of the same family", () => {
    const two = lineupPlaces(RULES);
    const placed = ["s1", "s2", null, null, null, null, null, null];
    expect(seatAthlete(two, team, placed, "s2", 0)).toEqual([
      "s2",
      "s1",
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("refuses a place of another family, and an athlete who is not entered", () => {
    const empty = [null, null, null, null];
    expect(seatAthlete(places, team, empty, "m1", 0)).toEqual(empty);
    expect(seatAthlete(places, team, empty, "t1", 3)).toEqual(empty);
  });
});

describe("fillablePlaces", () => {
  it("greys the places nobody entered can fill", () => {
    const team = [
      athlete("s1", "sprint"),
      athlete("s2", "sprint"),
      athlete("m1", "middle"),
      athlete("t1", "throws", false),
    ];
    expect(fillablePlaces(lineupPlaces(RULES), team)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("lineupProblem", () => {
  const team = [
    entrant("s1", "sprint"),
    entrant("s2", "hurdles"),
    entrant("m1", "middle"),
    entrant("t1", "throws"),
    entrant("l1", "long", false),
  ];

  it("accepts a lineup that fills every place it can", () => {
    expect(lineupProblem(ONE, team, sheet(["s1", "m1", "t1"]))).toBeNull();
  });

  it("refuses an athlete of another team, twice the same, or an absent one", () => {
    expect(lineupProblem(ONE, team, sheet(["s1", "m1", "t1", "x9"]))).toBe("not_in_team");
    expect(lineupProblem(ONE, team, sheet(["s1", "m1", "t1", "t1"]))).toBe("twice");
    expect(lineupProblem(ONE, team, sheet(["s1", "t1", "l1"]))).toBe("absent");
  });

  it("refuses a lineup that leaves a place it could fill empty", () => {
    expect(lineupProblem(ONE, team, sheet(["s1", "m1"]))).toBe("incomplete");
  });

  it("refuses more athletes of a family than its places", () => {
    expect(lineupProblem(ONE, team, sheet(["s1", "s2", "m1", "t1"]))).toBe("does_not_fit");
  });

  it("accepts fewer athletes when the team cannot fill a place", () => {
    const short = [entrant("s1", "sprint"), entrant("t1", "throws", false)];
    expect(lineupProblem(ONE, short, sheet(["s1"]))).toBeNull();
    expect(lineupProblem(ONE, short, sheet([]))).toBe("incomplete");
  });

  it("accepts any lineup placeLineup builds from a full selection (property)", () => {
    const families: DisciplineFamily[] = ["sprint", "hurdles", "middle", "long", "throws"];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...families), fc.boolean()), { maxLength: 12 }),
        fc.integer({ min: 0, max: 3 }),
        (drawn, perFamily) => {
          const squad = drawn.map(([family, entered], i) => entrant(`a${i}`, family, entered));
          const r = { perFamily, bench: 0 };
          const places = lineupPlaces(r);
          const entered = squad.filter((a) => a.entered).map((a) => a.athleteId);
          const { placed } = placeLineup(places, squad, entered);
          const chosen = placed.filter((id): id is string => id !== null);
          expect(lineupProblem(r, squad, sheet(chosen))).toBeNull();
          expect(chosen.length).toBe(fillablePlaces(places, squad).filter(Boolean).length);
        },
      ),
    );
  });
});

describe("lineupProblem on the match sheet (#1032)", () => {
  // One place per family, a bench of two. Two sprinters, a hurdler who also runs the 200 m, a
  // middle-distance runner, a thrower, a long-distance runner not entered.
  const team = [
    entrant("s1", "sprint"),
    entrant("s2", "sprint"),
    entrant("h1", "hurdles", true, ["110 m haies", "200 m"]),
    entrant("m1", "middle"),
    entrant("t1", "throws"),
    entrant("l1", "long", false),
  ];
  const starters = ["s1", "m1", "t1"];
  const withSub = (substituteId: string, extra: Partial<MatchSheet["starters"][number]> = {}) => ({
    starters: [
      { athleteId: "s1", substituteId, ...extra },
      { athleteId: "m1" },
      { athleteId: "t1" },
    ],
    bench: [{ athleteId: "s2" }, { athleteId: "h1" }],
  });

  it("accepts ordered substitutes, a designated substitute of the family and a threshold", () => {
    expect(lineupProblem(ONE, team, sheet(starters, ["h1", "s2"]))).toBeNull();
    expect(lineupProblem(ONE, team, withSub("h1", { threshold: 10.5 }))).toBeNull();
    expect(lineupProblem(ONE, team, withSub("s2", { substituteId: null }))).toBeNull();
  });

  it("refuses more substitutes than the bench holds", () => {
    expect(lineupProblem(ONE, team, sheet(["s1", "t1"], ["s2", "h1", "m1"]))).toBe("bench_full");
  });

  it("refuses a substitute of another team, twice on the sheet, or not entered", () => {
    expect(lineupProblem(ONE, team, sheet(starters, ["x9"]))).toBe("not_in_team");
    expect(lineupProblem(ONE, team, sheet(starters, ["s1"]))).toBe("twice");
    expect(lineupProblem(ONE, team, sheet(starters, ["s2", "s2"]))).toBe("twice");
    expect(lineupProblem(ONE, team, sheet(starters, ["l1"]))).toBe("absent");
  });

  it("counts the discipline chosen, among those the athlete is entered in", () => {
    const pick = (discipline: string) => ({
      starters: [{ athleteId: "h1", discipline }, { athleteId: "m1" }, { athleteId: "t1" }],
      bench: [{ athleteId: "s1", discipline: "100 m" }],
    });
    expect(lineupProblem(ONE, team, pick("200 m"))).toBeNull();
    expect(lineupProblem(ONE, team, pick("110 m haies"))).toBeNull();
    expect(lineupProblem(ONE, team, pick("400 m"))).toBe("discipline_not_entered");
    const benchPick = { ...sheet(starters), bench: [{ athleteId: "s2", discipline: "800 m" }] };
    expect(lineupProblem(ONE, team, benchPick)).toBe("discipline_not_entered");
  });

  it("refuses a discipline-less athlete, whose discipline cannot be chosen", () => {
    const bare = [...team.filter((a) => a.athleteId !== "s1"), entrant("s1", "sprint", true, [])];
    expect(lineupProblem(ONE, bare, sheet(starters))).toBe("discipline_not_entered");
  });

  it("refuses a designated substitute of another family", () => {
    const runners = [entrant("s1", "sprint"), entrant("m1", "middle"), entrant("m2", "long")];
    const sheetOf = {
      starters: [{ athleteId: "s1", substituteId: "m2" }, { athleteId: "m1" }],
      bench: [{ athleteId: "m2" }],
    };
    expect(lineupProblem(ONE, runners, sheetOf)).toBe("substitute_other_family");
  });

  it("takes a man or a woman as substitute: only the family counts", () => {
    // Hurdles count as sprint, whatever the sex: the team carries no sex here.
    expect(lineupProblem(ONE, team, withSub("h1"))).toBeNull();
  });

  it("refuses a designated substitute who is not on the bench", () => {
    expect(lineupProblem(ONE, team, withSub("m1"))).toBe("substitute_not_on_bench");
    expect(lineupProblem(ONE, team, withSub("x9"))).toBe("substitute_not_on_bench");
    const reserve = { ...withSub("s2"), bench: [{ athleteId: "h1" }] };
    expect(lineupProblem(ONE, team, reserve)).toBe("substitute_not_on_bench");
  });

  it("refuses the same substitute for two starters", () => {
    const two = {
      starters: [
        { athleteId: "s1", substituteId: "s2" },
        { athleteId: "h1", substituteId: "s2" },
        { athleteId: "m1" },
        { athleteId: "t1" },
      ],
      bench: [{ athleteId: "s2" }],
    };
    expect(lineupProblem(RULES, team, two)).toBe("substitute_twice");
  });

  it("refuses a threshold outside the plausible marks of the discipline, or without substitute", () => {
    expect(lineupProblem(ONE, team, withSub("s2", { threshold: 8 }))).toBe("implausible_threshold");
    expect(lineupProblem(ONE, team, withSub("s2", { threshold: Number.NaN }))).toBe(
      "implausible_threshold",
    );
    const slow = withSub("h1", { threshold: 13.2 });
    expect(lineupProblem(ONE, team, slow)).toBeNull();
    const alone = {
      starters: [{ athleteId: "s1", threshold: 10.5 }, { athleteId: "m1" }, { athleteId: "t1" }],
      bench: [{ athleteId: "s2" }],
    };
    expect(lineupProblem(ONE, team, alone)).toBe("threshold_without_substitute");
  });

  it("reads the threshold in the unit of the discipline chosen", () => {
    const longJump = [entrant("j1", "horizontal_jumps"), entrant("j2", "horizontal_jumps")];
    const jumpSheet = (threshold: number) => ({
      starters: [{ athleteId: "j1", substituteId: "j2", threshold }],
      bench: [{ athleteId: "j2" }],
    });
    expect(lineupProblem(ONE, longJump, jumpSheet(8))).toBeNull();
    expect(lineupProblem(ONE, longJump, jumpSheet(10.5))).toBe("implausible_threshold");
  });
});

describe("sheetDiscipline", () => {
  const h1 = entrant("h1", "hurdles", true, ["110 m haies", "200 m"]);

  it("is the one chosen when the athlete is entered in it", () => {
    expect(sheetDiscipline(h1, "200 m")?.name).toBe("200 m");
    expect(sheetDiscipline(h1, "400 m")).toBeNull();
  });

  it("is the first one, prefilled, when none is chosen", () => {
    expect(sheetDiscipline(h1, undefined)?.name).toBe("110 m haies");
    expect(sheetDiscipline(entrant("x", "sprint", true, []), undefined)).toBeNull();
  });
});

describe("lineupProgress", () => {
  const places = lineupPlaces(RULES);
  const empty = places.map(() => null);

  it("fills nothing and offers nothing to validate when no athlete of the team is entered", () => {
    const absent = [athlete("s1", "sprint", false), athlete("m1", "middle", false)];
    expect(lineupProgress(places, absent, empty)).toEqual({
      filled: 0,
      toFill: [],
      unfillable: 8,
      ready: false,
    });
  });

  it("counts the places to fill by place, and the ones nobody can fill", () => {
    const squad = [athlete("s1", "sprint"), athlete("m1", "middle"), athlete("m2", "long")];
    expect(lineupProgress(places, squad, empty)).toEqual({
      filled: 0,
      toFill: [
        { place: "sprint", count: 1 },
        { place: "distance", count: 2 },
      ],
      unfillable: 5,
      ready: false,
    });
  });

  it("is ready once every place the team can fill holds an entered athlete", () => {
    const squad = [athlete("s1", "sprint"), athlete("m1", "middle"), athlete("m2", "middle")];
    const placed = placeLineup(places, squad, ["s1", "m1", "m2"]).placed;
    expect(lineupProgress(places, squad, placed)).toEqual({
      filled: 3,
      toFill: [],
      unfillable: 5,
      ready: true,
    });
  });

  it("does not count an athlete who is no longer entered as filling a place", () => {
    const squad = [athlete("s1", "sprint", false), athlete("m1", "middle")];
    const placed = placeLineup(places, squad, ["s1", "m1"]).placed;
    expect(lineupProgress(places, squad, placed)).toMatchObject({
      filled: 1,
      unfillable: 7,
      ready: true,
    });
  });
});

describe("lineupStatus", () => {
  const lockAt = "2027-06-01T16:00:00.000Z";

  it("is to do, validated, then locked at the lock time", () => {
    expect(lineupStatus({ lockAt, validated: false }, "2027-06-01T15:59:59.000Z")).toBe("todo");
    expect(lineupStatus({ lockAt, validated: true }, "2027-06-01T15:59:59.000Z")).toBe("validated");
    expect(lineupStatus({ lockAt, validated: true }, lockAt)).toBe("locked");
    expect(lineupStatus({ lockAt, validated: false }, lockAt)).toBe("locked");
  });
});
