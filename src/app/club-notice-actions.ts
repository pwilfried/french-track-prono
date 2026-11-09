"use server";

import { revalidatePath } from "next/cache";

import { dismissClubNotice } from "@/application/club-notices";
import { UseCaseError } from "@/application/errors";
import { createSupabaseClubNoticeRepository } from "@/infra";

import { formText } from "./form-data";
import { getSessionClient } from "./session";

/** The player closes a club notice (#372). */
export async function dismissClubNoticeAction(data: FormData): Promise<void> {
  try {
    await dismissClubNotice({
      notices: createSupabaseClubNoticeRepository(await getSessionClient()),
    }).execute({ id: formText(data, "id") });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
  }
  revalidatePath("/");
  revalidatePath("/profil");
}
