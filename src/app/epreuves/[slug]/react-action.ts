"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { react } from "@/application/react";
import { createSupabaseReactionRepository } from "@/infra";

import { formText } from "../../form-data";
import { getCurrentUser, getSessionClient } from "../../session";

export type ReactState = { error?: ErrorCode };

/** Sets my reaction, or removes it when I tap the one I already gave. */
export async function reactAction(_: ReactState, data: FormData): Promise<ReactState> {
  const slug = formText(data, "slug");
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/epreuves/${slug}`)}`);

  const chosen = formText(data, "reaction");
  try {
    await react({
      reactions: createSupabaseReactionRepository(await getSessionClient()),
    }).execute({
      predictionId: formText(data, "predictionId"),
      reaction: chosen === formText(data, "current") ? null : chosen,
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/epreuves/${slug}`);
  return {};
}
