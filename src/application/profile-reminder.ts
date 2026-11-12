import {
  completeLaterUntil,
  disciplinesOfFamilies,
  shouldAskToCompleteProfile,
} from "@/domain/profile-reminder";

import type { ClubDirectory } from "./clubs";
import type { DisciplineRepository } from "./disciplines";
import { UseCaseError } from "./errors";
import { savePlayerDetails, type PlayerDetailsRepository } from "./player-details";

/** Port: until when « Plus tard » hides the card (#540). Real adapter = Supabase, fake = in memory. */
export interface ProfileReminderRepository {
  /** Null when the player never pressed « Plus tard ». */
  hiddenUntil(userId: string): Promise<Date | null>;
  hideUntil(userId: string, until: Date): Promise<void>;
}

/** Whether the home shows « Complète ton profil » to the player. */
export function askToCompleteProfile(ports: {
  details: PlayerDetailsRepository;
  reminders: ProfileReminderRepository;
}) {
  return {
    async execute(input: { userId: string; now: Date }): Promise<boolean> {
      const [details, hiddenUntil] = await Promise.all([
        ports.details.find(input.userId),
        ports.reminders.hiddenUntil(input.userId),
      ]);
      return shouldAskToCompleteProfile(
        { hasClub: details.club !== null, disciplines: details.disciplines, hiddenUntil },
        input.now,
      );
    },
  };
}

/** « Plus tard »: the card is hidden for 30 days, on every device of the player. */
export function completeProfileLater(ports: { reminders: ProfileReminderRepository }) {
  return {
    execute: (input: { userId: string; now: Date }): Promise<void> =>
      ports.reminders.hideUntil(input.userId, completeLaterUntil(input.now)),
  };
}

export type CompleteProfileInput = {
  userId: string;
  /** A club picked in the list, or "". */
  clubId: string;
  /** A club typed because it is not in the list, or "". */
  newClubName: string;
  newClubCity: string;
  /** Profile families (sprint, hurdles…): each saves all of its disciplines. */
  families: string[];
};

/** The card sends a club and families; what the player already told is kept. */
export function completeProfile(ports: {
  details: PlayerDetailsRepository;
  clubs: ClubDirectory;
  disciplines: DisciplineRepository;
}) {
  return {
    async execute(input: CompleteProfileInput): Promise<void> {
      const [current, known] = await Promise.all([
        ports.details.find(input.userId),
        ports.disciplines.list(),
      ]);
      const chosen = disciplinesOfFamilies(input.families, known);
      const clubId = input.clubId.trim() || current.club?.id || "";
      if (chosen.length === 0 && clubId === "" && input.newClubName.trim() === "") {
        throw new UseCaseError("PROFILE_DETAILS_EMPTY");
      }
      await savePlayerDetails(ports).execute({
        userId: input.userId,
        sex: current.sex ?? "",
        disciplines: [...current.disciplines, ...chosen],
        clubId,
        newClubName: input.newClubName,
        newClubCity: input.newClubCity,
      });
    },
  };
}
