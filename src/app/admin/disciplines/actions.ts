"use server";

import { revalidatePath } from "next/cache";

import { setDisciplineTolerance } from "@/application/disciplines";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseDisciplineRepository } from "@/infra";

import { formText } from "../../form-data";
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
  revalidatePath("/admin/disciplines");
  return { saved: true };
}
