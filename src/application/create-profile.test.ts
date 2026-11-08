import { describe, expect, it } from "vitest";

import { createProfile, type Profile, type ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";
import { getProfile } from "./get-profile";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeProfiles(): ProfileRepository {
  const all = new Map<string, Profile>();
  return {
    async find(userId) {
      return all.get(userId) ?? null;
    },
    async isAdmin() {
      return false;
    },
    async create(profile) {
      if (all.has(profile.userId)) return "profile_exists";
      const taken = [...all.values()].some(
        (p) => p.pseudo.toLowerCase() === profile.pseudo.toLowerCase(),
      );
      if (taken) return "pseudo_taken";
      all.set(profile.userId, profile);
      return "created";
    },
    async deleteMine(userId) {
      all.delete(userId);
    },
  };
}

const now = new Date("2026-11-06T12:00:00Z");
const setup = () => {
  const profiles = fakeProfiles();
  return {
    profiles,
    create: createProfile({ profiles, now: () => now }),
    get: getProfile({ profiles }),
  };
};
const valid = { userId: "u1", pseudo: "Foulée_Bleue", avatar: "🦅", ageConfirmed: true };

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof UseCaseError) return error.code;
    throw error;
  }
  return null;
}

describe("CreateProfile", () => {
  it("creates a profile that GetProfile then returns", async () => {
    const { create, get } = setup();

    await create.execute(valid);

    expect(await get.execute({ userId: "u1" })).toEqual({
      userId: "u1",
      pseudo: "Foulée_Bleue",
      avatar: "🦅",
      ageConfirmedAt: now,
    });
  });

  it("cleans the pseudo before saving it", async () => {
    const { create } = setup();

    const profile = await create.execute({ ...valid, pseudo: "  Foulée   Bleue " });

    expect(profile.pseudo).toBe("Foulée Bleue");
  });

  it("refuses a profile when the age box is not ticked", async () => {
    const { create, get } = setup();

    expect(await codeOf(create.execute({ ...valid, ageConfirmed: false }))).toBe(
      "AGE_NOT_CONFIRMED",
    );
    expect(await get.execute({ userId: "u1" })).toBeNull();
  });

  it("refuses an invalid pseudo", async () => {
    const { create } = setup();

    expect(await codeOf(create.execute({ ...valid, pseudo: "a" }))).toBe("PSEUDO_INVALID");
    expect(await codeOf(create.execute({ ...valid, pseudo: "<b>" }))).toBe("PSEUDO_INVALID");
  });

  it("refuses an avatar outside the fixed list", async () => {
    const { create } = setup();

    expect(await codeOf(create.execute({ ...valid, avatar: "💩" }))).toBe("AVATAR_INVALID");
  });

  it("refuses a pseudo already taken, whatever the case", async () => {
    const { create } = setup();
    await create.execute(valid);

    expect(await codeOf(create.execute({ ...valid, userId: "u2", pseudo: "foulée_bleue" }))).toBe(
      "PSEUDO_TAKEN",
    );
  });

  it("refuses a second profile for the same player", async () => {
    const { create } = setup();
    await create.execute(valid);

    expect(await codeOf(create.execute({ ...valid, pseudo: "Autre" }))).toBe("PROFILE_EXISTS");
  });
});

describe("GetProfile", () => {
  it("returns null for a player without profile", async () => {
    const { get } = setup();

    expect(await get.execute({ userId: "nobody" })).toBeNull();
  });
});
