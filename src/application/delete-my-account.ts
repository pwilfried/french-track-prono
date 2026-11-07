import type { ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";

/** F13: the player deletes his account and everything attached to it, once he confirmed. */
export function deleteMyAccount(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string; confirmed: boolean }): Promise<void> {
      if (!input.confirmed) throw new UseCaseError("DELETION_NOT_CONFIRMED");
      await ports.profiles.deleteMine(input.userId);
    },
  };
}
