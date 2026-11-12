"use server";

import { redirect } from "next/navigation";

import { createProfile } from "@/application/create-profile";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { safeRedirectPath } from "@/domain/redirect";
import { createSupabaseProfileRepository } from "@/infra";

import { formText } from "../form-data";
import { getCurrentUser, getSessionClient } from "../session";

/** The express profile (#539): pseudo, bib and age only; the rest waits for « Modifier mon profil ». */
export type WelcomeState = {
  pseudo: string;
  bibNumber: string;
  bibColor: string;
  ageConfirmed: boolean;
  error?: ErrorCode;
};

export async function createProfileAction(_: WelcomeState, data: FormData): Promise<WelcomeState> {
  const state: WelcomeState = {
    pseudo: formText(data, "pseudo"),
    bibNumber: formText(data, "bibNumber"),
    bibColor: formText(data, "bibColor"),
    ageConfirmed: data.get("age") === "on",
  };

  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/bienvenue");

  const client = await getSessionClient();
  try {
    await createProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
      ...state,
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (!(error instanceof UseCaseError)) throw error;
    // Someone who already has a profile has nothing to fill in: carry on.
    if (error.code !== "PROFILE_EXISTS") return { ...state, error: error.code };
  }
  // Straight to the event the player came from, for their first prediction; else the home.
  redirect(safeRedirectPath(formText(data, "next")));
}
