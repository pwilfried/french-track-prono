"use server";

import { redirect } from "next/navigation";

import { createProfile } from "@/application/create-profile";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { checkPlayerDetails, savePlayerDetails } from "@/application/player-details";
import { safeRedirectPath } from "@/domain/redirect";
import {
  createSupabaseClubDirectory,
  createSupabaseDisciplineRepository,
  createSupabasePlayerDetailsRepository,
  createSupabaseProfileRepository,
} from "@/infra";

import { formText } from "../form-data";
import { getCurrentUser, getSessionClient } from "../session";

export type WelcomeState = {
  pseudo: string;
  avatar: string;
  ageConfirmed: boolean;
  sex: string;
  disciplines: string[];
  club: { id: string; name: string; city: string } | null;
  newClubName: string;
  newClubCity: string;
  error?: ErrorCode;
};

export async function createProfileAction(_: WelcomeState, data: FormData): Promise<WelcomeState> {
  const clubId = formText(data, "clubId");
  const state: WelcomeState = {
    pseudo: formText(data, "pseudo"),
    avatar: formText(data, "avatar"),
    ageConfirmed: data.get("age") === "on",
    sex: formText(data, "sex"),
    disciplines: data.getAll("discipline").filter((d): d is string => typeof d === "string"),
    club: clubId
      ? { id: clubId, name: formText(data, "clubName"), city: formText(data, "clubCity") }
      : null,
    newClubName: formText(data, "newClubName"),
    newClubCity: formText(data, "newClubCity"),
  };
  const details = {
    sex: state.sex,
    disciplines: state.disciplines,
    clubId,
    newClubName: state.newClubName,
    newClubCity: state.newClubCity,
  };

  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/bienvenue");

  // Checked first, so that a wrong club name does not leave a half-made profile.
  const problem = checkPlayerDetails(details);
  if (problem) return { ...state, error: problem };

  const client = await getSessionClient();
  try {
    await createProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
      ...state,
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) {
      // Someone who already has a profile has nothing to fill in: carry on.
      if (error.code !== "PROFILE_EXISTS") return { ...state, error: error.code };
      redirect(safeRedirectPath(formText(data, "next")));
    } else throw error;
  }

  try {
    await savePlayerDetails({
      details: createSupabasePlayerDetailsRepository(client),
      clubs: createSupabaseClubDirectory(client),
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute({ userId: user.userId, ...details });
  } catch (error) {
    // The profile exists: the player can complete these details later from their profile.
    if (!(error instanceof UseCaseError)) throw error;
  }
  redirect(safeRedirectPath(formText(data, "next")));
}
