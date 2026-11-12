"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { launchManagerMercato, setManagerMercato } from "@/application/manager-leagues";
import { parisToUtc } from "@/domain/competition";
import type { RoundMode } from "@/domain/manager-league";

import { formText } from "../form-data";
import { managerPorts } from "./data";

export type MercatoFormState = { error?: ErrorCode; saved?: boolean };

/** The creator sets the mercato of their league (#619); the start is typed in Paris time. */
export async function setMercatoAction(
  _: MercatoFormState,
  data: FormData,
): Promise<MercatoFormState> {
  const id = formText(data, "league");
  const ports = await managerPorts(`/manager/${id}`);
  const local = formText(data, "startsAt");
  const rounds: RoundMode =
    formText(data, "mode") === "custom"
      ? {
          mode: "custom",
          firstHours: Number(formText(data, "firstHours")),
          nextHours: Number(formText(data, "nextHours")),
        }
      : { mode: "auto" };
  try {
    let startsAt: string | null = null;
    if (local) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new UseCaseError("DATE_INVALID");
      startsAt = parisToUtc(local);
    }
    await setManagerMercato(ports).execute({
      id,
      target: Number(formText(data, "target")),
      startsAt,
      rounds,
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${id}`);
  return { saved: true };
}

/** The creator launches the mercato now, once the players are all in: round 1 opens. */
export async function launchMercatoAction(
  _: MercatoFormState,
  data: FormData,
): Promise<MercatoFormState> {
  const id = formText(data, "league");
  const ports = await managerPorts(`/manager/${id}`);
  try {
    await launchManagerMercato(ports).execute({ id });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/manager/${id}`);
  redirect(`/manager/${id}/catalogue`);
}
