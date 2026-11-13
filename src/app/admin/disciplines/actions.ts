"use server";

import { revalidatePath } from "next/cache";

import { createDiscipline, setDisciplineTolerance } from "@/application/disciplines";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseDisciplineRepository } from "@/infra";

import { formText } from "../../form-data";
import { publicDataChanged } from "../../public-data";
import { adminOnly } from "../guard";

export type ToleranceState = { error?: ErrorCode; saved?: boolean };

export async function saveToleranceAction(
  _: ToleranceState,
  data: FormData,
): Promise<ToleranceState> {
  const { client } = await adminOnly();
  try {
    await setDisciplineTolerance({
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute({
      name: formText(data, "name"),
      tolerance: Number(formText(data, "tolerance").replace(",", ".")),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  publicDataChanged("discipline");
  revalidatePath("/admin/disciplines");
  return { saved: true };
}

export type CreateDisciplineState = { error?: ErrorCode; created?: string };

/** « Nouvelle discipline » (#292). */
export async function createDisciplineAction(
  _: CreateDisciplineState,
  data: FormData,
): Promise<CreateDisciplineState> {
  const { client } = await adminOnly();
  const name = formText(data, "name");
  try {
    await createDiscipline({ disciplines: createSupabaseDisciplineRepository(client) }).execute({
      name,
      family: formText(data, "family"),
      unit: formText(data, "unit"),
      lowerIsBetter: formText(data, "direction") === "lower",
      tolerance: Number(formText(data, "tolerance").replace(",", ".")),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  publicDataChanged("discipline");
  revalidatePath("/admin/disciplines");
  return { created: name.replace(/\s+/g, " ").trim() };
}
