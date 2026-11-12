import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validatePseudo } from "./profile";

describe("validatePseudo", () => {
  it("accepts a simple pseudo", () => {
    expect(validatePseudo("Anna")).toEqual({ ok: true, pseudo: "Anna" });
  });

  it("trims spaces around the pseudo", () => {
    expect(validatePseudo("  Anna  ")).toEqual({ ok: true, pseudo: "Anna" });
  });

  it("collapses repeated inner spaces", () => {
    expect(validatePseudo("Anna   Belle")).toEqual({ ok: true, pseudo: "Anna Belle" });
  });

  it("accepts accents, digits and the allowed symbols", () => {
    expect(validatePseudo("Élodie_92-b.c")).toEqual({ ok: true, pseudo: "Élodie_92-b.c" });
  });

  it("accepts an accent typed as a letter plus a combining mark", () => {
    expect(validatePseudo("Eléna")).toEqual({ ok: true, pseudo: "Eléna" });
  });

  it.each(["", " ", "A", "  b  "])("rejects %j as too short", (input) => {
    expect(validatePseudo(input)).toEqual({ ok: false, code: "PSEUDO_INVALID" });
  });

  it("accepts 24 characters and rejects 25", () => {
    expect(validatePseudo("a".repeat(24)).ok).toBe(true);
    expect(validatePseudo("a".repeat(25))).toEqual({ ok: false, code: "PSEUDO_INVALID" });
  });

  it("counts a letter outside the basic plane once", () => {
    // 22 + 2 letters = 24 characters, although the two last ones use 4 UTF-16 units.
    expect(validatePseudo("a".repeat(22) + "𝒜𝒜").ok).toBe(true);
    expect(validatePseudo("a".repeat(23) + "𝒜𝒜").ok).toBe(false);
  });

  it.each(["Anna!", "<b>Anna</b>", "an@na", "Anna😀", "ann/a", "ann\tna"])(
    "rejects %j for a forbidden character",
    (input) => {
      expect(validatePseudo(input)).toEqual({ ok: false, code: "PSEUDO_INVALID" });
    },
  );

  it("always returns a trimmed pseudo of 2 to 24 characters when it accepts", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (input) => {
        const result = validatePseudo(input);
        if (!result.ok) return true;
        const length = [...result.pseudo].length;
        return result.pseudo === result.pseudo.trim() && length >= 2 && length <= 24;
      }),
    );
  });

  it("returns the same pseudo when its own output is validated again", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (input) => {
        const first = validatePseudo(input);
        if (!first.ok) return true;
        const second = validatePseudo(first.pseudo);
        return second.ok && second.pseudo === first.pseudo;
      }),
    );
  });
});

describe("validatePseudo and banned words", () => {
  it.each(["Le Connard", "SuperConnard", "Officiel FFA"])(
    "refuses %j with PSEUDO_BANNED",
    (pseudo) => expect(validatePseudo(pseudo)).toEqual({ ok: false, code: "PSEUDO_BANNED" }),
  );
});
