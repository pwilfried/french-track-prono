import { describe, expect, it } from "vitest";

import {
  LEAGUE_FAMILIES,
  addableFamilies,
  countsForFamilies,
  countsOnceAdded,
  inScreenOrder,
  leagueFamilyOf,
  validateLeagueFamilies,
  type LeagueFamilyRule,
} from "./league-families";

const created = (...families: LeagueFamilyRule["family"][]): LeagueFamilyRule[] =>
  families.map((family) => ({ family, addedAt: null }));

describe("league families", () => {
  it("lists the eight families in the order of the creation screen", () => {
    expect(LEAGUE_FAMILIES).toEqual([
      "sprint",
      "hurdles",
      "middle",
      "long",
      "jumps",
      "throws",
      "combined",
      "relay",
    ]);
  });

  it("puts both kinds of jumps in the jumps family", () => {
    expect(leagueFamilyOf("horizontal_jumps")).toBe("jumps");
    expect(leagueFamilyOf("vertical_jumps")).toBe("jumps");
    expect(leagueFamilyOf("sprint")).toBe("sprint");
    expect(leagueFamilyOf("relay")).toBe("relay");
  });

  it("counts every event in a league on all events", () => {
    expect(countsForFamilies([], { family: "throws", startsAt: "2026-09-12T18:00:00Z" })).toBe(
      true,
    );
    expect(countsForFamilies([], { startsAt: "2026-09-12T18:00:00Z" })).toBe(true);
  });

  it("counts only the events of the families chosen at creation", () => {
    const sprint = created("sprint");
    expect(countsForFamilies(sprint, { family: "sprint", startsAt: "2026-09-12T18:00:00Z" })).toBe(
      true,
    );
    expect(countsForFamilies(sprint, { family: "throws", startsAt: "2026-09-12T18:00:00Z" })).toBe(
      false,
    );
  });

  it("leaves out an event of unknown family in a league on some families", () => {
    expect(countsForFamilies(created("sprint"), { startsAt: "2026-09-12T18:00:00Z" })).toBe(false);
  });

  it("counts an added family only for the events that start after it was added", () => {
    const rules: LeagueFamilyRule[] = [
      { family: "sprint", addedAt: null },
      { family: "throws", addedAt: "2026-09-12T12:00:00Z" },
    ];
    expect(countsForFamilies(rules, { family: "throws", startsAt: "2026-09-12T18:00:00Z" })).toBe(
      true,
    );
    expect(countsForFamilies(rules, { family: "throws", startsAt: "2026-09-12T12:00:00Z" })).toBe(
      false,
    );
    expect(countsForFamilies(rules, { family: "throws", startsAt: "2026-09-11T18:00:00Z" })).toBe(
      false,
    );
  });

  it("says which events of a family would count if it were added now", () => {
    const now = "2026-09-12T12:00:00Z";
    expect(countsOnceAdded("2026-09-12T18:00:00Z", now)).toBe(true);
    expect(countsOnceAdded("2026-09-12T12:00:00Z", now)).toBe(false);
    expect(countsOnceAdded("2026-09-11T18:00:00Z", now)).toBe(false);
  });

  it("offers the families not chosen yet, none in a league on all events", () => {
    expect(addableFamilies([])).toEqual([]);
    expect(addableFamilies(created("sprint", "hurdles"))).toEqual([
      "middle",
      "long",
      "jumps",
      "throws",
      "combined",
      "relay",
    ]);
    expect(addableFamilies(created(...LEAGUE_FAMILIES))).toEqual([]);
  });

  it("keeps known families once each, in the order of the screen", () => {
    expect(validateLeagueFamilies(["throws", "sprint", "throws"])).toEqual({
      ok: true,
      families: ["sprint", "throws"],
    });
    expect(validateLeagueFamilies([])).toEqual({ ok: true, families: [] });
  });

  it("puts families back in the order of the screen", () => {
    expect(inScreenOrder(created("relay", "sprint", "jumps")).map((r) => r.family)).toEqual([
      "sprint",
      "jumps",
      "relay",
    ]);
  });

  it("refuses an unknown family", () => {
    expect(validateLeagueFamilies(["sprint", "curling"])).toEqual({
      ok: false,
      code: "LEAGUE_FAMILY_INVALID",
    });
  });
});
