"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { saveMyLineup } from "@/application/manager-lineup";
import type { MatchSheet } from "@/domain/manager-lineup";
import { createSupabaseManagerLineups } from "@/infra";

import { getSessionClient } from "../session";
import { managerPorts } from "./data";

/**
 * Validates the player's match sheet for an eligible competition, or changes it until the lock
 * (#427, #1035): starters, bench in order, disciplines, substitutes and thresholds.
 */
export async function saveLineupAction(input: {
  leagueId: string;
  competitionId: string;
  slug: string;
  sheet: MatchSheet;
}): Promise<{ error?: ErrorCode }> {
  const { leagueId, competitionId, slug, sheet } = input;
  await managerPorts(`/manager/${leagueId}/alignement/${slug}`);
  const ports = { lineups: createSupabaseManagerLineups(await getSessionClient()) };
  try {
    await saveMyLineup(ports).execute({ leagueId, competitionId, sheet });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${leagueId}/alignement`);
  revalidatePath(`/manager/${leagueId}/alignement/${slug}`);
  return {};
}
