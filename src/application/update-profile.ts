import { isAvatar, validatePseudo } from "@/domain/profile";

import type { ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";

/** The player changes their pseudo and avatar from their profile (#341). */
export function updateProfile(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: { userId: string; pseudo: string; avatar: string }): Promise<void> {
      const pseudo = validatePseudo(input.pseudo);
      if (!pseudo.ok) throw new UseCaseError(pseudo.code);
      if (!isAvatar(input.avatar)) throw new UseCaseError("AVATAR_INVALID");
      const outcome = await ports.profiles.update(input.userId, {
        pseudo: pseudo.pseudo,
        avatar: input.avatar,
      });
      if (outcome === "pseudo_taken") throw new UseCaseError("PSEUDO_TAKEN");
    },
  };
}
