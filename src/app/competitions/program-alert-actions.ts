"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError } from "@/application/errors";
import { setProgramAlert } from "@/application/program-alerts";
import { createSupabaseProgramAlertRepository } from "@/infra";

import { formText } from "../form-data";
import { getSessionClient } from "../session";

export type ProgramAlertState = { on: boolean; error: boolean };

/** The player asks to be told, or no longer, when the programme of a competition is out (#659). */
export async function toggleProgramAlertAction(
  state: ProgramAlertState,
  data: FormData,
): Promise<ProgramAlertState> {
  const on = !state.on;
  try {
    await setProgramAlert({
      alerts: createSupabaseProgramAlertRepository(await getSessionClient()),
    }).execute({ competitionSlug: formText(data, "competition"), on });
  } catch (error) {
    if (error instanceof UseCaseError) return { ...state, error: true };
    throw error;
  }
  revalidatePath("/competitions");
  return { on, error: false };
}
