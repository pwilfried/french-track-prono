import { describe, expect, it } from "vitest";

import type { Discipline } from "@/domain/discipline";

import type { Club, ClubDirectory } from "./clubs";
import type { DisciplineRepository } from "./disciplines";
import { UseCaseError } from "./errors";
import type { PlayerDetails, PlayerDetailsRepository } from "./player-details";
import {
  askToCompleteProfile,
  completeProfile,
  completeProfileLater,
  type ProfileReminderRepository,
} from "./profile-reminder";

const now = new Date("2026-11-12T08:00:00.000Z");
const later = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

// Application tests do not import the infra layer: a few lines of fake are enough here.
function world(start: Partial<PlayerDetails> = {}) {
  const clubs: Club[] = [
    { id: "c1", name: "US Créteil", city: "Créteil", department: "94", validated: true },
  ];
  let mine: PlayerDetails = { sex: null, disciplines: [], club: null, ...start };
  let hiddenUntil: Date | null = null;
  const known: Discipline[] = (
    [
      ["100 m", "sprint"],
      ["200 m", "sprint"],
      ["800 m", "middle"],
      ["Perche", "vertical_jumps"],
      ["4 x 100 m", "relay"],
    ] as const
  ).map(([name, family]) => ({
    name,
    family,
    unit: "time",
    lowerIsBetter: true,
    tolerance: 0.05,
  }));
  const details: PlayerDetailsRepository = {
    async find() {
      return mine;
    },
    async save(_, d) {
      const club = clubs.find((c) => c.id === d.clubId) ?? null;
      if (d.clubId && !club) return "unknown_club";
      mine = { sex: d.sex, disciplines: d.disciplines, club };
      return "saved";
    },
  };
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
    list: async () => known,
    setTolerance: async () => "not_admin",
    create: async () => "not_admin",
  };
  const reminders: ProfileReminderRepository = {
    hiddenUntil: async () => hiddenUntil,
    async hideUntil(_, until) {
      hiddenUntil = until;
    },
  };
  return {
    ports: { details, clubs: directory, disciplines, reminders },
    mine: () => mine,
  };
}

const card = { clubId: "", newClubName: "", newClubCity: "", families: [] as string[] };

describe("a player with an incomplete profile is asked to complete it from the home", () => {
  it("asks a player with neither a club nor a discipline", async () => {
    // given a player who signed up with the express profile
    const w = world();
    // when the home asks whether to show the card
    // then it shows
    expect(await askToCompleteProfile(w.ports).execute({ userId: "u1", now })).toBe(true);
  });

  it("does not ask a player who already gave their club", async () => {
    // given a player with a club
    const w = world({
      club: { id: "c1", name: "US Créteil", city: "", department: "", validated: true },
    });
    // then the card stays hidden
    expect(await askToCompleteProfile(w.ports).execute({ userId: "u1", now })).toBe(false);
  });

  it("hides the card for 30 days after « Plus tard », then asks again", async () => {
    // given an incomplete profile
    const w = world();
    // when the player presses « Plus tard »
    await completeProfileLater(w.ports).execute({ userId: "u1", now });
    // then the card is hidden 29 days later, and back 30 days later
    expect(await askToCompleteProfile(w.ports).execute({ userId: "u1", now: later(29) })).toBe(
      false,
    );
    expect(await askToCompleteProfile(w.ports).execute({ userId: "u1", now: later(30) })).toBe(
      true,
    );
  });

  it("saves every discipline of the chosen families and the club, then stops asking", async () => {
    // given an incomplete profile
    const w = world({ sex: "F" });
    // when the player picks US Créteil, sprint and middle distance
    await completeProfile(w.ports).execute({
      ...card,
      userId: "u1",
      clubId: "c1",
      families: ["sprint", "middle_distance"],
    });
    // then the club and every discipline of those families are saved, the sex kept
    expect(w.mine()).toEqual({
      sex: "F",
      disciplines: ["100 m", "200 m", "800 m"],
      club: expect.objectContaining({ id: "c1" }),
    });
    expect(await askToCompleteProfile(w.ports).execute({ userId: "u1", now })).toBe(false);
  });

  it("saves a club the player typed because it is missing", async () => {
    const w = world();
    await completeProfile(w.ports).execute({
      ...card,
      userId: "u1",
      newClubName: "Les Foulées de Nulle-Part",
      newClubCity: "Nulle-Part",
    });
    expect(w.mine().club).toMatchObject({ name: "Les Foulées de Nulle-Part", validated: false });
  });

  it("refuses a card sent with nothing chosen", async () => {
    const w = world();
    await expect(completeProfile(w.ports).execute({ ...card, userId: "u1" })).rejects.toThrowError(
      new UseCaseError("PROFILE_DETAILS_EMPTY"),
    );
  });
});
