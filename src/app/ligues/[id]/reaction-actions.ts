"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import {
  reactToMoment,
  reportMomentReaction,
  sendPresetMessage,
} from "@/application/moment-reactions";
import { createSupabaseMomentReactionRepository } from "@/infra";

import { getCurrentUser, getSessionClient } from "../../session";

type Result = { error?: ErrorCode };

/** Runs a reaction as the signed-in member, then shows the feed again (#672). */
async function asMember(
  leagueId: string,
  work: (ports: {
    reactions: ReturnType<typeof createSupabaseMomentReactionRepository>;
  }) => Promise<void>,
): Promise<Result> {
  const back = `/ligues/${leagueId}?onglet=fil`;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  try {
    await work({ reactions: createSupabaseMomentReactionRepository(await getSessionClient()) });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath(`/ligues/${leagueId}`);
  return {};
}

export async function reactToMomentAction(
  leagueId: string,
  momentKey: string,
  emoji: string,
  on: boolean,
): Promise<Result> {
  return asMember(leagueId, (ports) =>
    reactToMoment(ports).execute({ leagueId, momentKey, emoji, on }),
  );
}

export async function sendMomentMessageAction(
  leagueId: string,
  momentKey: string,
  message: string,
): Promise<Result> {
  return asMember(leagueId, (ports) =>
    sendPresetMessage(ports).execute({ leagueId, momentKey, message }),
  );
}

export async function reportMomentReactionAction(
  leagueId: string,
  reactionId: string,
): Promise<Result> {
  return asMember(leagueId, (ports) => reportMomentReaction(ports).execute({ reactionId }));
}
