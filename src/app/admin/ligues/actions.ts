"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  deleteReportedLeague,
  dismissLeagueReports,
  getLeagueMembers,
  removeLeagueMember,
  renameReportedLeague,
  type AdminLeagueMember,
} from "@/application/league-moderation";
import { createSupabaseLeagueModerationRepository } from "@/infra";

import { adminOnly } from "../guard";

export type LeagueListResult = { error?: ErrorCode; count?: number };

async function moderation() {
  const { client } = await adminOnly();
  return createSupabaseLeagueModerationRepository(client);
}

async function run(work: () => Promise<number>): Promise<LeagueListResult> {
  try {
    const count = await work();
    revalidatePath("/admin/ligues");
    return { count };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

export async function renameLeagueAction(
  leagueId: string,
  name: string,
): Promise<LeagueListResult> {
  const repository = await moderation();
  return run(async () => {
    await renameReportedLeague({ moderation: repository }).execute({ leagueId, name });
    return 1;
  });
}

export async function dismissReportsAction(ids: string[]): Promise<LeagueListResult> {
  const repository = await moderation();
  return run(async () => {
    for (const leagueId of ids)
      await dismissLeagueReports({ moderation: repository }).execute({ leagueId });
    return ids.length;
  });
}

/** Deletion is confirmed in the page's confirmation window before this runs. */
export async function deleteLeaguesAction(ids: string[]): Promise<LeagueListResult> {
  const repository = await moderation();
  return run(async () => {
    for (const leagueId of ids)
      await deleteReportedLeague({ moderation: repository }).execute({ leagueId });
    return ids.length;
  });
}

export async function removeMemberAction(
  leagueId: string,
  userId: string,
): Promise<LeagueListResult> {
  const repository = await moderation();
  return run(async () => {
    await removeLeagueMember({ moderation: repository }).execute({ leagueId, userId });
    return 1;
  });
}

/** The members of a league, read when the admin opens its sheet. */
export async function leagueMembersAction(
  leagueId: string,
): Promise<{ members?: AdminLeagueMember[]; error?: ErrorCode }> {
  try {
    return {
      members: await getLeagueMembers({ moderation: await moderation() }).execute({ leagueId }),
    };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}
