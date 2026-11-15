import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { DISCIPLINE_FAMILIES, MARK_UNITS } from "./discipline";
import {
  isInRange,
  markExample,
  markFormat,
  markInputMode,
  markRange,
  readMark,
} from "./mark-range";

describe("markRange", () => {
  it("accepts a triple jump from 5 m to 20 m", () => {
    expect(markRange("distance", "horizontal_jumps")).toEqual({ min: 5, max: 20 });
  });

  it.each([
    ["a 100 m", "sprint", "time", "9.58", 9.58],
    ["a 400 m hurdles", "hurdles", "time", "46.70", 46.7],
    ["a 4x400 m relay", "relay", "time", "2:58.10", 178.1],
    ["a 1500 m", "middle", "time", "3:26.00", 206],
    ["a 10 000 m", "long", "time", "26:11.00", 1571],
    ["a marathon", "long", "time", "2:05:30", 7530],
    ["a 20 km walk", "long", "time", "1:17:30", 4650],
    ["a long jump", "horizontal_jumps", "distance", "8,95 m", 8.95],
    ["a pole vault", "vertical_jumps", "distance", "6.26", 6.26],
    ["a high jump", "vertical_jumps", "distance", "2m04", 2.04],
    ["a javelin throw", "throws", "distance", "98.48", 98.48],
    ["a decathlon", "combined", "points", "9 126 pts", 9126],
    ["a heptathlon", "combined", "points", "6800", 6800],
  ] as const)("accepts %s", (_, family, unit, text, value) => {
    expect(readMark(text, unit, family)).toBe(value);
  });

  it.each([
    ["a 300-digit triple jump", "horizontal_jumps", "distance", `8${"0".repeat(297)}989`],
    ["a 100 m in 2 seconds", "sprint", "time", "2.10"],
    ["a 400 m hurdles in two minutes", "hurdles", "time", "2:00.00"],
    ["a 4x100 m relay in 10 seconds", "relay", "time", "10.00"],
    ["an 800 m in 40 seconds", "middle", "time", "40.00"],
    ["a marathon in a day", "long", "time", "24:00:00"],
    ["a long jump of 30 m", "horizontal_jumps", "distance", "30"],
    ["a high jump of 8 m", "vertical_jumps", "distance", "8.00"],
    ["a shot put of 200 m", "throws", "distance", "200"],
    ["a decathlon of 12 000 points", "combined", "points", "12000"],
  ] as const)("refuses %s as out of range", (_, family, unit, text) => {
    expect(readMark(text, unit, family)).toBe("out_of_range");
  });

  it.each([
    ["a 1500 m", "time", "middle", "1500 m", { min: 200, max: 330 }],
    ["a 100 m", "time", "sprint", "100 m", { min: 9, max: 14 }],
    ["a triple jump", "distance", "horizontal_jumps", "Triple saut", { min: 11, max: 19 }],
    ["a decathlon", "points", "combined", "Décathlon", { min: 6000, max: 9400 }],
  ] as const)("bounds %s around its records", (_, unit, family, discipline, range) => {
    expect(markRange(unit, family, discipline)).toEqual(range);
  });

  it.each([
    ["4,02 for a 1500 m", "time", "middle", "1500 m", "4,02", 242],
    ["4.02 for a 1500 m", "time", "middle", "1500 m", "4.02", 242],
    ["4'02 for a 1500 m", "time", "middle", "1500 m", "4'02", 242],
    ["3'35\"20 for a 1500 m", "time", "middle", "1500 m", "3'35\"20", 215.2],
    ["7,45 for a steeple", "time", "long", "3000 m steeple", "7,45", 465],
    ["7,45 for a long jump", "distance", "horizontal_jumps", "Saut en longueur", "7,45", 7.45],
    ["10,85 for a 100 m", "time", "sprint", "100 m", "10,85", 10.85],
    ["1'59 for an 800 m", "time", "middle", "800 m", "1'59", 119],
  ] as const)("reads %s", (_, unit, family, discipline, text, value) => {
    expect(readMark(text, unit, family, discipline)).toBeCloseTo(value);
  });

  it.each([
    ["a 1500 m in 2 minutes", "time", "middle", "1500 m", "2:00.00"],
    ["a 100 m in 15 seconds", "time", "sprint", "100 m", "15.00"],
    ["a 400 m in 1,10 (neither 1.10 s nor 1:10)", "time", "sprint", "400 m", "1,10"],
    ["a high jump of 3 m", "distance", "vertical_jumps", "Saut en hauteur", "3.00"],
    ["a marathon in 5 hours", "time", "long", "Marathon", "5:00:00"],
  ] as const)("refuses %s as out of range", (_, unit, family, discipline, text) => {
    expect(readMark(text, unit, family, discipline)).toBe("out_of_range");
  });

  it("keeps the range of the family for a discipline it does not know", () => {
    expect(markRange("time", "middle", "Mile")).toEqual({ min: 90, max: 900 });
  });

  it("keeps the range of the unit when a known discipline measures another way", () => {
    expect(markRange("distance", undefined, "1500 m")).toEqual({ min: 1, max: 110 });
  });

  it("refuses a mark that does not read as one", () => {
    expect(readMark("vite", "time", "sprint")).toBe("bad_mark");
  });

  it("falls back to the widest marks of the unit when the family measures another way", () => {
    expect(markRange("time", "throws")).toEqual({ min: 5, max: 21600 });
    expect(markRange("distance")).toEqual({ min: 1, max: 110 });
  });

  it("accepts any mark read as finite and inside its range", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MARK_UNITS),
        fc.option(fc.constantFrom(...DISCIPLINE_FAMILIES), { nil: undefined }),
        fc.option(fc.constantFrom("100 m", "1500 m", "Marathon", "Javelot", "Décathlon"), {
          nil: undefined,
        }),
        fc.oneof(
          fc.stringMatching(/^\d{1,400}([.,]\d{1,3})?$/),
          fc.stringMatching(/^\d{1,3}(:\d{1,3}){0,2}(\.\d{1,2})?$/),
          fc.stringMatching(/^\d{1,3}(['’]\d{1,2}){0,2}("\d{1,2})?$/),
          fc.string(),
        ),
        (unit, family, discipline, text) => {
          const value = readMark(text, unit, family, discipline);
          if (typeof value !== "number") return;
          expect(Number.isFinite(value)).toBe(true);
          expect(isInRange(value, markRange(unit, family, discipline))).toBe(true);
        },
      ),
    );
  });
});

