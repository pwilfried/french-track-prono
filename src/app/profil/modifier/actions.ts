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

import { readPlayerDetails, type PlayerDetailsFields } from "../../player-details-form";
import { formText } from "../../form-data";
import { getCurrentUser, getSessionClient } from "../../session";

export type EditProfileState = PlayerDetailsFields & {
  pseudo: string;
  bibNumber: string;
  bibColor: string;
  error?: ErrorCode;
};

export async function editProfileAction(
  _: EditProfileState,
  data: FormData,
): Promise<EditProfileState> {
  const { fields, input: details } = readPlayerDetails(data);
  const state: EditProfileState = {
    pseudo: formText(data, "pseudo"),
    bibNumber: formText(data, "bibNumber"),
    bibColor: formText(data, "bibColor"),
    ...fields,
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
      bibNumber: state.bibNumber,
      bibColor: state.bibColor,
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
