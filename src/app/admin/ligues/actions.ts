"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { deleteReportedLeague, renameReportedLeague } from "@/application/league-moderation";
import { createSupabaseLeagueModerationRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type ModerationState = { error?: ErrorCode; done?: boolean };

async function moderation() {
  const { client } = await adminOnly();
  return createSupabaseLeagueModerationRepository(client);
}

export async function renameLeagueAction(
  _: ModerationState,
  data: FormData,
): Promise<ModerationState> {
  try {
    await renameReportedLeague({ moderation: await moderation() }).execute({
      leagueId: formText(data, "leagueId"),
      name: formText(data, "name"),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/ligues");
  return { done: true };
}

export async function deleteLeagueAction(
  _: ModerationState,
  data: FormData,
): Promise<ModerationState> {
  if (formText(data, "confirm") !== "1") return { error: "DELETION_NOT_CONFIRMED" };
  try {
    await deleteReportedLeague({ moderation: await moderation() }).execute({
      leagueId: formText(data, "leagueId"),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/ligues");
  return { done: true };
}
