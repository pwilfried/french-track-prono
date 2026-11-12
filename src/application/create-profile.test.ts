import { describe, expect, it } from "vitest";

import { createProfile, type Profile, type ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";
import { getProfile } from "./get-profile";
import { updateProfile } from "./update-profile";

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
    async update(userId, change) {
      const taken = [...all.values()].some(
        (p) => p.userId !== userId && p.pseudo.toLowerCase() === change.pseudo.toLowerCase(),
      );
      if (taken) return "pseudo_taken";
      const mine = all.get(userId);
      if (mine) all.set(userId, { ...mine, ...change });
      return "updated";
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
const valid = {
  userId: "u1",
  pseudo: "Foulée_Bleue",
  bibNumber: "42",
  bibColor: "red",
  ageConfirmed: true,
};

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
      bib: { number: 42, color: "red" },
      ageConfirmedAt: now,
    });
  });

  it("lets a newcomer play with a pseudo, a bib and the age box alone", async () => {
    // given a newcomer on the express profile, with nothing else filled in (#539)
    const { create, get } = setup();
    // when they give only their pseudo, keep the drawn bib and tick the age box
    await create.execute({
      userId: "u1",
      pseudo: "Gazelle",
      bibNumber: "7",
      bibColor: "gold",
      ageConfirmed: true,
    });
    // then they have a profile: sex, disciplines and club wait for « Modifier mon profil »
    expect(await get.execute({ userId: "u1" })).toMatchObject({ pseudo: "Gazelle" });
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

  it("refuses a bib number outside 0 to 999 or a colour outside the six", async () => {
    const { create } = setup();

    expect(await codeOf(create.execute({ ...valid, bibNumber: "1000" }))).toBe(
      "BIB_NUMBER_INVALID",
    );
    expect(await codeOf(create.execute({ ...valid, bibColor: "pink" }))).toBe("BIB_COLOR_INVALID");
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

describe("a player changes their pseudo and bib", () => {
  async function withTwoPlayers() {
    const profiles = fakeProfiles();
    const create = createProfile({ profiles });
    await create.execute({ ...valid, userId: "u1", pseudo: "Gazelle" });
    await create.execute({ ...valid, userId: "u2", pseudo: "Guépard" });
    return profiles;
  }

  it("saves a new pseudo and bib", async () => {
    // given a player with a profile, when they pick a new pseudo and the gold bib 7
    const profiles = await withTwoPlayers();
    await updateProfile({ profiles }).execute({
      userId: "u1",
      pseudo: " Antilope ",
      bibNumber: "7",
      bibColor: "gold",
    });
    // then their profile shows them
    expect(await profiles.find("u1")).toMatchObject({
      pseudo: "Antilope",
      bib: { number: 7, color: "gold" },
    });
  });

  it("lets two players wear the same bib", async () => {
    const profiles = await withTwoPlayers();
    await updateProfile({ profiles }).execute({
      userId: "u2",
      pseudo: "Guépard",
      bibNumber: "42",
      bibColor: "red",
    });
    expect((await profiles.find("u2"))?.bib).toEqual((await profiles.find("u1"))?.bib);
  });

  it.each([
    [{ pseudo: "guépard" }, "PSEUDO_TAKEN"],
    [{ pseudo: "SuperConnard" }, "PSEUDO_BANNED"],
    [{ pseudo: "x" }, "PSEUDO_INVALID"],
    [{ bibNumber: "007" }, "BIB_NUMBER_INVALID"],
    [{ bibColor: "🍕" }, "BIB_COLOR_INVALID"],
  ])("refuses %j with %s", async (change, code) => {
    const profiles = await withTwoPlayers();
    await expect(
      updateProfile({ profiles }).execute({
        userId: "u1",
        pseudo: "Gazelle",
        bibNumber: "12",
        bibColor: "blue",
        ...change,
      }),
    ).rejects.toEqual(new UseCaseError(code as never));
  });
});
