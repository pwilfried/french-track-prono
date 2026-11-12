import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  INVITE_ALPHABET,
  INVITE_LENGTH,
  LEAGUE_MAX_MEMBERS,
  PUBLIC_LEAGUE_MAX_MEMBERS,
  addCompetitionNotice,
  formatInviteCode,
  leagueCapacity,
  normalizeInviteCode,
  validateLeagueName,
} from "./league";

const validCode = fc
  .array(fc.constantFrom(...INVITE_ALPHABET), {
    minLength: INVITE_LENGTH,
    maxLength: INVITE_LENGTH,
  })
  .map((chars) => chars.join(""));

describe("normalizeInviteCode", () => {
  it("accepts a code typed in lower case with spaces and dashes", () => {
    expect(normalizeInviteCode(" k7m-2qx ")).toBe("K7M2QX");
  });

  it.each([
    ["K7M2Q"],
    ["K7M2QXZ"],
    ["K7M2Q0"],
    ["K7M2QO"],
    ["K7M2QI"],
    ["K7M2QL"],
    ["K7M2Q1"],
    [""],
  ])("refuses %j", (input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });

  it("gives back any valid code however it is typed", () => {
    fc.assert(
      fc.property(validCode, fc.boolean(), fc.nat({ max: 3 }), (code, lower, spaces) => {
        const typed = (lower ? code.toLowerCase() : code).split("").join(" ".repeat(spaces % 2));
        expect(normalizeInviteCode(typed)).toBe(code);
      }),
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const once = normalizeInviteCode(input);
        if (once !== null) expect(normalizeInviteCode(once)).toBe(once);
      }),
    );
  });

  it("reads back a formatted code", () => {
    fc.assert(
      fc.property(validCode, (code) => {
        expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
      }),
    );
  });
});

describe("validateLeagueName", () => {
  it("trims and collapses the spaces", () => {
    expect(validateLeagueName("  Les   Foulées  ")).toEqual({ ok: true, name: "Les Foulées" });
  });

  it.each([["Club d'athlé 🏃"], ["AC Montreuil #2"], ["Équipe (relais) & co"], ["Ab"]])(
    "accepts %j",
    (name) => {
      expect(validateLeagueName(name).ok).toBe(true);
    },
  );

  it.each([["A"], ["   "], ["x".repeat(41)], ["<script>"], ["Bell\u0007"]])(
    "refuses %j",
    (name) => {
      expect(validateLeagueName(name)).toEqual({ ok: false, code: "LEAGUE_NAME_INVALID" });
    },
  );

  it("accepts a name of exactly 40 characters", () => {
    expect(validateLeagueName("x".repeat(40)).ok).toBe(true);
  });
});

describe("addCompetitionNotice", () => {
  // What the league page tells its creator under the league's competitions (#550).
  it("says no competition is coming yet when the league has none and none can be added", () => {
    expect(addCompetitionNotice(0, 0)).toBe("none_coming");
  });

  it("offers the coming competitions when some can be added", () => {
    expect(addCompetitionNotice(0, 2)).toBe("choose");
    expect(addCompetitionNotice(1, 1)).toBe("choose");
  });

  it("says every coming competition is already in the league when nothing is left to add", () => {
    expect(addCompetitionNotice(2, 0)).toBe("all_added");
  });
});

describe("leagueCapacity", () => {
  it("lets 200 players in a public league and 50 in a private one", () => {
    expect(leagueCapacity(true)).toBe(PUBLIC_LEAGUE_MAX_MEMBERS);
    expect(PUBLIC_LEAGUE_MAX_MEMBERS).toBe(200);
    expect(leagueCapacity(false)).toBe(LEAGUE_MAX_MEMBERS);
  });
});
