"use server";

import { searchClubs, type Club } from "@/application/clubs";
import { UseCaseError } from "@/application/errors";
import { createSupabaseClubDirectory } from "@/infra";

import { getSessionClient } from "./session";

/** Clubs matching what the player typed (#339), for the club picker. Empty on any trouble. */
export async function findClubsAction(query: string): Promise<Club[]> {
  try {
    return await searchClubs({
      clubs: createSupabaseClubDirectory(await getSessionClient()),
    }).execute({ query: String(query).slice(0, 80), limit: 8 });
  } catch (error) {
    if (error instanceof UseCaseError) return [];
    throw error;
  }
}
