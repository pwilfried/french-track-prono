import { describe, expect, it } from "vitest";

import type { Profile, ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";
import { lookUpProfile } from "./get-profile";

const profiles = (find: ProfileRepository["find"]) => ({ find }) as ProfileRepository;

describe("lookUpProfile", () => {
  it("returns the profile, or null when the player has none yet", async () => {
    const me = { userId: "me", pseudo: "Démo" } as unknown as Profile;
    const useCase = lookUpProfile({
      profiles: profiles(async (id) => (id === "me" ? me : null)),
    });
    expect(await useCase.execute({ userId: "me" })).toBe(me);
    expect(await useCase.execute({ userId: "other" })).toBeNull();
  });

  it("says unavailable when the profile cannot be read, so the page still loads", async () => {
    const useCase = lookUpProfile({
      profiles: profiles(async () => Promise.reject(new UseCaseError("PROFILE_UNAVAILABLE"))),
    });
    expect(await useCase.execute({ userId: "me" })).toBe("unavailable");
  });

  it("lets unknown errors through: they are bugs", async () => {
    const useCase = lookUpProfile({
      profiles: profiles(async () => Promise.reject(new Error("boom"))),
    });
    await expect(useCase.execute({ userId: "me" })).rejects.toThrow("boom");
  });
});
