"use server";

import { revalidatePath } from "next/cache";

import { deleteClub, mergeClub, saveClub, validateClub } from "@/application/club-admin";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseClubAdminRepository } from "@/infra";

import { formText } from "../../form-data";
import { publicDataChanged } from "../../public-data";
import { adminOnly } from "../guard";

/** The ranking lines in cache show each player's club (#1070): they expire with the admin page. */
function clubsChanged() {
  publicDataChanged("club");
  revalidatePath("/admin/clubs");
}

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
  clubsChanged();
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

/** What a list action tells the page: how many clubs it touched, or why it failed. */
export type ClubListResult = { error?: ErrorCode; count?: number };

async function runList(work: () => Promise<number>): Promise<ClubListResult> {
  try {
    const count = await work();
    clubsChanged();
    return { count };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

export async function validateClubsAction(ids: string[]): Promise<ClubListResult> {
  const repository = await clubs();
  return runList(async () => {
    for (const id of ids) await validateClub({ clubs: repository }).execute({ id });
    return ids.length;
  });
}

/** Deletion is confirmed in the page's confirmation window before this runs. */
export async function deleteClubsAction(ids: string[]): Promise<ClubListResult> {
  const repository = await clubs();
  return runList(async () => {
    for (const id of ids) await deleteClub({ clubs: repository }).execute({ id });
    return ids.length;
  });
}

export async function updateClubAction(
  id: string,
  fields: { name: string; city: string; department: string },
): Promise<ClubListResult> {
  const repository = await clubs();
  return runList(async () => {
    await saveClub({ clubs: repository }).execute({ id, ...fields });
    return 1;
  });
}

/** Returns how many players moved to the right club. */
export async function mergeClubAction(fromId: string, intoId: string): Promise<ClubListResult> {
  const repository = await clubs();
  return runList(() => mergeClub({ clubs: repository }).execute({ fromId, intoId }));
}
