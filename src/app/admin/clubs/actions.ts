"use server";

import { revalidatePath } from "next/cache";

import { deleteClub, saveClub, validateClub } from "@/application/club-admin";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseClubAdminRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type ClubActionState = { error?: ErrorCode; done?: boolean };

async function clubs() {
  const { client } = await adminOnly();
  return createSupabaseClubAdminRepository(client);
}

async function run(work: () => Promise<unknown>): Promise<ClubActionState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/clubs");
  return { done: true };
}

export async function saveClubAction(_: ClubActionState, data: FormData): Promise<ClubActionState> {
  const repository = await clubs();
  return run(() =>
    saveClub({ clubs: repository }).execute({
      id: formText(data, "id") || null,
      name: formText(data, "name"),
      city: formText(data, "city"),
      department: formText(data, "department"),
    }),
  );
}

export async function validateClubAction(
  _: ClubActionState,
  data: FormData,
): Promise<ClubActionState> {
  const repository = await clubs();
  return run(() => validateClub({ clubs: repository }).execute({ id: formText(data, "id") }));
}

export async function deleteClubAction(
  _: ClubActionState,
  data: FormData,
): Promise<ClubActionState> {
  if (formText(data, "confirm") !== "1") return { error: "DELETION_NOT_CONFIRMED" };
  const repository = await clubs();
  return run(() => deleteClub({ clubs: repository }).execute({ id: formText(data, "id") }));
}
