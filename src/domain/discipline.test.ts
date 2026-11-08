import { describe, expect, it } from "vitest";

import { formatMark, isValidTolerance, parseMark, withinTolerance } from "./discipline";

describe("parseMark", () => {
  it("reads times in seconds, minutes and hours", () => {
    expect(parseMark("10.62", "time")).toBe(10.62);
    expect(parseMark("1:56.70", "time")).toBeCloseTo(116.7);
    expect(parseMark("2:05:30", "time")).toBe(7530);
  });

  it("reads distances and heights in metres, with or without a unit or a comma", () => {
    expect(parseMark("2.04", "distance")).toBe(2.04);
    expect(parseMark("8,12 m", "distance")).toBe(8.12);
    expect(parseMark("2m34", "distance")).toBe(2.34);
  });

  it("reads points, and refuses what is not a mark", () => {
    expect(parseMark("8125", "points")).toBe(8125);
    expect(parseMark("8 125 pts", "points")).toBe(8125);
    expect(parseMark("DNF", "time")).toBeNull();
    expect(parseMark("1:56.70", "distance")).toBeNull();
    expect(parseMark("", "time")).toBeNull();
  });
});

describe("formatMark", () => {
  it("writes a mark the way athletics writes it", () => {
    expect(formatMark(10.62, "time")).toBe("10.62");
    expect(formatMark(116.7, "time")).toBe("1:56.70");
    expect(formatMark(7530, "time")).toBe("2:05:30.00");
    expect(formatMark(2.04, "distance")).toBe("2.04");
    expect(formatMark(8125, "points")).toBe("8125");
  });
});

describe("withinTolerance", () => {
  it("is true when the gap is at most the tolerance", () => {
    expect(withinTolerance(10.81, 10.79, 0.05)).toBe(true);
    expect(withinTolerance(10.85, 10.79, 0.05)).toBe(false);
    expect(withinTolerance(2.02, 2.04, 0.02)).toBe(true);
  });
});

describe("isValidTolerance", () => {
  it("accepts a positive number, refuses zero, negatives and nonsense", () => {
    expect(isValidTolerance(0.05)).toBe(true);
    expect(isValidTolerance(0)).toBe(false);
    expect(isValidTolerance(-1)).toBe(false);
    expect(isValidTolerance(Number.NaN)).toBe(false);
  });
});
