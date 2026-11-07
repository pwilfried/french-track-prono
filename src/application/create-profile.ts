import { isAvatar, validatePseudo } from "@/domain/profile";
import type { Avatar } from "@/domain/profile";

import { UseCaseError } from "./errors";

export type Profile = { userId: string; pseudo: string; avatar: Avatar; ageConfirmedAt: Date };

/** Port: where profiles are stored. Real adapter = Supabase, fake = in memory. */
export interface ProfileRepository {
  find(userId: string): Promise<Profile | null>;
  /** True for an admin (designated from SQL only); false for a player or an unknown user. */
  isAdmin(userId: string): Promise<boolean>;
  /** Saves a new profile. Returns why it could not, instead of throwing, for the two expected cases. */
  create(profile: Profile): Promise<"created" | "pseudo_taken" | "profile_exists">;
}

export type CreateProfileInput = {
  userId: string;
  pseudo: string;
  avatar: string;
  ageConfirmed: boolean;
};

export function createProfile(ports: { profiles: ProfileRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: CreateProfileInput): Promise<Profile> {
      if (!input.ageConfirmed) throw new UseCaseError("AGE_NOT_CONFIRMED");
      const pseudo = validatePseudo(input.pseudo);
      if (!pseudo.ok) throw new UseCaseError(pseudo.code);
      if (!isAvatar(input.avatar)) throw new UseCaseError("AVATAR_INVALID");

      const profile: Profile = {
        userId: input.userId,
        pseudo: pseudo.pseudo,
        avatar: input.avatar,
        ageConfirmedAt: now(),
      };
      const outcome = await ports.profiles.create(profile);
      if (outcome === "pseudo_taken") throw new UseCaseError("PSEUDO_TAKEN");
      if (outcome === "profile_exists") throw new UseCaseError("PROFILE_EXISTS");
      return profile;
    },
  };
}
