"use server";

import { UseCaseError } from "@/application/errors";
import { markTrophiesSeen } from "@/application/trophies";
import { createSupabaseTrophyRepository } from "@/infra";

import { getCurrentUser, getSessionClient } from "../session";

/**
 * The player has closed the celebration of their new trophies (#1135): they are stored as seen,
 * so it comes once. When they cannot be stored, it simply comes back on the next visit.
 */
export async function markTrophiesSeenAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await markTrophiesSeen({
      trophies: createSupabaseTrophyRepository(await getSessionClient()),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
  }
}
