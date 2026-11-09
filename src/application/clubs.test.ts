import { describe, expect, it } from "vitest";

import { createInMemoryClubDirectory } from "@/infra";

import { searchClubs } from "./clubs";

const clubs = createInMemoryClubDirectory([
  { name: "US Créteil Athlétisme", city: "Créteil", department: "94" },
  {
    name: "Athletic Club de Boulogne Billancourt (ACBB)",
    city: "Boulogne-Billancourt",
    department: "92",
  },
  { name: "Stade Français", city: "Paris", department: "75" },
]);

describe("a player looks for their club", () => {
  it("finds a club from a few letters, accents and case ignored", async () => {
    // given the imported clubs, when the player types "creteil"
    const found = await searchClubs({ clubs }).execute({ query: "creteil" });
    // then the club comes with its town
    expect(found).toEqual([
      expect.objectContaining({ name: "US Créteil Athlétisme", city: "Créteil", validated: true }),
    ]);
  });

  it("waits for two letters before searching", async () => {
    expect(await searchClubs({ clubs }).execute({ query: "c" })).toEqual([]);
    expect(await searchClubs({ clubs }).execute({ query: " é " })).toEqual([]);
  });

  it("finds a club by its town", async () => {
    const found = await searchClubs({ clubs }).execute({ query: "paris" });
    expect(found.map((c) => c.name)).toEqual(["Stade Français"]);
  });
});
