"use server";

import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { checkPlayerDetails, savePlayerDetails } from "@/application/player-details";
import { updateProfile } from "@/application/update-profile";
import {
  createSupabaseClubDirectory,
  createSupabaseDisciplineRepository,
  createSupabasePlayerDetailsRepository,
  createSupabaseProfileRepository,
} from "@/infra";

import { formText } from "../../form-data";
import { getCurrentUser, getSessionClient } from "../../session";

export type EditProfileState = {
  pseudo: string;
  avatar: string;
  sex: string;
  disciplines: string[];
  club: { id: string; name: string; city: string } | null;
  newClubName: string;
  newClubCity: string;
  error?: ErrorCode;
};

export async function editProfileAction(
  _: EditProfileState,
  data: FormData,
): Promise<EditProfileState> {
  const clubId = formText(data, "clubId");
  const state: EditProfileState = {
    pseudo: formText(data, "pseudo"),
    avatar: formText(data, "avatar"),
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
  if (!user) redirect("/connexion?next=/profil/modifier");

  const problem = checkPlayerDetails(details);
  if (problem) return { ...state, error: problem };

  const client = await getSessionClient();
  try {
    await updateProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
      pseudo: state.pseudo,
      avatar: state.avatar,
    });
    await savePlayerDetails({
      details: createSupabasePlayerDetailsRepository(client),
      clubs: createSupabaseClubDirectory(client),
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute({ userId: user.userId, ...details });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { ...state, error: error.code };
    throw error;
  }
  redirect("/profil?enregistre=1");
}
