"use server";

import { revalidatePath } from "next/cache";

import { voteInPoll } from "@/application/community";
import { UseCaseError } from "@/application/errors";
import type { VoteState } from "@/components/community/poll-card";
import { createSupabaseCommunityRepository } from "@/infra";

import { formText } from "./form-data";
import { getSessionClient } from "./session";

/**
 * The player votes once for one answer of a poll (#673). Sends back the poll with its results,
 * shown at once where the player is.
 */
export async function votePollAction(_: VoteState, data: FormData): Promise<VoteState> {
  const community = createSupabaseCommunityRepository(await getSessionClient());
  const pollId = formText(data, "poll");
  try {
    await voteInPoll({ community }).execute({
      pollId,
      choice: Number(formText(data, "intent") || "-1"),
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    if (error.code !== "POLL_ALREADY_VOTED") return { error: error.code };
  }
  revalidatePath("/");
  revalidatePath("/communaute");
  try {
    const poll = (await community.polls()).find((p) => p.id === pollId);
    return poll ? { poll } : {};
  } catch (error) {
    if (error instanceof UseCaseError) return {};
    throw error;
  }
}
