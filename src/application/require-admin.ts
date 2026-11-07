import { UseCaseError } from "./errors";
import type { ProfileRepository } from "./create-profile";

/** Lets the back-office through for an admin only; anyone else gets NOT_ADMIN. */
export function requireAdmin(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string }): Promise<void> {
      if (!(await ports.profiles.isAdmin(input.userId))) throw new UseCaseError("NOT_ADMIN");
    },
  };
}
