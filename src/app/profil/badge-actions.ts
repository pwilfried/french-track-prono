"use server";

import { UseCaseError } from "@/application/errors";
import { markBadgesSeen } from "@/application/get-my-badges";

import { seasonCompetitionSlugs } from "../competition";
import { getCurrentUser, getSessionClient } from "../session";
import { badgePorts } from "./badge-ports";

/**
 * The player has seen the hare's celebration (#821): the levels won are stored, so it is not
 * shown again. When they cannot be stored, it simply comes back on the next visit.
 */
export async function markBadgesSeenAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await markBadgesSeen(badgePorts(await getSessionClient())).execute({
      userId: user.userId,
      competitionSlugs: await seasonCompetitionSlugs(),
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
  }
}
