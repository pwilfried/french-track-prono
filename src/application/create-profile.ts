import { validateBib, type Bib } from "@/domain/bib";
import { validatePseudo } from "@/domain/profile";

import { UseCaseError } from "./errors";

export type Profile = { userId: string; pseudo: string; bib: Bib; ageConfirmedAt: Date };

/** Port: where profiles are stored. Real adapter = Supabase, fake = in memory. */
export interface ProfileRepository {
  find(userId: string): Promise<Profile | null>;
  /** True for an admin (designated from SQL only); false for a player or an unknown user. */
  isAdmin(userId: string): Promise<boolean>;
  /** Saves a new profile. Returns why it could not, instead of throwing, for the two expected cases. */
  create(profile: Profile): Promise<"created" | "pseudo_taken" | "profile_exists">;
  /** Changes the signed-in player's pseudo and bib (#341, #537). */
  update(userId: string, change: { pseudo: string; bib: Bib }): Promise<"updated" | "pseudo_taken">;
  /** Deletes the signed-in player's account and everything attached to it (F13). */
  deleteMine(userId: string): Promise<void>;
}

export type CreateProfileInput = {
  userId: string;
  pseudo: string;
  /** As typed in the form: 0 to 999, no leading zero. */
  bibNumber: string;
  bibColor: string;
  ageConfirmed: boolean;
};

export function createProfile(ports: { profiles: ProfileRepository; now?: () => Date }) {
  const now = ports.now ?? (() => new Date());
  return {
    async execute(input: CreateProfileInput): Promise<Profile> {
      if (!input.ageConfirmed) throw new UseCaseError("AGE_NOT_CONFIRMED");
      const pseudo = validatePseudo(input.pseudo);
      if (!pseudo.ok) throw new UseCaseError(pseudo.code);
      const bib = validateBib(input.bibNumber, input.bibColor);
      if (!bib.ok) throw new UseCaseError(bib.code);

      const profile: Profile = {
        userId: input.userId,
        pseudo: pseudo.pseudo,
        bib: bib.bib,
        ageConfirmedAt: now(),
      };
      const outcome = await ports.profiles.create(profile);
      if (outcome === "pseudo_taken") throw new UseCaseError("PSEUDO_TAKEN");
      if (outcome === "profile_exists") throw new UseCaseError("PROFILE_EXISTS");
      return profile;
    },
  };
}
