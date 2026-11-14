import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { DisciplineFamily } from "./discipline";
import {
  fillablePlaces,
  fitsPlace,
  lineupPlaces,
  lineupProblem,
  lineupStatus,
  placeLineup,
  seatAthlete,
  type LineupAthlete,
} from "./manager-lineup";

/** 8 places: one sprint, one middle distance, one throws, five free (the rules of #418). */
const RULES = { max: 8, minPerFamily: { sprint: 1, middle: 1, throws: 1 } };

const athlete = (athleteId: string, family: DisciplineFamily, entered = true): LineupAthlete => ({
  athleteId,
  family,
  entered,
});

describe("lineupPlaces", () => {
  it("gives each family minimum its places, in the order of the cards, then free places", () => {
    expect(lineupPlaces(RULES)).toEqual([
      "sprint",
      "middle",
      "throws",
      "free",
      "free",
      "free",
      "free",
      "free",
    ]);
  });

  it("counts hurdles as sprint and both jumps together", () => {
    expect(
      lineupPlaces({ max: 4, minPerFamily: { hurdles: 1, sprint: 1, vertical_jumps: 1 } }),
    ).toEqual(["sprint", "sprint", "jumps", "free"]);
  });

  it("gives no free place when the minimums take the whole lineup", () => {
    expect(lineupPlaces({ max: 2, minPerFamily: { long: 2 } })).toEqual(["long", "long"]);
  });
});

describe("fitsPlace", () => {
  it("takes an athlete of the place's family, or anyone on a free place", () => {
    expect(fitsPlace("sprint", "hurdles")).toBe(true);
    expect(fitsPlace("sprint", "middle")).toBe(false);
    expect(fitsPlace("jumps", "horizontal_jumps")).toBe(true);
    expect(fitsPlace("free", "throws")).toBe(true);
  });
});

describe("placeLineup", () => {
  it("fills the family places first, then the free places", () => {
    const team = [athlete("m1", "middle"), athlete("s1", "sprint"), athlete("s2", "hurdles")];
    expect(placeLineup(lineupPlaces(RULES), team, ["s2", "m1", "s1"])).toEqual({
      placed: ["s2", "m1", null, "s1", null, null, null, null],
      left: [],
    });
  });

  it("leaves out who finds no place", () => {
    const places = lineupPlaces({ max: 1, minPerFamily: { sprint: 1 } });
    const team = [athlete("s1", "sprint"), athlete("t1", "throws")];
    expect(placeLineup(places, team, ["t1", "s1"])).toEqual({ placed: ["s1"], left: ["t1"] });
  });
});

describe("seatAthlete", () => {
  const places = lineupPlaces({ max: 3, minPerFamily: { sprint: 1 } });
  const team = [
    athlete("s1", "sprint"),
    athlete("m1", "middle"),
    athlete("m2", "middle"),
    athlete("t1", "throws", false),
  ];

  it("seats an athlete on a free place and sends whoever sat there back to the bench", () => {
    const placed = seatAthlete(places, team, [null, null, null], "m1", 2);
    expect(placed).toEqual([null, "m1", null]);
    expect(seatAthlete(places, team, placed, "m2", 1)).toEqual([null, "m2", null]);
  });

  it("moves a sprinter dropped on a free place to the empty sprint place", () => {
    expect(seatAthlete(places, team, [null, "m1", null], "s1", 2)).toEqual(["s1", "m1", null]);
  });

  it("swaps two athletes of the stadium: whoever sat there takes the place left", () => {
    expect(seatAthlete(places, team, ["s1", "m1", "m2"], "m2", 1)).toEqual(["s1", "m2", "m1"]);
  });

  it("sends whoever sat there back to the bench when they do not fit the place left", () => {
    const sprinters = [...team, athlete("s2", "sprint")];
    expect(seatAthlete(places, sprinters, ["s1", "m1", "s2"], "m1", 0)).toEqual(["s1", "m1", "s2"]);
    expect(seatAthlete(places, sprinters, ["s1", "m1", null], "s1", 1)).toEqual(["s1", null, null]);
  });

  it("refuses a place of another family, and an athlete who is not entered", () => {
    expect(seatAthlete(places, team, [null, null, null], "m1", 0)).toEqual([null, null, null]);
    expect(seatAthlete(places, team, [null, null, null], "t1", 1)).toEqual([null, null, null]);
  });
});

describe("fillablePlaces", () => {
  it("greys a family place nobody entered can fill, and the free places nobody is left for", () => {
    const team = [
      athlete("s1", "sprint"),
      athlete("s2", "sprint"),
      athlete("m1", "middle"),
      athlete("t1", "throws", false),
    ];
    expect(fillablePlaces(lineupPlaces(RULES), team)).toEqual([
      true,
      true,
      false,
      true,
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
  const rules = { max: 4, minPerFamily: { sprint: 1, middle: 1 } };

  it("accepts a lineup that fills every place it can", () => {
    expect(lineupProblem(rules, team, ["s1", "m1", "s2", "t1"])).toBeNull();
  });

  it("refuses an athlete of another team, twice the same, or an absent one", () => {
    expect(lineupProblem(rules, team, ["s1", "m1", "s2", "x9"])).toBe("not_in_team");
    expect(lineupProblem(rules, team, ["s1", "m1", "s2", "s2"])).toBe("twice");
    expect(lineupProblem(rules, team, ["s1", "m1", "s2", "l1"])).toBe("absent");
  });

  it("refuses a lineup that leaves a place it could fill empty", () => {
    expect(lineupProblem(rules, team, ["s1", "m1", "s2"])).toBe("incomplete");
  });

  it("refuses a lineup that leaves a family place empty for a free one", () => {
    expect(lineupProblem({ max: 2, minPerFamily: { sprint: 1 } }, team, ["m1", "t1"])).toBe(
      "does_not_fit",
    );
  });

  it("accepts fewer athletes when the team cannot fill a place", () => {
    const short = [athlete("s1", "sprint"), athlete("t1", "throws", false)];
    expect(lineupProblem(rules, short, ["s1"])).toBeNull();
    expect(lineupProblem(rules, short, [])).toBe("incomplete");
  });

  it("keeps to the maximum", () => {
    expect(lineupProblem(rules, team, ["s1", "m1", "s2", "t1", "t1"])).toBe("twice");
    const big = [...team, athlete("t2", "throws")];
    expect(lineupProblem(rules, big, ["s1", "m1", "s2", "t1", "t2"])).toBe("does_not_fit");
  });

  it("accepts any lineup placeLineup builds from a full selection (property)", () => {
    const families: DisciplineFamily[] = ["sprint", "hurdles", "middle", "long", "throws"];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...families), fc.boolean()), { maxLength: 12 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 4 }),
        (drawn, sprint, middle, free) => {
          const squad = drawn.map(([family, entered], i) => athlete(`a${i}`, family, entered));
          const r = { max: sprint + middle + free, minPerFamily: { sprint, middle } };
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

describe("lineupStatus", () => {
  const lockAt = "2027-06-01T16:00:00.000Z";

  it("is to do, validated, then locked at the lock time", () => {
    expect(lineupStatus({ lockAt, validated: false }, "2027-06-01T15:59:59.000Z")).toBe("todo");
    expect(lineupStatus({ lockAt, validated: true }, "2027-06-01T15:59:59.000Z")).toBe("validated");
    expect(lineupStatus({ lockAt, validated: true }, lockAt)).toBe("locked");
    expect(lineupStatus({ lockAt, validated: false }, lockAt)).toBe("locked");
  });
});
