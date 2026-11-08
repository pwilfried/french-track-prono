import { describe, expect, it } from "vitest";

import type { ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";
import { requireAdmin } from "./require-admin";

const profiles = (admins: string[]): ProfileRepository => ({
  find: async () => null,
  create: async () => "created",
  isAdmin: async (userId) => admins.includes(userId),
  deleteMine: async () => {},
});

describe("requireAdmin", () => {
  it("lets an admin through", async () => {
    await expect(
      requireAdmin({ profiles: profiles(["boss"]) }).execute({ userId: "boss" }),
    ).resolves.toBeUndefined();
  });

  it("refuses a player with NOT_ADMIN", async () => {
    await expect(
      requireAdmin({ profiles: profiles(["boss"]) }).execute({ userId: "me" }),
    ).rejects.toEqual(new UseCaseError("NOT_ADMIN"));
  });
});
