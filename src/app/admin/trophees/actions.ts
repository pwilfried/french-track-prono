"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { awardSeasonTrophies, setTrophyWitness } from "@/application/trophies";
import { createSupabaseRankingRepository, createSupabaseTrophyRepository } from "@/infra";

import { currentCompetitionDay } from "../../competition";
import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type WitnessState = { error?: ErrorCode; outcome?: "saved" | "cleared" };
export type AwardState = { error?: ErrorCode; awarded?: { season: number; count: number } };

/** Sets the FrenchTrack account of the Témoin d'or (#807), by its pseudo; empty: none. */
export async function setWitnessAction(_: WitnessState, data: FormData): Promise<WitnessState> {
  const { client } = await adminOnly();
  try {
    const outcome = await setTrophyWitness({
      trophies: createSupabaseTrophyRepository(client),
    }).execute({ pseudo: formText(data, "pseudo") });
    revalidatePath("/admin/trophees");
    return { outcome };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

/** Draws the trophies of a season again (#822): they replace the previous ones. */
export async function awardTrophiesAction(_: AwardState, data: FormData): Promise<AwardState> {
  const { client } = await adminOnly();
  const season = Number(formText(data, "season"));
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    return { error: "TROPHIES_UNAVAILABLE" };
  }
  try {
    const trophies = await awardSeasonTrophies({
      trophies: createSupabaseTrophyRepository(client),
      ranking: createSupabaseRankingRepository(client),
      today: currentCompetitionDay,
    }).execute({ season });
    revalidatePath("/profil");
    return { awarded: { season, count: trophies.length } };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}
