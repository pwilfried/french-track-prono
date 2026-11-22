"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { savePredictionLeagues } from "@/application/prediction-leagues";
import { savePrediction } from "@/application/save-prediction";
import { DISCIPLINE_FAMILIES } from "@/domain/discipline";
import type { PodiumDraft } from "@/domain/podium-draft";
import {
  createSupabasePredictionLeagueRepository,
  createSupabasePredictionRepository,
} from "@/infra";

import { formText } from "../../form-data";
import { getCurrentUser, getSessionClient } from "../../session";

export type MarkTexts = { first: string; second: string; third: string };

export type PredictionState = {
  draft: PodiumDraft;
  useJoker: boolean;
  /** The marks as typed, kept when the save fails. */
  marks: MarkTexts;
  saved?: boolean;
  error?: ErrorCode;
};

export async function savePredictionAction(
  _: PredictionState,
  data: FormData,
): Promise<PredictionState> {
  const slug = formText(data, "slug");
  const text = (name: string) => formText(data, name) || null;
  const state: PredictionState = {
    draft: { first: text("first"), second: text("second"), third: text("third") },
    useJoker: data.get("joker") === "on",
    marks: {
      first: formText(data, "m1"),
      second: formText(data, "m2"),
      third: formText(data, "m3"),
    },
  };
  const unit = formText(data, "markUnit");
  const markUnit = (["time", "distance", "points"] as const).find((u) => u === unit);
  // Bounds the marks here for a clear message; the database checks them against the event anyway.
  const family = formText(data, "markFamily");
  const markFamily = DISCIPLINE_FAMILIES.find((f) => f === family);
  const markDiscipline = formText(data, "markDiscipline") || undefined;

  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/epreuves/${slug}`)}`);

  try {
    await savePrediction({
      predictions: createSupabasePredictionRepository(await getSessionClient()),
    }).execute({
      userId: user.userId,
      eventId: formText(data, "eventId"),
      first: formText(data, "first"),
      second: formText(data, "second"),
      third: formText(data, "third"),
      useJoker: state.useJoker,
      marks: state.marks,
      markUnit,
      markFamily,
      markDiscipline,
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { ...state, error: error.code };
    throw error;
  }
  revalidatePath("/competitions");
  return { ...state, saved: true };
}

/**
 * Sets the leagues the player's prediction of the event counts in (#1068), from the sheet after a
 * save or the switches of the event page. The page and the leagues are read again.
 */
export async function savePredictionLeaguesAction(
  slug: string,
  eventId: string,
  leagueIds: string[],
): Promise<{ error?: ErrorCode }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/epreuves/${slug}`)}`);
  try {
    await savePredictionLeagues({
      predictionLeagues: createSupabasePredictionLeagueRepository(await getSessionClient()),
    }).execute({ eventId, leagueIds });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/epreuves/${slug}`);
  return {};
}
