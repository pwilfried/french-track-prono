"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  deletePlayer,
  getPlayerLeagues,
  setPlayerBlocked,
  type PlayerLeague,
} from "@/application/player-moderation";
import { createSupabasePlayerModerationRepository } from "@/infra";

import { adminOnly } from "../guard";

export type PlayerListResult = { error?: ErrorCode; count?: number };

async function players() {
  const { client } = await adminOnly();
  return createSupabasePlayerModerationRepository(client);
}

async function run(work: () => Promise<number>): Promise<PlayerListResult> {
  try {
    const count = await work();
    revalidatePath("/admin/joueurs");
    return { count };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

export async function setBlockedAction(ids: string[], blocked: boolean): Promise<PlayerListResult> {
  const repository = await players();
  return run(async () => {
    for (const playerId of ids)
      await setPlayerBlocked({ players: repository }).execute({ playerId, blocked });
    return ids.length;
  });
}

/** Deletion is confirmed in the page's confirmation window before this runs. */
export async function deletePlayersAction(ids: string[]): Promise<PlayerListResult> {
  const repository = await players();
  return run(async () => {
    for (const playerId of ids) await deletePlayer({ players: repository }).execute({ playerId });
    return ids.length;
  });
}

/** The leagues of a player, read when the admin opens their sheet. */
export async function playerLeaguesAction(
  playerId: string,
): Promise<{ leagues?: PlayerLeague[]; error?: ErrorCode }> {
  try {
    return { leagues: await getPlayerLeagues({ players: await players() }).execute({ playerId }) };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}
