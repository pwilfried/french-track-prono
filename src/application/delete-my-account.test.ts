import { describe, expect, it } from "vitest";

import type { Profile, ProfileRepository } from "./create-profile";
import { deleteMyAccount } from "./delete-my-account";
import { UseCaseError } from "./errors";

const anna: Profile = {
  userId: "anna",
  pseudo: "Anna",
  avatar: "🦅",
  ageConfirmedAt: new Date("2026-11-07T10:00:00Z"),
};

function profiles(): ProfileRepository {
  const byUser = new Map([[anna.userId, anna]]);
  return {
    find: async (userId) => byUser.get(userId) ?? null,
    isAdmin: async () => false,
    create: async () => "created",
    update: async () => "updated",
    deleteMine: async (userId) => void byUser.delete(userId),
  };
}

describe("deleteMyAccount", () => {
  it("deletes my profile once I confirmed", async () => {
    const repository = profiles();

    await deleteMyAccount({ profiles: repository }).execute({ userId: "anna", confirmed: true });

    expect(await repository.find("anna")).toBeNull();
  });

  it("keeps my account and asks for DELETION_NOT_CONFIRMED when I did not confirm", async () => {
    const repository = profiles();

    await expect(
      deleteMyAccount({ profiles: repository }).execute({ userId: "anna", confirmed: false }),
    ).rejects.toEqual(new UseCaseError("DELETION_NOT_CONFIRMED"));
    expect(await repository.find("anna")).toEqual(anna);
  });
});
