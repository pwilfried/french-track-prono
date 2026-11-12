"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { completeProfile, completeProfileLater } from "@/application/profile-reminder";
import type { CompleteProfileState } from "@/components/home/complete-profile-card";
import {
  createSupabaseClubDirectory,
  createSupabaseDisciplineRepository,
  createSupabasePlayerDetailsRepository,
  createSupabaseProfileReminderRepository,
} from "@/infra";

import { formText } from "./form-data";
import { readPlayerDetails } from "./player-details-form";
import { getCurrentUser, getSessionClient } from "./session";

/** The player saves their club and families from the home card (#540). */
export async function completeProfileAction(
  _: CompleteProfileState,
  data: FormData,
): Promise<CompleteProfileState> {
  const { fields } = readPlayerDetails(data);
  const families = data.getAll("family").filter((f): f is string => typeof f === "string");
  const state: CompleteProfileState = {
    club: fields.club,
    newClubName: fields.newClubName,
    newClubCity: fields.newClubCity,
    families,
  };

  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const client = await getSessionClient();
  try {
    await completeProfile({
      details: createSupabasePlayerDetailsRepository(client),
      clubs: createSupabaseClubDirectory(client),
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute({
      userId: user.userId,
      clubId: formText(data, "clubId"),
      newClubName: fields.newClubName,
      newClubCity: fields.newClubCity,
      families,
    });
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { ...state, error: error.code };
    throw error;
  }
  revalidatePath("/");
  revalidatePath("/profil");
  return { ...state, done: true };
}

/** « Plus tard »: the card is hidden for 30 days on every device (#540). */
export async function completeProfileLaterAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    await completeProfileLater({
      reminders: createSupabaseProfileReminderRepository(await getSessionClient()),
    }).execute({ userId: user.userId, now: new Date() });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
  }
  revalidatePath("/");
}
