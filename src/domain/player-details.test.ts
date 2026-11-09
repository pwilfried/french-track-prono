import { describe, expect, it } from "vitest";

import { parseSex, pickDisciplines, validateClubName } from "./player-details";

describe("parseSex", () => {
  it.each([
    ["F", "F"],
    ["M", "M"],
    ["", null],
    ["X", "invalid"],
  ])("reads %j as %j", (input, sex) => expect(parseSex(input)).toBe(sex));
});

describe("validateClubName", () => {
  it("trims and keeps a club name", () =>
    expect(validateClubName("  Les  Foulées de Sceaux ")).toEqual({
      ok: true,
      name: "Les Foulées de Sceaux",
    }));
  it.each(["", "A", "x".repeat(121)])("refuses %j as invalid", (name) =>
    expect(validateClubName(name)).toEqual({ ok: false, code: "CLUB_NAME_INVALID" }),
  );
  it.each(["Club Officiel FFA", "Les Connards", "monclub.fr"])("refuses %j as banned", (name) =>
    expect(validateClubName(name)).toEqual({ ok: false, code: "CLUB_NAME_BANNED" }),
  );
});

describe("pickDisciplines", () => {
  it("keeps known disciplines once, in order", () =>
    expect(
      pickDisciplines(["200 m", "100 m", "200 m", "Course en sac"], ["100 m", "200 m"]),
    ).toEqual(["200 m", "100 m"]));
});