describe("markInputMode", () => {
  it("offers digits for points, a decimal pad for metres and sprints, letters for long races", () => {
    expect(markInputMode("points", "combined")).toBe("numeric");
    expect(markInputMode("distance", "throws")).toBe("decimal");
    expect(markInputMode("time", "sprint")).toBe("decimal");
    expect(markInputMode("time", "middle")).toBe("text");
  });
});

describe("markFormat", () => {
  it.each([
    ["a 100 m", "time", "sprint", "100 m", "seconds"],
    ["a 4x100 m relay", "time", "relay", "Relais 4x100 m", "seconds"],
    ["a 1500 m", "time", "middle", "1500 m", "minutes"],
    ["a 4x400 m relay", "time", "relay", "Relais 4x400 m", "minutes"],
    ["a 10 000 m", "time", "long", "10 000 m", "minutes"],
    ["a marathon", "time", "long", "Marathon", "hours"],
    ["a sprint the app does not know", "time", "sprint", undefined, "seconds"],
    ["a pole vault", "distance", "vertical_jumps", "Saut à la perche", "metres"],
    ["a heptathlon", "points", "combined", "Heptathlon", "points"],
  ] as const)("writes %s as %s", (_, unit, family, discipline, format) => {
    expect(markFormat(unit, markRange(unit, family, discipline))).toBe(format);
  });
});

describe("markExample", () => {
  it.each([
    ["time", "sprint", "10.85"],
    ["time", "middle", "4:01.20"],
    ["distance", "horizontal_jumps", "7.45"],
    ["distance", "vertical_jumps", "1.95"],
    ["distance", "throws", "62.40"],
    ["points", "combined", "8250"],
  ] as const)("shows a %s mark of the %s family as %s", (unit, family, example) => {
    expect(markExample(unit, family)).toBe(example);
  });

  it("falls back on a mark of the unit when the family is unknown or uses another unit", () => {
    expect(markExample("time")).toBe("10.85");
    expect(markExample("distance", "sprint")).toBe("8.15");
  });

  it.each([
    ["time", "long", "Marathon", "2:06:30.00"],
    ["time", "relay", "Relais 4x400 m", "3:00.50"],
    ["distance", "horizontal_jumps", "Triple saut", "17.20"],
  ] as const)("shows a %s mark of the %s %s as %s", (unit, family, discipline, example) => {
    expect(markExample(unit, family, discipline)).toBe(example);
  });

  it("gives every known discipline an example inside its own range", () => {
    const known = [
      ["time", "sprint", ["100 m", "200 m", "400 m"]],
      ["time", "hurdles", ["100 m haies", "110 m haies", "400 m haies"]],
      ["time", "middle", ["800 m", "1500 m", "3000 m steeple"]],
      ["time", "long", ["5000 m", "10 000 m", "Marathon"]],
      [
        "time",
        "relay",
        ["Relais 4x100 m", "Relais 4x400 m", "Relais mixte 4x100 m", "Relais mixte 4x400 m"],
      ],
      ["distance", "horizontal_jumps", ["Saut en longueur", "Triple saut"]],
      ["distance", "vertical_jumps", ["Saut en hauteur", "Saut à la perche"]],
      [
        "distance",
        "throws",
        ["Lancer du poids", "Lancer du disque", "Lancer du marteau", "Javelot"],
      ],
      ["points", "combined", ["Heptathlon", "Décathlon"]],
    ] as const;
    for (const [unit, family, disciplines] of known) {
      for (const discipline of disciplines) {
        const read = readMark(markExample(unit, family, discipline), unit, family, discipline);
        expect(typeof read, discipline).toBe("number");
      }
    }
  });

  it("gives every family and unit an example that reads and lies in its range", () => {
    for (const unit of MARK_UNITS) {
      for (const family of [undefined, ...DISCIPLINE_FAMILIES]) {
        const read = readMark(markExample(unit, family), unit, family);
        expect(typeof read, `${unit} ${family}`).toBe("number");
      }
    }
  });
});
