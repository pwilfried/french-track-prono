import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import {
  fillablePlaces,
  fitsPlace,
  lineupPlaces,
  lineupProblem,
  lineupProgress,
  lineupStatus,
  placeLineup,
  seatAthlete,
  type LineupAthlete,
} from "./manager-lineup";

/** 8 places: two per family (the rules of 16 Nov. 2026, #1017). */
const RULES = { perFamily: 2 };
const ONE = { perFamily: 1 };

const athlete = (athleteId: string, family: DisciplineFamily, entered = true): LineupAthlete => ({
  athleteId,
  family,
  entered,
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
    athlete("s1", "sprint"),
    athlete("s2", "hurdles"),
    athlete("m1", "middle"),
    athlete("t1", "throws"),
    athlete("l1", "long", false),
  ];

  it("accepts a lineup that fills every place it can", () => {
    expect(lineupProblem(ONE, team, ["s1", "m1", "t1"])).toBeNull();
  });

  it("refuses an athlete of another team, twice the same, or an absent one", () => {
    expect(lineupProblem(ONE, team, ["s1", "m1", "t1", "x9"])).toBe("not_in_team");
    expect(lineupProblem(ONE, team, ["s1", "m1", "t1", "t1"])).toBe("twice");
    expect(lineupProblem(ONE, team, ["s1", "t1", "l1"])).toBe("absent");
  });

  it("refuses a lineup that leaves a place it could fill empty", () => {
    expect(lineupProblem(ONE, team, ["s1", "m1"])).toBe("incomplete");
  });

  it("refuses more athletes of a family than its places", () => {
    expect(lineupProblem(ONE, team, ["s1", "s2", "m1", "t1"])).toBe("does_not_fit");
  });

  it("accepts fewer athletes when the team cannot fill a place", () => {
    const short = [athlete("s1", "sprint"), athlete("t1", "throws", false)];
    expect(lineupProblem(ONE, short, ["s1"])).toBeNull();
    expect(lineupProblem(ONE, short, [])).toBe("incomplete");
  });

  it("accepts any lineup placeLineup builds from a full selection (property)", () => {
    const families: DisciplineFamily[] = ["sprint", "hurdles", "middle", "long", "throws"];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...families), fc.boolean()), { maxLength: 12 }),
        fc.integer({ min: 0, max: 3 }),
        (drawn, perFamily) => {
          const squad = drawn.map(([family, entered], i) => athlete(`a${i}`, family, entered));
          const r = { perFamily };
          const places = lineupPlaces(r);
          const entered = squad.filter((a) => a.entered).map((a) => a.athleteId);
          const { placed } = placeLineup(places, squad, entered);
          const chosen = placed.filter((id): id is string => id !== null);
          expect(lineupProblem(r, squad, chosen)).toBeNull();
          expect(chosen.length).toBe(fillablePlaces(places, squad).filter(Boolean).length);
        },
      ),
    );
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
