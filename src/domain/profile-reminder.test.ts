import { describe, expect, it } from "vitest";

import type { Discipline } from "./discipline";
import {
  COMPLETE_LATER_DAYS,
  PROFILE_FAMILIES,
  completeLaterUntil,
  disciplinesOfFamilies,
  isProfileIncomplete,
  shouldAskToCompleteProfile,
} from "./profile-reminder";

const now = new Date("2026-11-12T08:00:00.000Z");

const known: Pick<Discipline, "name" | "family">[] = [
  { name: "100 m", family: "sprint" },
  { name: "200 m", family: "sprint" },
  { name: "100 m haies", family: "hurdles" },
  { name: "800 m", family: "middle" },
  { name: "10 000 m", family: "long" },
  { name: "Longueur", family: "horizontal_jumps" },
  { name: "Perche", family: "vertical_jumps" },
  { name: "Disque", family: "throws" },
  { name: "Décathlon", family: "combined" },
  { name: "4 x 100 m", family: "relay" },
];

describe("isProfileIncomplete", () => {
  it("is incomplete with neither a club nor a discipline", () => {
    expect(isProfileIncomplete({ hasClub: false, disciplines: [] })).toBe(true);
  });

  it("is complete with a club only", () => {
    expect(isProfileIncomplete({ hasClub: true, disciplines: [] })).toBe(false);
  });

  it("is complete with a discipline only", () => {
    expect(isProfileIncomplete({ hasClub: false, disciplines: ["800 m"] })).toBe(false);
  });
});

describe("completeLaterUntil", () => {
  it("hides the reminder for 30 days", () => {
    expect(COMPLETE_LATER_DAYS).toBe(30);
    expect(completeLaterUntil(now).toISOString()).toBe("2026-12-12T08:00:00.000Z");
  });
});

describe("shouldAskToCompleteProfile", () => {
  const incomplete = { hasClub: false, disciplines: [] };

  it("asks a player whose profile is incomplete", () => {
    expect(shouldAskToCompleteProfile({ ...incomplete, hiddenUntil: null }, now)).toBe(true);
  });

  it("does not ask a player whose profile is complete", () => {
    expect(
      shouldAskToCompleteProfile({ hasClub: true, disciplines: [], hiddenUntil: null }, now),
    ).toBe(false);
  });

  it("does not ask while « Plus tard » still hides the reminder", () => {
    const hiddenUntil = completeLaterUntil(new Date("2026-11-01T08:00:00.000Z"));
    expect(shouldAskToCompleteProfile({ ...incomplete, hiddenUntil }, now)).toBe(false);
  });

  it("asks again once the 30 days are over", () => {
    const hiddenUntil = completeLaterUntil(new Date("2026-10-13T08:00:00.000Z"));
    expect(shouldAskToCompleteProfile({ ...incomplete, hiddenUntil }, now)).toBe(true);
  });
});

describe("disciplinesOfFamilies", () => {
  it("offers six families, from sprint to combined events", () => {
    expect(PROFILE_FAMILIES.map((f) => f.family)).toEqual([
      "sprint",
      "hurdles",
      "middle_distance",
      "jumps",
      "throws",
      "combined",
    ]);
  });

  it("gives every discipline of a chosen family", () => {
    expect(disciplinesOfFamilies(["sprint"], known)).toEqual(["100 m", "200 m"]);
  });

  it("puts middle and long distance together, and every jump together", () => {
    expect(disciplinesOfFamilies(["middle_distance", "jumps"], known)).toEqual([
      "800 m",
      "10 000 m",
      "Longueur",
      "Perche",
    ]);
  });

  it("never gives a relay, and ignores unknown families", () => {
    const all = PROFILE_FAMILIES.map((f) => f.family);
    expect(disciplinesOfFamilies([...all, "relay", "golf"], known)).not.toContain("4 x 100 m");
    expect(disciplinesOfFamilies(["golf"], known)).toEqual([]);
  });
});
