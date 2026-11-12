import { validateBib } from "@/domain/bib";
import { validatePseudo } from "@/domain/profile";

import type { ProfileRepository } from "./create-profile";
import { UseCaseError } from "./errors";

/** The player changes their pseudo and bib from their profile (#341, #537). */
export function updateProfile(ports: { profiles: ProfileRepository }) {
  return {
    async execute(input: {
      userId: string;
      pseudo: string;
      bibNumber: string;
      bibColor: string;
    }): Promise<void> {
      const pseudo = validatePseudo(input.pseudo);
      if (!pseudo.ok) throw new UseCaseError(pseudo.code);
      const bib = validateBib(input.bibNumber, input.bibColor);
      if (!bib.ok) throw new UseCaseError(bib.code);
      const outcome = await ports.profiles.update(input.userId, {
        pseudo: pseudo.pseudo,
        bib: bib.bib,
      });
      if (outcome === "pseudo_taken") throw new UseCaseError("PSEUDO_TAKEN");
    },
  };
}
