import { describe, expect, it } from "vitest";

import { matchesClub } from "@/domain/club";

import { searchClubs, type Club, type ClubDirectory } from "./clubs";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeClubs(clubs: Omit<Club, "id" | "validated">[]): ClubDirectory {
  const all = clubs.map((club, i) => ({ ...club, id: String(i), validated: true }));
  return {
    async search(query, limit) {
      return all.filter((club) => matchesClub(query, club)).slice(0, limit);
    },
  };
}

const clubs = fakeClubs([
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
