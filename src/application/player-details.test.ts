import { describe, expect, it } from "vitest";

import type { Club, ClubDirectory } from "./clubs";
import type { DisciplineRepository } from "./disciplines";
import { UseCaseError } from "./errors";
import {
  checkPlayerDetails,
  getPlayerDetails,
  savePlayerDetails,
  type PlayerDetails,
} from "./player-details";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function world() {
  const clubs: Club[] = [
    { id: "c1", name: "US Créteil", city: "Créteil", department: "94", validated: true },
  ];
  const saved = new Map<string, PlayerDetails>();
  const directory: ClubDirectory = {
    async search() {
      return clubs;
    },
    async propose(name, city) {
      const club = { id: `c${clubs.length + 1}`, name, city, department: "", validated: false };
      clubs.push(club);
      return club;
    },
  };
  const disciplines: DisciplineRepository = {
    async list() {
      return ["100 m", "200 m", "400 m", "Saut en hauteur"].map((name) => ({
        name,
        family: name.startsWith("Saut") ? "vertical_jumps" : "sprint",
        unit: name.startsWith("Saut") ? "distance" : "time",
        lowerIsBetter: !name.startsWith("Saut"),
        tolerance: 0.05,
      }));
    },
    async setTolerance() {
      return "not_admin";
    },
    async create() {
      return "not_admin";
    },
  };
  return {
    clubs,
    ports: {
      clubs: directory,
      disciplines,
      details: {
        async find(userId: string) {
          return saved.get(userId) ?? { sex: null, disciplines: [], club: null };
        },
        async save(
          userId: string,
          d: { sex: "F" | "M" | null; disciplines: string[]; clubId: string | null },
        ) {
          const club = clubs.find((c) => c.id === d.clubId) ?? null;
          if (d.clubId && !club) return "unknown_club" as const;
          saved.set(userId, { sex: d.sex, disciplines: d.disciplines, club });
          return "saved" as const;
        },
      },
    },
  };
}

const empty = { sex: "", disciplines: [], clubId: "", newClubName: "", newClubCity: "" };

describe("a new player tells their sex, disciplines and club", () => {
  it("saves sex, two sprint disciplines and a club found in the list", async () => {
    // given a player who just created their profile
    const w = world();
    // when they pick Femme, 100 m and 200 m, and US Créteil
    await savePlayerDetails(w.ports).execute({
      ...empty,
      userId: "u1",
      sex: "F",
      disciplines: ["100 m", "200 m"],
      clubId: "c1",
    });
    // then their profile holds them
    expect(await getPlayerDetails(w.ports).execute({ userId: "u1" })).toEqual({
      sex: "F",
      disciplines: ["100 m", "200 m"],
      club: expect.objectContaining({ name: "US Créteil" }),
    });
  });

  it("lets the player give nothing", async () => {
    const w = world();
    await savePlayerDetails(w.ports).execute({ ...empty, userId: "u1" });
    expect(await getPlayerDetails(w.ports).execute({ userId: "u1" })).toEqual({
      sex: null,
      disciplines: [],
      club: null,
    });
  });

  it("saves a club the player typed, to validate", async () => {
    const w = world();
    await savePlayerDetails(w.ports).execute({
      ...empty,
      userId: "u1",
      clubId: "c1",
      newClubName: "  Les Foulées  de Sceaux ",
      newClubCity: "Sceaux",
    });
    const details = await getPlayerDetails(w.ports).execute({ userId: "u1" });
    expect(details.club).toMatchObject({ name: "Les Foulées de Sceaux", validated: false });
  });

  it("drops unknown disciplines", async () => {
    const w = world();
    await savePlayerDetails(w.ports).execute({
      ...empty,
      userId: "u1",
      disciplines: ["Course en sac", "400 m"],
    });
    expect((await getPlayerDetails(w.ports).execute({ userId: "u1" })).disciplines).toEqual([
      "400 m",
    ]);
  });

  it.each([
    [{ sex: "X" }, "SEX_INVALID"],
    [{ newClubName: "Club Officiel FFA" }, "CLUB_NAME_BANNED"],
    [{ newClubName: "A" }, "CLUB_NAME_INVALID"],
    [{ clubId: "gone" }, "CLUB_UNKNOWN"],
  ])("refuses %j with %s", async (input, code) => {
    const w = world();
    await expect(
      savePlayerDetails(w.ports).execute({ ...empty, userId: "u1", ...input }),
    ).rejects.toEqual(new UseCaseError(code as never));
  });

  it("checks what needs no database before the profile is created", () => {
    expect(checkPlayerDetails({ ...empty, newClubName: "Les Connards" })).toBe("CLUB_NAME_BANNED");
    expect(checkPlayerDetails({ ...empty, newClubName: "Club", newClubCity: "monclub.fr" })).toBe(
      "CLUB_NAME_BANNED",
    );
    expect(checkPlayerDetails({ ...empty, sex: "F" })).toBeNull();
  });
});
