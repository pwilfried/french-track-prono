"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { deletePlayer, setPlayerBlocked } from "@/application/player-moderation";
import { createSupabasePlayerModerationRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type PlayerActionState = { error?: ErrorCode; done?: boolean };

async function players() {
  const { client } = await adminOnly();
  return createSupabasePlayerModerationRepository(client);
}

export async function setBlockedAction(
  _: PlayerActionState,
  data: FormData,
): Promise<PlayerActionState> {
  try {
    await setPlayerBlocked({ players: await players() }).execute({
      playerId: formText(data, "playerId"),
      blocked: formText(data, "blocked") === "1",
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/joueurs");
  return { done: true };
}

export async function deletePlayerAction(
  _: PlayerActionState,
  data: FormData,
): Promise<PlayerActionState> {
  if (formText(data, "confirm") !== "1") return { error: "DELETION_NOT_CONFIRMED" };
  try {
    await deletePlayer({ players: await players() }).execute({
      playerId: formText(data, "playerId"),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/joueurs");
  return { done: true };
}
