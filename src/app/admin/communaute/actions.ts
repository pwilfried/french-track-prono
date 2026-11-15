"use server";

import { revalidatePath } from "next/cache";

import {
  createPoll,
  publishAnnouncement,
  removeAnnouncement,
  removePoll,
} from "@/application/community";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { parisToUtc } from "@/domain/competition";
import { POLL_OPTIONS_MAX } from "@/domain/community";
import { createSupabaseCommunityRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type CommunityFormState = { error?: ErrorCode; done?: boolean };

function refresh() {
  revalidatePath("/admin/communaute");
  revalidatePath("/");
  revalidatePath("/communaute");
}

async function attempt(run: () => Promise<unknown>): Promise<CommunityFormState> {
  try {
    await run();
    refresh();
    return { done: true };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

/** Publishes an announcement of FrenchTrack (#673). */
export async function publishAnnouncementAction(
  _: CommunityFormState,
  data: FormData,
): Promise<CommunityFormState> {
  const { client } = await adminOnly();
  return attempt(() =>
    publishAnnouncement({ community: createSupabaseCommunityRepository(client) }).execute({
      kind: formText(data, "kind"),
      title: formText(data, "title"),
      subtitle: formText(data, "subtitle"),
      link: formText(data, "link"),
    }),
  );
}

/** Creates a poll: a question, 2 to 4 answers, a closing time typed in Paris time (#673). */
export async function createPollAction(
  _: CommunityFormState,
  data: FormData,
): Promise<CommunityFormState> {
  const { client } = await adminOnly();
  const local = formText(data, "closesAt");
  let closesAt = "";
  try {
    if (local) closesAt = parisToUtc(local);
  } catch {
    // A time that is not one is refused below as an invalid poll.
  }
  return attempt(() =>
    createPoll({ community: createSupabaseCommunityRepository(client) }).execute({
      question: formText(data, "question"),
      options: Array.from({ length: POLL_OPTIONS_MAX }, (_o, i) => formText(data, `option${i}`)),
      closesAt,
    }),
  );
}

/** Removes an announcement or a poll: it disappears for everybody. */
export async function removeCommunityItemAction(data: FormData): Promise<void> {
  const { client } = await adminOnly();
  const community = createSupabaseCommunityRepository(client);
  const id = formText(data, "id");
  await attempt(() =>
    formText(data, "type") === "poll"
      ? removePoll({ community }).execute({ id })
      : removeAnnouncement({ community }).execute({ id }),
  );
}
