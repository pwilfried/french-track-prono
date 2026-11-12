"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { saveMyLineup } from "@/application/manager-lineup";
import { createSupabaseManagerLineups } from "@/infra";

import { getSessionClient } from "../session";
import { managerAccess } from "./data";

/** Validates the player's lineup for an eligible competition, or changes it until the lock (#427). */
export async function saveLineupAction(input: {
  leagueId: string;
  competitionId: string;
  slug: string;
  athleteIds: string[];
}): Promise<{ error?: ErrorCode }> {
  const { leagueId, competitionId, slug, athleteIds } = input;
  if (!(await managerAccess(`/manager/${leagueId}/alignement/${slug}`))) {
    return { error: "MANAGER_CLOSED" };
  }
  const ports = { lineups: createSupabaseManagerLineups(await getSessionClient()) };
  try {
    await saveMyLineup(ports).execute({ leagueId, competitionId, athleteIds });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${leagueId}/alignement`);
  revalidatePath(`/manager/${leagueId}/alignement/${slug}`);
  return {};
}
