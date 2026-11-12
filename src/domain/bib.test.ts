import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BIB_COLORS, DEFAULT_BIB, bibOf, isBibColor, randomBib, validateBib } from "./bib";

describe("validateBib", () => {
  it.each(["0", "7", "42", "999"])("accepts the number %j", (number) => {
    expect(validateBib(number, "blue")).toEqual({
      ok: true,
      bib: { number: Number(number), color: "blue" },
    });
  });

  it("trims spaces around the number", () => {
    expect(validateBib(" 12 ", "red")).toEqual({ ok: true, bib: { number: 12, color: "red" } });
  });

  it.each(["", " ", "1000", "07", "00", "-1", "1.5", "1e2", "abc", "12a", "４２"])(
    "rejects the number %j with BIB_NUMBER_INVALID",
    (number) => {
      expect(validateBib(number, "blue")).toEqual({ ok: false, code: "BIB_NUMBER_INVALID" });
    },
  );

  it.each(["", "pink", "Blue", "#084595", "javascript:alert(1)"])(
    "rejects the colour %j with BIB_COLOR_INVALID",
    (color) => {
      expect(validateBib("12", color)).toEqual({ ok: false, code: "BIB_COLOR_INVALID" });
    },
  );

  it("accepts every number from 0 to 999 written without a leading zero", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (n) => validateBib(String(n), "gold").ok),
    );
  });
});

describe("bib colours", () => {
  it("offers six different colours", () => {
    expect(BIB_COLORS).toEqual(["blue", "red", "gold", "green", "white", "night"]);
  });

  it("recognizes a colour of the list and refuses anything else", () => {
    expect(isBibColor("night")).toBe(true);
    expect(isBibColor("black")).toBe(false);
  });
});

describe("randomBib", () => {
  it("draws a number from 1 to 99 and a colour of the list", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), (r) => {
        const bib = randomBib(() => r);
        return bib.number >= 1 && bib.number <= 99 && isBibColor(bib.color);
      }),
    );
  });

  it("reaches both ends of the ranges", () => {
    expect(randomBib(() => 0)).toEqual({ number: 1, color: "blue" });
    expect(randomBib(() => 0.9999)).toEqual({ number: 99, color: "night" });
  });
});

describe("bibOf", () => {
  it("keeps a stored bib that follows the rules", () => {
    expect(bibOf(512, "green")).toEqual({ number: 512, color: "green" });
  });

  it("falls back to the default bib for a stored value outside the rules", () => {
    expect(bibOf(1000, "green")).toEqual(DEFAULT_BIB);
    expect(bibOf(12, "pink")).toEqual(DEFAULT_BIB);
    expect(bibOf(null, null)).toEqual(DEFAULT_BIB);
  });
});
